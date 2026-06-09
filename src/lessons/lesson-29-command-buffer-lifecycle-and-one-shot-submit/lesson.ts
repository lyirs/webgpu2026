import shaderSource from "@/lessons/lesson-29-command-buffer-lifecycle-and-one-shot-submit/command-buffer.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

function syncApiViewport(host: HTMLElement, viewport: HTMLElement) {
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
}

function describeGpuError(error: GPUError | null) {
  return error ? `${error.constructor.name}: ${error.message}` : "未捕获到 validation error";
}

export async function mountCommandBufferLifecycleAndOneShotSubmitLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--command-buffer">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Command buffer lifecycle preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>encoder -> finish() -> GPUCommandBuffer -> submit()</strong>
            <span>下方 timeline 会捕获一次重复 submit 的受控 validation。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-timeline">
          <span class="webgpu-api-step">createCommandEncoder</span>
          <span class="webgpu-api-step">beginRenderPass</span>
          <span class="webgpu-api-step">finish()</span>
          <span class="webgpu-api-step">queue.submit</span>
          <span class="webgpu-api-step webgpu-api-step--warn">second submit?</span>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>frames submitted</span><strong data-frames>0</strong></article>
          <article class="webgpu-api-metric"><span>reuse check</span><strong data-reuse>pending</strong></article>
          <article class="webgpu-api-metric"><span>GPUCommandBuffer</span><strong>one-shot</strong></article>
        </div>
        <div class="webgpu-api-note" data-note>每一帧都会重新 record command buffer；已经 submit 的 command buffer 不能复用。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const frameLabel = host.querySelector<HTMLElement>("[data-frames]");
  const reuseLabel = host.querySelector<HTMLElement>("[data-reuse]");
  const note = host.querySelector<HTMLElement>("[data-note]");
  if (!canvas || !stage || !frameLabel || !reuseLabel || !note) {
    throw new Error("Command buffer lesson DOM 初始化失败。");
  }

  try {
    if (!navigator.gpu) {
      throw new Error("当前浏览器没有提供 WebGPU。");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("没有拿到可用的 GPUAdapter。");
    }
    const device = await adapter.requestDevice({ label: "lesson-20-command-buffer-device" });
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("没有拿到 WebGPUCanvasContext。");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    const shaderModule = device.createShaderModule({ code: shaderSource });
    const pipeline = device.createRenderPipeline({
      label: "lesson-20-command-buffer-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format }],
      },
    });

    let disposed = false;
    let frameCount = 0;
    let reuseCheckStarted = false;
    let animationFrameId = 0;

    const testCommandBufferReuse = async (commandBuffer: GPUCommandBuffer) => {
      device.pushErrorScope("validation");
      try {
        device.queue.submit([commandBuffer]);
      } catch (error) {
        note.textContent = error instanceof Error ? error.message : "重复 submit 抛出了未知错误。";
      }
      const scopedError = await device.popErrorScope();
      if (disposed) {
        return;
      }
      reuseLabel.textContent = scopedError ? "captured" : "missing";
      note.textContent = describeGpuError(scopedError);
      setStatus({
        title: scopedError ? "重复 submit 已被 validation 捕获" : "未捕获到预期错误",
        detail: scopedError ? "GPUCommandBuffer 是一次性提交对象，复用被 error scope 收住了。" : "当前浏览器没有返回预期 validation error。",
        tone: scopedError ? "ok" : "warn",
      });
    };

    const render = () => {
      if (disposed) {
        return;
      }
      syncApiViewport(host, stage);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
      context.configure({ device, format, alphaMode: "opaque" });

      const commandEncoder = device.createCommandEncoder({ label: "lesson-20-command-encoder" });
      const pass = commandEncoder.beginRenderPass({
        label: "lesson-20-render-pass",
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.036, b: 0.065, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();

      const commandBuffer = commandEncoder.finish({ label: "lesson-20-command-buffer" });
      device.queue.submit([commandBuffer]);
      frameCount += 1;
      frameLabel.textContent = `${frameCount}`;

      if (!reuseCheckStarted) {
        reuseCheckStarted = true;
        void testCommandBufferReuse(commandBuffer);
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
