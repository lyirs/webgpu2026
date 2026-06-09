import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-34-async-pipelines-and-pipeline-layout-reuse/async-pipelines.compute.wgsl?raw";
import shaderSource from "@/lessons/lesson-34-async-pipelines-and-pipeline-layout-reuse/async-pipelines.wgsl?raw";

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

function nowMs() {
  return performance.now();
}

export async function mountAsyncPipelinesAndPipelineLayoutReuseLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Async pipeline preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>sync pipeline / async pipeline</strong>
            <span>两个 render pipeline 与一个 compute pipeline 复用同一个 pipelineLayout</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>sync render pipeline</span><strong data-sync>pending</strong></article>
          <article class="webgpu-api-metric"><span>async render pipeline</span><strong data-async-render>pending</strong></article>
          <article class="webgpu-api-metric"><span>async compute pipeline</span><strong data-async-compute>pending</strong></article>
          <article class="webgpu-api-metric"><span>pipelineLayout</span><strong>shared</strong></article>
        </div>
        <div class="webgpu-api-note">Async pipeline 创建让复杂管线可以提前预热；资源布局仍然由同一个 explicit pipelineLayout 约束。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const syncLabel = host.querySelector<HTMLElement>("[data-sync]");
  const asyncRenderLabel = host.querySelector<HTMLElement>("[data-async-render]");
  const asyncComputeLabel = host.querySelector<HTMLElement>("[data-async-compute]");
  if (!canvas || !stage || !syncLabel || !asyncRenderLabel || !asyncComputeLabel) {
    throw new Error("Async pipeline lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const syncUniformBuffer = gpu.device.createBuffer({
      label: "lesson-14-sync-frame-uniforms",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const asyncUniformBuffer = gpu.device.createBuffer({
      label: "lesson-14-async-frame-uniforms",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-14-shared-bind-group-layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const pipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-14-shared-pipeline-layout",
      bindGroupLayouts: [bindGroupLayout],
    });
    const renderModule = gpu.device.createShaderModule({ code: shaderSource });
    const computeModule = gpu.device.createShaderModule({ code: computeShaderSource });

    const syncStart = nowMs();
    const syncPipeline = gpu.device.createRenderPipeline({
      label: "lesson-14-sync-render-pipeline",
      layout: pipelineLayout,
      vertex: { module: renderModule, entryPoint: "vsMain" },
      fragment: {
        module: renderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    syncLabel.textContent = `${(nowMs() - syncStart).toFixed(2)} ms`;

    const asyncRenderStart = nowMs();
    const asyncPipeline = await gpu.device.createRenderPipelineAsync({
      label: "lesson-14-async-render-pipeline",
      layout: pipelineLayout,
      vertex: { module: renderModule, entryPoint: "vsMain" },
      fragment: {
        module: renderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    asyncRenderLabel.textContent = `${(nowMs() - asyncRenderStart).toFixed(2)} ms`;

    const asyncComputeStart = nowMs();
    await gpu.device.createComputePipelineAsync({
      label: "lesson-14-async-compute-pipeline",
      layout: "auto",
      compute: { module: computeModule, entryPoint: "csMain" },
    });
    asyncComputeLabel.textContent = `${(nowMs() - asyncComputeStart).toFixed(2)} ms`;

    const syncBindGroup = gpu.device.createBindGroup({
      label: "lesson-14-sync-bind-group",
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: syncUniformBuffer } }],
    });
    const asyncBindGroup = gpu.device.createBindGroup({
      label: "lesson-14-async-bind-group",
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: asyncUniformBuffer } }],
    });

    let frame = 0;
    let animationFrame = 0;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      frame += 1;

      gpu.device.queue.writeBuffer(syncUniformBuffer, 0, new Float32Array([frame * 0.018, 0, 0, 0]));
      gpu.device.queue.writeBuffer(asyncUniformBuffer, 0, new Float32Array([frame * 0.018, 1, 0, 0]));

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-14-command-encoder",
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.028, g: 0.043, b: 0.073, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      const halfWidth = Math.floor(gpu.context.canvas.width / 2);
      pass.setViewport(0, 0, halfWidth, gpu.context.canvas.height, 0, 1);
      pass.setPipeline(syncPipeline);
      pass.setBindGroup(0, syncBindGroup);
      pass.draw(6);
      pass.setViewport(halfWidth, 0, gpu.context.canvas.width - halfWidth, gpu.context.canvas.height, 0, 1);
      pass.setPipeline(asyncPipeline);
      pass.setBindGroup(0, asyncBindGroup);
      pass.draw(6);
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
      title: "Async pipeline 已就绪",
      detail: "同步与异步创建的 pipeline 正在复用同一个 explicit pipelineLayout。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      syncUniformBuffer.destroy();
      asyncUniformBuffer.destroy();
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
