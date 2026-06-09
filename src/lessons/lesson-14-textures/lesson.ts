import textureUrl from "@/assets/capoo-static-380.gif";
import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-14-textures/texture.wgsl?raw";

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
 * 根据贴图比例和当前视口比例，生成保持原图宽高比的 quad 顶点数据。
 * @param {number} viewportAspect 当前 canvas 的宽高比。
 * @param {number} imageAspect 贴图本身的宽高比。
 * @returns {Float32Array} 按 [x, y, u, v] 交错排布的两个三角形顶点数据。
 */
function createQuadVertexData(
  viewportAspect: number,
  imageAspect: number
): Float32Array {
  const aspectInClipSpace = imageAspect / viewportAspect;
  let halfWidth = 0.78;
  let halfHeight = 0.78;

  if (aspectInClipSpace >= 1) {
    halfHeight = halfWidth / aspectInClipSpace;
  } else {
    halfWidth = halfHeight * aspectInClipSpace;
  }

  const left = -halfWidth;
  const right = halfWidth;
  const top = halfHeight;
  const bottom = -halfHeight;

  return new Float32Array([
    left, top, 0, 0,
    left, bottom, 0, 1,
    right, top, 1, 0,
    right, top, 1, 0,
    left, bottom, 0, 1,
    right, bottom, 1, 1,
  ]);
}

/**
 * 挂载第 05 课“纹理与采样器”预览，并完成图片上传、采样器绑定和片元采样的最小串联。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听和 GPU 纹理；如果挂载失败，则返回空结果。
 */
