import { createWebGpuCanvas } from "@/core/webgpu";
import fallbackShaderSource from "@/lessons/lesson-16-external-image-video-texture-and-copy/external-copy-fallback.wgsl?raw";
import externalShaderSource from "@/lessons/lesson-16-external-image-video-texture-and-copy/external-copy.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const sourceSize = 128;

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

function createSourceCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = sourceSize;
  canvas.height = sourceSize;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建外部图像 source canvas。");
  }

  const gradient = context.createLinearGradient(0, 0, sourceSize, sourceSize);
  gradient.addColorStop(0, "#5eead4");
  gradient.addColorStop(0.45, "#fef3c7");
  gradient.addColorStop(1, "#f97316");
  context.fillStyle = gradient;
  context.fillRect(0, 0, sourceSize, sourceSize);
  context.fillStyle = "rgba(7, 15, 28, 0.7)";
  for (let y = 0; y < sourceSize; y += 16) {
    for (let x = (y / 16) % 2 === 0 ? 0 : 8; x < sourceSize; x += 16) {
      context.fillRect(x + 3, y + 3, 8, 8);
    }
  }
  context.strokeStyle = "rgba(255, 255, 255, 0.86)";
  context.lineWidth = 5;
  context.strokeRect(14, 14, sourceSize - 28, sourceSize - 28);
  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  context.font = "bold 28px serif";
  context.fillText("EXT", 34, 74);
  return canvas;
}

export async function mountExternalImageVideoTextureAndCopyLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="External image and video texture preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>external source -> GPU texture</strong>
            <span>ImageBitmap copy / copyExternalImageToTexture / importExternalTexture</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-resource-grid">
          <article class="webgpu-api-resource"><span>source</span><strong>CanvasImageSource</strong><small>CPU/browser-owned pixels</small></article>
          <article class="webgpu-api-resource"><span>copy</span><strong>copyExternalImageToTexture</strong><small>uploads into GPUTexture</small></article>
          <article class="webgpu-api-resource"><span>video path</span><strong data-external-status>checking</strong><small>external texture is sampled directly</small></article>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>texture size</span><strong>${sourceSize} x ${sourceSize}</strong></article>
          <article class="webgpu-api-metric"><span>format</span><strong>rgba8unorm</strong></article>
          <article class="webgpu-api-metric"><span>copy API</span><strong>queue.copyExternalImageToTexture</strong></article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const externalStatus = host.querySelector<HTMLElement>("[data-external-status]");
  if (!canvas || !stage || !externalStatus) {
    throw new Error("External texture lesson DOM 初始化失败。");
  }

  let videoFrame: VideoFrame | null = null;
  let imageBitmap: ImageBitmap | null = null;
  try {
    const gpu = await createWebGpuCanvas(canvas);
    const sourceCanvas = createSourceCanvas();
    imageBitmap = await createImageBitmap(sourceCanvas);
    const copiedTexture = gpu.device.createTexture({
      label: "lesson-10-copied-external-image",
      size: [sourceSize, sourceSize],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    gpu.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: copiedTexture },
      { width: sourceSize, height: sourceSize }
    );

    const sampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
    const fallbackModule = gpu.device.createShaderModule({ code: fallbackShaderSource });
    const fallbackPipeline = gpu.device.createRenderPipeline({
      label: "lesson-10-fallback-pipeline",
      layout: "auto",
      vertex: { module: fallbackModule, entryPoint: "vsMain" },
      fragment: {
        module: fallbackModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const fallbackBindGroup = gpu.device.createBindGroup({
      label: "lesson-10-fallback-bind-group",
      layout: fallbackPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: copiedTexture.createView() },
        { binding: 1, resource: sampler },
      ],
    });

    let externalPipeline: GPURenderPipeline | null = null;
    let externalBindGroup: GPUBindGroup | null = null;
    const VideoFrameConstructor = globalThis.VideoFrame;
    if (typeof VideoFrameConstructor === "function") {
      try {
        videoFrame = new VideoFrameConstructor(sourceCanvas, { timestamp: 0 });
        const externalTexture = gpu.device.importExternalTexture({ source: videoFrame });
        const externalModule = gpu.device.createShaderModule({ code: externalShaderSource });
        externalPipeline = gpu.device.createRenderPipeline({
          label: "lesson-10-external-pipeline",
          layout: "auto",
          vertex: { module: externalModule, entryPoint: "vsMain" },
          fragment: {
            module: externalModule,
            entryPoint: "fsMain",
            targets: [{ format: gpu.format }],
          },
        });
        externalBindGroup = gpu.device.createBindGroup({
          label: "lesson-10-external-bind-group",
          layout: externalPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: copiedTexture.createView() },
            { binding: 1, resource: sampler },
            { binding: 2, resource: externalTexture },
          ],
        });
        externalStatus.textContent = "VideoFrame ready";
      } catch {
        externalStatus.textContent = "fallback";
      }
    } else {
      externalStatus.textContent = "fallback";
    }

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-10-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.038, b: 0.06, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      if (externalPipeline && externalBindGroup) {
        pass.setPipeline(externalPipeline);
        pass.setBindGroup(0, externalBindGroup);
      } else {
        pass.setPipeline(fallbackPipeline);
        pass.setBindGroup(0, fallbackBindGroup);
      }
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "外部图像上传链路已就绪",
      detail: "copyExternalImageToTexture 已上传 ImageBitmap；可用时同时展示 VideoFrame external texture。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      videoFrame?.close();
      imageBitmap?.close();
      copiedTexture.destroy();
    };
  } catch (error) {
    videoFrame?.close();
    imageBitmap?.close();
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
