import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createOitMotivationLessonGeometry } from "@/lessons/lesson-54-oit-motivation/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-54-oit-motivation/math";
import sceneFragmentShaderSource from "@/lessons/lesson-54-oit-motivation/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-54-oit-motivation/scene.vert.wgsl?raw";

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

type OitMotivationSettings = {
  alpha: number;
  spread: number;
  tilt: number;
  orbitSpeed: number;
};

type OitMotivationMetrics = {
  fixedOrderLabel: string;
  sortedOrderLabel: string;
  reorderCount: number;
};

type OitMotivationHudRefs = {
  orderBadge: HTMLElement;
  sortBadge: HTMLElement;
  issueBadge: HTMLElement;
  alphaOutput: HTMLElement;
  spreadOutput: HTMLElement;
  tiltOutput: HTMLElement;
  orbitOutput: HTMLElement;
  fixedValue: HTMLElement;
  fixedMeta: HTMLElement;
  sortedValue: HTMLElement;
  sortedMeta: HTMLElement;
  crossingValue: HTMLElement;
  crossingMeta: HTMLElement;
  motivationValue: HTMLElement;
  motivationMeta: HTMLElement;
  legendBody: HTMLElement;
};

const CAMERA_FOV = Math.PI / 3.15;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 22;
const SCENE_UNIFORM_BYTES = 128;
const OBJECT_UNIFORM_BYTES = 80;
const CLEAR_COLOR: GPUColor = { r: 0.03, g: 0.05, b: 0.09, a: 1 };
const LIGHT_DIRECTION: Vector3 = [-0.46, 0.84, 0.31];
const FIXED_ORDER_INDICES = [0, 1, 2, 3] as const;
const PANE_DISPLAY_NAMES = ["青", "琥珀", "紫", "绿"] as const;

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

