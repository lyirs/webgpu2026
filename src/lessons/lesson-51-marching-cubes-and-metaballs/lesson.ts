import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createMarchingCubesLessonGeometry } from "@/lessons/lesson-51-marching-cubes-and-metaballs/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-51-marching-cubes-and-metaballs/math";
import computeShaderSource from "@/lessons/lesson-51-marching-cubes-and-metaballs/metaballs.compute.wgsl?raw";
import fragmentShaderSource from "@/lessons/lesson-51-marching-cubes-and-metaballs/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-51-marching-cubes-and-metaballs/scene.vert.wgsl?raw";

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

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type MarchingSettings = {
  isoLevel: number;
  fieldGain: number;
  orbitRadius: number;
  animationSpeed: number;
};

type MarchingMetrics = {
  vertexCount: number | null;
  triangleCount: number | null;
  activeCells: number | null;
  pendingReadback: boolean;
};

type MarchingHudRefs = {
  computeBadge: HTMLElement;
  gridBadge: HTMLElement;
  metaballBadge: HTMLElement;
  isoOutput: HTMLElement;
  gainOutput: HTMLElement;
  orbitOutput: HTMLElement;
  speedOutput: HTMLElement;
  vertexValue: HTMLElement;
  vertexMeta: HTMLElement;
  triangleValue: HTMLElement;
  triangleMeta: HTMLElement;
  activeValue: HTMLElement;
  activeMeta: HTMLElement;
  resolutionValue: HTMLElement;
  resolutionMeta: HTMLElement;
  legendBody: HTMLElement;
};

const METABALL_COUNT = 4;
const CELL_RESOLUTION = 20;
const WORKGROUP_SIZE = 4;
const WORKGROUP_COUNT = Math.ceil(CELL_RESOLUTION / WORKGROUP_SIZE);
const MAX_GENERATED_VERTICES = CELL_RESOLUTION * CELL_RESOLUTION * CELL_RESOLUTION * 36;
const COUNTER_BUFFER_WORDS = 8;
const COUNTER_BUFFER_BYTES = COUNTER_BUFFER_WORDS * 4;
const BOUNDS_EXTENT = 1.04;
const HUD_READBACK_INTERVAL_MS = 180;

/**
 * 把整数格式化成更适合 HUD 的中文数字字符串。
 * @param {number} value 当前数字。
 * @returns {string} 对应的格式化文本。
 */
function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 把浮点数格式化成两位小数。
 * @param {number} value 当前数值。
 * @returns {string} 对应的文本。
 */
function formatFixed(value: number): string {
  return value.toFixed(2);
}

/**
 * 把速度参数格式化成 `1.00x` 文本。
 * @param {number} value 当前动画速度。
 * @returns {string} 对应的展示文本。
 */
function formatSpeed(value: number): string {
  return `${value.toFixed(2)}x`;
}

/**
 * 生成一份场景 uniform 数据，里面包含 VP、光源和相机位置。
 * @param {Float32Array} viewProjectionMatrix 当前帧视图投影矩阵。
 * @param {Vector3} lightPosition 当前点光源位置。
 * @param {Vector3} eyePosition 当前相机位置。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续数据。
 */
