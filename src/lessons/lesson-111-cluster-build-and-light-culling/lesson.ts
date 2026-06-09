import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createClusterCullingLessonGeometry } from "@/lessons/lesson-111-cluster-build-and-light-culling/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-111-cluster-build-and-light-culling/math";
import computeShaderSource from "@/lessons/lesson-111-cluster-build-and-light-culling/clusters.compute.wgsl?raw";
import fragmentShaderSource from "@/lessons/lesson-111-cluster-build-and-light-culling/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-111-cluster-build-and-light-culling/scene.vert.wgsl?raw";

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

type ClusterCullingSettings = {
  lightCount: number;
  lightRadius: number;
  zSlices: number;
  animationSpeed: number;
};

type ClusterCullingMetrics = {
  averageLightsPerCluster: number | null;
  maxLightsPerCluster: number | null;
  activeClusterCount: number | null;
  hottestClusterLabel: string;
  sampleLights: number[];
  sliceCounts: Uint32Array | null;
  pendingReadback: boolean;
  hottestSliceIndex: number | null;
  hottestSliceAverage: number | null;
};

type SlicePanelRefs = {
  root: HTMLElement;
  title: HTMLElement;
  meta: HTMLElement;
  cells: HTMLElement[];
};

type ClusterCullingHudRefs = {
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
  activeValue: HTMLElement;
  activeMeta: HTMLElement;
  maxValue: HTMLElement;
  maxMeta: HTMLElement;
  legendBody: HTMLElement;
  slicePanels: SlicePanelRefs[];
};

const TILE_COUNT_X = 8;
const TILE_COUNT_Y = 6;
const MAX_Z_SLICES = 8;
const MAX_LIGHT_COUNT = 72;
const MAX_LIGHTS_PER_CLUSTER = 36;
const MAX_CLUSTER_COUNT = TILE_COUNT_X * TILE_COUNT_Y * MAX_Z_SLICES;
const LIGHT_STRUCT_FLOATS = 8;
const SCENE_UNIFORM_BYTES = 96;
const CLUSTER_UNIFORM_BYTES = 96;
const READBACK_INTERVAL_MS = 220;
const CAMERA_FOV = Math.PI / 3.2;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 32;
const HEATMAP_CELLS_PER_SLICE = TILE_COUNT_X * TILE_COUNT_Y;

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatFixed(value: number): string {
  return value.toFixed(2);
}

function formatAverage(value: number | null): string {
  if (value === null) {
    return "等待首轮";
  }

  return `${value.toFixed(1)} 盏`;
}

function formatSpeed(value: number): string {
  return `${value.toFixed(2)}x`;
}

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

function createObjectUniformData(
  modelMatrix: Float32Array,
  color: Color4
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelMatrix, 0);
  uniformData.set(color, 16);
  return uniformData;
}

function createSceneUniformData(
  viewProjectionMatrix: Float32Array,
  eyePosition: Vector3,
  lightPosition: Vector3
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 16);
  uniformData.set([lightPosition[0], lightPosition[1], lightPosition[2], 1], 20);
  return uniformData;
}

