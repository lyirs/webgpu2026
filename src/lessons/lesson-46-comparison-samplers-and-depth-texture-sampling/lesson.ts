import { createWebGpuCanvas } from "@/core/webgpu";
import depthShaderSource from "@/lessons/lesson-46-comparison-samplers-and-depth-texture-sampling/depth-pass.wgsl?raw";
import shaderSource from "@/lessons/lesson-46-comparison-samplers-and-depth-texture-sampling/depth-compare.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
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

function ensureDepthTarget(device: GPUDevice, target: DepthTarget, width: number, height: number) {
  if (target.texture && target.width === width && target.height === height) {
    return;
  }
  target.texture?.destroy();
  target.texture = device.createTexture({
    label: "lesson-23-depth-texture",
    size: [width, height],
    format: "depth32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  target.view = target.texture.createView();
  target.width = width;
  target.height = height;
}

export async function mountComparisonSamplersAndDepthTextureSamplingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Comparison sampler and depth texture sampling preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>depth texture -> comparison sampler</strong>
            <span>左：raw depth，中：textureSampleCompare，右：简化 PCF</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-resource-grid">
          <article class="webgpu-api-resource"><span>texture type</span><strong>texture_depth_2d</strong><small>depth32float + TEXTURE_BINDING</small></article>
          <article class="webgpu-api-resource"><span>sampler</span><strong>sampler_comparison</strong><small>compare: less</small></article>
          <article class="webgpu-api-resource"><span>shader API</span><strong>textureSampleCompare</strong><small>shadow map 的核心采样方式</small></article>
        </div>
        <div class="webgpu-api-note">先把几何写进 depth texture，再在全屏 pass 里用 comparison sampler 做“当前深度是否通过”的硬件比较。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Comparison sampler lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const depthShaderModule = gpu.device.createShaderModule({ code: depthShaderSource });
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const paramsBuffer = gpu.device.createBuffer({
      label: "lesson-23-depth-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const emptyPipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-23-empty-pipeline-layout",
      bindGroupLayouts: [],
    });
    const presentBindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-23-present-bind-group-layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "comparison" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    const presentPipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-23-present-pipeline-layout",
      bindGroupLayouts: [presentBindGroupLayout],
    });
    const depthPipeline = gpu.device.createRenderPipeline({
      label: "lesson-23-depth-pipeline",
      layout: emptyPipelineLayout,
      vertex: { module: depthShaderModule, entryPoint: "vsDepth" },
      primitive: { topology: "triangle-list" },
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-23-present-pipeline",
      layout: presentPipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vsFullscreen" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const comparisonSampler = gpu.device.createSampler({
      compare: "less",
      magFilter: "linear",
      minFilter: "linear",
    });
    const depthTarget: DepthTarget = { texture: null, view: null, width: 0, height: 0 };
    let bindGroup: GPUBindGroup | null = null;
    let animationFrame = 0;

    const render = (time: number) => {
      syncApiViewport(host, stage);
      gpu.resize();
      ensureDepthTarget(gpu.device, depthTarget, canvas.width, canvas.height);
      if (!depthTarget.view) {
        return;
      }
      bindGroup = gpu.device.createBindGroup({
        label: "lesson-23-present-bind-group",
        layout: presentBindGroupLayout,
        entries: [
          { binding: 0, resource: depthTarget.view },
          { binding: 1, resource: comparisonSampler },
          { binding: 2, resource: { buffer: paramsBuffer } },
        ],
      });
      gpu.device.queue.writeBuffer(
        paramsBuffer,
        0,
        new Float32Array([time * 0.001, 0.48, 1 / Math.max(1, canvas.width), 1 / Math.max(1, canvas.height)])
      );
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-23-command-encoder" });
      const depthPass = encoder.beginRenderPass({
        label: "lesson-23-depth-pass",
        colorAttachments: [],
        depthStencilAttachment: {
          view: depthTarget.view,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      depthPass.setPipeline(depthPipeline);
      depthPass.draw(6, 3);
      depthPass.end();

      const presentPass = encoder.beginRenderPass({
        label: "lesson-23-present-pass",
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

    animationFrame = requestAnimationFrame(render);
    setStatus({
      title: "Depth comparison 已就绪",
      detail: "depth texture 被全屏 pass 同时以 raw depth、单次 compare 和 PCF compare 方式采样。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      paramsBuffer.destroy();
      depthTarget.texture?.destroy();
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
