import { createOrbitCameraController } from "@/core/orbit-camera";
import { createMultiCanvasLessonGeometry } from "@/lessons/lesson-45-hidpi-and-multiple-canvases/geometry";
import {
  createLookAtViewMatrix,
  createOrbitEyePosition,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  createRotationZMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-45-hidpi-and-multiple-canvases/math";
import fragmentShaderSource from "@/lessons/lesson-45-hidpi-and-multiple-canvases/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-45-hidpi-and-multiple-canvases/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type Color4 = [number, number, number, number];

type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  rotation: Vector3;
  scale: Vector3;
  color: Color4;
  surfaceMode: 0 | 1;
  detailScale: number;
};

type MultiCanvasLessonDevice = {
  device: GPUDevice;
  format: GPUTextureFormat;
};

type MultiCanvasPanelKey = "naive" | "hidpi" | "overview";

type PanelDepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type MultiCanvasPanelRefs = {
  badge: HTMLElement;
  pixelsValue: HTMLElement;
  pixelsMeta: HTMLElement;
  ratioValue: HTMLElement;
  ratioMeta: HTMLElement;
  noteBody: HTMLElement;
};

type MultiCanvasPanelState = {
  key: MultiCanvasPanelKey;
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  refs: MultiCanvasPanelRefs;
  depthTarget: PanelDepthTarget;
  frameUniformBuffer: GPUBuffer;
  frameBindGroup: GPUBindGroup;
  clearColor: GPUColor;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  appliedPixelRatio: number;
  configured: boolean;
};

type MultiCanvasHudRefs = {
  deviceBadge: HTMLElement;
  dprBadge: HTMLElement;
  depthBadge: HTMLElement;
};

const MAX_PIXEL_RATIO = 2;
const HUD_UPDATE_INTERVAL_MS = 240;
const OVERVIEW_YAW_OFFSET = 0.92;
const OVERVIEW_PITCH = 0.88;
const OVERVIEW_RADIUS_SCALE = 0.9;
const DETAIL_OBJECT_COUNT = 36;

/**
 * 生成 0-1 之间的稳定伪随机数，保证 lesson 每次刷新场景都一致。
 * @param {number} index 当前对象索引。
 * @param {number} salt 用来切换不同随机流的偏移量。
 * @returns {number} 一个稳定的 0-1 浮点数。
 */
function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

/**
 * 把对象数量格式化成更适合 HUD 的数字文本。
 * @param {number} value 当前对象数量。
 * @returns {string} 对应的中文数字字符串。
 */
function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 把像素尺寸格式化成更适合 HUD 展示的文本。
 * @param {number} width 当前宽度。
 * @param {number} height 当前高度。
 * @returns {string} 对应的尺寸字符串。
 */
function formatSize(width: number, height: number): string {
  return `${formatCount(width)} × ${formatCount(height)}`;
}

/**
 * 把像素比格式化成短文本。
 * @param {number} value 当前像素比。
 * @returns {string} 对应的展示文本。
 */
function formatPixelRatio(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

  return `${value.toFixed(2)}x`;
}

/**
 * 生成一份 frame uniform 数据，里面包含 VP、光源位置和相机位置。
 * @param {Float32Array} viewProjectionMatrix 当前面板的 VP 矩阵。
 * @param {Vector3} lightPosition 当前光源位置。
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
 * 生成一份对象级 uniform 数据，里面包含模型矩阵、颜色和表面细节参数。
 * @param {Float32Array} modelMatrix 当前对象模型矩阵。
 * @param {Color4} color 当前对象颜色。
 * @param {0 | 1} surfaceMode 0 表示纯色表面，1 表示带细网格的表面。
 * @param {number} detailScale 当前表面细节密度。
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
 * 组合当前对象的平移、旋转和缩放，生成一份模型矩阵。
 * @param {SceneObjectConfig} config 当前对象配置。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createModelMatrix(config: SceneObjectConfig): Float32Array {
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
 * 生成整节课要复用的一批静态场景对象。
 * @returns {SceneObjectConfig[]} 一个带细网格地面和大量细杆结构的对象数组。
 */
