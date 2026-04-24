import { createWebGpuCanvas } from "@/core/webgpu";
import { createOrbitCameraController } from "@/core/orbit-camera";
import { createPostProcessCubeGeometry } from "@/lessons/lesson-20-post-processing/cube-data";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-20-post-processing/math";
import postFragmentShaderSource from "@/lessons/lesson-20-post-processing/post.frag.wgsl?raw";
import postVertexShaderSource from "@/lessons/lesson-20-post-processing/post.vert.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-20-post-processing/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-20-post-processing/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type RenderTargets = {
  sceneTexture: GPUTexture | null;
  sceneTextureView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthTextureView: GPUTextureView | null;
  postBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

/**
 * 安全释放一张 GPUTexture。
 * @param {GPUTexture | null} resource 要释放的 GPU 纹理对象。
 * @returns {void} 只负责销毁纹理，不返回额外结果。
 */
function destroyGpuTexture(resource: GPUTexture | null): void {
  resource?.destroy();
}

/**
 * 把 MVP 矩阵、模型矩阵和主光方向打包成一份 uniform 数据。
 * @param {Float32Array} modelViewProjectionMatrix 当前帧的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前帧的模型矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 适合直接写进 uniform buffer 的连续 float 数据。
 */
function createSceneUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    32
  );
  return uniformData;
}

