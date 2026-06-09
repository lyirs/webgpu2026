import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import {
  createBoxGeometry,
  createMeshBuffers,
} from "@/lessons/screen-space-common/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/screen-space-common/math";
import filtersShaderSource from "@/lessons/lesson-130-bilateral-filtering-and-edge-aware-blur/filters.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-130-bilateral-filtering-and-edge-aware-blur/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-130-bilateral-filtering-and-edge-aware-blur/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type BilateralSettings = {
  radius: number;
  depthSigma: number;
  normalSigma: number;
  noiseAmount: number;
};

type BilateralHudRefs = {
  radiusRange: HTMLInputElement;
  radiusValue: HTMLElement;
  depthRange: HTMLInputElement;
  depthValue: HTMLElement;
  normalRange: HTMLInputElement;
  normalValue: HTMLElement;
  noiseRange: HTMLInputElement;
  noiseValue: HTMLElement;
  rawCard: HTMLElement;
  blurCard: HTMLElement;
  edgeCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneObjectConfig = {
  color: [number, number, number, number];
  translation: Vector3;
  scale: Vector3;
  rotationY: number;
};

type RenderObject = {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type BilateralTargets = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  normalTexture: GPUTexture | null;
  normalView: GPUTextureView | null;
  positionTexture: GPUTexture | null;
  positionView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  rawTexture: GPUTexture | null;
  rawView: GPUTextureView | null;
  plainTexture: GPUTexture | null;
  plainView: GPUTextureView | null;
  edgeTexture: GPUTexture | null;
  edgeView: GPUTextureView | null;
  rawBindGroup: GPUBindGroup | null;
  plainBindGroup: GPUBindGroup | null;
  edgeBindGroup: GPUBindGroup | null;
  presentBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 28;
const LIGHT_DIRECTION: Vector3 = [-0.34, -0.9, -0.2];

function formatPixels(value: number): string {
  return `${value.toFixed(1)} px`;
}

function formatScalar(value: number): string {
  return `${value.toFixed(2)}x`;
}

function buildSceneObjects(): SceneObjectConfig[] {
  return [
    {
      color: [0.11, 0.12, 0.15, 1],
      translation: [0, -1.05, 0],
      scale: [8.2, 0.12, 8.2],
      rotationY: 0,
    },
    {
      color: [0.22, 0.18, 0.22, 1],
      translation: [0, 1.85, -3.9],
      scale: [8.2, 3.8, 0.18],
      rotationY: 0,
    },
    {
      color: [0.16, 0.24, 0.28, 1],
      translation: [-3.9, 1.85, 0],
      scale: [0.18, 3.8, 8.2],
      rotationY: 0,
    },
    {
      color: [0.42, 0.44, 0.5, 1],
      translation: [2.2, -0.55, -1.2],
      scale: [1.8, 0.82, 1.8],
      rotationY: 0.2,
    },
    {
      color: [0.82, 0.72, 0.58, 1],
      translation: [1.55, 0.05, -1.1],
      scale: [0.7, 1.05, 0.7],
      rotationY: 0.18,
    },
    {
      color: [0.74, 0.84, 1.0, 1],
      translation: [2.62, 0.34, -0.05],
      scale: [0.58, 1.62, 0.58],
      rotationY: -0.18,
    },
    {
      color: [0.92, 0.82, 0.66, 1],
      translation: [-1.15, -0.58, 0.95],
      scale: [0.86, 0.72, 0.86],
      rotationY: -0.14,
    },
    {
      color: [0.68, 0.9, 1.0, 1],
      translation: [-0.28, 0.16, 1.85],
      scale: [0.42, 1.3, 0.42],
      rotationY: 0.12,
    },
    {
      color: [1.0, 0.86, 0.74, 1],
      translation: [0.42, 0.75, 2.45],
      scale: [1.65, 0.22, 0.22],
      rotationY: 0.16,
    },
  ];
}

function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  viewMatrix: Float32Array
): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set(viewMatrix, 16);
  uniformData.set([...LIGHT_DIRECTION, 0], 32);
  return uniformData;
}

function createObjectUniformData(
  modelMatrix: Float32Array,
  color: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelMatrix, 0);
  uniformData.set(color, 16);
  return uniformData;
}

function createRawUniformData(
  width: number,
  height: number,
  settings: BilateralSettings
): Float32Array {
  return new Float32Array([
    1 / Math.max(width, 1),
    1 / Math.max(height, 1),
    settings.radius,
    settings.noiseAmount,
  ]);
}

