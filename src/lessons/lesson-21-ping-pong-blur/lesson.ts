import { createWebGpuCanvas } from "@/core/webgpu";
import { createOrbitCameraController } from "@/core/orbit-camera";
import { createPingPongCubeGeometry } from "@/lessons/lesson-21-ping-pong-blur/cube-data";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-21-ping-pong-blur/math";
import blurFragmentShaderSource from "@/lessons/lesson-21-ping-pong-blur/blur.frag.wgsl?raw";
import fullscreenVertexShaderSource from "@/lessons/lesson-21-ping-pong-blur/fullscreen.vert.wgsl?raw";
import presentFragmentShaderSource from "@/lessons/lesson-21-ping-pong-blur/present.frag.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-21-ping-pong-blur/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-21-ping-pong-blur/scene.vert.wgsl?raw";

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
  blurTextureA: GPUTexture | null;
  blurTextureAView: GPUTextureView | null;
  blurTextureB: GPUTexture | null;
  blurTextureBView: GPUTextureView | null;
  sceneHorizontalBindGroup: GPUBindGroup | null;
  blurAVerticalBindGroup: GPUBindGroup | null;
  blurBHorizontalBindGroup: GPUBindGroup | null;
  presentBindGroup: GPUBindGroup | null;
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
 * 把场景 pass 需要的 MVP 矩阵、模型矩阵和主光方向打包成一份 uniform 数据。
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
 * 生成一份 blur pass 使用的方向参数。
 * @param {number} texelOffsetX 水平方向的单像素 UV 偏移。
 * @param {number} texelOffsetY 垂直方向的单像素 UV 偏移。
 * @returns {Float32Array} 适合直接写进 uniform buffer 的方向数据。
 */
function createBlurDirectionData(
  texelOffsetX: number,
  texelOffsetY: number
): Float32Array {
  return new Float32Array([texelOffsetX, texelOffsetY, 0, 0]);
}

