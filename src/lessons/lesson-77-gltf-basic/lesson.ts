import damagedHelmetUrl from "@/assets/damaged-helmet-basic.glb?url";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createOrbitCameraController } from "@/core/orbit-camera";
import { loadGlbScene, type LoadedGlbDrawable } from "@/lessons/lesson-77-gltf-basic/glb";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-77-gltf-basic/math";
import fragmentShaderSource from "@/lessons/lesson-77-gltf-basic/model.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-77-gltf-basic/model.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type GlbRenderable = {
  name: string;
  primitives: LoadedGlbDrawable["primitives"];
  baseWorldMatrix: Float32Array;
  nodeUniformBuffer: GPUBuffer;
  nodeBindGroup: GPUBindGroup;
};

/**
 * 把 viewProjection 矩阵和主光方向打包成一份 frame uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前帧的 VP 矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续 float 数据。
 */
function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    16
  );
  return uniformData;
}

/**
 * 把单个节点的 model matrix 打包成 uniform 数据。
 * @param {Float32Array} modelMatrix 当前节点这一次 draw 使用的模型矩阵。
 * @returns {Float32Array} 对应的节点 uniform 数据。
 */
function createNodeUniformData(modelMatrix: Float32Array): Float32Array {
  const uniformData = new Float32Array(16);
  uniformData.set(modelMatrix, 0);
  return uniformData;
}

/**
 * 挂载第 17 课“glTF 基础加载”预览，并演示 GLB 头部、accessor 和 node transform 的最小解析链路。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountGltfBasicLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="glTF basic lesson preview"></canvas>
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

    /**
     * loadGlbScene
     * 读取外部 GLB 文件，并把 POSITION、NORMAL、indices 和 node transform 解析成可直接绘制的场景数据。
     * @param {string} glbUrl lesson 中要加载的模型资源 URL。
     * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
     * @returns {Promise<import("./glb").LoadedGlbScene>} 已经上传到 GPU 的最小 GLB 场景。
     */
    const glbScene = await loadGlbScene(damagedHelmetUrl, gpu.device);

    const frameUniformBuffer = gpu.device.createBuffer({
      size: 16 * 4 + 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-77-gltf-basic",
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
                // shaderLocation 0：position accessor 解析出来的 3 个 float32。
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
                // shaderLocation 1：normal accessor 解析出来的 3 个 float32。
                shaderLocation: 1,
                offset: 0,
                format: "float32x3",
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

    const renderables: GlbRenderable[] = glbScene.drawables.map((drawable) => {
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

      return {
        name: drawable.name,
        primitives: drawable.primitives,
        baseWorldMatrix: drawable.baseWorldMatrix,
        nodeUniformBuffer,
        nodeBindGroup,
      };
    });

    const ensureDepthTexture = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        depthTexture &&
        depthTextureView &&
        width > 0 &&
        height > 0
      ) {
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
    const cameraDistance = Math.max(modelRadius * 2.8, 3.8);
    const eye: Vector3 = [0, modelRadius * 0.35, cameraDistance];
    const target: Vector3 = [0, -modelRadius * 0.1, 0];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
      minRadius: Math.max(modelRadius * 1.45, 2.4),
      maxRadius: Math.max(modelRadius * 5.4, 7.5),
    });
    const lightDirection = normalizeVector([0.42, 0.95, 0.58]);

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
        createRotationYMatrix(elapsed * 0.35),
        createRotationXMatrix(-0.12)
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const frameUniformData = createFrameUniformData(
        viewProjectionMatrix,
        lightDirection
      );
      gpu.device.queue.writeBuffer(frameUniformBuffer, 0, frameUniformData);

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
        const modelMatrix = multiplyMatrices(
          spinMatrix,
          renderable.baseWorldMatrix
        );
        gpu.device.queue.writeBuffer(
          renderable.nodeUniformBuffer,
          0,
          createNodeUniformData(modelMatrix)
        );
        pass.setBindGroup(1, renderable.nodeBindGroup);

        renderable.primitives.forEach((primitive) => {
          pass.setVertexBuffer(0, primitive.positionBuffer);
          pass.setVertexBuffer(1, primitive.normalBuffer);
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
      title: "glTF 基础加载已运行",
      detail:
        "这一课已经把外部 GLB 的 header、JSON chunk、BIN chunk、POSITION / NORMAL / indices 和 node transform 接进了 WebGPU。",
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