function createLightData(
  settings: ClusterCullingSettings,
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

function createClusterUniformData(
  viewMatrix: Float32Array,
  aspect: number,
  settings: ClusterCullingSettings
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

function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

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

function describeSlice(sliceIndex: number, totalSlices: number): string {
  if (totalSlices <= 1) {
    return "Z0";
  }

  if (sliceIndex === 0) {
    return `Z${sliceIndex} · near`;
  }

  if (sliceIndex === totalSlices - 1) {
    return `Z${sliceIndex} · far`;
  }

  return `Z${sliceIndex} · mid`;
}

function describeClusterIndex(
  clusterIndex: number,
  totalSlices: number
): string {
  const tileArea = TILE_COUNT_X * TILE_COUNT_Y;
  const sliceZ = Math.floor(clusterIndex / tileArea);
  const tileIndex = clusterIndex - sliceZ * tileArea;
  const tileY = Math.floor(tileIndex / TILE_COUNT_X);
  const tileX = tileIndex - tileY * TILE_COUNT_X;

  return `${describeSlice(sliceZ, totalSlices)} · tile ${tileX},${tileY}`;
}

function createSlicePanelsMarkup(): string {
  return Array.from({ length: MAX_Z_SLICES }, (_, sliceIndex) => {
    const cells = Array.from({ length: HEATMAP_CELLS_PER_SLICE }, (_, cellIndex) => {
      return `<span class="cluster-slice-cell" data-cluster-slice-cell="${cellIndex}"></span>`;
    }).join("");

    return `
      <article class="cluster-slice-panel" data-cluster-slice="${sliceIndex}">
        <div class="cluster-slice-panel__header">
          <strong class="cluster-slice-panel__title" data-cluster-slice-title></strong>
          <span class="cluster-slice-panel__meta" data-cluster-slice-meta></span>
        </div>
        <div class="cluster-slice-grid" data-cluster-slice-grid>
          ${cells}
        </div>
      </article>
    `;
  }).join("");
}

function createHeatCellStyle(value: number, maxValue: number): {
  background: string;
  borderColor: string;
  color: string;
} {
  const ratio = maxValue > 0 ? value / maxValue : 0;
  const glow = 0.08 + ratio * 0.82;
  const background = `rgba(${Math.round(22 + ratio * 166)}, ${Math.round(
    42 + ratio * 144
  )}, ${Math.round(58 + ratio * 108)}, ${glow.toFixed(3)})`;
  const borderColor = `rgba(${Math.round(78 + ratio * 142)}, ${Math.round(
    122 + ratio * 118
  )}, 255, ${(0.16 + ratio * 0.38).toFixed(3)})`;
  const color = ratio > 0.58 ? "#04101d" : "#dceaff";

  return { background, borderColor, color };
}

function clearSlicePanels(refs: ClusterCullingHudRefs, settings: ClusterCullingSettings): void {
  refs.slicePanels.forEach((slicePanel, sliceIndex) => {
    slicePanel.root.hidden = sliceIndex >= settings.zSlices;
    slicePanel.title.textContent = describeSlice(sliceIndex, settings.zSlices);
    slicePanel.meta.textContent = "等待首轮统计";

    slicePanel.cells.forEach((cell) => {
      cell.textContent = "";
      cell.style.background = "rgba(9, 18, 32, 0.92)";
      cell.style.borderColor = "rgba(166, 193, 222, 0.08)";
      cell.style.color = "#dceaff";
      cell.removeAttribute("aria-label");
      cell.title = "";
    });
  });
}

function updateSlicePanels(
  refs: ClusterCullingHudRefs,
  settings: ClusterCullingSettings,
  metrics: ClusterCullingMetrics
): void {
  const { sliceCounts } = metrics;

  if (!sliceCounts) {
    clearSlicePanels(refs, settings);
    return;
  }

  const globalMax = metrics.maxLightsPerCluster ?? 0;

  refs.slicePanels.forEach((slicePanel, sliceIndex) => {
    const visible = sliceIndex < settings.zSlices;
    slicePanel.root.hidden = !visible;

    if (!visible) {
      return;
    }

    const start = sliceIndex * HEATMAP_CELLS_PER_SLICE;
    const sliceValues = sliceCounts.subarray(
      start,
      start + HEATMAP_CELLS_PER_SLICE
    );
    let total = 0;
    let maxValue = 0;

    sliceValues.forEach((value) => {
      total += value;
      if (value > maxValue) {
        maxValue = value;
      }
    });

    const average = total / Math.max(HEATMAP_CELLS_PER_SLICE, 1);
    slicePanel.title.textContent = describeSlice(sliceIndex, settings.zSlices);
    slicePanel.meta.textContent =
      maxValue === 0
        ? "avg 0.0 · empty"
        : `avg ${average.toFixed(1)} · max ${formatCount(maxValue)}`;

    slicePanel.cells.forEach((cell, cellIndex) => {
      const value = sliceValues[cellIndex] ?? 0;
      const style = createHeatCellStyle(value, globalMax);
      const tileY = Math.floor(cellIndex / TILE_COUNT_X);
      const tileX = cellIndex - tileY * TILE_COUNT_X;

      cell.textContent = value === 0 ? "" : `${value}`;
      cell.style.background = style.background;
      cell.style.borderColor = style.borderColor;
      cell.style.color = style.color;
      cell.title = `${describeSlice(sliceIndex, settings.zSlices)} · tile ${tileX},${tileY} · ${formatCount(
        value
      )} 盏`;
      cell.setAttribute("aria-label", cell.title);
    });
  });
}

function createLegendCopy(
  settings: ClusterCullingSettings,
  metrics: ClusterCullingMetrics
): string {
  if (metrics.averageLightsPerCluster === null) {
    return "compute pass 已经在构建 cluster light lists；右侧热力图会在首轮读回后显示每个 cluster 真正命中的灯数。这里故意还不进入最终光照，只先把“怎么筛灯”看明白。";
  }

  if (settings.lightRadius > 2.7) {
    return `把灯半径拉大以后，更多 point lights 会同时落进同一个 cluster；右侧热力图会更亮、更满，说明 light culling 仍然在工作，但每个 light list 也会跟着变长。`;
  }

  if (metrics.averageLightsPerCluster < settings.lightCount * 0.28) {
    return `虽然场景里一共有 ${formatCount(
      settings.lightCount
    )} 盏灯，但 compute 之后每个 cluster 平均只保留下来 ${formatAverage(
      metrics.averageLightsPerCluster
    )}。这就是 clustered shading 的前半段：先把大多数无关 lights 排掉，再把结果交给真正的着色阶段。`;
  }

  return "左边只是世界里的灯和障碍物预览；真正的知识点在右边热力图。每个小格子都代表一个 cluster，格子里写的是这块空间最终留下来的候选灯数量。";
}

function updateHud(
  refs: ClusterCullingHudRefs,
  settings: ClusterCullingSettings,
  metrics: ClusterCullingMetrics
): void {
  const totalClusters = TILE_COUNT_X * TILE_COUNT_Y * settings.zSlices;

  refs.lightBadge.textContent = `${formatCount(settings.lightCount)} 盏 lights · shared storage`;
  refs.lightBadge.className = "cluster-badge cluster-badge--cool";

  refs.clusterBadge.textContent = `${TILE_COUNT_X} × ${TILE_COUNT_Y} × ${settings.zSlices} = ${formatCount(totalClusters)} 个 clusters`;
  refs.clusterBadge.className = "cluster-badge";

  refs.computeBadge.textContent =
    metrics.hottestSliceIndex === null
      ? "compute build · 首轮 light list 统计中"
      : `compute build · 最热 ${describeSlice(
          metrics.hottestSliceIndex,
          settings.zSlices
        )} avg ${metrics.hottestSliceAverage?.toFixed(1) ?? "0.0"}`;
  refs.computeBadge.className = "cluster-badge cluster-badge--accent";

  refs.lightOutput.textContent = formatCount(settings.lightCount);
  refs.radiusOutput.textContent = formatFixed(settings.lightRadius);
  refs.sliceOutput.textContent = `${settings.zSlices}`;
  refs.speedOutput.textContent = formatSpeed(settings.animationSpeed);

  refs.naiveValue.textContent = `${formatCount(settings.lightCount)} 盏`;
  refs.naiveMeta.textContent =
    "如果不先 cull，每个 cluster 都得先把这整批 lights 当成候选。";

  refs.averageValue.textContent = formatAverage(metrics.averageLightsPerCluster);
  refs.averageMeta.textContent =
    metrics.averageLightsPerCluster === null
      ? "等第一轮读回以后，这里会显示 culling 后平均每个 cluster 真正剩下多少盏灯。"
      : "把所有 clusters 摊平后，平均每格真正保留下来的候选灯数量。";

  refs.activeValue.textContent =
    metrics.activeClusterCount === null
      ? "等待首轮"
      : `${formatCount(metrics.activeClusterCount)} / ${formatCount(totalClusters)}`;
  refs.activeMeta.textContent = "右侧热力图里真正亮起来的 cluster 数量。";

  refs.maxValue.textContent =
    metrics.maxLightsPerCluster === null
      ? "等待首轮"
      : `${formatCount(metrics.maxLightsPerCluster)} 盏`;
  refs.maxMeta.textContent =
    metrics.maxLightsPerCluster === null
      ? "这里会显示这一帧里最拥挤的 cluster，以及它的 light list 样本。"
      : metrics.sampleLights.length === 0
        ? `${metrics.hottestClusterLabel} · 当前没有命中任何灯。`
        : `${metrics.hottestClusterLabel} · ids ${metrics.sampleLights
            .map((lightIndex) => `#${lightIndex}`)
            .join(" ")}`;

  refs.legendBody.textContent = createLegendCopy(settings, metrics);
  updateSlicePanels(refs, settings, metrics);
}

export async function mountClusterBuildAndLightCullingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<(() => void) | void> {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--cluster-culling">
      <div class="cluster-stage cluster-culling-stage">
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
            <span class="cluster-panel-label__eyebrow">World Preview</span>
            <strong class="cluster-panel-label__title">只看场景、障碍物和运动 lights</strong>
          </div>
          <div class="cluster-panel-label cluster-panel-label--clustered">
            <span class="cluster-panel-label__eyebrow">Light Lists</span>
            <strong class="cluster-panel-label__title">按深度切片展开每一层 cluster 热力图</strong>
          </div>
        </div>

        <div class="cluster-culling-layout">
          <div class="cluster-culling-visual">
            <div class="preview-frame cluster-stage__frame cluster-culling-stage__frame">
              <canvas class="preview-canvas" aria-label="Cluster build and light culling lesson preview"></canvas>
            </div>
          </div>

          <section class="cluster-slice-stack">
            <div class="cluster-slice-stack__panels">
              ${createSlicePanelsMarkup()}
            </div>
          </section>
        </div>

        <div class="cluster-card-grid">
          <article class="cluster-card">
            <p class="cluster-card__label">不筛灯时每块都看</p>
            <strong class="cluster-card__value" data-cluster-card-value="naive"></strong>
            <p class="cluster-card__meta" data-cluster-card-meta="naive"></p>
          </article>

          <article class="cluster-card cluster-card--cool">
            <p class="cluster-card__label">culling 后平均每块</p>
            <strong class="cluster-card__value" data-cluster-card-value="average"></strong>
            <p class="cluster-card__meta" data-cluster-card-meta="average"></p>
          </article>

          <article class="cluster-card">
            <p class="cluster-card__label">活跃 clusters</p>
            <strong class="cluster-card__value" data-cluster-card-value="active"></strong>
            <p class="cluster-card__meta" data-cluster-card-meta="active"></p>
          </article>

          <article class="cluster-card cluster-card--accent">
            <p class="cluster-card__label">最拥挤 cluster</p>
            <strong class="cluster-card__value" data-cluster-card-value="max"></strong>
            <p class="cluster-card__meta" data-cluster-card-meta="max"></p>
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
  const lightRange = host.querySelector<HTMLInputElement>('[data-cluster-control="lights"]');
  const radiusRange = host.querySelector<HTMLInputElement>('[data-cluster-control="radius"]');
  const sliceRange = host.querySelector<HTMLInputElement>('[data-cluster-control="slices"]');
  const speedRange = host.querySelector<HTMLInputElement>('[data-cluster-control="speed"]');

  if (
    !canvas ||
    !lightRange ||
    !radiusRange ||
    !sliceRange ||
    !speedRange
  ) {
    throw new Error("第 49 课的预览结构没有完整创建出来。");
  }

  const slicePanels: SlicePanelRefs[] = Array.from(
    { length: MAX_Z_SLICES },
    (_, sliceIndex) => {
      const root = host.querySelector<HTMLElement>(
        `[data-cluster-slice="${sliceIndex}"]`
      );

      if (!root) {
        throw new Error(`第 49 课缺少第 ${sliceIndex} 个切片面板。`);
      }

      const title = root.querySelector<HTMLElement>("[data-cluster-slice-title]");
      const meta = root.querySelector<HTMLElement>("[data-cluster-slice-meta]");
      const cells = Array.from(
        root.querySelectorAll<HTMLElement>("[data-cluster-slice-cell]")
      );

      if (!title || !meta || cells.length !== HEATMAP_CELLS_PER_SLICE) {
        throw new Error(`第 49 课第 ${sliceIndex} 个切片面板结构不完整。`);
      }

      return { root, title, meta, cells };
    }
  );

  const refs: ClusterCullingHudRefs = {
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
    activeValue: host.querySelector<HTMLElement>('[data-cluster-card-value="active"]')!,
    activeMeta: host.querySelector<HTMLElement>('[data-cluster-card-meta="active"]')!,
    maxValue: host.querySelector<HTMLElement>('[data-cluster-card-value="max"]')!,
    maxMeta: host.querySelector<HTMLElement>('[data-cluster-card-meta="max"]')!,
    legendBody: host.querySelector<HTMLElement>("[data-cluster-legend]")!,
    slicePanels,
  };

  const settings: ClusterCullingSettings = {
    lightCount: Number.parseInt(lightRange.value, 10),
    lightRadius: Number.parseFloat(radiusRange.value),
    zSlices: Number.parseInt(sliceRange.value, 10),
    animationSpeed: Number.parseFloat(speedRange.value),
  };

  const metrics: ClusterCullingMetrics = {
    averageLightsPerCluster: null,
    maxLightsPerCluster: null,
    activeClusterCount: null,
    hottestClusterLabel: "等待首轮",
    sampleLights: [],
    sliceCounts: null,
    pendingReadback: true,
    hottestSliceIndex: null,
    hottestSliceAverage: null,
  };

  updateHud(refs, settings, metrics);

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const geometry = createClusterCullingLessonGeometry();
    const sceneConfigs = createSceneConfigs();

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
          visibility: GPUShaderStage.VERTEX,
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

    const sceneUniformBuffer = gpu.device.createBuffer({
      size: SCENE_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const lightBuffer = gpu.device.createBuffer({
      size: MAX_LIGHT_COUNT * LIGHT_STRUCT_FLOATS * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    const sceneBindGroup = gpu.device.createBindGroup({
      layout: sceneBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: sceneUniformBuffer } },
        { binding: 1, resource: { buffer: lightBuffer } },
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

      return { uniformBuffer, bindGroup };
    });

    const clusterUniformBuffer = gpu.device.createBuffer({
      size: CLUSTER_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const clusterCountsBuffer = gpu.device.createBuffer({
      size: MAX_CLUSTER_COUNT * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    const clusterLightIndicesBuffer = gpu.device.createBuffer({
      size: MAX_CLUSTER_COUNT * MAX_LIGHTS_PER_CLUSTER * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
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

    const countsReadbackBuffer = gpu.device.createBuffer({
      size: MAX_CLUSTER_COUNT * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const indicesReadbackBuffer = gpu.device.createBuffer({
      size: MAX_CLUSTER_COUNT * MAX_LIGHTS_PER_CLUSTER * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const vertexShaderModule = gpu.device.createShaderModule({ code: vertexShaderSource });
    const fragmentShaderModule = gpu.device.createShaderModule({ code: fragmentShaderSource });

    const objectPipeline = gpu.device.createRenderPipeline({
      label: "lesson-49-scene-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [sceneBindGroupLayout, objectBindGroupLayout],
      }),
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
        entryPoint: "fsObject",
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

    const markerPipeline = gpu.device.createRenderPipeline({
      label: "lesson-49-light-marker-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [sceneBindGroupLayout],
      }),
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

    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-49-cluster-light-culling-pipeline",
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

    const resetMetrics = () => {
      metrics.averageLightsPerCluster = null;
      metrics.maxLightsPerCluster = null;
      metrics.activeClusterCount = null;
      metrics.hottestClusterLabel = "等待首轮";
      metrics.sampleLights = [];
      metrics.sliceCounts = null;
      metrics.pendingReadback = true;
      metrics.hottestSliceIndex = null;
      metrics.hottestSliceAverage = null;
      updateHud(refs, settings, metrics);
    };

    const requestReadback = async () => {
      if (disposed || readbackPending) {
        return;
      }

      const totalClusters = TILE_COUNT_X * TILE_COUNT_Y * settings.zSlices;
      const totalIndices = totalClusters * MAX_LIGHTS_PER_CLUSTER;
      readbackPending = true;
      metrics.pendingReadback = true;
      updateHud(refs, settings, metrics);

      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-49-cluster-readback-encoder",
      });
      encoder.copyBufferToBuffer(
        clusterCountsBuffer,
        0,
        countsReadbackBuffer,
        0,
        totalClusters * 4
      );
      encoder.copyBufferToBuffer(
        clusterLightIndicesBuffer,
        0,
        indicesReadbackBuffer,
        0,
        totalIndices * 4
      );
      gpu.device.queue.submit([encoder.finish()]);

      try {
        await Promise.all([
          countsReadbackBuffer.mapAsync(GPUMapMode.READ),
          indicesReadbackBuffer.mapAsync(GPUMapMode.READ),
        ]);

        const counts = new Uint32Array(countsReadbackBuffer.getMappedRange()).slice(
          0,
          totalClusters
        );
        const indices = new Uint32Array(indicesReadbackBuffer.getMappedRange()).slice(
          0,
          totalIndices
        );

        let total = 0;
        let maxCount = 0;
        let activeCount = 0;
        let hottestClusterIndex = 0;
        let hottestSliceIndex = 0;
        let hottestSliceAverage = -1;

        for (let index = 0; index < counts.length; index += 1) {
          const value = counts[index];
          total += value;

          if (value > maxCount) {
            maxCount = value;
            hottestClusterIndex = index;
          }

          if (value > 0) {
            activeCount += 1;
          }
        }

        for (let sliceIndex = 0; sliceIndex < settings.zSlices; sliceIndex += 1) {
          const start = sliceIndex * HEATMAP_CELLS_PER_SLICE;
          const end = start + HEATMAP_CELLS_PER_SLICE;
          let sliceTotal = 0;

          for (let index = start; index < end; index += 1) {
            sliceTotal += counts[index] ?? 0;
          }

          const average = sliceTotal / Math.max(HEATMAP_CELLS_PER_SLICE, 1);
          if (average > hottestSliceAverage) {
            hottestSliceAverage = average;
            hottestSliceIndex = sliceIndex;
          }
        }

        const sampleCount = Math.min(
          counts[hottestClusterIndex] ?? 0,
          MAX_LIGHTS_PER_CLUSTER
        );
        const sampleOffset = hottestClusterIndex * MAX_LIGHTS_PER_CLUSTER;

        metrics.averageLightsPerCluster = total / Math.max(totalClusters, 1);
        metrics.maxLightsPerCluster = maxCount;
        metrics.activeClusterCount = activeCount;
        metrics.hottestClusterLabel = describeClusterIndex(
          hottestClusterIndex,
          settings.zSlices
        );
        metrics.sampleLights = Array.from(
          indices.subarray(sampleOffset, sampleOffset + Math.min(sampleCount, 6))
        );
        metrics.sliceCounts = counts;
        metrics.hottestSliceIndex = hottestSliceIndex;
        metrics.hottestSliceAverage = hottestSliceAverage < 0 ? 0 : hottestSliceAverage;
      } catch {
        metrics.averageLightsPerCluster = null;
        metrics.maxLightsPerCluster = null;
        metrics.activeClusterCount = null;
        metrics.hottestClusterLabel = "读回失败";
        metrics.sampleLights = [];
        metrics.sliceCounts = null;
        metrics.hottestSliceIndex = null;
        metrics.hottestSliceAverage = null;
      } finally {
        if (countsReadbackBuffer.mapState === "mapped") {
          countsReadbackBuffer.unmap();
        }
        if (indicesReadbackBuffer.mapState === "mapped") {
          indicesReadbackBuffer.unmap();
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

      gpu.resize();

      if (canvas.width === 0 || canvas.height === 0) {
        return;
      }

      const depthView = ensureDepthTarget(depthTarget, gpu.device, canvas);
      const camera = orbitCamera.getSnapshot();
      const aspect = canvas.width / Math.max(canvas.height, 1);
      const timeSeconds = timestamp * 0.001;
      const keyLight: Vector3 = [6.8, 9.2, 7.4];
      const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        CAMERA_FOV,
        aspect,
        CAMERA_NEAR,
        CAMERA_FAR
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const totalClusters = TILE_COUNT_X * TILE_COUNT_Y * settings.zSlices;

      gpu.device.queue.writeBuffer(
        lightBuffer,
        0,
        createLightData(settings, timeSeconds)
      );
      gpu.device.queue.writeBuffer(
        sceneUniformBuffer,
        0,
        createSceneUniformData(viewProjectionMatrix, camera.eye, keyLight)
      );
      gpu.device.queue.writeBuffer(
        clusterUniformBuffer,
        0,
        createClusterUniformData(viewMatrix, aspect, settings)
      );

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-49-command-encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "lesson-49-cluster-build-pass",
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
      renderPass.setPipeline(objectPipeline);
      renderPass.setBindGroup(0, sceneBindGroup);

      renderObjects.forEach((object) => {
        renderPass.setBindGroup(1, object.bindGroup);
        renderPass.drawIndexed(geometry.indexCount);
      });

      renderPass.setPipeline(markerPipeline);
      renderPass.setBindGroup(0, sceneBindGroup);
      renderPass.drawIndexed(geometry.indexCount, settings.lightCount);
      renderPass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);

      if (timestamp - lastReadbackTimeMs >= READBACK_INTERVAL_MS) {
        lastReadbackTimeMs = timestamp;
        void requestReadback();
      }
    };

    const frame = (timestamp: number) => {
      render(timestamp);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const onLightInput = () => {
      settings.lightCount = Number.parseInt(lightRange.value, 10);
      lastReadbackTimeMs = -Infinity;
      resetMetrics();
      render(performance.now());
    };
    const onRadiusInput = () => {
      settings.lightRadius = Number.parseFloat(radiusRange.value);
      lastReadbackTimeMs = -Infinity;
      resetMetrics();
      render(performance.now());
    };
    const onSliceInput = () => {
      settings.zSlices = Number.parseInt(sliceRange.value, 10);
      lastReadbackTimeMs = -Infinity;
      resetMetrics();
      render(performance.now());
    };
    const onSpeedInput = () => {
      settings.animationSpeed = Number.parseFloat(speedRange.value);
      lastReadbackTimeMs = -Infinity;
      resetMetrics();
      render(performance.now());
    };

    lightRange.addEventListener("input", onLightInput);
    radiusRange.addEventListener("input", onRadiusInput);
    sliceRange.addEventListener("input", onSliceInput);
    speedRange.addEventListener("input", onSpeedInput);

    const resizeObserver = new ResizeObserver(() => {
      gpu.resize();
      destroyDepthTarget(depthTarget);
      render(performance.now());
    });
    resizeObserver.observe(host);

    render(performance.now());
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "Cluster 构建与 Light Culling 已运行",
      detail:
        "这一课先不进入最终 clustered shading，而是先把 cluster 划分、compute culling 和每格 light list 的热力分布单独拆出来看清楚。",
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
      sceneUniformBuffer.destroy();
      lightBuffer.destroy();
      clusterUniformBuffer.destroy();
      clusterCountsBuffer.destroy();
      clusterLightIndicesBuffer.destroy();
      countsReadbackBuffer.destroy();
      indicesReadbackBuffer.destroy();
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
