import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-61-storage-textures-and-compute-writeback/storage-texture.compute.wgsl?raw";
import renderShaderSource from "@/lessons/lesson-61-storage-textures-and-compute-writeback/storage-texture.render.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const textureSize = 256;
const storageTextureFormat: GPUTextureFormat = "rgba8unorm";

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

export async function mountStorageTexturesAndComputeWritebackLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--storage">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Storage texture compute write preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>compute pass writes a texture, render pass samples it</strong>
            <span>texture_storage_2d + textureStore -> texture_2d + textureSample</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <button data-pattern type="button">Pattern: waves</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>storage format</span><strong>${storageTextureFormat}</strong></article>
          <article class="webgpu-api-metric"><span>texture size</span><strong>${textureSize} x ${textureSize}</strong></article>
          <article class="webgpu-api-metric"><span>workgroups</span><strong>${Math.ceil(textureSize / 8)} x ${Math.ceil(textureSize / 8)}</strong></article>
          <article class="webgpu-api-metric"><span>usage flags</span><strong>STORAGE + SAMPLE</strong></article>
        </div>
        <div class="webgpu-api-note">同一张 GPUTexture 先以 storage texture 身份被 compute 写入，再以 sampled texture 身份进入 render pass。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const patternButton = host.querySelector<HTMLButtonElement>("[data-pattern]");
  if (!canvas || !stage || !patternButton) {
    throw new Error("Storage texture lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const computeModule = gpu.device.createShaderModule({ code: computeShaderSource });
    const renderModule = gpu.device.createShaderModule({ code: renderShaderSource });
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-27-storage-texture-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const storageTexture = gpu.device.createTexture({
      label: "lesson-27-compute-written-storage-texture",
      size: [textureSize, textureSize],
      format: storageTextureFormat,
      usage:
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_SRC,
    });
    const sampler = gpu.device.createSampler({
      label: "lesson-27-storage-texture-sampler",
      magFilter: "linear",
      minFilter: "linear",
    });
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-27-storage-texture-compute-pipeline",
      layout: "auto",
      compute: { module: computeModule, entryPoint: "csMain" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-27-storage-texture-render-pipeline",
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vsMain" },
      fragment: {
        module: renderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const computeBindGroup = gpu.device.createBindGroup({
      label: "lesson-27-storage-texture-compute-bind-group",
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: storageTexture.createView() },
        { binding: 1, resource: { buffer: uniformBuffer } },
      ],
    });
    const renderBindGroup = gpu.device.createBindGroup({
      label: "lesson-27-storage-texture-render-bind-group",
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: storageTexture.createView() },
      ],
    });

    const patternLabels = ["waves", "checker", "rings"];
    let patternIndex = 0;
    let animationFrame = 0;
    const start = performance.now();
    patternButton.addEventListener("click", () => {
      patternIndex = (patternIndex + 1) % patternLabels.length;
      patternButton.textContent = `Pattern: ${patternLabels[patternIndex]}`;
    });

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const time = (performance.now() - start) / 1000;
      gpu.device.queue.writeBuffer(
        uniformBuffer,
        0,
        new Float32Array([time, textureSize, textureSize, patternIndex / 2])
      );

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-27-command-encoder",
      });
      const computePass = commandEncoder.beginComputePass({
        label: "lesson-27-write-storage-texture-pass",
      });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(textureSize / 8), Math.ceil(textureSize / 8));
      computePass.end();

      const renderPass = commandEncoder.beginRenderPass({
        label: "lesson-27-sample-storage-texture-pass",
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
      renderPass.setBindGroup(0, renderBindGroup);
      renderPass.draw(3);
      renderPass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Storage Texture 已就绪",
      detail: "Compute 正在写入 storage texture，Render pass 正在采样同一张纹理。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      uniformBuffer.destroy();
      storageTexture.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
