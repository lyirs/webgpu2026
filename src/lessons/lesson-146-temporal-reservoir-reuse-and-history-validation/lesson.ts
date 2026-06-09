import { createWebGpuCanvas } from "@/core/webgpu";
import visualizationShaderSource from "@/lessons/lesson-146-temporal-reservoir-reuse-and-history-validation/visualization.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type TemporalSettings = {
  cameraSpeed: number;
  historyBlend: number;
  validationBias: number;
};

type TemporalHudRefs = {
  speedRange: HTMLInputElement;
  speedValue: HTMLElement;
  blendRange: HTMLInputElement;
  blendValue: HTMLElement;
  biasRange: HTMLInputElement;
  biasValue: HTMLElement;
  resetButton: HTMLButtonElement;
  leftCard: HTMLElement;
  middleCard: HTMLElement;
  rightCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type TemporalGpuState = {
  settingsBuffer: GPUBuffer;
  presentBuffer: GPUBuffer;
  displayTextures: [GPUTexture, GPUTexture];
  displayViews: [GPUTextureView, GPUTextureView];
  surfaceTextures: [GPUTexture, GPUTexture];
  surfaceViews: [GPUTextureView, GPUTextureView];
  naiveTextures: [GPUTexture, GPUTexture];
  naiveViews: [GPUTextureView, GPUTextureView];
  validatedTextures: [GPUTexture, GPUTexture];
  validatedViews: [GPUTextureView, GPUTextureView];
  presentSampler: GPUSampler;
  sceneBindGroups: [GPUBindGroup, GPUBindGroup];
  presentBindGroups: [GPUBindGroup, GPUBindGroup];
  activeIndex: 0 | 1;
};

const OFFSCREEN_WIDTH = 396;
const OFFSCREEN_HEIGHT = 248;

function createUniformBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createRenderTexture(
  device: GPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat,
  label: string
): { texture: GPUTexture; view: GPUTextureView } {
  const texture = device.createTexture({
    label,
    size: [width, height],
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  return {
    texture,
    view: texture.createView(),
  };
}

function createSettingsData(settings: TemporalSettings, time: number, resetHistory: boolean): Float32Array {
  return new Float32Array([
    OFFSCREEN_WIDTH,
    OFFSCREEN_HEIGHT,
    settings.cameraSpeed,
    settings.historyBlend,
    settings.validationBias,
    time,
    resetHistory ? 1 : 0,
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
    label: "lesson-86-scene-pipeline",
    layout: "auto",
    vertex: { module, entryPoint: "vsFullscreen" },
    fragment: {
      module,
      entryPoint: "fsVisualize",
      targets: [
        { format: "rgba8unorm" },
        { format: "rgba16float" },
        { format: "rgba16float" },
        { format: "rgba16float" },
      ],
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
    label: "lesson-86-present-pipeline",
    layout: "auto",
    vertex: { module, entryPoint: "vsFullscreen" },
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

function updateHud(refs: TemporalHudRefs, settings: TemporalSettings, resetPending: boolean): void {
  refs.speedValue.textContent = `${settings.cameraSpeed.toFixed(2)}x`;
  refs.blendValue.textContent = `${Math.round(settings.historyBlend * 100)}%`;
  refs.biasValue.textContent = `${settings.validationBias.toFixed(2)}x`;
  refs.leftCard.textContent =
    "左栏只看当前帧：走廊、立柱和前景挡板都停在 current view 上，随机 grain 也会完整暴露出来。";
  refs.middleCard.textContent =
    "中栏会把上一帧 reservoir 直接重投影并并回来，所以静止时更稳；但前景挡板移开时，旧样本也最容易残在画面里。";
  refs.rightCard.textContent =
    "右栏会先过 owner / depth 近似验证，再决定旧 reservoir 能不能合并。validation bias 越紧，遮挡暴露后的恢复越快。";
  refs.observationCard.textContent =
    resetPending
      ? "history 刚刚被重置，所以三栏都会从当前帧重新建立；接下来重点看中栏如何积累错误历史，以及右栏如何拒绝它。"
      : settings.cameraSpeed <= 0.3
        ? "慢速移动时，重点看中栏立柱边缘的旧轮廓，以及右栏更稳的恢复。"
        : "速度拉高以后，前景挡板附近最容易暴露坏 history；右栏应该比中栏更快清掉旧影子。";
  refs.legend.textContent =
    "这节课现在走了真正的 GPU history 双缓冲：当前帧会把 surface 和两份 reservoir state 分开写入，再由下一帧重投影合并。";
}

function createGpuState(
  device: GPUDevice,
  scenePipeline: GPURenderPipeline,
  presentPipeline: GPURenderPipeline
): TemporalGpuState {
  const settingsBuffer = createUniformBuffer(device, 40, "lesson-86-settings");
  const presentBuffer = createUniformBuffer(device, 16, "lesson-86-present");

  const displayA = createRenderTexture(device, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, "rgba8unorm", "lesson-86-display-a");
  const displayB = createRenderTexture(device, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, "rgba8unorm", "lesson-86-display-b");
  const surfaceA = createRenderTexture(device, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, "rgba16float", "lesson-86-surface-a");
  const surfaceB = createRenderTexture(device, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, "rgba16float", "lesson-86-surface-b");
  const naiveA = createRenderTexture(device, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, "rgba16float", "lesson-86-naive-a");
  const naiveB = createRenderTexture(device, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, "rgba16float", "lesson-86-naive-b");
  const validatedA = createRenderTexture(device, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, "rgba16float", "lesson-86-validated-a");
  const validatedB = createRenderTexture(device, OFFSCREEN_WIDTH, OFFSCREEN_HEIGHT, "rgba16float", "lesson-86-validated-b");

  const presentSampler = device.createSampler({
    magFilter: "nearest",
    minFilter: "nearest",
  });

  const displayTextures: [GPUTexture, GPUTexture] = [displayA.texture, displayB.texture];
  const displayViews: [GPUTextureView, GPUTextureView] = [displayA.view, displayB.view];
  const surfaceTextures: [GPUTexture, GPUTexture] = [surfaceA.texture, surfaceB.texture];
  const surfaceViews: [GPUTextureView, GPUTextureView] = [surfaceA.view, surfaceB.view];
  const naiveTextures: [GPUTexture, GPUTexture] = [naiveA.texture, naiveB.texture];
  const naiveViews: [GPUTextureView, GPUTextureView] = [naiveA.view, naiveB.view];
  const validatedTextures: [GPUTexture, GPUTexture] = [validatedA.texture, validatedB.texture];
  const validatedViews: [GPUTextureView, GPUTextureView] = [validatedA.view, validatedB.view];

  const sceneBindGroups: [GPUBindGroup, GPUBindGroup] = [
    device.createBindGroup({
      label: "lesson-86-scene-bind-group-0",
      layout: scenePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: settingsBuffer } },
        { binding: 1, resource: surfaceViews[0] },
        { binding: 2, resource: naiveViews[0] },
        { binding: 3, resource: validatedViews[0] },
      ],
    }),
    device.createBindGroup({
      label: "lesson-86-scene-bind-group-1",
      layout: scenePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: settingsBuffer } },
        { binding: 1, resource: surfaceViews[1] },
        { binding: 2, resource: naiveViews[1] },
        { binding: 3, resource: validatedViews[1] },
      ],
    }),
  ];

  const presentBindGroups: [GPUBindGroup, GPUBindGroup] = [
    device.createBindGroup({
      label: "lesson-86-present-bind-group-0",
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: displayViews[0] },
        { binding: 1, resource: presentSampler },
        { binding: 2, resource: { buffer: presentBuffer } },
      ],
    }),
    device.createBindGroup({
      label: "lesson-86-present-bind-group-1",
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: displayViews[1] },
        { binding: 1, resource: presentSampler },
        { binding: 2, resource: { buffer: presentBuffer } },
      ],
    }),
  ];

  return {
    settingsBuffer,
    presentBuffer,
    displayTextures,
    displayViews,
    surfaceTextures,
    surfaceViews,
    naiveTextures,
    naiveViews,
    validatedTextures,
    validatedViews,
    presentSampler,
    sceneBindGroups,
    presentBindGroups,
    activeIndex: 0,
  };
}

