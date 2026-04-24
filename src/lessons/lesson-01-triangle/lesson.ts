import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-01-triangle/triangle.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

/**
 * 挂载第 01 课“三角形”预览，并在容器内完成 WebGPU 初始化与绘制。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听；如果挂载失败，则返回空结果。
 */
export async function mountTriangleLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Hello Triangle preview"></canvas>
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
     * createShaderModule
     * @param {GPUShaderModuleDescriptor} descriptor shader 模块描述对象；这里把 `shaderSource` 作为 WGSL 源码传入。
     * @returns {GPUShaderModule} 后续可被顶点阶段和片元阶段复用的 shader 模块。
     */
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    /**
     * createRenderPipeline
     * @param {GPURenderPipelineDescriptor} descriptor 渲染管线描述对象，里面包含 vertex、fragment、primitive 等阶段配置。
     * @returns {GPURenderPipeline} 把顶点阶段、片元阶段和图元装配规则组合起来的完整渲染管线。
     */
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-01-hello-triangle",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vsMain",
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        // topology = "triangle-list"：每 3 个顶点会被当成一个独立三角形。
        // 这一课正好只 draw(3)，所以 GPU 会把这 3 个顶点解释成 1 个三角形。
        // 如果以后写成 "line-list" 或 "triangle-strip"，顶点的组装规则就会不一样。
        topology: "triangle-list",
      },
    });

    /**
     * 录制并提交一次静态三角形绘制命令。
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
            // clearValue：当 loadOp 选择 "clear" 时，用这组 RGBA 颜色先清空整张颜色附件。
            clearValue: { r: 0.043, g: 0.074, b: 0.141, a: 1 },
            // loadOp = "clear"：忽略这张纹理原来已有的内容，进入 pass 时先用 clearValue 清屏。
            // 如果以后写成 "load"，就表示保留之前已经画好的结果，在其基础上继续绘制。
            loadOp: "clear",
            // storeOp = "store"：pass 结束后把这次绘制结果保留下来，供屏幕显示或后续阶段读取。
            // 如果以后写成 "discard"，就表示这次 pass 结束后可以丢弃结果，通常用于不关心最终内容的临时附件。
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
       * draw
       * @param {number} vertexCount 要绘制的顶点数量；这里传入 3，刚好组成一个最基础的三角形。
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
      title: "预览已就绪",
      detail:
        "已经完成 canvas 配置、WGSL 编译和一次静态三角形绘制。",
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
