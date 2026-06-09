import { createWebGpuCanvas } from "@/core/webgpu";
import depthShaderSource from "@/lessons/lesson-47-depth-bias-slope-scale-and-shadow-acne/shadow-depth.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-47-depth-bias-slope-scale-and-shadow-acne/bias-present.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type ShadowTarget = {
  texture: GPUTexture;
  view: GPUTextureView;
};

const shadowSize = 768;
const variants = [
  { name: "no bias", depthBias: 0, depthBiasSlopeScale: 0, depthBiasClamp: 0 },
  { name: "fixed bias", depthBias: 900, depthBiasSlopeScale: 0, depthBiasClamp: 0.01 },
  { name: "slope-scale", depthBias: 120, depthBiasSlopeScale: 3.2, depthBiasClamp: 0.018 },
];

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

function createShadowTarget(device: GPUDevice): ShadowTarget {
  const texture = device.createTexture({
    label: "lesson-25-shadow-map",
    size: [shadowSize, shadowSize],
    format: "depth32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  return { texture, view: texture.createView() };
}

export async function mountDepthBiasSlopeScaleAndShadowAcneLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Depth bias and shadow acne preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>shadow pass depthBias variants</strong>
            <span>左：无 bias，中：fixed bias，右：slope-scale bias</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-resource-grid">
          <article class="webgpu-api-resource"><span>no bias</span><strong>depthBias = 0</strong><small>容易出现 shadow acne / 条纹</small></article>
          <article class="webgpu-api-resource"><span>fixed bias</span><strong>depthBias = 900</strong><small>缓解 acne，但可能 peter-panning</small></article>
          <article class="webgpu-api-resource"><span>slope-scale</span><strong>slope = 3.2</strong><small>按表面斜率增加偏移</small></article>
        </div>
        <div class="webgpu-api-note">这节真正创建了三条 shadow-map pipeline，只改变 <code>depthBias</code> / <code>depthBiasSlopeScale</code> / <code>depthBiasClamp</code>。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Depth bias lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const depthModule = gpu.device.createShaderModule({
      label: "lesson-25-shadow-depth-shader",
      code: depthShaderSource,
    });
    const presentModule = gpu.device.createShaderModule({
      label: "lesson-25-bias-present-shader",
      code: presentShaderSource,
    });
    const shadowPipelines = variants.map((variant) =>
      gpu.device.createRenderPipeline({
        label: `lesson-25-shadow-${variant.name}`,
        layout: "auto",
        vertex: { module: depthModule, entryPoint: "vsShadow" },
        primitive: { topology: "triangle-list", cullMode: "back" },
        depthStencil: {
          format: "depth32float",
          depthWriteEnabled: true,
          depthCompare: "less",
          depthBias: variant.depthBias,
          depthBiasSlopeScale: variant.depthBiasSlopeScale,
          depthBiasClamp: variant.depthBiasClamp,
        },
      })
    );
    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-25-present-pipeline",
      layout: "auto",
      vertex: { module: presentModule, entryPoint: "vsMain" },
      fragment: {
        module: presentModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const shadowSampler = gpu.device.createSampler({
      compare: "less",
      magFilter: "linear",
      minFilter: "linear",
    });
    const targets = variants.map(() => createShadowTarget(gpu.device));
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-25-present-bind-group",
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: targets[0].view },
        { binding: 1, resource: targets[1].view },
        { binding: 2, resource: targets[2].view },
        { binding: 3, resource: shadowSampler },
      ],
    });

    let animationFrame = 0;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-25-command-encoder",
      });

      targets.forEach((target, index) => {
        const shadowPass = encoder.beginRenderPass({
          label: `lesson-25-shadow-pass-${index}`,
          colorAttachments: [],
          depthStencilAttachment: {
            view: target.view,
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
          },
        });
        shadowPass.setPipeline(shadowPipelines[index]);
        shadowPass.draw(18);
        shadowPass.end();
      });

      const presentPass = encoder.beginRenderPass({
        label: "lesson-25-present-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      presentPass.setPipeline(presentPipeline);
      presentPass.setBindGroup(0, bindGroup);
      presentPass.draw(3);
      presentPass.end();
      gpu.device.queue.submit([encoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Depth bias 已就绪",
      detail: "三张 shadow map 分别使用 no bias、fixed bias 和 slope-scale bias 生成。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      targets.forEach((target) => target.texture.destroy());
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
