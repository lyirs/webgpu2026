import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createVolumeDensityTextureData } from "@/lessons/lesson-49-volume-rendering-and-texture3d/density";
import { createVolumeLessonGeometry } from "@/lessons/lesson-49-volume-rendering-and-texture3d/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-49-volume-rendering-and-texture3d/math";
import sceneFragmentShaderSource from "@/lessons/lesson-49-volume-rendering-and-texture3d/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-49-volume-rendering-and-texture3d/scene.vert.wgsl?raw";
import volumeFragmentShaderSource from "@/lessons/lesson-49-volume-rendering-and-texture3d/volume.frag.wgsl?raw";

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
  surfaceMode: 0 | 1;
  detailScale: number;
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

type VolumeViewportKey = "slice" | "volume";

type VolumeLayoutMode = "split" | "stacked";

type VolumePanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type VolumeViewport = {
  key: VolumeViewportKey;
  sceneUniformBuffer: GPUBuffer;
  sceneBindGroup: GPUBindGroup;
};

type VolumeHudRefs = {
  textureBadge: HTMLElement;
  sliceBadge: HTMLElement;
  stepsBadge: HTMLElement;
  densityBadge: HTMLElement;
  textureValue: HTMLElement;
  textureMeta: HTMLElement;
  sliceValue: HTMLElement;
  sliceMeta: HTMLElement;
  stepValue: HTMLElement;
  stepMeta: HTMLElement;
  spacingValue: HTMLElement;
  spacingMeta: HTMLElement;
  sliceOutput: HTMLElement;
  stepsOutput: HTMLElement;
  densityOutput: HTMLElement;
  legendBody: HTMLElement;
};

type VolumeMetricState = {
  textureSize: number;
  voxelCount: number;
  memoryBytes: number;
  activeRatio: number;
  sliceDepth: number;
  raySteps: number;
  densityGain: number;
  stepSpacing: number;
  layout: VolumeLayoutMode;
};

const TEXTURE_SIZE = 64;
const PANEL_GAP_PX = 24;
const HUD_UPDATE_INTERVAL_MS = 180;
const SLICE_CAMERA_EYE: Vector3 = [0, 0.18, 4.3];
const SLICE_CAMERA_TARGET: Vector3 = [0, 0, 0];
const RIGHT_CAMERA_TARGET: Vector3 = [0, 0, 0];

/**
 * 把对象数量格式化成更适合 HUD 的中文数字字符串。
 * @param {number} value 当前数字。
 * @returns {string} 对应的格式化结果。
 */
function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 把体纹理边长格式化成 `64³` 这种更短的展示文本。
 * @param {number} value 当前体纹理边长。
 * @returns {string} 对应的展示文本。
 */
function formatVolumeSize(value: number): string {
  return `${value}³`;
}

/**
 * 把字节数格式化成更适合 HUD 的容量文本。
 * @param {number} bytes 当前字节数。
 * @returns {string} 对应的容量字符串。
 */
function formatMemory(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  return `${bytes} B`;
}

/**
 * 把 0-1 之间的比例格式化成百分比。
 * @param {number} value 当前比例。
 * @returns {string} 对应的百分比文本。
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`;
}

/**
 * 把切片深度格式化成带正负号的 `z = +0.12` 文本。
 * @param {number} value 当前切片深度。
 * @returns {string} 对应的展示文本。
 */
