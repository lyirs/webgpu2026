import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-24-bind-group-entry-types-minbindingsize-and-compatibility/bind-compatibility.wgsl?raw";

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

function createBufferWithData(
  device: GPUDevice,
  label: string,
  data: Float32Array | Uint8Array,
  usage: GPUBufferUsageFlags
) {
  const buffer = device.createBuffer({
    label,
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  buffer.unmap();
  return buffer;
}

export async function mountBindGroupEntryTypesMinBindingSizeAndCompatibilityLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Bind group entry compatibility preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>Bind group compatibility</strong>
            <span>同一个 layout 同时约束 uniform、storage、sampler、texture；错误 minBindingSize 被 error scope 捕获。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>entries</span><strong>4 bindings</strong></article>
          <article class="webgpu-api-metric"><span>minBindingSize</span><strong>16 bytes</strong></article>
          <article class="webgpu-api-metric"><span>valid bind group</span><strong data-valid>ready</strong></article>
          <article class="webgpu-api-metric"><span>captured mismatch</span><strong data-error>pending</strong></article>
        </div>
        <div class="webgpu-api-resource-grid">
          <article class="webgpu-api-resource"><strong>binding(0)</strong><span>uniform buffer</span><em>minBindingSize: 16</em></article>
          <article class="webgpu-api-resource"><strong>binding(1)</strong><span>read-only storage</span><em>GPUBufferBindingType</em></article>
          <article class="webgpu-api-resource"><strong>binding(2)</strong><span>filtering sampler</span><em>sampler</em></article>
          <article class="webgpu-api-resource"><strong>binding(3)</strong><span>float texture</span><em>texture_2d&lt;f32&gt;</em></article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const errorLabel = host.querySelector<HTMLElement>("[data-error]");
  if (!canvas || !stage || !errorLabel) {
    throw new Error("Bind group compatibility lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ code: shaderSource });
    const bindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-16-explicit-bind-group-layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform", minBindingSize: 16 },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage", minBindingSize: 16 },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float", viewDimension: "2d" },
        },
      ],
    });
    const pipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-16-explicit-pipeline-layout",
      bindGroupLayouts: [bindGroupLayout],
    });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-16-bind-compatibility-pipeline",
      layout: pipelineLayout,
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });

    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-16-compatible-uniform-buffer",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const smallUniformBuffer = gpu.device.createBuffer({
      label: "lesson-16-too-small-uniform-buffer",
      size: 8,
      usage: GPUBufferUsage.UNIFORM,
    });
    const storageBuffer = createBufferWithData(
      gpu.device,
      "lesson-16-storage-buffer",
      new Float32Array([0.25, 0.58, 0.82, 0.46]),
      GPUBufferUsage.STORAGE
    );
    const texture = gpu.device.createTexture({
      label: "lesson-16-compatible-texture",
      size: { width: 2, height: 2 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    gpu.device.queue.writeTexture(
      { texture },
      new Uint8Array([
        30, 68, 110, 255, 70, 155, 210, 255,
        25, 110, 95, 255, 240, 150, 70, 255,
      ]),
      { bytesPerRow: 8, rowsPerImage: 2 },
      { width: 2, height: 2 }
    );
    const sampler = gpu.device.createSampler({ magFilter: "linear", minFilter: "linear" });

    await gpu.device.pushErrorScope("validation");
    try {
      gpu.device.createBindGroup({
        label: "lesson-16-captured-invalid-bind-group",
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: smallUniformBuffer } },
          { binding: 1, resource: { buffer: storageBuffer } },
          { binding: 2, resource: sampler },
          { binding: 3, resource: texture.createView() },
        ],
      });
    } catch {
      // Some implementations throw synchronously; popErrorScope below is still the teaching signal.
    }
    const capturedError = await gpu.device.popErrorScope();
    errorLabel.textContent = capturedError ? "captured" : "none";

    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-16-compatible-bind-group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: storageBuffer } },
        { binding: 2, resource: sampler },
        { binding: 3, resource: texture.createView() },
      ],
    });

    let frameId = 0;
    let disposed = false;
    const render = (timeMs = 0) => {
      if (disposed) {
        return;
      }
      syncApiViewport(host, stage);
      gpu.resize();
      gpu.device.queue.writeBuffer(
        uniformBuffer,
        0,
        new Float32Array([timeMs * 0.001, capturedError ? 1 : 0, 0, 0])
      );
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-16-bind-compatibility-encoder" });
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
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      frameId = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Bind group 兼容性已就绪",
      detail: "有效 bind group 正在渲染；minBindingSize mismatch 已被 validation error scope 捕获。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      uniformBuffer.destroy();
      smallUniformBuffer.destroy();
      storageBuffer.destroy();
      texture.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `
      <div class="preview-empty">
        <h3>预览不可用</h3>
        <p>${message}</p>
      </div>
    `;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
