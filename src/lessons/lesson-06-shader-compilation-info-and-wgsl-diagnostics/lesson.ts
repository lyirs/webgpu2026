import validShaderSource from "@/lessons/lesson-06-shader-compilation-info-and-wgsl-diagnostics/diagnostics.valid.wgsl?raw";
import invalidShaderSource from "@/lessons/lesson-06-shader-compilation-info-and-wgsl-diagnostics/diagnostics.invalid.wgsl?raw";

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

function messageLocation(message: GPUCompilationMessage) {
  return `L${message.lineNum}:${message.linePos}`;
}

export async function mountShaderCompilationInfoAndWgslDiagnosticsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--compilation-info">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="WGSL compilation diagnostics preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>getCompilationInfo() + error scope</strong>
            <span>错误 shader 只进入诊断面板，不污染控制台；安全 shader 继续渲染。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>valid shader</span><strong data-valid>pending</strong></article>
          <article class="webgpu-api-metric"><span>diagnostics</span><strong data-count>pending</strong></article>
          <article class="webgpu-api-metric"><span>captured error</span><strong data-error>pending</strong></article>
          <article class="webgpu-api-metric"><span>first message</span><strong data-location>pending</strong></article>
        </div>
        <div class="webgpu-api-resource-grid" data-messages></div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const validLabel = host.querySelector<HTMLElement>("[data-valid]");
  const countLabel = host.querySelector<HTMLElement>("[data-count]");
  const errorLabel = host.querySelector<HTMLElement>("[data-error]");
  const locationLabel = host.querySelector<HTMLElement>("[data-location]");
  const messagesGrid = host.querySelector<HTMLElement>("[data-messages]");

  if (!canvas || !stage || !validLabel || !countLabel || !errorLabel || !locationLabel || !messagesGrid) {
    throw new Error("Compilation info lesson DOM 初始化失败。");
  }

  try {
    if (!("gpu" in navigator)) {
      throw new Error("当前浏览器没有提供 WebGPU。");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("没有拿到可用的 GPUAdapter。");
    }

    const device = await adapter.requestDevice({ label: "lesson-06-compilation-info-device" });
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("没有拿到 WebGPUCanvasContext。");
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    const validModule = device.createShaderModule({
      label: "lesson-06-valid-wgsl-module",
      code: validShaderSource,
    });
    const validInfo = await validModule.getCompilationInfo();
    validLabel.textContent = validInfo.messages.length === 0 ? "0 messages" : `${validInfo.messages.length}`;

    device.pushErrorScope("validation");
    const invalidModule = device.createShaderModule({
      label: "lesson-06-controlled-invalid-wgsl-module",
      code: invalidShaderSource,
    });
    const [invalidInfo, scopedError] = await Promise.all([
      invalidModule.getCompilationInfo(),
      device.popErrorScope(),
    ]);

    countLabel.textContent = `${invalidInfo.messages.length}`;
    errorLabel.textContent = scopedError ? "captured" : "none";
    locationLabel.textContent = invalidInfo.messages[0] ? messageLocation(invalidInfo.messages[0]) : "none";
    messagesGrid.innerHTML = "";
    invalidInfo.messages.slice(0, 4).forEach((message) => {
      const card = document.createElement("article");
      card.className = "webgpu-api-resource";
      const title = document.createElement("strong");
      title.textContent = `${message.type} @ ${messageLocation(message)}`;
      const detail = document.createElement("small");
      detail.textContent = message.message;
      card.append(title, detail);
      messagesGrid.append(card);
    });

    const pipeline = device.createRenderPipeline({
      label: "lesson-06-valid-preview-pipeline",
      layout: "auto",
      vertex: { module: validModule, entryPoint: "vsMain" },
      fragment: { module: validModule, entryPoint: "fsMain", targets: [{ format }] },
    });

    const render = () => {
      syncApiViewport(host, stage);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
      context.configure({ device, format, alphaMode: "opaque" });

      const encoder = device.createCommandEncoder({ label: "lesson-06-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.035, b: 0.06, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "WGSL diagnostics 已捕获",
      detail: "getCompilationInfo() 返回了错误 shader 的定位信息，validation error 被 error scope 收住。",
      tone: scopedError || invalidInfo.messages.length > 0 ? "ok" : "warn",
    });

    return () => {
      resizeObserver.disconnect();
      device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
