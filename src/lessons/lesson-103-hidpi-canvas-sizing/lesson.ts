import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createHiDpiSizingLessonGeometry } from "@/lessons/lesson-103-hidpi-canvas-sizing/geometry";
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
} from "@/lessons/lesson-103-hidpi-canvas-sizing/math";
import presentShaderSource from "@/lessons/lesson-103-hidpi-canvas-sizing/present.wgsl?raw";
import fragmentShaderSource from "@/lessons/lesson-103-hidpi-canvas-sizing/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-103-hidpi-canvas-sizing/scene.vert.wgsl?raw";

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

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type HiDpiSizingRenderTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  width: number;
  height: number;
};

type HiDpiSizingHudRefs = {
  dprBadge: HTMLElement;
  demoBadge: HTMLElement;
  modeBadge: HTMLElement;
  leftPixelsValue: HTMLElement;
  leftPixelsMeta: HTMLElement;
  rightPixelsValue: HTMLElement;
  rightPixelsMeta: HTMLElement;
  areaValue: HTMLElement;
  areaMeta: HTMLElement;
  legendBody: HTMLElement;
};

const DETAIL_OBJECT_COUNT = 36;
const FRAME_UNIFORM_BYTES = 96;
const OBJECT_UNIFORM_BYTES = 96;
const CAMERA_FOV = Math.PI / 4.5;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 36;
const MAX_WINDOW_PIXEL_RATIO = 2;
const SIMULATED_PIXEL_RATIO = 1.75;
const LIGHT_POSITION: Vector3 = [4.8, 6.4, 3.2];
const CLEAR_COLOR: GPUColor = { r: 0.03, g: 0.05, b: 0.09, a: 1 };
const LEFT_CLEAR_COLOR: GPUColor = { r: 0.035, g: 0.045, b: 0.075, a: 1 };
const RIGHT_CLEAR_COLOR: GPUColor = { r: 0.025, g: 0.05, b: 0.085, a: 1 };

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
 * 把整数格式化成更适合 HUD 的数字文本。
 * @param {number} value 当前数字。
 * @returns {string} 对应的中文字符串。
 */
function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 把像素尺寸格式化成“宽 × 高”文本。
 * @param {number} width 当前宽度。
 * @param {number} height 当前高度。
 * @returns {string} 对应的尺寸文本。
 */
function formatSize(width: number, height: number): string {
  return `${formatCount(width)} × ${formatCount(height)} px`;
}

/**
 * 把像素比格式化成简短文本。
 * @param {number} value 当前像素比。
 * @returns {string} 对应的倍率文本。
 */
function formatPixelRatio(value: number): string {
  return `${value.toFixed(2)}x`;
}

/**
 * 把面积倍率格式化成简短文本。
 * @param {number} value 当前面积倍率。
 * @returns {string} 对应的倍率文本。
 */
function formatAreaRatio(value: number): string {
  return `${value.toFixed(2)}x`;
}

/**
 * 把 window.devicePixelRatio 限制在 lesson 允许的实验区间内。
 * @param {number} value 浏览器当前 devicePixelRatio。
 * @returns {number} 当前 lesson 真正采用的像素比。
 */
function clampPixelRatio(value: number): number {
  return Math.min(Math.max(value, 1), MAX_WINDOW_PIXEL_RATIO);
}

/**
 * 选择右侧 pane 用来演示高密度像素的倍率。
 * @param {number} windowPixelRatio 浏览器当前 devicePixelRatio。
 * @returns {number} 本次实验实际采用的右侧像素比。
 */
function chooseDemoPixelRatio(windowPixelRatio: number): number {
  if (windowPixelRatio > 1.05) {
    return clampPixelRatio(windowPixelRatio);
  }

  return SIMULATED_PIXEL_RATIO;
}

/**
 * 生成 frame uniform 数据，里面包含 VP、光源位置和相机位置。
 * @param {Float32Array} viewProjectionMatrix 当前帧的 VP 矩阵。
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
 * 生成对象级 uniform 数据，里面包含模型矩阵、颜色和表面细节参数。
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
 * 组合当前对象的平移、旋转和缩放，并在最外层再叠一层全局旋转。
 * @param {SceneObjectConfig} config 当前对象配置。
 * @param {number} sceneYaw 当前整组场景的缓慢旋转角。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createModelMatrix(
  config: SceneObjectConfig,
  sceneYaw: number
): Float32Array {
  const localMatrix = multiplyMatrices(
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

  return multiplyMatrices(createRotationYMatrix(sceneYaw), localMatrix);
}

/**
 * 生成整节课要复用的一批静态场景对象。
 * @returns {SceneObjectConfig[]} 一个带细网格地面和大量细杆结构的对象数组。
 */
