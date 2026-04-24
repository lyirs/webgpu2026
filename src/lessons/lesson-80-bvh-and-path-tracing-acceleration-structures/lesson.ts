import { createWebGpuCanvas } from "@/core/webgpu";
import {
  buildFlatBvh,
  computeLeafDepths,
  traceBruteForce,
  traceBvh,
} from "@/lessons/path-tracing-common/bvh";
import { lerp, type Vector3 } from "@/lessons/path-tracing-common/math";
import {
  createPathTracingScenePreset,
  type CornellSceneBox,
} from "@/lessons/path-tracing-common/scene";
import visualizationShaderSource from "@/lessons/lesson-80-bvh-and-path-tracing-acceleration-structures/visualization.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type BvhLessonSettings = {
  primitiveCount: number;
  samplesPerFrame: number;
  showDepthTint: boolean;
  freezeSeed: boolean;
};

type BvhHudRefs = {
  primitiveRange: HTMLInputElement;
  primitiveValue: HTMLElement;
  sampleRange: HTMLInputElement;
  sampleValue: HTMLElement;
  depthButton: HTMLButtonElement;
  freezeButton: HTMLButtonElement;
  totalCard: HTMLElement;
  testsCard: HTMLElement;
  visitsCard: HTMLElement;
  depthCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type PanelStats = {
  testsPerRay: number;
  nodeVisits: number;
};

type BvhGpuState = {
  settingsBuffer: GPUBuffer;
  boxBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  activeCount: number;
};

const MAX_BOXES = 96;
const BOX_STRIDE = 8;

function rayDirection(index: number, count: number): Vector3 {
  const angle = lerp(-0.72, 0.72, count <= 1 ? 0.5 : index / (count - 1));
  return [Math.sin(angle) * 0.85, -0.18, -Math.cos(angle)];
}

function updateHud(
  refs: BvhHudRefs,
  settings: BvhLessonSettings,
  maxDepth: number,
  bruteStats: PanelStats,
  bvhStats: PanelStats
): void {
  refs.primitiveValue.textContent = `${settings.primitiveCount} boxes`;
  refs.sampleValue.textContent = `${settings.samplesPerFrame} rays`;
  refs.depthButton.classList.toggle("path-trace-toggle--active", settings.showDepthTint);
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeSeed);
  refs.totalCard.textContent =
    "两边看的都是同一批房间内 primitive；视觉结果必须一致，不一致就说明 traversal 本身有 bug。";
  refs.testsCard.textContent =
    `Brute-force 平均每条 ray 约测试 ${bruteStats.testsPerRay.toFixed(1)} 个 primitive；BVH 侧约 ${bvhStats.testsPerRay.toFixed(1)} 个。`;
  refs.visitsCard.textContent =
    `右栏平均 node visit 约 ${bvhStats.nodeVisits.toFixed(1)}；这正是“先过 bounds，再决定要不要看叶子”的价值。`;
  refs.depthCard.textContent =
    settings.showDepthTint
      ? `当前按 leaf depth 着色，最大 BVH 深度约 ${maxDepth}。`
      : `最大 BVH 深度约 ${maxDepth}；打开深度 tint 更容易把 traversal 代价分布看出来。`;
  refs.observationCard.textContent =
    settings.primitiveCount > 72
      ? "primitive 越多，brute-force 的增长会越来越直接；BVH 不是让它“免费”，而是让增长速度变慢。"
      : "当前场景规模还不算极端，但右栏的平均 primitive tests 已经开始明显低于左栏。";
  refs.legend.textContent =
    "这一课的主画面现在由 WebGPU 直接生成：左栏和右栏看到的是同一房间，只是右栏会把 BVH 深度和 traversal 结构可视化得更直接。";
}

function createBoxData(boxes: CornellSceneBox[], leafDepths: number[]): Float32Array {
  const data = new Float32Array(MAX_BOXES * BOX_STRIDE);
  for (let index = 0; index < Math.min(MAX_BOXES, boxes.length); index += 1) {
    const box = boxes[index];
    const offset = index * BOX_STRIDE;
    data.set([box.min[0], box.min[2], box.max[0], box.max[2]], offset);
    data.set([box.albedo[0], box.albedo[1], box.albedo[2], leafDepths[index] ?? 0], offset + 4);
  }
  return data;
}

