import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createTexture3dSliceDensityTextureData } from "@/lessons/lesson-48-texture3d-and-volume-slices/density";
import { createTexture3dSliceLessonGeometry } from "@/lessons/lesson-48-texture3d-and-volume-slices/geometry";
import {
  createLookAtViewMatrix,
  createOrthographicMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-48-texture3d-and-volume-slices/math";
import sceneFragmentShaderSource from "@/lessons/lesson-48-texture3d-and-volume-slices/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-48-texture3d-and-volume-slices/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type Color4 = [number, number, number, number];

type Texture3dSliceAxis = "xy" | "xz" | "yz";

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

type Texture3dSliceLayoutMode = "split" | "stacked";

type Texture3dSlicePanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Texture3dSliceViewportKey = "slice" | "context";

type Texture3dSliceViewport = {
  key: Texture3dSliceViewportKey;
  sceneUniformBuffer: GPUBuffer;
  sceneBindGroup: GPUBindGroup;
};

type Texture3dSliceHudRefs = {
  textureBadge: HTMLElement;
  axisBadge: HTMLElement;
  sliceBadge: HTMLElement;
  sharedBadge: HTMLElement;
  textureValue: HTMLElement;
  textureMeta: HTMLElement;
  depthValue: HTMLElement;
  depthMeta: HTMLElement;
  layerValue: HTMLElement;
  layerMeta: HTMLElement;
  activeValue: HTMLElement;
  activeMeta: HTMLElement;
  sliceOutput: HTMLElement;
  gainOutput: HTMLElement;
  legendBody: HTMLElement;
  axisButtons: HTMLButtonElement[];
  slicePanelTitle: HTMLElement;
  contextPanelTitle: HTMLElement;
};

type Texture3dSliceMetrics = {
  textureSize: number;
  voxelCount: number;
  memoryBytes: number;
  activeRatio: number;
  sliceDepth: number;
  densityGain: number;
  axis: Texture3dSliceAxis;
  layout: Texture3dSliceLayoutMode;
};

const TEXTURE_SIZE = 64;
const PANEL_GAP_PX = 24;
const HUD_UPDATE_INTERVAL_MS = 180;
const ORTHO_EYE: Vector3 = [0, 0, 4.6];
const ORTHO_TARGET: Vector3 = [0, 0, 0];
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
 * 把切片深度格式化成带正负号的文本。
 * @param {Texture3dSliceAxis} axis 当前固定的轴向。
 * @param {number} value 当前切片深度。
 * @returns {string} 对应的展示文本。
 */
function formatSliceDepth(axis: Texture3dSliceAxis, value: number): string {
  const fixedAxis = axis === "xy" ? "z" : axis === "xz" ? "y" : "x";
  return `${fixedAxis} = ${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

/**
 * 把切片轴向格式化成更直观的平面描述。
 * @param {Texture3dSliceAxis} axis 当前轴向。
 * @returns {string} 对应的轴向文本。
 */
function formatAxis(axis: Texture3dSliceAxis): string {
  if (axis === "xy") {
    return "XY · 固定 Z";
  }

  if (axis === "xz") {
    return "XZ · 固定 Y";
  }

  return "YZ · 固定 X";
}

/**
 * 根据当前深度估算它命中的体素层号。
 * @param {number} size 体纹理边长。
 * @param {number} sliceDepth 当前切片深度，范围 -1 到 1。
 * @returns {number} 0-based 近似层号。
 */
function sliceLayerIndex(size: number, sliceDepth: number): number {
  const normalized = Math.min(1, Math.max(0, sliceDepth * 0.5 + 0.5));
  return Math.round(normalized * (size - 1));
}

/**
 * 生成一份场景 uniform 数据，里面包含 VP、眼睛位置、光源和切片参数。
 * @param {Float32Array} viewProjectionMatrix 当前面板的 VP 矩阵。
 * @param {Vector3} eyePosition 当前面板的相机位置。
 * @param {Vector3} lightPosition 当前点光源位置。
 * @param {Texture3dSliceMetrics} metrics 当前切片参数状态。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续数据。
 */
function createSceneUniformData(
  viewProjectionMatrix: Float32Array,
  eyePosition: Vector3,
  lightPosition: Vector3,
  metrics: Texture3dSliceMetrics
): Float32Array {
  const axisMode = metrics.axis === "xy" ? 0 : metrics.axis === "xz" ? 1 : 2;
  const uniformData = new Float32Array(28);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 16);
  uniformData.set([lightPosition[0], lightPosition[1], lightPosition[2], 1], 20);
  uniformData.set(
    [metrics.sliceDepth, metrics.densityGain, axisMode, metrics.textureSize],
    24
  );
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
 * 生成这节课右侧空间视图会复用的一组静态场景对象。
 * @returns {SceneObjectConfig[]} 一个带底座和体边框的对象数组。
 */
function createTexture3dSliceSceneConfigs(): SceneObjectConfig[] {
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
 * 根据当前轴向与深度，创建右侧空间视图里那张切片平面的模型矩阵。
 * @param {Texture3dSliceAxis} axis 当前切片轴向。
 * @param {number} sliceDepth 当前切片深度。
 * @returns {Float32Array} 对应的模型矩阵。
 */
function createContextSliceModelMatrix(
  axis: Texture3dSliceAxis,
  sliceDepth: number
): Float32Array {
  const scaleMatrix = createScaleMatrix(0.96, 0.96, 0.012);

  if (axis === "xy") {
    return multiplyMatrices(createTranslationMatrix(0, 0, sliceDepth), scaleMatrix);
  }

  if (axis === "xz") {
    return multiplyMatrices(
      createTranslationMatrix(0, sliceDepth, 0),
      multiplyMatrices(createRotationXMatrix(-Math.PI * 0.5), scaleMatrix)
    );
  }

  return multiplyMatrices(
    createTranslationMatrix(sliceDepth, 0, 0),
    multiplyMatrices(createRotationYMatrix(Math.PI * 0.5), scaleMatrix)
  );
}

/**
 * 根据当前切片深度、轴向和密度增益，生成更贴近这节课重点的说明文案。
 * @param {Texture3dSliceMetrics} metrics 当前 HUD 指标状态。
 * @returns {string} 对应的总结说明。
 */
function createLegendCopy(metrics: Texture3dSliceMetrics): string {
  const layer = sliceLayerIndex(metrics.textureSize, metrics.sliceDepth) + 1;

  if (Math.abs(metrics.sliceDepth) >= 0.58) {
    return `当前切片已经靠近体盒边缘，所以无论左侧还是右侧，都只会命中那团密度场较薄的一层外壳。这里最重要的不是“画得像不像体积”，而是看懂：固定一条轴上的深度后，shader 实际上只是在读第 ${layer} 层附近的体素。`;
  }

  if (metrics.axis === "yz") {
    return `现在固定的是 X，所以左侧显示的是一张 YZ 截面，右侧则把同一张平面放回体盒里的 X 位置。切换轴向时，底层 ` +
      `texture3D` +
      ` 没变，只是 shader 把哪一维当成“固定层”换掉了。`;
  }

  if (metrics.densityGain >= 1.8) {
    return `密度增益已经拉到 ${metrics.densityGain.toFixed(2)}x，所以左侧单层切片里的高密度区域会更接近发光核。这里也能看出：体纹理里真正存的是标量密度，最终的颜色、轮廓和强调线都是 shader 后面再映射出来的。`;
  }

  return `左侧是正交切片，只关心当前这一层读到了什么；右侧把同一张切片重新摆回体盒里的真实位置，帮助把“二维截面”和“三维体数据里的深度”对应起来。真正的关键是：一份 ` +
    `texture3D` +
    ` 可以被许多不同视角重复采样，但它底层始终只是同一块三维体素数据。`;
}

/**
 * 根据当前 axis 生成更贴近教学语义的左右面板标题。
 * @param {Texture3dSliceAxis} axis 当前切片轴向。
 * @returns {{ sliceTitle: string; contextTitle: string }} 对应的面板标题。
 */
function createPanelTitles(axis: Texture3dSliceAxis): {
  sliceTitle: string;
  contextTitle: string;
} {
  if (axis === "xy") {
    return {
      sliceTitle: "左侧正交观察 XY 截面",
      contextTitle: "右侧把这张 XY 切片放回体盒里的 Z 位置",
    };
  }

  if (axis === "xz") {
    return {
      sliceTitle: "左侧正交观察 XZ 截面",
      contextTitle: "右侧把这张 XZ 切片放回体盒里的 Y 位置",
    };
  }

  return {
    sliceTitle: "左侧正交观察 YZ 截面",
    contextTitle: "右侧把这张 YZ 切片放回体盒里的 X 位置",
  };
}

/**
 * 根据当前状态更新 HUD 文案、控制旁边的读数和说明段落。
 * @param {Texture3dSliceHudRefs} refs HUD 里要更新的 DOM 引用。
 * @param {Texture3dSliceMetrics} metrics 当前体数据和切片参数状态。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(refs: Texture3dSliceHudRefs, metrics: Texture3dSliceMetrics): void {
  const layer = sliceLayerIndex(metrics.textureSize, metrics.sliceDepth);
  const layerText = `${layer + 1} / ${metrics.textureSize}`;
  const panelTitles = createPanelTitles(metrics.axis);

  refs.textureBadge.textContent = `texture3D · ${formatVolumeSize(metrics.textureSize)} · r8unorm`;
  refs.textureBadge.className = "texture3d-slices-badge texture3d-slices-badge--ok";

  refs.axisBadge.textContent = `轴向 · ${formatAxis(metrics.axis)}`;
  refs.axisBadge.className = "texture3d-slices-badge texture3d-slices-badge--cool";

  refs.sliceBadge.textContent = `切片深度 · ${formatSliceDepth(metrics.axis, metrics.sliceDepth)}`;
  refs.sliceBadge.className =
    Math.abs(metrics.sliceDepth) >= 0.58
      ? "texture3d-slices-badge texture3d-slices-badge--accent"
      : "texture3d-slices-badge";

  refs.sharedBadge.textContent = "同一份 volumeTexture · 左右两边重复采样";
  refs.sharedBadge.className = "texture3d-slices-badge";

  refs.textureValue.textContent = formatVolumeSize(metrics.textureSize);
  refs.textureMeta.textContent =
    `共 ${formatCount(metrics.voxelCount)} 个体素，约占 ${formatMemory(metrics.memoryBytes)}；其中 ${formatPercent(metrics.activeRatio)} 的体素真正带有密度。`;

  refs.depthValue.textContent = formatSliceDepth(metrics.axis, metrics.sliceDepth);
  refs.depthMeta.textContent =
    `当前大约落在第 ${layerText} 层附近。这里固定的是 ${formatAxis(metrics.axis)} 里的最后那一维，所以移动滑杆本质上是在改“读哪一层”。`;

  refs.layerValue.textContent = layerText;
  refs.layerMeta.textContent =
    `边长 ${metrics.textureSize} 的 3D 纹理在当前轴向上总共有这么多离散层；切片深度会被映射到其中一层附近，再由线性采样在相邻体素之间平滑过渡。`;

  refs.activeValue.textContent = formatPercent(metrics.activeRatio);
  refs.activeMeta.textContent =
    `当前密度增益 ${metrics.densityGain.toFixed(2)}x，左侧只是把这一层的数据重新映射成颜色，右侧则展示这层在体盒中的空间位置。`;

  refs.sliceOutput.textContent = formatSliceDepth(metrics.axis, metrics.sliceDepth);
  refs.gainOutput.textContent = `${metrics.densityGain.toFixed(2)}x`;
  refs.legendBody.textContent = createLegendCopy(metrics);
  refs.slicePanelTitle.textContent = panelTitles.sliceTitle;
  refs.contextPanelTitle.textContent = panelTitles.contextTitle;

  for (const button of refs.axisButtons) {
    const buttonAxis = button.dataset.axis as Texture3dSliceAxis | undefined;
    const active = buttonAxis === metrics.axis;
    button.className = active
      ? "texture3d-slices-axis-button texture3d-slices-axis-button--active"
      : "texture3d-slices-axis-button";
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
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
 * @returns {Texture3dSliceLayoutMode} 对应的布局模式。
 */
function chooseLayoutMode(width: number): Texture3dSliceLayoutMode {
  return width < 720 ? "stacked" : "split";
}

/**
 * 按当前布局模式，把画布拆成两块对照视口。
 * @param {number} width 当前画布像素宽度。
 * @param {number} height 当前画布像素高度。
 * @param {Texture3dSliceLayoutMode} layout 当前布局模式。
 * @returns {{ slice: Texture3dSlicePanelRect; context: Texture3dSlicePanelRect }} 两个面板的视口矩形。
 */
function createTexture3dSlicePanelRects(
  width: number,
  height: number,
  layout: Texture3dSliceLayoutMode
): { slice: Texture3dSlicePanelRect; context: Texture3dSlicePanelRect } {
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
      context: {
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
    context: {
      x: rightX,
      y: 0,
      width: Math.max(1, width - rightX),
      height,
    },
  };
}

/**
 * 挂载第 45 课“3D Texture 与体数据切片”，
 * 用一份共享的 `texture3D` 同时做正交切片和空间定位对照。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听和 GPU 资源。
 */
export async function mountTexture3dAndVolumeSlicesLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<(() => void) | void> {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--texture3d-slices">
      <div class="preview-frame">
        <div class="texture3d-slices-stage">
          <div class="texture3d-slices-stage__badges">
            <span class="texture3d-slices-badge" data-slice-badge="texture"></span>
            <span class="texture3d-slices-badge" data-slice-badge="axis"></span>
            <span class="texture3d-slices-badge" data-slice-badge="depth"></span>
            <span class="texture3d-slices-badge" data-slice-badge="shared"></span>
          </div>

          <div class="texture3d-slices-controls">
            <label class="texture3d-slices-control">
              <span class="texture3d-slices-control__row">
                <span class="texture3d-slices-control__label">切片深度</span>
                <span class="texture3d-slices-control__value" data-slice-control-output="depth"></span>
              </span>
              <input class="texture3d-slices-control__range" data-slice-control="depth" type="range" min="-0.82" max="0.82" step="0.01" value="0.08" />
            </label>

            <label class="texture3d-slices-control">
              <span class="texture3d-slices-control__row">
                <span class="texture3d-slices-control__label">密度增益</span>
                <span class="texture3d-slices-control__value" data-slice-control-output="gain"></span>
              </span>
              <input class="texture3d-slices-control__range" data-slice-control="gain" type="range" min="0.7" max="2.3" step="0.05" value="1.35" />
            </label>

            <div class="texture3d-slices-control texture3d-slices-control--axis">
              <span class="texture3d-slices-control__label">切换轴向</span>
              <div class="texture3d-slices-axis-group" role="group" aria-label="选择当前切片轴向">
                <button class="texture3d-slices-axis-button" data-axis="xy" type="button">XY</button>
                <button class="texture3d-slices-axis-button" data-axis="xz" type="button">XZ</button>
                <button class="texture3d-slices-axis-button" data-axis="yz" type="button">YZ</button>
              </div>
            </div>
          </div>

          <div class="texture3d-slices-canvas-shell" data-slice-canvas-shell>
            <canvas class="texture3d-slices-canvas" data-slice-canvas></canvas>
            <div class="texture3d-slices-overlay">
              <div class="texture3d-slices-divider"></div>

              <div class="texture3d-slices-panel-label texture3d-slices-panel-label--slice">
                <span class="texture3d-slices-panel-label__eyebrow">Orthographic Slice</span>
                <strong class="texture3d-slices-panel-label__title" data-slice-panel-title></strong>
              </div>

              <div class="texture3d-slices-panel-label texture3d-slices-panel-label--context">
                <span class="texture3d-slices-panel-label__eyebrow">Slice In Context</span>
                <strong class="texture3d-slices-panel-label__title" data-context-panel-title></strong>
              </div>
            </div>
          </div>

          <div class="texture3d-slices-card-grid">
            <article class="texture3d-slices-card texture3d-slices-card--cool">
              <p class="texture3d-slices-card__label">体纹理尺寸</p>
              <strong class="texture3d-slices-card__value" data-slice-card-value="texture"></strong>
              <p class="texture3d-slices-card__meta" data-slice-card-meta="texture"></p>
            </article>

            <article class="texture3d-slices-card texture3d-slices-card--accent">
              <p class="texture3d-slices-card__label">当前深度</p>
              <strong class="texture3d-slices-card__value" data-slice-card-value="depth"></strong>
              <p class="texture3d-slices-card__meta" data-slice-card-meta="depth"></p>
            </article>

            <article class="texture3d-slices-card texture3d-slices-card--ok">
              <p class="texture3d-slices-card__label">近似层号</p>
              <strong class="texture3d-slices-card__value" data-slice-card-value="layer"></strong>
              <p class="texture3d-slices-card__meta" data-slice-card-meta="layer"></p>
            </article>

            <article class="texture3d-slices-card">
              <p class="texture3d-slices-card__label">活跃体素</p>
              <strong class="texture3d-slices-card__value" data-slice-card-value="active"></strong>
              <p class="texture3d-slices-card__meta" data-slice-card-meta="active"></p>
            </article>
          </div>

          <div class="texture3d-slices-stage__legend">
            <p class="texture3d-slices-stage__legend-title">当前实验</p>
            <p class="texture3d-slices-stage__legend-body" data-slice-legend></p>
          </div>
        </div>
      </div>
    </div>
  `;

  const textureBadge = host.querySelector<HTMLElement>('[data-slice-badge="texture"]');
  const axisBadge = host.querySelector<HTMLElement>('[data-slice-badge="axis"]');
  const sliceBadge = host.querySelector<HTMLElement>('[data-slice-badge="depth"]');
  const sharedBadge = host.querySelector<HTMLElement>('[data-slice-badge="shared"]');
  const textureValue = host.querySelector<HTMLElement>('[data-slice-card-value="texture"]');
  const textureMeta = host.querySelector<HTMLElement>('[data-slice-card-meta="texture"]');
  const depthValue = host.querySelector<HTMLElement>('[data-slice-card-value="depth"]');
  const depthMeta = host.querySelector<HTMLElement>('[data-slice-card-meta="depth"]');
  const layerValue = host.querySelector<HTMLElement>('[data-slice-card-value="layer"]');
  const layerMeta = host.querySelector<HTMLElement>('[data-slice-card-meta="layer"]');
  const activeValue = host.querySelector<HTMLElement>('[data-slice-card-value="active"]');
  const activeMeta = host.querySelector<HTMLElement>('[data-slice-card-meta="active"]');
  const legendBody = host.querySelector<HTMLElement>("[data-slice-legend]");
  const sliceOutput = host.querySelector<HTMLElement>('[data-slice-control-output="depth"]');
  const gainOutput = host.querySelector<HTMLElement>('[data-slice-control-output="gain"]');
  const depthRange = host.querySelector<HTMLInputElement>('[data-slice-control="depth"]');
  const gainRange = host.querySelector<HTMLInputElement>('[data-slice-control="gain"]');
  const axisButtons = Array.from(
    host.querySelectorAll<HTMLButtonElement>("[data-axis]")
  );
  const slicePanelTitle = host.querySelector<HTMLElement>("[data-slice-panel-title]");
  const contextPanelTitle = host.querySelector<HTMLElement>("[data-context-panel-title]");
  const canvas = host.querySelector<HTMLCanvasElement>("[data-slice-canvas]");
  const canvasShell = host.querySelector<HTMLElement>("[data-slice-canvas-shell]");

  if (
    !textureBadge ||
    !axisBadge ||
    !sliceBadge ||
    !sharedBadge ||
    !textureValue ||
    !textureMeta ||
    !depthValue ||
    !depthMeta ||
    !layerValue ||
    !layerMeta ||
    !activeValue ||
    !activeMeta ||
    !legendBody ||
    !sliceOutput ||
    !gainOutput ||
    !depthRange ||
    !gainRange ||
    axisButtons.length !== 3 ||
    !slicePanelTitle ||
    !contextPanelTitle ||
    !canvas ||
    !canvasShell
  ) {
    setStatus({
      title: "预览不可用",
      detail: "第 45 课的 DOM 结构没有完整挂载出来。",
      tone: "warn",
    });
    return;
  }

  const refs: Texture3dSliceHudRefs = {
    textureBadge,
    axisBadge,
    sliceBadge,
    sharedBadge,
    textureValue,
    textureMeta,
    depthValue,
    depthMeta,
    layerValue,
    layerMeta,
    activeValue,
    activeMeta,
    sliceOutput,
    gainOutput,
    legendBody,
    axisButtons,
    slicePanelTitle,
    contextPanelTitle,
  };

  const metrics: Texture3dSliceMetrics = {
    textureSize: TEXTURE_SIZE,
    voxelCount: 0,
    memoryBytes: 0,
    activeRatio: 0,
    sliceDepth: Number.parseFloat(depthRange.value),
    densityGain: Number.parseFloat(gainRange.value),
    axis: "xy",
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
    const volumeData = createTexture3dSliceDensityTextureData(TEXTURE_SIZE);
    metrics.textureSize = volumeData.size;
    metrics.voxelCount = volumeData.voxelCount;
    metrics.memoryBytes = volumeData.memoryBytes;
    metrics.activeRatio = volumeData.activeRatio;
    updateHud(refs, metrics);

    const canvasRuntime = await createWebGpuCanvas(canvas);
    const { device, context, format } = canvasRuntime;

    const geometry = createTexture3dSliceLessonGeometry();

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

    const slicePipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [
        sceneBindGroupLayout,
        objectBindGroupLayout,
        volumeTextureBindGroupLayout,
      ],
    });

    const vertexModule = device.createShaderModule({
      code: sceneVertexShaderSource,
    });

    const fragmentModule = device.createShaderModule({
      code: sceneFragmentShaderSource,
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
        module: fragmentModule,
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
      layout: slicePipelineLayout,
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
        module: fragmentModule,
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
        cullMode: "none",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "less",
      },
    });

    const sceneConfigs = createTexture3dSliceSceneConfigs();
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

    const leftSliceUniformBuffer = device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const leftSliceBindGroup = device.createBindGroup({
      layout: objectBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: leftSliceUniformBuffer } }],
    });

    const contextSliceUniformBuffer = device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const contextSliceBindGroup = device.createBindGroup({
      layout: objectBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: contextSliceUniformBuffer } }],
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

    const createViewport = (
      key: Texture3dSliceViewportKey
    ): Texture3dSliceViewport => {
      const sceneUniformBuffer = device.createBuffer({
        size: 28 * 4,
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
    const contextViewport = createViewport("context");

    const orbitController = createOrbitCameraController(canvas, {
      target: RIGHT_CAMERA_TARGET,
      eye: [4.85, 2.12, 4.58],
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
        "texture3d-slices-canvas-shell--stacked",
        nextLayout === "stacked"
      );
    };

    const updateSlicePlanes = () => {
      device.queue.writeBuffer(
        leftSliceUniformBuffer,
        0,
        createObjectUniformData(
          createScaleMatrix(0.96, 0.96, 0.012),
          [0.24, 0.86, 1.0, 1],
          0,
          0
        )
      );

      device.queue.writeBuffer(
        contextSliceUniformBuffer,
        0,
        createObjectUniformData(
          createContextSliceModelMatrix(metrics.axis, metrics.sliceDepth),
          [0.24, 0.86, 1.0, 1],
          0,
          0
        )
      );
    };

    const refreshHud = () => {
      updateHud(refs, metrics);
      updateSlicePlanes();
      lastHudUpdateTimeMs = performance.now();
    };

    depthRange.addEventListener("input", () => {
      metrics.sliceDepth = Number.parseFloat(depthRange.value);
      refreshHud();
    });

    gainRange.addEventListener("input", () => {
      metrics.densityGain = Number.parseFloat(gainRange.value);
      refreshHud();
    });

    for (const button of axisButtons) {
      button.addEventListener("click", () => {
        const axis = button.dataset.axis as Texture3dSliceAxis | undefined;
        if (!axis || axis === metrics.axis) {
          return;
        }

        metrics.axis = axis;
        refreshHud();
      });
    }

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
     * @param {Texture3dSliceViewport} viewport 当前面板的 viewport 状态。
     * @param {Texture3dSlicePanelRect} rect 当前面板对应的视口矩形。
     * @returns {void} 只编码 draw 命令，不返回额外结果。
     */
    const drawPanel = (
      pass: GPURenderPassEncoder,
      viewport: Texture3dSliceViewport,
      rect: Texture3dSlicePanelRect
    ) => {
      pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
      pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);

      if (viewport.key === "context") {
        pass.setPipeline(opaquePipeline);
        pass.setBindGroup(0, viewport.sceneBindGroup);
        pass.setVertexBuffer(0, cubeVertexBuffer);
        pass.setIndexBuffer(cubeIndexBuffer, "uint16");
        for (const object of opaqueObjects) {
          pass.setBindGroup(1, object.bindGroup);
          pass.drawIndexed(geometry.cube.indexCount);
        }
      }

      pass.setPipeline(slicePipeline);
      pass.setBindGroup(0, viewport.sceneBindGroup);
      pass.setBindGroup(
        1,
        viewport.key === "slice" ? leftSliceBindGroup : contextSliceBindGroup
      );
      pass.setBindGroup(2, volumeTextureBindGroup);
      pass.setVertexBuffer(0, planeVertexBuffer);
      pass.setIndexBuffer(planeIndexBuffer, "uint16");
      pass.drawIndexed(geometry.plane.indexCount);
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
      const panelRects = createTexture3dSlicePanelRects(
        canvas.width,
        canvas.height,
        metrics.layout
      );

      const sliceOrthoHalfWidth = 1.2;
      const sliceOrthoHalfHeight =
        sliceOrthoHalfWidth *
        (panelRects.slice.height / Math.max(1, panelRects.slice.width));
      const sliceViewProjection = multiplyMatrices(
        createOrthographicMatrix(
          -sliceOrthoHalfWidth,
          sliceOrthoHalfWidth,
          -sliceOrthoHalfHeight,
          sliceOrthoHalfHeight,
          0.1,
          10
        ),
        createLookAtViewMatrix(ORTHO_EYE, ORTHO_TARGET, [0, 1, 0])
      );

      const contextViewProjection = multiplyMatrices(
        createPerspectiveMatrix(
          Math.PI / 4.2,
          panelRects.context.width / Math.max(1, panelRects.context.height),
          0.1,
          24
        ),
        createLookAtViewMatrix(orbitSnapshot.eye, orbitSnapshot.target, orbitSnapshot.up)
      );

      device.queue.writeBuffer(
        sliceViewport.sceneUniformBuffer,
        0,
        createSceneUniformData(sliceViewProjection, ORTHO_EYE, lightPosition, metrics)
      );

      device.queue.writeBuffer(
        contextViewport.sceneUniformBuffer,
        0,
        createSceneUniformData(contextViewProjection, orbitSnapshot.eye, lightPosition, metrics)
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
      drawPanel(pass, contextViewport, panelRects.context);
      pass.end();

      device.queue.submit([encoder.finish()]);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    setStatus({
      title: "3D Texture 与体数据切片已运行",
      detail:
        "左侧只做正交切片采样，右侧把同一张切片放回体盒里的真实深度位置。切换轴向或移动深度时，底层始终是同一份 texture3D 数据。",
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
      leftSliceUniformBuffer.destroy();
      contextSliceUniformBuffer.destroy();
      sliceViewport.sceneUniformBuffer.destroy();
      contextViewport.sceneUniformBuffer.destroy();
      for (const object of opaqueObjects) {
        object.uniformBuffer.destroy();
      }
      volumeTexture.destroy();
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "第 45 课初始化失败。";

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