function formatAlpha(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSpread(value: number): string {
  return `${value.toFixed(2)}x`;
}

function formatTilt(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatOrbitSpeed(value: number): string {
  return `${value.toFixed(2)}x`;
}

function formatReorderCount(value: number): string {
  return `${value} 次`;
}

function paneDisplayName(index: number): string {
  return PANE_DISPLAY_NAMES[index] ?? `#${index}`;
}

function formatOrderLabel(indices: readonly number[]): string {
  return indices.map((index) => paneDisplayName(index)).join(" → ");
}

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

function createTransparentConfigs(settings: OitMotivationSettings): SceneObjectConfig[] {
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

function createObjectUniformData(
  modelMatrix: Float32Array,
  color: Color4
): Float32Array {
  const data = new Float32Array(20);
  data.set(modelMatrix, 0);
  data.set(color, 16);
  return data;
}

function createSceneUniformData(
  viewProjectionMatrix: Float32Array,
  eyePosition: Vector3
): ArrayBuffer {
  const buffer = new ArrayBuffer(SCENE_UNIFORM_BYTES);
  const floats = new Float32Array(buffer);

  floats.set(viewProjectionMatrix, 0);
  floats.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 16);
  floats.set([LIGHT_DIRECTION[0], LIGHT_DIRECTION[1], LIGHT_DIRECTION[2], 0], 20);
  floats.set([0.12, 0.14, 0.19, 1], 24);

  return buffer;
}

function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
  target.width = 0;
  target.height = 0;
}

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

function createPanelRects(canvas: HTMLCanvasElement): {
  left: PanelRect;
  right: PanelRect;
} {
  const halfWidth = Math.floor(canvas.width * 0.5);

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

function rotateAroundYAxis(point: Vector3, radians: number): Vector3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return [
    point[0] * cosine - point[2] * sine,
    point[1],
    point[0] * sine + point[2] * cosine,
  ];
}

function applyAutoOrbit(
  eye: Vector3,
  target: Vector3,
  timeSeconds: number,
  orbitSpeed: number
): Vector3 {
  if (orbitSpeed <= 0.0001) {
    return eye;
  }

  const relative: Vector3 = [
    eye[0] - target[0],
    eye[1] - target[1],
    eye[2] - target[2],
  ];
  const rotated = rotateAroundYAxis(relative, timeSeconds * orbitSpeed * 0.38);

  return [
    target[0] + rotated[0],
    target[1] + rotated[1],
    target[2] + rotated[2],
  ];
}

function transformPoint(matrix: Float32Array, point: Vector3): Vector3 {
  return [
    matrix[0] * point[0] + matrix[4] * point[1] + matrix[8] * point[2] + matrix[12],
    matrix[1] * point[0] + matrix[5] * point[1] + matrix[9] * point[2] + matrix[13],
    matrix[2] * point[0] + matrix[6] * point[1] + matrix[10] * point[2] + matrix[14],
  ];
}

function sortTransparentIndices(
  configs: SceneObjectConfig[],
  viewMatrix: Float32Array
): number[] {
  return configs
    .map((config, index) => {
      const viewPosition = transformPoint(viewMatrix, config.translation);
      return {
        index,
        depth: -viewPosition[2],
      };
    })
    .sort((left, right) => {
      if (right.depth !== left.depth) {
        return right.depth - left.depth;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.index);
}

function createMetrics(sortedOrder: readonly number[]): OitMotivationMetrics {
  const fixedOrderLabel = formatOrderLabel(FIXED_ORDER_INDICES);
  const sortedOrderLabel = formatOrderLabel(sortedOrder);
  let reorderCount = 0;

  sortedOrder.forEach((value, index) => {
    if (value !== FIXED_ORDER_INDICES[index]) {
      reorderCount += 1;
    }
  });

  return {
    fixedOrderLabel,
    sortedOrderLabel,
    reorderCount,
  };
}

function createLegendCopy(
  settings: OitMotivationSettings,
  metrics: OitMotivationMetrics
): string {
  if (metrics.reorderCount === 0) {
    return settings.orbitSpeed > 0.0001
      ? "右侧现在还没改 draw order，但随着相机继续绕行，对象中心排序很快就会开始换位。关键问题是：即便右侧换了顺序，这些玻璃薄片依旧彼此穿过，所以全局对象顺序仍然只是近似。"
      : "当前视角下，右侧对象中心排序恰好还没改 draw order；你拖到侧面以后，右侧顺序就会变化。但即使改了对象顺序，交叉薄片也没有一个对所有像素都正确的全局排列。";
  }

  return `右侧当前已经改成 ${metrics.sortedOrderLabel}，说明 CPU 对象排序确实在工作；可这些玻璃薄片相互穿过，某些像素需要的前后关系和另一些像素相反，所以对象级排序仍然不够，这正是 OIT 的动机。`;
}

function updateHud(
  refs: OitMotivationHudRefs,
  settings: OitMotivationSettings,
  metrics: OitMotivationMetrics
): void {
  refs.orderBadge.textContent = `固定提交顺序 · ${metrics.fixedOrderLabel}`;
  refs.sortBadge.textContent = `右侧对象中心排序 · ${metrics.sortedOrderLabel}`;

  refs.issueBadge.className =
    metrics.reorderCount === 0
      ? "abuffer-badge"
      : "abuffer-badge abuffer-badge--warn";
  refs.issueBadge.textContent =
    metrics.reorderCount === 0
      ? "当前视角顺序暂未改动"
      : `已换位 ${formatReorderCount(metrics.reorderCount)} · 但仍非像素级正确`;

  refs.alphaOutput.textContent = formatAlpha(settings.alpha);
  refs.spreadOutput.textContent = formatSpread(settings.spread);
  refs.tiltOutput.textContent = formatTilt(settings.tilt);
  refs.orbitOutput.textContent = formatOrbitSpeed(settings.orbitSpeed);

  refs.fixedValue.textContent = `${TRANSPARENT_PANES.length} 片`;
  refs.fixedMeta.textContent = `左侧始终按 ${metrics.fixedOrderLabel} 直接 alpha blend。`;

  refs.sortedValue.textContent = formatReorderCount(metrics.reorderCount);
  refs.sortedMeta.textContent = `右侧当前对象中心排序：${metrics.sortedOrderLabel}。`;

  refs.crossingValue.textContent = `${TRANSPARENT_PANES.length} 片`;
  refs.crossingMeta.textContent =
    "它们不是一层层完全分开的玻璃，而是相互穿过的薄片，所以局部像素的前后关系会互相冲突。";

  refs.motivationValue.textContent = "仍会错";
  refs.motivationMeta.textContent =
    "下一课会改成每像素收集透明片元，不再继续赌单个对象顺序。";

  refs.legendBody.textContent = createLegendCopy(settings, metrics);
}

export async function mountOitMotivationLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<(() => void) | void> {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--abuffer">
      <div class="abuffer-stage">
        <div class="abuffer-stage__badges">
          <span class="abuffer-badge" data-oit-badge="order"></span>
          <span class="abuffer-badge abuffer-badge--cool" data-oit-badge="sort"></span>
          <span class="abuffer-badge" data-oit-badge="issue"></span>
        </div>

        <div class="abuffer-controls">
          <label class="abuffer-control">
            <span class="abuffer-control__row">
              <span class="abuffer-control__label">透明度</span>
              <span class="abuffer-control__value" data-oit-control-output="alpha"></span>
            </span>
            <input
              class="abuffer-control__range"
              data-oit-control="alpha"
              type="range"
              min="0.28"
              max="0.72"
              step="0.02"
              value="0.46"
            />
          </label>

          <label class="abuffer-control">
            <span class="abuffer-control__row">
              <span class="abuffer-control__label">交叠幅度</span>
              <span class="abuffer-control__value" data-oit-control-output="spread"></span>
            </span>
            <input
              class="abuffer-control__range"
              data-oit-control="spread"
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
              <span class="abuffer-control__value" data-oit-control-output="tilt"></span>
            </span>
            <input
              class="abuffer-control__range"
              data-oit-control="tilt"
              type="range"
              min="0.00"
              max="1.00"
              step="0.05"
              value="0.55"
            />
          </label>

          <label class="abuffer-control">
            <span class="abuffer-control__row">
              <span class="abuffer-control__label">自动绕行</span>
              <span class="abuffer-control__value" data-oit-control-output="orbit"></span>
            </span>
            <input
              class="abuffer-control__range"
              data-oit-control="orbit"
              type="range"
              min="0.00"
              max="1.20"
              step="0.05"
              value="0.55"
            />
          </label>
        </div>

        <div class="abuffer-stage__labels">
          <div class="abuffer-panel-label abuffer-panel-label--left">
            <span class="abuffer-panel-label__eyebrow">Fixed Order</span>
            <strong class="abuffer-panel-label__title">提交顺序不变，直接混色</strong>
          </div>
          <div class="abuffer-panel-label abuffer-panel-label--right">
            <span class="abuffer-panel-label__eyebrow">CPU Object Sort</span>
            <strong class="abuffer-panel-label__title">按对象中心 back-to-front 排序</strong>
          </div>
        </div>

        <div class="preview-frame abuffer-stage__frame">
          <canvas class="preview-canvas" aria-label="Transparency sorting and OIT motivation lesson preview"></canvas>
        </div>

        <div class="abuffer-card-grid">
          <article class="abuffer-card">
            <p class="abuffer-card__label">左侧固定顺序</p>
            <strong class="abuffer-card__value" data-oit-card-value="fixed"></strong>
            <p class="abuffer-card__meta" data-oit-card-meta="fixed"></p>
          </article>

          <article class="abuffer-card abuffer-card--cool">
            <p class="abuffer-card__label">右侧当前排序</p>
            <strong class="abuffer-card__value" data-oit-card-value="sorted"></strong>
            <p class="abuffer-card__meta" data-oit-card-meta="sorted"></p>
          </article>

          <article class="abuffer-card">
            <p class="abuffer-card__label">对象间穿插</p>
            <strong class="abuffer-card__value" data-oit-card-value="crossing"></strong>
            <p class="abuffer-card__meta" data-oit-card-meta="crossing"></p>
          </article>

          <article class="abuffer-card abuffer-card--accent">
            <p class="abuffer-card__label">OIT 动机</p>
            <strong class="abuffer-card__value" data-oit-card-value="motivation"></strong>
            <p class="abuffer-card__meta" data-oit-card-meta="motivation"></p>
          </article>
        </div>

        <div class="abuffer-stage__legend">
          <p class="abuffer-stage__legend-title">当前实验</p>
          <p class="abuffer-stage__legend-body" data-oit-legend></p>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const alphaRange = host.querySelector<HTMLInputElement>('[data-oit-control="alpha"]');
  const spreadRange = host.querySelector<HTMLInputElement>('[data-oit-control="spread"]');
  const tiltRange = host.querySelector<HTMLInputElement>('[data-oit-control="tilt"]');
  const orbitRange = host.querySelector<HTMLInputElement>('[data-oit-control="orbit"]');

  if (
    !canvas ||
    !alphaRange ||
    !spreadRange ||
    !tiltRange ||
    !orbitRange
  ) {
    throw new Error("第 51 课的预览结构没有完整创建出来。");
  }

  const refs: OitMotivationHudRefs = {
    orderBadge: host.querySelector<HTMLElement>('[data-oit-badge="order"]')!,
    sortBadge: host.querySelector<HTMLElement>('[data-oit-badge="sort"]')!,
    issueBadge: host.querySelector<HTMLElement>('[data-oit-badge="issue"]')!,
    alphaOutput: host.querySelector<HTMLElement>('[data-oit-control-output="alpha"]')!,
    spreadOutput: host.querySelector<HTMLElement>('[data-oit-control-output="spread"]')!,
    tiltOutput: host.querySelector<HTMLElement>('[data-oit-control-output="tilt"]')!,
    orbitOutput: host.querySelector<HTMLElement>('[data-oit-control-output="orbit"]')!,
    fixedValue: host.querySelector<HTMLElement>('[data-oit-card-value="fixed"]')!,
    fixedMeta: host.querySelector<HTMLElement>('[data-oit-card-meta="fixed"]')!,
    sortedValue: host.querySelector<HTMLElement>('[data-oit-card-value="sorted"]')!,
    sortedMeta: host.querySelector<HTMLElement>('[data-oit-card-meta="sorted"]')!,
    crossingValue: host.querySelector<HTMLElement>('[data-oit-card-value="crossing"]')!,
    crossingMeta: host.querySelector<HTMLElement>('[data-oit-card-meta="crossing"]')!,
    motivationValue: host.querySelector<HTMLElement>('[data-oit-card-value="motivation"]')!,
    motivationMeta: host.querySelector<HTMLElement>('[data-oit-card-meta="motivation"]')!,
    legendBody: host.querySelector<HTMLElement>("[data-oit-legend]")!,
  };

  const settings: OitMotivationSettings = {
    alpha: Number.parseFloat(alphaRange.value),
    spread: Number.parseFloat(spreadRange.value),
    tilt: Number.parseFloat(tiltRange.value),
    orbitSpeed: Number.parseFloat(orbitRange.value),
  };

  const initialMetrics = createMetrics(FIXED_ORDER_INDICES);
  updateHud(refs, settings, initialMetrics);

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const geometry = createOitMotivationLessonGeometry();
    const opaqueConfigs = createOpaqueSceneConfigs();

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
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
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
      label: "lesson-51-opaque-pipeline",
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
      label: "lesson-51-transparent-blend-pipeline",
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

    const sceneUniformBuffer = gpu.device.createBuffer({
      size: SCENE_UNIFORM_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const sceneBindGroup = gpu.device.createBindGroup({
      layout: sceneBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
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
          entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
        }),
      };
    };

    const opaqueObjects = opaqueConfigs.map(() => createRenderObject());
    const transparentObjects = TRANSPARENT_PANES.map(() => createRenderObject());

    const depthTarget: DepthTarget = {
      texture: null,
      view: null,
      width: 0,
      height: 0,
    };

    const orbit = createOrbitCameraController(canvas, {
      target: [0, 0, 0],
      eye: [5.8, 3.1, 5.4],
      minRadius: 3.2,
      maxRadius: 10.8,
      rotateSpeed: 0.0095,
      zoomSpeed: 0.01,
    });

    let disposed = false;
    let animationFrameId = 0;

    const drawRenderObjects = (
      pass: GPURenderPassEncoder,
      objects: RenderObject[],
      order: readonly number[]
    ) => {
      for (const index of order) {
        pass.setBindGroup(1, objects[index].bindGroup);
        pass.drawIndexed(geometry.indexCount);
      }
    };

    const updateOpaqueUniforms = () => {
      opaqueConfigs.forEach((config, index) => {
        const modelMatrix = createModelMatrix(config);
        const uniformData = createObjectUniformData(modelMatrix, config.color);
        gpu.device.queue.writeBuffer(opaqueObjects[index].uniformBuffer, 0, uniformData);
      });
    };

    const updateTransparentUniforms = (configs: SceneObjectConfig[]) => {
      configs.forEach((config, index) => {
        const modelMatrix = createModelMatrix(config);
        const uniformData = createObjectUniformData(modelMatrix, config.color);
        gpu.device.queue.writeBuffer(
          transparentObjects[index].uniformBuffer,
          0,
          uniformData
        );
      });
    };

    updateOpaqueUniforms();

    const renderFrame = (timeMs: number) => {
      if (disposed) {
        return;
      }

      gpu.resize();

      if (canvas.width === 0 || canvas.height === 0) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
        return;
      }

      ensureDepthTarget(depthTarget, gpu.device, canvas.width, canvas.height);

      if (!depthTarget.view) {
        animationFrameId = window.requestAnimationFrame(renderFrame);
        return;
      }

      const timeSeconds = timeMs * 0.001;
      const transparentConfigs = createTransparentConfigs(settings);
      updateTransparentUniforms(transparentConfigs);

      const camera = orbit.getSnapshot();
      const animatedEye = applyAutoOrbit(
        camera.eye,
        camera.target,
        timeSeconds,
        settings.orbitSpeed
      );
      const viewMatrix = createLookAtViewMatrix(animatedEye, camera.target, camera.up);
      const panelRects = createPanelRects(canvas);
      const projectionMatrix = createPerspectiveMatrix(
        CAMERA_FOV,
        panelRects.left.width / Math.max(panelRects.left.height, 1),
        CAMERA_NEAR,
        CAMERA_FAR
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const sceneUniformData = createSceneUniformData(viewProjectionMatrix, animatedEye);
      const sortedOrder = sortTransparentIndices(transparentConfigs, viewMatrix);
      const metrics = createMetrics(sortedOrder);

      updateHud(refs, settings, metrics);
      gpu.device.queue.writeBuffer(sceneUniformBuffer, 0, sceneUniformData);

      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-51-command-encoder",
      });
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: CLEAR_COLOR,
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

      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.setIndexBuffer(indexBuffer, "uint16");
      renderPass.setBindGroup(0, sceneBindGroup);

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
      renderPass.setPipeline(opaquePipeline);
      drawRenderObjects(renderPass, opaqueObjects, opaqueObjects.map((_, index) => index));
      renderPass.setPipeline(blendPipeline);
      drawRenderObjects(renderPass, transparentObjects, FIXED_ORDER_INDICES);

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
      renderPass.setPipeline(opaquePipeline);
      drawRenderObjects(renderPass, opaqueObjects, opaqueObjects.map((_, index) => index));
      renderPass.setPipeline(blendPipeline);
      drawRenderObjects(renderPass, transparentObjects, sortedOrder);
      renderPass.end();

      gpu.device.queue.submit([encoder.finish()]);
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    const bindRange = (
      input: HTMLInputElement,
      assign: (value: number) => void,
      parser: (value: string) => number
    ) => {
      const onInput = () => {
        assign(parser(input.value));
      };

      input.addEventListener("input", onInput);
      return () => {
        input.removeEventListener("input", onInput);
      };
    };

    const disposeAlpha = bindRange(alphaRange, (value) => {
      settings.alpha = value;
    }, Number.parseFloat);
    const disposeSpread = bindRange(spreadRange, (value) => {
      settings.spread = value;
    }, Number.parseFloat);
    const disposeTilt = bindRange(tiltRange, (value) => {
      settings.tilt = value;
    }, Number.parseFloat);
    const disposeOrbit = bindRange(orbitRange, (value) => {
      settings.orbitSpeed = value;
    }, Number.parseFloat);

    setStatus({
      title: "透明顺序问题与 OIT 动机已运行",
      detail:
        "左侧保持固定提交顺序，右侧尝试按对象中心 back-to-front 排序。重点不是“排序已经完美”，而是看见：对象级排序就算在工作，交叉薄片仍然会暴露出它的盲区。",
      tone: "ok",
    });

    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrameId);
      disposeAlpha();
      disposeSpread();
      disposeTilt();
      disposeOrbit();
      orbit.dispose();
      destroyDepthTarget(depthTarget);
      vertexBuffer.destroy();
      indexBuffer.destroy();
      sceneUniformBuffer.destroy();
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
