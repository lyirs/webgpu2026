import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-39-shader-override-constants-and-pipeline-specialization/specialization.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type PipelineVariant = {
  name: string;
  radius: number;
  bands: number;
  lightingMode: number;
};

const variants: PipelineVariant[] = [
  { name: "small radius", radius: 0.28, bands: 4, lightingMode: 0 },
  { name: "more bands", radius: 0.42, bands: 9, lightingMode: 1 },
  { name: "wide mask", radius: 0.62, bands: 5, lightingMode: 2 },
];

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

export async function mountShaderOverrideConstantsAndPipelineSpecializationLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Shader override constants preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>one WGSL module -> three specialized pipelines</strong>
            <span>override radius / bands / lightingMode 在 createRenderPipeline 时固定下来</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls" data-controls></div>
        <div class="webgpu-api-metrics" data-metrics></div>
        <div class="webgpu-api-note"><code>override</code> 是 shader 编译期常量：同一份 WGSL 可以在创建 pipeline 时变成多条专用变体。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const controls = host.querySelector<HTMLElement>("[data-controls]");
  const metrics = host.querySelector<HTMLElement>("[data-metrics]");
  if (!canvas || !stage || !controls || !metrics) {
    throw new Error("Shader override lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const shaderModule = gpu.device.createShaderModule({
      label: "lesson-17-specialization-shader",
      code: shaderSource,
    });
    const pipelines = variants.map((variant) =>
      gpu.device.createRenderPipeline({
        label: `lesson-17-specialized-${variant.name}`,
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vsMain",
          constants: {
            radius: variant.radius,
            bands: variant.bands,
            lightingMode: variant.lightingMode,
          },
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fsMain",
          constants: {
            radius: variant.radius,
            bands: variant.bands,
            lightingMode: variant.lightingMode,
          },
          targets: [{ format: gpu.format }],
        },
        primitive: { topology: "triangle-list" },
      })
    );

    let selectedIndex = 1;
    controls.innerHTML = variants
      .map(
        (variant, index) =>
          `<button type="button" data-index="${index}">${variant.name}</button>`
      )
      .join("");
    const buttons = Array.from(controls.querySelectorAll<HTMLButtonElement>("button"));
    const syncMetrics = () => {
      buttons.forEach((button, index) => {
        button.dataset.active = index === selectedIndex ? "true" : "false";
      });
      const selected = variants[selectedIndex];
      metrics.innerHTML = `
        <article class="webgpu-api-metric"><span>selected pipeline</span><strong>${selected.name}</strong></article>
        <article class="webgpu-api-metric"><span>radius override</span><strong>${selected.radius.toFixed(2)}</strong></article>
        <article class="webgpu-api-metric"><span>bands override</span><strong>${selected.bands}</strong></article>
        <article class="webgpu-api-metric"><span>pipeline count</span><strong>${pipelines.length}</strong></article>
      `;
    };

    buttons.forEach((button, index) => {
      button.addEventListener("click", () => {
        selectedIndex = index;
        syncMetrics();
      });
    });
    syncMetrics();

    let animationFrame = 0;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-17-command-encoder",
      });
      const pass = encoder.beginRenderPass({
        label: "lesson-17-specialization-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      const panelWidth = canvas.width / variants.length;
      pipelines.forEach((pipeline, index) => {
        pass.setViewport(index * panelWidth, 0, panelWidth, canvas.height, 0, 1);
        pass.setPipeline(pipeline);
        pass.draw(3);
      });
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    render();
    const resizeObserver = new ResizeObserver(() => syncApiViewport(host, stage));
    resizeObserver.observe(host);
    setStatus({
      title: "Override constants 已就绪",
      detail: "同一 WGSL shader 通过 constants 创建了 3 条 specialization pipeline。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
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
