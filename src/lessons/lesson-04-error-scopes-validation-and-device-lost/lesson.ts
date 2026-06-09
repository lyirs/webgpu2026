import shaderSource from "@/lessons/lesson-04-error-scopes-validation-and-device-lost/safe-triangle.wgsl?raw";

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

function describeGpuError(error: GPUError | null): string {
  if (!error) {
    return "未捕获到错误";
  }

  const name =
    "constructor" in error && error.constructor
      ? error.constructor.name
      : "GPUError";
  return `${name}: ${error.message}`;
}

export async function mountErrorScopesValidationAndDeviceLostLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Error scope preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>pushErrorScope -> controlled validation -> popErrorScope</strong>
            <span>错误被 scope 收走，预览继续安全渲染</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>captured validation</span><strong data-captured>pending</strong></article>
          <article class="webgpu-api-metric"><span>uncaptured errors</span><strong data-uncaptured>0</strong></article>
          <article class="webgpu-api-metric"><span>device.lost</span><strong data-lost>watching</strong></article>
        </div>
        <div class="webgpu-api-note" data-note>正在创建 device 并安装错误监听...</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const capturedLabel = host.querySelector<HTMLElement>("[data-captured]");
  const uncapturedLabel = host.querySelector<HTMLElement>("[data-uncaptured]");
  const lostLabel = host.querySelector<HTMLElement>("[data-lost]");
  const note = host.querySelector<HTMLElement>("[data-note]");
  if (!canvas || !stage || !capturedLabel || !uncapturedLabel || !lostLabel || !note) {
    throw new Error("Error scope lesson DOM 初始化失败。");
  }

  try {
    if (!("gpu" in navigator)) {
      throw new Error("当前浏览器没有提供 WebGPU。");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("没有拿到可用的 GPUAdapter。");
    }

    const device = await adapter.requestDevice({
      label: "lesson-03-error-scope-device",
    });
    let uncapturedCount = 0;
    const onUncapturedError = (event: Event) => {
      uncapturedCount += 1;
      const gpuEvent = event as GPUUncapturedErrorEvent;
      uncapturedLabel.textContent = `${uncapturedCount}`;
      note.textContent = `有未被 scope 捕获的错误：${gpuEvent.error.message}`;
    };
    device.addEventListener("uncapturederror", onUncapturedError);
    device.lost.then((info) => {
      lostLabel.textContent = info.reason === "destroyed" ? "destroyed" : "lost";
    });

    device.pushErrorScope("validation");
    const tooSmallUniform = device.createBuffer({
      label: "lesson-03-too-small-uniform",
      size: 4,
      usage: GPUBufferUsage.UNIFORM,
    });
    const invalidLayout = device.createBindGroupLayout({
      label: "lesson-03-validation-layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform", minBindingSize: 16 },
        },
      ],
    });
    device.createBindGroup({
      label: "lesson-03-controlled-invalid-bind-group",
      layout: invalidLayout,
      entries: [{ binding: 0, resource: { buffer: tooSmallUniform } }],
    });
    const scopedError = await device.popErrorScope();
    capturedLabel.textContent = scopedError ? "captured" : "missing";

    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("没有拿到 WebGPUCanvasContext。");
    }

    const format = navigator.gpu.getPreferredCanvasFormat();
    const shaderModule = device.createShaderModule({ code: shaderSource });
    const pipeline = device.createRenderPipeline({
      label: "lesson-03-safe-render-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format }],
      },
    });

    const render = () => {
      syncApiViewport(host, stage);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
      context.configure({ device, format, alphaMode: "opaque" });

      const commandEncoder = device.createCommandEncoder({
        label: "lesson-03-command-encoder",
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.028, g: 0.044, b: 0.075, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([commandEncoder.finish()]);
    };

    note.textContent = describeGpuError(scopedError);
    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Validation error 已被 error scope 捕获",
      detail: scopedError
        ? "受控 bind group 错误没有泄漏到控制台，device 仍能继续渲染。"
        : "没有捕获到预期 validation error，请检查浏览器实现。",
      tone: scopedError ? "ok" : "warn",
    });

    return () => {
      resizeObserver.disconnect();
      device.removeEventListener("uncapturederror", onUncapturedError);
      tooSmallUniform.destroy();
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
