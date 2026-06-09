import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-56-storage-buffer-read-write-and-runtime-sized-arrays/storage-buffer.compute.wgsl?raw";
import renderShaderSource from "@/lessons/lesson-56-storage-buffer-read-write-and-runtime-sized-arrays/storage-buffer.render.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const ELEMENT_COUNT = 64;

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

function createInputData(seed: number) {
  const data = new Float32Array(ELEMENT_COUNT);
  for (let i = 0; i < ELEMENT_COUNT; i += 1) {
    data[i] = 0.5 + 0.5 * Math.sin(i * 0.41 + seed * 0.73);
  }
  return data;
}

function createStorageBuffer(device: GPUDevice, label: string, data: Float32Array, usage: GPUBufferUsageFlags) {
  const buffer = device.createBuffer({
    label,
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });
  new Float32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

export async function mountStorageBufferReadWriteAndRuntimeSizedArraysLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--storage-buffer">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Storage buffer read write preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>storage buffer read -> read_write -> render</strong>
            <span>compute 用 runtime-sized array 写结果，render pass 再以 read-only storage buffer 消费。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <button type="button" data-run>重新生成 input 并 dispatch</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>arrayLength()</span><strong>${ELEMENT_COUNT}</strong></article>
          <article class="webgpu-api-metric"><span>storage modes</span><strong>read / read_write</strong></article>
          <article class="webgpu-api-metric"><span>readback</span><strong data-validation>pending</strong></article>
          <article class="webgpu-api-metric"><span>checksum</span><strong data-checksum>0.000</strong></article>
        </div>
        <div class="webgpu-api-note">runtime-sized array 的长度来自 buffer binding size；shader 通过 arrayLength(&input.values) 做越界保护。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const runButton = host.querySelector<HTMLButtonElement>("[data-run]");
  const validationValue = host.querySelector<HTMLElement>("[data-validation]");
  const checksumValue = host.querySelector<HTMLElement>("[data-checksum]");
  if (!canvas || !stage || !runButton || !validationValue || !checksumValue) {
    throw new Error("Storage buffer lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const computeModule = gpu.device.createShaderModule({ label: "lesson-46-storage-compute-shader", code: computeShaderSource });
    const renderModule = gpu.device.createShaderModule({ label: "lesson-46-storage-render-shader", code: renderShaderSource });
    let inputBuffer = createStorageBuffer(
      gpu.device,
      "lesson-46-input-storage-buffer",
      createInputData(0),
      GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    );
    const outputBuffer = gpu.device.createBuffer({
      label: "lesson-46-output-runtime-array-buffer",
      size: ELEMENT_COUNT * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const readbackBuffer = gpu.device.createBuffer({
      label: "lesson-46-readback-buffer",
      size: ELEMENT_COUNT * 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-46-storage-buffer-compute-pipeline",
      layout: "auto",
      compute: { module: computeModule, entryPoint: "csMain" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-46-storage-buffer-render-pipeline",
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vsMain" },
      fragment: { module: renderModule, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    let computeBindGroup = gpu.device.createBindGroup({
      label: "lesson-46-storage-compute-bind-group",
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
      ],
    });
    const renderBindGroup = gpu.device.createBindGroup({
      label: "lesson-46-storage-render-bind-group",
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: outputBuffer } }],
    });

    const drawResult = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-46-render-only-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(renderPipeline);
      pass.setBindGroup(0, renderBindGroup);
      pass.draw(6, ELEMENT_COUNT);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    let seed = 0;
    let busy = false;
    const runCompute = async () => {
      if (busy) return;
      busy = true;
      seed += 1;
      inputBuffer.destroy();
      inputBuffer = createStorageBuffer(
        gpu.device,
        "lesson-46-input-storage-buffer",
        createInputData(seed),
        GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      );
      computeBindGroup = gpu.device.createBindGroup({
        label: "lesson-46-storage-compute-bind-group",
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputBuffer } },
          { binding: 1, resource: { buffer: outputBuffer } },
        ],
      });
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-46-compute-render-copy-encoder" });
      const computePass = encoder.beginComputePass({ label: "lesson-46-storage-write-pass" });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(ELEMENT_COUNT / 64));
      computePass.end();
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, renderBindGroup);
      renderPass.draw(6, ELEMENT_COUNT);
      renderPass.end();
      encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, ELEMENT_COUNT * 16);
      gpu.device.queue.submit([encoder.finish()]);
      await gpu.device.queue.onSubmittedWorkDone();
      await readbackBuffer.mapAsync(GPUMapMode.READ);
      const snapshot = new Float32Array(readbackBuffer.getMappedRange());
      let checksum = 0;
      for (let i = 0; i < ELEMENT_COUNT; i += 1) checksum += snapshot[i * 4 + 1];
      readbackBuffer.unmap();
      checksumValue.textContent = checksum.toFixed(3);
      validationValue.textContent = checksum > 0 ? "ok" : "check";
      busy = false;
    };

    runButton.addEventListener("click", () => void runCompute());
    await runCompute();
    const resizeObserver = new ResizeObserver(drawResult);
    resizeObserver.observe(host);
    setStatus({
      title: "Storage buffer runtime array 已就绪",
      detail: "Compute 写 read_write storage buffer，render pass 正在读取同一份结果。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      inputBuffer.destroy();
      outputBuffer.destroy();
      readbackBuffer.destroy();
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
