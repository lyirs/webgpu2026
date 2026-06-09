import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-101-resize-resource-lifecycle-and-target-rebuild/resize-targets.wgsl?raw";

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

export async function mountResizeResourceLifecycleAndTargetRebuildLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Resize target lifecycle preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>resize / DPR / render scale -> rebuild targets</strong>
            <span>Auto demo 会周期性改变 render scale，旧 color/depth target destroy() 后按新尺寸重建。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <label>Render scale <input data-render-scale type="range" min="0.5" max="1.5" step="0.1" value="1"></label>
          <label class="webgpu-api-toggle"><input data-auto-demo type="checkbox" checked> Auto demo</label>
          <button data-force-rebuild type="button">Force rebuild</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>generation</span><strong data-generation>0</strong></article>
          <article class="webgpu-api-metric"><span>target size</span><strong data-target-size>pending</strong></article>
          <article class="webgpu-api-metric"><span>destroy count</span><strong data-destroy-count>0</strong></article>
          <article class="webgpu-api-metric"><span>canvas size</span><strong data-canvas-size>pending</strong></article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const scaleInput = host.querySelector<HTMLInputElement>("[data-render-scale]");
  const autoDemoInput = host.querySelector<HTMLInputElement>("[data-auto-demo]");
  const forceButton = host.querySelector<HTMLButtonElement>("[data-force-rebuild]");
  const generationLabel = host.querySelector<HTMLElement>("[data-generation]");
  const targetSizeLabel = host.querySelector<HTMLElement>("[data-target-size]");
  const destroyCountLabel = host.querySelector<HTMLElement>("[data-destroy-count]");
  const canvasSizeLabel = host.querySelector<HTMLElement>("[data-canvas-size]");
  if (
    !canvas ||
    !stage ||
    !scaleInput ||
    !autoDemoInput ||
    !forceButton ||
    !generationLabel ||
    !targetSizeLabel ||
    !destroyCountLabel ||
    !canvasSizeLabel
  ) {
    throw new Error("Resize lifecycle lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const sampler = gpu.device.createSampler({
      label: "lesson-101-present-sampler",
      magFilter: "linear",
      minFilter: "linear",
    });
    const sceneUniformBuffer = gpu.device.createBuffer({
      label: "lesson-101-scene-uniforms",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-101-scene-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsScene" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsScene",
        targets: [{ format: "rgba8unorm" }],
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-101-present-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsPresent" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsPresent",
        targets: [{ format: gpu.format }],
      },
    });

    let colorTarget: GPUTexture | null = null;
    let depthTarget: GPUTexture | null = null;
    let presentBindGroup: GPUBindGroup | null = null;
    let generation = 0;
    let destroyCount = 0;
    let targetWidth = 0;
    let targetHeight = 0;

    const updateLabels = () => {
      generationLabel.textContent = `${generation}`;
      targetSizeLabel.textContent = `${targetWidth} x ${targetHeight}`;
      destroyCountLabel.textContent = `${destroyCount}`;
      canvasSizeLabel.textContent = `${gpu.context.canvas.width} x ${gpu.context.canvas.height}`;
    };

    const rebuildTargets = (force = false) => {
      const renderScale = Number(scaleInput.value);
      const nextWidth = Math.max(1, Math.floor(gpu.context.canvas.width * renderScale));
      const nextHeight = Math.max(1, Math.floor(gpu.context.canvas.height * renderScale));
      if (!force && nextWidth === targetWidth && nextHeight === targetHeight && colorTarget && depthTarget) {
        updateLabels();
        return;
      }

      if (colorTarget) {
        colorTarget.destroy();
        destroyCount += 1;
      }
      if (depthTarget) {
        depthTarget.destroy();
        destroyCount += 1;
      }
      targetWidth = nextWidth;
      targetHeight = nextHeight;
      generation += 1;
      colorTarget = gpu.device.createTexture({
        label: `lesson-101-color-target-generation-${generation}`,
        size: [targetWidth, targetHeight],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      depthTarget = gpu.device.createTexture({
        label: `lesson-101-depth-target-generation-${generation}`,
        size: [targetWidth, targetHeight],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      presentBindGroup = gpu.device.createBindGroup({
        label: `lesson-101-present-bind-group-generation-${generation}`,
        layout: presentPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: colorTarget.createView() },
        ],
      });
      updateLabels();
    };

    const sceneUniformBindGroup = gpu.device.createBindGroup({
      label: "lesson-101-scene-uniform-bind-group",
      layout: scenePipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
    });
    const presentUniformBindGroup = gpu.device.createBindGroup({
      label: "lesson-101-present-uniform-bind-group",
      layout: presentPipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
    });
    let disposed = false;
    let animationFrame = 0;
    let lastAutoBucket = -1;
    let forceRebuildRequested = false;

    const render = (time = performance.now()) => {
      if (disposed) {
        return;
      }
      syncApiViewport(host, stage);
      gpu.resize();
      if (autoDemoInput.checked) {
        const bucket = Math.floor(time / 1300);
        if (bucket !== lastAutoBucket) {
          lastAutoBucket = bucket;
          const scaleSteps = [0.55, 0.75, 1, 1.25, 1.5, 0.9];
          scaleInput.value = String(scaleSteps[bucket % scaleSteps.length]);
        }
      }
      rebuildTargets(forceRebuildRequested);
      forceRebuildRequested = false;
      if (!colorTarget || !depthTarget || !presentBindGroup) {
        animationFrame = requestAnimationFrame(render);
        return;
      }
      gpu.device.queue.writeBuffer(
        sceneUniformBuffer,
        0,
        new Float32Array([generation, targetWidth, targetHeight, time * 0.001])
      );

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-101-command-encoder",
      });
      const scenePass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: colorTarget.createView(),
            clearValue: { r: 0.025, g: 0.04, b: 0.065, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthTarget.createView(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      scenePass.setPipeline(scenePipeline);
      scenePass.setBindGroup(1, sceneUniformBindGroup);
      scenePass.draw(6);
      scenePass.end();

      const presentPass = commandEncoder.beginRenderPass({
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
      presentPass.setBindGroup(0, presentBindGroup);
      presentPass.setBindGroup(1, presentUniformBindGroup);
      presentPass.draw(6);
      presentPass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    const onScaleChange = () => {
      lastAutoBucket = -1;
      forceRebuildRequested = true;
    };
    const onForceRebuild = () => {
      forceRebuildRequested = true;
    };
    scaleInput.addEventListener("input", onScaleChange);
    forceButton.addEventListener("click", onForceRebuild);

    animationFrame = requestAnimationFrame(render);
    const resizeObserver = new ResizeObserver(() => {
      forceRebuildRequested = true;
    });
    resizeObserver.observe(host);

    setStatus({
      title: "Resize target lifecycle 已就绪",
      detail: "改变 render scale 或容器尺寸时会 destroy 旧 target 并重建新 color/depth target。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      disposed = true;
      cancelAnimationFrame(animationFrame);
      scaleInput.removeEventListener("input", onScaleChange);
      forceButton.removeEventListener("click", onForceRebuild);
      sceneUniformBuffer.destroy();
      colorTarget?.destroy();
      depthTarget?.destroy();
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
