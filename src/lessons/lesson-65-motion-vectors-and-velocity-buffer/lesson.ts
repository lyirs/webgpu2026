import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import {
  createBoxGeometry,
  createMeshBuffers,
} from "@/lessons/screen-space-common/geometry";
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
} from "@/lessons/screen-space-common/math";
import presentShaderSource from "@/lessons/lesson-65-motion-vectors-and-velocity-buffer/present.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-65-motion-vectors-and-velocity-buffer/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-65-motion-vectors-and-velocity-buffer/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type MotionMode = "object" | "camera" | "combined";

type MotionVectorSettings = {
  motionMode: MotionMode;
  speed: number;
  vectorScale: number;
  freezeReference: boolean;
};

type MotionVectorHudRefs = {
  objectButton: HTMLButtonElement;
  cameraButton: HTMLButtonElement;
  combinedButton: HTMLButtonElement;
  speedRange: HTMLInputElement;
  speedValue: HTMLElement;
  vectorScaleRange: HTMLInputElement;
  vectorScaleValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  modeValue: HTMLElement;
  sourceCard: HTMLElement;
  vectorCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneObjectConfig = {
  label: string;
  color: [number, number, number, number];
  baseTranslation: Vector3;
  scale: Vector3;
  baseRotation: Vector3;
  motion:
    | { type: "static" }
    | { type: "slide-x"; amplitude: number; frequency: number; phase: number }
    | { type: "slide-z"; amplitude: number; frequency: number; phase: number }
    | { type: "spin-z"; amplitude: number; frequency: number; phase: number }
    | { type: "spin-x"; amplitude: number; frequency: number; phase: number };
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type MotionVectorTargets = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  velocityTexture: GPUTexture | null;
  velocityView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  presentBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 44;
const LIGHT_DIRECTION: Vector3 = [-0.32, -0.88, -0.24];

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSpeed(value: number): string {
  return `${value.toFixed(2)}x`;
}

function motionModeLabel(mode: MotionMode): string {
  if (mode === "camera") {
    return "只看相机运动";
  }
  if (mode === "combined") {
    return "物体 + 相机叠加";
  }
  return "只看物体运动";
}

function currentObservation(settings: MotionVectorSettings): string {
  if (settings.freezeReference) {
    return "当前已经把 reference 冻住了，所以右栏 velocity 基本会收回到接近 0；这能证明速度真的是“当前帧 vs 上一帧”的差。";
  }

  if (settings.motionMode === "camera") {
    return "现在即使物体基本不动，右栏也会出现明显速度：这说明相机运动同样会写进 velocity buffer。";
  }

  if (settings.motionMode === "combined") {
    return "当前模式会把旋转桨叶、平移物体和轻微相机摆动叠在一起，所以右栏会同时出现多方向速度。";
  }

  return "当前模式只保留物体自身运动：细长桨叶和横移小物体的速度方向会比静态走廊更显眼。";
}

function createPresentUniformData(settings: MotionVectorSettings): Float32Array {
  return new Float32Array([settings.vectorScale, 0.0025, 0, 0]);
}

function createFrameUniformData(
  currentViewProjectionMatrix: Float32Array,
  previousViewProjectionMatrix: Float32Array
): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(currentViewProjectionMatrix, 0);
  uniformData.set(previousViewProjectionMatrix, 16);
  uniformData.set([...LIGHT_DIRECTION, 0], 32);
  return uniformData;
}

function createObjectUniformData(
  currentModelMatrix: Float32Array,
  previousModelMatrix: Float32Array,
  color: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(currentModelMatrix, 0);
  uniformData.set(previousModelMatrix, 16);
  uniformData.set(color, 32);
  return uniformData;
}

function multiplyChain(...matrices: Float32Array[]): Float32Array {
  return matrices.reduce((result, matrix) => multiplyMatrices(result, matrix));
}

function createSceneObjects(): SceneObjectConfig[] {
  return [
    {
      label: "floor",
      color: [0.1, 0.14, 0.2, 1],
      baseTranslation: [0, -1.2, 0],
      scale: [8.8, 0.12, 16],
      baseRotation: [0, 0, 0],
      motion: { type: "static" },
    },
    {
      label: "left-wall",
      color: [0.12, 0.2, 0.28, 1],
      baseTranslation: [-3.5, 1.25, 0],
      scale: [0.2, 2.9, 16],
      baseRotation: [0, 0, 0],
      motion: { type: "static" },
    },
    {
      label: "right-wall",
      color: [0.18, 0.12, 0.24, 1],
      baseTranslation: [3.5, 1.25, 0],
      scale: [0.2, 2.9, 16],
      baseRotation: [0, 0, 0],
      motion: { type: "static" },
    },
    {
      label: "ceiling",
      color: [0.08, 0.11, 0.16, 1],
      baseTranslation: [0, 3.4, 0],
      scale: [8.8, 0.12, 16],
      baseRotation: [0, 0, 0],
      motion: { type: "static" },
    },
    {
      label: "slider-a",
      color: [0.98, 0.62, 0.42, 1],
      baseTranslation: [0, 0.8, -2.8],
      scale: [0.36, 1.3, 0.36],
      baseRotation: [0, 0.18, 0],
      motion: { type: "slide-x", amplitude: 1.85, frequency: 1.1, phase: 0.2 },
    },
    {
      label: "slider-b",
      color: [0.58, 0.88, 1.0, 1],
      baseTranslation: [0, 0.15, 0.4],
      scale: [0.32, 1.55, 0.32],
      baseRotation: [0, -0.22, 0],
      motion: { type: "slide-z", amplitude: 1.35, frequency: 0.92, phase: 1.1 },
    },
    {
      label: "blade-center",
      color: [1.0, 0.96, 0.76, 1],
      baseTranslation: [0, 1.7, 2.4],
      scale: [0.22, 0.22, 0.22],
      baseRotation: [0, 0, 0],
      motion: { type: "static" },
    },
    {
      label: "blade-x",
      color: [0.95, 0.74, 0.84, 1],
      baseTranslation: [0, 1.7, 2.4],
      scale: [2.2, 0.08, 0.16],
      baseRotation: [0, 0, 0],
      motion: { type: "spin-z", amplitude: 1.0, frequency: 2.2, phase: 0.0 },
    },
    {
      label: "blade-y",
      color: [0.78, 0.92, 1.0, 1],
      baseTranslation: [0, 1.7, 2.4],
      scale: [0.16, 2.2, 0.08],
      baseRotation: [0, 0, 0],
      motion: { type: "spin-z", amplitude: 1.0, frequency: 2.2, phase: 1.5708 },
    },
    {
      label: "spinner-side",
      color: [0.76, 0.92, 0.58, 1],
      baseTranslation: [2.3, 0.95, -4.2],
      scale: [0.15, 1.9, 0.15],
      baseRotation: [0, 0, 0],
      motion: { type: "spin-x", amplitude: 1.0, frequency: 1.5, phase: 0.45 },
    },
    {
      label: "marker-a",
      color: [0.92, 0.88, 0.4, 1],
      baseTranslation: [-2.1, -0.2, 4.2],
      scale: [0.6, 0.6, 0.6],
      baseRotation: [0, 0.4, 0],
      motion: { type: "static" },
    },
    {
      label: "marker-b",
      color: [0.75, 0.56, 1.0, 1],
      baseTranslation: [1.6, -0.18, 5.4],
      scale: [0.52, 1.0, 0.52],
      baseRotation: [0, -0.3, 0],
      motion: { type: "static" },
    },
  ];
}

function createModelMatrix(
  config: SceneObjectConfig,
  time: number,
  settings: MotionVectorSettings
): Float32Array {
  let translation: Vector3 = [...config.baseTranslation];
  let rotation: Vector3 = [...config.baseRotation];
  const motionEnabled =
    !settings.freezeReference &&
    (settings.motionMode === "object" || settings.motionMode === "combined");

  if (motionEnabled) {
    const scaledTime = time * settings.speed;

    switch (config.motion.type) {
      case "slide-x":
        translation = [
          config.baseTranslation[0] +
            Math.sin(scaledTime * config.motion.frequency + config.motion.phase) *
              config.motion.amplitude,
          config.baseTranslation[1],
          config.baseTranslation[2],
        ];
        break;
      case "slide-z":
        translation = [
          config.baseTranslation[0],
          config.baseTranslation[1],
          config.baseTranslation[2] +
            Math.cos(scaledTime * config.motion.frequency + config.motion.phase) *
              config.motion.amplitude,
        ];
        break;
      case "spin-z":
        rotation = [
          config.baseRotation[0],
          config.baseRotation[1],
          scaledTime * config.motion.frequency * 4.4 + config.motion.phase,
        ];
        break;
      case "spin-x":
        rotation = [
          scaledTime * config.motion.frequency * 3.8 + config.motion.phase,
          config.baseRotation[1],
          config.baseRotation[2],
        ];
        break;
      default:
        break;
    }
  }

  return multiplyChain(
    createTranslationMatrix(translation[0], translation[1], translation[2]),
    createRotationYMatrix(rotation[1]),
    createRotationXMatrix(rotation[0]),
    createRotationZMatrix(rotation[2]),
    createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
  );
}

function rotateAroundY(offset: Vector3, angle: number): Vector3 {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [
    offset[0] * cosine - offset[2] * sine,
    offset[1],
    offset[0] * sine + offset[2] * cosine,
  ];
}

function createAnimatedCamera(
  eye: Vector3,
  target: Vector3,
  time: number,
  settings: MotionVectorSettings
): { eye: Vector3; target: Vector3 } {
  const motionEnabled =
    !settings.freezeReference &&
    (settings.motionMode === "camera" || settings.motionMode === "combined");

  if (!motionEnabled) {
    return { eye, target };
  }

  const scaledTime = time * settings.speed;
  const yawOffset = Math.sin(scaledTime * 0.42) * 0.24;
  const lift = Math.cos(scaledTime * 0.34) * 0.36;
  const targetShift = Math.sin(scaledTime * 0.3) * 0.42;
  const offset = rotateAroundY(
    [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]],
    yawOffset
  );

  return {
    eye: [target[0] + offset[0], target[1] + offset[1] + lift, target[2] + offset[2]],
    target: [target[0] + targetShift, target[1] + lift * 0.2, target[2]],
  };
}

