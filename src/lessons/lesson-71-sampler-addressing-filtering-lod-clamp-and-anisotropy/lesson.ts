import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-71-sampler-addressing-filtering-lod-clamp-and-anisotropy/sampler-state.wgsl?raw";

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

function makeMipData(size: number, level: number) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const cell = 1 << Math.max(1, 4 - level);
      const checker = ((x / cell) | 0) ^ ((y / cell) | 0);
      data[offset + 0] = checker ? 240 - level * 35 : 25 + level * 40;
      data[offset + 1] = checker ? 190 - level * 18 : 85 + level * 25;
      data[offset + 2] = checker ? 70 + level * 32 : 210 - level * 20;
      data[offset + 3] = 255;
    }
  }
  return data;
}

export async function mountSamplerAddressingFilteringLodClampAndAnisotropyLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Sampler state preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>Sampler descriptor</strong>
            <span>repeat/nearest、clamp/linear、LOD clamp、anisotropy/fallback 四种采样状态同屏对照。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>address mode</span><strong>repeat / clamp</strong></article>
          <article class="webgpu-api-metric"><span>filtering</span><strong>nearest / linear</strong></article>
          <article class="webgpu-api-metric"><span>LOD clamp</span><strong>1.0 - 3.0</strong></article>
          <article class="webgpu-api-metric"><span>maxAnisotropy</span><strong data-aniso>checking</strong></article>
        </div>
        <div class="webgpu-api-note">各 panel 采样同一张 mip texture；差异只来自 sampler descriptor，而不是换了贴图。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const anisoLabel = host.querySelector<HTMLElement>("[data-aniso]");
  if (!canvas || !stage || !anisoLabel) {
    throw new Error("Sampler state lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const textureSize = 128;
    const mipLevelCount = 5;
    const texture = gpu.device.createTexture({
      label: "lesson-49-mip-texture",
      size: { width: textureSize, height: textureSize },
      mipLevelCount,
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    for (let level = 0; level < mipLevelCount; level += 1) {
      const size = textureSize >> level;
      gpu.device.queue.writeTexture(
        { texture, mipLevel: level },
        makeMipData(size, level),
        { bytesPerRow: size * 4, rowsPerImage: size },
        { width: size, height: size }
      );
    }

    const repeatNearestSampler = gpu.device.createSampler({
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "nearest",
      minFilter: "nearest",
      mipmapFilter: "nearest",
    });
    const clampLinearSampler = gpu.device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
    });
    const lodClampSampler = gpu.device.createSampler({
      addressModeU: "repeat",
      addressModeV: "repeat",
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      lodMinClamp: 1,
      lodMaxClamp: 3,
    });

    let anisotropicSampler = lodClampSampler;
    let anisotropyState = "fallback";
    await gpu.device.pushErrorScope("validation");
    try {
      const descriptor: GPUSamplerDescriptor & { maxAnisotropy?: number } = {
        addressModeU: "repeat",
        addressModeV: "repeat",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
        maxAnisotropy: 8,
      };
      anisotropicSampler = gpu.device.createSampler(descriptor);
      anisotropyState = "requested x8";
    } catch {
      anisotropicSampler = lodClampSampler;
    }
    const anisotropyError = await gpu.device.popErrorScope();
    if (anisotropyError) {
      anisotropicSampler = lodClampSampler;
      anisotropyState = "fallback";
    }
    anisoLabel.textContent = anisotropyState;

    const module = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-49-sampler-state-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-49-sampler-state-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: repeatNearestSampler },
        { binding: 2, resource: clampLinearSampler },
        { binding: 3, resource: lodClampSampler },
        { binding: 4, resource: anisotropicSampler },
      ],
    });

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-49-command-encoder" });
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
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Sampler state 已就绪",
      detail: "address mode、filter、LOD clamp 与 anisotropy/fallback 已同屏对照。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
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
