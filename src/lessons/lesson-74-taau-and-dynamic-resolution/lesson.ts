import { createWebGpuCanvas } from "@/core/webgpu";
import {
  createBoxGeometry,
  createMeshBuffers,
} from "@/lessons/screen-space-common/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/screen-space-common/math";
import sceneFragmentShaderSource from "@/lessons/lesson-74-taau-and-dynamic-resolution/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-74-taau-and-dynamic-resolution/scene.vert.wgsl?raw";
import taauShaderSource from "@/lessons/lesson-74-taau-and-dynamic-resolution/taau.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type TaauSettings = {
  renderScale: number;
  historyBlend: number;
  sharpen: number;
  freezeCamera: boolean;
};

type TaauHudRefs = {
  scaleRange: HTMLInputElement;
  scaleValue: HTMLElement;
  historyRange: HTMLInputElement;
  historyValue: HTMLElement;
  sharpenRange: HTMLInputElement;
  sharpenValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  internalValue: HTMLElement;
  displayValue: HTMLElement;
  renderCard: HTMLElement;
  taauCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneObjectConfig = {
  translation: Vector3;
  scale: Vector3;
  color: [number, number, number, number];
};

type RenderObject = {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type TaauTargets = {
  lowColorTexture: GPUTexture | null;
  lowColorView: GPUTextureView | null;
  lowVelocityTexture: GPUTexture | null;
  lowVelocityView: GPUTextureView | null;
  lowDepthTexture: GPUTexture | null;
  lowDepthView: GPUTextureView | null;
  upscaledTextures: [GPUTexture | null, GPUTexture | null];
  upscaledViews: [GPUTextureView | null, GPUTextureView | null];
  displayWidth: number;
  displayHeight: number;
  internalWidth: number;
  internalHeight: number;
};

const LIGHT_DIRECTION: Vector3 = [-0.34, -0.88, -0.24];
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 42;
const JITTER_SEQUENCE: ReadonlyArray<[number, number]> = [
  [0.5, 1 / 3],
  [0.25, 2 / 3],
  [0.75, 1 / 9],
  [0.125, 4 / 9],
  [0.625, 7 / 9],
  [0.375, 2 / 9],
  [0.875, 5 / 9],
  [0.0625, 8 / 9],
];

function buildSceneObjects(): SceneObjectConfig[] {
  const objects: SceneObjectConfig[] = [
    { translation: [0, -1.05, 0], scale: [5.8, 0.08, 16.5], color: [0.08, 0.1, 0.14, 1] },
    { translation: [-2.8, 0.75, 0], scale: [0.12, 1.9, 16.5], color: [0.11, 0.17, 0.23, 1] },
    { translation: [2.8, 0.75, 0], scale: [0.12, 1.9, 16.5], color: [0.14, 0.1, 0.2, 1] },
  ];

  for (let lane = 0; lane < 5; lane += 1) {
    const laneX = -1.8 + lane * 0.9;
    for (let index = 0; index < 14; index += 1) {
      objects.push({
        translation: [laneX, -0.05 + (lane % 2) * 0.12, -9.5 + index * 1.45],
        scale: [0.04, 1.15 + ((lane + index) % 3) * 0.16, 0.04],
        color: lane % 2 === 0 ? [0.82, 0.88, 1.0, 1] : [1.0, 0.82, 0.74, 1],
      });
    }
  }

  for (let row = 0; row < 6; row += 1) {
    objects.push({
      translation: [0, 0.4 + row * 0.36, -6.8 + row * 2.2],
      scale: [4.1, 0.028, 0.028],
      color: row % 2 === 0 ? [0.68, 0.82, 1.0, 1] : [1.0, 0.92, 0.68, 1],
    });
  }

  return objects;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
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

function createObjectUniformData(modelMatrix: Float32Array, color: [number, number, number, number]): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(modelMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(color, 32);
  return uniformData;
}

function createTaauUniformData(
  internalWidth: number,
  internalHeight: number,
  settings: TaauSettings,
  historyValid: boolean
): Float32Array {
  return new Float32Array([
    1 / Math.max(internalWidth, 1),
    1 / Math.max(internalHeight, 1),
    settings.historyBlend,
    settings.sharpen,
    historyValid ? 1 : 0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
  ]);
}

function updateHud(refs: TaauHudRefs, settings: TaauSettings, internalWidth: number, internalHeight: number, displayWidth: number, displayHeight: number): void {
  refs.scaleValue.textContent = formatPercent(settings.renderScale);
  refs.historyValue.textContent = formatPercent(settings.historyBlend);
  refs.sharpenValue.textContent = settings.sharpen.toFixed(2);
  refs.internalValue.textContent = `${internalWidth} × ${internalHeight}`;
  refs.displayValue.textContent = `${displayWidth} × ${displayHeight}`;
  refs.freezeButton.classList.toggle("screen-reconstruct-toggle--active", settings.freezeCamera);
  refs.renderCard.textContent =
    "左栏只把低分辨率当前帧直接放大，所以远处细杆和重复线条一旦落到低分辨率里，画面就不会再凭空长回细节。";
  refs.taauCard.textContent =
    "右栏会把低分辨率当前帧、velocity 和高分辨率 history 串起来：低分辨率只负责提供“今天的新样本”，细节则通过时间慢慢重建。";
  refs.observationCard.textContent =
    settings.freezeCamera
      ? "当前已经冻结相机，但 jitter 仍在继续，所以右栏会继续收敛，左栏则只会一直停在单帧放大的状态。"
      : "当前相机会轻微摆动，所以右栏既要借历史稳住高频细节，又要避免在运动时把 history 拖脏。";
  refs.legend.textContent =
    "TAAU 的核心不是“更聪明地插值”，而是把低分辨率当前帧和高分辨率历史重建串起来，让每一帧只负责补一点点新信息。";
}

function applyProjectionJitter(
  projectionMatrix: Float32Array,
  jitterX: number,
  jitterY: number
): Float32Array {
  const result = new Float32Array(projectionMatrix);
  result[8] += jitterX;
  result[9] += jitterY;
  return result;
}

function createScenePipeline(device: GPUDevice): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });
  return device.createRenderPipeline({
    label: "lesson-74-scene-pipeline",
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

function createTaauPipeline(device: GPUDevice): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: taauShaderSource });
  return device.createRenderPipeline({
    label: "lesson-74-taau-pipeline",
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsFullscreen",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "taauFs",
      targets: [{ format: "rgba16float" }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function createPresentPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: taauShaderSource });
  return device.createRenderPipeline({
    label: "lesson-74-present-pipeline",
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsFullscreen",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "presentFs",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function destroyTargets(targets: TaauTargets): void {
  targets.lowColorTexture?.destroy();
  targets.lowVelocityTexture?.destroy();
  targets.lowDepthTexture?.destroy();
  targets.upscaledTextures[0]?.destroy();
  targets.upscaledTextures[1]?.destroy();
  targets.lowColorTexture = null;
  targets.lowColorView = null;
  targets.lowVelocityTexture = null;
  targets.lowVelocityView = null;
  targets.lowDepthTexture = null;
  targets.lowDepthView = null;
  targets.upscaledTextures = [null, null];
  targets.upscaledViews = [null, null];
  targets.displayWidth = 0;
  targets.displayHeight = 0;
  targets.internalWidth = 0;
  targets.internalHeight = 0;
}

function ensureTargets(device: GPUDevice, targets: TaauTargets, displayWidth: number, displayHeight: number, renderScale: number): void {
  const internalWidth = Math.max(1, Math.round(displayWidth * renderScale));
  const internalHeight = Math.max(1, Math.round(displayHeight * renderScale));
  if (
    targets.displayWidth === displayWidth &&
    targets.displayHeight === displayHeight &&
    targets.internalWidth === internalWidth &&
    targets.internalHeight === internalHeight
  ) {
    return;
  }

  destroyTargets(targets);

  const makeTexture = (label: string, size: [number, number], format: GPUTextureFormat, usage: number) =>
    device.createTexture({ label, size, format, usage });

  targets.lowColorTexture = makeTexture(
    "lesson-74-low-color",
    [internalWidth, internalHeight],
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.lowColorView = targets.lowColorTexture.createView();
  targets.lowVelocityTexture = makeTexture(
    "lesson-74-low-velocity",
    [internalWidth, internalHeight],
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.lowVelocityView = targets.lowVelocityTexture.createView();
  targets.lowDepthTexture = makeTexture(
    "lesson-74-low-depth",
    [internalWidth, internalHeight],
    "depth24plus",
    GPUTextureUsage.RENDER_ATTACHMENT
  );
  targets.lowDepthView = targets.lowDepthTexture.createView();

  for (let index = 0; index < 2; index += 1) {
    targets.upscaledTextures[index] = makeTexture(
      `lesson-74-upscaled-${index}`,
      [displayWidth, displayHeight],
      "rgba16float",
      GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    );
    targets.upscaledViews[index] = targets.upscaledTextures[index]!.createView();
  }

  targets.displayWidth = displayWidth;
  targets.displayHeight = displayHeight;
  targets.internalWidth = internalWidth;
  targets.internalHeight = internalHeight;
}

export async function mountTaauAndDynamicResolutionLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--taau">
      <div class="screen-reconstruct-stage">
        <div class="screen-reconstruct-badges">
          <span class="screen-reconstruct-badge">low-res render → history reconstruction</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--warm">left: naive upscale</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--cool">right: TAAU</span>
        </div>
        <div class="screen-reconstruct-controls">
          <label class="screen-reconstruct-control">
            <span>Render Scale</span>
            <strong id="taau-scale-value"></strong>
            <input id="taau-scale-range" type="range" min="0.35" max="1.0" step="0.01" />
          </label>
          <label class="screen-reconstruct-control">
            <span>History Blend</span>
            <strong id="taau-history-value"></strong>
            <input id="taau-history-range" type="range" min="0.05" max="0.95" step="0.01" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Sharpen</span>
            <strong id="taau-sharpen-value"></strong>
            <input id="taau-sharpen-range" type="range" min="0.0" max="1.0" step="0.01" />
          </label>
          <div class="screen-reconstruct-control screen-reconstruct-control--toggle">
            <span>Camera</span>
            <strong>Freeze Camera</strong>
            <div class="screen-reconstruct-toggle-row">
              <button id="taau-freeze-button" class="screen-reconstruct-toggle" type="button">冻结相机</button>
            </div>
          </div>
        </div>
        <div class="screen-reconstruct-labels screen-reconstruct-labels--two">
          <article class="screen-reconstruct-label">
            <span class="eyebrow">左栏</span>
            <strong>Naive Upscale</strong>
            <span>只是把低分辨率当前帧放大，单帧里丢掉的细节不会自己回来。</span>
          </article>
          <article class="screen-reconstruct-label screen-reconstruct-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>TAAU</strong>
            <span>低分辨率当前帧只提供新样本，细节靠 history + reprojection 慢慢重建。</span>
          </article>
        </div>
        <div class="screen-reconstruct-frame screen-reconstruct-frame--wide">
          <canvas class="screen-reconstruct-canvas"></canvas>
        </div>
        <div class="screen-reconstruct-card-grid">
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Internal Resolution</span>
            <strong id="taau-internal-value"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Display Resolution</span>
            <strong id="taau-display-value"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Naive</span>
            <strong id="taau-render-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">TAAU</span>
            <strong id="taau-result-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">观察</span>
            <strong id="taau-observation-card"></strong>
          </article>
        </div>
        <article class="screen-reconstruct-legend">
          <strong>当前实验</strong>
          <span id="taau-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: TaauHudRefs = {
    scaleRange: host.querySelector("#taau-scale-range") as HTMLInputElement,
    scaleValue: host.querySelector("#taau-scale-value") as HTMLElement,
    historyRange: host.querySelector("#taau-history-range") as HTMLInputElement,
    historyValue: host.querySelector("#taau-history-value") as HTMLElement,
    sharpenRange: host.querySelector("#taau-sharpen-range") as HTMLInputElement,
    sharpenValue: host.querySelector("#taau-sharpen-value") as HTMLElement,
    freezeButton: host.querySelector("#taau-freeze-button") as HTMLButtonElement,
    internalValue: host.querySelector("#taau-internal-value") as HTMLElement,
    displayValue: host.querySelector("#taau-display-value") as HTMLElement,
    renderCard: host.querySelector("#taau-render-card") as HTMLElement,
    taauCard: host.querySelector("#taau-result-card") as HTMLElement,
    observationCard: host.querySelector("#taau-observation-card") as HTMLElement,
    legend: host.querySelector("#taau-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-74 缺少 canvas。");
  }

  const settings: TaauSettings = {
    renderScale: 0.58,
    historyBlend: 0.84,
    sharpen: 0.36,
    freezeCamera: false,
  };
  refs.scaleRange.value = settings.renderScale.toString();
  refs.historyRange.value = settings.historyBlend.toString();
  refs.sharpenRange.value = settings.sharpen.toString();

  const gpu = await createWebGpuCanvas(canvas);
  const { device, context, format } = gpu;
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });
  const mesh = createMeshBuffers(device, createBoxGeometry());
  const scenePipeline = createScenePipeline(device);
  const taauPipeline = createTaauPipeline(device);
  const presentPipeline = createPresentPipeline(device, format);
  const frameUniformBuffer = device.createBuffer({
    size: 36 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const taauUniformBuffer = device.createBuffer({
    size: 12 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sceneBindLayout = scenePipeline.getBindGroupLayout(0);
  const renderObjects: RenderObject[] = buildSceneObjects().map((config) => {
    const modelMatrix = multiplyMatrices(
      createTranslationMatrix(
        config.translation[0],
        config.translation[1],
        config.translation[2]
      ),
      createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
    );
    const uniformBuffer = device.createBuffer({
      size: 36 * 4,
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

  const targets: TaauTargets = {
    lowColorTexture: null,
    lowColorView: null,
    lowVelocityTexture: null,
    lowVelocityView: null,
    lowDepthTexture: null,
    lowDepthView: null,
    upscaledTextures: [null, null],
    upscaledViews: [null, null],
    displayWidth: 0,
    displayHeight: 0,
    internalWidth: 0,
    internalHeight: 0,
  };

  let historyIndex = 0;
  let historyValid = false;
  let destroyed = false;
  let frameHandle = 0;
  let previousViewProjectionMatrix: Float32Array = new Float32Array(16);
  let jitterIndex = 0;

  const syncHud = () => {
    updateHud(
      refs,
      settings,
      targets.internalWidth,
      targets.internalHeight,
      targets.displayWidth,
      targets.displayHeight
    );
  };

  const resetHistory = () => {
    historyValid = false;
    historyIndex = 0;
  };

  refs.scaleRange.addEventListener("input", () => {
    settings.renderScale = Number(refs.scaleRange.value);
    resetHistory();
  });
  refs.historyRange.addEventListener("input", () => {
    settings.historyBlend = Number(refs.historyRange.value);
  });
  refs.sharpenRange.addEventListener("input", () => {
    settings.sharpen = Number(refs.sharpenRange.value);
  });
  refs.freezeButton.addEventListener("click", () => {
    settings.freezeCamera = !settings.freezeCamera;
    resetHistory();
  });

  setStatus({
    title: "TAAU 与 Dynamic Resolution 已运行",
    detail:
      "左栏只做低分辨率直接放大，右栏则会把低分辨率当前帧、velocity 和高分辨率 history 串成时间重建。",
    tone: "ok",
  });

  const renderFrame = (timestamp: number) => {
    if (destroyed) {
      return;
    }

    gpu.resize();
    const displayWidth = canvas.width;
    const displayHeight = canvas.height;
    const resized =
      targets.displayWidth !== displayWidth ||
      targets.displayHeight !== displayHeight ||
      targets.internalWidth !== Math.max(1, Math.round(displayWidth * settings.renderScale)) ||
      targets.internalHeight !== Math.max(1, Math.round(displayHeight * settings.renderScale));
    ensureTargets(device, targets, displayWidth, displayHeight, settings.renderScale);
    if (resized) {
      resetHistory();
    }

    const time = timestamp * 0.001;
    const jitter = JITTER_SEQUENCE[jitterIndex % JITTER_SEQUENCE.length];
    jitterIndex += 1;
    const jitterX = (jitter[0] * 2.0 - 1.0) / Math.max(targets.internalWidth, 1);
    const jitterY = (jitter[1] * 2.0 - 1.0) / Math.max(targets.internalHeight, 1);
    const cameraYaw = settings.freezeCamera ? 0 : Math.sin(time * 0.34) * 0.32;
    const eye: Vector3 = [
      Math.sin(cameraYaw) * 8.2,
      2.1 + Math.sin(time * 0.18) * 0.25,
      Math.cos(cameraYaw) * 8.2,
    ];
    const target: Vector3 = [0, 0.55, -0.5];
    const viewMatrix = createLookAtViewMatrix(eye, target, [0, 1, 0]);
    const baseProjection = createPerspectiveMatrix(
      Math.PI / 3.6,
      targets.internalWidth / Math.max(targets.internalHeight, 1),
      CAMERA_NEAR,
      CAMERA_FAR
    );
    const currentProjectionMatrix = applyProjectionJitter(baseProjection, jitterX, jitterY);
    const currentViewProjectionMatrix = multiplyMatrices(currentProjectionMatrix, viewMatrix);
    const previousMatrix = historyValid ? previousViewProjectionMatrix : currentViewProjectionMatrix;
    device.queue.writeBuffer(frameUniformBuffer, 0, createFrameUniformData(currentViewProjectionMatrix, previousMatrix));
    device.queue.writeBuffer(
      taauUniformBuffer,
      0,
      createTaauUniformData(targets.internalWidth, targets.internalHeight, settings, historyValid)
    );

    const readIndex = historyIndex;
    const writeIndex = (historyIndex + 1) % 2;

    const taauBindGroup = device.createBindGroup({
      layout: taauPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: targets.lowColorView! },
        { binding: 1, resource: targets.lowVelocityView! },
        { binding: 2, resource: targets.upscaledViews[readIndex]! },
        { binding: 3, resource: sampler },
        { binding: 4, resource: { buffer: taauUniformBuffer } },
      ],
    });

    const presentBindGroup = device.createBindGroup({
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: targets.lowColorView! },
        { binding: 1, resource: targets.upscaledViews[writeIndex]! },
        { binding: 2, resource: sampler },
      ],
    });

    const encoder = device.createCommandEncoder({ label: "lesson-74-command-encoder" });

    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.lowColorView!,
          clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: targets.lowVelocityView!,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: targets.lowDepthView!,
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

    const taauPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.upscaledViews[writeIndex]!,
          clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    taauPass.setPipeline(taauPipeline);
    taauPass.setBindGroup(0, taauBindGroup);
    taauPass.draw(3);
    taauPass.end();

    const presentPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    presentPass.setPipeline(presentPipeline);
    presentPass.setBindGroup(0, presentBindGroup);
    presentPass.draw(3);
    presentPass.end();

    device.queue.submit([encoder.finish()]);
    previousViewProjectionMatrix = currentViewProjectionMatrix;
    historyIndex = writeIndex;
    historyValid = true;
    syncHud();
    frameHandle = window.requestAnimationFrame(renderFrame);
  };

  frameHandle = window.requestAnimationFrame(renderFrame);

  return () => {
    destroyed = true;
    window.cancelAnimationFrame(frameHandle);
    destroyTargets(targets);
    mesh.vertexBuffer.destroy();
    mesh.indexBuffer.destroy();
    frameUniformBuffer.destroy();
    taauUniformBuffer.destroy();
    for (const renderObject of renderObjects) {
      renderObject.uniformBuffer.destroy();
    }
  };
}
