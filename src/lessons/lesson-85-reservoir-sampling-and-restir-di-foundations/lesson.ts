import { createWebGpuCanvas } from "@/core/webgpu";
import { clamp } from "@/lessons/path-tracing-common/math";
import {
  createEmptyReservoir,
  estimateFromReservoir,
  reservoirConfidence,
  updateReservoir,
} from "@/lessons/path-tracing-common/reservoir";
import { createManyLightsRoomPreset } from "@/lessons/path-tracing-common/scene";
import {
  createMulberry32,
  createUniformLightCandidate,
} from "@/lessons/path-tracing-common/sampling";
import visualizationShaderSource from "@/lessons/lesson-85-reservoir-sampling-and-restir-di-foundations/visualization.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type ReservoirSettings = {
  lightCount: number;
  candidatesPerFrame: number;
  animateSeed: boolean;
  freezeStream: boolean;
};

type ReservoirHudRefs = {
  lightRange: HTMLInputElement;
  lightValue: HTMLElement;
  candidateRange: HTMLInputElement;
  candidateValue: HTMLElement;
  animateButton: HTMLButtonElement;
  freezeButton: HTMLButtonElement;
  leftCard: HTMLElement;
  middleCard: HTMLElement;
  rightCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type PanelMetrics = {
  estimate: number;
  selectedIndex: number;
  confidence: number;
  reference: number;
};

type ReservoirGpuState = {
  settingsBuffer: GPUBuffer;
  presentBuffer: GPUBuffer;
  lightsBuffer: GPUBuffer;
  occludersBuffer: GPUBuffer;
  sceneTexture: GPUTexture;
  sceneView: GPUTextureView;
  sampler: GPUSampler;
  sceneBindGroup: GPUBindGroup;
  presentBindGroup: GPUBindGroup;
  activeLightCount: number;
};

const OFFSCREEN_WIDTH = 408;
const OFFSCREEN_HEIGHT = 268;
const LIGHT_STRIDE = 32;
const OCCLUDER_STRIDE = 32;

function segmentIntersectsRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-6) {
      return q >= 0;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) {
        return false;
      }
      if (r > t0) {
        t0 = r;
      }
    } else {
      if (r < t0) {
        return false;
      }
      if (r < t1) {
        t1 = r;
      }
    }
    return true;
  };
  return (
    clip(-dx, ax - rect.x) &&
    clip(dx, rect.x + rect.width - ax) &&
    clip(-dy, ay - rect.y) &&
    clip(dy, rect.y + rect.height - ay) &&
    t1 > t0
  );
}

function evaluateLightContribution(
  receiverX: number,
  receiverY: number,
  light: { position: [number, number]; intensity: number; radius: number; color: [number, number, number] },
  occluders: { x: number; y: number; width: number; height: number }[]
): number {
  for (const occluder of occluders) {
    if (segmentIntersectsRect(receiverX, receiverY, light.position[0], light.position[1], occluder)) {
      return 0;
    }
  }
  const dx = light.position[0] - receiverX;
  const dy = light.position[1] - receiverY;
  const distanceSq = dx * dx + dy * dy;
  const distance = Math.sqrt(distanceSq);
  const normalDot = clamp((receiverY - light.position[1]) / -Math.max(distance, 1e-4), 0.05, 1);
  const luminance = light.color[0] * 0.3 + light.color[1] * 0.59 + light.color[2] * 0.11;
  return (light.intensity * luminance * normalDot * (0.7 + light.radius * 6)) / Math.max(distanceSq * 18, 0.02);
}

function updateHud(
  refs: ReservoirHudRefs,
  settings: ReservoirSettings,
  left: PanelMetrics,
  middle: PanelMetrics,
  reference: number
): void {
  refs.lightValue.textContent = `${settings.lightCount} lights`;
  refs.candidateValue.textContent = `${settings.candidatesPerFrame} candidates`;
  refs.animateButton.classList.toggle("path-trace-toggle--active", settings.animateSeed);
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeStream);
  refs.leftCard.textContent =
    `左栏每次只均匀挑 1 盏灯，再把命中贡献乘回 ${settings.lightCount}；它是无偏的，但会特别依赖运气。`;
  refs.middleCard.textContent =
    `中栏每帧先看 ${settings.candidatesPerFrame} 个候选，再按 reservoir 规则留 1 个代表样本；当前被保留样本约占总权重 ${(middle.confidence * 100).toFixed(1)}%。`;
  refs.rightCard.textContent =
    `右栏把所有灯的 target distribution 直接摊开。当前 reference 约 ${reference.toFixed(3)}；高贡献灯会在这里明显“抬头”。`;
  refs.observationCard.textContent =
    `当前 uniform 估计约 ${left.estimate.toFixed(3)}，reservoir 估计约 ${middle.estimate.toFixed(3)}。下方卡片是并行 CPU 参考统计，GPU 画面则负责把 uniform pick、reservoir pick 和 reference 分布直观画出来。`;
  refs.legend.textContent =
    "这节课现在已经改成 WebGPU 可视化：shader 会在 many-lights 小房间里直接画出 uniform pick、weighted reservoir update 和 reference distribution 的差异。";
}