function createSceneUniformData(
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
 * 生成一份对象级 uniform 数据，里面包含模型矩阵和基础颜色。
 * @param {Float32Array} modelMatrix 当前对象模型矩阵。
 * @param {Color4} color 当前对象颜色。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续数据。
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
 * 用平移和缩放组合一份模型矩阵。
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
 * 生成第 44 课静态场景里要复用的底座和体素边框。
 * @returns {SceneObjectConfig[]} 对应的静态对象配置数组。
 */
function createSceneConfigs(): SceneObjectConfig[] {
  const objects: SceneObjectConfig[] = [
    {
      label: "floor",
      translation: [0, -1.3, 0],
      scale: [5.4, 0.12, 5.4],
      color: [0.12, 0.16, 0.22, 1],
    },
    {
      label: "plinth",
      translation: [0, -1.02, 0],
      scale: [2.15, 0.22, 2.15],
      color: [0.17, 0.22, 0.29, 1],
    },
  ];

  const edgeColor: Color4 = [0.23, 0.69, 0.96, 1];
  const accentColor: Color4 = [1.0, 0.72, 0.31, 1];
  const edgeHalfExtent = BOUNDS_EXTENT;
  const edgeThickness = 0.038;

  for (const y of [-edgeHalfExtent, edgeHalfExtent] as const) {
    for (const z of [-edgeHalfExtent, edgeHalfExtent] as const) {
      objects.push({
        label: `edge-x-${y}-${z}`,
        translation: [0, y, z],
        scale: [edgeHalfExtent, edgeThickness, edgeThickness],
        color: edgeColor,
      });
    }
  }

  for (const x of [-edgeHalfExtent, edgeHalfExtent] as const) {
    for (const z of [-edgeHalfExtent, edgeHalfExtent] as const) {
      objects.push({
        label: `edge-y-${x}-${z}`,
        translation: [x, 0, z],
        scale: [edgeThickness, edgeHalfExtent, edgeThickness],
        color: accentColor,
      });
    }
  }

  for (const x of [-edgeHalfExtent, edgeHalfExtent] as const) {
    for (const y of [-edgeHalfExtent, edgeHalfExtent] as const) {
      objects.push({
        label: `edge-z-${x}-${y}`,
        translation: [x, y, 0],
        scale: [edgeThickness, edgeThickness, edgeHalfExtent],
        color: edgeColor,
      });
    }
  }

  return objects;
}

/**
 * 根据当前设置生成四个 metaball 的球心与半径。
 * @param {MarchingSettings} settings 当前可调参数。
 * @param {number} timeSeconds 当前时间，单位秒。
 * @returns {Float32Array} 形如 `[x, y, z, radius] * 4` 的连续数据。
 */
function createMetaballData(
  settings: MarchingSettings,
  timeSeconds: number
): Float32Array {
  const orbit = settings.orbitRadius;
  const time = timeSeconds * settings.animationSpeed;

  return new Float32Array([
    Math.cos(time * 0.82) * orbit,
    Math.sin(time * 1.11) * 0.34,
    Math.sin(time * 0.63 + 0.4) * orbit * 0.74,
    0.44,

    Math.cos(time * 0.57 + 2.1) * orbit * 0.76,
    Math.sin(time * 0.91 + 1.1) * 0.42,
    Math.sin(time * 1.03 + 0.8) * orbit,
    0.39,

    Math.sin(time * 0.73 + 0.5) * orbit,
    Math.cos(time * 0.67 + 2.7) * 0.38,
    Math.cos(time * 0.96 + 1.6) * orbit * 0.82,
    0.47,

    Math.cos(time * 1.14 + 4.1) * orbit * 0.58,
    Math.sin(time * 0.79 + 3.0) * 0.28,
    Math.cos(time * 0.71 + 2.2) * orbit * 0.68,
    0.35,
  ]);
}

/**
 * 组装 compute 阶段要读取的统一参数块。
 * @param {MarchingSettings} settings 当前控制参数。
 * @param {number} timeSeconds 当前时间，单位秒。
 * @returns {ArrayBuffer} 对应的 uniform buffer 字节数据。
 */
function createComputeUniformData(
  settings: MarchingSettings,
  timeSeconds: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(96);
  const dataView = new DataView(buffer);
  const metaballData = createMetaballData(settings, timeSeconds);
  const gradientStep = (BOUNDS_EXTENT * 2) / CELL_RESOLUTION * 0.24;

  dataView.setUint32(0, CELL_RESOLUTION, true);
  dataView.setUint32(4, METABALL_COUNT, true);
  dataView.setUint32(8, WORKGROUP_COUNT, true);
  dataView.setUint32(12, MAX_GENERATED_VERTICES, true);

  dataView.setFloat32(16, settings.isoLevel, true);
  dataView.setFloat32(20, settings.fieldGain, true);
  dataView.setFloat32(24, BOUNDS_EXTENT, true);
  dataView.setFloat32(28, gradientStep, true);

  for (let index = 0; index < metaballData.length; index += 1) {
    dataView.setFloat32(32 + index * 4, metaballData[index], true);
  }

  return buffer;
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
 * 确保深度纹理始终和当前画布像素尺寸一致。
 * @param {DepthTarget} target 当前 depth target 状态。
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
 * 根据当前设置生成更贴近课程讲解的总结文案。
 * @param {MarchingSettings} settings 当前课程控制参数。
 * @returns {string} 对应的说明文本。
 */
function createLegendCopy(settings: MarchingSettings): string {
  if (settings.orbitRadius > 0.76 && settings.isoLevel > 0.8) {
    return "球心分得更开、等值面又更紧时，原本连在一起的曲面会更容易裂成多团。";
  }

  if (settings.fieldGain > 1.18 || settings.isoLevel < 0.7) {
    return "势场更强或阈值更低时，多个 metaball 会更早粘连，compute 提出来的网格也会更像一整块流体。";
  }

  return "metaball 先定义在隐式场里；compute 再沿 cube cells 提取等值面，把它重新变成真正可渲染的三角网格。";
}

/**
 * 根据当前状态更新 HUD 文案。
 * @param {MarchingHudRefs} refs HUD 的 DOM 引用。
 * @param {MarchingSettings} settings 当前控制参数。
 * @param {MarchingMetrics} metrics 当前 GPU 读回指标。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(
  refs: MarchingHudRefs,
  settings: MarchingSettings,
  metrics: MarchingMetrics
): void {
  refs.computeBadge.textContent =
    metrics.pendingReadback && metrics.vertexCount === null
      ? "compute 提面 · 首轮生成中"
      : "compute 提面 · 每帧重建 mesh";
  refs.computeBadge.className = "metaball-badge metaball-badge--cool";

  refs.gridBadge.textContent = `${CELL_RESOLUTION}³ cube cells · ${WORKGROUP_COUNT}³ workgroups`;
  refs.gridBadge.className = "metaball-badge";

  refs.metaballBadge.textContent = `${METABALL_COUNT} 个 metaballs · iso ${formatFixed(
    settings.isoLevel
  )}`;
  refs.metaballBadge.className = "metaball-badge metaball-badge--accent";

  refs.isoOutput.textContent = formatFixed(settings.isoLevel);
  refs.gainOutput.textContent = formatFixed(settings.fieldGain);
  refs.orbitOutput.textContent = formatFixed(settings.orbitRadius);
  refs.speedOutput.textContent = formatSpeed(settings.animationSpeed);

  refs.vertexValue.textContent =
    metrics.vertexCount === null ? "等待首轮" : formatCount(metrics.vertexCount);
  refs.vertexMeta.textContent =
    "GPU 这轮写进 storage vertex buffer 的顶点数。";

  refs.triangleValue.textContent =
    metrics.triangleCount === null ? "等待首轮" : formatCount(metrics.triangleCount);
  refs.triangleMeta.textContent =
    "真正交给 drawIndirect 的三角形总数。";

  refs.activeValue.textContent =
    metrics.activeCells === null ? "等待首轮" : formatCount(metrics.activeCells);
  refs.activeMeta.textContent =
    "至少产出了一组三角形的 cube cell 数量。";

  refs.resolutionValue.textContent = `${CELL_RESOLUTION}³`;
  refs.resolutionMeta.textContent =
    `提面范围 ±${BOUNDS_EXTENT.toFixed(2)}，理论上限 ${formatCount(MAX_GENERATED_VERTICES)} 顶点。`;

  refs.legendBody.textContent = createLegendCopy(settings);
}

/**
 * 挂载第 44 课“Marching Cubes 与 Metaballs”，把隐式场和三角网格生成放进同一个 compute lesson。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源。
 */
export async function mountMarchingCubesAndMetaballsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--metaballs">
      <div class="metaball-stage">
        <div class="metaball-stage__badges">
          <span class="metaball-badge" data-metaball-badge="compute"></span>
          <span class="metaball-badge" data-metaball-badge="grid"></span>
          <span class="metaball-badge" data-metaball-badge="balls"></span>
        </div>

        <div class="metaball-controls">
          <label class="metaball-control">
            <span class="metaball-control__row">
              <span class="metaball-control__label">等值面阈值</span>
              <span class="metaball-control__value" data-metaball-control-output="iso"></span>
            </span>
            <input
              class="metaball-control__range"
              data-metaball-control="iso"
              type="range"
              min="0.62"
              max="0.92"
              step="0.01"
              value="0.74"
            />
          </label>

          <label class="metaball-control">
            <span class="metaball-control__row">
              <span class="metaball-control__label">势场强度</span>
              <span class="metaball-control__value" data-metaball-control-output="gain"></span>
            </span>
            <input
              class="metaball-control__range"
              data-metaball-control="gain"
              type="range"
              min="0.80"
              max="1.35"
              step="0.01"
              value="1.02"
            />
          </label>

          <label class="metaball-control">
            <span class="metaball-control__row">
              <span class="metaball-control__label">球心分离</span>
              <span class="metaball-control__value" data-metaball-control-output="orbit"></span>
            </span>
            <input
              class="metaball-control__range"
              data-metaball-control="orbit"
              type="range"
              min="0.44"
              max="0.86"
              step="0.01"
              value="0.64"
            />
          </label>

          <label class="metaball-control">
            <span class="metaball-control__row">
              <span class="metaball-control__label">动画速度</span>
              <span class="metaball-control__value" data-metaball-control-output="speed"></span>
            </span>
            <input
              class="metaball-control__range"
              data-metaball-control="speed"
              type="range"
              min="0.35"
              max="1.80"
              step="0.05"
              value="1.00"
            />
          </label>
        </div>

        <div class="preview-frame metaball-stage__frame">
          <canvas class="preview-canvas" aria-label="Marching cubes and metaballs lesson preview"></canvas>
        </div>

        <div class="metaball-card-grid">
          <article class="metaball-card">
            <p class="metaball-card__label">生成顶点</p>
            <strong class="metaball-card__value" data-metaball-card-value="vertices"></strong>
            <p class="metaball-card__meta" data-metaball-card-meta="vertices"></p>
          </article>

          <article class="metaball-card metaball-card--cool">
            <p class="metaball-card__label">生成三角形</p>
            <strong class="metaball-card__value" data-metaball-card-value="triangles"></strong>
            <p class="metaball-card__meta" data-metaball-card-meta="triangles"></p>
          </article>

          <article class="metaball-card metaball-card--accent">
            <p class="metaball-card__label">活跃 cube cells</p>
            <strong class="metaball-card__value" data-metaball-card-value="active"></strong>
            <p class="metaball-card__meta" data-metaball-card-meta="active"></p>
          </article>

          <article class="metaball-card">
            <p class="metaball-card__label">网格分辨率</p>
            <strong class="metaball-card__value" data-metaball-card-value="resolution"></strong>
            <p class="metaball-card__meta" data-metaball-card-meta="resolution"></p>
          </article>
        </div>

        <div class="metaball-stage__legend">
          <p class="metaball-stage__legend-title">当前实验</p>
          <p class="metaball-stage__legend-body" data-metaball-legend></p>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const viewport = host.querySelector<HTMLDivElement>(".preview-viewport");
  const isoRange = host.querySelector<HTMLInputElement>('[data-metaball-control="iso"]');
  const gainRange = host.querySelector<HTMLInputElement>('[data-metaball-control="gain"]');
  const orbitRange = host.querySelector<HTMLInputElement>('[data-metaball-control="orbit"]');
  const speedRange = host.querySelector<HTMLInputElement>('[data-metaball-control="speed"]');

  if (!canvas || !viewport || !isoRange || !gainRange || !orbitRange || !speedRange) {
    throw new Error("第 44 课的预览结构没有完整创建出来。");
  }

  const refs: MarchingHudRefs = {
    computeBadge: host.querySelector<HTMLElement>('[data-metaball-badge="compute"]')!,
    gridBadge: host.querySelector<HTMLElement>('[data-metaball-badge="grid"]')!,
    metaballBadge: host.querySelector<HTMLElement>('[data-metaball-badge="balls"]')!,
    isoOutput: host.querySelector<HTMLElement>('[data-metaball-control-output="iso"]')!,
    gainOutput: host.querySelector<HTMLElement>('[data-metaball-control-output="gain"]')!,
    orbitOutput: host.querySelector<HTMLElement>('[data-metaball-control-output="orbit"]')!,
    speedOutput: host.querySelector<HTMLElement>('[data-metaball-control-output="speed"]')!,
    vertexValue: host.querySelector<HTMLElement>('[data-metaball-card-value="vertices"]')!,
    vertexMeta: host.querySelector<HTMLElement>('[data-metaball-card-meta="vertices"]')!,
    triangleValue: host.querySelector<HTMLElement>('[data-metaball-card-value="triangles"]')!,
    triangleMeta: host.querySelector<HTMLElement>('[data-metaball-card-meta="triangles"]')!,
    activeValue: host.querySelector<HTMLElement>('[data-metaball-card-value="active"]')!,
    activeMeta: host.querySelector<HTMLElement>('[data-metaball-card-meta="active"]')!,
    resolutionValue: host.querySelector<HTMLElement>('[data-metaball-card-value="resolution"]')!,
    resolutionMeta: host.querySelector<HTMLElement>('[data-metaball-card-meta="resolution"]')!,
    legendBody: host.querySelector<HTMLElement>("[data-metaball-legend]")!,
  };

  const settings: MarchingSettings = {
    isoLevel: Number.parseFloat(isoRange.value),
    fieldGain: Number.parseFloat(gainRange.value),
    orbitRadius: Number.parseFloat(orbitRange.value),
    animationSpeed: Number.parseFloat(speedRange.value),
  };

  const metrics: MarchingMetrics = {
    vertexCount: null,
    triangleCount: null,
    activeCells: null,
    pendingReadback: true,
  };

  updateHud(refs, settings, metrics);

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const geometry = createMarchingCubesLessonGeometry();
    const sceneConfigs = createSceneConfigs();
    const counterResetData = new Uint32Array([0, 1, 0, 0, 0, 0, 0, 0]);

    const syncViewport = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const compactLayout = window.matchMedia("(max-width: 1180px)").matches;
      const aspect = compactLayout ? 1.04 : 1.18;

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

    const sceneShaderModule = gpu.device.createShaderModule({ code: vertexShaderSource });
    const fragmentShaderModule = gpu.device.createShaderModule({ code: fragmentShaderSource });

    const staticPipeline = gpu.device.createRenderPipeline({
      label: "lesson-44-static-scene-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [sceneBindGroupLayout, objectBindGroupLayout],
      }),
      vertex: {
        module: sceneShaderModule,
        entryPoint: "vsStatic",
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

    const meshPipeline = gpu.device.createRenderPipeline({
      label: "lesson-44-generated-mesh-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [sceneBindGroupLayout],
      }),
      vertex: {
        module: sceneShaderModule,
        entryPoint: "vsMesh",
        buffers: [
          {
            arrayStride: 8 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x4" },
              { shaderLocation: 1, offset: 4 * 4, format: "float32x4" },
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
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const sceneUniformBuffer = gpu.device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const sceneBindGroup = gpu.device.createBindGroup({
      layout: sceneBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
    });

    const renderObjects = sceneConfigs.map((config) => {
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

    const computeUniformBuffer = gpu.device.createBuffer({
      size: 96,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const generatedVertexBuffer = gpu.device.createBuffer({
      size: MAX_GENERATED_VERTICES * 8 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
    });

    const countersBuffer = gpu.device.createBuffer({
      size: COUNTER_BUFFER_BYTES,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.INDIRECT |
        GPUBufferUsage.COPY_DST |
        GPUBufferUsage.COPY_SRC,
    });
    gpu.device.queue.writeBuffer(countersBuffer, 0, counterResetData);

    const readbackBuffer = gpu.device.createBuffer({
      size: COUNTER_BUFFER_BYTES,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-44-metaball-extraction-pipeline",
      layout: "auto",
      compute: {
        module: gpu.device.createShaderModule({ code: computeShaderSource }),
        entryPoint: "csMain",
      },
    });

    const computeBindGroup = gpu.device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: computeUniformBuffer } },
        { binding: 1, resource: { buffer: generatedVertexBuffer } },
        { binding: 2, resource: { buffer: countersBuffer } },
      ],
    });

    const depthTarget: DepthTarget = {
      texture: null,
      view: null,
      width: 0,
      height: 0,
    };

    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, -0.08, 0],
      eye: [4.6, 3.2, 5.2],
      minRadius: 4.2,
      maxRadius: 9.2,
      rotateSpeed: 0.0085,
      zoomSpeed: 0.004,
      onChange: () => render(performance.now()),
    });

    let disposed = false;
    let animationFrameId = 0;
    let lastReadbackTimeMs = -Infinity;
    let readbackPending = false;

    const requestCountersReadback = async () => {
      if (disposed || readbackPending) {
        return;
      }

      readbackPending = true;
      metrics.pendingReadback = true;
      updateHud(refs, settings, metrics);

      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-44-metrics-copy-encoder",
      });
      encoder.copyBufferToBuffer(
        countersBuffer,
        0,
        readbackBuffer,
        0,
        COUNTER_BUFFER_BYTES
      );
      gpu.device.queue.submit([encoder.finish()]);

      try {
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        const values = new Uint32Array(readbackBuffer.getMappedRange()).slice();
        readbackBuffer.unmap();

        metrics.vertexCount = values[0];
        metrics.triangleCount = Math.floor(values[0] / 3);
        metrics.activeCells = values[4];
      } catch {
        metrics.vertexCount = null;
        metrics.triangleCount = null;
        metrics.activeCells = null;
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

      const camera = orbitCamera.getSnapshot();
      const timeSeconds = timestamp * 0.001;
      const aspect = canvas.width / canvas.height;
      const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.2, aspect, 0.1, 100);
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const lightPosition: Vector3 = [
        Math.cos(timeSeconds * 0.46) * 4.8,
        4.0 + Math.sin(timeSeconds * 0.74) * 0.62,
        Math.sin(timeSeconds * 0.46) * 4.8,
      ];
      const depthView = ensureDepthTarget(depthTarget, gpu.device, canvas);

      gpu.device.queue.writeBuffer(
        sceneUniformBuffer,
        0,
        createSceneUniformData(viewProjectionMatrix, lightPosition, camera.eye)
      );
      gpu.device.queue.writeBuffer(
        computeUniformBuffer,
        0,
        createComputeUniformData(settings, timeSeconds)
      );
      gpu.device.queue.writeBuffer(countersBuffer, 0, counterResetData);

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-44-command-encoder",
      });

      const computePass = commandEncoder.beginComputePass({
        label: "lesson-44-metaball-extraction-pass",
      });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(WORKGROUP_COUNT, WORKGROUP_COUNT, WORKGROUP_COUNT);
      computePass.end();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.014, g: 0.028, b: 0.05, a: 1 },
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

      renderPass.setPipeline(staticPipeline);
      renderPass.setBindGroup(0, sceneBindGroup);
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.setIndexBuffer(indexBuffer, "uint16");

      renderObjects.forEach((object) => {
        renderPass.setBindGroup(1, object.bindGroup);
        renderPass.drawIndexed(geometry.indexCount);
      });

      renderPass.setPipeline(meshPipeline);
      renderPass.setBindGroup(0, sceneBindGroup);
      renderPass.setVertexBuffer(0, generatedVertexBuffer);
      renderPass.drawIndirect(countersBuffer, 0);
      renderPass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);

      if (timestamp - lastReadbackTimeMs >= HUD_READBACK_INTERVAL_MS) {
        lastReadbackTimeMs = timestamp;
        void requestCountersReadback();
      }
    };

    const frame = (timestamp: number) => {
      render(timestamp);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const onIsoInput = () => {
      settings.isoLevel = Number.parseFloat(isoRange.value);
      updateHud(refs, settings, metrics);
    };
    const onGainInput = () => {
      settings.fieldGain = Number.parseFloat(gainRange.value);
      updateHud(refs, settings, metrics);
    };
    const onOrbitInput = () => {
      settings.orbitRadius = Number.parseFloat(orbitRange.value);
      updateHud(refs, settings, metrics);
    };
    const onSpeedInput = () => {
      settings.animationSpeed = Number.parseFloat(speedRange.value);
      updateHud(refs, settings, metrics);
    };

    isoRange.addEventListener("input", onIsoInput);
    gainRange.addEventListener("input", onGainInput);
    orbitRange.addEventListener("input", onOrbitInput);
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
      title: "Marching Cubes 与 Metaballs 已运行",
      detail:
        "这节课会把 metaball 隐式场交给 compute 每帧重建成三角网格，再用正常 render pipeline 把它当成一张真正的 mesh 来照明。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitCamera.dispose();
      isoRange.removeEventListener("input", onIsoInput);
      gainRange.removeEventListener("input", onGainInput);
      orbitRange.removeEventListener("input", onOrbitInput);
      speedRange.removeEventListener("input", onSpeedInput);
      vertexBuffer.destroy();
      indexBuffer.destroy();
      sceneUniformBuffer.destroy();
      computeUniformBuffer.destroy();
      generatedVertexBuffer.destroy();
      countersBuffer.destroy();
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
