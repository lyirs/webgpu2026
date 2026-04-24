import { createWebGpuCanvas } from "@/core/webgpu";
import { createCubeGeometry } from "@/lessons/lesson-04-cube-depth/cube-data";
import { createModelViewProjectionMatrix } from "@/lessons/lesson-04-cube-depth/math";
import shaderSource from "@/lessons/lesson-04-cube-depth/cube.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

/**
 * 挂载第 04 课“立方体与深度”预览，并完成索引缓冲、MVP uniform 和深度测试的最小串联。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和深度纹理；如果挂载失败，则返回空结果。
 */
export async function mountCubeDepthLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Cube Depth preview"></canvas>
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

    /**
     * ResizeObserver
     * @param {ResizeObserverCallback} callback 当观察目标尺寸变化时触发的回调函数；这里会同步 16:9 画幅。
     * @returns {ResizeObserver} 用于监听预览区域尺寸变化的观察器实例。
     */
    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
    });

    resizeObserver.observe(host);

    const cube = createCubeGeometry();

    /**
     * createBuffer
     * @param {GPUBufferDescriptor} descriptor GPUBuffer 描述对象，这里指定顶点缓冲区大小和用途。
     * @returns {GPUBuffer} 用来存放立方体顶点位置和颜色的 GPUBuffer。
     */
    const vertexBuffer = gpu.device.createBuffer({
      size: cube.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    /**
     * queue.writeBuffer
     * @param {GPUBuffer} buffer 要写入的目标 GPUBuffer。
     * @param {number} bufferOffset 写入起始偏移，这里从 0 开始。
     * @param {AllowSharedBufferSource} data 要拷贝进去的源数据，这里是立方体的 vertexData。
     * @returns {void} 只负责把 CPU 侧顶点数组上传进 GPUBuffer，不返回额外结果。
     */
    gpu.device.queue.writeBuffer(vertexBuffer, 0, cube.vertexData);

    /**
     * createBuffer
     * @param {GPUBufferDescriptor} descriptor GPUBuffer 描述对象，这里指定索引缓冲区大小和用途。
     * @returns {GPUBuffer} 用来存放立方体索引数据的 GPUBuffer。
     */
    const indexBuffer = gpu.device.createBuffer({
      size: cube.indexData.byteLength,
      // GPUBufferUsage.INDEX：表示这块 buffer 后续会被解释成顶点索引序列。
      // GPUBufferUsage.COPY_DST：表示 CPU 这边可以通过 queue.writeBuffer 把索引写进去。
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    /**
     * queue.writeBuffer
     * @param {GPUBuffer} buffer 要写入的目标 GPUBuffer。
     * @param {number} bufferOffset 写入起始偏移，这里从 0 开始。
     * @param {AllowSharedBufferSource} data 要拷贝进去的源数据，这里是立方体的 indexData。
     * @returns {void} 只负责把 CPU 侧索引数组上传进 GPUBuffer，不返回额外结果。
     */
    gpu.device.queue.writeBuffer(indexBuffer, 0, cube.indexData);

    /**
     * createBuffer
     * @param {GPUBufferDescriptor} descriptor GPUBuffer 描述对象，这里把 64 字节空间声明成 UNIFORM + COPY_DST。
     * @returns {GPUBuffer} 用来给 shader 提供 `mat4x4f` MVP 矩阵的 uniform buffer。
     */
    const uniformBuffer = gpu.device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    /**
     * createShaderModule
     * @param {GPUShaderModuleDescriptor} descriptor shader 模块描述对象；这里把 `shaderSource` 作为 WGSL 源码传入。
     * @returns {GPUShaderModule} 后续可被顶点阶段和片元阶段复用的 shader 模块。
     */
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });

    /**
     * createRenderPipeline
     * @param {GPURenderPipelineDescriptor} descriptor 渲染管线描述对象，里面包含 vertex、fragment、primitive 和 depthStencil 等阶段配置。
     * @returns {GPURenderPipeline} 把 vertex buffer、index buffer、MVP uniform 和深度测试规则组合起来的完整渲染管线。
     */
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-04-cube-depth",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              {
                // shaderLocation = 0：把 position 接到 shader 里的 @location(0)。
                shaderLocation: 0,
                // offset = 0：position 从每个顶点的第 0 个 float 开始读取。
                offset: 0,
                // format = "float32x3"：这里存的是 xyz 三个 32 位浮点数，对应 vec3f position。
                format: "float32x3",
              },
              {
                // shaderLocation = 1：把 color 接到 shader 里的 @location(1)。
                shaderLocation: 1,
                // offset = 12：跳过前面的 xyz，也就是 3 * 4 字节之后开始读颜色。
                offset: 3 * 4,
                // format = "float32x3"：这里存的是 rgb 三个 32 位浮点数，对应 vec3f color。
                format: "float32x3",
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        // depthWriteEnabled = true：通过深度测试的片元会把自己的 z 值写回深度附件。
        depthWriteEnabled: true,
        // depthCompare = "less"：只有更靠近相机的片元才能覆盖更远的片元。
        depthCompare: "less",
        // depth24plus：这是最常见的深度纹理格式之一，适合当前这类入门课程。
        format: "depth24plus",
      },
    });

    /**
     * getBindGroupLayout
     * @param {number} index 要读取的绑定组布局索引；这里传入 0，表示 shader 里的第 0 组资源。
     * @returns {GPUBindGroupLayout} 当前管线在指定组号上推导出来的绑定布局。
     */
    const bindGroupLayout = pipeline.getBindGroupLayout(0);

    /**
     * createBindGroup
     * @param {GPUBindGroupDescriptor} descriptor 绑定组描述对象；这里把 MVP uniform buffer 填到 shader 的 group(0)/binding(0)。
     * @returns {GPUBindGroup} 可在渲染 pass 中直接绑定给 shader 使用的资源分组对象。
     */
    const bindGroup = gpu.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
    });

    let depthTexture: GPUTexture | null = null;
    let depthTextureWidth = 0;
    let depthTextureHeight = 0;

    /**
     * createTexture
     * @returns {GPUTexture} 与当前画布像素尺寸匹配的深度纹理。
     */
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

    /**
     * 录制并提交一次立方体绘制命令。
     * @returns {void} 只负责触发当前帧的渲染，不返回额外结果。
     */
    const render = () => {
      const currentDepthTexture = ensureDepthTexture();

      /**
       * createCommandEncoder
       * @param {GPUCommandEncoderDescriptor | undefined} [descriptor] 可选的命令编码器描述对象；这里直接使用默认配置。
       * @returns {GPUCommandEncoder} 用于录制当前帧 GPU 命令的编码器实例。
       */
      const commandEncoder = gpu.device.createCommandEncoder();
      /**
       * beginRenderPass
       * @param {GPURenderPassDescriptor} descriptor 渲染通道描述对象，这里除了颜色附件，还定义了深度附件。
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
        depthStencilAttachment: {
          view: currentDepthTexture.createView(),
          // depthClearValue = 1：开始当前 pass 之前，先把深度附件清成最远值。
          depthClearValue: 1,
          // depthLoadOp = "clear"：进入 pass 时先清空上一帧的深度结果，避免旧数据污染当前帧。
          depthLoadOp: "clear",
          // depthStoreOp = "store"：pass 结束后保留这帧写出的深度值。
          depthStoreOp: "store",
        },
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
       * @param {GPUBindGroup} bindGroup 要绑定的资源组对象；这里把 MVP uniform buffer 送进 shader。
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
       * setIndexBuffer
       * @param {GPUBuffer} buffer 要绑定的索引缓冲对象。
       * @param {GPUIndexFormat} indexFormat 索引数据的格式；这里用 `uint16` 对应 Uint16Array。
       * @returns {void} 只把 index buffer 绑定到当前 pass，不返回额外结果。
       */
      pass.setIndexBuffer(indexBuffer, "uint16");
      /**
       * drawIndexed
       * @param {number} indexCount 这次 draw 要读取的索引数量；立方体一共 12 个三角形，所以是 36。
       * @returns {void} 只把 drawIndexed 指令写入当前渲染通道，不返回额外结果。
       */
      pass.drawIndexed(cube.indexCount);
      pass.end();

      /**
       * queue.submit
       * @param {GPUCommandBuffer[]} commandBuffers 一组已经调用 `finish()` 的命令缓冲区。
       * @returns {void} 只负责把编码完成的命令正式提交给 GPU 队列执行。
       */
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

      /**
       * queue.writeBuffer
       * @param {GPUBuffer} buffer 要写入的目标 GPUBuffer；这里是 uniformBuffer。
       * @param {number} bufferOffset 写入起始偏移，这里从 0 开始。
       * @param {AllowSharedBufferSource} data 要拷贝进去的源数据，这里是当前帧的 MVP 矩阵。
       * @returns {void} 只负责把最新的矩阵数据上传进 GPU，不返回额外结果。
       */
      gpu.device.queue.writeBuffer(uniformBuffer, 0, modelViewProjectionMatrix);

      render();
      animationFrameId = window.requestAnimationFrame(frame);
    };

    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "立方体已运行",
      detail:
        "index buffer、MVP uniform 和 depth texture 都已经接上，立方体会持续旋转。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      depthTexture?.destroy();
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

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
