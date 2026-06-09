import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-64-atomics-and-parallel-reduction/atomics-reduction.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const maxSamples = 2048;
const binCount = 16;
const displayBinCount = binCount + 1;
const maxValue = 255;

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

function createValues(seed: number) {
  const values = new Uint32Array(maxSamples);
  for (let index = 0; index < maxSamples; index += 1) {
    const wave = Math.sin(index * 12.9898 + seed * 0.071) * 43758.5453;
    const random = wave - Math.floor(wave);
    const biased = Math.pow(random, 1.6) * 255;
    values[index] = Math.max(0, Math.min(maxValue, Math.floor(biased + (index % 17))));
  }
  return values;
}

export async function mountAtomicsAndParallelReductionLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Atomic histogram and reduction preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>atomicAdd histogram + atomicMax reduction</strong>
            <span>很多线程同时写少量 counters，需要 atomic 保证不丢更新</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <label>Samples <input data-samples type="range" min="256" max="${maxSamples}" step="256" value="1024"></label>
          <label>Threshold <input data-threshold type="range" min="32" max="224" step="16" value="160"></label>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>histogram bins</span><strong>${binCount}</strong></article>
          <article class="webgpu-api-metric"><span>threshold count</span><strong data-threshold-count>pending</strong></article>
          <article class="webgpu-api-metric"><span>max value</span><strong data-max-value>pending</strong></article>
          <article class="webgpu-api-metric"><span>validation</span><strong data-validation>waiting</strong></article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const samplesInput = host.querySelector<HTMLInputElement>("[data-samples]");
  const thresholdInput = host.querySelector<HTMLInputElement>("[data-threshold]");
  const thresholdCountLabel = host.querySelector<HTMLElement>("[data-threshold-count]");
  const maxValueLabel = host.querySelector<HTMLElement>("[data-max-value]");
  const validationLabel = host.querySelector<HTMLElement>("[data-validation]");
  if (!canvas || !stage || !samplesInput || !thresholdInput || !thresholdCountLabel || !maxValueLabel || !validationLabel) {
    throw new Error("Atomics lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const valuesBuffer = gpu.device.createBuffer({
      label: "lesson-29-values",
      size: maxSamples * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const histogramBuffer = gpu.device.createBuffer({
      label: "lesson-29-atomic-histogram",
      size: binCount * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const summaryBuffer = gpu.device.createBuffer({
      label: "lesson-29-atomic-summary",
      size: 8,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const displayBuffer = gpu.device.createBuffer({
      label: "lesson-29-display-bins",
      size: displayBinCount * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readbackBuffer = gpu.device.createBuffer({
      label: "lesson-29-readback",
      size: displayBinCount * 16,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-29-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const zeroHistogram = new Uint32Array(binCount);
    const zeroSummary = new Uint32Array(2);

    const bindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-29-bind-group-layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: "storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    const pipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-29-pipeline-layout",
      bindGroupLayouts: [bindGroupLayout],
    });
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const accumulatePipeline = gpu.device.createComputePipeline({
      label: "lesson-29-accumulate-pipeline",
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: "csAccumulate" },
    });
    const normalizePipeline = gpu.device.createComputePipeline({
      label: "lesson-29-normalize-pipeline",
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: "csNormalize" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-29-render-pipeline",
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-29-bind-group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: valuesBuffer } },
        { binding: 1, resource: { buffer: histogramBuffer } },
        { binding: 2, resource: { buffer: summaryBuffer } },
        { binding: 3, resource: { buffer: displayBuffer } },
        { binding: 4, resource: { buffer: uniformBuffer } },
      ],
    });

    let animationFrame = 0;
    let frame = 0;
    let readbackPending = false;
    let disposed = false;
    let readbackDestroyRequested = false;
    let readbackDestroyed = false;
    const destroyReadbackBuffer = () => {
      readbackDestroyRequested = true;
      if (!readbackPending && !readbackDestroyed) {
        readbackBuffer.destroy();
        readbackDestroyed = true;
      }
    };
    const updateReadback = async (sampleCount: number, threshold: number) => {
      readbackPending = true;
      let mapped = false;
      try {
        await gpu.device.queue.onSubmittedWorkDone();
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        mapped = true;
        if (disposed) {
          return;
        }
        const snapshot = new Float32Array(readbackBuffer.getMappedRange().slice(0));
        const thresholdCount = snapshot[binCount * 4];
        const reducedMax = snapshot[binCount * 4 + 1];
        readbackBuffer.unmap();
        mapped = false;
        thresholdCountLabel.textContent = `${Math.round(thresholdCount)}`;
        maxValueLabel.textContent = `${Math.round(reducedMax)}`;
        validationLabel.textContent =
          thresholdCount >= 0 && reducedMax >= threshold ? `${sampleCount} samples ok` : "checking";
      } catch {
        // Lesson teardown can destroy the MAP_READ buffer while readback is pending.
      } finally {
        if (mapped) {
          readbackBuffer.unmap();
        }
        readbackPending = false;
        if (readbackDestroyRequested) {
          destroyReadbackBuffer();
        }
      }
    };

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      frame += 1;
      const sampleCount = Number(samplesInput.value);
      const threshold = Number(thresholdInput.value);
      gpu.device.queue.writeBuffer(valuesBuffer, 0, createValues(frame));
      gpu.device.queue.writeBuffer(histogramBuffer, 0, zeroHistogram);
      gpu.device.queue.writeBuffer(summaryBuffer, 0, zeroSummary);
      gpu.device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([sampleCount, threshold, binCount, maxValue]));

      const commandEncoder = gpu.device.createCommandEncoder({ label: "lesson-29-command-encoder" });
      const computePass = commandEncoder.beginComputePass({ label: "lesson-29-atomic-passes" });
      computePass.setPipeline(accumulatePipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(Math.ceil(sampleCount / 64));
      computePass.setPipeline(normalizePipeline);
      computePass.dispatchWorkgroups(1);
      computePass.end();

      const renderPass = commandEncoder.beginRenderPass({
        label: "lesson-29-present-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(3);
      renderPass.end();
      if (!readbackPending && frame % 12 === 0) {
        commandEncoder.copyBufferToBuffer(displayBuffer, 0, readbackBuffer, 0, displayBinCount * 16);
      }
      gpu.device.queue.submit([commandEncoder.finish()]);
      if (!readbackPending && frame % 12 === 0) {
        void updateReadback(sampleCount, threshold);
      }
      animationFrame = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Atomics 已就绪",
      detail: "GPU 正在用 atomicAdd 统计 histogram，并用 atomicMax 做并行 reduction。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      valuesBuffer.destroy();
      histogramBuffer.destroy();
      summaryBuffer.destroy();
      displayBuffer.destroy();
      destroyReadbackBuffer();
      uniformBuffer.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