function createPlainUniformData(
  width: number,
  height: number,
  settings: BilateralSettings
): Float32Array {
  return new Float32Array([
    1 / Math.max(width, 1),
    1 / Math.max(height, 1),
    settings.radius,
    0,
  ]);
}

function createEdgeUniformData(
  width: number,
  height: number,
  settings: BilateralSettings
): Float32Array {
  return new Float32Array([
    1 / Math.max(width, 1),
    1 / Math.max(height, 1),
    settings.radius,
    settings.depthSigma,
    settings.normalSigma,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
}

function updateHud(refs: BilateralHudRefs, settings: BilateralSettings): void {
  refs.radiusValue.textContent = formatPixels(settings.radius);
  refs.depthValue.textContent = formatScalar(settings.depthSigma);
  refs.normalValue.textContent = formatScalar(settings.normalSigma);
  refs.noiseValue.textContent = formatScalar(settings.noiseAmount);
  refs.rawCard.textContent =
    "左栏先把 noisy scalar field 直接乘回场景，所以角落和台阶附近的遮蔽虽然先出来了，但颗粒和抖动也一起暴露。";
  refs.blurCard.textContent =
    "中栏只做普通 blur：噪声会被压掉，但台阶边缘和墙角轮廓也会被一起抹宽，所以遮蔽开始“糊穿”几何边界。";
  refs.edgeCard.textContent =
    settings.depthSigma < 1.15
      ? "当前深度权重偏弱，右栏虽然还在保边，但已经开始允许更多跨边界混合。"
      : "右栏会同时看深度和法线差异，所以它允许噪声收敛，却会更谨慎地跨过台阶边和拐角。";
  refs.observationCard.textContent =
    settings.normalSigma > 1.55
      ? "法线权重已经比较强，edge-aware blur 会更偏向“同一表面内部”混合，边界保持得更紧。"
      : settings.noiseAmount > 0.72
        ? "当前噪声幅度偏高，左栏和中栏的差异会更明显：普通 blur 更容易为了降噪而牺牲边缘。"
        : "拖动半径和 sigma：这节课最重要的是看清“降噪”和“保边”不是同一件事，普通 blur 与 edge-aware blur 的取舍正好相反。";
  refs.legend.textContent =
    "双边/edge-aware blur 不只是“再模糊一次”。它会在混合时额外参考深度和法线，让同表面内的噪声被压下去，而不同表面的边界尽量别被糊穿。";
}

function createScenePipeline(device: GPUDevice): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-70-scene-pipeline",
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
      targets: [{ format: "rgba16float" }, { format: "rgba16float" }, { format: "rgba16float" }],
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

function createFullscreenPipeline(
  device: GPUDevice,
  entryPoint: "rawFs" | "plainBlurFs" | "edgeAwareFs" | "presentFs",
  format: GPUTextureFormat
): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: filtersShaderSource });

  return device.createRenderPipeline({
    label: `lesson-70-${entryPoint}-pipeline`,
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsFullscreen",
    },
    fragment: {
      module: shaderModule,
      entryPoint,
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function destroyTargets(targets: BilateralTargets): void {
  targets.colorTexture?.destroy();
  targets.normalTexture?.destroy();
  targets.positionTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.rawTexture?.destroy();
  targets.plainTexture?.destroy();
  targets.edgeTexture?.destroy();
  targets.colorTexture = null;
  targets.colorView = null;
  targets.normalTexture = null;
  targets.normalView = null;
  targets.positionTexture = null;
  targets.positionView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.rawTexture = null;
  targets.rawView = null;
  targets.plainTexture = null;
  targets.plainView = null;
  targets.edgeTexture = null;
  targets.edgeView = null;
  targets.rawBindGroup = null;
  targets.plainBindGroup = null;
  targets.edgeBindGroup = null;
  targets.presentBindGroup = null;
  targets.width = 0;
  targets.height = 0;
}

function ensureTargets(
  device: GPUDevice,
  targets: BilateralTargets,
  width: number,
  height: number,
  rawPipeline: GPURenderPipeline,
  plainPipeline: GPURenderPipeline,
  edgePipeline: GPURenderPipeline,
  presentPipeline: GPURenderPipeline,
  sampler: GPUSampler,
  rawUniformBuffer: GPUBuffer,
  plainUniformBuffer: GPUBuffer,
  edgeUniformBuffer: GPUBuffer
): void {
  if (targets.width === width && targets.height === height) {
    return;
  }

  destroyTargets(targets);

  const makeTexture = (label: string, format: GPUTextureFormat, usage: number) =>
    device.createTexture({
      label,
      size: [width, height],
      format,
      usage,
    });

  targets.colorTexture = makeTexture(
    "lesson-70-color",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.colorView = targets.colorTexture.createView();
  targets.normalTexture = makeTexture(
    "lesson-70-normal",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.normalView = targets.normalTexture.createView();
  targets.positionTexture = makeTexture(
    "lesson-70-position",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.positionView = targets.positionTexture.createView();
  targets.depthTexture = makeTexture(
    "lesson-70-depth",
    "depth24plus",
    GPUTextureUsage.RENDER_ATTACHMENT
  );
  targets.depthView = targets.depthTexture.createView();
  targets.rawTexture = makeTexture(
    "lesson-70-raw",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.rawView = targets.rawTexture.createView();
  targets.plainTexture = makeTexture(
    "lesson-70-plain",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.plainView = targets.plainTexture.createView();
  targets.edgeTexture = makeTexture(
    "lesson-70-edge",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.edgeView = targets.edgeTexture.createView();

  targets.rawBindGroup = device.createBindGroup({
    layout: rawPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: targets.normalView },
      { binding: 1, resource: targets.positionView },
      { binding: 2, resource: sampler },
      { binding: 3, resource: { buffer: rawUniformBuffer } },
    ],
  });

  targets.plainBindGroup = device.createBindGroup({
    layout: plainPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: targets.rawView },
      { binding: 1, resource: sampler },
      { binding: 2, resource: { buffer: plainUniformBuffer } },
    ],
  });

  targets.edgeBindGroup = device.createBindGroup({
    layout: edgePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: targets.rawView },
      { binding: 1, resource: targets.positionView },
      { binding: 2, resource: targets.normalView },
      { binding: 3, resource: sampler },
      { binding: 4, resource: { buffer: edgeUniformBuffer } },
    ],
  });

  targets.presentBindGroup = device.createBindGroup({
    layout: presentPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: targets.colorView },
      { binding: 1, resource: targets.rawView },
      { binding: 2, resource: targets.plainView },
      { binding: 3, resource: targets.edgeView },
      { binding: 4, resource: sampler },
    ],
  });

  targets.width = width;
  targets.height = height;
}

