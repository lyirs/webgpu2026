import { createWebGpuCanvas } from "@/core/webgpu";
import fragmentShaderSource from "@/lessons/lesson-07-lighting/cube.frag.wgsl?raw";
import { createLitCubeGeometry } from "@/lessons/lesson-07-lighting/cube-data";
import vertexShaderSource from "@/lessons/lesson-07-lighting/cube.vert.wgsl?raw";
import {
  createModelViewProjectionMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  multiplyMatrices,
} from "@/lessons/lesson-04-cube-depth/math";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
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
 * 把两张 4x4 矩阵按顺序写进一个连续的 uniform 数组。
 * @param {Float32Array} modelViewProjectionMatrix 当前帧的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前帧的模型矩阵。
 * @returns {Float32Array} 适合直接写入 uniform buffer 的 32 个 float。
 */
function createLightingUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array
): Float32Array {
  const uniformData = new Float32Array(32);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  return uniformData;
}

/**
 * 挂载第 07 课“光照与法线”预览，并完成法线插值与基础方向光计算。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountLightingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Lighting lesson preview"></canvas>
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
  let depthTextureWidth = 0;
  let depthTextureHeight = 0;

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

    syncViewport();
    gpu.resize();

    const cube = createLitCubeGeometry();

    // 这次每个顶点是 [position.xyz, color.rgb, normal.xyz]，所以 stride 会变成 9 个 float。
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

    // 这一课把两张 mat4 连着写进同一个 uniform buffer：前 16 个 float 是 MVP，后 16 个 float 是 model。
    const uniformBuffer = gpu.device.createBuffer({
      size: 16 * 4 * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const vertexShaderModule = gpu.device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-07-lighting",
      layout: "auto",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 9 * 4,
            attributes: [
              {
                // shaderLocation = 0：把 position 接到顶点着色器里的 @location(0)。
                shaderLocation: 0,
                // offset = 0：position 从每个顶点的第 0 个 float 开始读取。
                offset: 0,
                // format = "float32x3"：这里存的是 xyz 三个 32 位浮点数，对应 vec3f position。
                format: "float32x3",
              },
              {
                // shaderLocation = 1：把 color 接到顶点着色器里的 @location(1)。
                shaderLocation: 1,
                // offset = 12：跳过前面的 position.xyz，也就是 3 * 4 字节。
                offset: 3 * 4,
                // format = "float32x3"：这里存的是 rgb 三个 32 位浮点数，对应 vec3f color。
                format: "float32x3",
              },
              {
                // shaderLocation = 2：把法线接到顶点着色器里的 @location(2)。
                shaderLocation: 2,
                // offset = 24：再跳过 color.rgb，也就是一共 6 * 4 字节后开始读 normal。
                offset: 6 * 4,
                // format = "float32x3"：这里存的是 nx、ny、nz 三个 32 位浮点数，对应 vec3f normal。
                format: "float32x3",
              },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentShaderModule,
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

    // group(0) 里这次只放矩阵 uniform，让第 7 课只聚焦光照本身。
    const bindGroup = gpu.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
    });

    const ensureDepthTexture = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        depthTexture &&
        depthTextureWidth === width &&
        depthTextureHeight === height
      ) {
        return depthTexture;
      }

      depthTexture?.destroy();
      depthTextureWidth = width;
      depthTextureHeight = height;

      depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      return depthTexture;
    };

    const render = () => {
      const currentDepthTexture = ensureDepthTexture();
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
          view: currentDepthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      pass.drawIndexed(cube.indexCount);
      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    const startTime = performance.now();
    let animationFrameId = 0;

    /**
     * requestAnimationFrame
     * @param {(time: DOMHighResTimeStamp) => void} callback 浏览器在下一帧绘制前回调的函数，并传入高精度时间戳。
     * @returns {number} 当前动画帧请求的编号，可在清理阶段传给 cancelAnimationFrame。
     */
    const frame = (time: number) => {
      gpu.resize();
      const elapsed = (time - startTime) * 0.001;
      const aspect = canvas.width / canvas.height;
      const rotationXMatrix = createRotationXMatrix(elapsed * 0.7);
      const rotationYMatrix = createRotationYMatrix(elapsed * 1.1);
      const modelMatrix = multiplyMatrices(rotationYMatrix, rotationXMatrix);
      const modelViewProjectionMatrix = createModelViewProjectionMatrix(
        aspect,
        elapsed
      );
      const uniformData = createLightingUniformData(
        modelViewProjectionMatrix,
        modelMatrix
      );

      gpu.device.queue.writeBuffer(uniformBuffer, 0, uniformData);
      render();
      animationFrameId = window.requestAnimationFrame(frame);
    };

    /**
     * ResizeObserver
     * @param {ResizeObserverCallback} callback 当观察目标尺寸变化时触发的回调函数；这里会同步 16:9 画幅并依赖下一帧重绘。
     * @returns {ResizeObserver} 用于监听预览区域尺寸变化的观察器实例。
     */
    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
    });

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "光照立方体已运行",
      detail: "法线、模型矩阵和方向光已经接上，立方体表面会随朝向产生明暗变化。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      destroyGpuTexture(depthTexture);
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

    destroyGpuTexture(depthTexture);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
