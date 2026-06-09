import f16ShaderSource from "@/lessons/lesson-38-shader-f16-optional-features-and-precision-tradeoff/precision-f16.wgsl?raw";
import f32ShaderSource from "@/lessons/lesson-38-shader-f16-optional-features-and-precision-tradeoff/precision-f32.wgsl?raw";

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

function resizeCanvas(canvas: HTMLCanvasElement, context: GPUCanvasContext, device: GPUDevice, format: GPUTextureFormat) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  context.configure({ device, format, alphaMode: "opaque" });
}

function setHalfViewport(pass: GPURenderPassEncoder, canvas: HTMLCanvasElement, side: 0 | 1) {
  const width = Math.floor(canvas.width / 2);
  const x = side * width;
  const panelWidth = side === 1 ? canvas.width - x : width;
  pass.setViewport(x, 0, panelWidth, canvas.height, 0, 1);
  pass.setScissorRect(x, 0, panelWidth, canvas.height);
}

export async function mountShaderF16OptionalFeaturesAndPrecisionTradeoffLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="shader-f16 optional feature preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>shader-f16 feature gate</strong>
            <span>左侧始终是 f32；右侧只有 adapter 支持 shader-f16 时才创建 requiredFeatures device 与 f16 pipeline。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>adapter feature</span><strong data-feature>checking</strong></article>
          <article class="webgpu-api-metric"><span>requiredFeatures</span><strong data-required>none</strong></article>
          <article class="webgpu-api-metric"><span>left shader</span><strong>f32</strong></article>
          <article class="webgpu-api-metric"><span>right shader</span><strong data-right>fallback</strong></article>
        </div>
        <div class="webgpu-api-note" data-note>shader-f16 是 optional feature：不支持时不能编译 enable f16 的 WGSL，也不能假装可用。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const featureLabel = host.querySelector<HTMLElement>("[data-feature]");
  const requiredLabel = host.querySelector<HTMLElement>("[data-required]");
  const rightLabel = host.querySelector<HTMLElement>("[data-right]");
  const note = host.querySelector<HTMLElement>("[data-note]");
  if (!canvas || !stage || !featureLabel || !requiredLabel || !rightLabel || !note) {
    throw new Error("shader-f16 lesson DOM 初始化失败。");
  }

  try {
    if (!("gpu" in navigator)) {
      throw new Error("当前浏览器没有提供 WebGPU。");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("没有拿到可用的 GPUAdapter。");
    }

    const shaderF16Feature = "shader-f16" as GPUFeatureName;
    const supportsF16 = adapter.features.has(shaderF16Feature);
    const device = await adapter.requestDevice({
      requiredFeatures: supportsF16 ? [shaderF16Feature] : [],
    });
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("没有拿到 WebGPUCanvasContext。");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();

    featureLabel.textContent = supportsF16 ? "supported" : "not supported";
    requiredLabel.textContent = supportsF16 ? '["shader-f16"]' : "fallback f32";
    rightLabel.textContent = supportsF16 ? "f16" : "f32 fallback";
    note.textContent = supportsF16
      ? "当前 adapter 支持 shader-f16，本课实际创建了带 requiredFeatures 的 device 和 f16 pipeline。"
      : "当前 adapter 不支持 shader-f16，因此右侧不会编译 f16 WGSL，而是安全回退到 f32 pipeline。";

    const leftUniformBuffer = device.createBuffer({
      label: "lesson-20-left-precision-uniforms",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const rightUniformBuffer = device.createBuffer({
      label: "lesson-20-right-precision-uniforms",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const f32Module = device.createShaderModule({ code: f32ShaderSource });
    const f16Module = supportsF16 ? device.createShaderModule({ code: f16ShaderSource }) : null;
    const createPipeline = (module: GPUShaderModule, label: string) =>
      device.createRenderPipeline({
        label,
        layout: "auto",
        vertex: { module, entryPoint: "vsMain" },
        fragment: { module, entryPoint: "fsMain", targets: [{ format }] },
      });
    const f32Pipeline = createPipeline(f32Module, "lesson-20-f32-pipeline");
    const f16Pipeline = f16Module ? createPipeline(f16Module, "lesson-20-f16-pipeline") : null;
    const leftBindGroup = device.createBindGroup({
      label: "lesson-20-left-f32-bind-group",
      layout: f32Pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: leftUniformBuffer } }],
    });
    const rightF32BindGroup = device.createBindGroup({
      label: "lesson-20-right-f32-bind-group",
      layout: f32Pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: rightUniformBuffer } }],
    });
    const f16BindGroup = f16Pipeline
      ? device.createBindGroup({
          label: "lesson-20-f16-bind-group",
          layout: f16Pipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: { buffer: rightUniformBuffer } }],
        })
      : null;

    let frameId = 0;
    let disposed = false;
    const render = (timeMs = 0) => {
      if (disposed) {
        return;
      }
      syncApiViewport(host, stage);
      resizeCanvas(canvas, context, device, format);
      const time = timeMs * 0.001;
      const encoder = device.createCommandEncoder({ label: "lesson-20-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      device.queue.writeBuffer(leftUniformBuffer, 0, new Float32Array([time, supportsF16 ? 1 : 0, 0, 0]));
      device.queue.writeBuffer(rightUniformBuffer, 0, new Float32Array([time, supportsF16 ? 1 : 0, 1, 0]));
      setHalfViewport(pass, canvas, 0);
      pass.setPipeline(f32Pipeline);
      pass.setBindGroup(0, leftBindGroup);
      pass.draw(3);

      setHalfViewport(pass, canvas, 1);
      pass.setPipeline(f16Pipeline ?? f32Pipeline);
      pass.setBindGroup(0, f16BindGroup ?? rightF32BindGroup);
      pass.draw(3);
      pass.end();

      device.queue.submit([encoder.finish()]);
      frameId = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: supportsF16 ? "shader-f16 已启用" : "shader-f16 不可用，已安全回退",
      detail: supportsF16
        ? "本课使用 requiredFeatures 请求了 f16 device，并创建了 f16 pipeline。"
        : "当前环境不支持 optional feature，因此只展示 f32 fallback，不会产生 f16 编译错误。",
      tone: supportsF16 ? "ok" : "info",
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      leftUniformBuffer.destroy();
      rightUniformBuffer.destroy();
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
