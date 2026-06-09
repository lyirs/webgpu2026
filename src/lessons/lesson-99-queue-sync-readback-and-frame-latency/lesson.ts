import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-99-queue-sync-readback-and-frame-latency/queue-latency.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type ReadbackSlot = {
  buffer: GPUBuffer;
  pending: boolean;
  destroyRequested: boolean;
  destroyed: boolean;
  frame: number;
};

const slotCount = 24;
const readbackRingSize = 3;
const timelineBytes = slotCount * 16;

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

export async function mountQueueSyncReadbackAndFrameLatencyLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Queue readback latency timeline"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>submit now, consume readback later</strong>
            <span>copyBufferToBuffer + mapAsync + queue.onSubmittedWorkDone</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <label>Readback every <input data-readback-every type="range" min="2" max="12" step="1" value="4"></label>
        </div>
        <div class="webgpu-api-timeline">
          <span class="webgpu-api-step">compute writes frame data</span>
          <span class="webgpu-api-step">render consumes immediately</span>
          <span class="webgpu-api-step">copy to readback ring</span>
          <span class="webgpu-api-step">queue.onSubmittedWorkDone()</span>
          <span class="webgpu-api-step">mapAsync later</span>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>submitted frame</span><strong data-submitted>0</strong></article>
          <article class="webgpu-api-metric"><span>last readback frame</span><strong data-completed>pending</strong></article>
          <article class="webgpu-api-metric"><span>readback age</span><strong data-age>pending</strong></article>
          <article class="webgpu-api-metric"><span>pending maps</span><strong data-pending>0</strong></article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const readbackEveryInput = host.querySelector<HTMLInputElement>("[data-readback-every]");
  const submittedLabel = host.querySelector<HTMLElement>("[data-submitted]");
  const completedLabel = host.querySelector<HTMLElement>("[data-completed]");
  const ageLabel = host.querySelector<HTMLElement>("[data-age]");
  const pendingLabel = host.querySelector<HTMLElement>("[data-pending]");
  if (!canvas || !stage || !readbackEveryInput || !submittedLabel || !completedLabel || !ageLabel || !pendingLabel) {
    throw new Error("Queue latency lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const timelineBuffer = gpu.device.createBuffer({
      label: "lesson-55-timeline-storage",
      size: timelineBytes,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-55-queue-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const readbackSlots: ReadbackSlot[] = Array.from({ length: readbackRingSize }, (_, index) => ({
      buffer: gpu.device.createBuffer({
        label: `lesson-55-readback-slot-${index}`,
        size: timelineBytes,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      }),
      pending: false,
      destroyRequested: false,
      destroyed: false,
      frame: -1,
    }));
    const bindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-55-bind-group-layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    const pipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-55-pipeline-layout",
      bindGroupLayouts: [bindGroupLayout],
    });
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-55-compute-pipeline",
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: "csMain" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-55-render-pipeline",
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-55-bind-group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: timelineBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
      ],
    });

    let frame = 0;
    let animationFrame = 0;
    let disposed = false;
    const refreshPending = () => {
      pendingLabel.textContent = `${readbackSlots.filter((slot) => slot.pending).length}`;
    };
    const destroyReadbackSlot = (slot: ReadbackSlot) => {
      slot.destroyRequested = true;
      if (!slot.pending && !slot.destroyed) {
        slot.buffer.destroy();
        slot.destroyed = true;
      }
    };
    const consumeReadback = async (slot: ReadbackSlot) => {
      slot.pending = true;
      refreshPending();
      let mapped = false;
      try {
        await gpu.device.queue.onSubmittedWorkDone();
        await slot.buffer.mapAsync(GPUMapMode.READ);
        mapped = true;
        if (disposed) {
          return;
        }
        const snapshot = new Float32Array(slot.buffer.getMappedRange().slice(0));
        const checksum = snapshot.reduce((total, value) => total + value, 0);
        slot.buffer.unmap();
        mapped = false;
        completedLabel.textContent = `${slot.frame}`;
        ageLabel.textContent = `${Math.max(0, frame - slot.frame)} frames / ${checksum.toFixed(1)}`;
      } catch {
        // Route changes can destroy MAP_READ buffers while a readback is pending.
      } finally {
        if (mapped) {
          slot.buffer.unmap();
        }
        slot.pending = false;
        if (slot.destroyRequested) {
          destroyReadbackSlot(slot);
        }
        if (!disposed) {
          refreshPending();
        }
      }
    };

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      frame += 1;
      const readbackEvery = Number(readbackEveryInput.value);
      submittedLabel.textContent = `${frame}`;
      gpu.device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([frame, slotCount, readbackEvery, 0]));

      const commandEncoder = gpu.device.createCommandEncoder({ label: "lesson-55-command-encoder" });
      const computePass = commandEncoder.beginComputePass({ label: "lesson-55-compute-pass" });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(Math.ceil(slotCount / 8));
      computePass.end();

      const renderPass = commandEncoder.beginRenderPass({
        label: "lesson-55-render-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(3);
      renderPass.end();

      const shouldReadback = frame % readbackEvery === 0;
      const readbackSlot = readbackSlots[frame % readbackRingSize];
      if (shouldReadback && !readbackSlot.pending) {
        readbackSlot.frame = frame;
        commandEncoder.copyBufferToBuffer(timelineBuffer, 0, readbackSlot.buffer, 0, timelineBytes);
      }
      gpu.device.queue.submit([commandEncoder.finish()]);
      if (shouldReadback && !readbackSlot.pending) {
        void consumeReadback(readbackSlot);
      }
      animationFrame = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Queue readback 已就绪",
      detail: "GPU 结果会经过 readback ring 延迟回到 CPU，画面不会等待 mapAsync。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      timelineBuffer.destroy();
      uniformBuffer.destroy();
      readbackSlots.forEach(destroyReadbackSlot);
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