export async function mountTextureLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Texture lesson preview"></canvas>
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

    textureBitmap = await loadTextureBitmap(textureUrl);

    /**
     * createBuffer
     * @param {GPUBufferDescriptor} descriptor GPUBuffer 描述对象，这里指定顶点缓冲区大小和用途。
     * @returns {GPUBuffer} 用来存放 quad 位置和 UV 数据的 GPUBuffer。
     */
    const vertexBuffer = gpu.device.createBuffer({
      size: 6 * 4 * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    /**
     * createTexture
     * @param {GPUTextureDescriptor} descriptor 纹理描述对象，这里指定贴图尺寸、格式与用途。
     * @returns {GPUTexture} 可在 shader 中被采样读取的 GPU 纹理对象。
     */
    texture = gpu.device.createTexture({
      size: [textureBitmap.width, textureBitmap.height],
      format: "rgba8unorm",
      // copyExternalImageToTexture：目标纹理除了 COPY_DST 之外，
      // 在当前这套浏览器 / Dawn 实现里还需要具备 RENDER_ATTACHMENT 用途。
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

    /**
     * createSampler
     * @param {GPUSamplerDescriptor} descriptor 采样器描述对象，这里定义边界处理和放大/缩小时的采样规则。
     * @returns {GPUSampler} 片元着色器通过 `textureSample()` 读取纹理时要用到的采样器对象。
     */
    const sampler = gpu.device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      // magFilter / minFilter：放大和缩小时都使用线性插值，让贴图边缘更平滑。
      magFilter: "linear",
      minFilter: "linear",
    });

    /**
     * createShaderModule
     * @param {GPUShaderModuleDescriptor} descriptor shader 模块描述对象；这里把 `shaderSource` 作为 WGSL 源码传入。
     * @returns {GPUShaderModule} 后续可被顶点阶段和片元阶段复用的 shader 模块。
     */
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });

    /**
     * createRenderPipeline
     * @param {GPURenderPipelineDescriptor} descriptor 渲染管线描述对象，里面包含 vertex、fragment 和 primitive 等阶段配置。
     * @returns {GPURenderPipeline} 把 quad 顶点布局、纹理采样绑定和片元着色规则组合起来的完整渲染管线。
     */
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-14-textures",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 4 * 4,
            attributes: [
              {
                // shaderLocation = 0：把位置数据接到 shader 里的 @location(0)。
                shaderLocation: 0,
                // offset = 0：position 从每个顶点的第 0 个 float 开始读取。
                offset: 0,
                // format = "float32x2"：这里存的是 x、y 两个 32 位浮点数，对应 vec2f position。
                format: "float32x2",
              },
              {
                // shaderLocation = 1：把 UV 数据接到 shader 里的 @location(1)。
                shaderLocation: 1,
                // offset = 8：跳过前面的 position.xy，也就是 2 * 4 字节。
                offset: 2 * 4,
                // format = "float32x2"：这里存的是 u、v 两个 32 位浮点数，对应 vec2f uv。
                format: "float32x2",
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [
          {
            format: gpu.format,
            blend: {
              // color：用贴图自身的 alpha 把前景颜色混到当前背景色上。
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              // alpha：让结果 alpha 也跟着按同样规则合成，避免透明区域被硬写成纯黑。
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    /**
     * getBindGroupLayout
     * @param {number} index 要读取的绑定组布局索引；这里传入 0，表示 shader 里的第 0 组资源。
     * @returns {GPUBindGroupLayout} 当前管线在指定组号上推导出来的绑定布局。
     */
    const bindGroupLayout = pipeline.getBindGroupLayout(0);
    /**
     * createView
     * @returns {GPUTextureView} 把 GPUTexture 包装成可绑定到 shader 的纹理视图。
     */
    const textureView = texture.createView();
    /**
     * createBindGroup
     * @param {GPUBindGroupDescriptor} descriptor 绑定组描述对象；这里把 sampler 和 texture view 填到 shader 的 group(0)。
     * @returns {GPUBindGroup} 可在渲染 pass 中直接绑定给 shader 使用的资源分组对象。
     */
    const bindGroup = gpu.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: sampler,
        },
        {
          binding: 1,
          resource: textureView,
        },
      ],
    });

    /**
     * 按当前 canvas 比例重写 quad 顶点，让贴图在 16:9 预览区里保持原始宽高比。
     * @returns {void} 只更新顶点缓冲区中的位置和 UV 数据，不返回额外结果。
     */
    const updateQuadVertices = () => {
      const viewportAspect = canvas.width / canvas.height;
      const imageAspect = textureBitmap!.width / textureBitmap!.height;
      const vertexData = createQuadVertexData(viewportAspect, imageAspect);

      /**
       * queue.writeBuffer
       * @param {GPUBuffer} buffer 要写入的目标 GPUBuffer；这里是 quad 顶点缓冲。
       * @param {number} bufferOffset 写入起始偏移，这里从 0 开始。
       * @param {AllowSharedBufferSource} data 要拷贝进去的源数据，这里是位置和 UV 交错排布的顶点数组。
       * @returns {void} 只负责把最新的顶点数据上传进 GPUBuffer，不返回额外结果。
       */
      gpu.device.queue.writeBuffer(vertexBuffer, 0, vertexData);
    };

    /**
     * 录制并提交一次纹理 quad 绘制命令。
     * @returns {void} 只负责触发当前帧的渲染，不返回额外结果。
     */
    const render = () => {
      gpu.resize();
      updateQuadVertices();

      /**
       * createCommandEncoder
       * @param {GPUCommandEncoderDescriptor | undefined} [descriptor] 可选的命令编码器描述对象；这里直接使用默认配置。
       * @returns {GPUCommandEncoder} 用于录制当前帧 GPU 命令的编码器实例。
       */
      const commandEncoder = gpu.device.createCommandEncoder();
      /**
       * beginRenderPass
       * @param {GPURenderPassDescriptor} descriptor 渲染通道描述对象，这里定义颜色附件、清屏颜色以及 load/store 行为。
       * @returns {GPURenderPassEncoder} 当前这次 draw 调用所处的渲染通道编码器。
       */
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.043, g: 0.074, b: 0.141, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      /**
       * setPipeline
       * @param {GPURenderPipeline} pipeline 当前 pass 接下来要使用的渲染管线。
       * @returns {void} 只更新当前 pass 的管线状态，不返回额外结果。
       */
      pass.setPipeline(pipeline);
      /**
       * setBindGroup
       * @param {number} index 要绑定的资源组编号；这里传入 0，对应 WGSL 里的 @group(0)。
       * @param {GPUBindGroup} bindGroup 要绑定的资源组对象；这里把 sampler 和 texture view 送进 shader。
       * @returns {void} 只更新当前 pass 的资源绑定状态，不返回额外结果。
       */
      pass.setBindGroup(0, bindGroup);
      /**
       * setVertexBuffer
       * @param {number} slot 要绑定的顶点缓冲槽位，这里是第 0 号槽位。
       * @param {GPUBuffer} buffer 要绑定的顶点缓冲对象。
       * @returns {void} 只把 vertex buffer 绑定到当前 pass，不返回额外结果。
       */
      pass.setVertexBuffer(0, vertexBuffer);
      /**
       * draw
       * @param {number} vertexCount 要绘制的顶点数量；这里传入 6，用两个三角形拼出一个 quad。
       * @returns {void} 只把 draw 指令写入当前渲染通道，不返回额外结果。
       */
      pass.draw(6);
      pass.end();

      /**
       * queue.submit
       * @param {GPUCommandBuffer[]} commandBuffers 一组已经调用 `finish()` 的命令缓冲区。
       * @returns {void} 只负责把编码完成的命令正式提交给 GPU 队列执行。
       */
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    /**
     * ResizeObserver
     * @param {ResizeObserverCallback} callback 当观察目标尺寸变化时触发的回调函数；这里会同步 16:9 画幅并重绘 quad。
     * @returns {ResizeObserver} 用于监听预览区域尺寸变化的观察器实例。
     */
    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      render();
    });

    resizeObserver.observe(host);
    render();

    setStatus({
      title: "纹理采样已就绪",
      detail:
        "Capoo 贴图已经上传到 GPUTexture，并通过 sampler + textureSample() 画到 quad 上。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      texture?.destroy();
      textureBitmap?.close();
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

    texture?.destroy();
    textureBitmap?.close();

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
