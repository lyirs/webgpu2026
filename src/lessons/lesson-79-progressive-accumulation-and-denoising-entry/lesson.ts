import { createWebGpuCanvas } from "@/core/webgpu";
import {
  createBoxGeometry,
  createMeshBuffers,
} from "@/lessons/screen-space-common/geometry";
import {
  CORNELL_CAMERA,
  createCornellRasterObjects,
  createCornellSceneStorageData,
} from "@/lessons/path-tracing-common/scene";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  crossVectors,
  normalizeVector,
  subtractVectors,
  type Vector3,
} from "@/lessons/path-tracing-common/math";
import pathTraceShaderSource from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/path-trace.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/present.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type ProgressiveSettings = {
  samplesPerFrame: number;
  maxAccumulatedFrames: number;
  denoiseStrength: number;
  freezeCamera: boolean;
};

type ProgressiveHudRefs = {
  sampleRange: HTMLInputElement;
  sampleValue: HTMLElement;
  frameRange: HTMLInputElement;
  frameValue: HTMLElement;
  denoiseRange: HTMLInputElement;
  denoiseValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  currentCard: HTMLElement;
  accumulationCard: HTMLElement;
  denoiseCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type GuideObject = {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type ProgressiveTargets = {
  normalTexture: GPUTexture | null;
  normalView: GPUTextureView | null;
  linearDepthTexture: GPUTexture | null;
  linearDepthView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  currentSampleBuffer: GPUBuffer | null;
  accumulatedBuffer: GPUBuffer | null;
  traceBindGroup: GPUBindGroup | null;
  accumulateBindGroup: GPUBindGroup | null;
  presentBindGroup: GPUBindGroup | null;
  panelWidth: number;
  panelHeight: number;
};

const CAMERA_FOV = Math.PI / 3.5;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 12;

function createGuideFrameUniformData(
  viewProjectionMatrix: Float32Array,
  viewMatrix: Float32Array
): Float32Array {
  const data = new Float32Array(32);
  data.set(viewProjectionMatrix, 0);
  data.set(viewMatrix, 16);
  return data;
}

function createGuideObjectUniformData(modelMatrix: Float32Array): Float32Array {
  const data = new Float32Array(16);
  data.set(modelMatrix, 0);
  return data;
}

function createTraceUniformData(
  panelWidth: number,
  panelHeight: number,
  settings: ProgressiveSettings,
  seed: number,
  eye: Vector3,
  target: Vector3
): Float32Array {
  const worldUp: Vector3 = [0, 1, 0];
  const forward = normalizeVector(subtractVectors(target, eye));
  const right = normalizeVector(crossVectors(forward, worldUp));
  const up = normalizeVector(crossVectors(right, forward));
  const aspect = panelWidth / Math.max(panelHeight, 1);
  const halfHeight = Math.tan(CAMERA_FOV * 0.5);
  const halfWidth = halfHeight * aspect;

  const data = new Float32Array(24);
  data.set([panelWidth, panelHeight, aspect, seed], 0);
  data.set([eye[0], eye[1], eye[2], 3], 4);
  data.set([forward[0], forward[1], forward[2], settings.samplesPerFrame], 8);
  data.set([right[0] * halfWidth, right[1] * halfWidth, right[2] * halfWidth, 0], 12);
  data.set([up[0] * halfHeight, up[1] * halfHeight, up[2] * halfHeight, 8], 16);
  data.set([0.02, 0.025, 0.04, 0], 20);
  return data;
}

function createAccumulateUniformData(
  panelWidth: number,
  panelHeight: number,
  alpha: number
): Float32Array {
  return new Float32Array([panelWidth, panelHeight, alpha, 0]);
}

function createPresentUniformData(
  panelWidth: number,
  panelHeight: number,
  settings: ProgressiveSettings
): Float32Array {
  return new Float32Array([panelWidth, panelHeight, settings.denoiseStrength, 1.15]);
}

function updateHud(
  refs: ProgressiveHudRefs,
  settings: ProgressiveSettings,
  accumulatedFrames: number
): void {
  refs.sampleValue.textContent = `${settings.samplesPerFrame} spp`;
  refs.frameValue.textContent = `${settings.maxAccumulatedFrames} frames`;
  refs.denoiseValue.textContent = `${settings.denoiseStrength.toFixed(2)}x`;
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeCamera);
  refs.currentCard.textContent =
    "左栏只看当前 sample，所以它会永远保留完整的 stochastic noise；这正是路径追踪每一帧真正交出来的原始输入。";
  refs.accumulationCard.textContent =
    accumulatedFrames > 1
      ? `中栏当前已经累计 ${accumulatedFrames} 帧，所以同样 1 spp 的 noisy 输入会被慢慢平均掉。`
      : "中栏目前还没有足够 history，所以它暂时只比左栏多了一层“准备继续累积”的状态。";
  refs.denoiseCard.textContent =
    "右栏不是凭空造干净画面，而是在累积已经开始收敛之后，再参考 normal/depth 做一层入口级 cross-bilateral 清理。";
  refs.observationCard.textContent = settings.freezeCamera
    ? "冻结相机以后，中栏和右栏会持续收敛；这正是路径追踪可用性的起点。"
    : "当前相机在缓慢摆动，所以 accumulation 每一帧都会重置；先冻结，再看 progressive accumulation 真正发挥作用。";
  refs.legend.textContent =
    "这节课的重点不是“去噪比 accumulation 更重要”，而是看清 accumulation 先把方差降下来，denoise 才能有稳定输入可用。";
}

function createGuidePipeline(device: GPUDevice): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });
  return device.createRenderPipeline({
    label: "lesson-79-guide-pipeline",
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

function createTracePipeline(device: GPUDevice): GPUComputePipeline {
  const shaderModule = device.createShaderModule({ code: pathTraceShaderSource });
  return device.createComputePipeline({
    label: "lesson-79-trace-pipeline",
    layout: "auto",
    compute: {
      module: shaderModule,
      entryPoint: "traceMain",
    },
  });
}

function createAccumulatePipeline(device: GPUDevice): GPUComputePipeline {
  const shaderModule = device.createShaderModule({ code: pathTraceShaderSource });
  return device.createComputePipeline({
    label: "lesson-79-accumulate-pipeline",
    layout: "auto",
    compute: {
      module: shaderModule,
      entryPoint: "accumulateMain",
    },
  });
}

function createPresentPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: presentShaderSource });
  return device.createRenderPipeline({
    label: "lesson-79-present-pipeline",
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsFullscreen",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fsPresent",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function destroyTargets(targets: ProgressiveTargets): void {
  targets.normalTexture?.destroy();
  targets.linearDepthTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.currentSampleBuffer?.destroy();
  targets.accumulatedBuffer?.destroy();
  targets.normalTexture = null;
  targets.normalView = null;
  targets.linearDepthTexture = null;
  targets.linearDepthView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.currentSampleBuffer = null;
  targets.accumulatedBuffer = null;
  targets.traceBindGroup = null;
  targets.accumulateBindGroup = null;
  targets.presentBindGroup = null;
  targets.panelWidth = 0;
  targets.panelHeight = 0;
}

function ensureTargets(
  device: GPUDevice,
  targets: ProgressiveTargets,
  canvasWidth: number,
  canvasHeight: number,
  tracePipeline: GPUComputePipeline,
  accumulatePipeline: GPUComputePipeline,
  presentPipeline: GPURenderPipeline,
  sampler: GPUSampler,
  sceneBuffer: GPUBuffer,
  traceUniformBuffer: GPUBuffer,
  accumulateUniformBuffer: GPUBuffer,
  presentUniformBuffer: GPUBuffer
): void {
  const panelWidth = Math.max(1, Math.floor(canvasWidth / 3));
  const panelHeight = Math.max(1, canvasHeight);
  if (targets.panelWidth === panelWidth && targets.panelHeight === panelHeight) {
    return;
  }

  destroyTargets(targets);

  targets.normalTexture = device.createTexture({
    label: "lesson-79-normal-texture",
    size: [panelWidth, panelHeight],
    format: "rgba16float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  targets.normalView = targets.normalTexture.createView();

  targets.linearDepthTexture = device.createTexture({
    label: "lesson-79-linear-depth-texture",
    size: [panelWidth, panelHeight],
    format: "rgba16float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  targets.linearDepthView = targets.linearDepthTexture.createView();

  targets.depthTexture = device.createTexture({
    label: "lesson-79-depth-texture",
    size: [panelWidth, panelHeight],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  targets.depthView = targets.depthTexture.createView();

  const bufferSize = panelWidth * panelHeight * 16;
  targets.currentSampleBuffer = device.createBuffer({
    label: "lesson-79-current-sample-buffer",
    size: bufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  targets.accumulatedBuffer = device.createBuffer({
    label: "lesson-79-accumulated-buffer",
    size: bufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  targets.traceBindGroup = device.createBindGroup({
    layout: tracePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: sceneBuffer } },
      { binding: 1, resource: { buffer: targets.currentSampleBuffer } },
      { binding: 2, resource: { buffer: traceUniformBuffer } },
    ],
  });

  targets.accumulateBindGroup = device.createBindGroup({
    layout: accumulatePipeline.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: targets.currentSampleBuffer } },
      { binding: 1, resource: { buffer: targets.accumulatedBuffer } },
      { binding: 2, resource: { buffer: accumulateUniformBuffer } },
    ],
  });

  targets.presentBindGroup = device.createBindGroup({
    layout: presentPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: targets.normalView },
      { binding: 2, resource: targets.linearDepthView },
      { binding: 3, resource: { buffer: targets.currentSampleBuffer } },
      { binding: 4, resource: { buffer: targets.accumulatedBuffer } },
      { binding: 5, resource: { buffer: presentUniformBuffer } },
    ],
  });

  targets.panelWidth = panelWidth;
  targets.panelHeight = panelHeight;
}

function currentCameraPose(timeSeconds: number, freezeCamera: boolean, frozenAngle: number): {
  eye: Vector3;
  target: Vector3;
  angle: number;
} {
  const angle = freezeCamera ? frozenAngle : timeSeconds * 0.4;
  const radius = 4.9;
  const eye: Vector3 = [
    Math.sin(angle) * radius,
    1.05 + Math.sin(angle * 0.4) * 0.12,
    Math.cos(angle) * radius,
  ];
  return {
    eye,
    target: [...CORNELL_CAMERA.target] as Vector3,
    angle,
  };
}

export async function mountProgressiveAccumulationAndDenoisingEntryLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--progressive-accumulation">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">same Cornell room, three reconstruction stages</span>
          <span class="path-trace-badge path-trace-badge--warm">left: current sample</span>
          <span class="path-trace-badge">middle: progressive accumulation</span>
          <span class="path-trace-badge path-trace-badge--cool">right: accumulation + denoise</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Samples per Frame</span>
            <strong id="progressive-sample-value"></strong>
            <input id="progressive-sample-range" type="range" min="1" max="4" step="1" />
          </label>
          <label class="path-trace-control">
            <span>Max Accumulated Frames</span>
            <strong id="progressive-frame-value"></strong>
            <input id="progressive-frame-range" type="range" min="16" max="256" step="16" />
          </label>
          <label class="path-trace-control">
            <span>Denoise Strength</span>
            <strong id="progressive-denoise-value"></strong>
            <input id="progressive-denoise-range" type="range" min="0" max="1" step="0.05" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Camera</span>
            <strong>Freeze Camera</strong>
            <div class="path-trace-toggle-row">
              <button id="progressive-freeze-button" class="path-trace-toggle" type="button">freeze</button>
            </div>
          </div>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Accumulation</span>
            <strong>Reset</strong>
            <div class="path-trace-toggle-row">
              <button id="progressive-reset-button" class="path-trace-toggle" type="button">reset</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--three">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Current Sample</strong>
            <span>每一帧真正的 stochastic radiance 输入，最 noisy，也最诚实。</span>
          </article>
          <article class="path-trace-label">
            <span class="eyebrow">中栏</span>
            <strong>Progressive Accumulation</strong>
            <span>先把方差用时间平均掉，这才是路径追踪真正开始“变稳”的地方。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Accumulation + Denoise</strong>
            <span>最后再参考 normal/depth 做一层入口级 cross-bilateral 清理。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card">
            <span class="eyebrow">Current Sample</span>
            <strong id="progressive-current-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">Progressive Accumulation</span>
            <strong id="progressive-accumulation-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">Denoise Entry</span>
            <strong id="progressive-denoise-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">观察</span>
            <strong id="progressive-observation-card"></strong>
          </article>
        </div>
        <article class="path-trace-legend">
          <strong>当前实验</strong>
          <span id="progressive-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: ProgressiveHudRefs = {
    sampleRange: host.querySelector("#progressive-sample-range") as HTMLInputElement,
    sampleValue: host.querySelector("#progressive-sample-value") as HTMLElement,
    frameRange: host.querySelector("#progressive-frame-range") as HTMLInputElement,
    frameValue: host.querySelector("#progressive-frame-value") as HTMLElement,
    denoiseRange: host.querySelector("#progressive-denoise-range") as HTMLInputElement,
    denoiseValue: host.querySelector("#progressive-denoise-value") as HTMLElement,
    freezeButton: host.querySelector("#progressive-freeze-button") as HTMLButtonElement,
    resetButton: host.querySelector("#progressive-reset-button") as HTMLButtonElement,
    currentCard: host.querySelector("#progressive-current-card") as HTMLElement,
    accumulationCard: host.querySelector("#progressive-accumulation-card") as HTMLElement,
    denoiseCard: host.querySelector("#progressive-denoise-card") as HTMLElement,
    observationCard: host.querySelector("#progressive-observation-card") as HTMLElement,
    legend: host.querySelector("#progressive-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-79 缺少 canvas。");
  }

  const settings: ProgressiveSettings = {
    samplesPerFrame: 1,
    maxAccumulatedFrames: 96,
    denoiseStrength: 0.55,
    freezeCamera: false,
  };
  refs.sampleRange.value = settings.samplesPerFrame.toString();
  refs.frameRange.value = settings.maxAccumulatedFrames.toString();
  refs.denoiseRange.value = settings.denoiseStrength.toString();
  updateHud(refs, settings, 0);

  const gpu = await createWebGpuCanvas(canvas);
  const { device, context, format } = gpu;

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  const geometry = createBoxGeometry();
  const mesh = createMeshBuffers(device, geometry);
  const guidePipeline = createGuidePipeline(device);
  const tracePipeline = createTracePipeline(device);
  const accumulatePipeline = createAccumulatePipeline(device);
  const presentPipeline = createPresentPipeline(device, format);

  const guideFrameUniformBuffer = device.createBuffer({
    size: 32 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const traceUniformBuffer = device.createBuffer({
    size: 24 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const accumulateUniformBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const presentUniformBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sceneBufferData = createCornellSceneStorageData();
  const sceneBuffer = device.createBuffer({
    size: sceneBufferData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(sceneBuffer, 0, sceneBufferData);

  const guideBindLayout = guidePipeline.getBindGroupLayout(0);
  const guideObjects: GuideObject[] = createCornellRasterObjects().map((object) => {
    const uniformBuffer = device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, createGuideObjectUniformData(object.modelMatrix));
    const bindGroup = device.createBindGroup({
      layout: guideBindLayout,
      entries: [
        { binding: 0, resource: { buffer: guideFrameUniformBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
      ],
    });
    return { uniformBuffer, bindGroup };
  });

  const targets: ProgressiveTargets = {
    normalTexture: null,
    normalView: null,
    linearDepthTexture: null,
    linearDepthView: null,
    depthTexture: null,
    depthView: null,
    currentSampleBuffer: null,
    accumulatedBuffer: null,
    traceBindGroup: null,
    accumulateBindGroup: null,
    presentBindGroup: null,
    panelWidth: 0,
    panelHeight: 0,
  };

  let destroyed = false;
  let frameHandle = 0;
  let frameIndex = 0;
  let accumulationFrames = 0;
  let frozenAngle = 0;
  let latestCameraAngle = 0;
  let manualResetRequested = false;

  const requestReset = () => {
    accumulationFrames = 0;
    manualResetRequested = true;
  };

  const syncSettings = () => {
    updateHud(refs, settings, accumulationFrames);
  };

  refs.sampleRange.addEventListener("input", () => {
    settings.samplesPerFrame = Number(refs.sampleRange.value);
    requestReset();
    syncSettings();
  });
  refs.frameRange.addEventListener("input", () => {
    settings.maxAccumulatedFrames = Number(refs.frameRange.value);
    requestReset();
    syncSettings();
  });
  refs.denoiseRange.addEventListener("input", () => {
    settings.denoiseStrength = Number(refs.denoiseRange.value);
    syncSettings();
  });
  refs.freezeButton.addEventListener("click", () => {
    settings.freezeCamera = !settings.freezeCamera;
    if (settings.freezeCamera) {
      frozenAngle = latestCameraAngle;
    }
    requestReset();
    syncSettings();
  });
  refs.resetButton.addEventListener("click", () => {
    requestReset();
    syncSettings();
  });

  setStatus({
    title: "Progressive Accumulation 与去噪入口已运行",
    detail:
      "左栏保留当前 sample，中栏只做 progressive accumulation，右栏再在 accumulation 基础上加一层 cross-bilateral denoise。",
    tone: "ok",
  });

  const renderFrame = (time: number) => {
    if (destroyed) {
      return;
    }

    gpu.resize();
    ensureTargets(
      device,
      targets,
      canvas.width,
      canvas.height,
      tracePipeline,
      accumulatePipeline,
      presentPipeline,
      sampler,
      sceneBuffer,
      traceUniformBuffer,
      accumulateUniformBuffer,
      presentUniformBuffer
    );

    const pose = currentCameraPose(time * 0.001, settings.freezeCamera, frozenAngle);
    latestCameraAngle = pose.angle;
    if (settings.freezeCamera) {
      frozenAngle = pose.angle;
    } else {
      accumulationFrames = 0;
      manualResetRequested = false;
    }
    if (manualResetRequested) {
      accumulationFrames = 0;
      manualResetRequested = false;
    }

    const viewMatrix = createLookAtViewMatrix(pose.eye, pose.target, [0, 1, 0]);
    const projectionMatrix = createPerspectiveMatrix(
      CAMERA_FOV,
      targets.panelWidth / Math.max(targets.panelHeight, 1),
      CAMERA_NEAR,
      CAMERA_FAR
    );
    const viewProjectionMatrix = (() => {
      const result = new Float32Array(16);
      for (let column = 0; column < 4; column += 1) {
        for (let row = 0; row < 4; row += 1) {
          result[column * 4 + row] =
            projectionMatrix[row] * viewMatrix[column * 4] +
            projectionMatrix[4 + row] * viewMatrix[column * 4 + 1] +
            projectionMatrix[8 + row] * viewMatrix[column * 4 + 2] +
            projectionMatrix[12 + row] * viewMatrix[column * 4 + 3];
        }
      }
      return result;
    })();

    device.queue.writeBuffer(
      guideFrameUniformBuffer,
      0,
      createGuideFrameUniformData(viewProjectionMatrix, viewMatrix)
    );
    device.queue.writeBuffer(
      traceUniformBuffer,
      0,
      createTraceUniformData(
        targets.panelWidth,
        targets.panelHeight,
        settings,
        frameIndex + 1,
        pose.eye,
        pose.target
      )
    );

    const effectiveCount = Math.min(accumulationFrames, settings.maxAccumulatedFrames - 1);
    const alpha = effectiveCount <= 0 ? 1 : 1 / (effectiveCount + 1);
    device.queue.writeBuffer(
      accumulateUniformBuffer,
      0,
      createAccumulateUniformData(targets.panelWidth, targets.panelHeight, alpha)
    );
    device.queue.writeBuffer(
      presentUniformBuffer,
      0,
      createPresentUniformData(targets.panelWidth, targets.panelHeight, settings)
    );

    const encoder = device.createCommandEncoder({
      label: "lesson-79-command-encoder",
    });

    const guidePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.normalView!,
          clearValue: { r: 0.5, g: 0.5, b: 1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: targets.linearDepthView!,
          clearValue: { r: 1, g: 0, b: 0, a: 1 },
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
    guidePass.setPipeline(guidePipeline);
    guidePass.setVertexBuffer(0, mesh.vertexBuffer);
    guidePass.setIndexBuffer(mesh.indexBuffer, "uint16");
    for (const guideObject of guideObjects) {
      guidePass.setBindGroup(0, guideObject.bindGroup);
      guidePass.drawIndexed(mesh.indexCount);
    }
    guidePass.end();

    const tracePass = encoder.beginComputePass({
      label: "lesson-79-trace-pass",
    });
    tracePass.setPipeline(tracePipeline);
    tracePass.setBindGroup(0, targets.traceBindGroup!);
    tracePass.dispatchWorkgroups(
      Math.ceil(targets.panelWidth / 8),
      Math.ceil(targets.panelHeight / 8)
    );
    tracePass.end();

    const accumulatePass = encoder.beginComputePass({
      label: "lesson-79-accumulate-pass",
    });
    accumulatePass.setPipeline(accumulatePipeline);
    accumulatePass.setBindGroup(1, targets.accumulateBindGroup!);
    accumulatePass.dispatchWorkgroups(
      Math.ceil(targets.panelWidth / 8),
      Math.ceil(targets.panelHeight / 8)
    );
    accumulatePass.end();

    const presentPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.025, b: 0.035, a: 1 },
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

    accumulationFrames = Math.min(
      accumulationFrames + 1,
      settings.maxAccumulatedFrames
    );
    frameIndex += 1;
    updateHud(refs, settings, accumulationFrames);
    frameHandle = window.requestAnimationFrame(renderFrame);
  };

  frameHandle = window.requestAnimationFrame(renderFrame);

  return () => {
    destroyed = true;
    window.cancelAnimationFrame(frameHandle);
    destroyTargets(targets);
    mesh.vertexBuffer.destroy();
    mesh.indexBuffer.destroy();
    guideFrameUniformBuffer.destroy();
    traceUniformBuffer.destroy();
    accumulateUniformBuffer.destroy();
    presentUniformBuffer.destroy();
    sceneBuffer.destroy();
    guideObjects.forEach((guideObject) => guideObject.uniformBuffer.destroy());
  };
}
