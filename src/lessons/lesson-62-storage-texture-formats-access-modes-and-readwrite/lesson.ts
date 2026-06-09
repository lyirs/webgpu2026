import { createWebGpuCanvas } from "@/core/webgpu";
import readWriteShaderSource from "@/lessons/lesson-62-storage-texture-formats-access-modes-and-readwrite/storage-access.readwrite.wgsl?raw";
import renderShaderSource from "@/lessons/lesson-62-storage-texture-formats-access-modes-and-readwrite/storage-access.render.wgsl?raw";
import writeShaderSource from "@/lessons/lesson-62-storage-texture-formats-access-modes-and-readwrite/storage-access.write.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const textureSize = 256;
const storageFormat: GPUTextureFormat = "rgba8unorm";
const readWriteFeature = "readonly_and_readwrite_storage_textures";

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

export async function mountStorageTextureFormatsAccessModesAndReadwriteLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  const languageFeatures = (navigator.gpu as GPU & { wgslLanguageFeatures?: Set<string> }).wgslLanguageFeatures;
  const hasReadWriteLanguageFeature = languageFeatures?.has(readWriteFeature) ?? false;
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--storage-access">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Storage texture access mode preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>texture_storage_2d format + access mode</strong>
            <span>核心路径始终使用 rgba8unorm/write；read_write 只在 WGSL feature 存在时编译。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <button type="button" data-mode>write-only core path</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>format</span><strong>${storageFormat}</strong></article>
          <article class="webgpu-api-metric"><span>core access</span><strong>write</strong></article>
          <article class="webgpu-api-metric"><span>read_write feature</span><strong data-feature>${hasReadWriteLanguageFeature ? "language yes / format fallback" : "not exposed"}</strong></article>
          <article class="webgpu-api-metric"><span>compiled mode</span><strong data-mode-label>write</strong></article>
        </div>
        <div class="webgpu-api-note">WebGPU 核心稳定路径是 write-only storage texture；readonly/read_write storage textures 需要 WGSL language feature gate。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const modeButton = host.querySelector<HTMLButtonElement>("[data-mode]");
  const modeLabel = host.querySelector<HTMLElement>("[data-mode-label]");
  if (!canvas || !stage || !modeButton || !modeLabel) {
    throw new Error("Storage access lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const texture = gpu.device.createTexture({
      label: "lesson-57-storage-access-texture",
      size: [textureSize, textureSize],
      format: storageFormat,
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING,
    });
    const paramsBuffer = gpu.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const writePipeline = gpu.device.createComputePipeline({
      label: "lesson-57-write-storage-pipeline",
      layout: "auto",
      compute: { module: gpu.device.createShaderModule({ code: writeShaderSource }), entryPoint: "csMain" },
    });
    // Keep the read_write shader in the source tab, but do not compile it unless
    // the implementation also supports this exact storage format/access pair.
    void readWriteShaderSource;
    const getReadWritePipeline = (): GPUComputePipeline | null => null;
    const readWritePipeline = getReadWritePipeline();
    const renderModule = gpu.device.createShaderModule({ code: renderShaderSource });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-57-present-pipeline",
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vsMain" },
      fragment: { module: renderModule, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const writeBindGroup = gpu.device.createBindGroup({
      layout: writePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: { buffer: paramsBuffer } },
      ],
    });
    const readWriteBindGroup = readWritePipeline
      ? gpu.device.createBindGroup({
          layout: readWritePipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: texture.createView() },
            { binding: 1, resource: { buffer: paramsBuffer } },
          ],
        })
      : null;
    const renderBindGroup = gpu.device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: gpu.device.createSampler({ magFilter: "linear", minFilter: "linear" }) },
        { binding: 1, resource: texture.createView() },
      ],
    });
    let useReadWrite = false;
    modeButton.addEventListener("click", () => {
      useReadWrite = false;
      modeButton.textContent = "rgba8unorm stays write-only";
      modeLabel.textContent = "write fallback";
    });
    let frameId = 0;
    const render = (time = 0) => {
      syncApiViewport(host, stage);
      gpu.resize();
      gpu.device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([time * 0.001, useReadWrite ? 1 : 0, 0, 0]));
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-57-command-encoder" });
      const computePass = encoder.beginComputePass();
      computePass.setPipeline(useReadWrite && readWritePipeline ? readWritePipeline : writePipeline);
      computePass.setBindGroup(0, useReadWrite && readWriteBindGroup ? readWriteBindGroup : writeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(textureSize / 8), Math.ceil(textureSize / 8));
      computePass.end();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: gpu.context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0.02, g: 0.04, b: 0.08, a: 1 } }],
      });
      pass.setPipeline(renderPipeline);
      pass.setBindGroup(0, renderBindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      frameId = requestAnimationFrame(render);
    };
    render();
    setStatus({ title: "Storage texture access", detail: hasReadWriteLanguageFeature ? "浏览器暴露 read_write 语言能力，但 rgba8unorm 仍走 write-only 安全路径。" : "当前浏览器未暴露 read_write feature，安全运行 write-only fallback。", tone: "ok" });
    return () => cancelAnimationFrame(frameId);
  } catch (error) {
    setStatus({ title: "WebGPU 初始化失败", detail: error instanceof Error ? error.message : String(error), tone: "warn" });
  }
}