function createLightData(lightCount: number): Float32Array {
  const preset = createManyLightsRoomPreset(lightCount);
  const data = new Float32Array(Math.max(preset.lights.length, 1) * 8);
  preset.lights.forEach((light, index) => {
    const offset = index * 8;
    data.set([light.position[0], light.position[1], light.radius, light.intensity], offset);
    data.set([light.color[0], light.color[1], light.color[2], 0], offset + 4);
  });
  return data;
}

function createOccluderData(): Float32Array {
  const preset = createManyLightsRoomPreset(16);
  const data = new Float32Array(preset.occluders.length * 8);
  preset.occluders.forEach((occluder, index) => {
    const offset = index * 8;
    data.set([occluder.x, occluder.y, occluder.width, occluder.height], offset);
    data.set([occluder.depth, occluder.roughness, index, 0], offset + 4);
  });
  return data;
}

function createSettingsData(settings: ReservoirSettings, seed: number, time: number): Float32Array {
  const preset = createManyLightsRoomPreset(settings.lightCount);
  return new Float32Array([
    OFFSCREEN_WIDTH,
    OFFSCREEN_HEIGHT,
    settings.lightCount,
    settings.candidatesPerFrame,
    seed,
    0.5,
    preset.receiverY,
    time,
    0,
    0,
    0,
    0,
  ]);
}

function createPresentData(width: number, height: number): Float32Array {
  return new Float32Array([width, height, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT]);
}

function createStorageBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
}

function createUniformBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createSceneTexture(device: GPUDevice): { texture: GPUTexture; view: GPUTextureView } {
  const texture = device.createTexture({
    label: "lesson-85-scene-texture",
    size: [OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT],
    format: "rgba8unorm",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  return {
    texture,
    view: texture.createView(),
  };
}

function createScenePipeline(device: GPUDevice): GPURenderPipeline {
  const module = device.createShaderModule({ code: visualizationShaderSource });
  return device.createRenderPipeline({
    label: "lesson-85-scene-pipeline",
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
    label: "lesson-85-present-pipeline",
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

function rebuildLightBuffer(
  gpu: Awaited<ReturnType<typeof createWebGpuCanvas>>,
  state: ReservoirGpuState,
  scenePipeline: GPURenderPipeline,
  presentPipeline: GPURenderPipeline,
  settings: ReservoirSettings
): void {
  if (state.activeLightCount === settings.lightCount) {
    return;
  }
  state.lightsBuffer.destroy();
  state.lightsBuffer = createStorageBuffer(
    gpu.device,
    Math.max(settings.lightCount, 1) * LIGHT_STRIDE,
    "lesson-85-lights"
  );
  gpu.device.queue.writeBuffer(state.lightsBuffer, 0, createLightData(settings.lightCount));
  state.sceneBindGroup = gpu.device.createBindGroup({
    label: "lesson-85-scene-bind-group",
    layout: scenePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: state.settingsBuffer } },
      { binding: 1, resource: { buffer: state.lightsBuffer } },
      { binding: 2, resource: { buffer: state.occludersBuffer } },
    ],
  });
  state.presentBindGroup = gpu.device.createBindGroup({
    label: "lesson-85-present-bind-group",
    layout: presentPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: state.sceneView },
      { binding: 1, resource: state.sampler },
      { binding: 2, resource: { buffer: state.presentBuffer } },
    ],
  });
  state.activeLightCount = settings.lightCount;
}

