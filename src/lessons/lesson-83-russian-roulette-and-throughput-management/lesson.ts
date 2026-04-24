import { createWebGpuCanvas } from "@/core/webgpu";
import { createMulberry32 } from "@/lessons/path-tracing-common/sampling";
import visualizationShaderSource from "@/lessons/lesson-83-russian-roulette-and-throughput-management/visualization.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type RouletteSettings = {
  rrStartDepth: number;
  minSurvivalProbability: number;
  maxBounce: number;
  freezeSeed: boolean;
};

type RouletteHudRefs = {
  startRange: HTMLInputElement;
  startValue: HTMLElement;
  probabilityRange: HTMLInputElement;
  probabilityValue: HTMLElement;
  bounceRange: HTMLInputElement;
  bounceValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  leftCard: HTMLElement;
  rightCard: HTMLElement;
  throughputCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type PathSimulationSummary = {
  radiance: number;
  averagePathLength: number;
  averageThroughput: number;
  rrTerminated: number;
  histogram: number[];
};

type RouletteGpuState = {
  settingsBuffer: GPUBuffer;
  leftHistogramBuffer: GPUBuffer;
  rightHistogramBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

function simulateFixedDepth(settings: RouletteSettings, seed: number): PathSimulationSummary {
  const random = createMulberry32(seed);
  let totalRadiance = 0;
  let totalLength = 0;
  let totalThroughput = 0;
  const histogram = new Array(13).fill(0);
  const pathCount = 720;
  for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
    let throughput = 1;
    let radiance = 0;
    let length = 0;
    for (let bounce = 0; bounce < settings.maxBounce; bounce += 1) {
      length += 1;
      const albedo = 0.56 + random() * 0.28;
      throughput *= albedo;
      if (random() < 0.18 + bounce * 0.04) {
        radiance += throughput * (1.2 - bounce * 0.04);
        break;
      }
    }
    totalRadiance += radiance;
    totalLength += length;
    totalThroughput += throughput;
    histogram[Math.min(length, histogram.length - 1)] += 1;
  }
  return {
    radiance: totalRadiance / pathCount,
    averagePathLength: totalLength / pathCount,
    averageThroughput: totalThroughput / pathCount,
    rrTerminated: 0,
    histogram,
  };
}

function simulateRussianRoulette(settings: RouletteSettings, seed: number): PathSimulationSummary {
  const random = createMulberry32(seed);
  let totalRadiance = 0;
  let totalLength = 0;
  let totalThroughput = 0;
  let rrTerminated = 0;
  const histogram = new Array(13).fill(0);
  const hardMaxDepth = Math.max(settings.maxBounce + 4, settings.rrStartDepth + 2);
  const pathCount = 720;
  for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
    let throughput = 1;
    let radiance = 0;
    let length = 0;
    for (let bounce = 0; bounce < hardMaxDepth; bounce += 1) {
      length += 1;
      const albedo = 0.56 + random() * 0.28;
      throughput *= albedo;
      if (random() < 0.18 + bounce * 0.04) {
        radiance += throughput * (1.2 - bounce * 0.04);
        break;
      }
      if (bounce + 1 >= settings.rrStartDepth && bounce + 1 < hardMaxDepth) {
        const survival = Math.min(0.95, Math.max(settings.minSurvivalProbability, throughput));
        if (random() > survival) {
          rrTerminated += 1;
          break;
        }
        throughput /= survival;
      }
    }
    totalRadiance += radiance;
    totalLength += length;
    totalThroughput += throughput;
    histogram[Math.min(length, histogram.length - 1)] += 1;
  }
  return {
    radiance: totalRadiance / pathCount,
    averagePathLength: totalLength / pathCount,
    averageThroughput: totalThroughput / pathCount,
    rrTerminated,
    histogram,
  };
}

