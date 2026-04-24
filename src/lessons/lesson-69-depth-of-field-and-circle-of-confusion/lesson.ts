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
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/screen-space-common/math";
import cocShaderSource from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/coc.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/present.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type DofSettings = {
  focusDistance: number;
  aperture: number;
  maxBlurRadius: number;
  focusDebug: boolean;
};

type DofHudRefs = {
  focusRange: HTMLInputElement;
  focusValue: HTMLElement;
  apertureRange: HTMLInputElement;
  apertureValue: HTMLElement;
  radiusRange: HTMLInputElement;
  radiusValue: HTMLElement;
  focusDebugButton: HTMLButtonElement;
  rawCard: HTMLElement;
  cocCard: HTMLElement;
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
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type DofTargets = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  viewPositionTexture: GPUTexture | null;
  viewPositionView: GPUTextureView | null;
  cocTexture: GPUTexture | null;
  cocView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  cocBindGroup: GPUBindGroup | null;
  presentBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 34;
const LIGHT_DIRECTION: Vector3 = [-0.32, -0.9, -0.18];

function formatMeters(value: number): string {
  return `${value.toFixed(1)}m`;
}

function formatPixels(value: number): string {
  return `${Math.round(value)} px`;
}

function buildSceneObjects(): SceneObjectConfig[] {
  return [
    {
      color: [0.08, 0.11, 0.15, 1],
      translation: [0, -1.02, 0],
      scale: [8.4, 0.1, 14.5],
      rotationY: 0,
    },
    {
      color: [0.14, 0.19, 0.24, 1],
      translation: [0, 2.8, -6.6],
      scale: [8.4, 3.0, 0.16],
      rotationY: 0,
    },
    {
      color: [0.12, 0.18, 0.22, 1],
      translation: [-3.3, 1.1, 0],
      scale: [0.16, 2.2, 14.5],
      rotationY: 0,
    },
    {
      color: [0.2, 0.13, 0.22, 1],
      translation: [3.3, 1.1, 0],
      scale: [0.16, 2.2, 14.5],
      rotationY: 0,
    },
    {
      color: [1.0, 0.78, 0.56, 1],
      translation: [-1.7, -0.05, 4.8],
      scale: [0.44, 1.05, 0.44],
      rotationY: 0.26,
    },
    {
      color: [0.74, 0.92, 1.0, 1],
      translation: [1.5, 0.15, 3.3],
      scale: [0.38, 0.72, 0.38],
      rotationY: -0.32,
    },
    {
      color: [0.84, 0.9, 0.62, 1],
      translation: [0.0, 0.3, 0.2],
      scale: [1.0, 1.5, 1.0],
      rotationY: 0.18,
    },
    {
      color: [0.96, 0.7, 0.88, 1],
      translation: [-1.8, 0.55, -2.6],
      scale: [0.46, 1.4, 0.46],
      rotationY: 0.12,
    },
    {
      color: [0.72, 0.84, 1.0, 1],
      translation: [1.9, 0.4, -3.6],
      scale: [0.42, 1.2, 0.42],
      rotationY: -0.28,
    },
    {
      color: [1.0, 0.9, 0.64, 1],
      translation: [0, 2.25, -4.2],
      scale: [3.6, 0.16, 0.16],
      rotationY: 0.02,
    },
    {
      color: [0.72, 0.9, 1.0, 1],
      translation: [-2.25, 1.55, -6.8],
      scale: [0.18, 1.9, 0.18],
      rotationY: 0.06,
    },
    {
      color: [1.0, 0.82, 0.94, 1],
      translation: [2.3, 1.8, -8.1],
      scale: [0.18, 2.1, 0.18],
      rotationY: -0.08,
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

function createCocUniformData(settings: DofSettings): Float32Array {
  return new Float32Array([
    settings.focusDistance,
    settings.aperture,
    settings.maxBlurRadius,
    0,
  ]);
}

function createPresentUniformData(
  width: number,
  height: number,
  settings: DofSettings
): Float32Array {
  return new Float32Array([
    1 / Math.max(width, 1),
    1 / Math.max(height, 1),
    settings.focusDistance,
    settings.aperture,
    settings.maxBlurRadius,
    settings.focusDebug ? 1 : 0,
    0.0025,
    0,
  ]);
}

function updateHud(refs: DofHudRefs, settings: DofSettings): void {
  refs.focusValue.textContent = formatMeters(settings.focusDistance);
  refs.apertureValue.textContent = settings.aperture.toFixed(2);
  refs.radiusValue.textContent = formatPixels(settings.maxBlurRadius);
  refs.focusDebugButton.classList.toggle("screen-temporal-toggle--active", settings.focusDebug);
  refs.rawCard.textContent =
    "左栏永远是未处理原图，所以焦平面移动之前，先看清前中后景本来的层次关系。";
  refs.cocCard.textContent =
    settings.focusDebug
      ? "中栏现在会更强调接近 0 的焦平面带：绿色区域说明 CoC 已经收缩到接近零。"
      : "中栏会用暖色表示近景散焦、冷色表示远景散焦；只有焦平面附近 CoC 才会收回到接近零。";
  refs.observationCard.textContent =
    settings.focusDistance < 4.5
      ? "当前焦点更靠近前景，所以近处物体会收回清晰，远处灯条和背景结构会先被拉开。"
      : settings.focusDistance > 7.5
        ? "当前焦点已经推远，中景主体会开始离焦，而更远的背景会逐渐回到相对清晰的区域。"
        : "先拖动焦距：右栏清晰区域会在前中后景之间移动，中栏 CoC 的近/远色带也会跟着重排。";
  refs.legend.textContent =
    "景深不是“整张再模糊一次”，而是每个像素先有自己的 Circle of Confusion；右栏真正做的是按这个半径去决定谁该被拉开。";
}

function createScenePipeline(device: GPUDevice): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-69-scene-pipeline",
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
      targets: [{ format: "rgba16float" }, { format: "rgba16float" }],
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

function createCocPipeline(device: GPUDevice): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: cocShaderSource });

  return device.createRenderPipeline({
    label: "lesson-69-coc-pipeline",
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsMain",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fsMain",
      targets: [{ format: "rgba16float" }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function createPresentPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: presentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-69-present-pipeline",
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

function destroyTargets(targets: DofTargets): void {
  targets.colorTexture?.destroy();
  targets.viewPositionTexture?.destroy();
  targets.cocTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.colorTexture = null;
  targets.colorView = null;
  targets.viewPositionTexture = null;
  targets.viewPositionView = null;
  targets.cocTexture = null;
  targets.cocView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.cocBindGroup = null;
  targets.presentBindGroup = null;
  targets.width = 0;
  targets.height = 0;
}

function ensureTargets(
  gpu: Awaited<ReturnType<typeof createWebGpuCanvas>>,
  targets: DofTargets,
  cocPipeline: GPURenderPipeline,
  presentPipeline: GPURenderPipeline,
  sampler: GPUSampler,
  cocUniformBuffer: GPUBuffer,
  presentUniformBuffer: GPUBuffer
): void {
  const width = gpu.context.getCurrentTexture().width;
  const height = gpu.context.getCurrentTexture().height;

  if (
    targets.width === width &&
    targets.height === height &&
    targets.colorView &&
    targets.viewPositionView &&
    targets.cocView &&
    targets.depthView &&
    targets.cocBindGroup &&
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
  targets.viewPositionTexture = gpu.device.createTexture({
    size: [width, height],
    format: "rgba16float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  targets.cocTexture = gpu.device.createTexture({
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
  targets.viewPositionView = targets.viewPositionTexture.createView();
  targets.cocView = targets.cocTexture.createView();
  targets.depthView = targets.depthTexture.createView();
  targets.cocBindGroup = gpu.device.createBindGroup({
    layout: cocPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: targets.viewPositionView },
      { binding: 2, resource: { buffer: cocUniformBuffer } },
    ],
  });
  targets.presentBindGroup = gpu.device.createBindGroup({
    layout: presentPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: targets.colorView },
      { binding: 2, resource: targets.cocView },
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
      size: 20 * 4,
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

export async function mountDepthOfFieldAndCircleOfConfusionLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--depth-of-field";
  host.innerHTML = `
    <div class="screen-temporal-stage screen-temporal-stage--depth-of-field">
      <div class="screen-temporal-badges">
        <span class="screen-temporal-badge">左：原图 / 中：CoC / 右：最终景深</span>
        <span class="screen-temporal-badge">先从深度算出 signed CoC，再决定 blur 半径</span>
        <span class="screen-temporal-badge screen-temporal-badge--cool">近景和远景会以不同方式离焦</span>
      </div>
      <div class="screen-temporal-controls">
        <label class="screen-temporal-control">
          <span>Focus Distance</span>
          <strong data-role="focus-value">5.2m</strong>
          <input data-role="focus-range" type="range" min="20" max="120" step="1" value="52" />
        </label>
        <label class="screen-temporal-control">
          <span>Aperture</span>
          <strong data-role="aperture-value">0.65</strong>
          <input data-role="aperture-range" type="range" min="20" max="120" step="1" value="65" />
        </label>
        <label class="screen-temporal-control">
          <span>Max Blur Radius</span>
          <strong data-role="radius-value">14 px</strong>
          <input data-role="radius-range" type="range" min="6" max="26" step="1" value="14" />
        </label>
        <div class="screen-temporal-control screen-temporal-control--toggle">
          <span>Focus Debug</span>
          <button type="button" class="screen-temporal-toggle" data-role="focus-debug-button">show focus band</button>
          <strong>强调 CoC 接近 0 的焦平面带</strong>
        </div>
      </div>
      <div class="screen-temporal-labels screen-temporal-labels--three">
        <article class="screen-temporal-label">
          <p class="eyebrow">Left</p>
          <strong>Raw</strong>
          <span>原始深度层次。</span>
        </article>
        <article class="screen-temporal-label screen-temporal-label--cool">
          <p class="eyebrow">Middle</p>
          <strong>CoC</strong>
          <span>近景暖色，远景冷色。</span>
        </article>
        <article class="screen-temporal-label screen-temporal-label--cool">
          <p class="eyebrow">Right</p>
          <strong>Depth of Field</strong>
          <span>按 CoC 半径合成后的最终景深。</span>
        </article>
      </div>
      <div class="screen-temporal-frame screen-temporal-frame--wide">
        <canvas class="screen-temporal-canvas" aria-label="Depth of field and circle of confusion lesson preview"></canvas>
      </div>
      <div class="screen-temporal-card-grid">
        <article class="screen-temporal-card">
          <p class="eyebrow">Raw</p>
          <strong>先看原图里的前中后景层次。</strong>
          <p data-role="raw-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">CoC</p>
          <strong>每个像素先有自己的模糊半径。</strong>
          <p data-role="coc-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">当前实验</p>
          <strong>焦点在空间里移动，而不是对整张图统一模糊。</strong>
          <p data-role="observation-card"></p>
        </article>
      </div>
      <article class="screen-temporal-legend">
        <strong>本课知识点</strong>
        <p data-role="legend-value">景深不是再做一次全图 blur；真正决定结果的是每个像素自己的 Circle of Confusion。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const focusRange = host.querySelector<HTMLInputElement>('[data-role="focus-range"]');
  const focusValue = host.querySelector<HTMLElement>('[data-role="focus-value"]');
  const apertureRange = host.querySelector<HTMLInputElement>('[data-role="aperture-range"]');
  const apertureValue = host.querySelector<HTMLElement>('[data-role="aperture-value"]');
  const radiusRange = host.querySelector<HTMLInputElement>('[data-role="radius-range"]');
  const radiusValue = host.querySelector<HTMLElement>('[data-role="radius-value"]');
  const focusDebugButton = host.querySelector<HTMLButtonElement>('[data-role="focus-debug-button"]');
  const rawCard = host.querySelector<HTMLElement>('[data-role="raw-card"]');
  const cocCard = host.querySelector<HTMLElement>('[data-role="coc-card"]');
  const observationCard = host.querySelector<HTMLElement>('[data-role="observation-card"]');
  const legend = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !focusRange ||
    !focusValue ||
    !apertureRange ||
    !apertureValue ||
    !radiusRange ||
    !radiusValue ||
    !focusDebugButton ||
    !rawCard ||
    !cocCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("第 69 课的 DOM 初始化失败。");
  }

  const refs: DofHudRefs = {
    focusRange,
    focusValue,
    apertureRange,
    apertureValue,
    radiusRange,
    radiusValue,
    focusDebugButton,
    rawCard,
    cocCard,
    observationCard,
    legend,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const scenePipeline = createScenePipeline(gpu.device);
  const cocPipeline = createCocPipeline(gpu.device);
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
  const cocUniformBuffer = gpu.device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
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
  const targets: DofTargets = {
    colorTexture: null,
    colorView: null,
    viewPositionTexture: null,
    viewPositionView: null,
    cocTexture: null,
    cocView: null,
    depthTexture: null,
    depthView: null,
    cocBindGroup: null,
    presentBindGroup: null,
    width: 0,
    height: 0,
  };
  const renderObjects = createRenderObjects(
    gpu.device,
    scenePipeline,
    buildSceneObjects()
  );

  const settings: DofSettings = {
    focusDistance: 5.2,
    aperture: 0.65,
    maxBlurRadius: 14,
    focusDebug: false,
  };

  updateHud(refs, settings);
  setStatus({
    title: "Depth of field 已运行",
    detail:
      "左栏显示原图，中栏显示 signed CoC，右栏再按 CoC 半径合成最终景深。拖动 focus distance 时，清晰区域会在前中后景之间移动。",
    tone: "ok",
  });

  const controller = createOrbitCameraController(canvas, {
    eye: [0, 1.9, 7.2],
    target: [0, 0.85, -1.2],
    minRadius: 4.5,
    maxRadius: 14,
  });

  focusRange.addEventListener("input", () => {
    settings.focusDistance = Number(focusRange.value) / 10;
    updateHud(refs, settings);
  });
  apertureRange.addEventListener("input", () => {
    settings.aperture = Number(apertureRange.value) / 100;
    updateHud(refs, settings);
  });
  radiusRange.addEventListener("input", () => {
    settings.maxBlurRadius = Number(radiusRange.value);
    updateHud(refs, settings);
  });
  focusDebugButton.addEventListener("click", () => {
    settings.focusDebug = !settings.focusDebug;
    updateHud(refs, settings);
  });

  let animationFrameId = 0;

  const renderFrame = () => {
    gpu.resize();
    ensureTargets(
      gpu,
      targets,
      cocPipeline,
      presentPipeline,
      sampler,
      cocUniformBuffer,
      presentUniformBuffer
    );

    const camera = controller.getSnapshot();
    const aspect = gpu.context.getCurrentTexture().width / gpu.context.getCurrentTexture().height;
    const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.1, aspect, CAMERA_NEAR, CAMERA_FAR);
    const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
    const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);

    gpu.device.queue.writeBuffer(
      frameUniformBuffer,
      0,
      createFrameUniformData(viewProjectionMatrix, viewMatrix)
    );
    gpu.device.queue.writeBuffer(
      cocUniformBuffer,
      0,
      createCocUniformData(settings)
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
      const modelMatrix = multiplyMatrices(
        createTranslationMatrix(
          renderObject.config.translation[0],
          renderObject.config.translation[1],
          renderObject.config.translation[2]
        ),
        multiplyMatrices(
          createRotationYMatrix(renderObject.config.rotationY),
          createScaleMatrix(
            renderObject.config.scale[0],
            renderObject.config.scale[1],
            renderObject.config.scale[2]
          )
        )
      );

      gpu.device.queue.writeBuffer(
        renderObject.uniformBuffer,
        0,
        createObjectUniformData(modelMatrix, renderObject.config.color)
      );
    });

    const commandEncoder = gpu.device.createCommandEncoder({
      label: "lesson-69-command-encoder",
    });
    const scenePass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.colorView!,
          clearValue: { r: 0.03, g: 0.03, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: targets.viewPositionView!,
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
    scenePass.setVertexBuffer(0, meshBuffers.vertexBuffer);
    scenePass.setIndexBuffer(meshBuffers.indexBuffer, "uint16");
    scenePass.setBindGroup(0, frameBindGroup);

    for (const renderObject of renderObjects) {
      scenePass.setBindGroup(1, renderObject.bindGroup);
      scenePass.drawIndexed(meshBuffers.indexCount);
    }

    scenePass.end();

    const cocPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.cocView!,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    cocPass.setPipeline(cocPipeline);
    cocPass.setBindGroup(0, targets.cocBindGroup!);
    cocPass.draw(3);
    cocPass.end();

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
    cocUniformBuffer.destroy();
    presentUniformBuffer.destroy();
    meshBuffers.vertexBuffer.destroy();
    meshBuffers.indexBuffer.destroy();
    renderObjects.forEach((renderObject) => renderObject.uniformBuffer.destroy());
  };
}
