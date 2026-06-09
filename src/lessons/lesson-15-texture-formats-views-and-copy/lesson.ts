import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-15-texture-formats-views-and-copy/texture-panels.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const textureSize = 64;

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

function createTexturePixels() {
  const pixels = new Uint8Array(textureSize * textureSize * 4);
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const index = (y * textureSize + x) * 4;
      const checker = ((x >> 3) + (y >> 3)) % 2;
      pixels[index] = checker ? 246 : 58;
      pixels[index + 1] = Math.round((x / (textureSize - 1)) * 255);
      pixels[index + 2] = Math.round((y / (textureSize - 1)) * 255);
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

export async function mountTextureFormatsViewsAndCopyLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Texture format and view preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>writeTexture / copyBufferToTexture / texture.createView</strong>
            <span>左：writeTexture + nearest，中：同一 view + linear，右：copyBufferToTexture</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>format</span><strong>rgba8unorm</strong></article>
          <article class="webgpu-api-metric"><span>texture size</span><strong>${textureSize} x ${textureSize}</strong></article>
          <article class="webgpu-api-metric"><span>copy bytesPerRow</span><strong>256 aligned</strong></article>
        </div>
        <div class="webgpu-api-note">同一批 CPU 像素分别通过 queue.writeTexture 和 copyBufferToTexture 上传，shader 只看到 texture view。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Texture lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const pixels = createTexturePixels();
    const textureUsage =
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT;
    const writeTexture = gpu.device.createTexture({
      label: "lesson-08-write-texture",
      size: [textureSize, textureSize],
      format: "rgba8unorm",
      usage: textureUsage,
    });
    const copiedTexture = gpu.device.createTexture({
      label: "lesson-08-copied-texture",
      size: [textureSize, textureSize],
      format: "rgba8unorm",
      usage: textureUsage,
    });

    gpu.device.queue.writeTexture(
      { texture: writeTexture },
      pixels,
      { bytesPerRow: textureSize * 4, rowsPerImage: textureSize },
      { width: textureSize, height: textureSize }
    );

    const bytesPerRow = 256;
    const padded = new Uint8Array(bytesPerRow * textureSize);
    for (let y = 0; y < textureSize; y += 1) {
      padded.set(
        pixels.subarray(y * textureSize * 4, (y + 1) * textureSize * 4),
        y * bytesPerRow
      );
    }
    const uploadBuffer = gpu.device.createBuffer({
      label: "lesson-08-copy-upload-buffer",
      size: padded.byteLength,
      usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(uploadBuffer, 0, padded);
    const uploadEncoder = gpu.device.createCommandEncoder({
      label: "lesson-08-upload-command-encoder",
    });
    uploadEncoder.copyBufferToTexture(
      { buffer: uploadBuffer, bytesPerRow, rowsPerImage: textureSize },
      { texture: copiedTexture },
      { width: textureSize, height: textureSize }
    );
    gpu.device.queue.submit([uploadEncoder.finish()]);

    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-08-texture-panels-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const nearestSampler = gpu.device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
    const linearSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-08-texture-panels-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: writeTexture.createView() },
        { binding: 1, resource: copiedTexture.createView() },
        { binding: 2, resource: nearestSampler },
        { binding: 3, resource: linearSampler },
      ],
    });

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-08-command-encoder",
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.035, g: 0.055, b: 0.09, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Texture 上传链路已就绪",
      detail: "writeTexture、copyBufferToTexture、texture view 和 sampler 已并排展示。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      writeTexture.destroy();
      copiedTexture.destroy();
      uploadBuffer.destroy();
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `
      <div class="preview-empty">
        <h3>预览不可用</h3>
        <p>${message}</p>
      </div>
    `;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