export async function mountBilateralFilteringAndEdgeAwareBlurLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--bilateral-filtering">
      <div class="screen-reconstruct-stage">
        <div class="screen-reconstruct-badges">
          <span class="screen-reconstruct-badge">raw noisy field</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--warm">plain blur 会糊穿边界</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--cool">edge-aware 会参考 depth / normal</span>
        </div>
        <div class="screen-reconstruct-controls">
          <label class="screen-reconstruct-control">
            <span>Blur Radius</span>
            <strong id="bilateral-radius-value"></strong>
            <input id="bilateral-radius-range" type="range" min="0.8" max="4.5" step="0.1" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Depth Sigma</span>
            <strong id="bilateral-depth-value"></strong>
            <input id="bilateral-depth-range" type="range" min="0.4" max="2.4" step="0.02" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Normal Sigma</span>
            <strong id="bilateral-normal-value"></strong>
            <input id="bilateral-normal-range" type="range" min="0.4" max="2.4" step="0.02" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Noise Amount</span>
            <strong id="bilateral-noise-value"></strong>
            <input id="bilateral-noise-range" type="range" min="0.0" max="1.0" step="0.01" />
          </label>
        </div>
        <div class="screen-reconstruct-labels screen-reconstruct-labels--three">
          <article class="screen-reconstruct-label">
            <span class="eyebrow">左栏</span>
            <strong>Raw Noisy Input</strong>
            <span>先让遮蔽成形，再把噪声完整暴露出来。</span>
          </article>
          <article class="screen-reconstruct-label">
            <span class="eyebrow">中栏</span>
            <strong>Plain Blur</strong>
            <span>只会降噪，不会顾边界，所以最容易糊穿台阶。</span>
          </article>
          <article class="screen-reconstruct-label screen-reconstruct-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Edge-aware Blur</strong>
            <span>同时参考深度和法线，让降噪更像“沿表面内扩散”。</span>
          </article>
        </div>
        <div class="screen-reconstruct-frame screen-reconstruct-frame--wide">
          <canvas class="screen-reconstruct-canvas"></canvas>
        </div>
        <div class="screen-reconstruct-card-grid">
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Raw Input</span>
            <strong id="bilateral-raw-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Plain Blur</span>
            <strong id="bilateral-blur-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Edge-aware Blur</span>
            <strong id="bilateral-edge-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">观察</span>
            <strong id="bilateral-observation-card"></strong>
          </article>
        </div>
        <article class="screen-reconstruct-legend">
          <strong>当前实验</strong>
          <span id="bilateral-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: BilateralHudRefs = {
    radiusRange: host.querySelector("#bilateral-radius-range") as HTMLInputElement,
    radiusValue: host.querySelector("#bilateral-radius-value") as HTMLElement,
    depthRange: host.querySelector("#bilateral-depth-range") as HTMLInputElement,
    depthValue: host.querySelector("#bilateral-depth-value") as HTMLElement,
    normalRange: host.querySelector("#bilateral-normal-range") as HTMLInputElement,
    normalValue: host.querySelector("#bilateral-normal-value") as HTMLElement,
    noiseRange: host.querySelector("#bilateral-noise-range") as HTMLInputElement,
    noiseValue: host.querySelector("#bilateral-noise-value") as HTMLElement,
    rawCard: host.querySelector("#bilateral-raw-card") as HTMLElement,
    blurCard: host.querySelector("#bilateral-blur-card") as HTMLElement,
    edgeCard: host.querySelector("#bilateral-edge-card") as HTMLElement,
    observationCard: host.querySelector("#bilateral-observation-card") as HTMLElement,
    legend: host.querySelector("#bilateral-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-70 缺少 canvas。");
  }

  const settings: BilateralSettings = {
    radius: 2.1,
    depthSigma: 1.5,
    normalSigma: 1.4,
    noiseAmount: 0.58,
  };

  refs.radiusRange.value = settings.radius.toString();
  refs.depthRange.value = settings.depthSigma.toString();
  refs.normalRange.value = settings.normalSigma.toString();
  refs.noiseRange.value = settings.noiseAmount.toString();
  updateHud(refs, settings);

  const gpu = await createWebGpuCanvas(canvas);
  const { device, context, format } = gpu;
  const camera = createOrbitCameraController(canvas, {
    eye: [5.6, 4.2, 6.6],
    target: [0.2, 0.2, 0.1],
    minRadius: 4.4,
    maxRadius: 13.5,
    rotateSpeed: 0.0065,
    zoomSpeed: 0.0018,
  });

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  const geometry = createBoxGeometry();
  const mesh = createMeshBuffers(device, geometry);
  const scenePipeline = createScenePipeline(device);
  const rawPipeline = createFullscreenPipeline(device, "rawFs", "rgba16float");
  const plainPipeline = createFullscreenPipeline(device, "plainBlurFs", "rgba16float");
  const edgePipeline = createFullscreenPipeline(device, "edgeAwareFs", "rgba16float");
  const presentPipeline = createFullscreenPipeline(device, "presentFs", format);

  const frameUniformBuffer = device.createBuffer({
    size: 36 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const sceneObjects = buildSceneObjects();
  const sceneBindLayout = scenePipeline.getBindGroupLayout(0);
  const renderObjects: RenderObject[] = sceneObjects.map((config) => {
    const modelMatrix = multiplyMatrices(
      createTranslationMatrix(
        config.translation[0],
        config.translation[1],
        config.translation[2]
      ),
      multiplyMatrices(
        createRotationYMatrix(config.rotationY),
        createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
      )
    );
    const uniformBuffer = device.createBuffer({
      size: 20 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, createObjectUniformData(modelMatrix, config.color));
    const bindGroup = device.createBindGroup({
      layout: sceneBindLayout,
      entries: [
        { binding: 0, resource: { buffer: frameUniformBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
      ],
    });
    return { uniformBuffer, bindGroup };
  });

  const rawUniformBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const plainUniformBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const edgeUniformBuffer = device.createBuffer({
    size: 12 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const targets: BilateralTargets = {
    colorTexture: null,
    colorView: null,
    normalTexture: null,
    normalView: null,
    positionTexture: null,
    positionView: null,
    depthTexture: null,
    depthView: null,
    rawTexture: null,
    rawView: null,
    plainTexture: null,
    plainView: null,
    edgeTexture: null,
    edgeView: null,
    rawBindGroup: null,
    plainBindGroup: null,
    edgeBindGroup: null,
    presentBindGroup: null,
    width: 0,
    height: 0,
  };

  let needsRender = true;
  let destroyed = false;
  let frameHandle = 0;

  const syncSettings = () => {
    updateHud(refs, settings);
    if (targets.width > 0 && targets.height > 0) {
      device.queue.writeBuffer(rawUniformBuffer, 0, createRawUniformData(targets.width, targets.height, settings));
      device.queue.writeBuffer(plainUniformBuffer, 0, createPlainUniformData(targets.width, targets.height, settings));
      device.queue.writeBuffer(edgeUniformBuffer, 0, createEdgeUniformData(targets.width, targets.height, settings));
    }
    needsRender = true;
  };

  refs.radiusRange.addEventListener("input", () => {
    settings.radius = Number(refs.radiusRange.value);
    syncSettings();
  });
  refs.depthRange.addEventListener("input", () => {
    settings.depthSigma = Number(refs.depthRange.value);
    syncSettings();
  });
  refs.normalRange.addEventListener("input", () => {
    settings.normalSigma = Number(refs.normalRange.value);
    syncSettings();
  });
  refs.noiseRange.addEventListener("input", () => {
    settings.noiseAmount = Number(refs.noiseRange.value);
    syncSettings();
  });

  setStatus({
    title: "双边滤波与保边模糊已运行",
    detail:
      "左栏直接暴露 noisy scalar field；中栏只做普通 blur；右栏则会在混合时同时参考深度和法线，所以边界更容易保住。",
    tone: "ok",
  });

  const renderFrame = () => {
    if (destroyed) {
      return;
    }

    gpu.resize();
    const width = canvas.width;
    const height = canvas.height;
    ensureTargets(
      device,
      targets,
      width,
      height,
      rawPipeline,
      plainPipeline,
      edgePipeline,
      presentPipeline,
      sampler,
      rawUniformBuffer,
      plainUniformBuffer,
      edgeUniformBuffer
    );
    if (needsRender || targets.width === width) {
      device.queue.writeBuffer(rawUniformBuffer, 0, createRawUniformData(width, height, settings));
      device.queue.writeBuffer(plainUniformBuffer, 0, createPlainUniformData(width, height, settings));
      device.queue.writeBuffer(edgeUniformBuffer, 0, createEdgeUniformData(width, height, settings));
    }

    const snapshot = camera.getSnapshot();
    const aspect = Math.max(width / Math.max(height, 1), 1e-4);
    const viewMatrix = createLookAtViewMatrix(snapshot.eye, snapshot.target, snapshot.up);
    const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.4, aspect, CAMERA_NEAR, CAMERA_FAR);
    const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
    device.queue.writeBuffer(frameUniformBuffer, 0, createFrameUniformData(viewProjectionMatrix, viewMatrix));

    const encoder = device.createCommandEncoder({ label: "lesson-70-command-encoder" });

    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.colorView!,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: targets.normalView!,
          clearValue: { r: 0.5, g: 0.5, b: 1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: targets.positionView!,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
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
    scenePass.setVertexBuffer(0, mesh.vertexBuffer);
    scenePass.setIndexBuffer(mesh.indexBuffer, "uint16");
    for (const renderObject of renderObjects) {
      scenePass.setBindGroup(0, renderObject.bindGroup);
      scenePass.drawIndexed(mesh.indexCount);
    }
    scenePass.end();

    const rawPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.rawView!,
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    rawPass.setPipeline(rawPipeline);
    rawPass.setBindGroup(0, targets.rawBindGroup!);
    rawPass.draw(3);
    rawPass.end();

    const plainPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.plainView!,
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    plainPass.setPipeline(plainPipeline);
    plainPass.setBindGroup(0, targets.plainBindGroup!);
    plainPass.draw(3);
    plainPass.end();

    const edgePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.edgeView!,
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    edgePass.setPipeline(edgePipeline);
    edgePass.setBindGroup(0, targets.edgeBindGroup!);
    edgePass.draw(3);
    edgePass.end();

    const presentPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.03, g: 0.05, b: 0.08, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    presentPass.setPipeline(presentPipeline);
    presentPass.setBindGroup(0, targets.presentBindGroup!);
    presentPass.draw(3);
    presentPass.end();

    device.queue.submit([encoder.finish()]);
    needsRender = false;
    frameHandle = window.requestAnimationFrame(renderFrame);
  };

  frameHandle = window.requestAnimationFrame(renderFrame);

  return () => {
    destroyed = true;
    window.cancelAnimationFrame(frameHandle);
    camera.dispose();
    destroyTargets(targets);
    mesh.vertexBuffer.destroy();
    mesh.indexBuffer.destroy();
    frameUniformBuffer.destroy();
    rawUniformBuffer.destroy();
    plainUniformBuffer.destroy();
    edgeUniformBuffer.destroy();
    for (const renderObject of renderObjects) {
      renderObject.uniformBuffer.destroy();
    }
  };
}
