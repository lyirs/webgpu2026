import { createWebGpuCanvas } from "@/core/webgpu";
import presentShaderSource from "@/lessons/lesson-31-render-pass-clear-load-debugging-and-attachment-state/attachment-debug-present.wgsl?raw";
import sceneShaderSource from "@/lessons/lesson-31-render-pass-clear-load-debugging-and-attachment-state/attachment-debug-scene.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const targetSize = 256;

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

export async function mountRenderPassClearLoadDebuggingAndAttachmentStateLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--attachment-debug">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Render pass clear load debugging preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>clear vs load as a debugging lens</strong>
            <span>左：第二 pass clear；中：第二 pass load；右：debug clear color 标记 target 状态。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>left pass</span><strong>loadOp: clear</strong></article>
          <article class="webgpu-api-metric"><span>middle pass</span><strong>loadOp: load</strong></article>
          <article class="webgpu-api-metric"><span>debug clearValue</span><strong>magenta marker</strong></article>
          <article class="webgpu-api-metric"><span>storeOp</span><strong>store</strong></article>
        </div>
        <div class="webgpu-api-note">调试多 pass 时，故意使用醒目的 clearValue 可以快速判断 target 是否被保留、重写或错误复用。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Attachment debug lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const sceneModule = gpu.device.createShaderModule({ label: "lesson-27-attachment-scene-shader", code: sceneShaderSource });
    const presentModule = gpu.device.createShaderModule({ label: "lesson-27-attachment-present-shader", code: presentShaderSource });
    const sceneUniformBuffer = gpu.device.createBuffer({
      label: "lesson-27-scene-uniforms",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const sceneBindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-27-scene-layout",
      entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
    });
    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-27-scene-pipeline",
      layout: gpu.device.createPipelineLayout({ label: "lesson-27-scene-pipeline-layout", bindGroupLayouts: [sceneBindGroupLayout] }),
      vertex: { module: sceneModule, entryPoint: "vsMain" },
      fragment: {
        module: sceneModule,
        entryPoint: "fsMain",
        targets: [{ format: "rgba8unorm", blend: { color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } } }],
      },
    });
    const targets = ["clear", "load", "debug"].map((name) => gpu.device.createTexture({
      label: `lesson-27-${name}-target`,
      size: [targetSize, targetSize],
      format: "rgba8unorm",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    }));
    const sampler = gpu.device.createSampler({ magFilter: "linear", minFilter: "linear" });
    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-27-present-pipeline",
      layout: "auto",
      vertex: { module: presentModule, entryPoint: "vsMain" },
      fragment: { module: presentModule, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const presentBindGroup = gpu.device.createBindGroup({
      label: "lesson-27-present-bind-group",
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: targets[0].createView() },
        { binding: 2, resource: targets[1].createView() },
        { binding: 3, resource: targets[2].createView() },
      ],
    });
    const sceneBindGroup = gpu.device.createBindGroup({
      label: "lesson-27-scene-bind-group",
      layout: sceneBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
    });

    const drawScene = (encoder: GPUCommandEncoder, view: GPUTextureView, mode: number, loadOp: GPULoadOp, clearValue: GPUColor) => {
      gpu.device.queue.writeBuffer(sceneUniformBuffer, 0, new Float32Array([mode, performance.now() * 0.001, 0, 0]));
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view, clearValue, loadOp, storeOp: "store" }],
      });
      pass.setPipeline(scenePipeline);
      pass.setBindGroup(0, sceneBindGroup);
      pass.draw(3);
      pass.end();
    };

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-27-command-encoder" });
      for (const target of targets) {
        drawScene(encoder, target.createView(), 0, "clear", { r: 0.03, g: 0.06, b: 0.1, a: 1 });
      }
      drawScene(encoder, targets[0].createView(), 1, "clear", { r: 0.02, g: 0.025, b: 0.035, a: 1 });
      drawScene(encoder, targets[1].createView(), 1, "load", { r: 0, g: 0, b: 0, a: 1 });
      drawScene(encoder, targets[2].createView(), 1, "clear", { r: 0.55, g: 0.05, b: 0.42, a: 1 });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: gpu.context.getCurrentTexture().createView(),
          clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(presentPipeline);
      pass.setBindGroup(0, presentBindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    setStatus({ title: "Clear/Load debug 已就绪", detail: "三个 offscreen attachment 正在展示 clear/load 对调试读图的影响。", tone: "ok" });

    return () => {
      resizeObserver.disconnect();
      targets.forEach((target) => target.destroy());
      sceneUniformBuffer.destroy();
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
