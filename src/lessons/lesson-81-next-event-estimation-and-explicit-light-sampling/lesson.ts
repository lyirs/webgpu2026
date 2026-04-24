import { createWebGpuCanvas } from "@/core/webgpu";
import { lerp } from "@/lessons/path-tracing-common/math";
import { createMulberry32 } from "@/lessons/path-tracing-common/sampling";
import visualizationShaderSource from "@/lessons/lesson-81-next-event-estimation-and-explicit-light-sampling/visualization.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type NeeSettings = {
  samplesPerFrame: number;
  maxBounce: number;
  lightSize: number;
  freezeSeed: boolean;
};

type NeeHudRefs = {
  sampleRange: HTMLInputElement;
  sampleValue: HTMLElement;
  bounceRange: HTMLInputElement;
  bounceValue: HTMLElement;
  lightRange: HTMLInputElement;
  lightValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  leftCard: HTMLElement;
  rightCard: HTMLElement;
  statsCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type NeeGpuState = {
  settingsBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

const ROOM = {
  minX: -1.25,
  maxX: 1.25,
  floorY: 0,
  ceilingY: 1.55,
  occluderMinX: -0.18,
  occluderMaxX: 0.22,
  occluderHeight: 0.98,
};

function hitsOccluder(x0: number, y0: number, x1: number, y1: number): boolean {
  const samples = 28;
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (
      x >= ROOM.occluderMinX &&
      x <= ROOM.occluderMaxX &&
      y >= ROOM.floorY &&
      y <= ROOM.occluderHeight
    ) {
      return true;
    }
  }
  return false;
}

function estimateEmissiveHitOnly(
  receiverX: number,
  settings: NeeSettings,
  seed: number
): { value: number; hitRate: number } {
  const random = createMulberry32(seed);
  let contribution = 0;
  let hits = 0;
  for (let sampleIndex = 0; sampleIndex < settings.samplesPerFrame; sampleIndex += 1) {
    let x = receiverX;
    let y = ROOM.floorY + 0.001;
    let alive = true;
    for (let bounce = 0; bounce < settings.maxBounce && alive; bounce += 1) {
      const angle = random() * Math.PI;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      if (dy <= 0) {
        alive = false;
        break;
      }
      const ceilingDistance = (ROOM.ceilingY - y) / Math.max(dy, 1e-4);
      const ceilingX = x + dx * ceilingDistance;
      const hitsEmitter = Math.abs(ceilingX) <= settings.lightSize;
      if (hitsEmitter && !hitsOccluder(x, y, ceilingX, ROOM.ceilingY)) {
        const distance = Math.hypot(ceilingX - x, ROOM.ceilingY - y);
        const cosine = (ROOM.ceilingY - y) / Math.max(distance, 1e-4);
        contribution += cosine * 10.5 / Math.max(distance * distance, 0.3);
        hits += 1;
        alive = false;
        break;
      }
      x += dx * 0.18;
      y += dy * 0.18;
      if (x < ROOM.minX || x > ROOM.maxX || y > ROOM.ceilingY) {
        alive = false;
      }
    }
  }
  return {
    value: contribution / Math.max(settings.samplesPerFrame, 1),
    hitRate: hits / Math.max(settings.samplesPerFrame, 1),
  };
}

function estimateNee(receiverX: number, settings: NeeSettings, seed: number): { value: number; shadowRays: number } {
  const random = createMulberry32(seed);
  let contribution = 0;
  const lightPdf = 1 / Math.max(settings.lightSize * 2, 1e-4);
  let shadowRays = 0;
  for (let sampleIndex = 0; sampleIndex < settings.samplesPerFrame; sampleIndex += 1) {
    let x = receiverX;
    let y = ROOM.floorY + 0.001;
    let alive = true;
    for (let bounce = 0; bounce < settings.maxBounce && alive; bounce += 1) {
      const lightX = (random() * 2 - 1) * settings.lightSize;
      shadowRays += 1;
      if (!hitsOccluder(x, y, lightX, ROOM.ceilingY)) {
        const distance = Math.hypot(lightX - x, ROOM.ceilingY - y);
        const cosine = (ROOM.ceilingY - y) / Math.max(distance, 1e-4);
        const integrand = cosine * 10.5 / Math.max(distance * distance, 0.3);
        contribution += integrand / lightPdf;
        break;
      }
      const angle = random() * Math.PI;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      if (dy <= 0) {
        alive = false;
        break;
      }
      x += dx * 0.18;
      y += dy * 0.18;
      if (x < ROOM.minX || x > ROOM.maxX || y > ROOM.ceilingY) {
        alive = false;
      }
    }
  }
  return {
    value: contribution / Math.max(settings.samplesPerFrame, 1),
    shadowRays,
  };
}

function updateHud(
  refs: NeeHudRefs,
  settings: NeeSettings,
  averageLeft: number,
  averageRight: number,
  hitRate: number
): void {
  refs.sampleValue.textContent = `${settings.samplesPerFrame} spp`;
  refs.bounceValue.textContent = `${settings.maxBounce}`;
  refs.lightValue.textContent = `${(settings.lightSize * 2).toFixed(2)}m`;
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeSeed);
  refs.leftCard.textContent =
    `左栏当前平均亮度约 ${averageLeft.toFixed(2)}；只有随机路径刚好打中小光源时才会亮，所以方差会特别大。`;
  refs.rightCard.textContent =
    `右栏当前平均亮度约 ${averageRight.toFixed(2)}；每个 receiver 都会主动 sample 光源，再用 shadow ray 验证可见性。`;
  refs.statsCard.textContent =
    `当前 emissive-hit 的 light hit rate 约 ${(hitRate * 100).toFixed(1)}%；光源越小，这个命中率下降得越快。`;
  refs.observationCard.textContent =
    settings.lightSize < 0.28
      ? "现在光源很小，所以左栏最容易掉进“绝大多数样本都白跑”的状态；这正是 NEE 的典型用武之地。"
      : "把光源拉大以后，两边都会稳定一点，但右栏依然更像“有目标地把样本打在真正重要的位置”。";
  refs.legend.textContent =
    "这一课的房间和 strip 现在都由 WGSL 直接画出：左栏等路径自己撞灯，右栏则主动 sample 光源并发 shadow ray。";
}

