import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-07-vertex-buffers/triangle.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

/**
 * 挂载第 02 课“顶点缓冲”预览，并在容器内完成 vertex buffer 版三角形绘制。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听；如果挂载失败，则返回空结果。
 */
export async function mountVertexBufferLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Vertex Buffer Triangle preview"></canvas>
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
     * @param {ResizeObserverCallback} callback 当观察目标尺寸变化时触发的回调函数；这里会同步 16:9 画幅并重新绘制。
     * @returns {ResizeObserver} 用于监听预览区域尺寸变化的观察器实例。
     */
    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      render();
    });

    resizeObserver.observe(host);

    /**
     * Float32Array
     * @param {ArrayLike<number>} source 一组 32 位浮点数；这里按 [x, y, r, g, b] 的顺序交错存放每个顶点的数据。
     * @returns {Float32Array} 可直接写入 GPUBuffer 的连续浮点数组。
     */
    const vertexData = new Float32Array([
      0.0, 0.72, 1.0, 0.43, 0.29,
      -0.72, -0.58, 0.98, 0.82, 0.28,
      0.72, -0.58, 0.22, 0.69, 0.95,
    ]);

    /**
     * createBuffer
     * @param {GPUBufferDescriptor} descriptor GPUBuffer 描述对象，这里指定缓冲区大小和用途。
     * @returns {GPUBuffer} 用来存放顶点数据的 GPU 缓冲区。
     */
    const vertexBuffer = gpu.device.createBuffer({
      size: vertexData.byteLength,
      // GPUBufferUsage.VERTEX：表示这个 buffer 之后会被当成顶点缓冲来读取。
      // GPUBufferUsage.COPY_DST：表示 CPU 这边后续可以通过 queue.writeBuffer 把数据拷进去。
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    /**
     * queue.writeBuffer
     * @param {GPUBuffer} buffer 要写入的目标 GPUBuffer。
     * @param {number} bufferOffset 写入起始偏移，这里从 0 开始。
     * @param {AllowSharedBufferSource} data 要拷贝进去的源数据，这里直接使用 Float32Array。
     * @returns {void} 只负责把 CPU 侧数组数据上传进 GPUBuffer，不返回额外结果。
     */
    gpu.device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    /**
     * createShaderModule
     * @param {GPUShaderModuleDescriptor} descriptor shader 模块描述对象；这里把 `shaderSource` 作为 WGSL 源码传入。
     * @returns {GPUShaderModule} 后续可被顶点阶段和片元阶段复用的 shader 模块。
     */
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });

    /**
     * createRenderPipeline
     * @param {GPURenderPipelineDescriptor} descriptor 渲染管线描述对象，里面包含 vertex、fragment、primitive 等阶段配置。
     * @returns {GPURenderPipeline} 把 vertex buffer 布局、shader 和图元装配规则组合起来的完整渲染管线。
     */
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-02-vertex-buffer-triangle",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            // arrayStride：相邻两个顶点之间一共跨过多少字节。
            // 这里每个顶点有 5 个 float，所以一共是 5 * 4 = 20 字节。
            arrayStride: 5 * 4,
            attributes: [
              {
                // shaderLocation = 0：把这段数据接到 shader 里 @location(0) 的输入上。
                shaderLocation: 0,
                // offset = 0：position 从每个顶点的第 0 个 float 开始读取。
                offset: 0,
                // format = "float32x2"：position 由两个 float 组成，对应 vec2f。
                format: "float32x2",
              },
              {
                // shaderLocation = 1：把颜色数据接到 shader 里 @location(1) 的输入上。
                shaderLocation: 1,
                // offset = 8：跳过前面 position 的两个 float，也就是 2 * 4 字节。
                offset: 2 * 4,
                // format = "float32x3"：颜色由三个 float 组成，对应 vec3f。
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
        // topology = "triangle-list"：每 3 个顶点会被当成一个独立三角形。
        // 这课仍然 draw(3)，所以 GPU 会把 vertex buffer 里的 3 个顶点解释成 1 个三角形。
        topology: "triangle-list",
      },
    });

    /**
     * 录制并提交一次 vertex buffer 版三角形绘制命令。
     * @returns {void} 只负责触发当前帧的渲染，不返回额外结果。
     */
    const render = () => {
      gpu.resize();

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
       * setVertexBuffer
       * @param {number} slot 要绑定的顶点缓冲槽位，这里是第 0 号槽位。
       * @param {GPUBuffer} buffer 要绑定的顶点缓冲对象。
       * @returns {void} 只把 vertex buffer 绑定到当前 pass，不返回额外结果。
       */
      pass.setVertexBuffer(0, vertexBuffer);
      /**
       * draw
       * @param {number} vertexCount 要绘制的顶点数量；这里传入 3，刚好读取 vertex buffer 中的 3 个顶点。
       * @returns {void} 只把 draw 指令写入当前渲染通道，不返回额外结果。
       */
      pass.draw(3);
      pass.end();

      /**
       * queue.submit
       * @param {GPUCommandBuffer[]} commandBuffers 一组已经调用 `finish()` 的命令缓冲区。
       * @returns {void} 只负责把编码完成的命令正式提交给 GPU 队列执行。
       */
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    render();

    setStatus({
      title: "顶点缓冲已就绪",
      detail:
        "已经把位置和颜色上传到 GPUBuffer，并通过 setVertexBuffer 完成绘制。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
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
