import damagedHelmetUrl from "@/assets/damaged-helmet-basic.glb?url";
import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import {
  loadPbrGlbScene,
  type LoadedPbrGlbDrawable,
  type LoadedPbrGlbMaterial,
} from "@/lessons/lesson-83-gltf-pbr-basic/glb";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-83-gltf-pbr-basic/math";
import fragmentShaderSource from "@/lessons/lesson-83-gltf-pbr-basic/model.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-83-gltf-pbr-basic/model.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type PbrRenderablePrimitive = LoadedPbrGlbDrawable["primitives"][number] & {
  materialUniformBuffer: GPUBuffer;
  materialBindGroup: GPUBindGroup;
};

type PbrRenderable = {
  name: string;
  primitives: PbrRenderablePrimitive[];
  baseWorldMatrix: Float32Array;
  nodeUniformBuffer: GPUBuffer;
  nodeBindGroup: GPUBindGroup;
};

/**
 * 把 VP 矩阵、主光方向和相机位置打包成 frame uniform。
 * @param {Float32Array} viewProjectionMatrix 当前帧的 VP 矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @param {Vector3} cameraPosition 当前相机位置。
 * @returns {Float32Array} 可直接写进 frame uniform buffer 的连续数据。
 */
function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  lightDirection: Vector3,
  cameraPosition: Vector3
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set([lightDirection[0], lightDirection[1], lightDirection[2], 0], 16);
  uniformData.set([cameraPosition[0], cameraPosition[1], cameraPosition[2], 0], 20);
  return uniformData;
}

/**
 * 把当前 drawable 的 model matrix 打包成节点 uniform。
 * @param {Float32Array} modelMatrix 当前节点这一次 draw 使用的模型矩阵。
 * @returns {Float32Array} 对应的节点 uniform 数据。
 */
function createNodeUniformData(modelMatrix: Float32Array): Float32Array {
  const uniformData = new Float32Array(16);
  uniformData.set(modelMatrix, 0);
  return uniformData;
}

/**
 * 把 glTF 材质里的 baseColor / metallic / roughness / normalScale 打包成 material uniform。
 * @param {LoadedPbrGlbMaterial} material 当前 primitive 对应的 PBR 材质。
 * @returns {Float32Array} 可直接写进 material uniform buffer 的连续 float 数据。
 */
function createMaterialUniformData(
  material: LoadedPbrGlbMaterial
): Float32Array {
  const uniformData = new Float32Array(8);
  uniformData.set(material.baseColorFactor, 0);
  uniformData.set(
    [
      material.metallicFactor,
      material.roughnessFactor,
      material.normalScale,
      0,
    ],
    4
  );
  return uniformData;
}

