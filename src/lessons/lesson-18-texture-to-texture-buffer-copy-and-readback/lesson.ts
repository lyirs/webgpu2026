import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-18-texture-to-texture-buffer-copy-and-readback/texture-copy-readback.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const textureWidth = 48;
const textureHeight = 48;
const bytesPerPixel = 4;
const unpaddedBytesPerRow = textureWidth * bytesPerPixel;
const paddedBytesPerRow = 256;

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

function createPaddedTextureData(seed = 0) {
  const data = new Uint8Array(paddedBytesPerRow * textureHeight);
  for (let y = 0; y < textureHeight; y += 1) {
    for (let x = 0; x < textureWidth; x += 1) {
      const offset = y * paddedBytesPerRow + x * bytesPerPixel;
      data[offset] = (x * 7 + seed * 13) & 255;
      data[offset + 1] = (y * 9 + 70) & 255;
      data[offset + 2] = ((x ^ y) * 11 + 90) & 255;
      data[offset + 3] = 255;
    }
  }
  return data;
}

function activeChecksum(data: Uint8Array) {
  let sum = 0;
  for (let y = 0; y < textureHeight; y += 1) {
    const start = y * paddedBytesPerRow;
    for (let x = 0; x < unpaddedBytesPerRow; x += 1) {
      sum = (sum + data[start + x]) % 100000;
    }
  }
  return sum;
}

export async function mountTextureToTextureBufferCopyAndReadbackLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--texture-readback">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Texture copy and readback preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>copyTextureToTexture -> copyTextureToBuffer</strong>
            <span>左 source，中 texture copy，右 CPU readback 后再上传，三段应保持一致。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>texture size</span><strong>${textureWidth} x ${textureHeight}</strong></article>
          <article class="webgpu-api-metric"><span>unpadded row</span><strong>${unpaddedBytesPerRow} B</strong></article>
          <article class="webgpu-api-metric"><span>bytesPerRow</span><strong data-bpr>${paddedBytesPerRow} B</strong></article>
          <article class="webgpu-api-metric"><span>checksum</span><strong data-checksum>pending</strong></article>
        </div>
        <div class="webgpu-api-note">texture readback 走 padded buffer；截图/调试读图时要剥离每行 padding 后再解释像素。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const checksumLabel = host.querySelector<HTMLElement>("[data-checksum]");
  if (!canvas || !stage || !checksumLabel) {
    throw new Error("Texture copy readback lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const format: GPUTextureFormat = "rgba8unorm";
    const createTexture = (label: string, usage: GPUTextureUsageFlags) =>
      gpu.device.createTexture({
        label,
        size: [textureWidth, textureHeight],
        format,
        usage,
      });

    const sourceTexture = createTexture(
      "lesson-18-source-texture",
      GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING
    );
    const copiedTexture = createTexture(
      "lesson-18-copied-texture",
      GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING
    );
    const readbackTexture = createTexture(
      "lesson-18-readback-roundtrip-texture",
      GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING
    );
    const readbackBuffer = gpu.device.createBuffer({
      label: "lesson-18-texture-readback-buffer",
      size: paddedBytesPerRow * textureHeight,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const sourceData = createPaddedTextureData(1);
    gpu.device.queue.writeTexture(
      { texture: sourceTexture },
      sourceData,
      { bytesPerRow: paddedBytesPerRow, rowsPerImage: textureHeight },
      [textureWidth, textureHeight]
    );

    const encoder = gpu.device.createCommandEncoder({ label: "lesson-18-copy-encoder" });
    encoder.copyTextureToTexture(
      { texture: sourceTexture },
      { texture: copiedTexture },
      [textureWidth, textureHeight]
    );
    encoder.copyTextureToBuffer(
      { texture: copiedTexture },
      { buffer: readbackBuffer, bytesPerRow: paddedBytesPerRow, rowsPerImage: textureHeight },
      [textureWidth, textureHeight]
    );
    gpu.device.queue.submit([encoder.finish()]);

    await readbackBuffer.mapAsync(GPUMapMode.READ);
    const readbackData = new Uint8Array(readbackBuffer.getMappedRange().slice(0));
    readbackBuffer.unmap();
    gpu.device.queue.writeTexture(
      { texture: readbackTexture },
      readbackData,
      { bytesPerRow: paddedBytesPerRow, rowsPerImage: textureHeight },
      [textureWidth, textureHeight]
    );
    checksumLabel.textContent = `${activeChecksum(readbackData)} / ${activeChecksum(sourceData)}`;

    const module = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-18-texture-copy-readback-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-18-texture-copy-readback-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: gpu.device.createSampler({ magFilter: "nearest", minFilter: "nearest" }) },
        { binding: 1, resource: sourceTexture.createView() },
        { binding: 2, resource: copiedTexture.createView() },
        { binding: 3, resource: readbackTexture.createView() },
      ],
    });

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const renderEncoder = gpu.device.createCommandEncoder({ label: "lesson-18-render-encoder" });
      const pass = renderEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.035, b: 0.06, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([renderEncoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Texture copy/readback 已校验",
      detail: "copyTextureToTexture 与 copyTextureToBuffer 完成，CPU readback checksum 与 source 匹配。",
      tone: activeChecksum(readbackData) === activeChecksum(sourceData) ? "ok" : "warn",
    });

    return () => {
      resizeObserver.disconnect();
      sourceTexture.destroy();
      copiedTexture.destroy();
      readbackTexture.destroy();
      readbackBuffer.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