function updateHud(refs: MotionVectorHudRefs, settings: MotionVectorSettings): void {
  refs.speedValue.textContent = formatSpeed(settings.speed);
  refs.vectorScaleValue.textContent = formatPercent(settings.vectorScale);
  refs.modeValue.textContent = motionModeLabel(settings.motionMode);
  refs.freezeButton.classList.toggle(
    "screen-temporal-toggle--active",
    settings.freezeReference
  );
  refs.objectButton.classList.toggle(
    "screen-temporal-toggle--active",
    settings.motionMode === "object"
  );
  refs.cameraButton.classList.toggle(
    "screen-temporal-toggle--active",
    settings.motionMode === "camera"
  );
  refs.combinedButton.classList.toggle(
    "screen-temporal-toggle--active",
    settings.motionMode === "combined"
  );
  refs.sourceCard.textContent =
    settings.motionMode === "object"
      ? "当前只保留物体运动：右栏会最先亮起横移立柱和旋转桨叶。"
      : settings.motionMode === "camera"
        ? "当前只保留相机运动：整条走廊都会写进 velocity buffer。"
        : "当前同时叠加相机与物体运动，所以速度方向会在同一画面里互相交错。";
  refs.vectorCard.textContent =
    settings.freezeReference
      ? "reference 已冻结：当前帧和上一帧会被对齐到同一份状态，velocity 会快速收回到接近零。"
      : `右栏会把屏幕空间速度映射成方向色相与强度亮度；当前放大倍率是 ${formatPercent(settings.vectorScale)}。`;
  refs.observationCard.textContent = currentObservation(settings);
  refs.legend.textContent =
    "这一课先把 color + velocity 两个附件并排看清楚：后面的 TAA、motion blur 和 reprojection 都会继续复用同一份 velocity buffer。";
}

