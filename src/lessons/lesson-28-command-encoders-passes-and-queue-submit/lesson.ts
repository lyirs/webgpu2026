import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-28-command-encoders-passes-and-queue-submit/timeline.compute.wgsl?raw";
import renderShaderSource from "@/lessons/lesson-28-command-encoders-passes-and-queue-submit/timeline.render.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const stepCount = 16;
const stepStride = 16;

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

export async function mountCommandEncodersPassesAndQueueSubmitLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Command encoder timeline preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>compute pass -> render pass -> copy -> queue.submit</strong>
            <span>一个 command encoder 内串起多种 pass 和一次 readback</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-timeline">
          <span class="webgpu-api-step">createCommandEncoder</span>
          <span class="webgpu-api-step">beginComputePass</span>
          <span class="webgpu-api-step">beginRenderPass</span>
          <span class="webgpu-api-step">copyBufferToBuffer</span>
          <span class="webgpu-api-step">finish + queue.submit</span>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>storage bytes</span><strong>${stepCount * stepStride}</strong></article>
          <article class="webgpu-api-metric"><span>readback checksum</span><strong data-checksum>pending</strong></article>
          <article class="webgpu-api-metric"><span>passes encoded</span><strong>2 + copy</strong></article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const checksumLabel = host.querySelector<HTMLElement>("[data-checksum]");
  if (!canvas || !stage || !checksumLabel) {
    throw new Error("Command lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const timelineBuffer = gpu.device.createBuffer({
      label: "lesson-11-timeline-storage",
      size: stepCount * stepStride,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readbackBuffer = gpu.device.createBuffer({
      label: "lesson-11-timeline-readback",
      size: stepCount * stepStride,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const computeModule = gpu.device.createShaderModule({ code: computeShaderSource });
    const renderModule = gpu.device.createShaderModule({ code: renderShaderSource });
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-11-compute-pipeline",
      layout: "auto",
      compute: { module: computeModule, entryPoint: "csMain" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-11-render-pipeline",
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vsMain" },
      fragment: {
        module: renderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const computeBindGroup = gpu.device.createBindGroup({
      label: "lesson-11-compute-bind-group",
      layout: computePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: timelineBuffer } }],
    });
    const renderBindGroup = gpu.device.createBindGroup({
      label: "lesson-11-render-bind-group",
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: timelineBuffer } }],
    });

    const render = async () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-11-command-encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "lesson-11-compute-pass",
      });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(1);
      computePass.end();

      const renderPass = commandEncoder.beginRenderPass({
        label: "lesson-11-render-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.035, g: 0.055, b: 0.09, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, renderBindGroup);
      renderPass.draw(stepCount * 6);
      renderPass.end();

      commandEncoder.copyBufferToBuffer(
        timelineBuffer,
        0,
        readbackBuffer,
        0,
        stepCount * stepStride
      );
      gpu.device.queue.submit([commandEncoder.finish()]);
      await gpu.device.queue.onSubmittedWorkDone();

      await readbackBuffer.mapAsync(GPUMapMode.READ);
      const readback = new Float32Array(readbackBuffer.getMappedRange());
      const checksum = Array.from(readback).reduce((total, value) => total + value, 0);
      readbackBuffer.unmap();
      checksumLabel.textContent = checksum.toFixed(2);
    };

    await render();
    const resizeObserver = new ResizeObserver(() => {
      void render();
    });
    resizeObserver.observe(host);

    setStatus({
      title: "Command timeline 已就绪",
      detail: "同一个 command encoder 已串起 compute pass、render pass、copy 和 queue.submit。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      timelineBuffer.destroy();
      readbackBuffer.destroy();
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
