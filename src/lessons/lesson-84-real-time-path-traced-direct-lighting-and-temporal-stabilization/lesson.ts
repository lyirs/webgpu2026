import { createWebGpuCanvas } from "@/core/webgpu";
import accumulationShaderSource from "@/lessons/lesson-84-real-time-path-traced-direct-lighting-and-temporal-stabilization/accumulate.compute.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-84-real-time-path-traced-direct-lighting-and-temporal-stabilization/present.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type StabilizationSettings = {
  motionMode: "orbit" | "static";
  historyBlend: number;
  clampStrength: number;
  freezeCamera: boolean;
};

type StabilizationHudRefs = {
  blendRange: HTMLInputElement;
  blendValue: HTMLElement;
  clampRange: HTMLInputElement;
  clampValue: HTMLElement;
  motionOrbitButton: HTMLButtonElement;
  motionStaticButton: HTMLButtonElement;
  freezeButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  currentCard: HTMLElement;
  naiveCard: HTMLElement;
  stabilizedCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type HistoryState = {
  frames: number;
  rejections: number;
  lastOffset: number;
};

type TemporalGpuState = {
  settingsBuffer: GPUBuffer;
  presentBuffer: GPUBuffer;
  currentBuffer: GPUBuffer;
  naiveBuffers: [GPUBuffer, GPUBuffer];
  stabilizedBuffers: [GPUBuffer, GPUBuffer];
  computeBindGroups: [GPUBindGroup, GPUBindGroup];
  presentBindGroups: [GPUBindGroup, GPUBindGroup];
  activeIndex: 0 | 1;
};

const IMAGE_WIDTH = 176;
const IMAGE_HEIGHT = 120;
const PIXEL_STRIDE = 16;

function updateHud(
  refs: StabilizationHudRefs,
  settings: StabilizationSettings,
  history: HistoryState
): void {
  refs.blendValue.textContent = settings.historyBlend.toFixed(2);
  refs.clampValue.textContent = settings.clampStrength.toFixed(2);
  refs.motionOrbitButton.classList.toggle("path-trace-toggle--active", settings.motionMode === "orbit");
  refs.motionStaticButton.classList.toggle("path-trace-toggle--active", settings.motionMode === "static");
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeCamera);
  refs.currentCard.textContent =
    "左栏始终只看当前帧 1 spp noisy signal，所以它永远最抖，但也最诚实地暴露了 stochastic 输入本身。";
  refs.naiveCard.textContent =
    `中栏目前累计约 ${history.frames} 帧；静止时它会收敛，但一旦视角移动，旧 history 仍会留在错误的位置。`;
  refs.stabilizedCard.textContent =
    `右栏当前累计约 ${history.frames} 帧，history rejection 估计约 ${history.rejections}；reprojection 和 clamp 会主动丢掉一部分不可信的旧值。`;
  refs.observationCard.textContent =
    settings.motionMode === "orbit" && !settings.freezeCamera
      ? "当前相机在慢速 orbit，所以中栏会比右栏更容易拖出脏 history；这正是 temporal stabilization 真正有用的时刻。"
      : "当前相机几乎静止，所以中栏和右栏都会收敛；区别主要来自右栏会更克制地保留 history。";
  refs.legend.textContent =
    "这节课现在真的走了 GPU temporal 链：compute pass 会在 GPU 上更新 current、naive 与 stabilized 三份 buffer，再由 present shader 拼成三栏。";
}

function createUniformBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createStorageBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
}

function createSettingsData(
  settings: StabilizationSettings,
  frameIndex: number,
  cameraOffset: number,
  previousOffset: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(32);
  const u32 = new Uint32Array(buffer);
  const f32 = new Float32Array(buffer);
  u32[0] = IMAGE_WIDTH;
  u32[1] = IMAGE_HEIGHT;
  u32[2] = frameIndex;
  u32[3] = settings.motionMode === "orbit" ? 1 : 0;
  f32[4] = settings.historyBlend;
  f32[5] = settings.clampStrength;
  f32[6] = cameraOffset;
  f32[7] = previousOffset;
  return buffer;
}

