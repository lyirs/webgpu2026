import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-36-pipeline-layout-auto-vs-explicit-compatibility/layout-compatibility.wgsl?raw";

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

function writeParams(device: GPUDevice, buffer: GPUBuffer, color: [number, number, number], time: number) {
  device.queue.writeBuffer(buffer, 0, new Float32Array([color[0], color[1], color[2], 1, time, 0, 0, 0]));
}

export async function mountPipelineLayoutAutoVsExplicitCompatibilityLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--layout-compat">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Pipeline layout auto vs explicit compatibility preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>layout: "auto" vs explicit pipelineLayout</strong>
            <span>左侧自动 layout 独享 BGL；右侧显式 layout 可被多条 pipeline 共享。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>auto bind groups</span><strong data-auto>1 pipeline-owned BGL</strong></article>
          <article class="webgpu-api-metric"><span>explicit layout</span><strong data-layout-reuse>shared</strong></article>
          <article class="webgpu-api-metric"><span>pipeline count</span><strong data-pipeline-count>2</strong></article>
          <article class="webgpu-api-metric"><span>compat rule</span><strong>same BGL shape</strong></article>
        </div>
        <div class="webgpu-api-note">auto layout 很方便，但不适合跨 pipeline 复用 bind group；显式 pipelineLayout 让兼容边界由你定义。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Pipeline layout compatibility lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ label: "lesson-33-layout-compat-shader", code: shaderSource });
    const autoPipeline = gpu.device.createRenderPipeline({
      label: "lesson-33-auto-layout-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const explicitBgl = gpu.device.createBindGroupLayout({
      label: "lesson-33-explicit-bgl",
      entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
    });
    const explicitLayout = gpu.device.createPipelineLayout({ label: "lesson-33-explicit-pipeline-layout", bindGroupLayouts: [explicitBgl] });
    const explicitPipeline = gpu.device.createRenderPipeline({
      label: "lesson-33-explicit-layout-pipeline",
      layout: explicitLayout,
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const autoBuffer = gpu.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const explicitBuffer = gpu.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const autoBindGroup = gpu.device.createBindGroup({
      label: "lesson-33-auto-owned-bind-group",
      layout: autoPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: autoBuffer } }],
    });
    const explicitBindGroup = gpu.device.createBindGroup({
      label: "lesson-33-explicit-shared-bind-group",
      layout: explicitBgl,
      entries: [{ binding: 0, resource: { buffer: explicitBuffer } }],
    });

    let frameId = 0;
    const render = (time = 0) => {
      syncApiViewport(host, stage);
      gpu.resize();
      writeParams(gpu.device, autoBuffer, [0.2, 0.58, 0.95], time * 0.001);
      writeParams(gpu.device, explicitBuffer, [0.95, 0.7, 0.22], time * 0.001 + 0.35);
      const currentTexture = gpu.context.getCurrentTexture();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-33-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: currentTexture.createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0.02, g: 0.04, b: 0.08, a: 1 } }],
      });
      pass.setViewport(0, 0, canvas.width / 2, canvas.height, 0, 1);
      pass.setPipeline(autoPipeline);
      pass.setBindGroup(0, autoBindGroup);
      pass.draw(3);
      pass.setViewport(canvas.width / 2, 0, canvas.width / 2, canvas.height, 0, 1);
      pass.setPipeline(explicitPipeline);
      pass.setBindGroup(0, explicitBindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      frameId = requestAnimationFrame(render);
    };
    render();
    setStatus({ title: "Layout compatibility", detail: "auto layout 与 explicit pipelineLayout 对照已渲染，右侧使用共享 BGL。", tone: "ok" });
    return () => cancelAnimationFrame(frameId);
  } catch (error) {
    setStatus({ title: "WebGPU 初始化失败", detail: error instanceof Error ? error.message : String(error), tone: "warn" });
  }
}
