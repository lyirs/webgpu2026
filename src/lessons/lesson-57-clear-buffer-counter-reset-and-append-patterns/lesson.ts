import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-57-clear-buffer-counter-reset-and-append-patterns/clear-buffer.compute.wgsl?raw";
import renderShaderSource from "@/lessons/lesson-57-clear-buffer-counter-reset-and-append-patterns/clear-buffer.render.wgsl?raw";

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

export async function mountClearBufferCounterResetAndAppendPatternsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--clear-buffer">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="clearBuffer counter reset preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>append counter: uncleared vs clearBuffer()</strong>
            <span>左侧 counter 累积增长；右侧每帧先 clearBuffer(counter + 4, 4) 再 append。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>uncleared counter</span><strong data-left>0</strong></article>
          <article class="webgpu-api-metric"><span>cleared counter</span><strong data-right>0</strong></article>
          <article class="webgpu-api-metric"><span>clear range</span><strong data-range>offset 4 / size 4</strong></article>
          <article class="webgpu-api-metric"><span>validation</span><strong data-validation>waiting</strong></article>
        </div>
        <div class="webgpu-api-note">append/atomic counter 常常需要每帧 reset；clearBuffer 是最直接的 GPU 侧清零路径。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const leftLabel = host.querySelector<HTMLElement>("[data-left]");
  const rightLabel = host.querySelector<HTMLElement>("[data-right]");
  const validationLabel = host.querySelector<HTMLElement>("[data-validation]");
  if (!canvas || !stage || !leftLabel || !rightLabel || !validationLabel) {
    throw new Error("clearBuffer lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const counterBuffer = gpu.device.createBuffer({
      label: "lesson-57-append-counters",
      size: 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const readbackBuffer = gpu.device.createBuffer({
      label: "lesson-57-counter-readback",
      size: 8,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const displayBuffer = gpu.device.createBuffer({
      label: "lesson-57-counter-display-uniform",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const computeModule = gpu.device.createShaderModule({ code: computeShaderSource });
    const renderModule = gpu.device.createShaderModule({ code: renderShaderSource });
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-57-clear-buffer-compute-pipeline",
      layout: "auto",
      compute: { module: computeModule, entryPoint: "csMain" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-57-clear-buffer-render-pipeline",
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vsMain" },
      fragment: { module: renderModule, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const computeBindGroup = gpu.device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: counterBuffer } }],
    });
    const renderBindGroup = gpu.device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: displayBuffer } }],
    });

    let frameId = 0;
    let readbackBusy = false;
    let disposed = false;
    let latestLeft = 0;
    let latestRight = 0;

    const scheduleReadback = async () => {
      if (readbackBusy || disposed) return;
      readbackBusy = true;
      try {
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        if (disposed) {
          readbackBuffer.unmap();
          return;
        }
        const values = new Uint32Array(readbackBuffer.getMappedRange().slice(0));
        readbackBuffer.unmap();
        latestLeft = values[0];
        latestRight = values[1];
        leftLabel.textContent = `${latestLeft}`;
        rightLabel.textContent = `${latestRight}`;
        validationLabel.textContent = latestRight === 64 ? "right reset ok" : "checking";
      } catch {
        if (!disposed) {
          validationLabel.textContent = "readback delayed";
        }
      } finally {
        readbackBusy = false;
      }
    };

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      gpu.device.queue.writeBuffer(
        displayBuffer,
        0,
        new Float32Array([latestLeft, latestRight, Math.max(256, latestLeft), 0])
      );

      const encoder = gpu.device.createCommandEncoder({ label: "lesson-57-command-encoder" });
      encoder.clearBuffer(counterBuffer, 4, 4);
      const computePass = encoder.beginComputePass({ label: "lesson-57-append-pass" });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(1);
      computePass.end();
      if (!readbackBusy) {
        encoder.copyBufferToBuffer(counterBuffer, 0, readbackBuffer, 0, 8);
      }

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.03, b: 0.052, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(renderPipeline);
      pass.setBindGroup(0, renderBindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      void scheduleReadback();
      frameId = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "clearBuffer counter reset 已就绪",
      detail: "右侧 append counter 每帧由 commandEncoder.clearBuffer() 重置，左侧保留累积对照。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      counterBuffer.destroy();
      readbackBuffer.destroy();
      displayBuffer.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