function updateHud(
  refs: RouletteHudRefs,
  settings: RouletteSettings,
  fixed: PathSimulationSummary,
  roulette: PathSimulationSummary
): void {
  refs.startValue.textContent = `${settings.rrStartDepth}`;
  refs.probabilityValue.textContent = settings.minSurvivalProbability.toFixed(2);
  refs.bounceValue.textContent = `${settings.maxBounce}`;
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeSeed);
  refs.leftCard.textContent =
    `固定截断平均路径长度约 ${fixed.averagePathLength.toFixed(2)}；虽然简单，但更深路径直接被硬砍掉了。`;
  refs.rightCard.textContent =
    `Russian roulette 会在第 ${settings.rrStartDepth} bounce 后继续向更深尾部放行，但通过 survival probability 控制成本；当前平均路径长度约 ${roulette.averagePathLength.toFixed(2)}，其中约 ${roulette.rrTerminated} 条路径被 RR 提前结束。`;
  refs.throughputCard.textContent =
    `右栏 hard max depth 固定在 ${Math.max(settings.maxBounce + 4, settings.rrStartDepth + 2)}，平均 throughput 约 ${roulette.averageThroughput.toFixed(2)}；幸存路径会被按 1/p 补偿，所以画面不该系统性变暗。`;
  refs.observationCard.textContent =
    settings.minSurvivalProbability < 0.18
      ? "当前 survival probability 偏低，所以右栏会更激进地砍路径；重点看成本压下来以后，亮度仍然没有整体塌掉。"
      : "当前 RR 比较保守，所以右栏更像是在慢慢削掉“不太值钱”的尾部路径，而不是猛烈截断。";
  refs.legend.textContent =
    "这节课的 histogram 和亮度 patch 现在由 WebGPU 绘制；左栏是硬截断统计，右栏是带概率补偿的 Russian roulette 路径统计。";
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
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
}

function createScenePipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const module = device.createShaderModule({ code: visualizationShaderSource });
  return device.createRenderPipeline({
    label: "lesson-83-visualization-pipeline",
    layout: "auto",
    vertex: { module, entryPoint: "vsFullscreen" },
    fragment: { module, entryPoint: "fsVisualize", targets: [{ format }] },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });
}

function createGpuState(device: GPUDevice, pipeline: GPURenderPipeline): RouletteGpuState {
  const settingsBuffer = createUniformBuffer(device, 14 * 4, "lesson-83-settings");
  const leftHistogramBuffer = createStorageBuffer(device, 16 * 4, "lesson-83-left-histogram");
  const rightHistogramBuffer = createStorageBuffer(device, 16 * 4, "lesson-83-right-histogram");
  const bindGroup = device.createBindGroup({
    label: "lesson-83-bind-group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: settingsBuffer } },
      { binding: 1, resource: { buffer: leftHistogramBuffer } },
      { binding: 2, resource: { buffer: rightHistogramBuffer } },
    ],
  });
  return {
    settingsBuffer,
    leftHistogramBuffer,
    rightHistogramBuffer,
    bindGroup,
  };
}

function createSettingsData(
  width: number,
  height: number,
  fixed: PathSimulationSummary,
  roulette: PathSimulationSummary
): Float32Array {
  return new Float32Array([
    width,
    height,
    fixed.radiance,
    roulette.radiance,
    fixed.averagePathLength,
    roulette.averagePathLength,
    fixed.averageThroughput,
    roulette.averageThroughput,
    fixed.rrTerminated,
    roulette.rrTerminated,
    0,
    0,
    0,
    0,
  ]);
}

function createHistogramData(histogram: number[]): Float32Array {
  const data = new Float32Array(16);
  for (let index = 0; index < Math.min(histogram.length, 13); index += 1) {
    data[index] = histogram[index];
  }
  return data;
}

