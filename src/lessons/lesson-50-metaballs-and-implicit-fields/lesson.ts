import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import {
  FIELD_EXTENT,
  IMPLICIT_METABALL_COUNT,
  SLICE_DEPTH_LIMIT,
  createMetaballFieldData,
  sampleMetaballFieldMetrics,
  type MetaballFieldMetrics,
  type MetaballFieldSettings,
} from "@/lessons/lesson-50-metaballs-and-implicit-fields/field";
import {
  createImplicitFieldLessonGeometry,
  type GeometryMesh,
} from "@/lessons/lesson-50-metaballs-and-implicit-fields/geometry";
import {
  createLookAtViewMatrix,
  createOrthographicMatrix,
  createPerspectiveMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-50-metaballs-and-implicit-fields/math";
import sceneFragmentShaderSource from "@/lessons/lesson-50-metaballs-and-implicit-fields/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-50-metaballs-and-implicit-fields/scene.vert.wgsl?raw";

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

type ImplicitFieldLayoutMode = "split" | "stacked";

type ImplicitFieldPanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImplicitFieldViewportKey = "slice" | "field";

type ImplicitFieldViewport = {
  key: ImplicitFieldViewportKey;
  sceneUniformBuffer: GPUBuffer;
  sceneBindGroup: GPUBindGroup;
};

type ImplicitFieldHudRefs = {
  fieldBadge: HTMLElement;
  isoBadge: HTMLElement;
  shellBadge: HTMLElement;
  sliceOutput: HTMLElement;
  isoOutput: HTMLElement;
  gainOutput: HTMLElement;
  orbitOutput: HTMLElement;
  speedOutput: HTMLElement;
  peakValue: HTMLElement;
  peakMeta: HTMLElement;
  occupiedValue: HTMLElement;
  occupiedMeta: HTMLElement;
  coverageValue: HTMLElement;
  coverageMeta: HTMLElement;
  metaballValue: HTMLElement;
  metaballMeta: HTMLElement;
  legendBody: HTMLElement;
  stageFrame: HTMLElement;
};

type ImplicitFieldMetricState = MetaballFieldMetrics & {
  sliceDepth: number;
  isoLevel: number;
  fieldGain: number;
  orbitRadius: number;
  animationSpeed: number;
  layout: ImplicitFieldLayoutMode;
};

const PANEL_GAP_PX = 24;
const HUD_UPDATE_INTERVAL_MS = 180;
const ORTHO_EYE: Vector3 = [0, 0, 4.5];
const ORTHO_TARGET: Vector3 = [0, 0, 0];
const FIELD_CAMERA_TARGET: Vector3 = [0, 0, 0];
const FIELD_CUBE_COLOR: Color4 = [0.30, 0.86, 1.0, 0.78];
const SLICE_COLOR: Color4 = [0.24, 0.86, 1.0, 0.9];

/**
 * 把 0-1 比例格式化成更适合 HUD 的百分比。
 * @param {number} value 当前比例值。
 * @returns {string} 对应的百分比文本。
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(value >= 0.1 ? 0 : 1)}%`;
}

/**
 * 把普通数值格式化成固定两位小数。
 * @param {number} value 当前数值。
 * @returns {string} 对应的 HUD 文本。
 */
function formatFixed(value: number): string {
  return value.toFixed(2);
}

/**
 * 把切片深度格式化成带符号的 z 文本。
 * @param {number} value 当前切片深度。
 * @returns {string} 对应的深度字符串。
 */
function formatSliceDepth(value: number): string {
  return `z = ${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

/**
 * 生成一份场景 uniform 数据，包含 VP、眼睛位置和点光源位置。
 * @param {Float32Array} viewProjectionMatrix 当前面板的 VP 矩阵。
 * @param {Vector3} eyePosition 当前相机位置。
 * @param {Vector3} lightPosition 当前点光源位置。
 * @returns {Float32Array} 可直接写入 GPU uniform buffer 的数据。
 */
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

/**
 * 生成对象级 uniform 数据，里面放模型矩阵、颜色和表面参数。
 * @param {Float32Array} modelMatrix 当前对象模型矩阵。
 * @param {Color4} color 当前对象颜色。
 * @param {0 | 1} surfaceMode 是否使用地板网格细节。
 * @param {number} detailScale 当前网格细节密度。
 * @returns {Float32Array} 对应的对象 uniform 数据。
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
 * 生成隐式场 uniform 数据，供 slice/field fragment 共同读取。
 * @param {Float32Array} metaballs 当前四个 metaball 的中心与半径。
 * @param {MetaballFieldSettings} settings 当前 lesson 控制参数。
 * @returns {Float32Array} 对应的隐式场 uniform 数据。
 */
function createFieldUniformData(
  metaballs: Float32Array,
  settings: MetaballFieldSettings
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(metaballs, 0);
  uniformData.set(
    [settings.isoLevel, settings.fieldGain, settings.sliceDepth, 0],
    16
  );
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
 * 生成第 47 课的静态场景物体：底座、地板和体盒边框。
 * @returns {{ base: SceneObjectConfig[]; frame: SceneObjectConfig[] }} 基础物体与边框物体。
 */
function createImplicitFieldSceneConfigs(): {
  base: SceneObjectConfig[];
  frame: SceneObjectConfig[];
} {
  const base: SceneObjectConfig[] = [
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
      scale: [1.84, 0.22, 1.84],
      color: [0.18, 0.22, 0.29, 1],
      surfaceMode: 1,
      detailScale: 7.0,
    },
  ];

  const frame: SceneObjectConfig[] = [];
  const frameColor: Color4 = [0.30, 0.80, 1.0, 1];
  const accentColor: Color4 = [1.0, 0.71, 0.32, 1];
  const frameExtent = FIELD_EXTENT * 1.04;
  const frameHalfLength = FIELD_EXTENT * 1.08;
  const frameThickness = 0.055;

  for (const x of [-frameExtent, frameExtent] as const) {
    for (const y of [-frameExtent, frameExtent] as const) {
      frame.push({
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
      frame.push({
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
      frame.push({
        label: `edge-x-${y}-${z}`,
        translation: [0, y, z],
        scale: [frameHalfLength, frameThickness, frameThickness],
        color: frameColor,
        surfaceMode: 0,
        detailScale: 0,
      });
    }
  }

  return { base, frame };
}

/**
 * 生成右侧空间视图里那张切片平面的模型矩阵。
 * @param {number} sliceDepth 当前切片深度。
 * @returns {Float32Array} 对应的模型矩阵。
 */
function createContextSliceModelMatrix(sliceDepth: number): Float32Array {
  return multiplyMatrices(
    createTranslationMatrix(0, 0, sliceDepth),
    createScaleMatrix(0.96, 0.96, 0.012)
  );
}

/**
 * 根据当前设置和场占比，生成右下角的说明文案。
 * @param {ImplicitFieldMetricState} metrics 当前 lesson 指标状态。
 * @returns {string} 对应的总结文案。
 */
function createLegendCopy(metrics: ImplicitFieldMetricState): string {
  if (Math.abs(metrics.sliceDepth) >= 0.58) {
    return `当前切片已经靠近体盒前后边缘，所以左侧二维切片会只剩一圈较薄的外壳；右侧也会更强调“等值面只是某个阈值”，并不是先天存在的一张固定网格。`;
  }

  if (metrics.fieldGain >= 1.18 || metrics.isoLevel <= 0.72) {
    return `现在的场更强、阈值更松，多团势场会更早粘连成一块。左侧是在看“二维密度分布怎样跨过 iso 阈值”，右侧则是在 shader 里直接沿视线寻找第一次跨过阈值的位置。`;
  }

  if (metrics.orbitRadius >= 0.68) {
    return `球心轨道已经拉得更开，所以你会更容易看到“合并”和“分裂”之间的临界状态。这里最关键的是：真正被定义的是整块空间里的标量场，表面只是“值等于 ${formatFixed(metrics.isoLevel)}”的那一层壳。`;
  }

  return `左侧切片只回答“这一层的标量场长什么样”，右侧则把同一份隐式场直接当成连续体来找等值壳层。它看起来像流体，但此时还没有三角网格；下一课才会把这层壳真正提取成 mesh。`;
}

/**
 * 根据当前状态刷新 badges、控制输出和指标卡。
 * @param {ImplicitFieldHudRefs} refs 当前 lesson 的 DOM 引用。
 * @param {ImplicitFieldMetricState} metrics 当前 lesson 指标状态。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(
  refs: ImplicitFieldHudRefs,
  metrics: ImplicitFieldMetricState
): void {
  refs.fieldBadge.textContent = `implicit field · ${IMPLICIT_METABALL_COUNT} 个 metaballs`;
  refs.fieldBadge.className = "implicit-field-badge implicit-field-badge--cool";

  refs.isoBadge.textContent = `iso ${formatFixed(metrics.isoLevel)} · gain ${formatFixed(
    metrics.fieldGain
  )}`;
  refs.isoBadge.className =
    metrics.fieldGain >= 1.18 || metrics.isoLevel <= 0.72
      ? "implicit-field-badge implicit-field-badge--accent"
      : "implicit-field-badge";

  refs.shellBadge.textContent = "右侧仍不是 mesh · 只是 shader 命中等值壳层";
  refs.shellBadge.className = "implicit-field-badge implicit-field-badge--ok";

  refs.sliceOutput.textContent = formatSliceDepth(metrics.sliceDepth);
  refs.isoOutput.textContent = formatFixed(metrics.isoLevel);
  refs.gainOutput.textContent = `${formatFixed(metrics.fieldGain)}x`;
  refs.orbitOutput.textContent = formatFixed(metrics.orbitRadius);
  refs.speedOutput.textContent = `${formatFixed(metrics.animationSpeed)}x`;

  refs.peakValue.textContent = formatFixed(metrics.peakField);
  refs.peakMeta.textContent =
    "这是当前四个 metaball 叠加后，在粗采样网格里测到的最高场值；iso 越接近它，壳层就越薄。";

  refs.occupiedValue.textContent = formatPercent(metrics.occupiedRatio);
  refs.occupiedMeta.textContent =
    `粗采样空间里，大约有这么多位置已经跨过 iso ${formatFixed(
      metrics.isoLevel
    )}；它描述的是整块体积，而不是某一层切片。`;

  refs.coverageValue.textContent = formatPercent(metrics.sliceCoverage);
  refs.coverageMeta.textContent =
    `${formatSliceDepth(metrics.sliceDepth)} 这一层里，大约只有这么多二维采样点真正落在等值面内部；左侧画面的亮色区域就是它的直接投影。`;

  refs.metaballValue.textContent = `${metrics.metaballCount} 个`;
  refs.metaballMeta.textContent =
    `球心轨道 ${formatFixed(metrics.orbitRadius)}，动画速度 ${formatFixed(
      metrics.animationSpeed
    )}x。它们只负责定义势场，真正表面仍要等到下一课再提成三角网格。`;

  refs.legendBody.textContent = createLegendCopy(metrics);
  refs.stageFrame.classList.toggle(
    "implicit-field-stage__frame--stacked",
    metrics.layout === "stacked"
  );
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
 * 根据当前 CSS 宽度，决定 lesson 使用左右对照还是上下堆叠布局。
 * @param {number} width 当前画布 CSS 宽度。
 * @returns {ImplicitFieldLayoutMode} 对应的布局模式。
 */
function chooseLayoutMode(width: number): ImplicitFieldLayoutMode {
  return width < 720 ? "stacked" : "split";
}

/**
 * 按当前布局模式，把画布拆成两个视口。
 * @param {number} width 当前画布像素宽度。
 * @param {number} height 当前画布像素高度。
 * @param {ImplicitFieldLayoutMode} layout 当前布局模式。
 * @returns {{ slice: ImplicitFieldPanelRect; field: ImplicitFieldPanelRect }} 左右两个面板矩形。
 */
function createImplicitFieldPanelRects(
  width: number,
  height: number,
  layout: ImplicitFieldLayoutMode
): { slice: ImplicitFieldPanelRect; field: ImplicitFieldPanelRect } {
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
      field: {
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
    field: {
      x: rightX,
      y: 0,
      width: Math.max(1, width - rightX),
      height,
    },
  };
}

/**
 * 按给定对象配置创建一组静态渲染对象。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPUBindGroupLayout} layout 当前对象 bind group layout。
 * @param {SceneObjectConfig[]} configs 需要实例化的对象配置。
 * @returns {RenderObject[]} 对应的渲染对象数组。
 */
function createRenderObjects(
  device: GPUDevice,
  layout: GPUBindGroupLayout,
  configs: SceneObjectConfig[]
): RenderObject[] {
  return configs.map((config) => {
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

    return {
      uniformBuffer,
      bindGroup: device.createBindGroup({
        layout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      }),
    };
  });
}

/**
 * 为当前 lesson 创建一个视口状态对象。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPUBindGroupLayout} sceneBindGroupLayout 场景 uniform 的 bind group layout。
 * @param {ImplicitFieldViewportKey} key 当前视口的身份。
 * @returns {ImplicitFieldViewport} 对应的视口状态。
 */
function createViewport(
  device: GPUDevice,
  sceneBindGroupLayout: GPUBindGroupLayout,
  key: ImplicitFieldViewportKey
): ImplicitFieldViewport {
  const sceneUniformBuffer = device.createBuffer({
    size: 24 * 4,
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
}

/**
 * 把一块几何网格写进 GPU vertex / index buffer。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GeometryMesh} mesh 需要上传的几何网格。
 * @returns {{ vertexBuffer: GPUBuffer; indexBuffer: GPUBuffer }} 对应的 GPU 缓冲。
 */
function createMeshBuffers(
  device: GPUDevice,
  mesh: GeometryMesh
): {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
} {
  const vertexBuffer = device.createBuffer({
    size: mesh.vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, mesh.vertexData);

  const indexBuffer = device.createBuffer({
    size: mesh.indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, mesh.indexData);

  return {
    vertexBuffer,
    indexBuffer,
  };
}

/**
 * 挂载第 47 课“Metaballs 与隐式场”，
 * 左边看二维切片，右边看 shader 直接命中的等值壳层，为 marching cubes 做前置铺垫。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听和 GPU 资源。
 */
export async function mountMetaballsAndImplicitFieldsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<(() => void) | void> {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--implicit-field">
      <div class="preview-frame">
        <section class="implicit-field-stage">
          <div class="implicit-field-stage__badges">
            <span class="implicit-field-badge" data-implicit-field-badge="field"></span>
            <span class="implicit-field-badge" data-implicit-field-badge="iso"></span>
            <span class="implicit-field-badge" data-implicit-field-badge="shell"></span>
          </div>

          <div class="implicit-field-controls">
            <label class="implicit-field-control">
              <span class="implicit-field-control__row">
                <span class="implicit-field-control__label">切片深度</span>
                <span class="implicit-field-control__value" data-implicit-field-output="slice"></span>
              </span>
              <input
                class="implicit-field-control__range"
                data-implicit-field-control="slice"
                type="range"
                min="-0.82"
                max="0.82"
                step="0.01"
                value="0.00"
              />
            </label>

            <label class="implicit-field-control">
              <span class="implicit-field-control__row">
                <span class="implicit-field-control__label">等值面阈值</span>
                <span class="implicit-field-control__value" data-implicit-field-output="iso"></span>
              </span>
              <input
                class="implicit-field-control__range"
                data-implicit-field-control="iso"
                type="range"
                min="0.62"
                max="0.96"
                step="0.01"
                value="0.74"
              />
            </label>

            <label class="implicit-field-control">
              <span class="implicit-field-control__row">
                <span class="implicit-field-control__label">势场强度</span>
                <span class="implicit-field-control__value" data-implicit-field-output="gain"></span>
              </span>
              <input
                class="implicit-field-control__range"
                data-implicit-field-control="gain"
                type="range"
                min="0.84"
                max="1.28"
                step="0.01"
                value="1.02"
              />
            </label>

            <label class="implicit-field-control">
              <span class="implicit-field-control__row">
                <span class="implicit-field-control__label">球心轨道</span>
                <span class="implicit-field-control__value" data-implicit-field-output="orbit"></span>
              </span>
              <input
                class="implicit-field-control__range"
                data-implicit-field-control="orbit"
                type="range"
                min="0.42"
                max="0.80"
                step="0.01"
                value="0.58"
              />
            </label>

            <label class="implicit-field-control">
              <span class="implicit-field-control__row">
                <span class="implicit-field-control__label">动画速度</span>
                <span class="implicit-field-control__value" data-implicit-field-output="speed"></span>
              </span>
              <input
                class="implicit-field-control__range"
                data-implicit-field-control="speed"
                type="range"
                min="0.35"
                max="1.85"
                step="0.05"
                value="1.00"
              />
            </label>
          </div>

          <div class="implicit-field-stage__labels">
            <article class="implicit-field-panel-label implicit-field-panel-label--slice">
              <p class="implicit-field-panel-label__eyebrow">Slice View</p>
              <h3 class="implicit-field-panel-label__title">左侧只看 XY 切片里这一层的标量场</h3>
            </article>

            <article class="implicit-field-panel-label implicit-field-panel-label--field">
              <p class="implicit-field-panel-label__eyebrow">Implicit Shell</p>
              <h3 class="implicit-field-panel-label__title">右侧沿视线直接命中 iso 壳层，还不是 mesh</h3>
            </article>
          </div>

          <div class="implicit-field-stage__frame" data-implicit-field-frame>
            <canvas class="implicit-field-stage__canvas" data-implicit-field-canvas></canvas>
            <div class="implicit-field-divider"></div>
          </div>

          <div class="implicit-field-card-grid">
            <article class="implicit-field-card implicit-field-card--cool">
              <p class="implicit-field-card__label">峰值场强</p>
              <strong class="implicit-field-card__value" data-implicit-field-card-value="peak"></strong>
              <p class="implicit-field-card__meta" data-implicit-field-card-meta="peak"></p>
            </article>

            <article class="implicit-field-card implicit-field-card--accent">
              <p class="implicit-field-card__label">等值面占体比</p>
              <strong class="implicit-field-card__value" data-implicit-field-card-value="occupied"></strong>
              <p class="implicit-field-card__meta" data-implicit-field-card-meta="occupied"></p>
            </article>

            <article class="implicit-field-card implicit-field-card--ok">
              <p class="implicit-field-card__label">当前切片覆盖率</p>
              <strong class="implicit-field-card__value" data-implicit-field-card-value="coverage"></strong>
              <p class="implicit-field-card__meta" data-implicit-field-card-meta="coverage"></p>
            </article>

            <article class="implicit-field-card">
              <p class="implicit-field-card__label">Metaballs 数量</p>
              <strong class="implicit-field-card__value" data-implicit-field-card-value="balls"></strong>
              <p class="implicit-field-card__meta" data-implicit-field-card-meta="balls"></p>
            </article>
          </div>

          <article class="implicit-field-stage__legend">
            <p class="implicit-field-stage__legend-title">当前实验</p>
            <p class="implicit-field-stage__legend-body" data-implicit-field-legend></p>
          </article>
        </section>
      </div>
    </div>
  `;

  const fieldBadge = host.querySelector<HTMLElement>(
    '[data-implicit-field-badge="field"]'
  );
  const isoBadge = host.querySelector<HTMLElement>(
    '[data-implicit-field-badge="iso"]'
  );
  const shellBadge = host.querySelector<HTMLElement>(
    '[data-implicit-field-badge="shell"]'
  );
  const sliceOutput = host.querySelector<HTMLElement>(
    '[data-implicit-field-output="slice"]'
  );
  const isoOutput = host.querySelector<HTMLElement>(
    '[data-implicit-field-output="iso"]'
  );
  const gainOutput = host.querySelector<HTMLElement>(
    '[data-implicit-field-output="gain"]'
  );
  const orbitOutput = host.querySelector<HTMLElement>(
    '[data-implicit-field-output="orbit"]'
  );
  const speedOutput = host.querySelector<HTMLElement>(
    '[data-implicit-field-output="speed"]'
  );
  const peakValue = host.querySelector<HTMLElement>(
    '[data-implicit-field-card-value="peak"]'
  );
  const peakMeta = host.querySelector<HTMLElement>(
    '[data-implicit-field-card-meta="peak"]'
  );
  const occupiedValue = host.querySelector<HTMLElement>(
    '[data-implicit-field-card-value="occupied"]'
  );
  const occupiedMeta = host.querySelector<HTMLElement>(
    '[data-implicit-field-card-meta="occupied"]'
  );
  const coverageValue = host.querySelector<HTMLElement>(
    '[data-implicit-field-card-value="coverage"]'
  );
  const coverageMeta = host.querySelector<HTMLElement>(
    '[data-implicit-field-card-meta="coverage"]'
  );
  const metaballValue = host.querySelector<HTMLElement>(
    '[data-implicit-field-card-value="balls"]'
  );
  const metaballMeta = host.querySelector<HTMLElement>(
    '[data-implicit-field-card-meta="balls"]'
  );
  const legendBody = host.querySelector<HTMLElement>("[data-implicit-field-legend]");
  const stageFrame = host.querySelector<HTMLElement>("[data-implicit-field-frame]");
  const canvas = host.querySelector<HTMLCanvasElement>("[data-implicit-field-canvas]");
  const sliceRange = host.querySelector<HTMLInputElement>(
    '[data-implicit-field-control="slice"]'
  );
  const isoRange = host.querySelector<HTMLInputElement>(
    '[data-implicit-field-control="iso"]'
  );
  const gainRange = host.querySelector<HTMLInputElement>(
    '[data-implicit-field-control="gain"]'
  );
  const orbitRange = host.querySelector<HTMLInputElement>(
    '[data-implicit-field-control="orbit"]'
  );
  const speedRange = host.querySelector<HTMLInputElement>(
    '[data-implicit-field-control="speed"]'
  );

  if (
    !fieldBadge ||
    !isoBadge ||
    !shellBadge ||
    !sliceOutput ||
    !isoOutput ||
    !gainOutput ||
    !orbitOutput ||
    !speedOutput ||
    !peakValue ||
    !peakMeta ||
    !occupiedValue ||
    !occupiedMeta ||
    !coverageValue ||
    !coverageMeta ||
    !metaballValue ||
    !metaballMeta ||
    !legendBody ||
    !stageFrame ||
    !canvas ||
    !sliceRange ||
    !isoRange ||
    !gainRange ||
    !orbitRange ||
    !speedRange
  ) {
    setStatus({
      title: "预览不可用",
      detail: "第 47 课的 DOM 结构没有完整挂载出来。",
      tone: "warn",
    });
    return;
  }

  const refs: ImplicitFieldHudRefs = {
    fieldBadge,
    isoBadge,
    shellBadge,
    sliceOutput,
    isoOutput,
    gainOutput,
    orbitOutput,
    speedOutput,
    peakValue,
    peakMeta,
    occupiedValue,
    occupiedMeta,
    coverageValue,
    coverageMeta,
    metaballValue,
    metaballMeta,
    legendBody,
    stageFrame,
  };

  const settings: MetaballFieldSettings = {
    sliceDepth: Number.parseFloat(sliceRange.value),
    isoLevel: Number.parseFloat(isoRange.value),
    fieldGain: Number.parseFloat(gainRange.value),
    orbitRadius: Number.parseFloat(orbitRange.value),
    animationSpeed: Number.parseFloat(speedRange.value),
  };

  const metrics: ImplicitFieldMetricState = {
    peakField: 0,
    occupiedRatio: 0,
    sliceCoverage: 0,
    metaballCount: IMPLICIT_METABALL_COUNT,
    sliceDepth: settings.sliceDepth,
    isoLevel: settings.isoLevel,
    fieldGain: settings.fieldGain,
    orbitRadius: settings.orbitRadius,
    animationSpeed: settings.animationSpeed,
    layout: chooseLayoutMode(canvas.clientWidth),
  };

  {
    const sampledMetrics = sampleMetaballFieldMetrics(settings, 0);
    metrics.peakField = sampledMetrics.peakField;
    metrics.occupiedRatio = sampledMetrics.occupiedRatio;
    metrics.sliceCoverage = sampledMetrics.sliceCoverage;
  }

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
    const canvasRuntime = await createWebGpuCanvas(canvas);
    const { device, context, format } = canvasRuntime;
    const geometry = createImplicitFieldLessonGeometry();
    const { base: baseConfigs, frame: frameConfigs } =
      createImplicitFieldSceneConfigs();

    const cubeBuffers = createMeshBuffers(device, geometry.cube);
    const planeBuffers = createMeshBuffers(device, geometry.plane);

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

    const fieldBindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const staticPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [sceneBindGroupLayout, objectBindGroupLayout],
    });

    const fieldPipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [
        sceneBindGroupLayout,
        objectBindGroupLayout,
        fieldBindGroupLayout,
      ],
    });

    const vertexModule = device.createShaderModule({
      code: sceneVertexShaderSource,
    });
    const fragmentModule = device.createShaderModule({
      code: sceneFragmentShaderSource,
    });

    const vertexBuffers: GPUVertexBufferLayout[] = [
      {
        arrayStride: 24,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x3" },
        ],
      },
    ];

    const staticPipeline = device.createRenderPipeline({
      layout: staticPipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: vertexBuffers,
      },
      fragment: {
        module: fragmentModule,
        entryPoint: "staticFragment",
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
      layout: fieldPipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: vertexBuffers,
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

    const fieldPipeline = device.createRenderPipeline({
      layout: fieldPipelineLayout,
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: vertexBuffers,
      },
      fragment: {
        module: fragmentModule,
        entryPoint: "fieldFragment",
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
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    const baseObjects = createRenderObjects(
      device,
      objectBindGroupLayout,
      baseConfigs
    );
    const frameObjects = createRenderObjects(
      device,
      objectBindGroupLayout,
      frameConfigs
    );

    const slicePlaneUniformBuffer = device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const slicePlaneBindGroup = device.createBindGroup({
      layout: objectBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: slicePlaneUniformBuffer } }],
    });

    const contextSliceUniformBuffer = device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const contextSliceBindGroup = device.createBindGroup({
      layout: objectBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: contextSliceUniformBuffer } }],
    });

    const fieldCubeUniformBuffer = device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const fieldCubeBindGroup = device.createBindGroup({
      layout: objectBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: fieldCubeUniformBuffer } }],
    });

    const fieldUniformBuffer = device.createBuffer({
      size: 20 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const fieldBindGroup = device.createBindGroup({
      layout: fieldBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: fieldUniformBuffer } }],
    });

    const sliceViewport = createViewport(device, sceneBindGroupLayout, "slice");
    const fieldViewport = createViewport(device, sceneBindGroupLayout, "field");

    const orbitController = createOrbitCameraController(canvas, {
      target: FIELD_CAMERA_TARGET,
      eye: [4.8, 2.16, 4.6],
      minRadius: 3.8,
      maxRadius: 8.6,
      rotateSpeed: 0.008,
      zoomSpeed: 0.006,
    });

    const syncCanvasSize = () => {
      canvasRuntime.resize();
      ensureDepthTarget(device, depthTarget, canvas.width, canvas.height);
      lastKnownCanvasWidth = canvas.width;
      lastKnownCanvasHeight = canvas.height;
      metrics.layout = chooseLayoutMode(canvas.clientWidth);
      updateHud(refs, metrics);
    };

    const syncObjectUniforms = () => {
      device.queue.writeBuffer(
        slicePlaneUniformBuffer,
        0,
        createObjectUniformData(
          createScaleMatrix(0.96, 0.96, 0.012),
          SLICE_COLOR,
          0,
          0
        )
      );

      device.queue.writeBuffer(
        contextSliceUniformBuffer,
        0,
        createObjectUniformData(
          createContextSliceModelMatrix(settings.sliceDepth),
          SLICE_COLOR,
          0,
          0
        )
      );

      device.queue.writeBuffer(
        fieldCubeUniformBuffer,
        0,
        createObjectUniformData(
          createScaleMatrix(1, 1, 1),
          FIELD_CUBE_COLOR,
          0,
          0
        )
      );
    };

    const refreshSettings = () => {
      settings.sliceDepth = Math.min(
        SLICE_DEPTH_LIMIT,
        Math.max(-SLICE_DEPTH_LIMIT, Number.parseFloat(sliceRange.value))
      );
      settings.isoLevel = Number.parseFloat(isoRange.value);
      settings.fieldGain = Number.parseFloat(gainRange.value);
      settings.orbitRadius = Number.parseFloat(orbitRange.value);
      settings.animationSpeed = Number.parseFloat(speedRange.value);

      metrics.sliceDepth = settings.sliceDepth;
      metrics.isoLevel = settings.isoLevel;
      metrics.fieldGain = settings.fieldGain;
      metrics.orbitRadius = settings.orbitRadius;
      metrics.animationSpeed = settings.animationSpeed;

      updateHud(refs, metrics);
      syncObjectUniforms();
    };

    const addRefreshHandler = (element: HTMLInputElement) => {
      element.addEventListener("input", refreshSettings);
    };

    addRefreshHandler(sliceRange);
    addRefreshHandler(isoRange);
    addRefreshHandler(gainRange);
    addRefreshHandler(orbitRange);
    addRefreshHandler(speedRange);

    resizeObserver = new ResizeObserver(() => {
      syncCanvasSize();
    });
    resizeObserver.observe(host);
    resizeObserver.observe(canvas);

    syncCanvasSize();
    syncObjectUniforms();

    /**
     * 在当前 render pass 里画一个面板。
     * @param {GPURenderPassEncoder} pass 当前 render pass。
     * @param {ImplicitFieldViewport} viewport 当前面板的场景状态。
     * @param {ImplicitFieldPanelRect} rect 当前视口矩形。
     * @returns {void} 只编码 draw 命令，不返回额外结果。
     */
    const drawPanel = (
      pass: GPURenderPassEncoder,
      viewport: ImplicitFieldViewport,
      rect: ImplicitFieldPanelRect
    ) => {
      pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
      pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);

      if (viewport.key === "field") {
        pass.setPipeline(staticPipeline);
        pass.setBindGroup(0, viewport.sceneBindGroup);
        pass.setVertexBuffer(0, cubeBuffers.vertexBuffer);
        pass.setIndexBuffer(cubeBuffers.indexBuffer, "uint16");
        for (const object of baseObjects) {
          pass.setBindGroup(1, object.bindGroup);
          pass.drawIndexed(geometry.cube.indexCount);
        }

        pass.setPipeline(slicePipeline);
        pass.setBindGroup(0, viewport.sceneBindGroup);
        pass.setBindGroup(1, contextSliceBindGroup);
        pass.setBindGroup(2, fieldBindGroup);
        pass.setVertexBuffer(0, planeBuffers.vertexBuffer);
        pass.setIndexBuffer(planeBuffers.indexBuffer, "uint16");
        pass.drawIndexed(geometry.plane.indexCount);

        pass.setPipeline(fieldPipeline);
        pass.setBindGroup(0, viewport.sceneBindGroup);
        pass.setBindGroup(1, fieldCubeBindGroup);
        pass.setBindGroup(2, fieldBindGroup);
        pass.setVertexBuffer(0, cubeBuffers.vertexBuffer);
        pass.setIndexBuffer(cubeBuffers.indexBuffer, "uint16");
        pass.drawIndexed(geometry.cube.indexCount);

        pass.setPipeline(staticPipeline);
        pass.setBindGroup(0, viewport.sceneBindGroup);
        pass.setVertexBuffer(0, cubeBuffers.vertexBuffer);
        pass.setIndexBuffer(cubeBuffers.indexBuffer, "uint16");
        for (const object of frameObjects) {
          pass.setBindGroup(1, object.bindGroup);
          pass.drawIndexed(geometry.cube.indexCount);
        }
        return;
      }

      pass.setPipeline(slicePipeline);
      pass.setBindGroup(0, viewport.sceneBindGroup);
      pass.setBindGroup(1, slicePlaneBindGroup);
      pass.setBindGroup(2, fieldBindGroup);
      pass.setVertexBuffer(0, planeBuffers.vertexBuffer);
      pass.setIndexBuffer(planeBuffers.indexBuffer, "uint16");
      pass.drawIndexed(geometry.plane.indexCount);
    };

    const frame = (timeMs: number) => {
      if (disposed || !depthTarget.view) {
        return;
      }

      if (canvas.width !== lastKnownCanvasWidth || canvas.height !== lastKnownCanvasHeight) {
        syncCanvasSize();
      }

      const timeSeconds = timeMs * 0.001;
      const metaballs = createMetaballFieldData(settings, timeSeconds);
      const orbitSnapshot = orbitController.getSnapshot();
      const lightPosition: Vector3 = [
        Math.cos(timeMs * 0.00034) * 4.9,
        3.5 + Math.sin(timeMs * 0.00051) * 0.42,
        Math.sin(timeMs * 0.00034) * 4.9,
      ];
      const panelRects = createImplicitFieldPanelRects(
        canvas.width,
        canvas.height,
        metrics.layout
      );

      const sliceHalfWidth = 1.18;
      const sliceHalfHeight =
        sliceHalfWidth * (panelRects.slice.height / Math.max(1, panelRects.slice.width));
      const sliceViewProjection = multiplyMatrices(
        createOrthographicMatrix(
          -sliceHalfWidth,
          sliceHalfWidth,
          -sliceHalfHeight,
          sliceHalfHeight,
          0.1,
          10
        ),
        createLookAtViewMatrix(ORTHO_EYE, ORTHO_TARGET, [0, 1, 0])
      );

      const fieldViewProjection = multiplyMatrices(
        createPerspectiveMatrix(
          Math.PI / 4.2,
          panelRects.field.width / Math.max(1, panelRects.field.height),
          0.1,
          24
        ),
        createLookAtViewMatrix(orbitSnapshot.eye, orbitSnapshot.target, orbitSnapshot.up)
      );

      device.queue.writeBuffer(
        sliceViewport.sceneUniformBuffer,
        0,
        createSceneUniformData(sliceViewProjection, ORTHO_EYE, lightPosition)
      );
      device.queue.writeBuffer(
        fieldViewport.sceneUniformBuffer,
        0,
        createSceneUniformData(fieldViewProjection, orbitSnapshot.eye, lightPosition)
      );
      device.queue.writeBuffer(
        fieldUniformBuffer,
        0,
        createFieldUniformData(metaballs, settings)
      );

      if (timeMs - lastHudUpdateTimeMs >= HUD_UPDATE_INTERVAL_MS) {
        const sampledMetrics = sampleMetaballFieldMetrics(settings, timeSeconds);
        metrics.peakField = sampledMetrics.peakField;
        metrics.occupiedRatio = sampledMetrics.occupiedRatio;
        metrics.sliceCoverage = sampledMetrics.sliceCoverage;
        metrics.metaballCount = sampledMetrics.metaballCount;
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
      drawPanel(pass, fieldViewport, panelRects.field);
      pass.end();

      device.queue.submit([encoder.finish()]);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    setStatus({
      title: "Metaballs 与隐式场已运行",
      detail:
        "左边只看固定 z 层里的二维标量场，右边则直接沿视线命中同一份隐式场的等值壳层。重点是先把“场”本身看懂，还没进入 mesh 提取。",
      tone: "ok",
    });

    animationFrameId = window.requestAnimationFrame(frame);

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitController.dispose();
      destroyDepthTarget(depthTarget);
      cubeBuffers.vertexBuffer.destroy();
      cubeBuffers.indexBuffer.destroy();
      planeBuffers.vertexBuffer.destroy();
      planeBuffers.indexBuffer.destroy();
      slicePlaneUniformBuffer.destroy();
      contextSliceUniformBuffer.destroy();
      fieldCubeUniformBuffer.destroy();
      fieldUniformBuffer.destroy();
      sliceViewport.sceneUniformBuffer.destroy();
      fieldViewport.sceneUniformBuffer.destroy();
      for (const object of [...baseObjects, ...frameObjects]) {
        object.uniformBuffer.destroy();
      }
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "第 47 课初始化失败。";

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