function createSettingsData(
  canvasWidth: number,
  canvasHeight: number,
  settings: BvhLessonSettings,
  maxDepth: number,
  time: number
): Float32Array {
  return new Float32Array([
    canvasWidth,
    canvasHeight,
    settings.primitiveCount,
    Math.min(settings.samplesPerFrame, 80),
    settings.showDepthTint ? 1 : 0,
    maxDepth,
    time,
    settings.freezeSeed ? 1 : 0,
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
    label: "lesson-80-visualization-pipeline",
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vsFullscreen",
    },
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

function createGpuState(
  device: GPUDevice,
  pipeline: GPURenderPipeline
): BvhGpuState {
  const settingsBuffer = createUniformBuffer(device, 10 * 4, "lesson-80-settings");
  const boxBuffer = createStorageBuffer(device, MAX_BOXES * BOX_STRIDE * 4, "lesson-80-boxes");
  const bindGroup = device.createBindGroup({
    label: "lesson-80-bind-group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: settingsBuffer } },
      { binding: 1, resource: { buffer: boxBuffer } },
    ],
  });
  return {
    settingsBuffer,
    boxBuffer,
    bindGroup,
    activeCount: 0,
  };
}

export async function mountBvhAndPathTracingAccelerationStructuresLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--bvh-accel">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">same room, different traversal cost</span>
          <span class="path-trace-badge path-trace-badge--warm">left: brute-force</span>
          <span class="path-trace-badge path-trace-badge--cool">right: BVH traversal</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Primitive Count</span>
            <strong id="bvh-primitive-value"></strong>
            <input id="bvh-primitive-range" type="range" min="16" max="96" step="4" />
          </label>
          <label class="path-trace-control">
            <span>Samples per Frame</span>
            <strong id="bvh-sample-value"></strong>
            <input id="bvh-sample-range" type="range" min="32" max="320" step="16" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Debug</span>
            <strong>Show BVH Depth Tint</strong>
            <div class="path-trace-toggle-row">
              <button id="bvh-depth-button" class="path-trace-toggle" type="button">depth tint</button>
            </div>
          </div>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Seed</span>
            <strong>Freeze Seed</strong>
            <div class="path-trace-toggle-row">
              <button id="bvh-freeze-button" class="path-trace-toggle" type="button">freeze</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--two">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Brute-force Traversal</strong>
            <span>每条 ray 都要一个个试过所有 primitive，规模上去以后成本会直接跟着涨。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>BVH Traversal</strong>
            <span>先过一层层 bounds，再决定值不值得进叶子；画面一样，但无效测试会少很多。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="bvh-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Total</span><strong id="bvh-total-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Tests / Ray</span><strong id="bvh-tests-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Node Visits</span><strong id="bvh-visits-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">BVH Depth</span><strong id="bvh-depth-card"></strong></article>
        </div>
        <article class="path-trace-observation">
          <span class="eyebrow">当前实验</span>
          <strong id="bvh-observation-card"></strong>
        </article>
        <p id="bvh-legend" class="path-trace-legend"></p>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#bvh-canvas");
  if (!canvas) {
    throw new Error("lesson 80 canvas not found");
  }

  const refs: BvhHudRefs = {
    primitiveRange: host.querySelector<HTMLInputElement>("#bvh-primitive-range")!,
    primitiveValue: host.querySelector<HTMLElement>("#bvh-primitive-value")!,
    sampleRange: host.querySelector<HTMLInputElement>("#bvh-sample-range")!,
    sampleValue: host.querySelector<HTMLElement>("#bvh-sample-value")!,
    depthButton: host.querySelector<HTMLButtonElement>("#bvh-depth-button")!,
    freezeButton: host.querySelector<HTMLButtonElement>("#bvh-freeze-button")!,
    totalCard: host.querySelector<HTMLElement>("#bvh-total-card")!,
    testsCard: host.querySelector<HTMLElement>("#bvh-tests-card")!,
    visitsCard: host.querySelector<HTMLElement>("#bvh-visits-card")!,
    depthCard: host.querySelector<HTMLElement>("#bvh-depth-card")!,
    observationCard: host.querySelector<HTMLElement>("#bvh-observation-card")!,
    legend: host.querySelector<HTMLElement>("#bvh-legend")!,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const pipeline = createScenePipeline(gpu.device, gpu.format);
  const gpuState = createGpuState(gpu.device, pipeline);

  const settings: BvhLessonSettings = {
    primitiveCount: 64,
    samplesPerFrame: 128,
    showDepthTint: false,
    freezeSeed: false,
  };

  refs.primitiveRange.value = String(settings.primitiveCount);
  refs.sampleRange.value = String(settings.samplesPerFrame);
  refs.primitiveRange.max = "64";

  let geometryVersion = -1;
  let statsVersion = "";
  let currentMaxDepth = 0;
  let bruteStats: PanelStats = { testsPerRay: 0, nodeVisits: 0 };
  let bvhStats: PanelStats = { testsPerRay: 0, nodeVisits: 0 };
  let animationPhase = 0;
  let rafId = 0;
  let currentBoxes: CornellSceneBox[] = [];
  let currentFlatBvh = buildFlatBvh(createPathTracingScenePreset("dense", settings.primitiveCount).boxes.slice(0, settings.primitiveCount));

  const updateScene = () => {
    if (geometryVersion !== settings.primitiveCount) {
      const preset = createPathTracingScenePreset("dense", settings.primitiveCount);
      currentBoxes = preset.boxes.slice(0, settings.primitiveCount);
      currentFlatBvh = buildFlatBvh(currentBoxes);
      const leafDepths = computeLeafDepths(currentFlatBvh);
      currentMaxDepth = currentFlatBvh.maxDepth;
      gpu.device.queue.writeBuffer(gpuState.boxBuffer, 0, createBoxData(currentBoxes, leafDepths));
      gpuState.activeCount = currentBoxes.length;
      geometryVersion = settings.primitiveCount;
    }

    const nextStatsVersion = `${settings.primitiveCount}:${settings.samplesPerFrame}`;
    if (statsVersion === nextStatsVersion) {
      updateHud(refs, settings, currentMaxDepth, bruteStats, bvhStats);
      return;
    }
    statsVersion = nextStatsVersion;

    const origin: Vector3 = [0, 1.16, 2.58];
    let bruteTests = 0;
    let bvhTests = 0;
    let bvhVisits = 0;
    for (let sampleIndex = 0; sampleIndex < settings.samplesPerFrame; sampleIndex += 1) {
      const direction = rayDirection(sampleIndex, settings.samplesPerFrame);
      const brute = traceBruteForce(currentBoxes, origin, direction);
      const bvh = traceBvh(currentBoxes, currentFlatBvh, origin, direction);
      bruteTests += brute.primitiveTests;
      bvhTests += bvh.primitiveTests;
      bvhVisits += bvh.nodeVisits;
    }
    bruteStats = {
      testsPerRay: bruteTests / Math.max(settings.samplesPerFrame, 1),
      nodeVisits: 0,
    };
    bvhStats = {
      testsPerRay: bvhTests / Math.max(settings.samplesPerFrame, 1),
      nodeVisits: bvhVisits / Math.max(settings.samplesPerFrame, 1),
    };
    updateHud(refs, settings, currentMaxDepth, bruteStats, bvhStats);
  };

  const syncSettings = () => {
    settings.primitiveCount = Number(refs.primitiveRange.value);
    settings.samplesPerFrame = Number(refs.sampleRange.value);
    updateScene();
  };

  refs.primitiveRange.addEventListener("input", syncSettings);
  refs.sampleRange.addEventListener("input", syncSettings);
  refs.depthButton.addEventListener("click", () => {
    settings.showDepthTint = !settings.showDepthTint;
    updateHud(refs, settings, currentMaxDepth, bruteStats, bvhStats);
  });
  refs.freezeButton.addEventListener("click", () => {
    settings.freezeSeed = !settings.freezeSeed;
    updateHud(refs, settings, currentMaxDepth, bruteStats, bvhStats);
  });

  updateScene();
  setStatus({
    title: "BVH acceleration 已运行",
    detail:
      "左栏保留 brute-force traversal，右栏改成由 WebGPU 画出的 BVH top-down 可视化；卡片继续展示 primitive tests 和 node visits 的差异。",
    tone: "ok",
  });

  const render = () => {
    gpu.resize();
    if (!settings.freezeSeed) {
      animationPhase += 0.016;
    }
    gpu.device.queue.writeBuffer(
      gpuState.settingsBuffer,
      0,
      createSettingsData(canvas.width, canvas.height, settings, currentMaxDepth, animationPhase)
    );

    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-80-command-encoder",
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
    gpuState.boxBuffer.destroy();
  };
}
