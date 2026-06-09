import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-26-buffer-binding-offset-size-and-range/buffer-range.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const recordSize = 32;

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

function alignTo(value: number, alignment: number) {
  return Math.ceil(value / alignment) * alignment;
}

export async function mountBufferBindingOffsetSizeAndRangeLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--buffer-range">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Buffer binding offset and size preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>resource: { buffer, offset, size }</strong>
            <span>同一块 uniform buffer 被切成多个 binding range；每个 bind group 只看自己的 record。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <button type="button" data-active>切换 active range</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>alignment</span><strong data-align>0</strong></article>
          <article class="webgpu-api-metric"><span>record stride</span><strong data-stride>0</strong></article>
          <article class="webgpu-api-metric"><span>active offset</span><strong data-offset>0</strong></article>
          <article class="webgpu-api-metric"><span>binding size</span><strong>${recordSize} bytes</strong></article>
        </div>
        <div class="webgpu-api-note">offset 必须满足 minUniformBufferOffsetAlignment；size 则定义 shader 能访问的 binding range，而不是总 buffer 大小。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const activeButton = host.querySelector<HTMLButtonElement>("[data-active]");
  const alignValue = host.querySelector<HTMLElement>("[data-align]");
  const strideValue = host.querySelector<HTMLElement>("[data-stride]");
  const offsetValue = host.querySelector<HTMLElement>("[data-offset]");
  if (!canvas || !stage || !activeButton || !alignValue || !strideValue || !offsetValue) {
    throw new Error("Buffer range lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const alignment = gpu.device.limits.minUniformBufferOffsetAlignment;
    const stride = alignTo(recordSize, alignment);
    const data = new ArrayBuffer(stride * 3);
    const floats = new Float32Array(data);
    const records = [
      { color: [0.26, 0.78, 1.0, 1.0], center: [-0.56, 0.0, 0.34, 0.34] },
      { color: [1.0, 0.66, 0.28, 1.0], center: [0.0, 0.0, 0.34, 0.34] },
      { color: [0.66, 1.0, 0.48, 1.0], center: [0.56, 0.0, 0.34, 0.34] },
    ];
    records.forEach((record, index) => {
      const base = (stride * index) / 4;
      floats.set(record.color, base);
      floats.set(record.center, base + 4);
    });
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-23-ranged-uniform-buffer",
      size: data.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(uniformBuffer, 0, data);
    const module = gpu.device.createShaderModule({ label: "lesson-23-buffer-range-shader", code: shaderSource });
    const bindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-23-range-layout",
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform", minBindingSize: recordSize },
      }],
    });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-23-buffer-range-pipeline",
      layout: gpu.device.createPipelineLayout({ label: "lesson-23-range-pipeline-layout", bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const bindGroups = records.map((_, index) => gpu.device.createBindGroup({
      label: `lesson-23-range-bind-group-${index}`,
      layout: bindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: uniformBuffer, offset: index * stride, size: recordSize } }],
    }));

    let activeIndex = 0;
    alignValue.textContent = `${alignment} bytes`;
    strideValue.textContent = `${stride} bytes`;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-23-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: gpu.context.getCurrentTexture().createView(),
          clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(pipeline);
      for (const bindGroup of bindGroups) {
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
      }
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      offsetValue.textContent = `${activeIndex * stride} bytes`;
      activeButton.textContent = `Active range: #${activeIndex}`;
    };
    activeButton.addEventListener("click", () => {
      activeIndex = (activeIndex + 1) % records.length;
      render();
    });
    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    setStatus({ title: "Buffer binding range 已就绪", detail: "同一 buffer 正在通过不同 offset/size range 喂给同一 layout。", tone: "ok" });

    return () => {
      resizeObserver.disconnect();
      uniformBuffer.destroy();
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
