import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createABufferLessonGeometry } from "@/lessons/lesson-114-a-buffer-and-oit/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-114-a-buffer-and-oit/math";
import abufferFragmentShaderSource from "@/lessons/lesson-114-a-buffer-and-oit/abuffer.frag.wgsl?raw";
import resolveShaderSource from "@/lessons/lesson-114-a-buffer-and-oit/resolve.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-114-a-buffer-and-oit/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-114-a-buffer-and-oit/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type Color4 = [number, number, number, number];

type SceneObjectConfig = {
  translation: Vector3;
  rotationX: number;
  rotationY: number;
  scale: Vector3;
  color: Color4;
};

type TransparentPaneDefinition = {
  label: string;
  center: Vector3;
  spreadAxis: Vector3;
  rotationY: number;
  tiltDirection: number;
  scale: Vector3;
  color: [number, number, number];
};

type RenderObject = {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type ColorTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type ABufferBuffers = {
  countsBuffer: GPUBuffer | null;
  fragmentsBuffer: GPUBuffer | null;
  width: number;
  height: number;
  capacity: number;
  zeroCountsData: Uint32Array;
};

type ABufferSettings = {
  alpha: number;
  capacity: number;
  spread: number;
  tilt: number;
};

type ABufferStats = {
  activePixels: number | null;
  maxLayers: number | null;
  overflowCount: number | null;
  storedFragments: number | null;
  pendingReadback: boolean;
};

type ABufferHudRefs = {
  orderBadge: HTMLElement;
  modeBadge: HTMLElement;
  overflowBadge: HTMLElement;
  alphaOutput: HTMLElement;
  capacityOutput: HTMLElement;
  spreadOutput: HTMLElement;
  tiltOutput: HTMLElement;
  orderValue: HTMLElement;
  orderMeta: HTMLElement;
  activeValue: HTMLElement;
  activeMeta: HTMLElement;
  depthValue: HTMLElement;
  depthMeta: HTMLElement;
  overflowValue: HTMLElement;
  overflowMeta: HTMLElement;
  legendBody: HTMLElement;
};

const CAMERA_FOV = Math.PI / 3.15;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 22;
const SCENE_UNIFORM_BYTES = 128;
const OBJECT_UNIFORM_BYTES = 80;
const STATS_BUFFER_BYTES = Uint32Array.BYTES_PER_ELEMENT * 4;
const READBACK_INTERVAL_MS = 240;
const MAX_A_BUFFER_CAPACITY = 8;
const DRAW_ORDER_LABEL = "青 → 琥珀 → 紫 → 绿";
const CLEAR_COLOR: GPUColor = { r: 0.03, g: 0.05, b: 0.09, a: 1 };
const LIGHT_DIRECTION: Vector3 = [-0.46, 0.84, 0.31];

const TRANSPARENT_PANES: TransparentPaneDefinition[] = [
  {
    label: "cyan",
    center: [-0.48, 0.12, 0.02],
    spreadAxis: [-0.65, 0.0, 0.24],
    rotationY: 0.18,
    tiltDirection: 1,
    scale: [0.12, 1.5, 2.32],
    color: [0.24, 0.84, 1.0],
  },
  {
    label: "amber",
    center: [0.42, 0.04, -0.16],
    spreadAxis: [0.54, 0.0, -0.38],
    rotationY: 1.06,
    tiltDirection: -1,
    scale: [0.12, 1.42, 2.18],
    color: [1.0, 0.68, 0.26],
  },
  {
    label: "violet",
    center: [0.08, 0.28, 0.28],
    spreadAxis: [0.22, 0.0, 0.58],
    rotationY: 2.02,
    tiltDirection: 1,
    scale: [0.12, 1.66, 1.98],
    color: [0.72, 0.55, 1.0],
  },
  {
    label: "lime",
    center: [-0.12, -0.16, 0.38],
    spreadAxis: [-0.28, 0.0, 0.66],
    rotationY: 0.72,
    tiltDirection: -1,
    scale: [0.12, 1.34, 2.08],
    color: [0.62, 0.98, 0.56],
  },
];

/**
 * 把整数格式化成更适合 HUD 的中文数字字符串。
 * @param {number} value 当前数字。
 * @returns {string} 对应的格式化文本。
 */
function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 把百分比透明度格式化成短文本。
 * @param {number} value 当前透明度。
 * @returns {string} 对应的展示文本。
 */
function formatAlpha(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * 把每像素容量格式化成“6 层”。
 * @param {number} value 当前容量。
 * @returns {string} 对应的展示文本。
 */
function formatCapacity(value: number): string {
  return `${value} 层`;
}

/**
 * 把交叠幅度格式化成倍率文本。
 * @param {number} value 当前交叠幅度。
 * @returns {string} 对应的展示文本。
 */
function formatSpread(value: number): string {
  return `${value.toFixed(2)}x`;
}

/**
 * 把倾斜强度格式化成百分比。
 * @param {number} value 当前倾斜强度。
 * @returns {string} 对应的展示文本。
 */
function formatTilt(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * 创建第 46 课的静态不透明场景：地板、背板和两块实体参考块。
 * @returns {SceneObjectConfig[]} 对应的不透明对象配置列表。
 */
function createOpaqueSceneConfigs(): SceneObjectConfig[] {
  return [
    {
      translation: [0, -1.24, 0],
      rotationX: 0,
      rotationY: 0,
      scale: [4.2, 0.18, 4.0],
      color: [0.10, 0.14, 0.18, 1],
    },
    {
      translation: [0, 0.55, -2.62],
      rotationX: 0,
      rotationY: 0,
      scale: [3.6, 1.9, 0.18],
      color: [0.12, 0.18, 0.22, 1],
    },
    {
      translation: [-1.7, -0.28, -1.08],
      rotationX: 0,
      rotationY: 0.34,
      scale: [0.45, 0.95, 0.45],
      color: [0.20, 0.30, 0.38, 1],
    },
    {
      translation: [1.62, -0.42, 1.26],
      rotationX: 0,
      rotationY: -0.24,
      scale: [0.58, 0.78, 0.58],
      color: [0.24, 0.26, 0.34, 1],
    },
  ];
}

/**
 * 根据当前控制项重新计算透明玻璃板的变换和颜色。
 * @param {ABufferSettings} settings 当前课程参数。
 * @returns {SceneObjectConfig[]} 对应的透明对象配置列表。
 */
function createTransparentConfigs(settings: ABufferSettings): SceneObjectConfig[] {
  return TRANSPARENT_PANES.map((pane) => ({
    translation: [
      pane.center[0] * settings.spread + pane.spreadAxis[0] * (settings.spread - 1),
      pane.center[1],
      pane.center[2] * settings.spread + pane.spreadAxis[2] * (settings.spread - 1),
    ],
    rotationX: pane.tiltDirection * settings.tilt * 0.42,
    rotationY: pane.rotationY + settings.tilt * pane.tiltDirection * 0.1,
    scale: pane.scale,
    color: [pane.color[0], pane.color[1], pane.color[2], settings.alpha],
  }));
}

/**
 * 组合对象的模型矩阵。
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
      createRotationYMatrix(config.rotationY),
      multiplyMatrices(
        createRotationXMatrix(config.rotationX),
        createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
      )
    )
  );
}

/**
 * 组装对象 uniform：模型矩阵 + 颜色。
 * @param {Float32Array} modelMatrix 当前对象模型矩阵。
 * @param {Color4} color 当前对象颜色与透明度。
 * @returns {Float32Array} 适合直接写入 uniform buffer 的连续数据。
 */
function createObjectUniformData(
  modelMatrix: Float32Array,
  color: Color4
): Float32Array {
  const data = new Float32Array(20);
  data.set(modelMatrix, 0);
  data.set(color, 16);
  return data;
}

/**
 * 组装场景级 uniform：VP、相机、光方向、环境光和右侧 A-buffer 尺寸信息。
 * @param {Float32Array} viewProjectionMatrix 当前 VP 矩阵。
 * @param {Vector3} eyePosition 当前相机位置。
 * @param {number} panelWidth 单侧 pane 的像素宽度。
 * @param {number} panelHeight 单侧 pane 的像素高度。
 * @param {number} capacity 每像素可存储的片元层数。
 * @returns {ArrayBuffer} 对应的 uniform 数据块。
 */
function createSceneUniformData(
  viewProjectionMatrix: Float32Array,
  eyePosition: Vector3,
  panelWidth: number,
  panelHeight: number,
  capacity: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(SCENE_UNIFORM_BYTES);
  const floats = new Float32Array(buffer);
  const uints = new Uint32Array(buffer);

  floats.set(viewProjectionMatrix, 0);
  floats.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 16);
  floats.set([LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2], 0], 20);
  floats.set([0.12, 0.14, 0.19, 1], 24);
  uints.set([panelWidth, panelHeight, capacity, 0], 28);

  return buffer;
}

/**
 * 销毁离屏颜色纹理并清空引用。
 * @param {ColorTarget} target 当前颜色目标状态。
 * @returns {void} 只负责销毁与引用清空。
 */
function destroyColorTarget(target: ColorTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
  target.width = 0;
  target.height = 0;
}

/**
 * 确保离屏颜色纹理和当前 pane 像素尺寸一致。
 * @param {ColorTarget} target 当前颜色目标状态。
 * @param {GPUDevice} device 当前 lesson 共享的 device。
 * @param {GPUTextureFormat} format 颜色格式。
 * @param {number} width 目标像素宽度。
 * @param {number} height 目标像素高度。
 * @returns {boolean} 是否发生了重建。
 */
function ensureColorTarget(
  target: ColorTarget,
  device: GPUDevice,
  format: GPUTextureFormat,
  width: number,
  height: number
): boolean {
  if (
    target.texture &&
    target.view &&
    target.width === width &&
    target.height === height
  ) {
    return false;
  }

  destroyColorTarget(target);
  target.texture = device.createTexture({
    size: { width, height },
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  target.view = target.texture.createView();
  target.width = width;
  target.height = height;
  return true;
}

/**
 * 销毁深度纹理并清空引用。
 * @param {DepthTarget} target 当前深度目标状态。
 * @returns {void} 只负责销毁与引用清空。
 */
function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
  target.width = 0;
  target.height = 0;
}

/**
 * 确保深度纹理和当前 pane 像素尺寸一致。
 * @param {DepthTarget} target 当前深度目标状态。
 * @param {GPUDevice} device 当前 lesson 共享的 device。
 * @param {number} width 目标像素宽度。
 * @param {number} height 目标像素高度。
 * @returns {boolean} 是否发生了重建。
 */
function ensureDepthTarget(
  target: DepthTarget,
  device: GPUDevice,
  width: number,
  height: number
): boolean {
  if (
    target.texture &&
    target.view &&
    target.width === width &&
    target.height === height
  ) {
    return false;
  }

  destroyDepthTarget(target);
  target.texture = device.createTexture({
    size: { width, height },
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  target.view = target.texture.createView();
  target.width = width;
  target.height = height;
  return true;
}

/**
 * 销毁 A-buffer 片元计数和片元列表缓冲。
 * @param {ABufferBuffers} buffers 当前 A-buffer 状态。
 * @returns {void} 只负责释放 GPU 资源和清空尺寸记录。
 */
function destroyABufferBuffers(buffers: ABufferBuffers): void {
  buffers.countsBuffer?.destroy();
  buffers.fragmentsBuffer?.destroy();
  buffers.countsBuffer = null;
  buffers.fragmentsBuffer = null;
  buffers.width = 0;
  buffers.height = 0;
  buffers.capacity = 0;
  buffers.zeroCountsData = new Uint32Array(0);
}

/**
 * 确保 A-buffer 的计数与片元列表缓冲和当前尺寸 / 容量一致。
 * @param {ABufferBuffers} buffers 当前 A-buffer 状态。
 * @param {GPUDevice} device 当前共享 device。
 * @param {number} width 右侧 pane 像素宽度。
 * @param {number} height 右侧 pane 像素高度。
 * @param {number} capacity 每像素容量。
 * @returns {boolean} 是否发生了重建。
 */
function ensureABufferBuffers(
  buffers: ABufferBuffers,
  device: GPUDevice,
  width: number,
  height: number,
  capacity: number
): boolean {
  if (
    buffers.countsBuffer &&
    buffers.fragmentsBuffer &&
    buffers.width === width &&
    buffers.height === height &&
    buffers.capacity === capacity
  ) {
    return false;
  }

  destroyABufferBuffers(buffers);
  const pixelCount = width * height;
  const countsBytes = pixelCount * Uint32Array.BYTES_PER_ELEMENT;
  const fragmentsBytes =
    pixelCount * capacity * 2 * Uint32Array.BYTES_PER_ELEMENT;

  buffers.countsBuffer = device.createBuffer({
    size: countsBytes,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.COPY_SRC,
  });
  buffers.fragmentsBuffer = device.createBuffer({
    size: fragmentsBytes,
    usage: GPUBufferUsage.STORAGE,
  });
  buffers.width = width;
  buffers.height = height;
  buffers.capacity = capacity;
  buffers.zeroCountsData = new Uint32Array(pixelCount);
  return true;
}

/**
 * 生成右下角“当前实验”的动态文案。
 * @param {ABufferSettings} settings 当前课程控制参数。
 * @param {ABufferStats} stats 最近一轮 readback 结果。
 * @returns {string} 对应的说明文本。
 */
function createLegendCopy(
  settings: ABufferSettings,
  stats: ABufferStats
): string {
  if (
    stats.pendingReadback ||
    stats.maxLayers === null ||
    stats.overflowCount === null
  ) {
    return "左右两边都使用同一组玻璃薄板和同一提交顺序。左侧仍然只靠 alpha blend 直接混色，右侧则会先把每像素命中的透明片元记进列表，再在 present pass 里按深度重新组合。";
  }

  if (stats.overflowCount > 0) {
    return `当前最复杂的像素已经堆到 ${formatCount(stats.maxLayers)} 层透明片元，但每像素容量只有 ${formatCapacity(settings.capacity)}，所以右侧开始丢片元；把“每像素容量”拉高，或者把“交叠幅度”往回收一点，右侧就会重新稳定。`;
  }

  return `当前右侧最深处一共命中了 ${formatCount(stats.maxLayers)} 层透明片元，而每像素容量有 ${formatCapacity(settings.capacity)}，所以即便两边都按固定顺序 ${DRAW_ORDER_LABEL} 提交，右侧依旧能稳定恢复前后关系。`;
}

/**
 * 把 settings / stats 同步到 lesson HUD。
 * @param {ABufferHudRefs} refs HUD DOM 引用。
 * @param {ABufferSettings} settings 当前课程控制参数。
 * @param {ABufferStats} stats 最近一轮统计结果。
 * @returns {void} 只负责界面文案同步。
 */
function updateHud(
  refs: ABufferHudRefs,
  settings: ABufferSettings,
  stats: ABufferStats
): void {
  refs.orderBadge.textContent = `两边同一提交顺序 · ${DRAW_ORDER_LABEL}`;
  refs.modeBadge.textContent = `右侧简化 A-buffer · ${formatCapacity(settings.capacity)} / 像素`;

  refs.overflowBadge.className =
    stats.pendingReadback || stats.overflowCount === null
      ? "abuffer-badge"
      : stats.overflowCount > 0
        ? "abuffer-badge abuffer-badge--warn"
        : "abuffer-badge abuffer-badge--ok";
  refs.overflowBadge.textContent =
    stats.pendingReadback || stats.overflowCount === null
      ? "统计同步中"
      : stats.overflowCount > 0
        ? `发生溢出 · ${formatCount(stats.overflowCount)} 片元`
        : "当前无溢出 · 顺序可稳定恢复";

  refs.alphaOutput.textContent = formatAlpha(settings.alpha);
  refs.capacityOutput.textContent = formatCapacity(settings.capacity);
  refs.spreadOutput.textContent = formatSpread(settings.spread);
  refs.tiltOutput.textContent = formatTilt(settings.tilt);

  refs.orderValue.textContent = "4 片薄板";
  refs.orderMeta.textContent =
    `左侧仍按固定顺序 ${DRAW_ORDER_LABEL} 直接 blend；右侧也按同一顺序提交，但会在每个像素里重新排序。`;

  refs.activeValue.textContent =
    stats.activePixels === null ? "等待首轮" : `${formatCount(stats.activePixels)} px`;
  refs.activeMeta.textContent =
    "右侧真正收集到至少 1 个透明片元的像素数量。";

  refs.depthValue.textContent =
    stats.maxLayers === null ? "等待首轮" : `${formatCount(stats.maxLayers)} 层`;
  refs.depthMeta.textContent =
    `单个像素里遇到的最大透明层数；超过 ${formatCapacity(settings.capacity)} 就会开始丢片元。`;

  refs.overflowValue.textContent =
    stats.overflowCount === null ? "等待首轮" : formatCount(stats.overflowCount);
  refs.overflowMeta.textContent =
    stats.overflowCount === null
      ? "等待第一轮 readback，同步右侧每像素列表的真实压力。"
      : stats.overflowCount > 0
        ? `已有 ${formatCount(stats.storedFragments ?? 0)} 个片元被写进列表，但容量仍不够。`
        : "当前容量已经覆盖住这帧的全部透明层次。";

  refs.legendBody.textContent = createLegendCopy(settings, stats);
}

/**
 * 挂载第 46 课“A-Buffer 与顺序无关透明”，左侧展示固定顺序 alpha blend，右侧展示先收集后排序的简化 A-buffer。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源。
 */
export async function mountABufferAndOitLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--abuffer">
      <div class="abuffer-stage">
        <div class="abuffer-stage__badges">
          <span class="abuffer-badge" data-abuffer-badge="order"></span>
          <span class="abuffer-badge abuffer-badge--cool" data-abuffer-badge="mode"></span>
          <span class="abuffer-badge" data-abuffer-badge="overflow"></span>
        </div>

        <div class="abuffer-controls">
          <label class="abuffer-control">
            <span class="abuffer-control__row">
              <span class="abuffer-control__label">透明度</span>
              <span class="abuffer-control__value" data-abuffer-control-output="alpha"></span>
            </span>
            <input
              class="abuffer-control__range"
              data-abuffer-control="alpha"
              type="range"
              min="0.28"
              max="0.72"
              step="0.02"
              value="0.46"
            />
          </label>

          <label class="abuffer-control">
            <span class="abuffer-control__row">
              <span class="abuffer-control__label">每像素容量</span>
              <span class="abuffer-control__value" data-abuffer-control-output="capacity"></span>
            </span>
            <input
              class="abuffer-control__range"
              data-abuffer-control="capacity"
              type="range"
              min="2"
              max="${MAX_A_BUFFER_CAPACITY}"
              step="1"
              value="6"
            />
          </label>

          <label class="abuffer-control">
            <span class="abuffer-control__row">
              <span class="abuffer-control__label">交叠幅度</span>
              <span class="abuffer-control__value" data-abuffer-control-output="spread"></span>
            </span>
            <input
              class="abuffer-control__range"
              data-abuffer-control="spread"
              type="range"
              min="0.72"
              max="1.38"
              step="0.02"
              value="1.00"
            />
          </label>

          <label class="abuffer-control">
            <span class="abuffer-control__row">
              <span class="abuffer-control__label">倾斜强度</span>
              <span class="abuffer-control__value" data-abuffer-control-output="tilt"></span>
            </span>
            <input
              class="abuffer-control__range"
              data-abuffer-control="tilt"
              type="range"
              min="0.00"
              max="1.00"
              step="0.05"
              value="0.55"
            />
          </label>
        </div>

        <div class="abuffer-stage__labels">
          <div class="abuffer-panel-label abuffer-panel-label--left">
            <span class="abuffer-panel-label__eyebrow">Fixed Alpha Blend</span>
            <strong class="abuffer-panel-label__title">提交顺序不变，直接混色</strong>
          </div>
          <div class="abuffer-panel-label abuffer-panel-label--right">
            <span class="abuffer-panel-label__eyebrow">A-Buffer OIT</span>
            <strong class="abuffer-panel-label__title">先记片元，再按深度 resolve</strong>
          </div>
        </div>

        <div class="preview-frame abuffer-stage__frame">
          <canvas class="preview-canvas" aria-label="A-buffer and order-independent transparency lesson preview"></canvas>
        </div>

        <div class="abuffer-card-grid">
          <article class="abuffer-card">
            <p class="abuffer-card__label">左侧提交顺序</p>
            <strong class="abuffer-card__value" data-abuffer-card-value="order"></strong>
            <p class="abuffer-card__meta" data-abuffer-card-meta="order"></p>
          </article>

          <article class="abuffer-card abuffer-card--cool">
            <p class="abuffer-card__label">右侧活跃像素</p>
            <strong class="abuffer-card__value" data-abuffer-card-value="active"></strong>
            <p class="abuffer-card__meta" data-abuffer-card-meta="active"></p>
          </article>

          <article class="abuffer-card abuffer-card--accent">
            <p class="abuffer-card__label">单像素最大层数</p>
            <strong class="abuffer-card__value" data-abuffer-card-value="depth"></strong>
            <p class="abuffer-card__meta" data-abuffer-card-meta="depth"></p>
          </article>

          <article class="abuffer-card">
            <p class="abuffer-card__label">被丢弃的片元</p>
            <strong class="abuffer-card__value" data-abuffer-card-value="overflow"></strong>
            <p class="abuffer-card__meta" data-abuffer-card-meta="overflow"></p>
          </article>
        </div>

        <div class="abuffer-stage__legend">
          <p class="abuffer-stage__legend-title">当前实验</p>
          <p class="abuffer-stage__legend-body" data-abuffer-legend></p>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const viewport = host.querySelector<HTMLDivElement>(".preview-viewport");
  const alphaRange = host.querySelector<HTMLInputElement>('[data-abuffer-control="alpha"]');
  const capacityRange = host.querySelector<HTMLInputElement>(
    '[data-abuffer-control="capacity"]'
  );
  const spreadRange = host.querySelector<HTMLInputElement>('[data-abuffer-control="spread"]');
  const tiltRange = host.querySelector<HTMLInputElement>('[data-abuffer-control="tilt"]');

  if (
    !canvas ||
    !viewport ||
    !alphaRange ||
    !capacityRange ||
    !spreadRange ||
    !tiltRange
  ) {
    throw new Error("第 46 课的预览结构没有完整创建出来。");
  }

  const refs: ABufferHudRefs = {
    orderBadge: host.querySelector<HTMLElement>('[data-abuffer-badge="order"]')!,
    modeBadge: host.querySelector<HTMLElement>('[data-abuffer-badge="mode"]')!,
    overflowBadge: host.querySelector<HTMLElement>('[data-abuffer-badge="overflow"]')!,
    alphaOutput: host.querySelector<HTMLElement>('[data-abuffer-control-output="alpha"]')!,
    capacityOutput: host.querySelector<HTMLElement>('[data-abuffer-control-output="capacity"]')!,
    spreadOutput: host.querySelector<HTMLElement>('[data-abuffer-control-output="spread"]')!,
    tiltOutput: host.querySelector<HTMLElement>('[data-abuffer-control-output="tilt"]')!,
    orderValue: host.querySelector<HTMLElement>('[data-abuffer-card-value="order"]')!,
    orderMeta: host.querySelector<HTMLElement>('[data-abuffer-card-meta="order"]')!,
    activeValue: host.querySelector<HTMLElement>('[data-abuffer-card-value="active"]')!,
    activeMeta: host.querySelector<HTMLElement>('[data-abuffer-card-meta="active"]')!,
    depthValue: host.querySelector<HTMLElement>('[data-abuffer-card-value="depth"]')!,
    depthMeta: host.querySelector<HTMLElement>('[data-abuffer-card-meta="depth"]')!,
    overflowValue: host.querySelector<HTMLElement>('[data-abuffer-card-value="overflow"]')!,
    overflowMeta: host.querySelector<HTMLElement>('[data-abuffer-card-meta="overflow"]')!,
    legendBody: host.querySelector<HTMLElement>("[data-abuffer-legend]")!,
  };

  const settings: ABufferSettings = {
    alpha: Number.parseFloat(alphaRange.value),
    capacity: Number.parseInt(capacityRange.value, 10),
    spread: Number.parseFloat(spreadRange.value),
    tilt: Number.parseFloat(tiltRange.value),
  };

  const stats: ABufferStats = {
    activePixels: null,
    maxLayers: null,
    overflowCount: null,
    storedFragments: null,
    pendingReadback: true,
  };

  updateHud(refs, settings, stats);

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const geometry = createABufferLessonGeometry();
    const opaqueConfigs = createOpaqueSceneConfigs();

    const syncViewport = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const compactLayout = window.matchMedia("(max-width: 1180px)").matches;
      const aspect = compactLayout ? 1.02 : 1.24;

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

    const sceneShaderModule = gpu.device.createShaderModule({
      code: sceneVertexShaderSource,
    });
    const sceneFragmentModule = gpu.device.createShaderModule({
      code: sceneFragmentShaderSource,
    });
    const abufferFragmentModule = gpu.device.createShaderModule({
      code: abufferFragmentShaderSource,
    });
    const resolveShaderModule = gpu.device.createShaderModule({
      code: resolveShaderSource,
    });

    const sceneBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const gatherBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "storage" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "storage" },
        },
      ],
    });
    const objectBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const presentBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 5,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    const vertexState: GPUVertexState = {
      module: sceneShaderModule,
      entryPoint: "vsScene",
      buffers: [
        {
          arrayStride: 6 * 4,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x3" },
            { shaderLocation: 1, offset: 3 * 4, format: "float32x3" },
          ],
        },
      ],
    };

    const depthStencilState: GPUDepthStencilState = {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less-equal",
    };

    const opaquePipeline = gpu.device.createRenderPipeline({
      label: "lesson-46-opaque-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [sceneBindGroupLayout, objectBindGroupLayout],
      }),
      vertex: vertexState,
      fragment: {
        module: sceneFragmentModule,
        entryPoint: "fsOpaque",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: depthStencilState,
    });

    const blendPipeline = gpu.device.createRenderPipeline({
      label: "lesson-46-blend-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [sceneBindGroupLayout, objectBindGroupLayout],
      }),
      vertex: vertexState,
      fragment: {
        module: sceneFragmentModule,
        entryPoint: "fsTransparentBlend",
        targets: [
          {
            format: gpu.format,
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
        ...depthStencilState,
        depthWriteEnabled: false,
      },
    });

    const gatherPipeline = gpu.device.createRenderPipeline({
      label: "lesson-46-a-buffer-gather-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [gatherBindGroupLayout, objectBindGroupLayout],
      }),
      vertex: vertexState,
      fragment: {
        module: abufferFragmentModule,
        entryPoint: "fsGather",
        targets: [
          {
            format: gpu.format,
            writeMask: 0,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        ...depthStencilState,
        depthWriteEnabled: false,
      },
    });

    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-46-present-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [presentBindGroupLayout],
      }),
      vertex: {
        module: resolveShaderModule,
        entryPoint: "vsFullscreen",
      },
      fragment: {
        module: resolveShaderModule,
        entryPoint: "fsPresent",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const sceneUniformBuffer = gpu.device.createBuffer({
      size: SCENE_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const sceneBindGroup = gpu.device.createBindGroup({
      layout: sceneBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: sceneUniformBuffer },
        },
      ],
    });

    const statsBuffer = gpu.device.createBuffer({
      size: STATS_BUFFER_BYTES,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
    const statsReadbackBuffer = gpu.device.createBuffer({
      size: STATS_BUFFER_BYTES,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const zeroStatsData = new Uint32Array(4);

    const linearSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    const createRenderObject = (): RenderObject => {
      const uniformBuffer = gpu.device.createBuffer({
        size: OBJECT_UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      return {
        uniformBuffer,
        bindGroup: gpu.device.createBindGroup({
          layout: objectBindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: { buffer: uniformBuffer },
            },
          ],
        }),
      };
    };

    const opaqueObjects = opaqueConfigs.map(() => createRenderObject());
    const transparentObjects = TRANSPARENT_PANES.map(() => createRenderObject());

    const leftColorTarget: ColorTarget = {
      texture: null,
      view: null,
      width: 0,
      height: 0,
    };
    const rightColorTarget: ColorTarget = {
      texture: null,
      view: null,
      width: 0,
      height: 0,
    };
    const leftDepthTarget: DepthTarget = {
      texture: null,
      view: null,
      width: 0,
      height: 0,
    };
    const rightDepthTarget: DepthTarget = {
      texture: null,
      view: null,
      width: 0,
      height: 0,
    };
    const abufferBuffers: ABufferBuffers = {
      countsBuffer: null,
      fragmentsBuffer: null,
      width: 0,
      height: 0,
      capacity: 0,
      zeroCountsData: new Uint32Array(0),
    };

    let gatherBindGroup: GPUBindGroup | null = null;
    let presentBindGroup: GPUBindGroup | null = null;
    let pendingStatsReadback = false;
    let lastReadbackTime = -READBACK_INTERVAL_MS;
    let animationFrameId = 0;
    let disposed = false;

    const rebuildTransientBindGroups = () => {
      if (
        !leftColorTarget.view ||
        !rightColorTarget.view ||
        !abufferBuffers.countsBuffer ||
        !abufferBuffers.fragmentsBuffer
      ) {
        return;
      }

      gatherBindGroup = gpu.device.createBindGroup({
        layout: gatherBindGroupLayout,
        entries: [
          { binding: 0, resource: { buffer: sceneUniformBuffer } },
          { binding: 1, resource: { buffer: abufferBuffers.countsBuffer } },
          { binding: 2, resource: { buffer: abufferBuffers.fragmentsBuffer } },
          { binding: 3, resource: { buffer: statsBuffer } },
        ],
      });

      presentBindGroup = gpu.device.createBindGroup({
        layout: presentBindGroupLayout,
        entries: [
          { binding: 0, resource: linearSampler },
          { binding: 1, resource: leftColorTarget.view },
          { binding: 2, resource: rightColorTarget.view },
          { binding: 3, resource: { buffer: sceneUniformBuffer } },
          { binding: 4, resource: { buffer: abufferBuffers.countsBuffer } },
          { binding: 5, resource: { buffer: abufferBuffers.fragmentsBuffer } },
        ],
      });
    };

    const orbit = createOrbitCameraController(canvas, {
      target: [0, 0, 0],
      eye: [5.8, 3.1, 5.4],
      minRadius: 3.2,
      maxRadius: 10.8,
      rotateSpeed: 0.0095,
      zoomSpeed: 0.01,
    });

    const drawObjects = (
      pass: GPURenderPassEncoder,
      objects: RenderObject[]
    ) => {
      for (const object of objects) {
        pass.setBindGroup(1, object.bindGroup);
        pass.drawIndexed(geometry.indexCount);
      }
    };

    const updateObjectUniforms = () => {
      opaqueConfigs.forEach((config, index) => {
        const modelMatrix = createModelMatrix(config);
        const uniformData = createObjectUniformData(modelMatrix, config.color);
        gpu.device.queue.writeBuffer(
          opaqueObjects[index].uniformBuffer,
          0,
          uniformData
        );
      });

      const transparentConfigs = createTransparentConfigs(settings);
      transparentConfigs.forEach((config, index) => {
        const modelMatrix = createModelMatrix(config);
        const uniformData = createObjectUniformData(modelMatrix, config.color);
        gpu.device.queue.writeBuffer(
          transparentObjects[index].uniformBuffer,
          0,
          uniformData
        );
      });
    };

    const scheduleStatsReadback = () => {
      if (pendingStatsReadback) {
        return;
      }

      pendingStatsReadback = true;
      stats.pendingReadback = true;
      statsReadbackBuffer
        .mapAsync(GPUMapMode.READ)
        .then(() => {
          if (disposed) {
            if (statsReadbackBuffer.mapState === "mapped") {
              statsReadbackBuffer.unmap();
            }
            return;
          }

          const view = new Uint32Array(statsReadbackBuffer.getMappedRange());
          stats.activePixels = view[0];
          stats.maxLayers = view[1];
          stats.overflowCount = view[2];
          stats.storedFragments = view[3];
          stats.pendingReadback = false;
          pendingStatsReadback = false;
          statsReadbackBuffer.unmap();
          updateHud(refs, settings, stats);
        })
        .catch(() => {
          pendingStatsReadback = false;
          stats.pendingReadback = false;
          if (statsReadbackBuffer.mapState === "mapped") {
            statsReadbackBuffer.unmap();
          }
          updateHud(refs, settings, stats);
        });
    };

    const renderFrame = (timeMs: number) => {
      if (disposed) {
        return;
      }

      syncViewport();
      gpu.resize();

      const panelWidth = Math.max(1, Math.floor(canvas.width * 0.5));
      const panelHeight = Math.max(1, canvas.height);

      const colorChanged =
        ensureColorTarget(leftColorTarget, gpu.device, gpu.format, panelWidth, panelHeight) ||
        ensureColorTarget(rightColorTarget, gpu.device, gpu.format, panelWidth, panelHeight);
      const depthChanged =
        ensureDepthTarget(leftDepthTarget, gpu.device, panelWidth, panelHeight) ||
        ensureDepthTarget(rightDepthTarget, gpu.device, panelWidth, panelHeight);
      const abufferChanged = ensureABufferBuffers(
        abufferBuffers,
        gpu.device,
        panelWidth,
        panelHeight,
        settings.capacity
      );

      if (colorChanged || depthChanged || abufferChanged || !gatherBindGroup || !presentBindGroup) {
        rebuildTransientBindGroups();
      }

      if (
        !leftColorTarget.view ||
        !rightColorTarget.view ||
        !leftDepthTarget.view ||
        !rightDepthTarget.view ||
        !abufferBuffers.countsBuffer ||
        !gatherBindGroup ||
        !presentBindGroup
      ) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
        return;
      }

      updateObjectUniforms();

      const camera = orbit.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        CAMERA_FOV,
        panelWidth / panelHeight,
        CAMERA_NEAR,
        CAMERA_FAR
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const sceneUniformData = createSceneUniformData(
        viewProjectionMatrix,
        camera.eye,
        panelWidth,
        panelHeight,
        settings.capacity
      );
      gpu.device.queue.writeBuffer(sceneUniformBuffer, 0, sceneUniformData);
      gpu.device.queue.writeBuffer(abufferBuffers.countsBuffer, 0, abufferBuffers.zeroCountsData);
      gpu.device.queue.writeBuffer(statsBuffer, 0, zeroStatsData);

      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-46-command-encoder",
      });

      const leftPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: leftColorTarget.view,
            clearValue: CLEAR_COLOR,
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: leftDepthTarget.view,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      leftPass.setVertexBuffer(0, vertexBuffer);
      leftPass.setIndexBuffer(indexBuffer, "uint16");
      leftPass.setBindGroup(0, sceneBindGroup);
      leftPass.setPipeline(opaquePipeline);
      drawObjects(leftPass, opaqueObjects);
      leftPass.setPipeline(blendPipeline);
      drawObjects(leftPass, transparentObjects);
      leftPass.end();

      const rightPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: rightColorTarget.view,
            clearValue: CLEAR_COLOR,
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: rightDepthTarget.view,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      rightPass.setVertexBuffer(0, vertexBuffer);
      rightPass.setIndexBuffer(indexBuffer, "uint16");
      rightPass.setBindGroup(0, sceneBindGroup);
      rightPass.setPipeline(opaquePipeline);
      drawObjects(rightPass, opaqueObjects);
      rightPass.setPipeline(gatherPipeline);
      rightPass.setBindGroup(0, gatherBindGroup);
      drawObjects(rightPass, transparentObjects);
      rightPass.end();

      let shouldReadback = false;
      if (!pendingStatsReadback && timeMs - lastReadbackTime >= READBACK_INTERVAL_MS) {
        encoder.copyBufferToBuffer(
          statsBuffer,
          0,
          statsReadbackBuffer,
          0,
          STATS_BUFFER_BYTES
        );
        shouldReadback = true;
        lastReadbackTime = timeMs;
      }

      const presentPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: CLEAR_COLOR,
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      presentPass.setPipeline(presentPipeline);
      presentPass.setBindGroup(0, presentBindGroup);
      presentPass.draw(3);
      presentPass.end();

      gpu.device.queue.submit([encoder.finish()]);

      if (shouldReadback) {
        updateHud(refs, settings, stats);
        scheduleStatsReadback();
      }

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const bindRange = (
      input: HTMLInputElement,
      assign: (value: number) => void,
      parser: (value: string) => number
    ) => {
      const onInput = () => {
        assign(parser(input.value));
        updateHud(refs, settings, stats);
      };

      input.addEventListener("input", onInput);
      return () => {
        input.removeEventListener("input", onInput);
      };
    };

    const disposeAlpha = bindRange(alphaRange, (value) => {
      settings.alpha = value;
    }, Number.parseFloat);
    const disposeCapacity = bindRange(capacityRange, (value) => {
      settings.capacity = value;
    }, (value) => Number.parseInt(value, 10));
    const disposeSpread = bindRange(spreadRange, (value) => {
      settings.spread = value;
    }, Number.parseFloat);
    const disposeTilt = bindRange(tiltRange, (value) => {
      settings.tilt = value;
    }, Number.parseFloat);

    setStatus({
      title: "A-Buffer 与顺序无关透明已运行",
      detail:
        "左侧仍是最普通的固定顺序 alpha blend；右侧则把透明片元先写进每像素列表，再在 present pass 里按深度 resolve。重点不是“排序更勤快”，而是“尽量摆脱对象提交顺序”。",
      tone: "ok",
    });

    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
      disposeAlpha();
      disposeCapacity();
      disposeSpread();
      disposeTilt();
      orbit.dispose();

      if (statsReadbackBuffer.mapState === "mapped") {
        statsReadbackBuffer.unmap();
      }

      destroyColorTarget(leftColorTarget);
      destroyColorTarget(rightColorTarget);
      destroyDepthTarget(leftDepthTarget);
      destroyDepthTarget(rightDepthTarget);
      destroyABufferBuffers(abufferBuffers);

      vertexBuffer.destroy();
      indexBuffer.destroy();
      sceneUniformBuffer.destroy();
      statsBuffer.destroy();
      statsReadbackBuffer.destroy();

      opaqueObjects.forEach((object) => object.uniformBuffer.destroy());
      transparentObjects.forEach((object) => object.uniformBuffer.destroy());
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