function createScenePipeline(
  device: GPUDevice,
  colorFormat: GPUTextureFormat,
  velocityFormat: GPUTextureFormat
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-65-scene-pipeline",
    layout: "auto",
    vertex: {
      module: vertexModule,
      entryPoint: "vsMain",
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
      entryPoint: "fsMain",
      targets: [{ format: colorFormat }, { format: velocityFormat }],
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
}

function createPresentPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: presentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-65-present-pipeline",
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsMain",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fsMain",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function destroyTargets(targets: MotionVectorTargets): void {
  targets.colorTexture?.destroy();
  targets.velocityTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.colorTexture = null;
  targets.colorView = null;
  targets.velocityTexture = null;
  targets.velocityView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.presentBindGroup = null;
  targets.width = 0;
  targets.height = 0;
}

function ensureTargets(
  gpu: Awaited<ReturnType<typeof createWebGpuCanvas>>,
  targets: MotionVectorTargets,
  presentPipeline: GPURenderPipeline,
  presentSampler: GPUSampler,
  presentUniformBuffer: GPUBuffer
): void {
  const width = gpu.context.getCurrentTexture().width;
  const height = gpu.context.getCurrentTexture().height;

  if (
    targets.width === width &&
    targets.height === height &&
    targets.colorView &&
    targets.velocityView &&
    targets.depthView &&
    targets.presentBindGroup
  ) {
    return;
  }

  destroyTargets(targets);

  targets.colorTexture = gpu.device.createTexture({
    size: [width, height],
    format: "rgba16float",
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  targets.velocityTexture = gpu.device.createTexture({
    size: [width, height],
    format: "rgba16float",
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  targets.depthTexture = gpu.device.createTexture({
    size: [width, height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  targets.colorView = targets.colorTexture.createView();
  targets.velocityView = targets.velocityTexture.createView();
  targets.depthView = targets.depthTexture.createView();
  targets.presentBindGroup = gpu.device.createBindGroup({
    layout: presentPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: presentSampler },
      { binding: 1, resource: targets.colorView },
      { binding: 2, resource: targets.velocityView },
      { binding: 3, resource: { buffer: presentUniformBuffer } },
    ],
  });
  targets.width = width;
  targets.height = height;
}

function createRenderObjects(
  device: GPUDevice,
  scenePipeline: GPURenderPipeline,
  configs: SceneObjectConfig[]
): RenderObject[] {
  return configs.map((config) => {
    const uniformBuffer = device.createBuffer({
      size: 36 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = device.createBindGroup({
      layout: scenePipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    return {
      config,
      uniformBuffer,
      bindGroup,
    };
  });
}

export async function mountMotionVectorsAndVelocityBufferLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--motion-vectors";
  host.innerHTML = `
    <div class="screen-temporal-stage screen-temporal-stage--motion-vectors">
      <div class="screen-temporal-badges">
        <span class="screen-temporal-badge">scene color + velocity buffer 双附件</span>
        <span class="screen-temporal-badge">当前帧 clip-space vs 上一帧 clip-space</span>
        <span class="screen-temporal-badge screen-temporal-badge--cool">后续 TAA / motion blur 都会继续复用它</span>
      </div>
      <div class="screen-temporal-controls">
        <div class="screen-temporal-control screen-temporal-control--toggle">
          <span>Motion Mode</span>
          <div class="screen-temporal-toggle-row" role="group" aria-label="Motion mode">
            <button type="button" class="screen-temporal-toggle screen-temporal-toggle--active" data-role="object-button">物体运动</button>
            <button type="button" class="screen-temporal-toggle" data-role="camera-button">相机运动</button>
            <button type="button" class="screen-temporal-toggle" data-role="combined-button">叠加</button>
          </div>
          <strong data-role="mode-value">只看物体运动</strong>
        </div>
        <label class="screen-temporal-control">
          <span>Speed</span>
          <strong data-role="speed-value">1.00x</strong>
          <input data-role="speed-range" type="range" min="40" max="180" step="1" value="100" />
        </label>
        <label class="screen-temporal-control">
          <span>Vector Scale</span>
          <strong data-role="vector-scale-value">100%</strong>
          <input data-role="vector-scale-range" type="range" min="50" max="220" step="1" value="100" />
        </label>
        <div class="screen-temporal-control screen-temporal-control--toggle">
          <span>Reference</span>
          <button type="button" class="screen-temporal-toggle" data-role="freeze-button">冻结 history reference</button>
          <strong>把 current / previous 对齐到同一帧</strong>
        </div>
      </div>
      <div class="screen-temporal-labels screen-temporal-labels--two">
        <article class="screen-temporal-label">
          <p class="eyebrow">Left</p>
          <strong>正常场景颜色</strong>
          <span>先看走廊里真正的物体怎么动。</span>
        </article>
        <article class="screen-temporal-label screen-temporal-label--cool">
          <p class="eyebrow">Right</p>
          <strong>Velocity Heatmap</strong>
          <span>把屏幕空间速度方向和强度直接可视化。</span>
        </article>
      </div>
      <div class="screen-temporal-frame">
        <canvas class="screen-temporal-canvas" aria-label="Motion vectors and velocity buffer lesson preview"></canvas>
      </div>
      <div class="screen-temporal-card-grid">
        <article class="screen-temporal-card">
          <p class="eyebrow">Scene Input</p>
          <strong>先画真实颜色，再同时把 velocity 写进第二个附件。</strong>
          <p data-role="source-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">Velocity Buffer</p>
          <strong>每个像素都保留“它从上一帧投影到了哪里”。</strong>
          <p data-role="vector-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">当前实验</p>
          <strong>先把 motion vectors 本身看清楚。</strong>
          <p data-role="observation-card"></p>
        </article>
      </div>
      <article class="screen-temporal-legend">
        <strong>本课知识点</strong>
        <p data-role="legend-value">这一课先把 color 和 velocity 两个附件并排看清楚，再进入后面的重投影和时间域效果。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const objectButton = host.querySelector<HTMLButtonElement>('[data-role="object-button"]');
  const cameraButton = host.querySelector<HTMLButtonElement>('[data-role="camera-button"]');
  const combinedButton = host.querySelector<HTMLButtonElement>('[data-role="combined-button"]');
  const speedRange = host.querySelector<HTMLInputElement>('[data-role="speed-range"]');
  const speedValue = host.querySelector<HTMLElement>('[data-role="speed-value"]');
  const vectorScaleRange = host.querySelector<HTMLInputElement>('[data-role="vector-scale-range"]');
  const vectorScaleValue = host.querySelector<HTMLElement>('[data-role="vector-scale-value"]');
  const freezeButton = host.querySelector<HTMLButtonElement>('[data-role="freeze-button"]');
  const modeValue = host.querySelector<HTMLElement>('[data-role="mode-value"]');
  const sourceCard = host.querySelector<HTMLElement>('[data-role="source-card"]');
  const vectorCard = host.querySelector<HTMLElement>('[data-role="vector-card"]');
  const observationCard = host.querySelector<HTMLElement>('[data-role="observation-card"]');
  const legend = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !objectButton ||
    !cameraButton ||
    !combinedButton ||
    !speedRange ||
    !speedValue ||
    !vectorScaleRange ||
    !vectorScaleValue ||
    !freezeButton ||
    !modeValue ||
    !sourceCard ||
    !vectorCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("第 65 课的 DOM 初始化失败。");
  }

  const refs: MotionVectorHudRefs = {
    objectButton,
    cameraButton,
    combinedButton,
    speedRange,
    speedValue,
    vectorScaleRange,
    vectorScaleValue,
    freezeButton,
    modeValue,
    sourceCard,
    vectorCard,
    observationCard,
    legend,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const scenePipeline = createScenePipeline(gpu.device, "rgba16float", "rgba16float");
  const presentPipeline = createPresentPipeline(gpu.device, gpu.format);
  const geometry = createBoxGeometry();
  const meshBuffers = createMeshBuffers(gpu.device, geometry);
  const frameUniformBuffer = gpu.device.createBuffer({
    size: 36 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const frameBindGroup = gpu.device.createBindGroup({
    layout: scenePipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: frameUniformBuffer } }],
  });
  const presentUniformBuffer = gpu.device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const presentSampler = gpu.device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
  const targets: MotionVectorTargets = {
    colorTexture: null,
    colorView: null,
    velocityTexture: null,
    velocityView: null,
    depthTexture: null,
    depthView: null,
    presentBindGroup: null,
    width: 0,
    height: 0,
  };
  const renderObjects = createRenderObjects(
    gpu.device,
    scenePipeline,
    createSceneObjects()
  );

  const settings: MotionVectorSettings = {
    motionMode: "object",
    speed: 1,
    vectorScale: 1,
    freezeReference: false,
  };

  updateHud(refs, settings);
  setStatus({
    title: "Velocity buffer 已运行",
    detail:
      "左栏显示真实走廊场景，右栏直接显示每个像素的屏幕空间速度方向与强度。切到“只看相机运动”时，即使模型静止，velocity 依然会出现。",
    tone: "ok",
  });

  const controller = createOrbitCameraController(canvas, {
    eye: [0, 2.2, 9.8],
    target: [0, 0.8, 0],
    minRadius: 5.2,
    maxRadius: 18,
  });

  const setMode = (motionMode: MotionMode) => {
    settings.motionMode = motionMode;
    updateHud(refs, settings);
  };

  objectButton.addEventListener("click", () => setMode("object"));
  cameraButton.addEventListener("click", () => setMode("camera"));
  combinedButton.addEventListener("click", () => setMode("combined"));
  speedRange.addEventListener("input", () => {
    settings.speed = Number(speedRange.value) / 100;
    updateHud(refs, settings);
  });
  vectorScaleRange.addEventListener("input", () => {
    settings.vectorScale = Number(vectorScaleRange.value) / 100;
    updateHud(refs, settings);
  });
  freezeButton.addEventListener("click", () => {
    settings.freezeReference = !settings.freezeReference;
    updateHud(refs, settings);
  });

  let animationFrameId = 0;
  let lastFrameTimeMs = 0;

  const renderFrame = (timeMs: number) => {
    const elapsedSeconds = timeMs * 0.001;
    const previousElapsedSeconds =
      lastFrameTimeMs === 0 || settings.freezeReference
        ? elapsedSeconds
        : lastFrameTimeMs * 0.001;
    lastFrameTimeMs = timeMs;

    gpu.resize();
    ensureTargets(
      gpu,
      targets,
      presentPipeline,
      presentSampler,
      presentUniformBuffer
    );

    const cameraSnapshot = controller.getSnapshot();
    const currentCamera = createAnimatedCamera(
      cameraSnapshot.eye,
      cameraSnapshot.target,
      elapsedSeconds,
      settings
    );
    const previousCamera = createAnimatedCamera(
      cameraSnapshot.eye,
      cameraSnapshot.target,
      previousElapsedSeconds,
      settings
    );

    const aspect = gpu.context.getCurrentTexture().width / gpu.context.getCurrentTexture().height;
    const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.1, aspect, CAMERA_NEAR, CAMERA_FAR);
    const currentViewMatrix = createLookAtViewMatrix(
      currentCamera.eye,
      currentCamera.target,
      [0, 1, 0]
    );
    const previousViewMatrix = createLookAtViewMatrix(
      previousCamera.eye,
      previousCamera.target,
      [0, 1, 0]
    );
    const currentViewProjectionMatrix = multiplyMatrices(
      projectionMatrix,
      currentViewMatrix
    );
    const previousViewProjectionMatrix = multiplyMatrices(
      projectionMatrix,
      previousViewMatrix
    );

    gpu.device.queue.writeBuffer(
      frameUniformBuffer,
      0,
      createFrameUniformData(
        currentViewProjectionMatrix,
        previousViewProjectionMatrix
      )
    );
    gpu.device.queue.writeBuffer(
      presentUniformBuffer,
      0,
      createPresentUniformData(settings)
    );

    renderObjects.forEach((renderObject) => {
      const currentModelMatrix = createModelMatrix(
        renderObject.config,
        elapsedSeconds,
        settings
      );
      const previousModelMatrix = createModelMatrix(
        renderObject.config,
        previousElapsedSeconds,
        settings
      );

      gpu.device.queue.writeBuffer(
        renderObject.uniformBuffer,
        0,
        createObjectUniformData(
          currentModelMatrix,
          previousModelMatrix,
          renderObject.config.color
        )
      );
    });

    const commandEncoder = gpu.device.createCommandEncoder({
      label: "lesson-65-command-encoder",
    });
    const scenePass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.colorView!,
          clearValue: { r: 0.035, g: 0.05, b: 0.07, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: targets.velocityView!,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: targets.depthView!,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    scenePass.setPipeline(scenePipeline);
    scenePass.setVertexBuffer(0, meshBuffers.vertexBuffer);
    scenePass.setIndexBuffer(meshBuffers.indexBuffer, "uint16");
    scenePass.setBindGroup(0, frameBindGroup);

    for (const renderObject of renderObjects) {
      scenePass.setBindGroup(1, renderObject.bindGroup);
      scenePass.drawIndexed(meshBuffers.indexCount);
    }

    scenePass.end();

    const presentPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpu.context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    presentPass.setPipeline(presentPipeline);
    presentPass.setBindGroup(0, targets.presentBindGroup!);
    presentPass.draw(3);
    presentPass.end();

    gpu.device.queue.submit([commandEncoder.finish()]);
    animationFrameId = window.requestAnimationFrame(renderFrame);
  };

  animationFrameId = window.requestAnimationFrame(renderFrame);

  return () => {
    window.cancelAnimationFrame(animationFrameId);
    controller.dispose();
    destroyTargets(targets);
    frameUniformBuffer.destroy();
    presentUniformBuffer.destroy();
    meshBuffers.vertexBuffer.destroy();
    meshBuffers.indexBuffer.destroy();
    renderObjects.forEach((renderObject) => renderObject.uniformBuffer.destroy());
  };
}
