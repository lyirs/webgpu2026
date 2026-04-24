import { createWebGpuCanvas } from "@/core/webgpu";
import visualizationShaderSource from "@/lessons/lesson-87-spatial-reservoir-reuse-and-neighborhood-resampling/visualization.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type SpatialSettings = {
  neighborRadius: number;
  maxNeighbors: number;
  compatibility: number;
  freezeSeed: boolean;
};

type SpatialHudRefs = {
  radiusRange: HTMLInputElement;
  radiusValue: HTMLElement;
  neighborRange: HTMLInputElement;
  neighborValue: HTMLElement;
  compatibilityRange: HTMLInputElement;
  compatibilityValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  leftCard: HTMLElement;
  middleCard: HTMLElement;
  rightCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SpatialGpuState = {
  settingsBuffer: GPUBuffer;
  presentBuffer: GPUBuffer;
  sceneTexture: GPUTexture;
  sceneView: GPUTextureView;
  sampler: GPUSampler;
  sceneBindGroup: GPUBindGroup;
  presentBindGroup: GPUBindGroup;
};

const OFFSCREEN_WIDTH = 540;
const OFFSCREEN_HEIGHT = 300;

function createUniformBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createSceneTexture(device: GPUDevice): { texture: GPUTexture; view: GPUTextureView } {
  const texture = device.createTexture({
    label: "lesson-87-scene-texture",
    size: [OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT],
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  return {
    texture,
    view: texture.createView(),
  };
}

function createSettingsData(settings: SpatialSettings, time: number, seed: number): Float32Array {
  return new Float32Array([
    OFFSCREEN_WIDTH,
    OFFSCREEN_HEIGHT,
    settings.neighborRadius,
    settings.maxNeighbors,
    settings.compatibility,
    time,
    seed,
    0,
    0,
    0,
  ]);
}

function createPresentData(width: number, height: number): Float32Array {
  return new Float32Array([width, height, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT]);
}

function createScenePipeline(device: GPUDevice): GPURenderPipeline {
  const module = device.createShaderModule({ code: visualizationShaderSource });
  return device.createRenderPipeline({
    label: "lesson-87-scene-pipeline",
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vsFullscreen",
    },
    fragment: {
      module,
      entryPoint: "fsVisualize",
      targets: [{ format: "rgba8unorm" }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function createPresentPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const module = device.createShaderModule({ code: visualizationShaderSource });
  return device.createRenderPipeline({
    label: "lesson-87-present-pipeline",
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vsFullscreen",
    },
    fragment: {
      module,
      entryPoint: "fsPresent",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function updateHud(refs: SpatialHudRefs, settings: SpatialSettings): void {
  refs.radiusValue.textContent = `${settings.neighborRadius.toFixed(0)} px`;
  refs.neighborValue.textContent = `${settings.maxNeighbors.toFixed(0)} neighbors`;
  refs.compatibilityValue.textContent = `${settings.compatibility.toFixed(2)}x`;
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeSeed);
  refs.leftCard.textContent =
    "左栏只保留当前像素自己的 local reservoir：没有邻域帮助，所以仍然能看到结构内的随机起伏。";
  refs.middleCard.textContent =
    "中栏会尽量吃进附近 reservoir，不管邻居是不是同一种表面；橙色污染越多，说明借错邻居越严重。";
  refs.rightCard.textContent =
    `右栏会先过 compatibility threshold，再决定邻域 reservoir 能不能借；蓝色稳定区表示通过验证的邻域复用。`;
  refs.observationCard.textContent =
    settings.neighborRadius <= 1.5
      ? "当前 reuse 半径较小，重点看中栏和右栏在物体边界附近的污染差异。"
      : "reuse 半径拉大以后，中栏会更容易串色；右栏仍会尽量把不兼容邻居挡掉。";
  refs.legend.textContent =
    "这节课现在改成了 WebGPU shader 可视化：local reservoir、naive spatial reuse 和 validated spatial reuse 都直接在 GPU 上重建成热力图。";
}

export async function mountSpatialReservoirReuseAndNeighborhoodResamplingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--spatial-reservoir">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">local reservoir vs spatial reuse</span>
          <span class="path-trace-badge path-trace-badge--warm">middle: naive neighbor reuse</span>
          <span class="path-trace-badge path-trace-badge--cool">right: compatibility-gated reuse</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Neighbor Radius</span>
            <strong id="spatial-radius-value"></strong>
            <input id="spatial-radius-range" type="range" min="1" max="4" step="1" />
          </label>
          <label class="path-trace-control">
            <span>Max Neighbors</span>
            <strong id="spatial-neighbor-value"></strong>
            <input id="spatial-neighbor-range" type="range" min="2" max="16" step="1" />
          </label>
          <label class="path-trace-control">
            <span>Compatibility</span>
            <strong id="spatial-compatibility-value"></strong>
            <input id="spatial-compatibility-range" type="range" min="0.1" max="1.0" step="0.05" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Seed</span>
            <strong>Freeze Seed</strong>
            <div class="path-trace-toggle-row">
              <button id="spatial-freeze-button" class="path-trace-toggle" type="button">freeze</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--three">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Local Reservoir Only</strong>
            <span>当前像素只保留自己的 reservoir，不借邻居。</span>
          </article>
          <article class="path-trace-label path-trace-label--warm">
            <span class="eyebrow">中栏</span>
            <strong>Naive Spatial Reuse</strong>
            <span>只要离得近就借，边界最容易被误抹。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Validated Spatial Reuse</strong>
            <span>先看 depth / roughness 是否接近，再借邻居。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="spatial-reservoir-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Local</span><strong id="spatial-left-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Naive</span><strong id="spatial-middle-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Validated</span><strong id="spatial-right-card"></strong></article>
        </div>
        <article class="path-trace-card">
          <span class="eyebrow">观察</span>
          <strong id="spatial-observation-card"></strong>
        </article>
        <aside class="path-trace-legend">
          <strong>本课结论</strong>
          <span id="spatial-legend"></span>
        </aside>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#spatial-reservoir-canvas");
  const radiusRange = host.querySelector<HTMLInputElement>("#spatial-radius-range");
  const neighborRange = host.querySelector<HTMLInputElement>("#spatial-neighbor-range");
  const compatibilityRange = host.querySelector<HTMLInputElement>("#spatial-compatibility-range");
  const freezeButton = host.querySelector<HTMLButtonElement>("#spatial-freeze-button");
  const radiusValue = host.querySelector<HTMLElement>("#spatial-radius-value");
  const neighborValue = host.querySelector<HTMLElement>("#spatial-neighbor-value");
  const compatibilityValue = host.querySelector<HTMLElement>("#spatial-compatibility-value");
  const leftCard = host.querySelector<HTMLElement>("#spatial-left-card");
  const middleCard = host.querySelector<HTMLElement>("#spatial-middle-card");
  const rightCard = host.querySelector<HTMLElement>("#spatial-right-card");
  const observationCard = host.querySelector<HTMLElement>("#spatial-observation-card");
  const legend = host.querySelector<HTMLElement>("#spatial-legend");

  if (
    !canvas ||
    !radiusRange ||
    !neighborRange ||
    !compatibilityRange ||
    !freezeButton ||
    !radiusValue ||
    !neighborValue ||
    !compatibilityValue ||
    !leftCard ||
    !middleCard ||
    !rightCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("Lesson 87 failed to bind DOM nodes.");
  }

  const refs: SpatialHudRefs = {
    radiusRange,
    radiusValue,
    neighborRange,
    neighborValue,
    compatibilityRange,
    compatibilityValue,
    freezeButton,
    leftCard,
    middleCard,
    rightCard,
    observationCard,
    legend,
  };

  const settings: SpatialSettings = {
    neighborRadius: 3,
    maxNeighbors: 12,
    compatibility: 0.52,
    freezeSeed: false,
  };

  radiusRange.value = `${settings.neighborRadius}`;
  neighborRange.value = `${settings.maxNeighbors}`;
  compatibilityRange.value = `${settings.compatibility}`;

  const gpu = await createWebGpuCanvas(canvas);
  const scenePipeline = createScenePipeline(gpu.device);
  const presentPipeline = createPresentPipeline(gpu.device, gpu.format);
  const settingsBuffer = createUniformBuffer(gpu.device, 40, "lesson-87-settings");
  const presentBuffer = createUniformBuffer(gpu.device, 16, "lesson-87-present");
  const sceneTarget = createSceneTexture(gpu.device);
  const sampler = gpu.device.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  const state: SpatialGpuState = {
    settingsBuffer,
    presentBuffer,
    sceneTexture: sceneTarget.texture,
    sceneView: sceneTarget.view,
    sampler,
    sceneBindGroup: gpu.device.createBindGroup({
      label: "lesson-87-scene-bind-group",
      layout: scenePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: settingsBuffer } }],
    }),
    presentBindGroup: gpu.device.createBindGroup({
      label: "lesson-87-present-bind-group",
      layout: presentPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: sceneTarget.view },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: presentBuffer } },
      ],
    }),
  };

  let frozenSeed = 0;
  let frozenTime = 0;
  let frameHandle = 0;
  let disposed = false;

  const render = (time: number) => {
    if (disposed) {
      return;
    }
    gpu.resize();
    updateHud(refs, settings);
    const effectiveTime = settings.freezeSeed ? frozenTime : time * 0.001;
    const seed = settings.freezeSeed ? frozenSeed : Math.floor(effectiveTime * 11);
    frozenSeed = seed;
    frozenTime = effectiveTime;
    gpu.device.queue.writeBuffer(
      state.settingsBuffer,
      0,
      createSettingsData(settings, effectiveTime, seed)
    );
    gpu.device.queue.writeBuffer(
      state.presentBuffer,
      0,
      createPresentData(canvas.width, canvas.height)
    );

    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-87-command-encoder",
    });
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: state.sceneView,
          clearValue: { r: 0.03, g: 0.05, b: 0.08, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    scenePass.setPipeline(scenePipeline);
    scenePass.setBindGroup(0, state.sceneBindGroup);
    scenePass.draw(3);
    scenePass.end();

    const presentPass = encoder.beginRenderPass({
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
    presentPass.setBindGroup(1, state.presentBindGroup);
    presentPass.draw(3);
    presentPass.end();

    gpu.device.queue.submit([encoder.finish()]);
    frameHandle = requestAnimationFrame(render);
  };

  radiusRange.addEventListener("input", () => {
    settings.neighborRadius = Number(radiusRange.value);
  });
  neighborRange.addEventListener("input", () => {
    settings.maxNeighbors = Number(neighborRange.value);
  });
  compatibilityRange.addEventListener("input", () => {
    settings.compatibility = Number(compatibilityRange.value);
  });
  freezeButton.addEventListener("click", () => {
    settings.freezeSeed = !settings.freezeSeed;
  });

  setStatus({
    title: "Spatial Reservoir Reuse 与邻域重采样已运行",
    detail:
      "这节课现在也是 WebGPU 版：左栏只保留当前像素的 local reservoir，中栏做 naive spatial reuse，右栏再加 compatibility 筛选来保边。",
    tone: "ok",
  });

  frameHandle = requestAnimationFrame(render);
  return () => {
    disposed = true;
    cancelAnimationFrame(frameHandle);
    state.sceneTexture.destroy();
    state.settingsBuffer.destroy();
    state.presentBuffer.destroy();
  };
}