function createHiDpiAndMultiCanvasSceneConfigs(): SceneObjectConfig[] {
  const objects: SceneObjectConfig[] = [
    {
      label: "floor",
      translation: [0, -1.18, 0],
      rotation: [0, 0, 0],
      scale: [6.2, 0.12, 6.2],
      color: [0.18, 0.22, 0.28, 1],
      surfaceMode: 1,
      detailScale: 3.6,
    },
    {
      label: "plinth",
      translation: [0, -0.78, 0],
      rotation: [0, 0, 0],
      scale: [2.5, 0.24, 2.5],
      color: [0.20, 0.26, 0.34, 1],
      surfaceMode: 1,
      detailScale: 7.4,
    },
    {
      label: "core",
      translation: [0, 0.15, 0],
      rotation: [0.16, 0.38, 0.08],
      scale: [1.15, 1.7, 1.15],
      color: [0.28, 0.82, 1, 1],
      surfaceMode: 0,
      detailScale: 0,
    },
    {
      label: "beam-x",
      translation: [0, 0.26, 0],
      rotation: [0.18, 0.0, 0.42],
      scale: [2.85, 0.14, 0.24],
      color: [1.0, 0.72, 0.30, 1],
      surfaceMode: 0,
      detailScale: 0,
    },
    {
      label: "beam-z",
      translation: [0, 0.08, 0],
      rotation: [-0.14, Math.PI * 0.5, 0.0],
      scale: [2.45, 0.12, 0.22],
      color: [0.56, 0.87, 0.42, 1],
      surfaceMode: 0,
      detailScale: 0,
    },
  ];

  const palette = [
    [0.28, 0.82, 1.0, 1],
    [1.0, 0.69, 0.29, 1],
    [0.57, 0.88, 0.44, 1],
    [0.80, 0.63, 0.97, 1],
  ] as const;

  for (let index = 0; index < DETAIL_OBJECT_COUNT; index += 1) {
    const normalized = index / DETAIL_OBJECT_COUNT;
    const angle = normalized * Math.PI * 2;
    const lane = index % 3;
    const radius = 2.2 + lane * 0.22 + seededUnit(index, 1) * 0.16;
    const height = 0.62 + seededUnit(index, 2) * 1.35;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const color = palette[index % palette.length];

    objects.push({
      label: `fin-${index}`,
      translation: [x, -0.25 + height * 0.5, z],
      rotation: [
        seededUnit(index, 3) * 0.22,
        angle + seededUnit(index, 4) * 0.18,
        seededUnit(index, 5) * 0.18,
      ],
      scale: [
        0.07 + seededUnit(index, 6) * 0.08,
        height,
        0.22 + seededUnit(index, 7) * 0.16,
      ],
      color: [color[0], color[1], color[2], 1],
      surfaceMode: 0,
      detailScale: 0,
    });
  }

  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2 + Math.PI * 0.1;
    const radius = 3.55 + seededUnit(index, 8) * 0.28;

    objects.push({
      label: `edge-block-${index}`,
      translation: [
        Math.cos(angle) * radius,
        -0.55 + seededUnit(index, 9) * 0.28,
        Math.sin(angle) * radius,
      ],
      rotation: [
        0.04 + seededUnit(index, 10) * 0.16,
        angle,
        seededUnit(index, 11) * 0.08,
      ],
      scale: [
        0.36 + seededUnit(index, 12) * 0.2,
        0.42 + seededUnit(index, 13) * 0.5,
        0.36 + seededUnit(index, 14) * 0.2,
      ],
      color: [0.32, 0.41 + seededUnit(index, 15) * 0.18, 0.56 + seededUnit(index, 16) * 0.22, 1],
      surfaceMode: 0,
      detailScale: 0,
    });
  }

  return objects;
}

/**
 * 安全释放某块 canvas 的深度纹理。
 * @param {PanelDepthTarget} target 当前面板使用的深度目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyDepthTarget(target: PanelDepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 申请这节课要共享的一台 GPUDevice。
 * @returns {Promise<MultiCanvasLessonDevice>} 包含 device 和 preferred canvas format 的运行时对象。
 */
async function createMultiCanvasLessonDevice(): Promise<MultiCanvasLessonDevice> {
  if (!("gpu" in navigator)) {
    throw new Error("当前浏览器没有提供 WebGPU。");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("没有拿到可用的 GPUAdapter。");
  }

  const device = await adapter.requestDevice();
  const format = navigator.gpu.getPreferredCanvasFormat();

  return {
    device,
    format,
  };
}

