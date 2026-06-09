import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-05-labels-debug-groups-and-error-diagnostics/debug-groups.wgsl?raw";

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

async function captureLabeledValidationError(device: GPUDevice): Promise<string> {
  const layout = device.createBindGroupLayout({
    label: "lesson-05-min-binding-size-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform", minBindingSize: 64 },
      },
    ],
  });
  const tooSmallBuffer = device.createBuffer({
    label: "lesson-05-too-small-uniform-buffer",
    size: 16,
    usage: GPUBufferUsage.UNIFORM,
  });

  device.pushErrorScope("validation");
  device.createBindGroup({
    label: "lesson-05-captured-bind-group-error",
    layout,
    entries: [{ binding: 0, resource: { buffer: tooSmallBuffer } }],
  });
  const error = await device.popErrorScope();
  tooSmallBuffer.destroy();

  return error
    ? `${error.constructor.name}: ${error.message.split("\n")[0]}`
    : "未捕获到错误，当前浏览器可能延迟了 validation。";
}

export async function mountLabelsDebugGroupsAndErrorDiagnosticsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--debug-groups">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Labels and debug groups preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>labels + debug groups</strong>
            <span>资源、pass、marker 都带 label；受控 validation error 被 error scope 收住。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-timeline">
          <span class="webgpu-api-step">create labeled resources</span>
          <span class="webgpu-api-step">pushDebugGroup</span>
          <span class="webgpu-api-step">insertDebugMarker</span>
          <span class="webgpu-api-step webgpu-api-step--warn">captured validation</span>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>shader label</span><strong>lesson-05-debug-shader</strong></article>
          <article class="webgpu-api-metric"><span>debug markers</span><strong data-markers>0</strong></article>
          <article class="webgpu-api-metric"><span>uncaptured</span><strong data-uncaptured>0</strong></article>
          <article class="webgpu-api-metric"><span>captured error</span><strong data-error>pending</strong></article>
        </div>
        <div class="webgpu-api-note">这节课故意创建一次 minBindingSize mismatch，但它被 pushErrorScope / popErrorScope 捕获，所以不应该污染控制台。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const markersValue = host.querySelector<HTMLElement>("[data-markers]");
  const uncapturedValue = host.querySelector<HTMLElement>("[data-uncaptured]");
  const errorValue = host.querySelector<HTMLElement>("[data-error]");
  if (!canvas || !stage || !markersValue || !uncapturedValue || !errorValue) {
    throw new Error("Debug groups lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    let markerCount = 0;
    let uncapturedCount = 0;
    const onUncaptured = () => {
      uncapturedCount += 1;
      uncapturedValue.textContent = String(uncapturedCount);
    };
    gpu.device.addEventListener("uncapturederror", onUncaptured);

    const module = gpu.device.createShaderModule({
      label: "lesson-05-debug-shader",
      code: shaderSource,
    });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-05-labeled-triangle-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: {
        module,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });

    errorValue.textContent = await captureLabeledValidationError(gpu.device);

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-05-labeled-command-encoder",
      });
      encoder.pushDebugGroup("lesson-05-frame");
      encoder.insertDebugMarker("before render pass");
      markerCount += 1;
      const pass = encoder.beginRenderPass({
        label: "lesson-05-labeled-render-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView({ label: "lesson-05-current-texture-view" }),
            clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.pushDebugGroup("draw labeled triangle");
      pass.setPipeline(pipeline);
      pass.insertDebugMarker("pass.draw(3)");
      markerCount += 1;
      pass.draw(3);
      pass.popDebugGroup();
      pass.end();
      encoder.popDebugGroup();
      gpu.device.queue.submit([encoder.finish()]);
      markersValue.textContent = String(markerCount);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Debug diagnostics 已就绪",
      detail: "资源 label、debug group、debug marker 和受控 validation error 都已经进入可观察路径。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      gpu.device.removeEventListener("uncapturederror", onUncaptured);
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
