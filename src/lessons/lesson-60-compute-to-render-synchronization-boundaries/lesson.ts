import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-60-compute-to-render-synchronization-boundaries/sync-boundary.compute.wgsl?raw";
import renderShaderSource from "@/lessons/lesson-60-compute-to-render-synchronization-boundaries/sync-boundary.render.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const cellCount = 64;

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

export async function mountComputeToRenderSynchronizationBoundariesLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--sync-boundary">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Compute to render synchronization boundary preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>compute pass writes, render pass reads</strong>
            <span>同一个 command buffer 内 pass 顺序就是同步边界；跨 submit readback 等 queue done。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <button type="button" data-run>提交 compute -> render -> copy</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>pass boundary</span><strong>compute -> render</strong></article>
          <article class="webgpu-api-metric"><span>submit boundary</span><strong>queue submit</strong></article>
          <article class="webgpu-api-metric"><span>readback sync</span><strong>onSubmittedWorkDone</strong></article>
          <article class="webgpu-api-metric"><span>checksum</span><strong data-checksum>pending</strong></article>
        </div>
        <div class="webgpu-api-note">WebGPU 没有手写 barrier API；同一 command buffer 里后面的 pass 可以读取前面 pass 写完的 buffer，CPU readback 才需要等待提交完成。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const runButton = host.querySelector<HTMLButtonElement>("[data-run]");
  const checksumValue = host.querySelector<HTMLElement>("[data-checksum]");
  if (!canvas || !stage || !runButton || !checksumValue) {
    throw new Error("Synchronization boundary lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const computeModule = gpu.device.createShaderModule({ label: "lesson-52-sync-compute-shader", code: computeShaderSource });
    const renderModule = gpu.device.createShaderModule({ label: "lesson-52-sync-render-shader", code: renderShaderSource });
    const paramsBuffer = gpu.device.createBuffer({
      label: "lesson-52-sync-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const cellsBuffer = gpu.device.createBuffer({
      label: "lesson-52-compute-written-cells",
      size: cellCount * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readbackBuffer = gpu.device.createBuffer({
      label: "lesson-52-readback-buffer",
      size: cellCount * 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-52-compute-pipeline",
      layout: "auto",
      compute: { module: computeModule, entryPoint: "csMain" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-52-render-pipeline",
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vsMain" },
      fragment: { module: renderModule, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const computeBindGroup = gpu.device.createBindGroup({
      label: "lesson-52-compute-bind-group",
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: cellsBuffer } },
      ],
    });
    const renderBindGroup = gpu.device.createBindGroup({
      label: "lesson-52-render-bind-group",
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: cellsBuffer } }],
    });

    let busy = false;
    const submitFrame = async () => {
      if (busy) return;
      busy = true;
      syncApiViewport(host, stage);
      gpu.resize();
      gpu.device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([0, cellCount, 0, 0]));
      gpu.device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([performance.now() * 0.001]));
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-52-command-encoder" });
      const computePass = encoder.beginComputePass({ label: "lesson-52-compute-pass" });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(cellCount / 64));
      computePass.end();
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
          view: gpu.context.getCurrentTexture().createView(),
          clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, renderBindGroup);
      renderPass.draw(6, cellCount);
      renderPass.end();
      encoder.copyBufferToBuffer(cellsBuffer, 0, readbackBuffer, 0, cellCount * 16);
      gpu.device.queue.submit([encoder.finish()]);
      await gpu.device.queue.onSubmittedWorkDone();
      await readbackBuffer.mapAsync(GPUMapMode.READ);
      const snapshot = new Float32Array(readbackBuffer.getMappedRange());
      let checksum = 0;
      for (let i = 0; i < cellCount; i += 1) checksum += snapshot[i * 4 + 2];
      readbackBuffer.unmap();
      checksumValue.textContent = checksum.toFixed(3);
      busy = false;
    };

    runButton.addEventListener("click", () => void submitFrame());
    await submitFrame();
    const resizeObserver = new ResizeObserver(() => void submitFrame());
    resizeObserver.observe(host);
    setStatus({ title: "Compute-to-render sync 已就绪", detail: "Compute 写入的 storage buffer 正在同一 command buffer 的 render pass 里被读取。", tone: "ok" });

    return () => {
      resizeObserver.disconnect();
      paramsBuffer.destroy();
      cellsBuffer.destroy();
      readbackBuffer.destroy();
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