/**
 * 挂载第 25 课“PBR 基础”预览，在 lesson 18 的贴图模型上继续接入 metallic-roughness 和 normal map。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountGltfPbrBasicLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="glTF PBR basics lesson preview"></canvas>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const viewport = host.querySelector<HTMLDivElement>(".preview-viewport");
  if (!canvas) {
    throw new Error("预览 canvas 没有创建成功。");
  }
  if (!viewport) {
    throw new Error("预览视口没有创建成功。");
  }

  let depthTexture: GPUTexture | null = null;
  let depthTextureView: GPUTextureView | null = null;

  /**
   * 释放当前 lesson 持有的深度纹理及其视图。
   * @returns {void} 只负责销毁当前深度资源，不返回额外结果。
   */
  const destroyDepthTexture = () => {
    const currentDepthTexture = depthTexture;
    if (currentDepthTexture) {
      currentDepthTexture.destroy();
    }
    depthTexture = null;
    depthTextureView = null;
  };

  try {
    const gpu = await createWebGpuCanvas(canvas);

    /**
     * 根据宿主容器尺寸同步中间预览区的 16:9 画幅。
     * @returns {void} 只更新预览视口的宽高样式，不返回额外结果。
     */
    const syncViewport = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const aspect = 16 / 9;

      let nextWidth = width;
      let nextHeight = nextWidth / aspect;

      if (nextHeight > height) {
        nextHeight = height;
        nextWidth = nextHeight * aspect;
      }

      viewport.style.width = `${Math.floor(nextWidth)}px`;
      viewport.style.height = `${Math.floor(nextHeight)}px`;
    };

    const glbScene = await loadPbrGlbScene(damagedHelmetUrl, gpu.device);

    const frameUniformBuffer = gpu.device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-83-gltf-pbr-basic",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({
          code: vertexShaderSource,
        }),
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 3 * 4,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
            ],
          },
          {
            arrayStride: 3 * 4,
            attributes: [
              {
                shaderLocation: 1,
                offset: 0,
                format: "float32x3",
              },
            ],
          },
          {
            arrayStride: 2 * 4,
            attributes: [
              {
                shaderLocation: 2,
                offset: 0,
                format: "float32x2",
              },
            ],
          },
        ],
      },
      fragment: {
        module: gpu.device.createShaderModule({
          code: fragmentShaderSource,
        }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const frameBindGroup = gpu.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: frameUniformBuffer,
          },
        },
      ],
    });

    const renderables: PbrRenderable[] = glbScene.drawables.map((drawable) => {
      const nodeUniformBuffer = gpu.device.createBuffer({
        size: 16 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const nodeBindGroup = gpu.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          {
            binding: 0,
            resource: {
              buffer: nodeUniformBuffer,
            },
          },
        ],
      });

      const primitives = drawable.primitives.map((primitive) => {
        const materialUniformBuffer = gpu.device.createBuffer({
          size: 8 * 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        gpu.device.queue.writeBuffer(
          materialUniformBuffer,
          0,
          createMaterialUniformData(primitive.material)
        );

        const materialBindGroup = gpu.device.createBindGroup({
          layout: pipeline.getBindGroupLayout(2),
          entries: [
            {
              binding: 0,
              resource: primitive.material.baseColorSampler,
            },
            {
              binding: 1,
              resource: primitive.material.baseColorTextureView,
            },
            {
              binding: 2,
              resource: primitive.material.metallicRoughnessTextureView,
            },
            {
              binding: 3,
              resource: primitive.material.normalTextureView,
            },
            {
              binding: 4,
              resource: {
                buffer: materialUniformBuffer,
              },
            },
          ],
        });

        return {
          ...primitive,
          materialUniformBuffer,
          materialBindGroup,
        };
      });

      return {
        name: drawable.name,
        primitives,
        baseWorldMatrix: drawable.baseWorldMatrix,
        nodeUniformBuffer,
        nodeBindGroup,
      };
    });

    const ensureDepthTexture = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (depthTexture && depthTextureView && width > 0 && height > 0) {
        return depthTextureView;
      }

      destroyDepthTexture();
      depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTextureView = depthTexture.createView();
      return depthTextureView;
    };

    const sceneMin = glbScene.bounds.min;
    const sceneMax = glbScene.bounds.max;
    const extentX = sceneMax[0] - sceneMin[0];
    const extentY = sceneMax[1] - sceneMin[1];
    const extentZ = sceneMax[2] - sceneMin[2];
    const modelRadius = Math.max(extentX, extentY, extentZ) * 0.55;
    const cameraDistance = Math.max(modelRadius * 2.9, 4.2);
    const eye: Vector3 = [0, modelRadius * 0.35, cameraDistance];
    const target: Vector3 = [0, -modelRadius * 0.05, 0];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
      minRadius: Math.max(modelRadius * 1.4, 2.8),
      maxRadius: Math.max(modelRadius * 5.2, 8.5),
    });
    const lightDirection = normalizeVector([0.45, 0.82, 0.34]);

    const render = (elapsed: number) => {
      syncViewport();
      gpu.resize();
      const currentDepthView = ensureDepthTexture();

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        (48 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const spinMatrix = multiplyMatrices(
        createRotationYMatrix(elapsed * 0.24),
        createRotationXMatrix(-0.1)
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      gpu.device.queue.writeBuffer(
        frameUniformBuffer,
        0,
        createFrameUniformData(viewProjectionMatrix, lightDirection, camera.eye)
      );

      const commandEncoder = gpu.device.createCommandEncoder();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.043, g: 0.074, b: 0.141, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: currentDepthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, frameBindGroup);

      renderables.forEach((renderable) => {
        const modelMatrix = multiplyMatrices(spinMatrix, renderable.baseWorldMatrix);
        gpu.device.queue.writeBuffer(
          renderable.nodeUniformBuffer,
          0,
          createNodeUniformData(modelMatrix)
        );
        pass.setBindGroup(1, renderable.nodeBindGroup);

        renderable.primitives.forEach((primitive) => {
          pass.setBindGroup(2, primitive.materialBindGroup);
          pass.setVertexBuffer(0, primitive.positionBuffer);
          pass.setVertexBuffer(1, primitive.normalBuffer);
          pass.setVertexBuffer(2, primitive.uvBuffer);
          if (primitive.indexBuffer && primitive.indexFormat) {
            pass.setIndexBuffer(primitive.indexBuffer, primitive.indexFormat);
            pass.drawIndexed(primitive.indexCount);
          } else {
            pass.draw(primitive.vertexCount);
          }
        });
      });

      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    let animationFrameId = 0;
    const startTime = performance.now();

    const frame = (time: number) => {
      const elapsed = (time - startTime) * 0.001;
      render(elapsed);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      destroyDepthTexture();
      syncViewport();
    });

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "PBR 基础已运行",
      detail:
        "这一课在 glTF 贴图模型上继续接入 `baseColor`、`metallic-roughness` 和 `normal map`，第一次让材质本身参与更完整的光照计算。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      window.cancelAnimationFrame(animationFrameId);
      destroyDepthTexture();
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知的 WebGPU 错误。";

    host.innerHTML = `
      <div class="preview-empty">
        <h3>预览不可用</h3>
        <p>${message}</p>
      </div>
    `;

    destroyDepthTexture();

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