function createHiDpiSceneConfigs(): SceneObjectConfig[] {
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
      color: [0.28, 0.82, 1.0, 1],
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
      color: [
        0.32,
        0.41 + seededUnit(index, 15) * 0.18,
        0.56 + seededUnit(index, 16) * 0.22,
        1,
      ],
      surfaceMode: 0,
      detailScale: 0,
    });
  }

  return objects;
}

/**
 * 安全释放一组离屏颜色 / 深度目标。
 * @param {HiDpiSizingRenderTarget} target 当前渲染目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyRenderTarget(target: HiDpiSizingRenderTarget): void {
  target.texture?.destroy();
  target.depthTexture?.destroy();
  target.texture = null;
  target.view = null;
  target.depthTexture = null;
  target.depthView = null;
  target.width = 0;
  target.height = 0;
}

/**
 * 确保某个离屏 pane 的颜色 / 深度目标尺寸正确。
 * @param {HiDpiSizingRenderTarget} target 当前要维护的目标对象。
 * @param {GPUDevice} device 当前 lesson 共用的 GPUDevice。
 * @param {number} width 目标宽度。
 * @param {number} height 目标高度。
 * @param {GPUTextureFormat} format 当前颜色格式。
 * @returns {boolean} 如果发生重建则返回 true。
 */
