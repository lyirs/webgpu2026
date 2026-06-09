import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createRenderBundleLessonGeometry } from "@/lessons/lesson-100-render-bundles/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  createRotationZMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-100-render-bundles/math";
import fragmentShaderSource from "@/lessons/lesson-100-render-bundles/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-100-render-bundles/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type Color4 = [number, number, number, number];

type BundleSceneObjectConfig = {
  label: string;
  translation: Vector3;
  rotation: Vector3;
  scale: Vector3;
  color: Color4;
};

type BundleRenderObject = {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type BundleDepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type BundlePanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BundleHudRefs = {
  sceneBadge: HTMLElement;
  bundleBadge: HTMLElement;
  rebuildBadge: HTMLElement;
  normalValue: HTMLElement;
  normalMeta: HTMLElement;
  bundleValue: HTMLElement;
  bundleMeta: HTMLElement;
  ratioValue: HTMLElement;
  ratioMeta: HTMLElement;
  buildValue: HTMLElement;
  buildMeta: HTMLElement;
  legendBody: HTMLElement;
};

type BundleMetricState = {
  objectCount: number;
  normalCpuMs: number;
  bundleCpuMs: number;
  bundleBuildMs: number | null;
  bundleBuildCount: number;
  reuseNote: string;
  sampleCount: number;
  windowSeconds: number;
  hasFrameMetrics: boolean;
};

type CpuMetricSample = {
  timeMs: number;
  normalMs: number;
  bundleMs: number;
};

const CPU_SAMPLE_WINDOW_MS = 2400;
const HUD_UPDATE_INTERVAL_MS = 240;
const STATIC_SHARD_COUNT = 960;

/**
 * 生成 0-1 之间的稳定伪随机数，保证每次刷新 lesson 场景都一致。
 * @param {number} index 当前对象索引。
 * @param {number} salt 用来切换不同随机流的偏移量。
 * @returns {number} 一个稳定的 0-1 浮点数。
 */
function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

/**
 * 把当前场景静态物体数量格式化成更适合 HUD 的数字文本。
 * @param {number} value 当前静态 draw 数量。
 * @returns {string} 对应的中文数字字符串。
 */
function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 把毫秒数格式化成更适合 HUD 的短文本。
 * @param {number | null} value 当前毫秒数。
 * @returns {string} 对应的字符串。
 */
function formatMilliseconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "等待首轮";
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ms`;
}

/**
 * 把右侧 executeBundles 的 CPU 时间格式化成“占左侧多少”的百分比文本。
 * @param {number} normalMs 左侧逐帧编码的 CPU 时间。
 * @param {number} bundleMs 右侧 executeBundles 的 CPU 时间。
 * @returns {string} 对应的百分比文本。
 */
function formatBundlePercent(normalMs: number, bundleMs: number): string {
  if (!Number.isFinite(normalMs) || !Number.isFinite(bundleMs) || normalMs <= 0.0001) {
    return "—";
  }

  const percent = Math.min(999, Math.max(0, (bundleMs / normalMs) * 100));
  return `${percent.toFixed(percent >= 100 ? 0 : 1)}%`;
}

/**
 * 把一帧 CPU 时间推进固定窗口，并回写 HUD 使用的滚动平均值。
 * @param {CpuMetricSample[]} samples 最近一段时间的 CPU 采样窗口。
 * @param {BundleMetricState} metrics 当前 HUD 使用的指标状态。
 * @param {CpuMetricSample} sample 本帧新采到的一组 normal / bundle CPU 时间。
 * @returns {void} 只更新采样窗口和 metrics，不返回额外结果。
 */
function recordCpuMetricSample(
  samples: CpuMetricSample[],
  metrics: BundleMetricState,
  sample: CpuMetricSample
): void {
  samples.push(sample);

  const cutoffTimeMs = sample.timeMs - CPU_SAMPLE_WINDOW_MS;
  while (samples.length > 0 && samples[0].timeMs < cutoffTimeMs) {
    samples.shift();
  }

  let normalTotal = 0;
  let bundleTotal = 0;
  for (const item of samples) {
    normalTotal += item.normalMs;
    bundleTotal += item.bundleMs;
  }

  const divisor = Math.max(1, samples.length);
  metrics.normalCpuMs = normalTotal / divisor;
  metrics.bundleCpuMs = bundleTotal / divisor;
  metrics.sampleCount = samples.length;
  metrics.hasFrameMetrics = true;
}

/**
 * 根据当前两侧 CPU 编码时间，生成更贴近课程讲解的文案。
 * @param {BundleMetricState} metrics 当前 lesson 的指标状态。
 * @returns {string} 对应的总结说明。
 */
function createLegendCopy(metrics: BundleMetricState): string {
  if (!metrics.hasFrameMetrics) {
    return "左边会在每一帧重新录整批 draw 命令，右边只复用一份预录好的 render bundle。相机和光源仍然在变化，但它们只更新 uniform buffer，不改 draw 列表。";
  }

  if (metrics.bundleCpuMs < metrics.normalCpuMs * 0.55) {
    return `按最近 ${metrics.windowSeconds.toFixed(1)} 秒的滚动平均来看，右侧 executeBundles 的 CPU 编码时间大约是左侧的 ${formatBundlePercent(metrics.normalCpuMs, metrics.bundleCpuMs)}。这正是 render bundle 的目标：把稳定的 draw 列表提前录好，后面只复用。`;
  }

  return `按最近 ${metrics.windowSeconds.toFixed(1)} 秒的滚动平均来看，右侧 executeBundles 的 CPU 编码时间大约是左侧的 ${formatBundlePercent(metrics.normalCpuMs, metrics.bundleCpuMs)}；如果占比没有明显变小，通常说明当前环境更接近 GPU 受限，或者浏览器对命令录制已经做了较强优化。`;
}

/**
 * 根据当前指标状态更新 HUD 文案。
 * @param {BundleHudRefs} refs HUD 里要更新的 DOM 引用。
 * @param {BundleMetricState} metrics 当前 CPU 编码、bundle 构建和对象数量状态。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(refs: BundleHudRefs, metrics: BundleMetricState): void {
  refs.sceneBadge.textContent = `静态 draw · ${formatCount(metrics.objectCount)} 个`;
  refs.sceneBadge.className = "bundle-badge bundle-badge--cool";

  refs.bundleBadge.textContent =
    metrics.bundleBuildCount > 0
      ? "render bundle · 已录制"
      : "render bundle · 等待录制";
  refs.bundleBadge.className =
    metrics.bundleBuildCount > 0
      ? "bundle-badge bundle-badge--ok"
      : "bundle-badge";

  refs.rebuildBadge.textContent =
    metrics.bundleBuildCount > 0
      ? `复用边界 · ${metrics.reuseNote}`
      : "复用边界 · 等待初始化";
  refs.rebuildBadge.className = "bundle-badge bundle-badge--accent";

  refs.normalValue.textContent = metrics.hasFrameMetrics
    ? formatMilliseconds(metrics.normalCpuMs)
    : "等待首帧";
  refs.normalMeta.textContent =
    metrics.hasFrameMetrics
      ? `左侧：最近 ${metrics.windowSeconds.toFixed(1)} 秒窗口内，逐帧重录这批静态命令的平均 CPU 时间。`
      : "左侧：每帧重新 setBindGroup + drawIndexed，完整重录这一批静态命令。";

  refs.bundleValue.textContent = metrics.hasFrameMetrics
    ? formatMilliseconds(metrics.bundleCpuMs)
    : "等待首帧";
  refs.bundleMeta.textContent =
    metrics.hasFrameMetrics
      ? `右侧：最近 ${metrics.windowSeconds.toFixed(1)} 秒窗口内，executeBundles([bundle]) 的平均 CPU 时间。`
      : "右侧：render pass 里只做 executeBundles([bundle])，命令主体来自预录结果。";

  refs.ratioValue.textContent = metrics.hasFrameMetrics
    ? formatBundlePercent(metrics.normalCpuMs, metrics.bundleCpuMs)
    : "等待首帧";
  refs.ratioMeta.textContent = metrics.hasFrameMetrics
    ? `基于最近 ${metrics.windowSeconds.toFixed(1)} 秒、${metrics.sampleCount} 帧的滚动平均；这里显示的是右侧 executeBundles CPU 时间占左侧逐帧编码 CPU 时间的比例，当前约少 ${(Math.max(0, 1 - metrics.bundleCpuMs / metrics.normalCpuMs) * 100).toFixed(0)}% 的录制开销。`
    : "占比会在拿到两边一小段时间窗口的 CPU 均值后更新。";

  refs.buildValue.textContent = formatMilliseconds(metrics.bundleBuildMs);
  refs.buildMeta.textContent =
    metrics.bundleBuildCount > 0
      ? `bundle 已累计录制 ${metrics.bundleBuildCount} 次；这份实现把相机 uniform 和 viewport 都放在 bundle 外，所以 resize 时也能持续复用。`
      : "bundle 还没有完成第一次录制。";

  refs.legendBody.textContent = createLegendCopy(metrics);
}

/**
 * 把视图矩阵、光源位置和相机位置打包成一份 frame uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前面板的 VP 矩阵。
 * @param {Vector3} lightPosition 当前点光源位置。
 * @param {Vector3} eyePosition 当前相机位置。
 * @returns {Float32Array} 可直接写进 frame uniform buffer 的连续数据。
 */
function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  lightPosition: Vector3,
  eyePosition: Vector3
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set([lightPosition[0], lightPosition[1], lightPosition[2], 1], 16);
  uniformData.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 20);
  return uniformData;
}

/**
 * 把模型矩阵和基础颜色打包成一份对象级 uniform 数据。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {Color4} color 当前对象颜色。
 * @returns {Float32Array} 可直接写进对象 uniform buffer 的连续数据。
 */
function createObjectUniformData(
  modelMatrix: Float32Array,
  color: Color4
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelMatrix, 0);
  uniformData.set(color, 16);
  return uniformData;
}

/**
 * 组合当前对象的平移、旋转和缩放，生成一份模型矩阵。
 * @param {BundleSceneObjectConfig} config 当前对象的静态配置。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createModelMatrix(config: BundleSceneObjectConfig): Float32Array {
  return multiplyMatrices(
    createTranslationMatrix(
      config.translation[0],
      config.translation[1],
      config.translation[2]
    ),
    multiplyMatrices(
      createRotationYMatrix(config.rotation[1]),
      multiplyMatrices(
        createRotationXMatrix(config.rotation[0]),
        multiplyMatrices(
          createRotationZMatrix(config.rotation[2]),
          createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
        )
      )
    )
  );
}

/**
 * 生成一份偏冷暖混搭的静态碎片颜色，让环带画面更容易分辨层次。
 * @param {number} index 当前碎片索引。
 * @returns {Color4} 当前碎片的 RGBA 颜色。
 */
function createShardColor(index: number): Color4 {
  const palette = [
    [0.27, 0.80, 1.0],
    [1.0, 0.68, 0.29],
    [0.56, 0.86, 0.42],
    [0.76, 0.60, 0.94],
  ] as const;
  const first = palette[index % palette.length];
  const second = palette[(index * 3 + 1) % palette.length];
  const blend = 0.18 + seededUnit(index, 10) * 0.44;
  const brightness = 0.78 + seededUnit(index, 11) * 0.3;

  return [
    Math.min(1, (first[0] * (1 - blend) + second[0] * blend) * brightness),
    Math.min(1, (first[1] * (1 - blend) + second[1] * blend) * brightness),
    Math.min(1, (first[2] * (1 - blend) + second[2] * blend) * brightness),
    1,
  ];
}

/**
 * 生成整节课要复用的一批静态场景对象。
 * @returns {BundleSceneObjectConfig[]} 一个中心结构加一圈碎片的静态对象数组。
 */
function createRenderBundleSceneConfigs(): BundleSceneObjectConfig[] {
  const objects: BundleSceneObjectConfig[] = [
    {
      label: "core",
      translation: [0, 0.1, 0],
      rotation: [0.18, 0.3, 0.12],
      scale: [1.1, 1.1, 1.1],
      color: [0.21, 0.77, 1, 1],
    },
    {
      label: "base-ring",
      translation: [0, -1.2, 0],
      rotation: [0, 0, 0],
      scale: [3.8, 0.12, 3.8],
      color: [0.16, 0.18, 0.24, 1],
    },
    {
      label: "left-spire",
      translation: [-1.55, 0.3, -0.62],
      rotation: [0.2, 0.48, 0.12],
      scale: [0.24, 1.45, 0.24],
      color: [1, 0.7, 0.3, 1],
    },
    {
      label: "right-spire",
      translation: [1.45, 0.2, 0.76],
      rotation: [0.08, -0.35, -0.16],
      scale: [0.28, 1.25, 0.28],
      color: [0.62, 0.86, 0.42, 1],
    },
    {
      label: "rear-spire",
      translation: [0.25, 0.45, -1.75],
      rotation: [0.16, 0.1, 0.21],
      scale: [0.22, 1.6, 0.22],
      color: [0.74, 0.58, 0.93, 1],
    },
    {
      label: "front-arm",
      translation: [0, -0.28, 1.45],
      rotation: [0.18, 0.42, 0],
      scale: [1.9, 0.18, 0.32],
      color: [0.18, 0.72, 0.96, 1],
    },
  ];

  for (let index = 0; index < STATIC_SHARD_COUNT; index += 1) {
    const lane = index % 3;
    const normalized = index / STATIC_SHARD_COUNT;
    const angle = normalized * Math.PI * 2 * (2.25 + lane * 0.34);
    const radius = 3.35 + lane * 0.74 + seededUnit(index, 1) * 0.42;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y =
      (seededUnit(index, 2) - 0.5) * 1.5 +
      Math.sin(angle * 1.8 + lane * 0.4) * 0.18;
    const size = 0.065 + seededUnit(index, 3) * 0.11;

    objects.push({
      label: `shard-${index}`,
      translation: [x, y, z],
      rotation: [
        seededUnit(index, 4) * Math.PI,
        angle + seededUnit(index, 5) * Math.PI,
        seededUnit(index, 6) * Math.PI,
      ],
      scale: [
        size * (0.8 + seededUnit(index, 7) * 1.2),
        size * (1.0 + seededUnit(index, 8) * 2.0),
        size * (0.85 + seededUnit(index, 9) * 1.35),
      ],
      color: createShardColor(index),
    });
  }

  return objects;
}

/**
 * 安全释放深度纹理。
 * @param {BundleDepthTarget} target 当前 lesson 使用的深度目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyDepthTarget(target: BundleDepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 根据当前 canvas 像素尺寸计算左右两半视口。
 * @param {number} width 当前 canvas 像素宽度。
 * @param {number} height 当前 canvas 像素高度。
 * @returns {{ normal: BundlePanelRect; bundle: BundlePanelRect }} 左右两半面板的 viewport / scissor 区域。
 */
function createPanelRects(
  width: number,
  height: number
): { normal: BundlePanelRect; bundle: BundlePanelRect } {
  const split = Math.floor(width * 0.5);

  return {
    normal: {
      x: 0,
      y: 0,
      width: Math.max(1, split),
      height,
    },
    bundle: {
      x: split,
      y: 0,
      width: Math.max(1, width - split),
      height,
    },
  };
}

/**
 * 把一批共享的 draw 命令录进 render pass 或 render bundle encoder。
 * @param {GPURenderPassEncoder | GPURenderBundleEncoder} encoder 当前命令接收器。
 * @param {GPURenderPipeline} pipeline 当前场景使用的渲染管线。
 * @param {GPUBindGroup} frameBindGroup 当前面板的 frame uniform bind group。
 * @param {GPUBuffer} vertexBuffer 共享顶点缓冲。
 * @param {GPUBuffer} indexBuffer 共享索引缓冲。
 * @param {number} indexCount 当前网格的索引数量。
 * @param {BundleRenderObject[]} renderObjects 场景里的静态对象数组。
 * @returns {void} 只写命令，不返回额外结果。
 */
function recordSceneCommands(
  encoder: GPURenderPassEncoder | GPURenderBundleEncoder,
  pipeline: GPURenderPipeline,
  frameBindGroup: GPUBindGroup,
  vertexBuffer: GPUBuffer,
  indexBuffer: GPUBuffer,
  indexCount: number,
  renderObjects: BundleRenderObject[]
): void {
  encoder.setPipeline(pipeline);
  encoder.setBindGroup(0, frameBindGroup);
  encoder.setVertexBuffer(0, vertexBuffer);
  encoder.setIndexBuffer(indexBuffer, "uint16");

  renderObjects.forEach((object) => {
    encoder.setBindGroup(1, object.bindGroup);
    encoder.drawIndexed(indexCount);
  });
}

/**
 * 挂载第 40 课“Render Bundles”，左右对比逐帧重录命令与 executeBundles 的 CPU 编码差异。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源。
 */
export async function mountRenderBundlesLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--bundle">
      <div class="bundle-stage">
        <div class="bundle-stage__labels">
          <div class="bundle-panel-label bundle-panel-label--left">
            <span class="bundle-panel-label__eyebrow">普通 render pass</span>
            <strong class="bundle-panel-label__title">每帧重录整批 draw</strong>
          </div>
          <div class="bundle-panel-label bundle-panel-label--right">
            <span class="bundle-panel-label__eyebrow">render bundle</span>
            <strong class="bundle-panel-label__title">直接执行预录命令</strong>
          </div>
        </div>
        <div class="preview-frame bundle-stage__frame">
          <canvas class="preview-canvas" aria-label="Render bundles lesson preview"></canvas>
          <div class="bundle-overlay" aria-hidden="true">
            <div class="bundle-divider"></div>
          </div>
        </div>
        <div class="bundle-hud">
          <div class="bundle-hud__badges">
            <span class="bundle-badge" data-bundle-badge="scene"></span>
            <span class="bundle-badge" data-bundle-badge="bundle"></span>
            <span class="bundle-badge" data-bundle-badge="rebuild"></span>
          </div>
          <div class="bundle-grid">
            <article class="bundle-card">
              <p class="bundle-card__label">逐帧编码</p>
              <strong class="bundle-card__value" data-bundle-value="normal"></strong>
              <p class="bundle-card__meta" data-bundle-meta="normal"></p>
            </article>
            <article class="bundle-card bundle-card--cool">
              <p class="bundle-card__label">executeBundles</p>
              <strong class="bundle-card__value" data-bundle-value="bundle"></strong>
              <p class="bundle-card__meta" data-bundle-meta="bundle"></p>
            </article>
            <article class="bundle-card bundle-card--accent">
              <p class="bundle-card__label">右侧耗时占比</p>
              <strong class="bundle-card__value" data-bundle-value="ratio"></strong>
              <p class="bundle-card__meta" data-bundle-meta="ratio"></p>
            </article>
            <article class="bundle-card">
              <p class="bundle-card__label">bundle 录制时间</p>
              <strong class="bundle-card__value" data-bundle-value="build"></strong>
              <p class="bundle-card__meta" data-bundle-meta="build"></p>
            </article>
          </div>
          <div class="bundle-hud__legend">
            <p class="bundle-hud__legend-title">当前实验</p>
            <p class="bundle-hud__legend-body" data-bundle-legend-body></p>
          </div>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const viewport = host.querySelector<HTMLDivElement>(".preview-viewport");
  if (!canvas) {
    throw new Error("预览 canvas 没有创建成功。");
  }
  if (!viewport) {
    throw new Error("预览视口没有创建成功。");
  }

  const hudRefs: BundleHudRefs = {
    sceneBadge: host.querySelector<HTMLElement>('[data-bundle-badge="scene"]')!,
    bundleBadge: host.querySelector<HTMLElement>('[data-bundle-badge="bundle"]')!,
    rebuildBadge: host.querySelector<HTMLElement>('[data-bundle-badge="rebuild"]')!,
    normalValue: host.querySelector<HTMLElement>('[data-bundle-value="normal"]')!,
    normalMeta: host.querySelector<HTMLElement>('[data-bundle-meta="normal"]')!,
    bundleValue: host.querySelector<HTMLElement>('[data-bundle-value="bundle"]')!,
    bundleMeta: host.querySelector<HTMLElement>('[data-bundle-meta="bundle"]')!,
    ratioValue: host.querySelector<HTMLElement>('[data-bundle-value="ratio"]')!,
    ratioMeta: host.querySelector<HTMLElement>('[data-bundle-meta="ratio"]')!,
    buildValue: host.querySelector<HTMLElement>('[data-bundle-value="build"]')!,
    buildMeta: host.querySelector<HTMLElement>('[data-bundle-meta="build"]')!,
    legendBody: host.querySelector<HTMLElement>("[data-bundle-legend-body]")!,
  };

  const depthTarget: BundleDepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };

  const metrics: BundleMetricState = {
    objectCount: 0,
    normalCpuMs: 0,
    bundleCpuMs: 0,
    bundleBuildMs: null,
    bundleBuildCount: 0,
    reuseNote: "相机与 viewport 留在 bundle 外",
    sampleCount: 0,
    windowSeconds: CPU_SAMPLE_WINDOW_MS / 1000,
    hasFrameMetrics: false,
  };

  try {
    const gpu = await createWebGpuCanvas(canvas);
    updateHud(hudRefs, metrics);

    /**
     * 根据当前 lesson 的 HUD 密度，给预览区分配一个更高一些的画幅。
     * @returns {void} 只更新预览视口尺寸，不返回额外结果。
     */
    const syncViewport = () => {
      // 40 课同样已经把 badges / cards / legend 都移到了画布外，
      // 继续按整块 lesson 的固定宽高比缩放会把真正的渲染区域压扁。
      viewport.style.width = "100%";
      viewport.style.height = "100%";
    };

    syncViewport();

    const geometry = createRenderBundleLessonGeometry();

    const vertexBuffer = gpu.device.createBuffer({
      size: geometry.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(vertexBuffer, 0, geometry.vertexData);

    const indexBuffer = gpu.device.createBuffer({
      size: geometry.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(indexBuffer, 0, geometry.indexData);

    const frameBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const objectBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-40-render-bundle-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, objectBindGroupLayout],
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: vertexShaderSource }),
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 3 * 4, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: fragmentShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const normalFrameUniformBuffer = gpu.device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bundleFrameUniformBuffer = gpu.device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const normalFrameBindGroup = gpu.device.createBindGroup({
      layout: frameBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: normalFrameUniformBuffer } }],
    });
    const bundleFrameBindGroup = gpu.device.createBindGroup({
      layout: frameBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: bundleFrameUniformBuffer } }],
    });

    const renderObjects = createRenderBundleSceneConfigs().map((config) => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 20 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = gpu.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });
      const modelMatrix = createModelMatrix(config);

      gpu.device.queue.writeBuffer(
        uniformBuffer,
        0,
        createObjectUniformData(modelMatrix, config.color)
      );

      return {
        uniformBuffer,
        bindGroup,
      };
    });

    metrics.objectCount = renderObjects.length;
    updateHud(hudRefs, metrics);

    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, 0, 0],
      eye: [8.4, 4.8, 8.1],
      minRadius: 6.5,
      maxRadius: 18,
      rotateSpeed: 0.008,
      zoomSpeed: 0.008,
    });

    let disposed = false;
    let animationFrameId = 0;
    let renderBundle: GPURenderBundle | null = null;
    let lastHudUpdateTimeMs = -Infinity;
    const cpuMetricSamples: CpuMetricSample[] = [];

    /**
     * 确保深度纹理和当前 canvas 像素尺寸一致。
     * @returns {GPUTextureView} 当前帧可直接挂进 render pass 的深度视图。
     */
    const ensureDepthTarget = (): GPUTextureView => {
      if (
        depthTarget.texture &&
        depthTarget.width === canvas.width &&
        depthTarget.height === canvas.height
      ) {
        return depthTarget.view!;
      }

      destroyDepthTarget(depthTarget);
      depthTarget.width = canvas.width;
      depthTarget.height = canvas.height;
      depthTarget.texture = gpu.device.createTexture({
        size: [canvas.width, canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTarget.view = depthTarget.texture.createView();
      return depthTarget.view;
    };

    /**
     * 重新录制一份只包含静态 draw 列表的 render bundle。
     * @returns {void} 只更新缓存的 render bundle 和指标。
     */
    const rebuildRenderBundle = (): void => {
      const buildStart = performance.now();
      const bundleEncoder = gpu.device.createRenderBundleEncoder({
        colorFormats: [gpu.format],
        depthStencilFormat: "depth24plus",
      });
      recordSceneCommands(
        bundleEncoder,
        renderPipeline,
        bundleFrameBindGroup,
        vertexBuffer,
        indexBuffer,
        geometry.indexCount,
        renderObjects
      );

      renderBundle = bundleEncoder.finish({
        label: "lesson-40-render-bundle",
      });
      metrics.bundleBuildMs = performance.now() - buildStart;
      metrics.bundleBuildCount += 1;
      updateHud(hudRefs, metrics);
    };

    rebuildRenderBundle();

    const render = (timestamp: number) => {
      if (disposed) {
        return;
      }

      syncViewport();
      gpu.resize();

      const depthView = ensureDepthTarget();
      const panelRects = createPanelRects(canvas.width, canvas.height);
      if (!renderBundle) {
        rebuildRenderBundle();
      }

      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
      const normalProjectionMatrix = createPerspectiveMatrix(
        Math.PI / 3.5,
        panelRects.normal.width / panelRects.normal.height,
        0.1,
        80
      );
      const bundleProjectionMatrix = createPerspectiveMatrix(
        Math.PI / 3.5,
        panelRects.bundle.width / panelRects.bundle.height,
        0.1,
        80
      );

      const time = timestamp * 0.001;
      const lightPosition: Vector3 = [
        Math.cos(time * 0.52) * 8,
        4.8 + Math.sin(time * 0.86) * 0.8,
        Math.sin(time * 0.52) * 8,
      ];

      gpu.device.queue.writeBuffer(
        normalFrameUniformBuffer,
        0,
        createFrameUniformData(
          multiplyMatrices(normalProjectionMatrix, viewMatrix),
          lightPosition,
          camera.eye
        )
      );
      gpu.device.queue.writeBuffer(
        bundleFrameUniformBuffer,
        0,
        createFrameUniformData(
          multiplyMatrices(bundleProjectionMatrix, viewMatrix),
          lightPosition,
          camera.eye
        )
      );

      const currentTextureView = gpu.context.getCurrentTexture().createView();
      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-40-command-encoder",
      });

      const normalCpuStart = performance.now();
      const normalPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentTextureView,
            clearValue: { r: 0.028, g: 0.05, b: 0.094, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      normalPass.setViewport(
        panelRects.normal.x,
        panelRects.normal.y,
        panelRects.normal.width,
        panelRects.normal.height,
        0,
        1
      );
      normalPass.setScissorRect(
        panelRects.normal.x,
        panelRects.normal.y,
        panelRects.normal.width,
        panelRects.normal.height
      );
      recordSceneCommands(
        normalPass,
        renderPipeline,
        normalFrameBindGroup,
        vertexBuffer,
        indexBuffer,
        geometry.indexCount,
        renderObjects
      );
      normalPass.end();

      const normalCpuFrameMs = performance.now() - normalCpuStart;

      const bundleCpuStart = performance.now();
      const bundlePass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentTextureView,
            loadOp: "load",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      bundlePass.setViewport(
        panelRects.bundle.x,
        panelRects.bundle.y,
        panelRects.bundle.width,
        panelRects.bundle.height,
        0,
        1
      );
      bundlePass.setScissorRect(
        panelRects.bundle.x,
        panelRects.bundle.y,
        panelRects.bundle.width,
        panelRects.bundle.height
      );
      bundlePass.executeBundles([renderBundle!]);
      bundlePass.end();

      const bundleCpuFrameMs = performance.now() - bundleCpuStart;
      const sampleTimeMs = performance.now();
      recordCpuMetricSample(cpuMetricSamples, metrics, {
        timeMs: sampleTimeMs,
        normalMs: normalCpuFrameMs,
        bundleMs: bundleCpuFrameMs,
      });

      gpu.device.queue.submit([commandEncoder.finish()]);

      if (sampleTimeMs - lastHudUpdateTimeMs >= HUD_UPDATE_INTERVAL_MS) {
        lastHudUpdateTimeMs = sampleTimeMs;
        updateHud(hudRefs, metrics);
      }
    };

    const frame = (timestamp: number) => {
      render(timestamp);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      destroyDepthTarget(depthTarget);
      render(performance.now());
    });
    resizeObserver.observe(host);

    render(performance.now());
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "Render Bundles 已运行",
      detail:
        "左侧每帧重新录静态 draw 列表，右侧把它们预录成 render bundle 后复用。拖动相机时，HUD 会持续对比两边 CPU 录制时间，同时强调“把相机 uniform 和 viewport 放在 bundle 外”这个复用边界。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitCamera.dispose();
      destroyDepthTarget(depthTarget);
      vertexBuffer.destroy();
      indexBuffer.destroy();
      normalFrameUniformBuffer.destroy();
      bundleFrameUniformBuffer.destroy();
      renderObjects.forEach((object) => object.uniformBuffer.destroy());
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

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