export async function mountTemporalReservoirReuseAndHistoryValidationLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--temporal-reservoir">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">current reservoir vs temporal reuse</span>
          <span class="path-trace-badge path-trace-badge--warm">middle: naive history merge</span>
          <span class="path-trace-badge path-trace-badge--cool">right: validated history reuse</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Camera Speed</span>
            <strong id="temporal-speed-value"></strong>
            <input id="temporal-speed-range" type="range" min="0.05" max="1.2" step="0.05" />
          </label>
          <label class="path-trace-control">
            <span>History Blend</span>
            <strong id="temporal-blend-value"></strong>
            <input id="temporal-blend-range" type="range" min="0.2" max="0.96" step="0.02" />
          </label>
          <label class="path-trace-control">
            <span>Validation Bias</span>
            <strong id="temporal-bias-value"></strong>
            <input id="temporal-bias-range" type="range" min="0.1" max="1.4" step="0.05" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>History</span>
            <strong>Reset History</strong>
            <div class="path-trace-toggle-row">
              <button id="temporal-reset-button" class="path-trace-toggle" type="button">reset</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--three">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Current-frame Reservoir Only</strong>
            <span>只保留当前帧 local reservoir，不拿历史样本来平滑。</span>
          </article>
          <article class="path-trace-label path-trace-label--warm">
            <span class="eyebrow">中栏</span>
            <strong>Naive Temporal Reuse</strong>
            <span>把上一帧 reservoir 直接并回来，不做严格验证。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Validated Temporal Reuse</strong>
            <span>先比对 owner/depth，再决定旧 reservoir 是否还能用。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="temporal-reservoir-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Current</span><strong id="temporal-left-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Naive</span><strong id="temporal-middle-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Validated</span><strong id="temporal-right-card"></strong></article>
        </div>
        <article class="path-trace-card">
          <span class="eyebrow">观察</span>
          <strong id="temporal-observation-card"></strong>
        </article>
        <aside class="path-trace-legend">
          <strong>本课结论</strong>
          <span id="temporal-legend"></span>
        </aside>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#temporal-reservoir-canvas");
  const speedRange = host.querySelector<HTMLInputElement>("#temporal-speed-range");
  const blendRange = host.querySelector<HTMLInputElement>("#temporal-blend-range");
  const biasRange = host.querySelector<HTMLInputElement>("#temporal-bias-range");
  const resetButton = host.querySelector<HTMLButtonElement>("#temporal-reset-button");
  const speedValue = host.querySelector<HTMLElement>("#temporal-speed-value");
  const blendValue = host.querySelector<HTMLElement>("#temporal-blend-value");
  const biasValue = host.querySelector<HTMLElement>("#temporal-bias-value");
  const leftCard = host.querySelector<HTMLElement>("#temporal-left-card");
  const middleCard = host.querySelector<HTMLElement>("#temporal-middle-card");
  const rightCard = host.querySelector<HTMLElement>("#temporal-right-card");
  const observationCard = host.querySelector<HTMLElement>("#temporal-observation-card");
  const legend = host.querySelector<HTMLElement>("#temporal-legend");

  if (
    !canvas ||
    !speedRange ||
    !blendRange ||
    !biasRange ||
    !resetButton ||
    !speedValue ||
    !blendValue ||
    !biasValue ||
    !leftCard ||
    !middleCard ||
    !rightCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("Lesson 86 failed to bind DOM nodes.");
  }

  const refs: TemporalHudRefs = {
    speedRange,
    speedValue,
    blendRange,
    blendValue,
    biasRange,
    biasValue,
    resetButton,
    leftCard,
    middleCard,
    rightCard,
    observationCard,
    legend,
  };

  const settings: TemporalSettings = {
    cameraSpeed: 0.35,
    historyBlend: 0.74,
    validationBias: 0.55,
  };

  speedRange.value = `${settings.cameraSpeed}`;
  blendRange.value = `${settings.historyBlend}`;
  biasRange.value = `${settings.validationBias}`;

  const gpu = await createWebGpuCanvas(canvas);
  const scenePipeline = createScenePipeline(gpu.device);
  const presentPipeline = createPresentPipeline(gpu.device, gpu.format);
  const state = createGpuState(gpu.device, scenePipeline, presentPipeline);

  let resetRequested = true;
  let disposed = false;
  let frameHandle = 0;

  const render = (time: number) => {
    if (disposed) {
      return;
    }
    gpu.resize();
    updateHud(refs, settings, resetRequested);
    const readIndex = state.activeIndex;
    const writeIndex = readIndex === 0 ? 1 : 0;

    gpu.device.queue.writeBuffer(
      state.settingsBuffer,
      0,
      createSettingsData(settings, time * 0.001, resetRequested)
    );
    gpu.device.queue.writeBuffer(
      state.presentBuffer,
      0,
      createPresentData(canvas.width, canvas.height)
    );

    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-86-command-encoder",
    });

    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: state.displayViews[writeIndex],
          clearValue: { r: 0.03, g: 0.05, b: 0.08, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: state.surfaceViews[writeIndex],
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: state.naiveViews[writeIndex],
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: state.validatedViews[writeIndex],
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    scenePass.setPipeline(scenePipeline);
    scenePass.setBindGroup(0, state.sceneBindGroups[readIndex]);
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
    presentPass.setBindGroup(0, state.presentBindGroups[writeIndex]);
    presentPass.draw(3);
    presentPass.end();

    gpu.device.queue.submit([encoder.finish()]);
    state.activeIndex = writeIndex;
    resetRequested = false;
    frameHandle = requestAnimationFrame(render);
  };

  const syncSettings = () => {
    settings.cameraSpeed = Number(speedRange.value);
    settings.historyBlend = Number(blendRange.value);
    settings.validationBias = Number(biasRange.value);
    resetRequested = true;
  };

  speedRange.addEventListener("input", syncSettings);
  blendRange.addEventListener("input", syncSettings);
  biasRange.addEventListener("input", syncSettings);
  resetButton.addEventListener("click", () => {
    resetRequested = true;
    updateHud(refs, settings, true);
  });

  setStatus({
    title: "Temporal Reservoir Reuse 与历史验证已运行",
    detail:
      "这节课现在改成了真正的双缓冲 temporal reservoir lesson：左栏只看当前 reservoir，中栏直接合并上一帧 reservoir，右栏先做 validation 再留历史。",
    tone: "ok",
  });

  frameHandle = requestAnimationFrame(render);
  return () => {
    disposed = true;
    cancelAnimationFrame(frameHandle);
    state.settingsBuffer.destroy();
    state.presentBuffer.destroy();
    state.displayTextures[0].destroy();
    state.displayTextures[1].destroy();
    state.surfaceTextures[0].destroy();
    state.surfaceTextures[1].destroy();
    state.naiveTextures[0].destroy();
    state.naiveTextures[1].destroy();
    state.validatedTextures[0].destroy();
    state.validatedTextures[1].destroy();
  };
}
