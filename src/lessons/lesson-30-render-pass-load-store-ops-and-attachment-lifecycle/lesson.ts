import { createWebGpuCanvas } from "@/core/webgpu";
import presentShaderSource from "@/lessons/lesson-30-render-pass-load-store-ops-and-attachment-lifecycle/attachment-present.wgsl?raw";
import sceneShaderSource from "@/lessons/lesson-30-render-pass-load-store-ops-and-attachment-lifecycle/attachment-scene.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type RenderTargets = {
  width: number;
  height: number;
  generation: number;
  clearTexture: GPUTexture;
  loadTexture: GPUTexture;
  discardTexture: GPUTexture;
  bindGroup: GPUBindGroup;
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

function createAttachment(device: GPUDevice, label: string, width: number, height: number, format: GPUTextureFormat) {
  return device.createTexture({
    label,
    size: { width, height },
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
}

export async function mountRenderPassLoadStoreOpsAndAttachmentLifecycleLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Render pass load/store operation preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>loadOp / storeOp</strong>
            <span>左：每帧 clear；中：load 后继续累积；右：discard 表示临时 attachment 不再被后续 pass 读取。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>attachment size</span><strong data-size>0 x 0</strong></article>
          <article class="webgpu-api-metric"><span>load path</span><strong>clear / load</strong></article>
          <article class="webgpu-api-metric"><span>store path</span><strong>store / discard</strong></article>
          <article class="webgpu-api-metric"><span>generation</span><strong data-generation>0</strong></article>
        </div>
        <div class="webgpu-api-timeline">
          <span class="webgpu-api-step">pass A: loadOp clear</span>
          <span class="webgpu-api-step">pass B: loadOp load</span>
          <span class="webgpu-api-step">pass C: storeOp discard</span>
          <span class="webgpu-api-step">present: sample stored targets</span>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const sizeLabel = host.querySelector<HTMLElement>("[data-size]");
  const generationLabel = host.querySelector<HTMLElement>("[data-generation]");
  if (!canvas || !stage || !sizeLabel || !generationLabel) {
    throw new Error("Attachment lifecycle lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const sampler = gpu.device.createSampler({ magFilter: "linear", minFilter: "linear" });
    const sceneUniformBuffer = gpu.device.createBuffer({
      label: "lesson-16-scene-uniforms",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const sceneModule = gpu.device.createShaderModule({ code: sceneShaderSource });
    const presentModule = gpu.device.createShaderModule({ code: presentShaderSource });
    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-16-attachment-scene-pipeline",
      layout: "auto",
      vertex: { module: sceneModule, entryPoint: "vsMain" },
      fragment: {
        module: sceneModule,
        entryPoint: "fsMain",
        targets: [
          {
            format: gpu.format,
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            },
          },
        ],
      },
    });
    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-16-attachment-present-pipeline",
      layout: "auto",
      vertex: { module: presentModule, entryPoint: "vsMain" },
      fragment: {
        module: presentModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const sceneBindGroup = gpu.device.createBindGroup({
      label: "lesson-16-scene-bind-group",
      layout: scenePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
    });

    let generation = 0;
    let targets: RenderTargets | null = null;
    let frameId = 0;
    let disposed = false;

    const ensureTargets = () => {
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);
      if (targets && targets.width === width && targets.height === height) {
        return targets;
      }

      targets?.clearTexture.destroy();
      targets?.loadTexture.destroy();
      targets?.discardTexture.destroy();
      generation += 1;

      const clearTexture = createAttachment(gpu.device, "lesson-16-clear-attachment", width, height, gpu.format);
      const loadTexture = createAttachment(gpu.device, "lesson-16-load-attachment", width, height, gpu.format);
      const discardTexture = createAttachment(gpu.device, "lesson-16-discard-attachment", width, height, gpu.format);
      const bindGroup = gpu.device.createBindGroup({
        label: "lesson-16-present-bind-group",
        layout: presentPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: clearTexture.createView() },
          { binding: 2, resource: loadTexture.createView() },
        ],
      });

      targets = { width, height, generation, clearTexture, loadTexture, discardTexture, bindGroup };
      sizeLabel.textContent = `${width} x ${height}`;
      generationLabel.textContent = `${generation}`;
      return targets;
    };

    const drawScenePass = (
      encoder: GPUCommandEncoder,
      view: GPUTextureView,
      loadOp: GPULoadOp,
      storeOp: GPUStoreOp,
      time: number,
      mode: number
    ) => {
      gpu.device.queue.writeBuffer(sceneUniformBuffer, 0, new Float32Array([time, mode, 0, 0]));
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view,
            clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
            loadOp,
            storeOp,
          },
        ],
      });
      pass.setPipeline(scenePipeline);
      pass.setBindGroup(0, sceneBindGroup);
      pass.draw(3);
      pass.end();
    };

    const render = (timeMs = 0) => {
      if (disposed) {
        return;
      }
      syncApiViewport(host, stage);
      gpu.resize();
      const currentTargets = ensureTargets();
      const time = timeMs * 0.001;
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-16-command-encoder" });

      drawScenePass(encoder, currentTargets.clearTexture.createView(), "clear", "store", time, 0);
      drawScenePass(encoder, currentTargets.loadTexture.createView(), "load", "store", time, 1);
      drawScenePass(encoder, currentTargets.discardTexture.createView(), "clear", "discard", time, 2);

      const presentPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.01, g: 0.015, b: 0.025, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      presentPass.setPipeline(presentPipeline);
      presentPass.setBindGroup(0, currentTargets.bindGroup);
      presentPass.draw(3);
      presentPass.end();

      gpu.device.queue.submit([encoder.finish()]);
      frameId = requestAnimationFrame(render);
    };

    render();

    setStatus({
      title: "Attachment 生命周期已就绪",
      detail: "clear、load、store 与 discard 都在真实 render pass 中运行。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      sceneUniformBuffer.destroy();
      targets?.clearTexture.destroy();
      targets?.loadTexture.destroy();
      targets?.discardTexture.destroy();
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
