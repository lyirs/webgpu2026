import shaderSource from "@/lessons/lesson-03-canvas-context-configure-and-alpha-mode/canvas-config.wgsl?raw";

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

function configureCanvas(
  context: GPUCanvasContext,
  device: GPUDevice,
  format: GPUTextureFormat,
  alphaMode: GPUCanvasAlphaMode
) {
  context.configure({ device, format, alphaMode });
}

export async function mountCanvasContextConfigureAndAlphaModeLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--canvas-config">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card webgpu-api-canvas-card--checker">
          <canvas class="webgpu-api-canvas" aria-label="Canvas context configure preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>WebGPUCanvasContext.configure()</strong>
            <span>同一个 shader，切换 alphaMode 后观察 canvas 与页面背景的合成边界。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <button type="button" data-alpha-toggle>切换 alphaMode</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>context</span><strong data-context>pending</strong></article>
          <article class="webgpu-api-metric"><span>preferred format</span><strong data-format>pending</strong></article>
          <article class="webgpu-api-metric"><span>alphaMode</span><strong data-alpha>opaque</strong></article>
        </div>
        <div class="webgpu-api-note" data-note>准备申请 adapter/device 并配置 canvas。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const contextLabel = host.querySelector<HTMLElement>("[data-context]");
  const formatLabel = host.querySelector<HTMLElement>("[data-format]");
  const alphaLabel = host.querySelector<HTMLElement>("[data-alpha]");
  const note = host.querySelector<HTMLElement>("[data-note]");
  const toggleButton = host.querySelector<HTMLButtonElement>("[data-alpha-toggle]");
  if (!canvas || !stage || !contextLabel || !formatLabel || !alphaLabel || !note || !toggleButton) {
    throw new Error("Canvas configure lesson DOM 初始化失败。");
  }

  try {
    if (!navigator.gpu) {
      throw new Error("当前浏览器没有提供 WebGPU。");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("没有拿到可用的 GPUAdapter。");
    }

    const device = await adapter.requestDevice({
      label: "lesson-03-canvas-config-device",
    });
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("没有拿到 WebGPUCanvasContext。");
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    const shaderModule = device.createShaderModule({
      label: "lesson-03-canvas-config-shader",
      code: shaderSource,
    });
    const pipeline = device.createRenderPipeline({
      label: "lesson-03-canvas-config-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format }],
      },
    });

    let alphaMode: GPUCanvasAlphaMode = "opaque";
    contextLabel.textContent = "webgpu";
    formatLabel.textContent = format;

    const render = () => {
      syncApiViewport(host, stage);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
      configureCanvas(context, device, format, alphaMode);

      const commandEncoder = device.createCommandEncoder({
        label: "lesson-03-canvas-config-encoder",
      });
      const pass = commandEncoder.beginRenderPass({
        label: "lesson-03-canvas-config-pass",
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: alphaMode === "opaque" ? 1 : 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([commandEncoder.finish()]);

      alphaLabel.textContent = alphaMode;
      toggleButton.dataset.active = alphaMode === "premultiplied" ? "true" : "false";
      note.textContent = `context.configure({ format: ${format}, alphaMode: ${alphaMode} }) 已运行。`;
    };

    toggleButton.addEventListener("click", () => {
      alphaMode = alphaMode === "opaque" ? "premultiplied" : "opaque";
      render();
    });

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Canvas context 已配置",
      detail: "这一课直接使用 WebGPUCanvasContext.configure，而不是隐藏在 helper 里。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `
      <div class="preview-empty">
        <h3>预览不可用</h3>
        <p>${message}</p>
      </div>
    `;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
