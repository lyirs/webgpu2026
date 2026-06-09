import { createWebGpuCanvas } from "@/core/webgpu";
import presentShaderSource from "@/lessons/lesson-73-multisampled-texture-resolve-target-and-sample-count/present.wgsl?raw";
import sceneShaderSource from "@/lessons/lesson-73-multisampled-texture-resolve-target-and-sample-count/scene.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type Targets = {
  width: number;
  height: number;
  single: GPUTexture;
  msaa: GPUTexture;
  resolved: GPUTexture;
  bindGroup: GPUBindGroup;
};

const offscreenFormat: GPUTextureFormat = "rgba8unorm";

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

function destroyTargets(targets: Targets | null) {
  targets?.single.destroy();
  targets?.msaa.destroy();
  targets?.resolved.destroy();
}

export async function mountMultisampledTextureResolveTargetAndSampleCountLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Multisampled texture and resolve target preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>sampleCount must match pipeline + attachment</strong>
            <span>左：single-sample offscreen，右：4x MSAA texture -> resolveTarget</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics" data-metrics></div>
        <div class="webgpu-api-note">MSAA color attachment 不能直接被采样显示；它要先 resolve 到普通 2D texture，再交给 present pass。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const metrics = host.querySelector<HTMLElement>("[data-metrics]");
  if (!canvas || !stage || !metrics) {
    throw new Error("MSAA resolve lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const sceneModule = gpu.device.createShaderModule({
      label: "lesson-42-scene-shader",
      code: sceneShaderSource,
    });
    const presentModule = gpu.device.createShaderModule({
      label: "lesson-42-present-shader",
      code: presentShaderSource,
    });
    const createScenePipeline = (sampleCount: number) =>
      gpu.device.createRenderPipeline({
        label: `lesson-42-scene-${sampleCount}x`,
        layout: "auto",
        vertex: { module: sceneModule, entryPoint: "vsScene" },
        fragment: {
          module: sceneModule,
          entryPoint: "fsScene",
          targets: [{ format: offscreenFormat }],
        },
        primitive: { topology: "triangle-list" },
        multisample: { count: sampleCount },
      });
    const singlePipeline = createScenePipeline(1);
    const msaaPipeline = createScenePipeline(4);
    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-42-present-pipeline",
      layout: "auto",
      vertex: { module: presentModule, entryPoint: "vsMain" },
      fragment: {
        module: presentModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const sampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    let targets: Targets | null = null;
    const ensureTargets = () => {
      const width = Math.max(1, Math.floor(canvas.width / 2));
      const height = Math.max(1, canvas.height);
      if (targets && targets.width === width && targets.height === height) {
        return targets;
      }
      destroyTargets(targets);
      const single = gpu.device.createTexture({
        label: "lesson-42-single-sample-target",
        size: [width, height],
        format: offscreenFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      const msaa = gpu.device.createTexture({
        label: "lesson-42-msaa-target",
        size: [width, height],
        sampleCount: 4,
        format: offscreenFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      const resolved = gpu.device.createTexture({
        label: "lesson-42-resolve-target",
        size: [width, height],
        format: offscreenFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      const bindGroup = gpu.device.createBindGroup({
        label: "lesson-42-present-bind-group",
        layout: presentPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: single.createView() },
          { binding: 2, resource: resolved.createView() },
        ],
      });
      targets = { width, height, single, msaa, resolved, bindGroup };
      metrics.innerHTML = `
        <article class="webgpu-api-metric"><span>single target</span><strong>${width} x ${height}</strong></article>
        <article class="webgpu-api-metric"><span>msaa sampleCount</span><strong>4</strong></article>
        <article class="webgpu-api-metric"><span>resolve target</span><strong>${offscreenFormat}</strong></article>
        <article class="webgpu-api-metric"><span>pipeline match</span><strong>1x / 4x</strong></article>
      `;
      return targets;
    };

    let animationFrame = 0;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const activeTargets = ensureTargets();
      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-42-command-encoder",
      });
      const singlePass = encoder.beginRenderPass({
        label: "lesson-42-single-pass",
        colorAttachments: [
          {
            view: activeTargets.single.createView(),
            clearValue: { r: 0.03, g: 0.04, b: 0.065, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      singlePass.setPipeline(singlePipeline);
      singlePass.draw(12);
      singlePass.end();

      const msaaPass = encoder.beginRenderPass({
        label: "lesson-42-msaa-pass",
        colorAttachments: [
          {
            view: activeTargets.msaa.createView(),
            resolveTarget: activeTargets.resolved.createView(),
            clearValue: { r: 0.03, g: 0.04, b: 0.065, a: 1 },
            loadOp: "clear",
            storeOp: "discard",
          },
        ],
      });
      msaaPass.setPipeline(msaaPipeline);
      msaaPass.draw(12);
      msaaPass.end();

      const presentPass = encoder.beginRenderPass({
        label: "lesson-42-present-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      presentPass.setPipeline(presentPipeline);
      presentPass.setBindGroup(0, activeTargets.bindGroup);
      presentPass.draw(3);
      presentPass.end();
      gpu.device.queue.submit([encoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "MSAA resolve 已就绪",
      detail: "右侧先渲染到 4x multisampled texture，再 resolve 到普通 texture 采样显示。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      destroyTargets(targets);
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