function ensureSceneTarget(
  target: HiDpiSizingRenderTarget,
  device: GPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat
): boolean {
  if (
    target.texture &&
    target.depthTexture &&
    target.width === width &&
    target.height === height
  ) {
    return false;
  }

  destroyRenderTarget(target);

  target.texture = device.createTexture({
    size: { width, height },
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  target.view = target.texture.createView();
  target.depthTexture = device.createTexture({
    size: { width, height },
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  target.depthView = target.depthTexture.createView();
  target.width = width;
  target.height = height;
  return true;
}

/**
 * 生成右下角“当前实验”的动态文案。
 * @param {number} windowPixelRatio 浏览器当前 devicePixelRatio。
 * @param {number} demoPixelRatio 右侧实验真正采用的像素比。
 * @param {number} panelCssWidth 单侧 pane 的 CSS 宽度。
 * @param {number} panelCssHeight 单侧 pane 的 CSS 高度。
 * @returns {string} 对应的说明文本。
 */
function createLegendCopy(
  windowPixelRatio: number,
  demoPixelRatio: number,
  panelCssWidth: number,
  panelCssHeight: number
): string {
  if (windowPixelRatio <= 1.05) {
    return `当前机器的 window.devicePixelRatio 只有 ${formatPixelRatio(
      windowPixelRatio
    )}，所以右侧会临时按 ${formatPixelRatio(
      demoPixelRatio
    )} 模拟高密度 backing store。左右两边的 CSS 尺寸仍然同样是 ${formatSize(
      panelCssWidth,
      panelCssHeight
    )}，差别只在内部到底分配了多少真实像素。`;
  }

  return `左右两边看到的是同一组细杆、同一块细网格地面、同一个最终预览 canvas；差别只在左侧故意按 1.00x 渲染，而右侧按 ${formatPixelRatio(
    demoPixelRatio
  )} 配置 backing store。高密度一侧会把更多像素花在同样的 CSS 区域里，所以细格和锐边更稳。`;
}

/**
 * 把当前尺寸信息同步到 lesson HUD。
 * @param {HiDpiSizingHudRefs} refs HUD DOM 引用。
 * @param {number} windowPixelRatio 浏览器当前 devicePixelRatio。
 * @param {number} demoPixelRatio 右侧实验真正采用的像素比。
 * @param {number} panelCssWidth 单侧 pane 的 CSS 宽度。
 * @param {number} panelCssHeight 单侧 pane 的 CSS 高度。
 * @param {HiDpiSizingRenderTarget} naiveTarget 左侧 1x 目标。
 * @param {HiDpiSizingRenderTarget} hidpiTarget 右侧高密度目标。
 * @returns {void} 只负责文案更新。
 */
function updateHud(
  refs: HiDpiSizingHudRefs,
  windowPixelRatio: number,
  demoPixelRatio: number,
  panelCssWidth: number,
  panelCssHeight: number,
  naiveTarget: HiDpiSizingRenderTarget,
  hidpiTarget: HiDpiSizingRenderTarget
): void {
  const areaRatio =
    (hidpiTarget.width * hidpiTarget.height) /
    Math.max(naiveTarget.width * naiveTarget.height, 1);

  refs.dprBadge.textContent = `window.devicePixelRatio · ${formatPixelRatio(
    windowPixelRatio
  )}`;
  refs.demoBadge.textContent = `右侧实验倍率 · ${formatPixelRatio(demoPixelRatio)}`;
  refs.modeBadge.textContent = `同一 scene / 左 1.00x / 右 ${formatPixelRatio(
    demoPixelRatio
  )}`;

  refs.leftPixelsValue.textContent = formatSize(naiveTarget.width, naiveTarget.height);
  refs.leftPixelsMeta.textContent = `单侧 CSS ${formatSize(
    panelCssWidth,
    panelCssHeight
  )}，这里故意只按 1.00x backing store 渲染。`;

  refs.rightPixelsValue.textContent = formatSize(hidpiTarget.width, hidpiTarget.height);
  refs.rightPixelsMeta.textContent = `同样的 CSS 尺寸，但右侧会乘上 ${formatPixelRatio(
    demoPixelRatio
  )}，所以内部像素会更多。`;

  refs.areaValue.textContent = formatAreaRatio(areaRatio);
  refs.areaMeta.textContent = `右侧总像素数约为左侧的 ${formatAreaRatio(
    areaRatio
  )}；细格、细杆和斜边会更稳。`;

  refs.legendBody.textContent = createLegendCopy(
    windowPixelRatio,
    demoPixelRatio,
    panelCssWidth,
    panelCssHeight
  );
}

/**
 * 挂载第 41 课“高 DPI 画布与像素尺寸”，左侧故意只按 1x 渲染，右侧按高密度像素渲染，再统一 present 到同一块预览画布。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源。
 */
export async function mountHiDpiCanvasSizingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<(() => void) | void> {
  host.innerHTML = `
    <div class="lesson-shell lesson-shell--hidpi-sizing">
      <section class="hidpi-sizing-stage">
        <div class="hidpi-sizing-stage__badges">
          <span class="hidpi-sizing-badge" data-hidpi-sizing-badge="dpr"></span>
          <span class="hidpi-sizing-badge hidpi-sizing-badge--cool" data-hidpi-sizing-badge="demo"></span>
          <span class="hidpi-sizing-badge hidpi-sizing-badge--ok" data-hidpi-sizing-badge="mode"></span>
        </div>

        <div class="hidpi-sizing-stage__labels">
          <div class="hidpi-sizing-panel-label hidpi-sizing-panel-label--left">
            <span class="hidpi-sizing-panel-label__eyebrow">Naive 1x</span>
            <strong class="hidpi-sizing-panel-label__title">只按 CSS 像素渲染</strong>
          </div>
          <div class="hidpi-sizing-panel-label hidpi-sizing-panel-label--right">
            <span class="hidpi-sizing-panel-label__eyebrow">HiDPI</span>
            <strong class="hidpi-sizing-panel-label__title">按高密度像素配置 backing store</strong>
          </div>
        </div>

        <div class="hidpi-sizing-stage__frame">
          <div class="preview-viewport preview-viewport--hidpi-sizing">
            <canvas class="hidpi-sizing-stage__canvas"></canvas>
          </div>
        </div>

        <div class="hidpi-sizing-stage__cards">
          <article class="hidpi-sizing-card hidpi-sizing-card--warn">
            <p class="hidpi-sizing-card__label">左侧 backing store</p>
            <strong class="hidpi-sizing-card__value" data-hidpi-sizing-card-value="left"></strong>
            <p class="hidpi-sizing-card__meta" data-hidpi-sizing-card-meta="left"></p>
          </article>

          <article class="hidpi-sizing-card hidpi-sizing-card--cool">
            <p class="hidpi-sizing-card__label">右侧 backing store</p>
            <strong class="hidpi-sizing-card__value" data-hidpi-sizing-card-value="right"></strong>
            <p class="hidpi-sizing-card__meta" data-hidpi-sizing-card-meta="right"></p>
          </article>

          <article class="hidpi-sizing-card hidpi-sizing-card--ok">
            <p class="hidpi-sizing-card__label">右侧面积倍率</p>
            <strong class="hidpi-sizing-card__value" data-hidpi-sizing-card-value="area"></strong>
            <p class="hidpi-sizing-card__meta" data-hidpi-sizing-card-meta="area"></p>
          </article>
        </div>

        <article class="hidpi-sizing-legend">
          <p class="hidpi-sizing-legend__eyebrow">当前实验</p>
          <p class="hidpi-sizing-legend__body" data-hidpi-sizing-legend></p>
        </article>
      </section>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  if (!canvas) {
    return;
  }

  const refs: HiDpiSizingHudRefs = {
    dprBadge: host.querySelector<HTMLElement>('[data-hidpi-sizing-badge="dpr"]')!,
    demoBadge: host.querySelector<HTMLElement>('[data-hidpi-sizing-badge="demo"]')!,
    modeBadge: host.querySelector<HTMLElement>('[data-hidpi-sizing-badge="mode"]')!,
    leftPixelsValue: host.querySelector<HTMLElement>('[data-hidpi-sizing-card-value="left"]')!,
    leftPixelsMeta: host.querySelector<HTMLElement>('[data-hidpi-sizing-card-meta="left"]')!,
    rightPixelsValue: host.querySelector<HTMLElement>('[data-hidpi-sizing-card-value="right"]')!,
    rightPixelsMeta: host.querySelector<HTMLElement>('[data-hidpi-sizing-card-meta="right"]')!,
    areaValue: host.querySelector<HTMLElement>('[data-hidpi-sizing-card-value="area"]')!,
    areaMeta: host.querySelector<HTMLElement>('[data-hidpi-sizing-card-meta="area"]')!,
    legendBody: host.querySelector<HTMLElement>("[data-hidpi-sizing-legend]")!,
  };

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const geometry = createHiDpiSizingLessonGeometry();
    const sceneConfigs = createHiDpiSceneConfigs();

    const vertexShaderModule = gpu.device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });
    const presentModule = gpu.device.createShaderModule({ code: presentShaderSource });

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
      ],
    });

    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-41-scene-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, objectBindGroupLayout],
      }),
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 6 * Float32Array.BYTES_PER_ELEMENT,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
              {
                shaderLocation: 1,
                offset: 3 * Float32Array.BYTES_PER_ELEMENT,
                format: "float32x3",
              },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less-equal",
      },
    });

    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-41-present-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [presentBindGroupLayout],
      }),
      vertex: {
        module: presentModule,
        entryPoint: "vsFullscreen",
      },
      fragment: {
        module: presentModule,
        entryPoint: "fsPresent",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

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

    const frameUniformBuffer = gpu.device.createBuffer({
      size: FRAME_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const frameBindGroup = gpu.device.createBindGroup({
      layout: frameBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: frameUniformBuffer } }],
    });

    const createRenderObject = (config: SceneObjectConfig): RenderObject => {
      const uniformBuffer = gpu.device.createBuffer({
        size: OBJECT_UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = gpu.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      return {
        config,
        uniformBuffer,
        bindGroup,
      };
    };

    const renderObjects = sceneConfigs.map(createRenderObject);
    const presentSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
    });

    const naiveTarget: HiDpiSizingRenderTarget = {
      texture: null,
      view: null,
      depthTexture: null,
      depthView: null,
      width: 0,
      height: 0,
    };
    const hidpiTarget: HiDpiSizingRenderTarget = {
      texture: null,
      view: null,
      depthTexture: null,
      depthView: null,
      width: 0,
      height: 0,
    };

    let presentBindGroup: GPUBindGroup | null = null;
    let animationFrameId = 0;
    let disposed = false;
    let lastHudKey = "";

    const orbit = createOrbitCameraController(canvas, {
      target: [0, 0.02, 0],
      eye: [6.0, 3.3, 5.6],
      minRadius: 3.8,
      maxRadius: 11.8,
      rotateSpeed: 0.0085,
      zoomSpeed: 0.012,
    });

    const updateObjectUniforms = (sceneYaw: number) => {
      renderObjects.forEach((object) => {
        const modelMatrix = createModelMatrix(object.config, sceneYaw);
        const uniformData = createObjectUniformData(
          modelMatrix,
          object.config.color,
          object.config.surfaceMode,
          object.config.detailScale
        );
        gpu.device.queue.writeBuffer(object.uniformBuffer, 0, uniformData);
      });
    };

    const drawObjects = (pass: GPURenderPassEncoder) => {
      pass.setPipeline(scenePipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      pass.setBindGroup(0, frameBindGroup);

      renderObjects.forEach((object) => {
        pass.setBindGroup(1, object.bindGroup);
        pass.drawIndexed(geometry.indexCount);
      });
    };

    const renderSceneToTarget = (
      encoder: GPUCommandEncoder,
      target: HiDpiSizingRenderTarget,
      clearColor: GPUColor
    ) => {
      if (!target.view || !target.depthView) {
        return;
      }

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: target.view,
            clearValue: clearColor,
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: target.depthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      drawObjects(pass);
      pass.end();
    };

    const syncCanvasSizing = () => {
      gpu.resize();

      const canvasCssWidth = Math.max(2, Math.floor(canvas.clientWidth));
      const canvasCssHeight = Math.max(2, Math.floor(canvas.clientHeight));
      const windowPixelRatio = Math.max(window.devicePixelRatio || 1, 1);
      const demoPixelRatio = chooseDemoPixelRatio(windowPixelRatio);
      const panelCssWidth = Math.max(1, Math.floor(canvasCssWidth * 0.5));
      const panelCssHeight = canvasCssHeight;
      const leftWidth = panelCssWidth;
      const leftHeight = panelCssHeight;
      const rightWidth = Math.max(1, Math.floor(panelCssWidth * demoPixelRatio));
      const rightHeight = Math.max(1, Math.floor(panelCssHeight * demoPixelRatio));

      const leftChanged = ensureSceneTarget(
        naiveTarget,
        gpu.device,
        leftWidth,
        leftHeight,
        gpu.format
      );
      const rightChanged = ensureSceneTarget(
        hidpiTarget,
        gpu.device,
        rightWidth,
        rightHeight,
        gpu.format
      );

      if ((leftChanged || rightChanged || !presentBindGroup) && naiveTarget.view && hidpiTarget.view) {
        presentBindGroup = gpu.device.createBindGroup({
          layout: presentBindGroupLayout,
          entries: [
            { binding: 0, resource: presentSampler },
            { binding: 1, resource: naiveTarget.view },
            { binding: 2, resource: hidpiTarget.view },
          ],
        });
      }

      const hudKey = [
        windowPixelRatio.toFixed(3),
        demoPixelRatio.toFixed(3),
        panelCssWidth,
        panelCssHeight,
        leftWidth,
        leftHeight,
        rightWidth,
        rightHeight,
      ].join(":");

      if (hudKey !== lastHudKey) {
        updateHud(
          refs,
          windowPixelRatio,
          demoPixelRatio,
          panelCssWidth,
          panelCssHeight,
          naiveTarget,
          hidpiTarget
        );
        lastHudKey = hudKey;
      }

      return {
        panelCssWidth,
        panelCssHeight,
      };
    };

    const renderFrame = (timeMs: number) => {
      if (disposed) {
        return;
      }

      const sizing = syncCanvasSizing();
      if (!naiveTarget.view || !hidpiTarget.view || !presentBindGroup) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
        return;
      }

      const camera = orbit.getSnapshot();
      const eyePosition: Vector3 = [camera.eye[0], camera.eye[1], camera.eye[2]];
      const viewMatrix = createLookAtViewMatrix(eyePosition, camera.target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        CAMERA_FOV,
        sizing.panelCssWidth / Math.max(sizing.panelCssHeight, 1),
        CAMERA_NEAR,
        CAMERA_FAR
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const frameUniformData = createFrameUniformData(
        viewProjectionMatrix,
        LIGHT_POSITION,
        eyePosition
      );
      gpu.device.queue.writeBuffer(frameUniformBuffer, 0, frameUniformData);

      const sceneYaw = timeMs * 0.00016;
      updateObjectUniforms(sceneYaw);

      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-41-command-encoder",
      });

      renderSceneToTarget(encoder, naiveTarget, LEFT_CLEAR_COLOR);
      renderSceneToTarget(encoder, hidpiTarget, RIGHT_CLEAR_COLOR);

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
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    setStatus({
      title: "高 DPI 画布与像素尺寸已运行",
      detail:
        "左边会故意只按 1x backing store 渲染，右边则按高密度像素配置，再统一 present 到同一块最终画布上。重点不是多画布，而是看同样的 CSS 区域到底分到了多少真实像素。",
      tone: "ok",
    });

    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
      orbit.dispose();

      destroyRenderTarget(naiveTarget);
      destroyRenderTarget(hidpiTarget);
      vertexBuffer.destroy();
      indexBuffer.destroy();
      frameUniformBuffer.destroy();
      renderObjects.forEach((object) => object.uniformBuffer.destroy());
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    setStatus({
      title: "第 41 课初始化失败",
      detail: message,
      tone: "warn",
    });
  }
}
