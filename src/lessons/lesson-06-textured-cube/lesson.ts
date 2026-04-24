import textureUrl from "@/assets/capoo-static-380.gif";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createTexturedCubeGeometry } from "@/lessons/lesson-06-textured-cube/cube-data";
import fragmentShaderSource from "@/lessons/lesson-06-textured-cube/cube.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-06-textured-cube/cube.vert.wgsl?raw";
import { createModelViewProjectionMatrix } from "@/lessons/lesson-04-cube-depth/math";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

/**
 * 把图片资源加载成可直接上传到 GPU 的静态位图。
 * @param {string} url 项目内贴图资源地址。
 * @returns {Promise<ImageBitmap>} 可被 `copyExternalImageToTexture()` 读取的位图对象。
 * @throws {Error} 当图片请求失败或位图创建失败时抛出异常。
 */
async function loadTextureBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("贴图资源加载失败。");
  }

  const blob = await response.blob();

  /**
   * createImageBitmap
   * @param {ImageBitmapSource} image 图片源；这里直接使用 fetch 回来的 Blob。
   * @returns {Promise<ImageBitmap>} 可被 WebGPU 直接读取的一张静态位图。
   */
  return createImageBitmap(blob);
}

/**
 * 安全释放一张 GPUTexture。
 * @param {GPUTexture | null} resource 要释放的 GPU 纹理对象。
 * @returns {void} 只负责销毁纹理，不返回额外结果。
 */
function destroyGpuTexture(resource: GPUTexture | null): void {
  resource?.destroy();
}

/**
 * 安全关闭一个 ImageBitmap。
 * @param {ImageBitmap | null} bitmap 要关闭的位图对象。
 * @returns {void} 只负责关闭位图，不返回额外结果。
 */
function closeBitmap(bitmap: ImageBitmap | null): void {
  bitmap?.close();
}

/**
 * 挂载第 06 课“贴图立方体”预览，并完成纹理、MVP 矩阵、深度测试和分离着色器的最小串联。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountTexturedCubeLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Textured Cube preview"></canvas>
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

  let textureBitmap: ImageBitmap | null = null;
  let texture: GPUTexture | null = null;
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

    const cube = createTexturedCubeGeometry();
    textureBitmap = await loadTextureBitmap(textureUrl);

    // 这次每个顶点是 [position.xyz, color.rgb, uv.xy]，所以 stride 会扩成 8 个 float。
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

    const uniformBuffer = gpu.device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    texture = gpu.device.createTexture({
      size: [textureBitmap.width, textureBitmap.height],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    /**
     * queue.copyExternalImageToTexture
     * 把浏览器里的静态图片像素复制进 GPUTexture，完成从外部图片到 GPU 纹理的上传。
     * @param {GPUCopyExternalImageSourceInfo} source 外部图片源；这里直接使用静态位图 textureBitmap。
     * @param {GPUCopyExternalImageDestInfo} destination 目标纹理描述；这里把图片复制到新建的 GPUTexture。
     * @param {GPUExtent3DStrict} copySize 要复制的宽高尺寸；这里等于图片本身的像素尺寸。
     * @returns {void} 只负责把图片像素写进 GPUTexture，不返回额外结果。
     */
    gpu.device.queue.copyExternalImageToTexture(
      { source: textureBitmap },
      { texture },
      [textureBitmap.width, textureBitmap.height]
    );

    const sampler = gpu.device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });

    const vertexShaderModule = gpu.device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-06-textured-cube",
      layout: "auto",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 8 * 4,
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
                // @location(2)：把每个顶点自带的 uv 坐标送进顶点着色器。
                shaderLocation: 2,
                // offset = 24：再跳过 color.rgb，也就是一共 6 * 4 字节后开始读 uv。
                offset: 6 * 4,
                // format = "float32x2"：这里存的是 u、v 两个 32 位浮点数，对应 vec2f uv。
                format: "float32x2",
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

    const bindGroupLayout = pipeline.getBindGroupLayout(0);
    const textureView = texture.createView();
    // group(0) 里这次一口气放进 3 类资源：矩阵 uniform、采样器、纹理视图。
    const bindGroup = gpu.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
        {
          binding: 1,
          resource: sampler,
        },
        {
          binding: 2,
          resource: textureView,
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
      const modelViewProjectionMatrix = createModelViewProjectionMatrix(
        aspect,
        elapsed
      );
      gpu.device.queue.writeBuffer(uniformBuffer, 0, modelViewProjectionMatrix);

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
      title: "贴图立方体已运行",
      detail:
        "Capoo 贴图已经贴到带顶点颜色的立方体上，并且这次把 vertex / fragment shader 分成了两个文件。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      destroyGpuTexture(depthTexture);
      destroyGpuTexture(texture);
      closeBitmap(textureBitmap);
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
    destroyGpuTexture(texture);
    closeBitmap(textureBitmap);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