function formatSliceDepth(value: number): string {
  return `z = ${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

/**
 * 把 ray marching 的单步距离格式化成简短文本。
 * @param {number} value 当前步进距离。
 * @returns {string} 对应的展示文本。
 */
function formatStepSpacing(value: number): string {
  return `${value.toFixed(3)} u`;
}

/**
 * 生成一份场景 uniform 数据，里面包含 VP、眼睛位置、光源和体渲染参数。
 * @param {Float32Array} viewProjectionMatrix 当前面板的 VP 矩阵。
 * @param {Vector3} eyePosition 当前面板的相机位置。
 * @param {Vector3} lightPosition 当前点光源位置。
 * @param {VolumeMetricState} metrics 当前体渲染控制参数。
 * @param {number} timeSeconds 当前时间，单位秒。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续数据。
 */
function createSceneUniformData(
  viewProjectionMatrix: Float32Array,
  eyePosition: Vector3,
  lightPosition: Vector3,
  metrics: VolumeMetricState,
  timeSeconds: number
): Float32Array {
  const uniformData = new Float32Array(32);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 16);
  uniformData.set([lightPosition[0], lightPosition[1], lightPosition[2], 1], 20);
  uniformData.set(
    [metrics.sliceDepth, metrics.densityGain, metrics.raySteps, metrics.stepSpacing],
    24
  );
  uniformData.set([timeSeconds, 0, 0, 0], 28);
  return uniformData;
}

/**
 * 生成一份对象级 uniform 数据，里面包含模型矩阵、基础颜色和表面参数。
 * @param {Float32Array} modelMatrix 当前对象模型矩阵。
 * @param {Color4} color 当前对象颜色。
 * @param {0 | 1} surfaceMode 0 表示纯色表面，1 表示带网格细节。
 * @param {number} detailScale 当前表面网格密度。
 * @returns {Float32Array} 可直接写进对象 uniform buffer 的连续数据。
 */
function createObjectUniformData(
  modelMatrix: Float32Array,
  color: Color4,
  surfaceMode: 0 | 1,
  detailScale: number
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(modelMatrix, 0);
  uniformData.set(color, 16);
  uniformData.set([surfaceMode, detailScale, 0, 0], 20);
  return uniformData;
}

/**
 * 根据对象配置组合一份只包含平移和缩放的模型矩阵。
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
 * 生成第 43 课要复用的一组静态场景对象。
 * @returns {SceneObjectConfig[]} 一个带底座和体边框的对象数组。
 */
function createVolumeSceneConfigs(): SceneObjectConfig[] {
  const objects: SceneObjectConfig[] = [
    {
      label: "floor",
      translation: [0, -1.32, 0],
      scale: [5.2, 0.1, 5.2],
      color: [0.13, 0.16, 0.22, 1],
      surfaceMode: 1,
      detailScale: 4.2,
    },
    {
      label: "plinth",
      translation: [0, -1.04, 0],
      scale: [1.86, 0.22, 1.86],
      color: [0.18, 0.22, 0.29, 1],
      surfaceMode: 1,
      detailScale: 7.2,
    },
  ];

  const frameColor: Color4 = [0.34, 0.76, 1.0, 1];
  const accentColor: Color4 = [1.0, 0.71, 0.32, 1];
  const frameExtent = 1.04;
  const frameThickness = 0.055;
  const frameHalfLength = 1.08;

  for (const x of [-frameExtent, frameExtent] as const) {
    for (const y of [-frameExtent, frameExtent] as const) {
      objects.push({
        label: `edge-z-${x}-${y}`,
        translation: [x, y, 0],
        scale: [frameThickness, frameThickness, frameHalfLength],
        color: frameColor,
        surfaceMode: 0,
        detailScale: 0,
      });
    }
  }

  for (const x of [-frameExtent, frameExtent] as const) {
    for (const z of [-frameExtent, frameExtent] as const) {
      objects.push({
        label: `edge-y-${x}-${z}`,
        translation: [x, 0, z],
        scale: [frameThickness, frameHalfLength, frameThickness],
        color: accentColor,
        surfaceMode: 0,
        detailScale: 0,
      });
    }
  }

  for (const y of [-frameExtent, frameExtent] as const) {
    for (const z of [-frameExtent, frameExtent] as const) {
      objects.push({
        label: `edge-x-${y}-${z}`,
        translation: [0, y, z],
        scale: [frameHalfLength, frameThickness, frameThickness],
        color: frameColor,
        surfaceMode: 0,
        detailScale: 0,
      });
    }
  }

  return objects;
}

/**
 * 根据当前切片深度、步数和增益，生成更贴近这节课重点的说明文案。
 * @param {VolumeMetricState} metrics 当前 HUD 指标状态。
 * @returns {string} 对应的总结说明。
 */
function createLegendCopy(metrics: VolumeMetricState): string {
  if (metrics.raySteps <= 56) {
    return `左侧切片仍然清楚，因为它只读一层 ` +
      `texture3D` +
      `；右侧体渲染会开始变“分层”，因为每条射线只走了 ${metrics.raySteps} 步。ray marching 本质上是在拿更多采样，把同一份体数据重新积分成体积感。`;
  }

  if (metrics.densityGain >= 1.9) {
    return `当前密度增益已经拉到 ${metrics.densityGain.toFixed(2)}x，右侧会更快积累出不透明度。这里可以直接看到 ` +
      `density -> color / alpha` +
      ` 这条链路：体数据本身只存密度，最终颜色和遮挡感都是 shader 再推出来的。`;
  }

  if (Math.abs(metrics.sliceDepth) >= 0.58) {
    return `切片已经移到体盒边缘附近，所以左侧看到的高密度区域会明显变少；右侧也会只剩一圈较薄的体积外壳。` +
      `texture3D` +
      ` 真正存的是整个三维分布，切哪一层就读哪一层。`;
  }

  return `左侧固定显示一张 z 切片，右侧则沿视线重复读取同一份 ` +
    `texture3D` +
    ` 并累积颜色与透明度。切片告诉你“体数据某一层长什么样”，体渲染则把许多层重新组合成空间厚度。`;
}

/**
 * 根据当前状态更新 HUD 文案、控制旁边的读数和说明段落。
 * @param {VolumeHudRefs} refs HUD 里要更新的 DOM 引用。
 * @param {VolumeMetricState} metrics 当前体数据和采样参数状态。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(refs: VolumeHudRefs, metrics: VolumeMetricState): void {
  refs.textureBadge.textContent = `体纹理 · ${formatVolumeSize(metrics.textureSize)} · r8unorm`;
  refs.textureBadge.className = "volume-badge volume-badge--ok";

  refs.sliceBadge.textContent = `切片深度 · ${formatSliceDepth(metrics.sliceDepth)}`;
  refs.sliceBadge.className =
    Math.abs(metrics.sliceDepth) >= 0.58
      ? "volume-badge volume-badge--accent"
      : "volume-badge volume-badge--cool";

  refs.stepsBadge.textContent = `ray marching · ${metrics.raySteps} 步`;
  refs.stepsBadge.className =
    metrics.raySteps <= 56
      ? "volume-badge volume-badge--warn"
      : "volume-badge volume-badge--cool";

  refs.densityBadge.textContent = `密度增益 · ${metrics.densityGain.toFixed(2)}x`;
  refs.densityBadge.className =
    metrics.densityGain >= 1.9
      ? "volume-badge volume-badge--accent"
      : "volume-badge";

  refs.textureValue.textContent = formatVolumeSize(metrics.textureSize);
  refs.textureMeta.textContent =
    `共 ${formatCount(metrics.voxelCount)} 个体素，约占 ${formatMemory(metrics.memoryBytes)}；其中 ${formatPercent(metrics.activeRatio)} 的体素真正带有密度。`;

  refs.sliceValue.textContent = formatSliceDepth(metrics.sliceDepth);
  refs.sliceMeta.textContent =
    Math.abs(metrics.sliceDepth) >= 0.58
      ? "切片已经逼近体盒边缘，当前更像是在看这团密度场的外壳。"
      : "左侧面板只采这一层，因此能把单层 3D texture 读取得很清楚。";

  refs.stepValue.textContent = `${metrics.raySteps}`;
  refs.stepMeta.textContent =
    metrics.raySteps <= 56
      ? "步数偏少时，右侧最容易先出现层状感和细节断裂。"
      : "右侧每条光线最多会在体盒里做这么多次采样和透明度累积。";

  refs.spacingValue.textContent = formatStepSpacing(metrics.stepSpacing);
  refs.spacingMeta.textContent =
    `体盒深度固定在 2 个局部单位，所以当前单步距离约为 ${formatStepSpacing(metrics.stepSpacing)}；步长越小，体积轮廓通常越平滑。`;

  refs.sliceOutput.textContent = formatSliceDepth(metrics.sliceDepth);
  refs.stepsOutput.textContent = `${metrics.raySteps} steps`;
  refs.densityOutput.textContent = `${metrics.densityGain.toFixed(2)}x`;
  refs.legendBody.textContent = createLegendCopy(metrics);
}

/**
 * 安全释放深度纹理。
 * @param {DepthTarget} target 当前 lesson 使用的深度目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 根据当前画布像素尺寸，确保深度目标始终匹配。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {DepthTarget} target 当前 lesson 使用的深度目标。
 * @param {number} width 当前画布像素宽度。
 * @param {number} height 当前画布像素高度。
 * @returns {void} 只更新深度目标，不返回额外结果。
 */
function ensureDepthTarget(
  device: GPUDevice,
  target: DepthTarget,
  width: number,
  height: number
): void {
  if (
    target.texture &&
    target.view &&
    target.width === width &&
    target.height === height
  ) {
    return;
  }

  destroyDepthTarget(target);
  target.texture = device.createTexture({
    size: [width, height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  target.view = target.texture.createView();
  target.width = width;
  target.height = height;
}

/**
 * 根据当前画布尺寸，决定 lesson 使用左右对照还是上下堆叠布局。
 * @param {number} width 当前画布 CSS 宽度。
 * @returns {VolumeLayoutMode} 对应的布局模式。
 */
function chooseLayoutMode(width: number): VolumeLayoutMode {
  return width < 720 ? "stacked" : "split";
}

/**
 * 按当前布局模式，把画布拆成两块对照视口。
 * @param {number} width 当前画布像素宽度。
 * @param {number} height 当前画布像素高度。
 * @param {VolumeLayoutMode} layout 当前布局模式。
 * @returns {{ slice: VolumePanelRect; volume: VolumePanelRect }} 两个面板的视口矩形。
 */
function createPanelRects(
  width: number,
  height: number,
  layout: VolumeLayoutMode
): { slice: VolumePanelRect; volume: VolumePanelRect } {
  if (layout === "stacked") {
    const topHeight = Math.max(1, Math.floor((height - PANEL_GAP_PX) * 0.5));
    const bottomY = topHeight + PANEL_GAP_PX;
    return {
      slice: {
        x: 0,
        y: 0,
        width,
        height: topHeight,
      },
      volume: {
        x: 0,
        y: bottomY,
        width,
        height: Math.max(1, height - bottomY),
      },
    };
  }

  const leftWidth = Math.max(1, Math.floor((width - PANEL_GAP_PX) * 0.5));
  const rightX = leftWidth + PANEL_GAP_PX;

  return {
    slice: {
      x: 0,
      y: 0,
      width: leftWidth,
      height,
    },
    volume: {
      x: rightX,
      y: 0,
      width: Math.max(1, width - rightX),
      height,
    },
  };
}

/**
 * 挂载第 43 课“体渲染与 3D Texture”，
 * 用一份共享的 `texture3D` 同时做切片采样和 ray marching 对照。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听和 GPU 资源。
 */
export async function mountVolumeRenderingAndTexture3dLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--volume">
      <div class="preview-frame">
        <div class="volume-stage">
          <div class="volume-stage__badges">
            <span class="volume-badge" data-volume-badge="texture"></span>
            <span class="volume-badge" data-volume-badge="slice"></span>
            <span class="volume-badge" data-volume-badge="steps"></span>
            <span class="volume-badge" data-volume-badge="density"></span>
          </div>

          <div class="volume-controls">
            <label class="volume-control">
              <span class="volume-control__row">
                <span class="volume-control__label">切片深度</span>
                <span class="volume-control__value" data-volume-control-output="slice"></span>
              </span>
              <input class="volume-control__range" data-volume-control="slice" type="range" min="-0.82" max="0.82" step="0.01" value="0.08" />
            </label>

            <label class="volume-control">
              <span class="volume-control__row">
                <span class="volume-control__label">Ray Steps</span>
                <span class="volume-control__value" data-volume-control-output="steps"></span>
              </span>
              <input class="volume-control__range" data-volume-control="steps" type="range" min="40" max="160" step="4" value="96" />
            </label>

            <label class="volume-control">
              <span class="volume-control__row">
                <span class="volume-control__label">密度增益</span>
                <span class="volume-control__value" data-volume-control-output="density"></span>
              </span>
              <input class="volume-control__range" data-volume-control="density" type="range" min="0.7" max="2.4" step="0.05" value="1.35" />
            </label>
          </div>

          <div class="volume-canvas-shell" data-volume-canvas-shell>
            <canvas class="volume-canvas" data-volume-canvas></canvas>
            <div class="volume-overlay">
              <div class="volume-divider"></div>

              <div class="volume-panel-label volume-panel-label--slice">
                <span class="volume-panel-label__eyebrow">Single Slice</span>
                <strong class="volume-panel-label__title">左侧只采当前 z 切片</strong>
              </div>

              <div class="volume-panel-label volume-panel-label--volume">
                <span class="volume-panel-label__eyebrow">Volume Ray Marching</span>
                <strong class="volume-panel-label__title">右侧沿视线反复读取同一份 3D 体数据</strong>
              </div>
            </div>
          </div>

          <div class="volume-card-grid">
            <article class="volume-card volume-card--cool">
              <p class="volume-card__label">体数据尺寸</p>
              <strong class="volume-card__value" data-volume-card-value="texture"></strong>
              <p class="volume-card__meta" data-volume-card-meta="texture"></p>
            </article>

            <article class="volume-card volume-card--accent">
              <p class="volume-card__label">切片层</p>
              <strong class="volume-card__value" data-volume-card-value="slice"></strong>
              <p class="volume-card__meta" data-volume-card-meta="slice"></p>
            </article>

            <article class="volume-card volume-card--ok">
              <p class="volume-card__label">光线步数</p>
              <strong class="volume-card__value" data-volume-card-value="steps"></strong>
              <p class="volume-card__meta" data-volume-card-meta="steps"></p>
            </article>

            <article class="volume-card">
              <p class="volume-card__label">单步距离</p>
              <strong class="volume-card__value" data-volume-card-value="spacing"></strong>
              <p class="volume-card__meta" data-volume-card-meta="spacing"></p>
            </article>
          </div>

          <div class="volume-stage__legend">
            <p class="volume-stage__legend-title">当前实验</p>
            <p class="volume-stage__legend-body" data-volume-legend></p>
          </div>
        </div>
      </div>
    </div>
  `;

  const textureBadge = host.querySelector<HTMLElement>('[data-volume-badge="texture"]');
  const sliceBadge = host.querySelector<HTMLElement>('[data-volume-badge="slice"]');
  const stepsBadge = host.querySelector<HTMLElement>('[data-volume-badge="steps"]');
  const densityBadge = host.querySelector<HTMLElement>('[data-volume-badge="density"]');
  const textureValue = host.querySelector<HTMLElement>('[data-volume-card-value="texture"]');
  const textureMeta = host.querySelector<HTMLElement>('[data-volume-card-meta="texture"]');
  const sliceValue = host.querySelector<HTMLElement>('[data-volume-card-value="slice"]');
  const sliceMeta = host.querySelector<HTMLElement>('[data-volume-card-meta="slice"]');
  const stepValue = host.querySelector<HTMLElement>('[data-volume-card-value="steps"]');
  const stepMeta = host.querySelector<HTMLElement>('[data-volume-card-meta="steps"]');
  const spacingValue = host.querySelector<HTMLElement>('[data-volume-card-value="spacing"]');
  const spacingMeta = host.querySelector<HTMLElement>('[data-volume-card-meta="spacing"]');
  const legendBody = host.querySelector<HTMLElement>("[data-volume-legend]");
  const sliceOutput = host.querySelector<HTMLElement>('[data-volume-control-output="slice"]');
  const stepsOutput = host.querySelector<HTMLElement>('[data-volume-control-output="steps"]');
  const densityOutput = host.querySelector<HTMLElement>('[data-volume-control-output="density"]');
  const sliceRange = host.querySelector<HTMLInputElement>('[data-volume-control="slice"]');
  const stepsRange = host.querySelector<HTMLInputElement>('[data-volume-control="steps"]');
  const densityRange = host.querySelector<HTMLInputElement>('[data-volume-control="density"]');
  const canvas = host.querySelector<HTMLCanvasElement>("[data-volume-canvas]");
  const canvasShell = host.querySelector<HTMLElement>("[data-volume-canvas-shell]");

  if (
    !textureBadge ||
    !sliceBadge ||
    !stepsBadge ||
    !densityBadge ||
    !textureValue ||
    !textureMeta ||
    !sliceValue ||
    !sliceMeta ||
    !stepValue ||
    !stepMeta ||
    !spacingValue ||
    !spacingMeta ||
    !legendBody ||
    !sliceOutput ||
    !stepsOutput ||
    !densityOutput ||
    !sliceRange ||
    !stepsRange ||
    !densityRange ||
    !canvas ||
    !canvasShell
  ) {
    setStatus({
      title: "预览不可用",
      detail: "第 43 课的 DOM 结构没有完整挂载出来。",
      tone: "warn",
    });
    return;
  }

  const refs: VolumeHudRefs = {
    textureBadge,
    sliceBadge,
    stepsBadge,
    densityBadge,
    textureValue,
    textureMeta,
    sliceValue,
    sliceMeta,
    stepValue,
    stepMeta,
    spacingValue,
    spacingMeta,
    sliceOutput,
    stepsOutput,
    densityOutput,
    legendBody,
  };

  const metrics: VolumeMetricState = {
    textureSize: TEXTURE_SIZE,
    voxelCount: 0,
    memoryBytes: 0,
    activeRatio: 0,
    sliceDepth: Number.parseFloat(sliceRange.value),
    raySteps: Number.parseFloat(stepsRange.value),
    densityGain: Number.parseFloat(densityRange.value),
    stepSpacing: 2 / Number.parseFloat(stepsRange.value),
    layout: chooseLayoutMode(canvas.clientWidth),
  };

  updateHud(refs, metrics);

  let resizeObserver: ResizeObserver | null = null;
  let animationFrameId = 0;
  let disposed = false;
  let lastHudUpdateTimeMs = 0;
  let lastKnownCanvasWidth = 0;
  let lastKnownCanvasHeight = 0;

  const depthTarget: DepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };

  try {
    const volumeData = createVolumeDensityTextureData(TEXTURE_SIZE);
    metrics.textureSize = volumeData.size;
    metrics.voxelCount = volumeData.voxelCount;
    metrics.memoryBytes = volumeData.memoryBytes;
    metrics.activeRatio = volumeData.activeRatio;
    updateHud(refs, metrics);

    const canvasRuntime = await createWebGpuCanvas(canvas);
    const { device, context, format } = canvasRuntime;

    const geometry = createVolumeLessonGeometry();

    const cubeVertexBuffer = device.createBuffer({
      size: geometry.cube.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(cubeVertexBuffer, 0, geometry.cube.vertexData);

    const cubeIndexBuffer = device.createBuffer({
      size: geometry.cube.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(cubeIndexBuffer, 0, geometry.cube.indexData);

    const planeVertexBuffer = device.createBuffer({
      size: geometry.plane.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(planeVertexBuffer, 0, geometry.plane.vertexData);

    const planeIndexBuffer = device.createBuffer({
      size: geometry.plane.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(planeIndexBuffer, 0, geometry.plane.indexData);

    const sceneBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const objectBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const volumeTextureBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "3d",
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {
            type: "filtering",
          },
        },
      ],
    });

    const opaquePipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [sceneBindGroupLayout, objectBindGroupLayout],
    });

    const texturedPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [
        sceneBindGroupLayout,
        objectBindGroupLayout,
        volumeTextureBindGroupLayout,
      ],
    });

    const vertexModule = device.createShaderModule({
      code: sceneVertexShaderSource,
    });

    const sceneFragmentModule = device.createShaderModule({
      code: sceneFragmentShaderSource,
    });

    const volumeFragmentModule = device.createShaderModule({
      code: volumeFragmentShaderSource,
    });

    const opaquePipeline = device.createRenderPipeline({
      layout: opaquePipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: {
        module: sceneFragmentModule,
        entryPoint: "opaqueFragment",
        targets: [{ format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    const slicePipeline = device.createRenderPipeline({
      layout: texturedPipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: {
        module: sceneFragmentModule,
        entryPoint: "sliceFragment",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "less",
      },
    });

    const volumePipeline = device.createRenderPipeline({
      layout: texturedPipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 12, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: {
        module: volumeFragmentModule,
        entryPoint: "volumeFragment",
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "less",
      },
    });

    const sceneConfigs = createVolumeSceneConfigs();
    const opaqueObjects: RenderObject[] = sceneConfigs.map((config) => {
      const uniformBuffer = device.createBuffer({
        size: 24 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      device.queue.writeBuffer(
        uniformBuffer,
        0,
        createObjectUniformData(
          createModelMatrix(config),
          config.color,
          config.surfaceMode,
          config.detailScale
        )
      );

      const bindGroup = device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      return {
        uniformBuffer,
        bindGroup,
      };
    });

    const sliceUniformBuffer = device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const sliceBindGroup = device.createBindGroup({
      layout: objectBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: sliceUniformBuffer } }],
    });

    const volumeUniformBuffer = device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    device.queue.writeBuffer(
      volumeUniformBuffer,
      0,
      createObjectUniformData(
        createScaleMatrix(1, 1, 1),
        [0.26, 0.86, 1.0, 1],
        0,
        0
      )
    );

    const volumeBindGroup = device.createBindGroup({
      layout: objectBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: volumeUniformBuffer } }],
    });

    const volumeTexture = device.createTexture({
      dimension: "3d",
      size: [volumeData.size, volumeData.size, volumeData.size],
      format: "r8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    device.queue.writeTexture(
      { texture: volumeTexture },
      volumeData.data,
      {
        bytesPerRow: volumeData.size,
        rowsPerImage: volumeData.size,
      },
      {
        width: volumeData.size,
        height: volumeData.size,
        depthOrArrayLayers: volumeData.size,
      }
    );

    const volumeSampler = device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
    });

    const volumeTextureBindGroup = device.createBindGroup({
      layout: volumeTextureBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: volumeTexture.createView({
            dimension: "3d",
          }),
        },
        {
          binding: 1,
          resource: volumeSampler,
        },
      ],
    });

    const createViewport = (key: VolumeViewportKey): VolumeViewport => {
      const sceneUniformBuffer = device.createBuffer({
        size: 32 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const sceneBindGroup = device.createBindGroup({
        layout: sceneBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
      });

      return {
        key,
        sceneUniformBuffer,
        sceneBindGroup,
      };
    };

    const sliceViewport = createViewport("slice");
    const volumeViewport = createViewport("volume");

    const orbitController = createOrbitCameraController(canvas, {
      target: RIGHT_CAMERA_TARGET,
      eye: [4.9, 2.15, 4.6],
      minRadius: 3.8,
      maxRadius: 8.5,
      rotateSpeed: 0.008,
      zoomSpeed: 0.006,
    });

    const syncCanvasSize = () => {
      canvasRuntime.resize();
      ensureDepthTarget(device, depthTarget, canvas.width, canvas.height);
      lastKnownCanvasWidth = canvas.width;
      lastKnownCanvasHeight = canvas.height;

      const nextLayout = chooseLayoutMode(canvas.clientWidth);
      metrics.layout = nextLayout;
      canvasShell.classList.toggle(
        "volume-canvas-shell--stacked",
        nextLayout === "stacked"
      );
    };

    const updateSlicePlane = () => {
      const modelMatrix = multiplyMatrices(
        createTranslationMatrix(0, 0, metrics.sliceDepth),
        createScaleMatrix(0.92, 0.92, 0.012)
      );

      device.queue.writeBuffer(
        sliceUniformBuffer,
        0,
        createObjectUniformData(
          modelMatrix,
          [0.26, 0.86, 1.0, 1],
          0,
          0
        )
      );
    };

    const refreshHud = () => {
      metrics.stepSpacing = 2 / Math.max(1, metrics.raySteps);
      updateHud(refs, metrics);
      updateSlicePlane();
      lastHudUpdateTimeMs = performance.now();
    };

    sliceRange.addEventListener("input", () => {
      metrics.sliceDepth = Number.parseFloat(sliceRange.value);
      refreshHud();
    });

    stepsRange.addEventListener("input", () => {
      metrics.raySteps = Number.parseFloat(stepsRange.value);
      refreshHud();
    });

    densityRange.addEventListener("input", () => {
      metrics.densityGain = Number.parseFloat(densityRange.value);
      refreshHud();
    });

    resizeObserver = new ResizeObserver(() => {
      syncCanvasSize();
    });
    resizeObserver.observe(host);
    resizeObserver.observe(canvas);

    syncCanvasSize();
    refreshHud();

    /**
     * 按给定矩形渲染某一个面板。
     * @param {GPURenderPassEncoder} pass 当前帧的 render pass。
     * @param {VolumeViewport} viewport 当前面板的 viewport 状态。
     * @param {VolumePanelRect} rect 当前面板对应的视口矩形。
     * @returns {void} 只编码 draw 命令，不返回额外结果。
     */
    const drawPanel = (
      pass: GPURenderPassEncoder,
      viewport: VolumeViewport,
      rect: VolumePanelRect
    ) => {
      pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
      pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);

      pass.setPipeline(opaquePipeline);
      pass.setBindGroup(0, viewport.sceneBindGroup);
      pass.setVertexBuffer(0, cubeVertexBuffer);
      pass.setIndexBuffer(cubeIndexBuffer, "uint16");
      for (const object of opaqueObjects) {
        pass.setBindGroup(1, object.bindGroup);
        pass.drawIndexed(geometry.cube.indexCount);
      }

      if (viewport.key === "slice") {
        pass.setPipeline(slicePipeline);
        pass.setBindGroup(0, viewport.sceneBindGroup);
        pass.setBindGroup(1, sliceBindGroup);
        pass.setBindGroup(2, volumeTextureBindGroup);
        pass.setVertexBuffer(0, planeVertexBuffer);
        pass.setIndexBuffer(planeIndexBuffer, "uint16");
        pass.drawIndexed(geometry.plane.indexCount);
        return;
      }

      pass.setPipeline(volumePipeline);
      pass.setBindGroup(0, viewport.sceneBindGroup);
      pass.setBindGroup(1, volumeBindGroup);
      pass.setBindGroup(2, volumeTextureBindGroup);
      pass.setVertexBuffer(0, cubeVertexBuffer);
      pass.setIndexBuffer(cubeIndexBuffer, "uint16");
      pass.drawIndexed(geometry.cube.indexCount);
    };

    const frame = (timeMs: number) => {
      if (disposed || !depthTarget.view) {
        return;
      }

      if (canvas.width !== lastKnownCanvasWidth || canvas.height !== lastKnownCanvasHeight) {
        syncCanvasSize();
      }

      const orbitSnapshot = orbitController.getSnapshot();
      const lightPosition: Vector3 = [
        Math.cos(timeMs * 0.00035) * 4.9,
        3.6 + Math.sin(timeMs * 0.00052) * 0.45,
        Math.sin(timeMs * 0.00035) * 4.9,
      ];
      const panelRects = createPanelRects(canvas.width, canvas.height, metrics.layout);

      const sliceViewProjection = multiplyMatrices(
        createPerspectiveMatrix(
          Math.PI / 4.4,
          panelRects.slice.width / Math.max(1, panelRects.slice.height),
          0.1,
          20
        ),
        createLookAtViewMatrix(SLICE_CAMERA_EYE, SLICE_CAMERA_TARGET, [0, 1, 0])
      );

      const volumeViewProjection = multiplyMatrices(
        createPerspectiveMatrix(
          Math.PI / 4.2,
          panelRects.volume.width / Math.max(1, panelRects.volume.height),
          0.1,
          24
        ),
        createLookAtViewMatrix(orbitSnapshot.eye, orbitSnapshot.target, orbitSnapshot.up)
      );

      device.queue.writeBuffer(
        sliceViewport.sceneUniformBuffer,
        0,
        createSceneUniformData(
          sliceViewProjection,
          SLICE_CAMERA_EYE,
          lightPosition,
          metrics,
          timeMs * 0.001
        )
      );

      device.queue.writeBuffer(
        volumeViewport.sceneUniformBuffer,
        0,
        createSceneUniformData(
          volumeViewProjection,
          orbitSnapshot.eye,
          lightPosition,
          metrics,
          timeMs * 0.001
        )
      );

      if (timeMs - lastHudUpdateTimeMs >= HUD_UPDATE_INTERVAL_MS) {
        updateHud(refs, metrics);
        lastHudUpdateTimeMs = timeMs;
      }

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.045, b: 0.085, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthTarget.view,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      drawPanel(pass, sliceViewport, panelRects.slice);
      drawPanel(pass, volumeViewport, panelRects.volume);
      pass.end();

      device.queue.submit([encoder.finish()]);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    setStatus({
      title: "体渲染与 3D Texture 已运行",
      detail:
        "左侧直接读取同一份 3D texture 的单层切片，右侧则沿视线反复采样并累积颜色与透明度。拖动画布可以旋转右侧体渲染视角。",
      tone: "ok",
    });

    animationFrameId = window.requestAnimationFrame(frame);

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitController.dispose();
      destroyDepthTarget(depthTarget);
      cubeVertexBuffer.destroy();
      cubeIndexBuffer.destroy();
      planeVertexBuffer.destroy();
      planeIndexBuffer.destroy();
      sliceUniformBuffer.destroy();
      volumeUniformBuffer.destroy();
      sliceViewport.sceneUniformBuffer.destroy();
      volumeViewport.sceneUniformBuffer.destroy();
      for (const object of opaqueObjects) {
        object.uniformBuffer.destroy();
      }
      volumeTexture.destroy();
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "第 43 课初始化失败。";

    host.innerHTML = `
      <div class="preview-empty">
        <div>
          <h3>预览不可用</h3>
          <p>${message}</p>
        </div>
      </div>
    `;

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