/**
 * 挂载第 15 课“后处理与全屏 Pass”预览，并演示先离屏渲染、再全屏采样的两段流程。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountPostProcessingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Post processing lesson preview"></canvas>
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

  const renderTargets: RenderTargets = {
    sceneTexture: null,
    sceneTextureView: null,
    depthTexture: null,
    depthTextureView: null,
    postBindGroup: null,
    width: 0,
    height: 0,
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

    const cube = createPostProcessCubeGeometry();

    const vertexBuffer = gpu.device.createBuffer({
      size: cube.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(vertexBuffer, 0, cube.vertexData);

    const indexBuffer = gpu.device.createBuffer({
      size: cube.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(indexBuffer, 0, cube.indexData);

    const sceneUniformBuffer = gpu.device.createBuffer({
      size: 16 * 4 * 2 + 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-15-scene-pass",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({
          code: sceneVertexShaderSource,
        }),
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 9 * 4,
            attributes: [
              {
                // shaderLocation 0：位置属性，占 3 个 float32，对应 WGSL 里的 vec3f position。
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
              {
                // shaderLocation 1：顶点颜色，占 3 个 float32，对应 WGSL 里的 vec3f color。
                shaderLocation: 1,
                offset: 3 * 4,
                format: "float32x3",
              },
              {
                // shaderLocation 2：法线方向，占 3 个 float32，对应 WGSL 里的 vec3f normal。
                shaderLocation: 2,
                offset: 6 * 4,
                format: "float32x3",
              },
            ],
          },
        ],
      },
      fragment: {
        module: gpu.device.createShaderModule({
          code: sceneFragmentShaderSource,
        }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const sceneBindGroup = gpu.device.createBindGroup({
      layout: scenePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: sceneUniformBuffer,
          },
        },
      ],
    });

    const postPipeline = gpu.device.createRenderPipeline({
      label: "lesson-15-post-pass",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({
          code: postVertexShaderSource,
        }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({
          code: postFragmentShaderSource,
        }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    /**
     * createSampler
     * 创建一块采样器，让第二遍全屏 pass 可以按 UV 去读取第一遍离屏纹理。
     * @param {GPUSamplerDescriptor} descriptor 采样器描述对象，这里使用线性过滤和平铺外的 clamp。
     * @returns {GPUSampler} 可绑定到 post-process shader 的采样器对象。
     */
    const sceneTextureSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    /**
     * 根据当前画布尺寸创建或重建离屏颜色纹理、深度纹理和 post-pass 绑定组。
     * @returns {GPUBindGroup} 当前帧 post pass 要使用的 bind group。
     */
    const ensureRenderTargets = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        renderTargets.postBindGroup &&
        renderTargets.width === width &&
        renderTargets.height === height
      ) {
        return renderTargets.postBindGroup;
      }

      destroyGpuTexture(renderTargets.sceneTexture);
      destroyGpuTexture(renderTargets.depthTexture);

      renderTargets.width = width;
      renderTargets.height = height;

      /**
       * createTexture
       * 第一遍场景 pass 不再直接画到屏幕，而是先画到一张离屏颜色纹理。
       * @param {GPUTextureDescriptor} descriptor 纹理描述对象，这里会同时声明它能做渲染目标，也能在第二遍 shader 里被采样。
       * @returns {GPUTexture} 当前帧场景颜色真正写入的离屏纹理对象。
       */
      renderTargets.sceneTexture = gpu.device.createTexture({
        size: [width, height],
        format: gpu.format,
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.TEXTURE_BINDING,
      });
      renderTargets.sceneTextureView = renderTargets.sceneTexture.createView();

      renderTargets.depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      renderTargets.depthTextureView = renderTargets.depthTexture.createView();

      renderTargets.postBindGroup = gpu.device.createBindGroup({
        layout: postPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: sceneTextureSampler,
          },
          {
            binding: 1,
            resource: renderTargets.sceneTextureView,
          },
        ],
      });

      return renderTargets.postBindGroup;
    };

    const eye: Vector3 = [3.9, 2.6, 5.6];
    const target: Vector3 = [0, 0, 0];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
    });
    const lightDirection = normalizeVector([0.58, 0.95, 0.42]);

    const render = (elapsed: number) => {
      syncViewport();
      gpu.resize();

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        (60 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const rotationXMatrix = createRotationXMatrix(-0.35);
      const rotationYMatrix = createRotationYMatrix(elapsed * 0.85);
      const modelMatrix = multiplyMatrices(rotationYMatrix, rotationXMatrix);
      const modelViewProjectionMatrix = multiplyMatrices(
        multiplyMatrices(projectionMatrix, viewMatrix),
        modelMatrix
      );
      const sceneUniformData = createSceneUniformData(
        modelViewProjectionMatrix,
        modelMatrix,
        lightDirection
      );
      const postBindGroup = ensureRenderTargets();

      gpu.device.queue.writeBuffer(sceneUniformBuffer, 0, sceneUniformData);

      const commandEncoder = gpu.device.createCommandEncoder();

      /**
       * beginRenderPass
       * 第一遍先把真实 3D 场景写进离屏纹理，这时目标不是当前屏幕，而是 sceneTextureView。
       * @param {GPURenderPassDescriptor} descriptor 渲染通道描述对象，这里定义离屏颜色附件和深度附件。
       * @returns {GPURenderPassEncoder} 当前第一遍场景绘制使用的渲染通道编码器。
       */
      const scenePass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: renderTargets.sceneTextureView!,
            clearValue: { r: 0.031, g: 0.054, b: 0.112, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: renderTargets.depthTextureView!,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      scenePass.setPipeline(scenePipeline);
      scenePass.setBindGroup(0, sceneBindGroup);
      scenePass.setVertexBuffer(0, vertexBuffer);
      scenePass.setIndexBuffer(indexBuffer, "uint16");
      scenePass.drawIndexed(cube.indexCount);
      scenePass.end();

      /**
       * beginRenderPass
       * 第二遍是一个标准的全屏 pass，这次直接画到当前屏幕，并采样第一遍的 sceneTexture。
       * @param {GPURenderPassDescriptor} descriptor 渲染通道描述对象，这里把屏幕当前纹理当作最终输出目标。
       * @returns {GPURenderPassEncoder} 当前第二遍后处理使用的渲染通道编码器。
       */
      const postPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.043, g: 0.074, b: 0.141, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      postPass.setPipeline(postPipeline);
      postPass.setBindGroup(0, postBindGroup);
      /**
       * draw
       * 全屏 pass 通常只需要 1 个 full-screen triangle，所以这里只画 3 个顶点。
       * @param {number} vertexCount 要生成的顶点数量，这里用 3 个顶点覆盖整个屏幕。
       * @returns {void} 只负责提交全屏后处理绘制，不返回额外结果。
       */
      postPass.draw(3);
      postPass.end();

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
      syncViewport();
    });

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "后处理已运行",
      detail:
        "现在左半边是第一遍场景原图，右半边是第二遍全屏 pass 处理后的结果，这一课重点就是离屏纹理、fullscreen pass 和两段 render pass。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      window.cancelAnimationFrame(animationFrameId);
      destroyGpuTexture(renderTargets.sceneTexture);
      destroyGpuTexture(renderTargets.depthTexture);
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

    destroyGpuTexture(renderTargets.sceneTexture);
    destroyGpuTexture(renderTargets.depthTexture);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
