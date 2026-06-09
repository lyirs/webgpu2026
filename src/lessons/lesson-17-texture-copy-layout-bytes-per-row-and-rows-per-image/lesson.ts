import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-17-texture-copy-layout-bytes-per-row-and-rows-per-image/texture-copy-layout.wgsl?raw";

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

function alignTo(value: number, alignment: number) {
  return Math.ceil(value / alignment) * alignment;
}

function createTextureRows(width: number, height: number, bytesPerRow: number) {
  const data = new Uint8Array(bytesPerRow * height);
  const tightBytesPerRow = width * 4;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * bytesPerRow + x * 4;
      const checker = ((x >> 3) + (y >> 3)) % 2;
      data[offset + 0] = checker ? 48 + x * 2 : 230 - y * 2;
      data[offset + 1] = checker ? 180 - y : 90 + x;
      data[offset + 2] = 130 + ((x + y) % 90);
      data[offset + 3] = 255;
    }
    for (let p = tightBytesPerRow; p < bytesPerRow; p += 1) {
      data[y * bytesPerRow + p] = 0x7f;
    }
  }
  return data;
}

export async function mountTextureCopyLayoutBytesPerRowAndRowsPerImageLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Texture copy layout preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>copyBufferToTexture layout</strong>
            <span>左：tight row 概念；中：真实 padded staging buffer 上传后的纹理；右：每行 payload + padding 的内存视图。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>texture size</span><strong data-size>0 x 0</strong></article>
          <article class="webgpu-api-metric"><span>tight bytes/row</span><strong data-tight>0</strong></article>
          <article class="webgpu-api-metric"><span>bytesPerRow</span><strong data-bpr>0</strong></article>
          <article class="webgpu-api-metric"><span>rowsPerImage</span><strong data-rows>0</strong></article>
        </div>
        <div class="webgpu-api-note">WebGPU 要求 buffer-to-texture copy 的 bytesPerRow 按 256 对齐；padding 字节存在于 staging buffer，但不会进入纹理像素。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const sizeLabel = host.querySelector<HTMLElement>("[data-size]");
  const tightLabel = host.querySelector<HTMLElement>("[data-tight]");
  const bprLabel = host.querySelector<HTMLElement>("[data-bpr]");
  const rowsLabel = host.querySelector<HTMLElement>("[data-rows]");
  if (!canvas || !stage || !sizeLabel || !tightLabel || !bprLabel || !rowsLabel) {
    throw new Error("Texture copy layout lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const width = 96;
    const height = 48;
    const tightBytesPerRow = width * 4;
    const bytesPerRow = alignTo(tightBytesPerRow, 256);
    const rowsPerImage = height;
    const stagingData = createTextureRows(width, height, bytesPerRow);

    const stagingBuffer = gpu.device.createBuffer({
      label: "lesson-13-padded-staging-buffer",
      size: stagingData.byteLength,
      usage: GPUBufferUsage.COPY_SRC,
      mappedAtCreation: true,
    });
    new Uint8Array(stagingBuffer.getMappedRange()).set(stagingData);
    stagingBuffer.unmap();

    const texture = gpu.device.createTexture({
      label: "lesson-13-copied-texture",
      size: { width, height },
      format: "rgba8unorm",
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    const copyEncoder = gpu.device.createCommandEncoder({ label: "lesson-13-copy-encoder" });
    copyEncoder.copyBufferToTexture(
      { buffer: stagingBuffer, bytesPerRow, rowsPerImage },
      { texture },
      { width, height }
    );
    gpu.device.queue.submit([copyEncoder.finish()]);

    const module = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-13-texture-copy-layout-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const sampler = gpu.device.createSampler({ magFilter: "nearest", minFilter: "nearest" });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-13-texture-copy-layout-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView() },
      ],
    });

    sizeLabel.textContent = `${width} x ${height}`;
    tightLabel.textContent = `${tightBytesPerRow}`;
    bprLabel.textContent = `${bytesPerRow}`;
    rowsLabel.textContent = `${rowsPerImage}`;

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-13-render-encoder" });
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
      title: "Texture copy layout 已就绪",
      detail: "padded staging buffer 已通过 copyBufferToTexture 上传，bytesPerRow 与 rowsPerImage 正在 HUD 中展示。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      stagingBuffer.destroy();
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
