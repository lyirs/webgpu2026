import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createClusteredShadingLessonGeometry } from "@/lessons/lesson-53-clustered-shading/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-53-clustered-shading/math";
import computeShaderSource from "@/lessons/lesson-53-clustered-shading/clusters.compute.wgsl?raw";
import fragmentShaderSource from "@/lessons/lesson-53-clustered-shading/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-53-clustered-shading/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type Color4 = [number, number, number, number];

type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  scale: Vector3;
  color: Color4;
};

type RenderObject = {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ClusteredSettings = {
  lightCount: number;
  lightRadius: number;
  zSlices: number;
  animationSpeed: number;
};

type ClusterMetrics = {
  averageLightsPerCluster: number | null;
  maxLightsPerCluster: number | null;
  activeClusterCount: number | null;
  pendingReadback: boolean;
};

type ClusterHudRefs = {
  lightBadge: HTMLElement;
  clusterBadge: HTMLElement;
  computeBadge: HTMLElement;
  lightOutput: HTMLElement;
  radiusOutput: HTMLElement;
  sliceOutput: HTMLElement;
  speedOutput: HTMLElement;
  naiveValue: HTMLElement;
  naiveMeta: HTMLElement;
  averageValue: HTMLElement;
  averageMeta: HTMLElement;
  maxValue: HTMLElement;
  maxMeta: HTMLElement;
  activeValue: HTMLElement;
  activeMeta: HTMLElement;
  legendBody: HTMLElement;
};

const TILE_COUNT_X = 8;
const TILE_COUNT_Y = 6;
const MAX_Z_SLICES = 8;
const MAX_LIGHT_COUNT = 72;
const MAX_LIGHTS_PER_CLUSTER = 36;
const MAX_CLUSTER_COUNT = TILE_COUNT_X * TILE_COUNT_Y * MAX_Z_SLICES;
const LIGHT_STRUCT_FLOATS = 8;
const SCENE_UNIFORM_BYTES = 192;
const CLUSTER_UNIFORM_BYTES = 96;
const READBACK_INTERVAL_MS = 220;
const CAMERA_FOV = Math.PI / 3.2;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 32;

/**
 * 把整数格式化成更适合 HUD 的中文数字字符串。
 * @param {number} value 当前数字。
 * @returns {string} 对应的格式化文本。
 */
function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 把浮点数格式化成固定两位小数。
 * @param {number} value 当前数值。
 * @returns {string} 对应的展示文本。
 */
function formatFixed(value: number): string {
  return value.toFixed(2);
}

/**
 * 把单个 cluster 平均灯数格式化成短文本。
 * @param {number | null} value 当前均值。
 * @returns {string} 对应的展示文本。
 */
function formatAverage(value: number | null): string {
  if (value === null) {
    return "等待首轮";
  }

  return `${value.toFixed(1)} 盏`;
}

/**
 * 把当前动画速度格式化成 `1.00x` 文本。
 * @param {number} value 当前动画速度。
 * @returns {string} 对应的展示文本。
 */
function formatSpeed(value: number): string {
  return `${value.toFixed(2)}x`;
}

/**
 * 根据平移和缩放生成一份模型矩阵。
 * @param {SceneObjectConfig} config 当前对象配置。
 * @returns {Float32Array} 对应的模型矩阵。
 */
function createModelMatrix(config: SceneObjectConfig): Float32Array {
  return multiplyMatrices(
    createTranslationMatrix(
      config.translation[0],
      config.translation[1],
      config.translation[2]
    ),
    createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
  );
}

/**
 * 创建第 45 课的静态场景：底板 + 一组高低错落的柱体。
 * @returns {SceneObjectConfig[]} 对应的静态对象配置。
 */
function createSceneConfigs(): SceneObjectConfig[] {
  const objects: SceneObjectConfig[] = [
    {
      label: "floor",
      translation: [0, -1.25, 0],
      scale: [6.8, 0.16, 6.8],
      color: [0.11, 0.14, 0.18, 1],
    },
    {
      label: "platform",
      translation: [0, -0.98, 0],
      scale: [4.4, 0.18, 4.4],
      color: [0.16, 0.20, 0.25, 1],
    },
  ];

  const laneColors: Color4[] = [
    [0.24, 0.47, 0.71, 1],
    [0.18, 0.58, 0.39, 1],
    [0.73, 0.46, 0.18, 1],
  ];

  const positionsX = [-3.4, -1.7, 0, 1.7, 3.4];
  const positionsZ = [-2.8, 0, 2.8];

  positionsZ.forEach((z, rowIndex) => {
    positionsX.forEach((x, columnIndex) => {
      const height = 0.7 + ((rowIndex + columnIndex) % 4) * 0.34;
      const width = 0.42 + (columnIndex % 2) * 0.09;

      objects.push({
        label: `pillar-${rowIndex}-${columnIndex}`,
        translation: [x, -0.98 + height, z],
        scale: [width, height, width],
        color: laneColors[rowIndex % laneColors.length],
      });
    });
  });

  return objects;
}

/**
 * 生成静态对象使用的 uniform 数据。
 * @param {Float32Array} modelMatrix 当前对象模型矩阵。
 * @param {Color4} color 当前对象颜色。
 * @returns {Float32Array} 对应的连续 uniform 数据。
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
 * 根据当前灯光参数和时间生成一整帧点光源数据。
 * @param {ClusteredSettings} settings 当前课程控制参数。
 * @param {number} timeSeconds 当前时间，单位秒。
 * @returns {Float32Array} 对应的点光源 storage buffer 数据。
 */
function createLightData(
  settings: ClusteredSettings,
  timeSeconds: number
): Float32Array {
  const lightData = new Float32Array(MAX_LIGHT_COUNT * LIGHT_STRUCT_FLOATS);
  const palette: Array<[number, number, number]> = [
    [0.22, 0.78, 1.0],
    [1.0, 0.67, 0.28],
    [0.62, 0.52, 1.0],
    [0.35, 0.95, 0.58],
    [1.0, 0.46, 0.64],
    [0.95, 0.88, 0.42],
  ];
  const time = timeSeconds * settings.animationSpeed;

  for (let index = 0; index < MAX_LIGHT_COUNT; index += 1) {
    const base = index * LIGHT_STRUCT_FLOATS;
    const orbitBand = index % 6;
    const ring = Math.floor(index / 12);
    const angle = (index / Math.max(settings.lightCount, 1)) * Math.PI * 2;
    const radius = 1.9 + orbitBand * 0.33 + ring * 0.28;
    const spin = time * (0.28 + orbitBand * 0.035);
    const x = Math.cos(angle + spin) * radius;
    const z = Math.sin(angle * 1.12 + spin * 0.82) * (radius * 0.82);
    const y = 0.25 + ring * 0.28 + Math.sin(spin * 1.6 + index * 0.35) * 0.72;
    const color = palette[index % palette.length];
    const intensity = 1.2 + (orbitBand % 3) * 0.26;

    lightData[base] = x;
    lightData[base + 1] = y;
    lightData[base + 2] = z;
    lightData[base + 3] = index < settings.lightCount ? settings.lightRadius : 0;

    lightData[base + 4] = index < settings.lightCount ? color[0] : 0;
    lightData[base + 5] = index < settings.lightCount ? color[1] : 0;
    lightData[base + 6] = index < settings.lightCount ? color[2] : 0;
    lightData[base + 7] = index < settings.lightCount ? intensity : 0;
  }

  return lightData;
}

/**
 * 组装 render pipeline 会读取的场景级 uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前 VP 矩阵。
 * @param {Float32Array} viewMatrix 当前视图矩阵。
 * @param {Vector3} eyePosition 当前相机位置。
 * @param {PanelRect} viewportRect 当前 pane 在像素空间里的矩形。
 * @param {ClusteredSettings} settings 当前课程参数。
 * @returns {ArrayBuffer} 对应的 uniform 数据块。
 */
function createSceneUniformData(
  viewProjectionMatrix: Float32Array,
  viewMatrix: Float32Array,
  eyePosition: Vector3,
  viewportRect: PanelRect,
  settings: ClusteredSettings
): ArrayBuffer {
  const buffer = new ArrayBuffer(SCENE_UNIFORM_BYTES);
  const floats = new Float32Array(buffer);
  const uints = new Uint32Array(buffer);

  floats.set(viewProjectionMatrix, 0);
  floats.set(viewMatrix, 16);
  floats.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 32);
  floats.set(
    [viewportRect.x, viewportRect.y, viewportRect.width, viewportRect.height],
    36
  );
  uints.set([TILE_COUNT_X, TILE_COUNT_Y, settings.zSlices, settings.lightCount], 40);
  floats.set([CAMERA_NEAR, CAMERA_FAR, 0, 0], 44);

  return buffer;
}

