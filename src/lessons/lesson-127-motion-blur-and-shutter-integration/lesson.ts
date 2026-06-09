import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import {
  createBoxGeometry,
  createMeshBuffers,
  type MeshBuffers,
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
import presentShaderSource from "@/lessons/lesson-127-motion-blur-and-shutter-integration/present.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-127-motion-blur-and-shutter-integration/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-127-motion-blur-and-shutter-integration/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type MotionBlurSettings = {
  shutterScale: number;
  sampleCount: number;
  velocityClampPx: number;
  freezeAnimation: boolean;
  speed: number;
};

type MotionBlurHudRefs = {
  shutterRange: HTMLInputElement;
  shutterValue: HTMLElement;
  sampleRange: HTMLInputElement;
  sampleValue: HTMLElement;
  clampRange: HTMLInputElement;
  clampValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  rawCard: HTMLElement;
  blurCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneObjectConfig = {
  color: [number, number, number, number];
  baseTranslation: Vector3;
  scale: Vector3;
  baseRotation: Vector3;
  motion:
    | { type: "static" }
    | { type: "slide-x"; amplitude: number; frequency: number; phase: number }
    | { type: "spin-z"; amplitude: number; frequency: number; phase: number }
    | { type: "spin-x"; amplitude: number; frequency: number; phase: number };
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type MotionBlurTargets = {
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
const CAMERA_FAR = 48;
const LIGHT_DIRECTION: Vector3 = [-0.36, -0.9, -0.2];

function formatPixels(value: number): string {
  return `${Math.round(value)} px`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function createSceneObjects(): SceneObjectConfig[] {
  return [
    {
      color: [0.08, 0.11, 0.15, 1],
      baseTranslation: [0, -1.12, 0],
      scale: [8.2, 0.1, 14.5],
      baseRotation: [0, 0, 0],
      motion: { type: "static" },
    },
    {
      color: [0.16, 0.22, 0.32, 1],
      baseTranslation: [-3.2, 0.9, 0],
      scale: [0.18, 2.5, 14.5],
      baseRotation: [0, 0, 0],
      motion: { type: "static" },
    },
    {
      color: [0.21, 0.14, 0.28, 1],
      baseTranslation: [3.2, 0.9, 0],
      scale: [0.18, 2.5, 14.5],
      baseRotation: [0, 0, 0],
      motion: { type: "static" },
    },
    {
      color: [1.0, 0.88, 0.62, 1],
      baseTranslation: [0, 1.8, -2.4],
      scale: [3.8, 0.12, 0.16],
      baseRotation: [0.08, 0, 0],
      motion: { type: "slide-x", amplitude: 0.9, frequency: 2.2, phase: 0.0 },
    },
    {
      color: [0.78, 0.92, 1.0, 1],
      baseTranslation: [0, 1.1, 0.4],
      scale: [0.16, 2.6, 0.16],
      baseRotation: [0, 0, 0],
      motion: { type: "slide-x", amplitude: 1.95, frequency: 1.45, phase: 0.8 },
    },
    {
      color: [1.0, 0.78, 0.92, 1],
      baseTranslation: [0, 1.1, 2.7],
      scale: [0.16, 2.9, 0.16],
      baseRotation: [0, 0, 0],
      motion: { type: "slide-x", amplitude: 1.7, frequency: 1.72, phase: 1.4 },
    },
    {
      color: [0.7, 0.9, 1.0, 1],
      baseTranslation: [0, 0.95, -4.5],
      scale: [2.4, 0.08, 0.14],
      baseRotation: [0, 0, 0],
      motion: { type: "spin-z", amplitude: 1, frequency: 3.4, phase: 0.2 },
    },
    {
      color: [1.0, 0.76, 0.68, 1],
      baseTranslation: [0, 0.95, -4.5],
      scale: [0.14, 2.4, 0.08],
      baseRotation: [0, 0, 0],
      motion: { type: "spin-z", amplitude: 1, frequency: 3.4, phase: 1.7708 },
    },
    {
      color: [0.84, 0.9, 0.64, 1],
      baseTranslation: [-1.8, 0.35, 4.4],
      scale: [0.7, 0.7, 0.7],
      baseRotation: [0, 0.35, 0],
      motion: { type: "static" },
    },
    {
      color: [0.96, 0.88, 0.54, 1],
      baseTranslation: [1.9, 0.48, 5.2],
      scale: [0.26, 1.15, 0.26],
      baseRotation: [0, -0.2, 0],
      motion: { type: "spin-x", amplitude: 1, frequency: 2.1, phase: 0.8 },
    },
  ];
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

function createPresentUniformData(
  width: number,
  height: number,
  settings: MotionBlurSettings
): Float32Array {
  return new Float32Array([
    1 / Math.max(width, 1),
    1 / Math.max(height, 1),
    settings.shutterScale,
    settings.sampleCount,
    settings.velocityClampPx,
    0.0025,
    0,
    0,
  ]);
}

function createModelMatrix(
  config: SceneObjectConfig,
  time: number,
  settings: MotionBlurSettings
): Float32Array {
  let translation: Vector3 = [...config.baseTranslation];
  let rotation: Vector3 = [...config.baseRotation];
  const motionTime = settings.freezeAnimation ? 0 : time * settings.speed;

  switch (config.motion.type) {
    case "slide-x":
      translation = [
        config.baseTranslation[0] +
          Math.sin(motionTime * config.motion.frequency + config.motion.phase) *
            config.motion.amplitude,
        config.baseTranslation[1],
        config.baseTranslation[2],
      ];
      break;
    case "spin-z":
      rotation = [
        config.baseRotation[0],
        config.baseRotation[1],
        motionTime * config.motion.frequency * 4.6 + config.motion.phase,
      ];
      break;
    case "spin-x":
      rotation = [
        motionTime * config.motion.frequency * 4.1 + config.motion.phase,
        config.baseRotation[1],
        config.baseRotation[2],
      ];
      break;
    default:
      break;
  }

  return multiplyMatrices(
    createTranslationMatrix(translation[0], translation[1], translation[2]),
    multiplyMatrices(
      createRotationYMatrix(rotation[1]),
      multiplyMatrices(
        createRotationXMatrix(rotation[0]),
        multiplyMatrices(
          createRotationZMatrix(rotation[2]),
          createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
        )
      )
    )
  );
}

function updateHud(refs: MotionBlurHudRefs, settings: MotionBlurSettings): void {
  refs.shutterValue.textContent = formatPercent(settings.shutterScale);
  refs.sampleValue.textContent = `${Math.round(settings.sampleCount)} taps`;
  refs.clampValue.textContent = formatPixels(settings.velocityClampPx);
  refs.freezeButton.classList.toggle("screen-temporal-toggle--active", settings.freezeAnimation);
  refs.rawCard.textContent =
    "左栏只显示当前帧原图：你能先看清运动几何本身的方向和速度。";
  refs.blurCard.textContent = `右栏会严格沿 velocity 方向做快门积分，当前采样数 ${Math.round(settings.sampleCount)}，拖影上限 ${formatPixels(settings.velocityClampPx)}。`;
  refs.observationCard.textContent = settings.freezeAnimation
    ? "当前已经冻结动画，所以右栏 blur 会明显收回；这说明拖影长度来自时间里的屏幕位移，而不是来自一层普通的方向模糊。"
    : settings.shutterScale > 1.1
      ? "当前快门长度偏大，高速横移灯条和旋转扇叶会拉出更长的拖影；静止区域仍然应该保持基本锐利。"
      : "先观察短快门时的 blur：你会看到只有真正移动快的区域才会沿速度方向被拉开。";
  refs.legend.textContent =
    "这节课会直接继续吃 velocity buffer：sample 方向来自屏幕空间速度，快门长度只决定它沿这个方向要积多长。";
}

function createScenePipeline(
  device: GPUDevice,
  colorFormat: GPUTextureFormat,
  velocityFormat: GPUTextureFormat
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-67-scene-pipeline",
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
    label: "lesson-67-present-pipeline",
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

function destroyTargets(targets: MotionBlurTargets): void {
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
  targets: MotionBlurTargets,
  presentPipeline: GPURenderPipeline,
  sampler: GPUSampler,
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
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  targets.velocityTexture = gpu.device.createTexture({
    size: [width, height],
    format: "rgba16float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
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
      { binding: 0, resource: sampler },
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

export async function mountMotionBlurAndShutterIntegrationLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--motion-blur";
  host.innerHTML = `
    <div class="screen-temporal-stage screen-temporal-stage--motion-blur">
      <div class="screen-temporal-badges">
        <span class="screen-temporal-badge">沿 velocity 方向积分，而不是普通方向 blur</span>
        <span class="screen-temporal-badge">快门长度会决定拖影究竟有多长</span>
        <span class="screen-temporal-badge screen-temporal-badge--cool">静止区域应该尽量保持锐利</span>
      </div>
      <div class="screen-temporal-controls">
        <label class="screen-temporal-control">
          <span>Shutter Scale</span>
          <strong data-role="shutter-value">100%</strong>
          <input data-role="shutter-range" type="range" min="35" max="180" step="1" value="100" />
        </label>
        <label class="screen-temporal-control">
          <span>Sample Count</span>
          <strong data-role="sample-value">12 taps</strong>
          <input data-role="sample-range" type="range" min="4" max="24" step="1" value="12" />
        </label>
        <label class="screen-temporal-control">
          <span>Velocity Clamp</span>
          <strong data-role="clamp-value">18 px</strong>
          <input data-role="clamp-range" type="range" min="8" max="34" step="1" value="18" />
        </label>
        <div class="screen-temporal-control screen-temporal-control--toggle">
          <span>Animation</span>
          <button type="button" class="screen-temporal-toggle" data-role="freeze-button">freeze animation</button>
          <strong>冻结以后 blur 应该迅速收回</strong>
        </div>
      </div>
      <div class="screen-temporal-labels screen-temporal-labels--two">
        <article class="screen-temporal-label">
          <p class="eyebrow">Left</p>
          <strong>当前帧原图</strong>
          <span>先看真实运动方向。</span>
        </article>
        <article class="screen-temporal-label screen-temporal-label--cool">
          <p class="eyebrow">Right</p>
          <strong>Motion Blur</strong>
          <span>沿 velocity 做时间积分以后的拖影。</span>
        </article>
      </div>
      <div class="screen-temporal-frame">
        <canvas class="screen-temporal-canvas" aria-label="Motion blur and shutter integration lesson preview"></canvas>
      </div>
      <div class="screen-temporal-card-grid">
        <article class="screen-temporal-card">
          <p class="eyebrow">Raw</p>
          <strong>先观察移动中的灯条和扇叶。</strong>
          <p data-role="raw-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">Blur</p>
          <strong>右栏只会沿 velocity 方向采样。</strong>
          <p data-role="blur-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">当前实验</p>
          <strong>Motion blur 不是另一层泛用模糊。</strong>
          <p data-role="observation-card"></p>
        </article>
      </div>
      <article class="screen-temporal-legend">
        <strong>本课知识点</strong>
        <p data-role="legend-value">这一课继续沿用 velocity buffer：快门长度只负责拉长它，方向本身仍然来自前两课已经建立好的速度场。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const shutterRange = host.querySelector<HTMLInputElement>('[data-role="shutter-range"]');
  const shutterValue = host.querySelector<HTMLElement>('[data-role="shutter-value"]');
  const sampleRange = host.querySelector<HTMLInputElement>('[data-role="sample-range"]');
  const sampleValue = host.querySelector<HTMLElement>('[data-role="sample-value"]');
  const clampRange = host.querySelector<HTMLInputElement>('[data-role="clamp-range"]');
  const clampValue = host.querySelector<HTMLElement>('[data-role="clamp-value"]');
  const freezeButton = host.querySelector<HTMLButtonElement>('[data-role="freeze-button"]');
  const rawCard = host.querySelector<HTMLElement>('[data-role="raw-card"]');
  const blurCard = host.querySelector<HTMLElement>('[data-role="blur-card"]');
  const observationCard = host.querySelector<HTMLElement>('[data-role="observation-card"]');
  const legend = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !shutterRange ||
    !shutterValue ||
    !sampleRange ||
    !sampleValue ||
    !clampRange ||
    !clampValue ||
    !freezeButton ||
    !rawCard ||
    !blurCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("第 67 课的 DOM 初始化失败。");
  }

  const refs: MotionBlurHudRefs = {
    shutterRange,
    shutterValue,
    sampleRange,
    sampleValue,
    clampRange,
    clampValue,
    freezeButton,
    rawCard,
    blurCard,
    observationCard,
    legend,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const scenePipeline = createScenePipeline(gpu.device, "rgba16float", "rgba16float");
  const presentPipeline = createPresentPipeline(gpu.device, gpu.format);
  const geometry = createBoxGeometry();
  const meshBuffers: MeshBuffers = createMeshBuffers(gpu.device, geometry);
  const frameUniformBuffer = gpu.device.createBuffer({
    size: 36 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const frameBindGroup = gpu.device.createBindGroup({
    layout: scenePipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: frameUniformBuffer } }],
  });
  const presentUniformBuffer = gpu.device.createBuffer({
    size: 8 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sampler = gpu.device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
  const targets: MotionBlurTargets = {
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

  const settings: MotionBlurSettings = {
    shutterScale: 1,
    sampleCount: 12,
    velocityClampPx: 18,
    freezeAnimation: false,
    speed: 1,
  };

  updateHud(refs, settings);
  setStatus({
    title: "Motion blur 已运行",
    detail:
      "左栏是当前帧原图，右栏会严格沿 velocity 方向做快门积分。冻结动画以后，右栏拖影应该显著收回。",
    tone: "ok",
  });

  const controller = createOrbitCameraController(canvas, {
    eye: [0, 2.1, 10.2],
    target: [0, 0.9, 0.1],
    minRadius: 5.4,
    maxRadius: 17,
  });

  shutterRange.addEventListener("input", () => {
    settings.shutterScale = Number(shutterRange.value) / 100;
    updateHud(refs, settings);
  });
  sampleRange.addEventListener("input", () => {
    settings.sampleCount = Number(sampleRange.value);
    updateHud(refs, settings);
  });
  clampRange.addEventListener("input", () => {
    settings.velocityClampPx = Number(clampRange.value);
    updateHud(refs, settings);
  });
  freezeButton.addEventListener("click", () => {
    settings.freezeAnimation = !settings.freezeAnimation;
    updateHud(refs, settings);
  });

  let animationFrameId = 0;
  let lastFrameTimeMs = 0;

  const renderFrame = (timeMs: number) => {
    const currentTime = timeMs * 0.001;
    const previousTime =
      lastFrameTimeMs === 0 || settings.freezeAnimation
        ? currentTime
        : lastFrameTimeMs * 0.001;
    lastFrameTimeMs = timeMs;

    gpu.resize();
    ensureTargets(gpu, targets, presentPipeline, sampler, presentUniformBuffer);

    const camera = controller.getSnapshot();
    const aspect = gpu.context.getCurrentTexture().width / gpu.context.getCurrentTexture().height;
    const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.15, aspect, CAMERA_NEAR, CAMERA_FAR);
    const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
    const currentViewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
    const previousViewProjectionMatrix = currentViewProjectionMatrix;

    gpu.device.queue.writeBuffer(
      frameUniformBuffer,
      0,
      createFrameUniformData(currentViewProjectionMatrix, previousViewProjectionMatrix)
    );
    gpu.device.queue.writeBuffer(
      presentUniformBuffer,
      0,
      createPresentUniformData(
        gpu.context.getCurrentTexture().width,
        gpu.context.getCurrentTexture().height,
        settings
      )
    );

    renderObjects.forEach((renderObject) => {
      const currentModelMatrix = createModelMatrix(
        renderObject.config,
        currentTime,
        settings
      );
      const previousModelMatrix = createModelMatrix(
        renderObject.config,
        previousTime,
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
      label: "lesson-67-command-encoder",
    });
    const scenePass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.colorView!,
          clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
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