export async function mountRussianRouletteAndThroughputManagementLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--roulette">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">same stochastic path budget, two termination rules</span>
          <span class="path-trace-badge path-trace-badge--warm">left: fixed-depth truncation</span>
          <span class="path-trace-badge path-trace-badge--cool">right: Russian roulette</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>RR Start Depth</span>
            <strong id="roulette-start-value"></strong>
            <input id="roulette-start-range" type="range" min="2" max="8" step="1" />
          </label>
          <label class="path-trace-control">
            <span>Min Survival Probability</span>
            <strong id="roulette-probability-value"></strong>
            <input id="roulette-probability-range" type="range" min="0.05" max="0.45" step="0.01" />
          </label>
          <label class="path-trace-control">
            <span>Max Bounce</span>
            <strong id="roulette-bounce-value"></strong>
            <input id="roulette-bounce-range" type="range" min="2" max="8" step="1" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Seed</span>
            <strong>Freeze Seed</strong>
            <div class="path-trace-toggle-row">
              <button id="roulette-freeze-button" class="path-trace-toggle" type="button">freeze</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--two">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Fixed-depth Truncation</strong>
            <span>到了 max bounce 就直接砍掉，成本好控，但尾部路径的能量也一起被硬切掉。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Russian Roulette</strong>
            <span>从一定深度后按 throughput 决定谁值得继续走，幸存路径再按 1/p 做补偿。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="roulette-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Path Length</span><strong id="roulette-left-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">RR Termination</span><strong id="roulette-right-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Throughput</span><strong id="roulette-throughput-card"></strong></article>
        </div>
        <article class="path-trace-observation">
          <span class="eyebrow">当前实验</span>
          <strong id="roulette-observation-card"></strong>
        </article>
        <p id="roulette-legend" class="path-trace-legend"></p>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#roulette-canvas");
  if (!canvas) {
    throw new Error("lesson 83 canvas not found");
  }

  const refs: RouletteHudRefs = {
    startRange: host.querySelector<HTMLInputElement>("#roulette-start-range")!,
    startValue: host.querySelector<HTMLElement>("#roulette-start-value")!,
    probabilityRange: host.querySelector<HTMLInputElement>("#roulette-probability-range")!,
    probabilityValue: host.querySelector<HTMLElement>("#roulette-probability-value")!,
    bounceRange: host.querySelector<HTMLInputElement>("#roulette-bounce-range")!,
    bounceValue: host.querySelector<HTMLElement>("#roulette-bounce-value")!,
    freezeButton: host.querySelector<HTMLButtonElement>("#roulette-freeze-button")!,
    leftCard: host.querySelector<HTMLElement>("#roulette-left-card")!,
    rightCard: host.querySelector<HTMLElement>("#roulette-right-card")!,
    throughputCard: host.querySelector<HTMLElement>("#roulette-throughput-card")!,
    observationCard: host.querySelector<HTMLElement>("#roulette-observation-card")!,
    legend: host.querySelector<HTMLElement>("#roulette-legend")!,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const pipeline = createScenePipeline(gpu.device, gpu.format);
  const gpuState = createGpuState(gpu.device, pipeline);

  const settings: RouletteSettings = {
    rrStartDepth: 4,
    minSurvivalProbability: 0.15,
    maxBounce: 5,
    freezeSeed: false,
  };

  refs.startRange.value = String(settings.rrStartDepth);
  refs.probabilityRange.value = String(settings.minSurvivalProbability);
  refs.bounceRange.value = String(settings.maxBounce);

  let fixedSummary = simulateFixedDepth(settings, 1337);
  let rouletteSummary = simulateRussianRoulette(settings, 1337);
  let animationSeed = 0;
  let rafId = 0;

  const recompute = () => {
    fixedSummary = simulateFixedDepth(settings, 1337 + animationSeed);
    rouletteSummary = simulateRussianRoulette(settings, 1337 + animationSeed);
    gpu.device.queue.writeBuffer(gpuState.leftHistogramBuffer, 0, createHistogramData(fixedSummary.histogram));
    gpu.device.queue.writeBuffer(gpuState.rightHistogramBuffer, 0, createHistogramData(rouletteSummary.histogram));
    updateHud(refs, settings, fixedSummary, rouletteSummary);
  };

  const syncSettings = () => {
    settings.rrStartDepth = Number(refs.startRange.value);
    settings.minSurvivalProbability = Number(refs.probabilityRange.value);
    settings.maxBounce = Number(refs.bounceRange.value);
    recompute();
  };

  refs.startRange.addEventListener("input", syncSettings);
  refs.probabilityRange.addEventListener("input", syncSettings);
  refs.bounceRange.addEventListener("input", syncSettings);
  refs.freezeButton.addEventListener("click", () => {
    settings.freezeSeed = !settings.freezeSeed;
    recompute();
  });

  recompute();
  setStatus({
    title: "Russian roulette 已运行",
    detail:
      "现在左右 histogram 和亮度 patch 都由 WebGPU 绘制；卡片继续用固定截断 vs RR 的统计去解释 throughput 和平均路径长度为什么会分开。",
    tone: "ok",
  });

  const render = () => {
    gpu.resize();
    if (!settings.freezeSeed) {
      animationSeed = (animationSeed + 1) % 1024;
      recompute();
    }
    gpu.device.queue.writeBuffer(
      gpuState.settingsBuffer,
      0,
      createSettingsData(canvas.width, canvas.height, fixedSummary, rouletteSummary)
    );
    const encoder = gpu.device.createCommandEncoder({ label: "lesson-83-command-encoder" });
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
    gpuState.leftHistogramBuffer.destroy();
    gpuState.rightHistogramBuffer.destroy();
  };
}