/**
 * 为单块 canvas 创建 lesson 里要维护的 per-canvas 状态。
 * @param {MultiCanvasPanelKey} key 当前面板标识。
 * @param {HTMLCanvasElement} canvas 当前面板实际渲染用画布。
 * @param {MultiCanvasPanelRefs} refs 当前面板的 DOM 引用。
 * @param {GPUDevice} device 当前 lesson 共享的 device。
 * @param {GPUBindGroupLayout} frameBindGroupLayout 当前面板 frame uniform 对应的 bind-group layout。
 * @param {GPUColor} clearColor 当前面板的清屏颜色。
 * @returns {MultiCanvasPanelState} 这块 canvas 对应的运行时状态。
 */
function createPanelState(
  key: MultiCanvasPanelKey,
  canvas: HTMLCanvasElement,
  refs: MultiCanvasPanelRefs,
  device: GPUDevice,
  frameBindGroupLayout: GPUBindGroupLayout,
  clearColor: GPUColor
): MultiCanvasPanelState {
  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error(`面板 ${key} 没有拿到 WebGPUCanvasContext。`);
  }

  const frameUniformBuffer = device.createBuffer({
    size: 24 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const frameBindGroup = device.createBindGroup({
    layout: frameBindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: frameUniformBuffer } }],
  });

  return {
    key,
    canvas,
    context,
    refs,
    depthTarget: {
      texture: null,
      view: null,
      width: 0,
      height: 0,
    },
    frameUniformBuffer,
    frameBindGroup,
    clearColor,
    cssWidth: 0,
    cssHeight: 0,
    pixelWidth: 0,
    pixelHeight: 0,
    appliedPixelRatio: 1,
    configured: false,
  };
}

/**
 * 按当前面板策略同步 canvas 像素尺寸和 GPUCanvasContext 配置。
 * @param {MultiCanvasPanelState} panel 当前面板运行时状态。
 * @param {GPUDevice} device 当前 lesson 共用的 GPUDevice。
 * @param {GPUTextureFormat} format 当前 lesson 共用的颜色格式。
 * @returns {void} 只更新当前面板的 canvas 尺寸、context 配置和 metrics。
 */
function resizePanelCanvas(
  panel: MultiCanvasPanelState,
  device: GPUDevice,
  format: GPUTextureFormat
): void {
  const cssWidth = Math.max(1, Math.floor(panel.canvas.clientWidth));
  const cssHeight = Math.max(1, Math.floor(panel.canvas.clientHeight));
  const desiredRatio =
    panel.key === "naive"
      ? 1
      : Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const pixelWidth = Math.max(1, Math.floor(cssWidth * desiredRatio));
  const pixelHeight = Math.max(1, Math.floor(cssHeight * desiredRatio));
  const sizeChanged =
    panel.canvas.width !== pixelWidth || panel.canvas.height !== pixelHeight;

  panel.cssWidth = cssWidth;
  panel.cssHeight = cssHeight;
  panel.pixelWidth = pixelWidth;
  panel.pixelHeight = pixelHeight;
  panel.appliedPixelRatio = pixelWidth / Math.max(1, cssWidth);

  if (!panel.configured || sizeChanged) {
    panel.canvas.width = pixelWidth;
    panel.canvas.height = pixelHeight;
    panel.context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
    panel.configured = true;

    if (sizeChanged) {
      destroyDepthTarget(panel.depthTarget);
      panel.depthTarget.width = 0;
      panel.depthTarget.height = 0;
    }
  }
}

/**
 * 确保某块 canvas 拥有与当前像素尺寸一致的深度纹理。
 * @param {MultiCanvasPanelState} panel 当前面板运行时状态。
 * @param {GPUDevice} device 当前 lesson 共用的 GPUDevice。
 * @returns {GPUTextureView} 当前帧可直接挂进 render pass 的深度视图。
 */