function createPresentData(width: number, height: number): Float32Array {
  return new Float32Array([width, height, IMAGE_WIDTH, IMAGE_HEIGHT]);
}

function createComputePipeline(device: GPUDevice): GPUComputePipeline {
  const module = device.createShaderModule({ code: accumulationShaderSource });
  return device.createComputePipeline({
    label: "lesson-84-compute-pipeline",
    layout: "auto",
    compute: {
      module,
      entryPoint: "updateHistories",
    },
  });
}

function createPresentPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const module = device.createShaderModule({ code: presentShaderSource });
  return device.createRenderPipeline({
    label: "lesson-84-present-pipeline",
    layout: "auto",
    vertex: { module, entryPoint: "vsFullscreen" },
    fragment: { module, entryPoint: "fsPresent", targets: [{ format }] },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });
}

function createGpuState(
  device: GPUDevice,
  computePipeline: GPUComputePipeline,
  presentPipeline: GPURenderPipeline
): TemporalGpuState {
  const pixelBytes = IMAGE_WIDTH * IMAGE_HEIGHT * PIXEL_STRIDE;
  const settingsBuffer = createUniformBuffer(device, 32, "lesson-84-settings");
  const presentBuffer = createUniformBuffer(device, 16, "lesson-84-present");
  const currentBuffer = createStorageBuffer(device, pixelBytes, "lesson-84-current");
  const naiveBuffers: [GPUBuffer, GPUBuffer] = [
    createStorageBuffer(device, pixelBytes, "lesson-84-naive-a"),
    createStorageBuffer(device, pixelBytes, "lesson-84-naive-b"),
  ];
  const stabilizedBuffers: [GPUBuffer, GPUBuffer] = [
    createStorageBuffer(device, pixelBytes, "lesson-84-stabilized-a"),
    createStorageBuffer(device, pixelBytes, "lesson-84-stabilized-b"),
  ];

  const makeComputeBindGroup = (readIndex: 0 | 1) =>
    device.createBindGroup({
      label: `lesson-84-compute-bind-group-${readIndex}`,
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: settingsBuffer } },
        { binding: 1, resource: { buffer: currentBuffer } },
        { binding: 2, resource: { buffer: naiveBuffers[readIndex] } },
        { binding: 3, resource: { buffer: naiveBuffers[readIndex === 0 ? 1 : 0] } },
        { binding: 4, resource: { buffer: stabilizedBuffers[readIndex] } },
        { binding: 5, resource: { buffer: stabilizedBuffers[readIndex === 0 ? 1 : 0] } },
      ],
    });

  const makePresentBindGroup = (activeIndex: 0 | 1) =>
    device.createBindGroup({
      label: `lesson-84-present-bind-group-${activeIndex}`,
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: presentBuffer } },
        { binding: 1, resource: { buffer: currentBuffer } },
        { binding: 2, resource: { buffer: naiveBuffers[activeIndex] } },
        { binding: 3, resource: { buffer: stabilizedBuffers[activeIndex] } },
      ],
    });

  return {
    settingsBuffer,
    presentBuffer,
    currentBuffer,
    naiveBuffers,
    stabilizedBuffers,
    computeBindGroups: [makeComputeBindGroup(0), makeComputeBindGroup(1)],
    presentBindGroups: [makePresentBindGroup(0), makePresentBindGroup(1)],
    activeIndex: 0,
  };
}

