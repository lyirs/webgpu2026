import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-23-bind-group-layouts-and-pipeline-layouts/layouts.wgsl?raw";

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

export async function mountBindGroupLayoutsAndPipelineLayoutsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Bind group layout preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>left: layout auto / right: explicit pipeline layout</strong>
            <span>同一份 WGSL binding，用两种 layout 来源驱动</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>@binding(0)</span><strong>uniform</strong></article>
          <article class="webgpu-api-metric"><span>@binding(1)</span><strong>read-only-storage</strong></article>
          <article class="webgpu-api-metric"><span>explicit entries</span><strong>2</strong></article>
        </div>
        <div class="webgpu-api-note">左侧通过 pipeline.getBindGroupLayout(0) 获得自动布局；右侧显式创建 bindGroupLayout 和 pipelineLayout。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Layout lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-10-uniform-buffer",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const palette = new Float32Array([
      0.18, 0.58, 1.0, 1.0,
      0.84, 0.96, 0.48, 1.0,
      1.0, 0.56, 0.28, 1.0,
      0.75, 0.52, 1.0, 1.0,
    ]);
    const paletteBuffer = gpu.device.createBuffer({
      label: "lesson-10-palette-buffer",
      size: palette.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(paletteBuffer, 0, palette);

    const autoPipeline = gpu.device.createRenderPipeline({
      label: "lesson-10-auto-layout-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const explicitBindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-10-explicit-bind-group-layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
      ],
    });
    const explicitPipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-10-explicit-pipeline-layout",
      bindGroupLayouts: [explicitBindGroupLayout],
    });
    const explicitPipeline = gpu.device.createRenderPipeline({
      label: "lesson-10-explicit-layout-pipeline",
      layout: explicitPipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });

    const bindGroupEntries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: { buffer: paletteBuffer } },
    ];
    const autoBindGroup = gpu.device.createBindGroup({
      label: "lesson-10-auto-bind-group",
      layout: autoPipeline.getBindGroupLayout(0),
      entries: bindGroupEntries,
    });
    const explicitBindGroup = gpu.device.createBindGroup({
      label: "lesson-10-explicit-bind-group",
      layout: explicitBindGroupLayout,
      entries: bindGroupEntries,
    });

    let frame = 0;
    let animationFrame = 0;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      frame += 1;
      gpu.device.queue.writeBuffer(
        uniformBuffer,
        0,
        new Float32Array([frame * 0.016, 0, 0, 0])
      );
      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-10-command-encoder",
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.035, g: 0.055, b: 0.09, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      const halfWidth = Math.floor(gpu.context.canvas.width / 2);
      pass.setViewport(0, 0, halfWidth, gpu.context.canvas.height, 0, 1);
      pass.setPipeline(autoPipeline);
      pass.setBindGroup(0, autoBindGroup);
      pass.draw(3);
      pass.setViewport(halfWidth, 0, gpu.context.canvas.width - halfWidth, gpu.context.canvas.height, 0, 1);
      pass.setPipeline(explicitPipeline);
      pass.setBindGroup(0, explicitBindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    render();
    const resizeObserver = new ResizeObserver(() => {
      syncApiViewport(host, stage);
      gpu.resize();
    });
    resizeObserver.observe(host);

    setStatus({
      title: "Pipeline layout 对照已就绪",
      detail: "auto layout 与显式 bindGroupLayout / pipelineLayout 使用同一组资源并排渲染。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      uniformBuffer.destroy();
      paletteBuffer.destroy();
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