/**
 * 组装 compute 阶段会读取的 cluster 构建 uniform 数据。
 * @param {Float32Array} viewMatrix 当前视图矩阵。
 * @param {number} aspect 当前 pane 的宽高比。
 * @param {ClusteredSettings} settings 当前课程参数。
 * @returns {ArrayBuffer} 对应的 compute uniform 数据块。
 */
function createClusterUniformData(
  viewMatrix: Float32Array,
  aspect: number,
  settings: ClusteredSettings
): ArrayBuffer {
  const buffer = new ArrayBuffer(CLUSTER_UNIFORM_BYTES);
  const floats = new Float32Array(buffer);
  const uints = new Uint32Array(buffer);
  const tanHalfFovY = Math.tan(CAMERA_FOV * 0.5);
  const tanHalfFovX = tanHalfFovY * aspect;

  floats.set(viewMatrix, 0);
  uints.set([TILE_COUNT_X, TILE_COUNT_Y, settings.zSlices, settings.lightCount], 16);
  floats.set([CAMERA_NEAR, CAMERA_FAR, tanHalfFovX, tanHalfFovY], 20);

  return buffer;
}

/**
 * 安全释放深度纹理。
 * @param {DepthTarget} target 当前 lesson 的深度目标状态。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 确保深度纹理和当前画布像素尺寸一致。
 * @param {DepthTarget} target 当前深度目标状态。
 * @param {GPUDevice} device 当前 lesson 共享的 device。
 * @param {HTMLCanvasElement} canvas 当前渲染画布。
 * @returns {GPUTextureView} 当前帧可直接挂进 render pass 的深度视图。
 */