export async function mountReservoirSamplingAndRestirDiFoundationsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--reservoir-foundations">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">one receiver, many tiny lights</span>
          <span class="path-trace-badge path-trace-badge--warm">left: uniform one-light pick</span>
          <span class="path-trace-badge path-trace-badge--cool">middle: weighted reservoir update</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Light Count</span>
            <strong id="reservoir-light-value"></strong>
            <input id="reservoir-light-range" type="range" min="16" max="96" step="8" />
          </label>
          <label class="path-trace-control">
            <span>Candidates / Frame</span>
            <strong id="reservoir-candidate-value"></strong>
            <input id="reservoir-candidate-range" type="range" min="2" max="24" step="1" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Seed</span>
            <strong>Animate Seed</strong>
            <div class="path-trace-toggle-row">
              <button id="reservoir-animate-button" class="path-trace-toggle" type="button">animate</button>
            </div>
          </div>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Stream</span>
            <strong>Freeze Sample Stream</strong>
            <div class="path-trace-toggle-row">
              <button id="reservoir-freeze-button" class="path-trace-toggle" type="button">freeze</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--three">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Uniform One-light Pick</strong>
            <span>每帧只随机挑 1 盏灯，然后把结果乘回灯数。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">中栏</span>
            <strong>Weighted Reservoir Update</strong>
            <span>先看多个候选，再只保留 1 个代表样本。</span>
          </article>
          <article class="path-trace-label">
            <span class="eyebrow">右栏</span>
            <strong>Reference / Distribution</strong>
            <span>把所有灯的贡献分布直接摊开，看 reservoir 为什么更爱高贡献候选。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="reservoir-foundations-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Uniform</span><strong id="reservoir-left-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Reservoir</span><strong id="reservoir-middle-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Reference</span><strong id="reservoir-right-card"></strong></article>
        </div>
        <article class="path-trace-card">
          <span class="eyebrow">观察</span>
          <strong id="reservoir-observation-card"></strong>
        </article>
        <aside class="path-trace-legend">
          <strong>本课结论</strong>
          <span id="reservoir-legend"></span>
        </aside>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#reservoir-foundations-canvas");
  const lightRange = host.querySelector<HTMLInputElement>("#reservoir-light-range");
  const candidateRange = host.querySelector<HTMLInputElement>("#reservoir-candidate-range");
  const animateButton = host.querySelector<HTMLButtonElement>("#reservoir-animate-button");
  const freezeButton = host.querySelector<HTMLButtonElement>("#reservoir-freeze-button");
  const lightValue = host.querySelector<HTMLElement>("#reservoir-light-value");
  const candidateValue = host.querySelector<HTMLElement>("#reservoir-candidate-value");
  const leftCard = host.querySelector<HTMLElement>("#reservoir-left-card");
  const middleCard = host.querySelector<HTMLElement>("#reservoir-middle-card");
  const rightCard = host.querySelector<HTMLElement>("#reservoir-right-card");
  const observationCard = host.querySelector<HTMLElement>("#reservoir-observation-card");
  const legend = host.querySelector<HTMLElement>("#reservoir-legend");

  if (
    !canvas ||
    !lightRange ||
    !candidateRange ||
    !animateButton ||
    !freezeButton ||
    !lightValue ||
    !candidateValue ||
    !leftCard ||
    !middleCard ||
    !rightCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("Lesson 85 failed to bind DOM nodes.");
  }

  const refs: ReservoirHudRefs = {
    lightRange,
    lightValue,
    candidateRange,
    candidateValue,
    animateButton,
    freezeButton,
    leftCard,
    middleCard,
    rightCard,
    observationCard,
    legend,
  };

  const settings: ReservoirSettings = {
    lightCount: 48,
    candidatesPerFrame: 8,
    animateSeed: true,
    freezeStream: false,
  };

  lightRange.value = `${settings.lightCount}`;
  candidateRange.value = `${settings.candidatesPerFrame}`;

  const gpu = await createWebGpuCanvas(canvas);
  const scenePipeline = createScenePipeline(gpu.device);
  const presentPipeline = createPresentPipeline(gpu.device, gpu.format);
  const settingsBuffer = createUniformBuffer(gpu.device, 48, "lesson-85-settings");
  const presentBuffer = createUniformBuffer(gpu.device, 16, "lesson-85-present");
  const occludersBuffer = createStorageBuffer(gpu.device, 6 * OCCLUDER_STRIDE, "lesson-85-occluders");
  gpu.device.queue.writeBuffer(occludersBuffer, 0, createOccluderData());
  const lightsBuffer = createStorageBuffer(gpu.device, 96 * LIGHT_STRIDE, "lesson-85-lights");
  const sceneTarget = createSceneTexture(gpu.device);
  const sampler = gpu.device.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });
  const state: ReservoirGpuState = {
    settingsBuffer,
    presentBuffer,
    lightsBuffer,
    occludersBuffer,
    sceneTexture: sceneTarget.texture,
    sceneView: sceneTarget.view,
    sampler,
    sceneBindGroup: gpu.device.createBindGroup({
      label: "lesson-85-scene-bind-group",
      layout: scenePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: settingsBuffer } },
        { binding: 1, resource: { buffer: lightsBuffer } },
        { binding: 2, resource: { buffer: occludersBuffer } },
      ],
    }),
    presentBindGroup: gpu.device.createBindGroup({
      label: "lesson-85-present-bind-group",
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sceneTarget.view },
        { binding: 1, resource: sampler },
        { binding: 2, resource: { buffer: presentBuffer } },
      ],
    }),
    activeLightCount: -1,
  };

  let frozenSeed = 0;
  let frameHandle = 0;
  let disposed = false;

  const render = (time: number) => {
    if (disposed) {
      return;
    }

    gpu.resize();
    rebuildLightBuffer(gpu, state, scenePipeline, presentPipeline, settings);

    const seed = settings.freezeStream
      ? frozenSeed
      : settings.animateSeed
        ? Math.floor(time * 0.001 * 7)
        : 0;
    frozenSeed = seed;
    const random = createMulberry32(seed + settings.lightCount * 13 + settings.candidatesPerFrame * 17);
    const preset = createManyLightsRoomPreset(settings.lightCount);
    const receiverX = 0.5;
    const receiverY = preset.receiverY;
    const contributions = preset.lights.map((light) =>
      evaluateLightContribution(receiverX, receiverY, light, preset.occluders)
    );
    const reference = contributions.reduce((sum, value) => sum + value, 0);

    const uniformIndex = Math.floor(random() * preset.lights.length);
    const uniformEstimate = contributions[uniformIndex] * preset.lights.length;

    const reservoir = createEmptyReservoir<number>();
    for (let candidateIndex = 0; candidateIndex < settings.candidatesPerFrame; candidateIndex += 1) {
      const lightIndex = Math.floor(random() * preset.lights.length);
      const candidate = createUniformLightCandidate(
        lightIndex,
        preset.lights.length,
        contributions[lightIndex]
      );
      updateReservoir(
        reservoir,
        candidate.lightIndex,
        candidate.targetValue,
        candidate.proposalPdf,
        random()
      );
    }
    const reservoirEstimate = estimateFromReservoir(reservoir);
    const leftMetrics: PanelMetrics = {
      estimate: uniformEstimate,
      selectedIndex: uniformIndex,
      confidence: contributions[uniformIndex],
      reference,
    };
    const middleMetrics: PanelMetrics = {
      estimate: reservoirEstimate,
      selectedIndex: reservoir.sample ?? 0,
      confidence: reservoirConfidence(reservoir),
      reference,
    };
    updateHud(refs, settings, leftMetrics, middleMetrics, reference);

    gpu.device.queue.writeBuffer(
      state.settingsBuffer,
      0,
      createSettingsData(settings, seed, time * 0.001)
    );
    gpu.device.queue.writeBuffer(
      state.presentBuffer,
      0,
      createPresentData(canvas.width, canvas.height)
    );

    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-85-command-encoder",
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
    presentPass.setBindGroup(0, state.presentBindGroup);
    presentPass.draw(3);
    presentPass.end();

    gpu.device.queue.submit([encoder.finish()]);
    frameHandle = requestAnimationFrame(render);
  };

  lightRange.addEventListener("input", () => {
    settings.lightCount = Number(lightRange.value);
  });
  candidateRange.addEventListener("input", () => {
    settings.candidatesPerFrame = Number(candidateRange.value);
  });
  animateButton.addEventListener("click", () => {
    settings.animateSeed = !settings.animateSeed;
  });
  freezeButton.addEventListener("click", () => {
    settings.freezeStream = !settings.freezeStream;
  });

  setStatus({
    title: "Reservoir Sampling 与 ReSTIR DI 基础已运行",
    detail:
      "现在这节课的主画面已经迁成 WebGPU：shader 会直接画出 uniform one-light pick、weighted reservoir update 和 reference distribution 的三栏对照。",
    tone: "ok",
  });

  frameHandle = requestAnimationFrame(render);
  return () => {
    disposed = true;
    cancelAnimationFrame(frameHandle);
    state.sceneTexture.destroy();
    state.lightsBuffer.destroy();
    state.occludersBuffer.destroy();
    state.settingsBuffer.destroy();
    state.presentBuffer.destroy();
  };
}
