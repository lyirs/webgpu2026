import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-102-resource-pooling-ring-buffers-and-transient-resources/resource-pool.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type RingResources = {
  buffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  stride: number;
  framesInFlight: number;
};

type TransientTargets = {
  color: GPUTexture;
  width: number;
  height: number;
  generation: number;
};

const uniformStructSize = 16;

function alignTo(value: number, alignment: number) {
  return Math.ceil(value / alignment) * alignment;
}

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

export async function mountResourcePoolingRingBuffersAndTransientResourcesLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Resource pool ring buffer preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>frames-in-flight ring + transient target pool</strong>
            <span>每帧换 slot，不每帧重新创建 buffer / texture</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <label>Frames in flight <input data-frames type="range" min="2" max="4" step="1" value="3"></label>
          <label>Objects <input data-objects type="range" min="24" max="96" step="12" value="72"></label>
          <button data-rebuild type="button">Simulate resize / rebuild</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>ring slot</span><strong data-slot>0 / 3</strong></article>
          <article class="webgpu-api-metric"><span>uniform stride</span><strong data-stride>pending</strong></article>
          <article class="webgpu-api-metric"><span>target generation</span><strong data-generation>0</strong></article>
          <article class="webgpu-api-metric"><span>destroy / rebuild</span><strong data-destroy>0</strong></article>
        </div>
        <div class="webgpu-api-resource-grid">
          <article class="webgpu-api-resource"><strong>Uniform ring</strong><span>slot = frameIndex % framesInFlight</span><em data-ring-detail>pending</em></article>
          <article class="webgpu-api-resource"><strong>Transient color target</strong><span>reused until size changes</span><em data-target-detail>pending</em></article>
          <article class="webgpu-api-resource"><strong>Allocation pressure</strong><span>render loop reuses pooled objects</span><em data-allocation-detail>0 new/frame</em></article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const framesInput = host.querySelector<HTMLInputElement>("[data-frames]");
  const objectsInput = host.querySelector<HTMLInputElement>("[data-objects]");
  const rebuildButton = host.querySelector<HTMLButtonElement>("[data-rebuild]");
  const slotLabel = host.querySelector<HTMLElement>("[data-slot]");
  const strideLabel = host.querySelector<HTMLElement>("[data-stride]");
  const generationLabel = host.querySelector<HTMLElement>("[data-generation]");
  const destroyLabel = host.querySelector<HTMLElement>("[data-destroy]");
  const ringDetail = host.querySelector<HTMLElement>("[data-ring-detail]");
  const targetDetail = host.querySelector<HTMLElement>("[data-target-detail]");
  if (!canvas || !stage || !framesInput || !objectsInput || !rebuildButton || !slotLabel || !strideLabel || !generationLabel || !destroyLabel || !ringDetail || !targetDetail) {
    throw new Error("Resource pool lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const uniformLayout = gpu.device.createBindGroupLayout({
      label: "lesson-58-ring-uniform-layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform", hasDynamicOffset: true, minBindingSize: uniformStructSize },
        },
      ],
    });
    const presentLayout = gpu.device.createBindGroupLayout({
      label: "lesson-58-present-layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      ],
    });
    const emptyLayout = gpu.device.createBindGroupLayout({
      label: "lesson-58-empty-layout",
      entries: [],
    });
    const emptyBindGroup = gpu.device.createBindGroup({
      label: "lesson-58-empty-bind-group",
      layout: emptyLayout,
      entries: [],
    });
    const scenePipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-58-scene-pipeline-layout",
      bindGroupLayouts: [uniformLayout],
    });
    const presentPipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-58-present-pipeline-layout",
      bindGroupLayouts: [emptyLayout, presentLayout],
    });
    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-58-scene-pipeline",
      layout: scenePipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vsScene" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsScene",
        targets: [{ format: "rgba8unorm" }],
      },
      primitive: { topology: "triangle-list" },
    });
    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-58-present-pipeline",
      layout: presentPipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vsPresent" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsPresent",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const sampler = gpu.device.createSampler({ magFilter: "linear", minFilter: "linear" });
    const stride = alignTo(uniformStructSize, gpu.device.limits.minUniformBufferOffsetAlignment);

    let ring: RingResources | null = null;
    let targets: TransientTargets | null = null;
    let presentBindGroup: GPUBindGroup | null = null;
    let frame = 0;
    let animationFrame = 0;
    let destroyCount = 0;
    let forceTargetRebuild = false;

    const rebuildRing = () => {
      const framesInFlight = Number(framesInput.value);
      if (ring && ring.framesInFlight === framesInFlight) return;
      ring?.buffer.destroy();
      const buffer = gpu.device.createBuffer({
        label: `lesson-58-uniform-ring-${framesInFlight}`,
        size: stride * framesInFlight,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      ring = {
        buffer,
        bindGroup: gpu.device.createBindGroup({
          label: "lesson-58-uniform-ring-bind-group",
          layout: uniformLayout,
          entries: [{ binding: 0, resource: { buffer, size: uniformStructSize } }],
        }),
        stride,
        framesInFlight,
      };
      strideLabel.textContent = `${stride} B`;
      ringDetail.textContent = `${framesInFlight} slots x ${stride} B`;
    };

    const ensureTargets = () => {
      const width = Math.max(1, gpu.context.canvas.width);
      const height = Math.max(1, gpu.context.canvas.height);
      if (targets && !forceTargetRebuild && targets.width === width && targets.height === height) return;
      if (targets) {
        targets.color.destroy();
        destroyCount += 1;
      }
      targets = {
        color: gpu.device.createTexture({
          label: `lesson-58-transient-color-${destroyCount + 1}`,
          size: [width, height],
          format: "rgba8unorm",
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        }),
        width,
        height,
        generation: (targets?.generation ?? 0) + 1,
      };
      presentBindGroup = gpu.device.createBindGroup({
        label: "lesson-58-present-bind-group",
        layout: presentLayout,
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: targets.color.createView() },
        ],
      });
      forceTargetRebuild = false;
      generationLabel.textContent = `${targets.generation}`;
      destroyLabel.textContent = `${destroyCount}`;
      targetDetail.textContent = `${width} x ${height}`;
    };

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      rebuildRing();
      ensureTargets();
      if (!ring || !targets || !presentBindGroup) return;

      frame += 1;
      const objectCount = Number(objectsInput.value);
      const slot = frame % ring.framesInFlight;
      const uniformOffset = slot * ring.stride;
      gpu.device.queue.writeBuffer(
        ring.buffer,
        uniformOffset,
        new Float32Array([frame * 0.016, slot, objectCount, targets.generation])
      );
      slotLabel.textContent = `${slot} / ${ring.framesInFlight}`;

      const commandEncoder = gpu.device.createCommandEncoder({ label: "lesson-58-command-encoder" });
      const scenePass = commandEncoder.beginRenderPass({
        label: "lesson-58-offscreen-scene-pass",
        colorAttachments: [
          {
            view: targets.color.createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      scenePass.setPipeline(scenePipeline);
      scenePass.setBindGroup(0, ring.bindGroup, [uniformOffset]);
      scenePass.draw(6, objectCount);
      scenePass.end();

      const presentPass = commandEncoder.beginRenderPass({
        label: "lesson-58-present-pass",
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
      presentPass.setBindGroup(0, emptyBindGroup);
      presentPass.setBindGroup(1, presentBindGroup);
      presentPass.draw(3);
      presentPass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    framesInput.addEventListener("input", rebuildRing);
    rebuildButton.addEventListener("click", () => {
      forceTargetRebuild = true;
    });
    render();
    setStatus({
      title: "Resource pool 已就绪",
      detail: "Uniform ring 正在循环复用，transient target 只在尺寸或模拟 resize 时重建。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      ring?.buffer.destroy();
      targets?.color.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