function ensureDepthTarget(
  target: DepthTarget,
  device: GPUDevice,
  canvas: HTMLCanvasElement
): GPUTextureView {
  if (
    target.view &&
    target.width === canvas.width &&
    target.height === canvas.height
  ) {
    return target.view;
  }

  destroyDepthTarget(target);
  target.width = canvas.width;
  target.height = canvas.height;
  target.texture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  target.view = target.texture.createView();
  return target.view;
}

/**
 * 为左右两个 pane 计算对应的 viewport / scissor 矩形。
 * @param {HTMLCanvasElement} canvas 当前 lesson 画布。
 * @returns {{ left: PanelRect; right: PanelRect }} 左右两个 pane 的像素矩形。
 */
function createPanelRects(canvas: HTMLCanvasElement): {
  left: PanelRect;
  right: PanelRect;
} {
  const halfWidth = Math.floor(canvas.width / 2);

  return {
    left: {
      x: 0,
      y: 0,
      width: halfWidth,
      height: canvas.height,
    },
    right: {
      x: halfWidth,
      y: 0,
      width: canvas.width - halfWidth,
      height: canvas.height,
    },
  };
}

/**
 * 根据当前设置和统计结果生成更贴近课程讲解的总结文案。
 * @param {ClusteredSettings} settings 当前课程参数。
 * @param {ClusterMetrics} metrics 当前 cluster 读回指标。
 * @returns {string} 对应的说明文本。
 */
function createLegendCopy(
  settings: ClusteredSettings,
  metrics: ClusterMetrics
): string {
  if (
    metrics.averageLightsPerCluster !== null &&
    metrics.averageLightsPerCluster < settings.lightCount * 0.28
  ) {
    return `虽然场景里一共有 ${formatCount(settings.lightCount)} 盏灯，但右侧大多数 cluster 平均只需要看 ${formatAverage(
      metrics.averageLightsPerCluster
    )}。这就是 clustered shading 的意义：先筛灯，再在片元里做真正的光照。`;
  }

  if (settings.lightRadius > 2.7) {
    return "把灯半径拉大以后，更多 point lights 会同时落进同一个 cluster；右侧仍然在做筛选，但每个 cluster 的灯列表会明显变长。";
  }

  return "左边每个片元都会完整遍历所有点光源；右边则先用 compute 为每个 cluster 生成灯列表，再只处理和当前 cluster 相关的那一小部分灯。";
}