function createSettingsData(
  canvasWidth: number,
  canvasHeight: number,
  settings: NeeSettings,
  time: number
): Float32Array {
  return new Float32Array([
    canvasWidth,
    canvasHeight,
    settings.samplesPerFrame,
    settings.maxBounce,
    settings.lightSize,
    time,
    settings.freezeSeed ? 1 : 0,
    0,
    0,
    0,
  ]);
}

function createUniformBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createScenePipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const module = device.createShaderModule({ code: visualizationShaderSource });
  return device.createRenderPipeline({
    label: "lesson-81-visualization-pipeline",
    layout: "auto",
    vertex: { module, entryPoint: "vsFullscreen" },
    fragment: {
      module,
      entryPoint: "fsVisualize",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function createGpuState(device: GPUDevice, pipeline: GPURenderPipeline): NeeGpuState {
  const settingsBuffer = createUniformBuffer(device, 10 * 4, "lesson-81-settings");
  const bindGroup = device.createBindGroup({
    label: "lesson-81-bind-group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: settingsBuffer } }],
  });
  return { settingsBuffer, bindGroup };
}

export async function mountNextEventEstimationAndExplicitLightSamplingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--nee">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">same receiver strip, different direct-light strategy</span>
          <span class="path-trace-badge path-trace-badge--warm">left: emissive hit only</span>
          <span class="path-trace-badge path-trace-badge--cool">right: next event estimation</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Samples per Frame</span>
            <strong id="nee-sample-value"></strong>
            <input id="nee-sample-range" type="range" min="16" max="192" step="8" />
          </label>
          <label class="path-trace-control">
            <span>Max Bounce</span>
            <strong id="nee-bounce-value"></strong>
            <input id="nee-bounce-range" type="range" min="1" max="5" step="1" />
          </label>
          <label class="path-trace-control">
            <span>Light Size</span>
            <strong id="nee-light-value"></strong>
            <input id="nee-light-range" type="range" min="0.16" max="0.58" step="0.02" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Seed</span>
            <strong>Freeze Seed</strong>
            <div class="path-trace-toggle-row">
              <button id="nee-freeze-button" class="path-trace-toggle" type="button">freeze</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--two">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Emissive Hit Only</strong>
            <span>不主动 sample 光源，只等随机路径自己撞上发光面，所以小光源时方差会特别大。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Next Event Estimation</strong>
            <span>每个 receiver 都会显式 sample 光源，再发 shadow ray 判断可见性，所以 direct light 更稳。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="nee-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Left</span><strong id="nee-left-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Right</span><strong id="nee-right-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Hit Rate</span><strong id="nee-stats-card"></strong></article>
        </div>
        <article class="path-trace-observation">
          <span class="eyebrow">当前实验</span>
          <strong id="nee-observation-card"></strong>
        </article>
        <p id="nee-legend" class="path-trace-legend"></p>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#nee-canvas");
  if (!canvas) {
    throw new Error("lesson 81 canvas not found");
  }

  const refs: NeeHudRefs = {
    sampleRange: host.querySelector<HTMLInputElement>("#nee-sample-range")!,
    sampleValue: host.querySelector<HTMLElement>("#nee-sample-value")!,
    bounceRange: host.querySelector<HTMLInputElement>("#nee-bounce-range")!,
    bounceValue: host.querySelector<HTMLElement>("#nee-bounce-value")!,
    lightRange: host.querySelector<HTMLInputElement>("#nee-light-range")!,
    lightValue: host.querySelector<HTMLElement>("#nee-light-value")!,
    freezeButton: host.querySelector<HTMLButtonElement>("#nee-freeze-button")!,
    leftCard: host.querySelector<HTMLElement>("#nee-left-card")!,
    rightCard: host.querySelector<HTMLElement>("#nee-right-card")!,
    statsCard: host.querySelector<HTMLElement>("#nee-stats-card")!,
    observationCard: host.querySelector<HTMLElement>("#nee-observation-card")!,
    legend: host.querySelector<HTMLElement>("#nee-legend")!,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const pipeline = createScenePipeline(gpu.device, gpu.format);
  const gpuState = createGpuState(gpu.device, pipeline);

  const settings: NeeSettings = {
    samplesPerFrame: 64,
    maxBounce: 2,
    lightSize: 0.26,
    freezeSeed: false,
  };

  refs.sampleRange.value = String(settings.samplesPerFrame);
  refs.bounceRange.value = String(settings.maxBounce);
  refs.lightRange.value = String(settings.lightSize);

  let leftAverage = 0;
  let rightAverage = 0;
  let hitRate = 0;
  let time = 0;
  let rafId = 0;

  const recomputeHud = () => {
    const receiverCount = 40;
    let leftSum = 0;
    let rightSum = 0;
    let hits = 0;
    for (let index = 0; index < receiverCount; index += 1) {
      const receiverX = lerp(ROOM.minX + 0.08, ROOM.maxX - 0.08, index / (receiverCount - 1));
      const left = estimateEmissiveHitOnly(receiverX, settings, 1000 + index * 17);
      const right = estimateNee(receiverX, settings, 2000 + index * 29);
      leftSum += left.value;
      rightSum += right.value;
      hits += left.hitRate;
    }
    leftAverage = leftSum / receiverCount;
    rightAverage = rightSum / receiverCount;
    hitRate = hits / receiverCount;
    updateHud(refs, settings, leftAverage, rightAverage, hitRate);
  };

  const syncSettings = () => {
    settings.samplesPerFrame = Number(refs.sampleRange.value);
    settings.maxBounce = Number(refs.bounceRange.value);
    settings.lightSize = Number(refs.lightRange.value);
    recomputeHud();
  };

  refs.sampleRange.addEventListener("input", syncSettings);
  refs.bounceRange.addEventListener("input", syncSettings);
  refs.lightRange.addEventListener("input", syncSettings);
  refs.freezeButton.addEventListener("click", () => {
    settings.freezeSeed = !settings.freezeSeed;
    recomputeHud();
  });

  recomputeHud();
  setStatus({
    title: "NEE lesson 已运行",
    detail:
      "现在左/右两栏的 room + receiver strip 都是 WebGPU 直接绘制；卡片则继续用教学版统计去解释 emissive hit only 和显式采灯的差异。",
    tone: "ok",
  });

  const render = () => {
    gpu.resize();
    if (!settings.freezeSeed) {
      time += 0.016;
    }
    gpu.device.queue.writeBuffer(
      gpuState.settingsBuffer,
      0,
      createSettingsData(canvas.width, canvas.height, settings, time)
    );
    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-81-command-encoder",
    });
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
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, gpuState.bindGroup);
    pass.draw(3);
    pass.end();
    gpu.device.queue.submit([encoder.finish()]);
    rafId = requestAnimationFrame(render);
  };

  rafId = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(rafId);
    gpuState.settingsBuffer.destroy();
  };
}