/**
 * 挂载第 16 课“多 pass blur”预览，并演示 ping-pong render target 的基础写法。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountPingPongBlurLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Ping-pong blur lesson preview"></canvas>
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
    blurTextureA: null,
    blurTextureAView: null,
    blurTextureB: null,
    blurTextureBView: null,
    sceneHorizontalBindGroup: null,
    blurAVerticalBindGroup: null,
    blurBHorizontalBindGroup: null,
    presentBindGroup: null,
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

    const cube = createPingPongCubeGeometry();

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
    const horizontalBlurBuffer = gpu.device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const verticalBlurBuffer = gpu.device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-16-scene-pass",
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

    const blurPipeline = gpu.device.createRenderPipeline({
      label: "lesson-16-blur-pass",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({
          code: fullscreenVertexShaderSource,
        }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({
          code: blurFragmentShaderSource,
        }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-16-present-pass",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({
          code: fullscreenVertexShaderSource,
        }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({
          code: presentFragmentShaderSource,
        }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const blurSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    /**
     * 根据当前画布尺寸创建或重建场景纹理、两张 blur 纹理和各自的 bind group。
     * @returns {GPUBindGroup} 最终 present pass 使用的 bind group。
     */
    const ensureRenderTargets = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        renderTargets.presentBindGroup &&
        renderTargets.width === width &&
        renderTargets.height === height
      ) {
        return renderTargets.presentBindGroup;
      }

      destroyGpuTexture(renderTargets.sceneTexture);
      destroyGpuTexture(renderTargets.depthTexture);
      destroyGpuTexture(renderTargets.blurTextureA);
      destroyGpuTexture(renderTargets.blurTextureB);

      renderTargets.width = width;
      renderTargets.height = height;

      // 这一课第一次需要两张中间 blur 纹理交替读写。
      // 当前 pass 写 A，就从 B 读；下一次再反过来，这就是 ping-pong。
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

      renderTargets.blurTextureA = gpu.device.createTexture({
        size: [width, height],
        format: gpu.format,
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.TEXTURE_BINDING,
      });
      renderTargets.blurTextureAView = renderTargets.blurTextureA.createView();

      renderTargets.blurTextureB = gpu.device.createTexture({
        size: [width, height],
        format: gpu.format,
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT |
          GPUTextureUsage.TEXTURE_BINDING,
      });
      renderTargets.blurTextureBView = renderTargets.blurTextureB.createView();

      gpu.device.queue.writeBuffer(
        horizontalBlurBuffer,
        0,
        createBlurDirectionData(1 / width, 0)
      );
      gpu.device.queue.writeBuffer(
        verticalBlurBuffer,
        0,
        createBlurDirectionData(0, 1 / height)
      );

      renderTargets.sceneHorizontalBindGroup = gpu.device.createBindGroup({
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: blurSampler,
          },
          {
            binding: 1,
            resource: renderTargets.sceneTextureView,
          },
          {
            binding: 2,
            resource: {
              buffer: horizontalBlurBuffer,
            },
          },
        ],
      });

      renderTargets.blurAVerticalBindGroup = gpu.device.createBindGroup({
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: blurSampler,
          },
          {
            binding: 1,
            resource: renderTargets.blurTextureAView,
          },
          {
            binding: 2,
            resource: {
              buffer: verticalBlurBuffer,
            },
          },
        ],
      });

      renderTargets.blurBHorizontalBindGroup = gpu.device.createBindGroup({
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: blurSampler,
          },
          {
            binding: 1,
            resource: renderTargets.blurTextureBView,
          },
          {
            binding: 2,
            resource: {
              buffer: horizontalBlurBuffer,
            },
          },
        ],
      });

      renderTargets.presentBindGroup = gpu.device.createBindGroup({
        layout: presentPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: blurSampler,
          },
          {
            binding: 1,
            resource: renderTargets.sceneTextureView,
          },
          {
            binding: 2,
            resource: renderTargets.blurTextureBView,
          },
        ],
      });

      return renderTargets.presentBindGroup;
    };

    const eye: Vector3 = [3.9, 2.6, 5.6];
    const target: Vector3 = [0, 0, 0];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
    });
    const lightDirection = normalizeVector([0.58, 0.95, 0.42]);

    const renderFullscreenPass = (
      commandEncoder: GPUCommandEncoder,
      targetView: GPUTextureView,
      pipeline: GPURenderPipeline,
      bindGroup: GPUBindGroup,
      clearColor: GPUColor
    ) => {
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: targetView,
            clearValue: clearColor,
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
    };

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
      const presentBindGroup = ensureRenderTargets();

      gpu.device.queue.writeBuffer(sceneUniformBuffer, 0, sceneUniformData);

      const commandEncoder = gpu.device.createCommandEncoder();

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

      // 先水平，再垂直；接着再来一轮，这样能更明显地看出 ping-pong blur 的效果。
      renderFullscreenPass(
        commandEncoder,
        renderTargets.blurTextureAView!,
        blurPipeline,
        renderTargets.sceneHorizontalBindGroup!,
        { r: 0, g: 0, b: 0, a: 1 }
      );
      renderFullscreenPass(
        commandEncoder,
        renderTargets.blurTextureBView!,
        blurPipeline,
        renderTargets.blurAVerticalBindGroup!,
        { r: 0, g: 0, b: 0, a: 1 }
      );
      renderFullscreenPass(
        commandEncoder,
        renderTargets.blurTextureAView!,
        blurPipeline,
        renderTargets.blurBHorizontalBindGroup!,
        { r: 0, g: 0, b: 0, a: 1 }
      );
      renderFullscreenPass(
        commandEncoder,
        renderTargets.blurTextureBView!,
        blurPipeline,
        renderTargets.blurAVerticalBindGroup!,
        { r: 0, g: 0, b: 0, a: 1 }
      );

      renderFullscreenPass(
        commandEncoder,
        gpu.context.getCurrentTexture().createView(),
        presentPipeline,
        presentBindGroup,
        { r: 0.043, g: 0.074, b: 0.141, a: 1 }
      );

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
      title: "Ping-pong blur 已运行",
      detail:
        "这一课先把立方体画进离屏纹理，再让两张 blur 纹理交替读写；左半边保留原图，右半边展示多 pass blur 的结果。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      window.cancelAnimationFrame(animationFrameId);
      destroyGpuTexture(renderTargets.sceneTexture);
      destroyGpuTexture(renderTargets.depthTexture);
      destroyGpuTexture(renderTargets.blurTextureA);
      destroyGpuTexture(renderTargets.blurTextureB);
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
    destroyGpuTexture(renderTargets.blurTextureA);
    destroyGpuTexture(renderTargets.blurTextureB);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