/**
 * 根据当前课程参数和 cluster 指标刷新 HUD。
 * @param {ClusterHudRefs} refs HUD 的 DOM 引用。
 * @param {ClusteredSettings} settings 当前课程参数。
 * @param {ClusterMetrics} metrics 当前 cluster 统计。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(
  refs: ClusterHudRefs,
  settings: ClusteredSettings,
  metrics: ClusterMetrics
): void {
  const totalClusters = TILE_COUNT_X * TILE_COUNT_Y * settings.zSlices;

  refs.lightBadge.textContent = `${formatCount(settings.lightCount)} 盏 lights · 同一套场景`;
  refs.lightBadge.className = "cluster-badge cluster-badge--cool";

  refs.clusterBadge.textContent = `${TILE_COUNT_X} × ${TILE_COUNT_Y} × ${settings.zSlices} = ${formatCount(totalClusters)} 个 clusters`;
  refs.clusterBadge.className = "cluster-badge";

  refs.computeBadge.textContent =
    metrics.pendingReadback && metrics.averageLightsPerCluster === null
      ? "compute culling · 首轮统计中"
      : "compute culling · 每帧更新 light lists";
  refs.computeBadge.className = "cluster-badge cluster-badge--accent";

  refs.lightOutput.textContent = formatCount(settings.lightCount);
  refs.radiusOutput.textContent = formatFixed(settings.lightRadius);
  refs.sliceOutput.textContent = `${settings.zSlices}`;
  refs.speedOutput.textContent = formatSpeed(settings.animationSpeed);

  refs.naiveValue.textContent = `${formatCount(settings.lightCount)} 盏`;
  refs.naiveMeta.textContent =
    "左侧：每个片元都会完整遍历这一整批点光源。";

  refs.averageValue.textContent = formatAverage(metrics.averageLightsPerCluster);
  refs.averageMeta.textContent =
    metrics.averageLightsPerCluster === null
      ? "右侧：等第一轮 cluster 统计读回后，这里会显示平均每个 cluster 真正要看的灯数。"
      : "右侧：把所有 clusters 平均后，每个 cluster 实际只保留下来的灯数。";

  refs.maxValue.textContent =
    metrics.maxLightsPerCluster === null
      ? "等待首轮"
      : `${formatCount(metrics.maxLightsPerCluster)} 盏`;
  refs.maxMeta.textContent =
    `当前 cluster list 单次上限 ${formatCount(MAX_LIGHTS_PER_CLUSTER)} 盏；这里显示这一帧里最拥挤的 cluster。`;

  refs.activeValue.textContent =
    metrics.activeClusterCount === null
      ? "等待首轮"
      : `${formatCount(metrics.activeClusterCount)} / ${formatCount(totalClusters)}`;
  refs.activeMeta.textContent =
    "至少命中了一盏灯的 clusters 数量。";

  refs.legendBody.textContent = createLegendCopy(settings, metrics);
}

/**
 * 挂载第 45 课“Clustered Shading”，演示朴素多灯遍历和 cluster 预筛灯的差别。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源。
 */