function ensurePanelDepthTarget(
  panel: MultiCanvasPanelState,
  device: GPUDevice
): GPUTextureView {
  if (
    panel.depthTarget.view &&
    panel.depthTarget.width === panel.canvas.width &&
    panel.depthTarget.height === panel.canvas.height
  ) {
    return panel.depthTarget.view;
  }

  destroyDepthTarget(panel.depthTarget);
  panel.depthTarget.width = panel.canvas.width;
  panel.depthTarget.height = panel.canvas.height;
  panel.depthTarget.texture = device.createTexture({
    size: [panel.canvas.width, panel.canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  panel.depthTarget.view = panel.depthTarget.texture.createView();
  return panel.depthTarget.view;
}

/**
 * 更新单块面板的 HUD 文案。
 * @param {MultiCanvasPanelState} panel 当前面板运行时状态。
 * @param {number} windowDpr 当前窗口 devicePixelRatio。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updatePanelHud(panel: MultiCanvasPanelState, windowDpr: number): void {
  panel.refs.pixelsValue.textContent = formatSize(panel.pixelWidth, panel.pixelHeight);
  panel.refs.pixelsMeta.textContent = `css ${formatSize(panel.cssWidth, panel.cssHeight)}`;

  panel.refs.ratioValue.textContent = formatPixelRatio(panel.appliedPixelRatio);

  if (panel.key === "naive") {
    panel.refs.badge.textContent = "低采样";
    panel.refs.badge.className = "hidpi-panel__badge hidpi-panel__badge--warn";
    panel.refs.ratioMeta.textContent = "未乘 DPR";
    panel.refs.noteBody.textContent =
      windowDpr <= 1.05 ? "DPR 接近 1，差异较小。" : "细网格和锐边会先糊。";
    return;
  }

  if (panel.key === "hidpi") {
    panel.refs.badge.textContent = "正确";
    panel.refs.badge.className = "hidpi-panel__badge hidpi-panel__badge--cool";
    panel.refs.ratioMeta.textContent = `target ${formatPixelRatio(windowDpr)}`;
    panel.refs.noteBody.textContent = "同一套 draw，像素配齐。";
    return;
  }

  panel.refs.badge.textContent = "共享 device";
  panel.refs.badge.className = "hidpi-panel__badge hidpi-panel__badge--ok";
  panel.refs.ratioMeta.textContent = `target ${formatPixelRatio(windowDpr)}`;
  panel.refs.noteBody.textContent = "共用资源，分开 state。";
}

/**
 * 更新整节课 HUD 的汇总信息与每块面板说明。
 * @param {MultiCanvasHudRefs} refs lesson 级 HUD 引用。
 * @param {MultiCanvasPanelState[]} panels 三块 canvas 对应的运行时状态。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(
  refs: MultiCanvasHudRefs,
  panels: MultiCanvasPanelState[]
): void {
  const windowDpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

  refs.deviceBadge.textContent = `1 device / ${panels.length} canvases`;
  refs.deviceBadge.className = "hidpi-badge hidpi-badge--cool";

  refs.dprBadge.textContent = `DPR ${formatPixelRatio(windowDpr)}`;
  refs.dprBadge.className =
    windowDpr > 1.05 ? "hidpi-badge hidpi-badge--accent" : "hidpi-badge";

  refs.depthBadge.textContent = "各画布自带 state";
  refs.depthBadge.className = "hidpi-badge hidpi-badge--ok";

  panels.forEach((panel) => updatePanelHud(panel, windowDpr));
}

/**
 * 挂载第 41 课“高 DPI 与多画布”，把错误 resize、正确 HiDPI resize 和多 canvas 共享 device 放进同一个实验。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源。
 */
export async function mountHiDpiAndMultipleCanvasesLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--hidpi">
      <div class="preview-frame">
        <div class="hidpi-stage">
          <canvas class="hidpi-stage__interaction" aria-hidden="true"></canvas>
          <div class="hidpi-stage__badges">
            <span class="hidpi-badge" data-hidpi-badge="device"></span>
            <span class="hidpi-badge" data-hidpi-badge="dpr"></span>
            <span class="hidpi-badge" data-hidpi-badge="depth"></span>
          </div>
        <div class="hidpi-grid">
          <section class="hidpi-panel hidpi-panel--warn">
              <div class="hidpi-panel__header">
                <div>
                  <p class="hidpi-panel__eyebrow">naive</p>
                  <h3 class="hidpi-panel__title">忽略 DPR</h3>
                </div>
                <span class="hidpi-panel__badge" data-hidpi-panel-badge="naive"></span>
              </div>
              <div class="hidpi-panel__canvas-shell">
                <canvas
                  class="hidpi-panel__canvas"
                  data-hidpi-canvas="naive"
                  aria-label="Naive resize panel"
                ></canvas>
                <div class="hidpi-panel__overlay">
                  <div class="hidpi-panel__metrics">
                    <article class="hidpi-metric">
                      <p class="hidpi-metric__label">像素</p>
                      <strong class="hidpi-metric__value" data-hidpi-value="pixels-naive"></strong>
                      <p class="hidpi-metric__meta" data-hidpi-meta="pixels-naive"></p>
                    </article>
                    <article class="hidpi-metric">
                      <p class="hidpi-metric__label">倍率</p>
                      <strong class="hidpi-metric__value" data-hidpi-value="ratio-naive"></strong>
                      <p class="hidpi-metric__meta" data-hidpi-meta="ratio-naive"></p>
                    </article>
                  </div>
                  <p class="hidpi-panel__note" data-hidpi-note="naive"></p>
                </div>
              </div>
            </section>

            <section class="hidpi-panel hidpi-panel--cool">
              <div class="hidpi-panel__header">
                <div>
                  <p class="hidpi-panel__eyebrow">hidpi</p>
                  <h3 class="hidpi-panel__title">按 DPR resize</h3>
                </div>
                <span class="hidpi-panel__badge" data-hidpi-panel-badge="hidpi"></span>
              </div>
              <div class="hidpi-panel__canvas-shell">
                <canvas
                  class="hidpi-panel__canvas"
                  data-hidpi-canvas="hidpi"
                  aria-label="HiDPI resize panel"
                ></canvas>
                <div class="hidpi-panel__overlay">
                  <div class="hidpi-panel__metrics">
                    <article class="hidpi-metric">
                      <p class="hidpi-metric__label">像素</p>
                      <strong class="hidpi-metric__value" data-hidpi-value="pixels-hidpi"></strong>
                      <p class="hidpi-metric__meta" data-hidpi-meta="pixels-hidpi"></p>
                    </article>
                    <article class="hidpi-metric">
                      <p class="hidpi-metric__label">倍率</p>
                      <strong class="hidpi-metric__value" data-hidpi-value="ratio-hidpi"></strong>
                      <p class="hidpi-metric__meta" data-hidpi-meta="ratio-hidpi"></p>
                    </article>
                  </div>
                  <p class="hidpi-panel__note" data-hidpi-note="hidpi"></p>
                </div>
              </div>
            </section>

            <section class="hidpi-panel hidpi-panel--overview">
              <div class="hidpi-panel__header">
                <div>
                  <p class="hidpi-panel__eyebrow">multiple canvases</p>
                  <h3 class="hidpi-panel__title">共享同一台 device</h3>
                </div>
                <span class="hidpi-panel__badge" data-hidpi-panel-badge="overview"></span>
              </div>
              <div class="hidpi-panel__canvas-shell hidpi-panel__canvas-shell--wide">
                <canvas
                  class="hidpi-panel__canvas"
                  data-hidpi-canvas="overview"
                  aria-label="Overview multi-canvas panel"
                ></canvas>
                <div class="hidpi-panel__overlay">
                  <div class="hidpi-panel__metrics">
                    <article class="hidpi-metric">
                      <p class="hidpi-metric__label">像素</p>
                      <strong class="hidpi-metric__value" data-hidpi-value="pixels-overview"></strong>
                      <p class="hidpi-metric__meta" data-hidpi-meta="pixels-overview"></p>
                    </article>
                    <article class="hidpi-metric">
                      <p class="hidpi-metric__label">倍率</p>
                      <strong class="hidpi-metric__value" data-hidpi-value="ratio-overview"></strong>
                      <p class="hidpi-metric__meta" data-hidpi-meta="ratio-overview"></p>
                    </article>
                  </div>
                  <p class="hidpi-panel__note" data-hidpi-note="overview"></p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  `;

  const viewport = host.querySelector<HTMLDivElement>(".preview-viewport");
  const interactionCanvas = host.querySelector<HTMLCanvasElement>(".hidpi-stage__interaction");
  const naiveCanvas = host.querySelector<HTMLCanvasElement>('[data-hidpi-canvas="naive"]');
  const hidpiCanvas = host.querySelector<HTMLCanvasElement>('[data-hidpi-canvas="hidpi"]');
  const overviewCanvas = host.querySelector<HTMLCanvasElement>('[data-hidpi-canvas="overview"]');

  if (!viewport || !interactionCanvas || !naiveCanvas || !hidpiCanvas || !overviewCanvas) {
    throw new Error("第 41 课的预览结构没有创建成功。");
  }

  const lessonHudRefs: MultiCanvasHudRefs = {
    deviceBadge: host.querySelector<HTMLElement>('[data-hidpi-badge="device"]')!,
    dprBadge: host.querySelector<HTMLElement>('[data-hidpi-badge="dpr"]')!,
    depthBadge: host.querySelector<HTMLElement>('[data-hidpi-badge="depth"]')!,
  };

  try {
    const runtime = await createMultiCanvasLessonDevice();

    /**
     * 根据当前 lesson 的双行布局，给预览区分配一个更高一些的画幅。
     * @returns {void} 只更新预览视口尺寸，不返回额外结果。
     */
    const syncViewport = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const compactLayout = window.matchMedia("(max-width: 1120px)").matches;
      const aspect = compactLayout ? 1.02 : 1.34;

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

    const geometry = createMultiCanvasLessonGeometry();

    const vertexBuffer = runtime.device.createBuffer({
      size: geometry.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    runtime.device.queue.writeBuffer(vertexBuffer, 0, geometry.vertexData);

    const indexBuffer = runtime.device.createBuffer({
      size: geometry.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    runtime.device.queue.writeBuffer(indexBuffer, 0, geometry.indexData);

    const frameBindGroupLayout = runtime.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const objectBindGroupLayout = runtime.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const renderPipeline = runtime.device.createRenderPipeline({
      label: "lesson-41-hidpi-and-multi-canvas-pipeline",
      layout: runtime.device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, objectBindGroupLayout],
      }),
      vertex: {
        module: runtime.device.createShaderModule({ code: vertexShaderSource }),
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
        module: runtime.device.createShaderModule({ code: fragmentShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: runtime.format }],
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

    const renderObjects = createHiDpiAndMultiCanvasSceneConfigs().map((config) => {
      const uniformBuffer = runtime.device.createBuffer({
        size: 24 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = runtime.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });
      const modelMatrix = createModelMatrix(config);

      runtime.device.queue.writeBuffer(
        uniformBuffer,
        0,
        createObjectUniformData(modelMatrix, config.color, config.surfaceMode, config.detailScale)
      );

      return {
        uniformBuffer,
        bindGroup,
      };
    });

    const panelStates: MultiCanvasPanelState[] = [
      createPanelState(
        "naive",
        naiveCanvas,
        {
          badge: host.querySelector<HTMLElement>('[data-hidpi-panel-badge="naive"]')!,
          pixelsValue: host.querySelector<HTMLElement>('[data-hidpi-value="pixels-naive"]')!,
          pixelsMeta: host.querySelector<HTMLElement>('[data-hidpi-meta="pixels-naive"]')!,
          ratioValue: host.querySelector<HTMLElement>('[data-hidpi-value="ratio-naive"]')!,
          ratioMeta: host.querySelector<HTMLElement>('[data-hidpi-meta="ratio-naive"]')!,
          noteBody: host.querySelector<HTMLElement>('[data-hidpi-note="naive"]')!,
        },
        runtime.device,
        frameBindGroupLayout,
        { r: 0.074, g: 0.064, b: 0.078, a: 1 }
      ),
      createPanelState(
        "hidpi",
        hidpiCanvas,
        {
          badge: host.querySelector<HTMLElement>('[data-hidpi-panel-badge="hidpi"]')!,
          pixelsValue: host.querySelector<HTMLElement>('[data-hidpi-value="pixels-hidpi"]')!,
          pixelsMeta: host.querySelector<HTMLElement>('[data-hidpi-meta="pixels-hidpi"]')!,
          ratioValue: host.querySelector<HTMLElement>('[data-hidpi-value="ratio-hidpi"]')!,
          ratioMeta: host.querySelector<HTMLElement>('[data-hidpi-meta="ratio-hidpi"]')!,
          noteBody: host.querySelector<HTMLElement>('[data-hidpi-note="hidpi"]')!,
        },
        runtime.device,
        frameBindGroupLayout,
        { r: 0.032, g: 0.058, b: 0.112, a: 1 }
      ),
      createPanelState(
        "overview",
        overviewCanvas,
        {
          badge: host.querySelector<HTMLElement>('[data-hidpi-panel-badge="overview"]')!,
          pixelsValue: host.querySelector<HTMLElement>('[data-hidpi-value="pixels-overview"]')!,
          pixelsMeta: host.querySelector<HTMLElement>('[data-hidpi-meta="pixels-overview"]')!,
          ratioValue: host.querySelector<HTMLElement>('[data-hidpi-value="ratio-overview"]')!,
          ratioMeta: host.querySelector<HTMLElement>('[data-hidpi-meta="ratio-overview"]')!,
          noteBody: host.querySelector<HTMLElement>('[data-hidpi-note="overview"]')!,
        },
        runtime.device,
        frameBindGroupLayout,
        { r: 0.040, g: 0.050, b: 0.078, a: 1 }
      ),
    ];

    updateHud(lessonHudRefs, panelStates);

    const orbitCamera = createOrbitCameraController(interactionCanvas, {
      target: [0, -0.15, 0],
      eye: [7.8, 4.6, 8.2],
      minRadius: 5.5,
      maxRadius: 16,
      rotateSpeed: 0.0085,
      zoomSpeed: 0.004,
      onChange: () => render(performance.now()),
    });

    let disposed = false;
    let animationFrameId = 0;
    let lastHudUpdateTimeMs = -Infinity;

    const render = (timestamp: number) => {
      if (disposed) {
        return;
      }

      syncViewport();
      panelStates.forEach((panel) => resizePanelCanvas(panel, runtime.device, runtime.format));

      const camera = orbitCamera.getSnapshot();
      const time = timestamp * 0.001;
      const lightPosition: Vector3 = [
        Math.cos(time * 0.52) * 7.2,
        5.3 + Math.sin(time * 0.8) * 0.72,
        Math.sin(time * 0.52) * 7.2,
      ];

      const commandEncoder = runtime.device.createCommandEncoder({
        label: "lesson-41-multi-canvas-command-encoder",
      });

      panelStates.forEach((panel) => {
        const aspect = panel.canvas.width / panel.canvas.height;
        const eye =
          panel.key === "overview"
            ? createOrbitEyePosition(
                camera.yaw + OVERVIEW_YAW_OFFSET,
                OVERVIEW_PITCH,
                camera.radius * OVERVIEW_RADIUS_SCALE,
                camera.target
              )
            : camera.eye;
        const viewMatrix = createLookAtViewMatrix(eye, camera.target, camera.up);
        const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.45, aspect, 0.1, 100);
        const depthView = ensurePanelDepthTarget(panel, runtime.device);

        runtime.device.queue.writeBuffer(
          panel.frameUniformBuffer,
          0,
          createFrameUniformData(
            multiplyMatrices(projectionMatrix, viewMatrix),
            lightPosition,
            eye
          )
        );

        const pass = commandEncoder.beginRenderPass({
          colorAttachments: [
            {
              view: panel.context.getCurrentTexture().createView(),
              clearValue: panel.clearColor,
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

        pass.setPipeline(renderPipeline);
        pass.setBindGroup(0, panel.frameBindGroup);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.setIndexBuffer(indexBuffer, "uint16");

        renderObjects.forEach((object) => {
          pass.setBindGroup(1, object.bindGroup);
          pass.drawIndexed(geometry.indexCount);
        });

        pass.end();
      });

      runtime.device.queue.submit([commandEncoder.finish()]);

      if (timestamp - lastHudUpdateTimeMs >= HUD_UPDATE_INTERVAL_MS) {
        lastHudUpdateTimeMs = timestamp;
        updateHud(lessonHudRefs, panelStates);
      }
    };

    const frame = (timestamp: number) => {
      render(timestamp);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      panelStates.forEach((panel) => destroyDepthTarget(panel.depthTarget));
      render(performance.now());
    });
    resizeObserver.observe(host);

    render(performance.now());
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "高 DPI 与多画布已运行",
      detail:
        "左边故意低采样，中间按 DPR 配齐，底部再用第 2 块 canvas 证明多画布可以共享同一台 GPUDevice。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitCamera.dispose();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      renderObjects.forEach((object) => object.uniformBuffer.destroy());
      panelStates.forEach((panel) => {
        destroyDepthTarget(panel.depthTarget);
        panel.frameUniformBuffer.destroy();
      });
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
