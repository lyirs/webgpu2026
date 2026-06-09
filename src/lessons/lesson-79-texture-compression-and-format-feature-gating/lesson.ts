import shaderSource from "@/lessons/lesson-79-texture-compression-and-format-feature-gating/compressed-format.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type CompressionRuntime = {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  resize: () => void;
  features: Set<string>;
  usingBc: boolean;
};

const textureSize = 16;
const compressedFeatureNames = [
  "texture-compression-bc",
  "texture-compression-etc2",
  "texture-compression-astc",
] as const;

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

function pack565(r: number, g: number, b: number) {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

function writeBc1Block(view: DataView, offset: number, color0: number, color1: number, pattern: number[]) {
  view.setUint16(offset, color0, true);
  view.setUint16(offset + 2, color1, true);
  let indices = 0;
  for (let i = 0; i < 16; i += 1) {
    indices |= (pattern[i] & 0x3) << (i * 2);
  }
  view.setUint32(offset + 4, indices, true);
}

function createBc1TextureData() {
  const bytesPerRow = 256;
  const blockRows = textureSize / 4;
  const blocksPerRow = textureSize / 4;
  const data = new Uint8Array(bytesPerRow * blockRows);
  const view = new DataView(data.buffer);
  const teal = pack565(24, 196, 174);
  const amber = pack565(248, 177, 78);
  const ink = pack565(24, 34, 56);
  const cream = pack565(252, 243, 202);
  for (let y = 0; y < blockRows; y += 1) {
    for (let x = 0; x < blocksPerRow; x += 1) {
      const offset = y * bytesPerRow + x * 8;
      const pattern = Array.from({ length: 16 }, (_, index) => (index + x + y) % 4);
      writeBc1Block(view, offset, (x + y) % 2 === 0 ? amber : teal, (x + y) % 2 === 0 ? ink : cream, pattern);
    }
  }
  return { data, bytesPerRow };
}

function createRgbaFallbackData() {
  const data = new Uint8Array(textureSize * textureSize * 4);
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const index = (y * textureSize + x) * 4;
      const checker = ((x >> 2) + (y >> 2)) % 2;
      data[index] = checker ? 245 : 28;
      data[index + 1] = checker ? 176 : 196;
      data[index + 2] = checker ? 79 : 174;
      data[index + 3] = 255;
    }
  }
  return data;
}

async function createCompressionRuntime(canvas: HTMLCanvasElement): Promise<CompressionRuntime> {
  if (!("gpu" in navigator)) {
    throw new Error("当前浏览器没有提供 WebGPU。");
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("没有拿到可用的 GPUAdapter。");
  }
  const supported = new Set(Array.from(adapter.features, (feature) => `${feature}`));
  const canUseBc = adapter.features.has("texture-compression-bc" as GPUFeatureName);
  let usingBc = canUseBc;
  let device: GPUDevice;
  try {
    device = await adapter.requestDevice({
      requiredFeatures: canUseBc ? ["texture-compression-bc" as GPUFeatureName] : [],
    });
  } catch {
    device = await adapter.requestDevice();
    usingBc = false;
  }
  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("没有拿到 WebGPUCanvasContext。");
  }
  const format = navigator.gpu.getPreferredCanvasFormat();
  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.configure({ device, format, alphaMode: "opaque" });
  };
  resize();
  return { device, context, format, resize, features: supported, usingBc };
}

export async function mountTextureCompressionAndFormatFeatureGatingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Compressed texture feature gating preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>feature gate before compressed formats</strong>
            <span>BC 可用时走 bc1-rgba-unorm，否则回退 rgba8unorm</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-resource-grid" data-feature-grid></div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>selected format</span><strong data-format>checking</strong></article>
          <article class="webgpu-api-metric"><span>requiredFeatures</span><strong data-required>checking</strong></article>
          <article class="webgpu-api-metric"><span>fallback</span><strong data-fallback>checking</strong></article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const featureGrid = host.querySelector<HTMLElement>("[data-feature-grid]");
  const formatLabel = host.querySelector<HTMLElement>("[data-format]");
  const requiredLabel = host.querySelector<HTMLElement>("[data-required]");
  const fallbackLabel = host.querySelector<HTMLElement>("[data-fallback]");
  if (!canvas || !stage || !featureGrid || !formatLabel || !requiredLabel || !fallbackLabel) {
    throw new Error("Texture compression lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createCompressionRuntime(canvas);
    featureGrid.innerHTML = compressedFeatureNames
      .map((feature) => `
        <article class="webgpu-api-resource">
          <span>${feature}</span>
          <strong>${gpu.features.has(feature) ? "supported" : "missing"}</strong>
          <small>${feature === "texture-compression-bc" ? "BC1 path used when available" : "reported for gating"}</small>
        </article>
      `)
      .join("");
    const textureFormat: GPUTextureFormat = gpu.usingBc ? "bc1-rgba-unorm" : "rgba8unorm";
    formatLabel.textContent = textureFormat;
    requiredLabel.textContent = gpu.usingBc ? "texture-compression-bc" : "none";
    fallbackLabel.textContent = gpu.usingBc ? "not needed" : "rgba8unorm active";

    const texture = gpu.device.createTexture({
      label: "lesson-43-sampled-texture",
      size: [textureSize, textureSize],
      format: textureFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    if (gpu.usingBc) {
      const { data, bytesPerRow } = createBc1TextureData();
      gpu.device.queue.writeTexture(
        { texture },
        data,
        { bytesPerRow, rowsPerImage: textureSize / 4 },
        { width: textureSize, height: textureSize }
      );
    } else {
      gpu.device.queue.writeTexture(
        { texture },
        createRgbaFallbackData(),
        { bytesPerRow: textureSize * 4, rowsPerImage: textureSize },
        { width: textureSize, height: textureSize }
      );
    }

    const paramsBuffer = gpu.device.createBuffer({
      label: "lesson-43-compression-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-43-compressed-texture-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const sampler = gpu.device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-43-compressed-texture-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    });

    let animationFrame = 0;
    const render = (time: number) => {
      syncApiViewport(host, stage);
      gpu.resize();
      gpu.device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([gpu.usingBc ? 1 : 0, time * 0.001, 0, 0]));
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-43-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
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
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    setStatus({
      title: "压缩纹理 feature gate 已就绪",
      detail: gpu.usingBc ? "当前设备支持 BC，课程创建并采样 bc1-rgba-unorm。" : "当前设备未开启 BC，课程安全回退到 rgba8unorm。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      texture.destroy();
      paramsBuffer.destroy();
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