export async function mountClusteredShadingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--clustered">
      <div class="cluster-stage">
        <div class="cluster-stage__badges">
          <span class="cluster-badge" data-cluster-badge="lights"></span>
          <span class="cluster-badge" data-cluster-badge="clusters"></span>
          <span class="cluster-badge" data-cluster-badge="compute"></span>
        </div>

        <div class="cluster-controls">
          <label class="cluster-control">
            <span class="cluster-control__row">
              <span class="cluster-control__label">灯数量</span>
              <span class="cluster-control__value" data-cluster-control-output="lights"></span>
            </span>
            <input
              class="cluster-control__range"
              data-cluster-control="lights"
              type="range"
              min="18"
              max="72"
              step="2"
              value="48"
            />
          </label>

          <label class="cluster-control">
            <span class="cluster-control__row">
              <span class="cluster-control__label">灯半径</span>
              <span class="cluster-control__value" data-cluster-control-output="radius"></span>
            </span>
            <input
              class="cluster-control__range"
              data-cluster-control="radius"
              type="range"
              min="1.2"
              max="3.2"
              step="0.05"
              value="2.15"
            />
          </label>

          <label class="cluster-control">
            <span class="cluster-control__row">
              <span class="cluster-control__label">深度切片</span>
              <span class="cluster-control__value" data-cluster-control-output="slices"></span>
            </span>
            <input
              class="cluster-control__range"
              data-cluster-control="slices"
              type="range"
              min="4"
              max="${MAX_Z_SLICES}"
              step="1"
              value="6"
            />
          </label>

          <label class="cluster-control">
            <span class="cluster-control__row">
              <span class="cluster-control__label">动画速度</span>
              <span class="cluster-control__value" data-cluster-control-output="speed"></span>
            </span>
            <input
              class="cluster-control__range"
              data-cluster-control="speed"
              type="range"
              min="0.25"
              max="1.60"
              step="0.05"
              value="1.00"
            />
          </label>
        </div>

        <div class="cluster-stage__labels">
          <div class="cluster-panel-label cluster-panel-label--naive">
            <span class="cluster-panel-label__eyebrow">Naive</span>
            <strong class="cluster-panel-label__title">逐像素遍历全部 lights</strong>
          </div>
          <div class="cluster-panel-label cluster-panel-label--clustered">
            <span class="cluster-panel-label__eyebrow">Clustered</span>
            <strong class="cluster-panel-label__title">先 compute 筛灯再光照</strong>
          </div>
        </div>

        <div class="preview-frame cluster-stage__frame">
          <canvas class="preview-canvas" aria-label="Clustered shading lesson preview"></canvas>
        </div>

        <div class="cluster-card-grid">
          <article class="cluster-card">
            <p class="cluster-card__label">左侧逐像素检查</p>
            <strong class="cluster-card__value" data-cluster-card-value="naive"></strong>
            <p class="cluster-card__meta" data-cluster-card-meta="naive"></p>
          </article>

          <article class="cluster-card cluster-card--cool">
            <p class="cluster-card__label">右侧平均 cluster lights</p>
            <strong class="cluster-card__value" data-cluster-card-value="average"></strong>
            <p class="cluster-card__meta" data-cluster-card-meta="average"></p>
          </article>

          <article class="cluster-card cluster-card--accent">
            <p class="cluster-card__label">右侧最大 cluster lights</p>
            <strong class="cluster-card__value" data-cluster-card-value="max"></strong>
            <p class="cluster-card__meta" data-cluster-card-meta="max"></p>
          </article>

          <article class="cluster-card">
            <p class="cluster-card__label">活跃 clusters</p>
            <strong class="cluster-card__value" data-cluster-card-value="active"></strong>
            <p class="cluster-card__meta" data-cluster-card-meta="active"></p>
          </article>
        </div>

        <div class="cluster-stage__legend">
          <p class="cluster-stage__legend-title">当前实验</p>
          <p class="cluster-stage__legend-body" data-cluster-legend></p>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const viewport = host.querySelector<HTMLDivElement>(".preview-viewport");
  const lightRange = host.querySelector<HTMLInputElement>('[data-cluster-control="lights"]');
  const radiusRange = host.querySelector<HTMLInputElement>('[data-cluster-control="radius"]');
  const sliceRange = host.querySelector<HTMLInputElement>('[data-cluster-control="slices"]');
  const speedRange = host.querySelector<HTMLInputElement>('[data-cluster-control="speed"]');

  if (
    !canvas ||
    !viewport ||
    !lightRange ||
    !radiusRange ||
    !sliceRange ||
    !speedRange
  ) {
    throw new Error("第 45 课的预览结构没有完整创建出来。");
  }

  const refs: ClusterHudRefs = {
    lightBadge: host.querySelector<HTMLElement>('[data-cluster-badge="lights"]')!,
    clusterBadge: host.querySelector<HTMLElement>('[data-cluster-badge="clusters"]')!,
    computeBadge: host.querySelector<HTMLElement>('[data-cluster-badge="compute"]')!,
    lightOutput: host.querySelector<HTMLElement>('[data-cluster-control-output="lights"]')!,
    radiusOutput: host.querySelector<HTMLElement>('[data-cluster-control-output="radius"]')!,
    sliceOutput: host.querySelector<HTMLElement>('[data-cluster-control-output="slices"]')!,
    speedOutput: host.querySelector<HTMLElement>('[data-cluster-control-output="speed"]')!,
    naiveValue: host.querySelector<HTMLElement>('[data-cluster-card-value="naive"]')!,
    naiveMeta: host.querySelector<HTMLElement>('[data-cluster-card-meta="naive"]')!,
    averageValue: host.querySelector<HTMLElement>('[data-cluster-card-value="average"]')!,
    averageMeta: host.querySelector<HTMLElement>('[data-cluster-card-meta="average"]')!,
    maxValue: host.querySelector<HTMLElement>('[data-cluster-card-value="max"]')!,
    maxMeta: host.querySelector<HTMLElement>('[data-cluster-card-meta="max"]')!,
    activeValue: host.querySelector<HTMLElement>('[data-cluster-card-value="active"]')!,
    activeMeta: host.querySelector<HTMLElement>('[data-cluster-card-meta="active"]')!,
    legendBody: host.querySelector<HTMLElement>("[data-cluster-legend]")!,
  };

  const settings: ClusteredSettings = {
    lightCount: Number.parseInt(lightRange.value, 10),
    lightRadius: Number.parseFloat(radiusRange.value),
    zSlices: Number.parseInt(sliceRange.value, 10),
    animationSpeed: Number.parseFloat(speedRange.value),
  };

  const metrics: ClusterMetrics = {
    averageLightsPerCluster: null,
    maxLightsPerCluster: null,
    activeClusterCount: null,
    pendingReadback: true,
  };

  updateHud(refs, settings, metrics);

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const geometry = createClusteredShadingLessonGeometry();
    const sceneConfigs = createSceneConfigs();

    const syncViewport = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const compactLayout = window.matchMedia("(max-width: 1180px)").matches;
      const aspect = compactLayout ? 1.02 : 1.26;

      let nextWidth = width;
      let nextHeight = nextWidth / aspect;

      if (nextHeight > height) {
        nextHeight = height;
        nextWidth = nextHeight * aspect;
      }

      viewport.style.width = `${Math.floor(nextWidth)}px`;
      viewport.style.height = `${Math.floor(nextHeight)}px`;
    };

    syncViewport();
    gpu.resize();

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

    const sceneBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
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

    const computeBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
      ],
    });

    const vertexShaderModule = gpu.device.createShaderModule({ code: vertexShaderSource });
    const fragmentShaderModule = gpu.device.createShaderModule({ code: fragmentShaderSource });

    const objectPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [sceneBindGroupLayout, objectBindGroupLayout],
    });
    const markerPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [sceneBindGroupLayout],
    });

    const naivePipeline = gpu.device.createRenderPipeline({
      label: "lesson-45-naive-lighting-pipeline",
      layout: objectPipelineLayout,
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsObject",
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
        module: fragmentShaderModule,
        entryPoint: "fsNaive",
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

    const clusteredPipeline = gpu.device.createRenderPipeline({
      label: "lesson-45-clustered-lighting-pipeline",
      layout: objectPipelineLayout,
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsObject",
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
        module: fragmentShaderModule,
        entryPoint: "fsClustered",
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

    const lightMarkerPipeline = gpu.device.createRenderPipeline({
      label: "lesson-45-light-marker-pipeline",
      layout: markerPipelineLayout,
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsLightMarker",
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
        module: fragmentShaderModule,
        entryPoint: "fsLightMarker",
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

    const leftSceneUniformBuffer = gpu.device.createBuffer({
      size: SCENE_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const rightSceneUniformBuffer = gpu.device.createBuffer({
      size: SCENE_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const lightBuffer = gpu.device.createBuffer({
      size: MAX_LIGHT_COUNT * LIGHT_STRUCT_FLOATS * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const clusterCountsBuffer = gpu.device.createBuffer({
      size: MAX_CLUSTER_COUNT * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const clusterLightIndicesBuffer = gpu.device.createBuffer({
      size: MAX_CLUSTER_COUNT * MAX_LIGHTS_PER_CLUSTER * 4,
      usage: GPUBufferUsage.STORAGE,
    });

    const leftSceneBindGroup = gpu.device.createBindGroup({
      layout: sceneBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: leftSceneUniformBuffer } },
        { binding: 1, resource: { buffer: lightBuffer } },
        { binding: 2, resource: { buffer: clusterCountsBuffer } },
        { binding: 3, resource: { buffer: clusterLightIndicesBuffer } },
      ],
    });
    const rightSceneBindGroup = gpu.device.createBindGroup({
      layout: sceneBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: rightSceneUniformBuffer } },
        { binding: 1, resource: { buffer: lightBuffer } },
        { binding: 2, resource: { buffer: clusterCountsBuffer } },
        { binding: 3, resource: { buffer: clusterLightIndicesBuffer } },
      ],
    });

    const renderObjects: RenderObject[] = sceneConfigs.map((config) => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 20 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = gpu.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      gpu.device.queue.writeBuffer(
        uniformBuffer,
        0,
        createObjectUniformData(createModelMatrix(config), config.color)
      );

      return {
        uniformBuffer,
        bindGroup,
      };
    });

    const clusterUniformBuffer = gpu.device.createBuffer({
      size: CLUSTER_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const computeBindGroup = gpu.device.createBindGroup({
      layout: computeBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: clusterUniformBuffer } },
        { binding: 1, resource: { buffer: lightBuffer } },
        { binding: 2, resource: { buffer: clusterCountsBuffer } },
        { binding: 3, resource: { buffer: clusterLightIndicesBuffer } },
      ],
    });

    const readbackBuffer = gpu.device.createBuffer({
      size: MAX_CLUSTER_COUNT * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-45-cluster-light-culling-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [computeBindGroupLayout],
      }),
      compute: {
        module: gpu.device.createShaderModule({ code: computeShaderSource }),
        entryPoint: "csMain",
      },
    });

    const depthTarget: DepthTarget = {
      texture: null,
      view: null,
      width: 0,
      height: 0,
    };

    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, -0.12, 0],
      eye: [7.4, 5.4, 8.2],
      minRadius: 6.4,
      maxRadius: 15.5,
      rotateSpeed: 0.0075,
      zoomSpeed: 0.004,
      onChange: () => render(performance.now()),
    });

    let disposed = false;
    let animationFrameId = 0;
    let lastReadbackTimeMs = -Infinity;
    let readbackPending = false;

    const requestClusterReadback = async () => {
      if (disposed || readbackPending) {
        return;
      }

      readbackPending = true;
      metrics.pendingReadback = true;
      updateHud(refs, settings, metrics);

      const clusterCount = TILE_COUNT_X * TILE_COUNT_Y * settings.zSlices;
      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-45-cluster-readback-encoder",
      });
      encoder.copyBufferToBuffer(
        clusterCountsBuffer,
        0,
        readbackBuffer,
        0,
        clusterCount * 4
      );
      gpu.device.queue.submit([encoder.finish()]);

      try {
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        const values = new Uint32Array(readbackBuffer.getMappedRange()).slice(0, clusterCount);
        readbackBuffer.unmap();

        let total = 0;
        let maxCount = 0;
        let activeCount = 0;

        for (const value of values) {
          total += value;
          if (value > maxCount) {
            maxCount = value;
          }
          if (value > 0) {
            activeCount += 1;
          }
        }

        metrics.averageLightsPerCluster = total / Math.max(clusterCount, 1);
        metrics.maxLightsPerCluster = maxCount;
        metrics.activeClusterCount = activeCount;
      } catch {
        metrics.averageLightsPerCluster = null;
        metrics.maxLightsPerCluster = null;
        metrics.activeClusterCount = null;
      } finally {
        if (readbackBuffer.mapState === "mapped") {
          readbackBuffer.unmap();
        }

        readbackPending = false;
        metrics.pendingReadback = false;

        if (!disposed) {
          updateHud(refs, settings, metrics);
        }
      }
    };

    const render = (timestamp: number) => {
      if (disposed) {
        return;
      }

      syncViewport();
      gpu.resize();

      const panelRects = createPanelRects(canvas);
      const depthView = ensureDepthTarget(depthTarget, gpu.device, canvas);
      const camera = orbitCamera.getSnapshot();
      const aspect = panelRects.left.width / Math.max(panelRects.left.height, 1);
      const timeSeconds = timestamp * 0.001;
      const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        CAMERA_FOV,
        aspect,
        CAMERA_NEAR,
        CAMERA_FAR
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);

      gpu.device.queue.writeBuffer(
        lightBuffer,
        0,
        createLightData(settings, timeSeconds)
      );
      gpu.device.queue.writeBuffer(
        clusterUniformBuffer,
        0,
        createClusterUniformData(viewMatrix, aspect, settings)
      );
      gpu.device.queue.writeBuffer(
        leftSceneUniformBuffer,
        0,
        createSceneUniformData(
          viewProjectionMatrix,
          viewMatrix,
          camera.eye,
          panelRects.left,
          settings
        )
      );
      gpu.device.queue.writeBuffer(
        rightSceneUniformBuffer,
        0,
        createSceneUniformData(
          viewProjectionMatrix,
          viewMatrix,
          camera.eye,
          panelRects.right,
          settings
        )
      );

      const totalClusters = TILE_COUNT_X * TILE_COUNT_Y * settings.zSlices;
      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-45-command-encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "lesson-45-cluster-build-pass",
      });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(totalClusters / 64));
      computePass.end();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.013, g: 0.022, b: 0.038, a: 1 },
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

      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.setIndexBuffer(indexBuffer, "uint16");

      renderPass.setViewport(
        panelRects.left.x,
        panelRects.left.y,
        panelRects.left.width,
        panelRects.left.height,
        0,
        1
      );
      renderPass.setScissorRect(
        panelRects.left.x,
        panelRects.left.y,
        panelRects.left.width,
        panelRects.left.height
      );
      renderPass.setPipeline(naivePipeline);
      renderPass.setBindGroup(0, leftSceneBindGroup);

      renderObjects.forEach((object) => {
        renderPass.setBindGroup(1, object.bindGroup);
        renderPass.drawIndexed(geometry.indexCount);
      });

      renderPass.setPipeline(lightMarkerPipeline);
      renderPass.setBindGroup(0, leftSceneBindGroup);
      renderPass.drawIndexed(geometry.indexCount, settings.lightCount);

      renderPass.setViewport(
        panelRects.right.x,
        panelRects.right.y,
        panelRects.right.width,
        panelRects.right.height,
        0,
        1
      );
      renderPass.setScissorRect(
        panelRects.right.x,
        panelRects.right.y,
        panelRects.right.width,
        panelRects.right.height
      );
      renderPass.setPipeline(clusteredPipeline);
      renderPass.setBindGroup(0, rightSceneBindGroup);

      renderObjects.forEach((object) => {
        renderPass.setBindGroup(1, object.bindGroup);
        renderPass.drawIndexed(geometry.indexCount);
      });

      renderPass.setPipeline(lightMarkerPipeline);
      renderPass.setBindGroup(0, rightSceneBindGroup);
      renderPass.drawIndexed(geometry.indexCount, settings.lightCount);
      renderPass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);

      if (timestamp - lastReadbackTimeMs >= READBACK_INTERVAL_MS) {
        lastReadbackTimeMs = timestamp;
        void requestClusterReadback();
      }
    };

    const frame = (timestamp: number) => {
      render(timestamp);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const onLightInput = () => {
      settings.lightCount = Number.parseInt(lightRange.value, 10);
      updateHud(refs, settings, metrics);
    };
    const onRadiusInput = () => {
      settings.lightRadius = Number.parseFloat(radiusRange.value);
      updateHud(refs, settings, metrics);
    };
    const onSliceInput = () => {
      settings.zSlices = Number.parseInt(sliceRange.value, 10);
      updateHud(refs, settings, metrics);
    };
    const onSpeedInput = () => {
      settings.animationSpeed = Number.parseFloat(speedRange.value);
      updateHud(refs, settings, metrics);
    };

    lightRange.addEventListener("input", onLightInput);
    radiusRange.addEventListener("input", onRadiusInput);
    sliceRange.addEventListener("input", onSliceInput);
    speedRange.addEventListener("input", onSpeedInput);

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      destroyDepthTarget(depthTarget);
      render(performance.now());
    });
    resizeObserver.observe(host);

    render(performance.now());
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "Clustered Shading 已运行",
      detail:
        "左侧保持最朴素的 per-fragment 多灯遍历，右侧则先用 compute 为 clusters 筛灯，再只读取当前 cluster 的 light list。整节课的重点是“可扩展的光照组织”，而不是某一盏灯怎么写。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitCamera.dispose();
      lightRange.removeEventListener("input", onLightInput);
      radiusRange.removeEventListener("input", onRadiusInput);
      sliceRange.removeEventListener("input", onSliceInput);
      speedRange.removeEventListener("input", onSpeedInput);
      vertexBuffer.destroy();
      indexBuffer.destroy();
      leftSceneUniformBuffer.destroy();
      rightSceneUniformBuffer.destroy();
      lightBuffer.destroy();
      clusterCountsBuffer.destroy();
      clusterLightIndicesBuffer.destroy();
      clusterUniformBuffer.destroy();
      readbackBuffer.destroy();
      renderObjects.forEach((object) => object.uniformBuffer.destroy());
      destroyDepthTarget(depthTarget);
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
