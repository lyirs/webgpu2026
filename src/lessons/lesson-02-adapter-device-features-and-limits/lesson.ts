import shaderSource from "@/lessons/lesson-02-adapter-device-features-and-limits/device-bars.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const limitKeys = [
  "maxTextureDimension2D",
  "maxBufferSize",
  "maxBindGroups",
  "maxColorAttachments",
] as const;

function formatLimitValue(key: string, value: number): string {
  if (key === "maxBufferSize") {
    return `${Math.round(value / (1024 * 1024))} MB`;
  }
  return value.toLocaleString();
}

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

export async function mountAdapterDeviceFeaturesAndLimitsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Adapter limits preview"></canvas>
          <div class="webgpu-api-overlay">
            <strong>adapter -> device</strong>
            <span>requestAdapter / requestDevice / requiredLimits</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics" data-metrics></div>
        <div class="webgpu-api-note" data-note>正在请求 GPUAdapter...</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const metrics = host.querySelector<HTMLElement>("[data-metrics]");
  const note = host.querySelector<HTMLElement>("[data-note]");
  if (!canvas || !stage || !metrics || !note) {
    throw new Error("Adapter lesson DOM 初始化失败。");
  }

  try {
    if (!("gpu" in navigator)) {
      throw new Error("当前浏览器没有提供 WebGPU。");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("没有拿到可用的 GPUAdapter。");
    }

    const safeRequiredLimits = {
      maxBindGroups: Math.min(4, adapter.limits.maxBindGroups),
    };

    const device = await adapter.requestDevice({
      label: "lesson-02-device",
      requiredLimits: safeRequiredLimits,
    });

    const requestedMaxBindGroups = adapter.limits.maxBindGroups + 1;
    const failedLimitCheck =
      requestedMaxBindGroups > adapter.limits.maxBindGroups ? "会被拒绝" : "可请求";

    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("没有拿到 WebGPUCanvasContext。");
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    const configure = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
      context.configure({ device, format, alphaMode: "opaque" });
    };

    const shaderModule = device.createShaderModule({ code: shaderSource });
    const pipeline = device.createRenderPipeline({
      label: "lesson-02-adapter-device-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });

    const render = () => {
      syncApiViewport(host, stage);
      configure();
      const commandEncoder = device.createCommandEncoder({
        label: "lesson-02-command-encoder",
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.035, g: 0.055, b: 0.09, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.draw(18);
      pass.end();
      device.queue.submit([commandEncoder.finish()]);
    };

    const limitMarkup = limitKeys
      .map((key) => {
        const value = Number(adapter.limits[key]);
        return `
          <article class="webgpu-api-metric">
            <span>${key}</span>
            <strong>${formatLimitValue(key, value)}</strong>
          </article>
        `;
      })
      .join("");

    metrics.innerHTML = `
      ${limitMarkup}
      <article class="webgpu-api-metric">
        <span>features</span>
        <strong>${adapter.features.size}</strong>
      </article>
      <article class="webgpu-api-metric">
        <span>required maxBindGroups+1</span>
        <strong>${failedLimitCheck}</strong>
      </article>
    `;
    note.textContent =
      "左侧是真实 device 创建后的画面；下方数值直接来自 adapter.limits，失败路径按 requiredLimits 规则预测，不提交会污染控制台的失败请求。";

    syncApiViewport(host, stage);
    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Adapter / Device 已就绪",
      detail: `features=${adapter.features.size}，requiredLimits 成功路径已运行，失败路径以 adapter.limits 预测。`,
      tone: failedLimitCheck === "会被拒绝" ? "ok" : "warn",
    });

    return () => {
      resizeObserver.disconnect();
      device.destroy();
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
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