export async function mountRealTimePathTracedDirectLightingAndTemporalStabilizationLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--path-stabilization">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">same noisy direct-light signal, three history strategies</span>
          <span class="path-trace-badge path-trace-badge--warm">left: 1 spp current</span>
          <span class="path-trace-badge">middle: naive accumulation</span>
          <span class="path-trace-badge path-trace-badge--cool">right: reprojected + clamped</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>History Blend</span>
            <strong id="stabilization-blend-value"></strong>
            <input id="stabilization-blend-range" type="range" min="0.80" max="0.98" step="0.01" />
          </label>
          <label class="path-trace-control">
            <span>Clamp Strength</span>
            <strong id="stabilization-clamp-value"></strong>
            <input id="stabilization-clamp-range" type="range" min="0.2" max="1.4" step="0.05" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Motion Mode</span>
            <strong>Camera Motion</strong>
            <div class="path-trace-toggle-row">
              <button id="stabilization-motion-orbit" class="path-trace-toggle" type="button">orbit</button>
              <button id="stabilization-motion-static" class="path-trace-toggle" type="button">static</button>
            </div>
          </div>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Camera</span>
            <strong>Freeze Camera</strong>
            <div class="path-trace-toggle-row">
              <button id="stabilization-freeze-button" class="path-trace-toggle" type="button">freeze</button>
              <button id="stabilization-reset-button" class="path-trace-toggle" type="button">reset history</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--three">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>1 spp Current</strong>
            <span>永远只看当前 noisy signal，所以最抖，但也最诚实地暴露了 stochastic 输入本身。</span>
          </article>
          <article class="path-trace-label">
            <span class="eyebrow">中栏</span>
            <strong>Naive Accumulation</strong>
            <span>静止时会收敛，但一旦视角移动，旧 history 会直接拖在错误位置上。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Reprojected + Clamped</strong>
            <span>先把 history 带回来，再决定它值不值得继续信，这才是“更接近实时系统”的 temporal 链。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="stabilization-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Current</span><strong id="stabilization-current-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Naive</span><strong id="stabilization-naive-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Stabilized</span><strong id="stabilization-stabilized-card"></strong></article>
        </div>
        <article class="path-trace-observation">
          <span class="eyebrow">当前实验</span>
          <strong id="stabilization-observation-card"></strong>
        </article>
        <p id="stabilization-legend" class="path-trace-legend"></p>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#stabilization-canvas");
  if (!canvas) {
    throw new Error("lesson 84 canvas not found");
  }

  const refs: StabilizationHudRefs = {
    blendRange: host.querySelector<HTMLInputElement>("#stabilization-blend-range")!,
    blendValue: host.querySelector<HTMLElement>("#stabilization-blend-value")!,
    clampRange: host.querySelector<HTMLInputElement>("#stabilization-clamp-range")!,
    clampValue: host.querySelector<HTMLElement>("#stabilization-clamp-value")!,
    motionOrbitButton: host.querySelector<HTMLButtonElement>("#stabilization-motion-orbit")!,
    motionStaticButton: host.querySelector<HTMLButtonElement>("#stabilization-motion-static")!,
    freezeButton: host.querySelector<HTMLButtonElement>("#stabilization-freeze-button")!,
    resetButton: host.querySelector<HTMLButtonElement>("#stabilization-reset-button")!,
    currentCard: host.querySelector<HTMLElement>("#stabilization-current-card")!,
    naiveCard: host.querySelector<HTMLElement>("#stabilization-naive-card")!,
    stabilizedCard: host.querySelector<HTMLElement>("#stabilization-stabilized-card")!,
    observationCard: host.querySelector<HTMLElement>("#stabilization-observation-card")!,
    legend: host.querySelector<HTMLElement>("#stabilization-legend")!,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const computePipeline = createComputePipeline(gpu.device);
  const presentPipeline = createPresentPipeline(gpu.device, gpu.format);
  const gpuState = createGpuState(gpu.device, computePipeline, presentPipeline);

  const settings: StabilizationSettings = {
    motionMode: "orbit",
    historyBlend: 0.9,
    clampStrength: 0.6,
    freezeCamera: false,
  };
  const history: HistoryState = {
    frames: 0,
    rejections: 0,
    lastOffset: 0,
  };

  refs.blendRange.value = String(settings.historyBlend);
  refs.clampRange.value = String(settings.clampStrength);

  let frameIndex = 0;
  let orbitPhase = 0;
  let previousOffset = 0;
  let resetRequested = false;
  let rafId = 0;

  const resetHistory = () => {
    frameIndex = 0;
    previousOffset = 0;
    history.frames = 0;
    history.rejections = 0;
    history.lastOffset = 0;
    resetRequested = true;
    updateHud(refs, settings, history);
  };

  const syncSettings = () => {
    settings.historyBlend = Number(refs.blendRange.value);
    settings.clampStrength = Number(refs.clampRange.value);
    resetHistory();
  };

  refs.blendRange.addEventListener("input", syncSettings);
  refs.clampRange.addEventListener("input", syncSettings);
  refs.motionOrbitButton.addEventListener("click", () => {
    settings.motionMode = "orbit";
    resetHistory();
  });
  refs.motionStaticButton.addEventListener("click", () => {
    settings.motionMode = "static";
    resetHistory();
  });
  refs.freezeButton.addEventListener("click", () => {
    settings.freezeCamera = !settings.freezeCamera;
    updateHud(refs, settings, history);
  });
  refs.resetButton.addEventListener("click", resetHistory);

  updateHud(refs, settings, history);
  setStatus({
    title: "Temporal stabilization 已运行",
    detail:
      "这节现在会先在 compute pass 里更新 current / naive / stabilized 三份历史，再由 present shader 直接把三栏画出来。",
    tone: "ok",
  });

  const render = () => {
    gpu.resize();
    if (settings.motionMode === "orbit" && !settings.freezeCamera) {
      orbitPhase += 0.035;
    }
    const offset = settings.motionMode === "orbit" ? Math.sin(orbitPhase) * 0.72 : 0;
    const effectivePreviousOffset = resetRequested ? offset : previousOffset;
    gpu.device.queue.writeBuffer(
      gpuState.settingsBuffer,
      0,
      createSettingsData(settings, resetRequested ? 0 : frameIndex, offset, effectivePreviousOffset)
    );
    gpu.device.queue.writeBuffer(
      gpuState.presentBuffer,
      0,
      createPresentData(canvas.width, canvas.height)
    );

    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-84-command-encoder",
    });
    const computePass = encoder.beginComputePass({
      label: "lesson-84-compute-pass",
    });
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, gpuState.computeBindGroups[gpuState.activeIndex]);
    computePass.dispatchWorkgroups(Math.ceil(IMAGE_WIDTH / 8), Math.ceil(IMAGE_HEIGHT / 8));
    computePass.end();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpu.context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.03, g: 0.05, b: 0.08, a: 1 },
        },
      ],
    });
    const nextIndex = gpuState.activeIndex === 0 ? 1 : 0;
    pass.setPipeline(presentPipeline);
    pass.setBindGroup(0, gpuState.presentBindGroups[nextIndex]);
    pass.draw(3);
    pass.end();
    gpu.device.queue.submit([encoder.finish()]);

    gpuState.activeIndex = nextIndex as 0 | 1;
    previousOffset = offset;
    history.frames = Math.min(history.frames + 1, 999);
    history.rejections =
      settings.motionMode === "orbit" && !settings.freezeCamera
        ? Math.round(Math.abs(offset - effectivePreviousOffset) * IMAGE_WIDTH * 0.45)
        : Math.round(settings.clampStrength * 8);
    history.lastOffset = offset;
    frameIndex += 1;
    resetRequested = false;
    updateHud(refs, settings, history);
    rafId = requestAnimationFrame(render);
  };

  rafId = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(rafId);
    gpuState.settingsBuffer.destroy();
    gpuState.presentBuffer.destroy();
    gpuState.currentBuffer.destroy();
    gpuState.naiveBuffers[0].destroy();
    gpuState.naiveBuffers[1].destroy();
    gpuState.stabilizedBuffers[0].destroy();
    gpuState.stabilizedBuffers[1].destroy();
  };
}
