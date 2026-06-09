import shaderSource from "@/lessons/lesson-115-canvas-format-color-space-and-presentation-tone-mapping/presentation-tone.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type CanvasConfigWithColorSpace = GPUCanvasConfiguration & {
  colorSpace?: PredefinedColorSpace;
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

function configurePresentationCanvas(
  context: GPUCanvasContext,
  device: GPUDevice,
  format: GPUTextureFormat
) {
  const configuration: CanvasConfigWithColorSpace = {
    device,
    format,
    alphaMode: "opaque",
    colorSpace: "srgb",
  };
  context.configure(configuration);
}

export async function mountCanvasFormatColorSpaceAndPresentationToneMappingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--presentation-tone">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Canvas presentation tone mapping preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>HDR scene value -> tone mapping -> canvas presentation</strong>
            <span>这里还不是完整 HDR 管线，而是讲最终写入 canvas 前的格式和色彩边界。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <label>Exposure <input type="range" min="0.4" max="3.2" step="0.05" value="1.45" data-exposure /></label>
          <button type="button" data-tone-toggle>切换 tone mapper</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>presentation format</span><strong data-format>pending</strong></article>
          <article class="webgpu-api-metric"><span>colorSpace</span><strong>srgb</strong></article>
          <article class="webgpu-api-metric"><span>tone mapper</span><strong data-tone>Reinhard</strong></article>
        </div>
        <div class="webgpu-api-note" data-note>HDR 数值会先压缩，再输出到 canvas format。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const exposureInput = host.querySelector<HTMLInputElement>("[data-exposure]");
  const toggleButton = host.querySelector<HTMLButtonElement>("[data-tone-toggle]");
  const formatLabel = host.querySelector<HTMLElement>("[data-format]");
  const toneLabel = host.querySelector<HTMLElement>("[data-tone]");
  const note = host.querySelector<HTMLElement>("[data-note]");
  if (!canvas || !stage || !exposureInput || !toggleButton || !formatLabel || !toneLabel || !note) {
    throw new Error("Presentation tone lesson DOM 初始化失败。");
  }

  try {
    if (!navigator.gpu) {
      throw new Error("当前浏览器没有提供 WebGPU。");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("没有拿到可用的 GPUAdapter。");
    }
    const device = await adapter.requestDevice({ label: "lesson-95-presentation-device" });
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("没有拿到 WebGPUCanvasContext。");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    const shaderModule = device.createShaderModule({ code: shaderSource });
    const uniformBuffer = device.createBuffer({
      label: "lesson-95-tone-uniforms",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const pipeline = device.createRenderPipeline({
      label: "lesson-95-presentation-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format }],
      },
    });
    const bindGroup = device.createBindGroup({
      label: "lesson-95-tone-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    let toneMode = 0;
    let animationFrameId = 0;
    let disposed = false;
    formatLabel.textContent = format;

    const render = (time: number) => {
      if (disposed) {
        return;
      }
      syncApiViewport(host, stage);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
      configurePresentationCanvas(context, device, format);

      const exposure = Number(exposureInput.value);
      device.queue.writeBuffer(
        uniformBuffer,
        0,
        new Float32Array([exposure, toneMode, time * 0.001, 0])
      );

      const commandEncoder = device.createCommandEncoder({ label: "lesson-95-command-encoder" });
      const pass = commandEncoder.beginRenderPass({
        label: "lesson-95-presentation-pass",
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.015, g: 0.02, b: 0.032, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      device.queue.submit([commandEncoder.finish()]);

      toneLabel.textContent = toneMode === 0 ? "Reinhard" : "ACES fit";
      toggleButton.dataset.active = toneMode === 1 ? "true" : "false";
      note.textContent = `format=${format}, colorSpace=srgb, exposure=${exposure.toFixed(2)}，HDR 值已在 shader 中压到可显示范围。`;
      animationFrameId = window.requestAnimationFrame(render);
    };

    toggleButton.addEventListener("click", () => {
      toneMode = toneMode === 0 ? 1 : 0;
    });

    animationFrameId = window.requestAnimationFrame(render);
    const resizeObserver = new ResizeObserver(() => render(performance.now()));
    resizeObserver.observe(host);
    setStatus({
      title: "Presentation canvas 已配置",
      detail: "本课把 canvas format、colorSpace 和显示前 tone mapping 放在 HDR 章节之前讲清楚。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      uniformBuffer.destroy();
      device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
