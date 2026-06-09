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
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/screen-space-common/math";
import presentShaderSource from "@/lessons/lesson-126-taa-and-history-reprojection/present.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-126-taa-and-history-reprojection/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-126-taa-and-history-reprojection/scene.vert.wgsl?raw";
import taaShaderSource from "@/lessons/lesson-126-taa-and-history-reprojection/taa.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type TaaSettings = {
  jitterEnabled: boolean;
  historyBlend: number;
  clampStrength: number;
};

type TaaHudRefs = {
  jitterButton: HTMLButtonElement;
  historyRange: HTMLInputElement;
  historyValue: HTMLElement;
  clampRange: HTMLInputElement;
  clampValue: HTMLElement;
  resetButton: HTMLButtonElement;
  rawCard: HTMLElement;
  taaCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneObjectConfig = {
  translation: Vector3;
  scale: Vector3;
  color: [number, number, number, number];
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type SceneTargets = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  velocityTexture: GPUTexture | null;
  velocityView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  taaTextures: [GPUTexture | null, GPUTexture | null];
  taaViews: [GPUTextureView | null, GPUTextureView | null];
  taaBindGroups: [GPUBindGroup | null, GPUBindGroup | null];
  presentBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

const LIGHT_DIRECTION: Vector3 = [-0.34, -0.88, -0.24];
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 46;
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

function createTaaUniformData(
  width: number,
  height: number,
  settings: TaaSettings,
  historyValid: boolean
): Float32Array {
  return new Float32Array([
    1 / Math.max(width, 1),
    1 / Math.max(height, 1),
    settings.historyBlend,
    settings.clampStrength,
    historyValid ? 1 : 0,
    0,
    0,
    0,
  ]);
}

function buildSceneObjects(): SceneObjectConfig[] {
  const objects: SceneObjectConfig[] = [
    {
      translation: [0, -1.05, 0],
      scale: [5.8, 0.08, 16.5],
      color: [0.08, 0.1, 0.14, 1],
    },
    {
      translation: [-2.8, 0.75, 0],
      scale: [0.12, 1.9, 16.5],
      color: [0.11, 0.17, 0.23, 1],
    },
    {
      translation: [2.8, 0.75, 0],
      scale: [0.12, 1.9, 16.5],
      color: [0.14, 0.1, 0.2, 1],
    },
  ];

  for (let lane = 0; lane < 5; lane += 1) {
    const laneX = -1.8 + lane * 0.9;
    for (let index = 0; index < 14; index += 1) {
      const z = -9.5 + index * 1.45;
      objects.push({
        translation: [laneX, -0.05 + (lane % 2) * 0.12, z],
        scale: [0.04, 1.15 + ((lane + index) % 3) * 0.16, 0.04],
        color: lane % 2 === 0 ? [0.82, 0.88, 1.0, 1] : [1.0, 0.82, 0.74, 1],
      });
    }
  }

  for (let row = 0; row < 6; row += 1) {
    const y = 0.4 + row * 0.36;
    objects.push({
      translation: [0, y, -6.8 + row * 2.2],
      scale: [4.1, 0.028, 0.028],
      color: row % 2 === 0 ? [0.68, 0.82, 1.0, 1] : [1.0, 0.92, 0.68, 1],
    });
  }

  return objects;
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

function updateHud(refs: TaaHudRefs, settings: TaaSettings): void {
  refs.jitterButton.classList.toggle("screen-temporal-toggle--active", settings.jitterEnabled);
  refs.historyValue.textContent = formatPercent(settings.historyBlend);
  refs.clampValue.textContent = formatPercent(settings.clampStrength);
  refs.rawCard.textContent = settings.jitterEnabled
    ? "左栏显示的是带 jitter 的当前帧原图；高频细节会因为每帧抖动而显得更不稳。"
    : "当前已经关闭 jitter，所以左栏虽然更静，但也少了 TAA 可以从时间里补回来的亚像素信息。";
  refs.taaCard.textContent = `右栏会把上一帧 history 用 velocity 重投影回来，然后以 ${formatPercent(settings.historyBlend)} 的权重继续累积。`;
  refs.observationCard.textContent =
    settings.clampStrength > 0.72
      ? "当前 clamp 比较紧，右栏会更克制拖影，但历史颜色也更难充分积累。"
      : "当前 clamp 偏松，右栏更容易把历史采样积下来，但高速变化边缘也更容易开始拖尾。";
  refs.legend.textContent =
    "这一课把 jitter、history texture 和 reprojection 串在一起：TAA 的关键不是模糊，而是把上一帧颜色稳定地挪回当前帧继续利用。";
}

function createScenePipeline(
  device: GPUDevice,
  colorFormat: GPUTextureFormat,
  velocityFormat: GPUTextureFormat
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-66-scene-pipeline",
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

function createTaaPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: taaShaderSource });

  return device.createRenderPipeline({
    label: "lesson-66-taa-pipeline",
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

function createPresentPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: presentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-66-present-pipeline",
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

function destroyTargets(targets: SceneTargets): void {
  targets.colorTexture?.destroy();
  targets.velocityTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.taaTextures[0]?.destroy();
  targets.taaTextures[1]?.destroy();
  targets.colorTexture = null;
  targets.colorView = null;
  targets.velocityTexture = null;
  targets.velocityView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.taaTextures = [null, null];
  targets.taaViews = [null, null];
  targets.taaBindGroups = [null, null];
  targets.presentBindGroup = null;
  targets.width = 0;
  targets.height = 0;
}

function ensureTargets(
  gpu: Awaited<ReturnType<typeof createWebGpuCanvas>>,
  targets: SceneTargets,
  taaPipeline: GPURenderPipeline,
  presentPipeline: GPURenderPipeline,
  sampler: GPUSampler,
  taaUniformBuffer: GPUBuffer
): boolean {
  const width = gpu.context.getCurrentTexture().width;
  const height = gpu.context.getCurrentTexture().height;

  if (
    targets.width === width &&
    targets.height === height &&
    targets.colorView &&
    targets.velocityView &&
    targets.depthView &&
    targets.taaViews[0] &&
    targets.taaViews[1] &&
    targets.taaBindGroups[0] &&
    targets.taaBindGroups[1] &&
    targets.presentBindGroup
  ) {
    return false;
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
  targets.taaTextures = [
    gpu.device.createTexture({
      size: [width, height],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    }),
    gpu.device.createTexture({
      size: [width, height],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    }),
  ];
  const colorView = targets.colorTexture.createView();
  const velocityView = targets.velocityTexture.createView();
  const depthView = targets.depthTexture.createView();
  const taaViewA = targets.taaTextures[0]!.createView();
  const taaViewB = targets.taaTextures[1]!.createView();
  targets.colorView = colorView;
  targets.velocityView = velocityView;
  targets.depthView = depthView;
  targets.taaViews = [taaViewA, taaViewB];
  targets.taaBindGroups = [
    gpu.device.createBindGroup({
      layout: taaPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: colorView },
        { binding: 2, resource: velocityView },
        { binding: 3, resource: taaViewA },
        { binding: 4, resource: { buffer: taaUniformBuffer } },
      ],
    }),
    gpu.device.createBindGroup({
      layout: taaPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: colorView },
        { binding: 2, resource: velocityView },
        { binding: 3, resource: taaViewB },
        { binding: 4, resource: { buffer: taaUniformBuffer } },
      ],
    }),
  ];
  targets.presentBindGroup = gpu.device.createBindGroup({
    layout: presentPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: colorView },
      { binding: 2, resource: taaViewA },
    ],
  });
  targets.width = width;
  targets.height = height;
  return true;
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

export async function mountTaaAndHistoryReprojectionLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--taa-history";
  host.innerHTML = `
    <div class="screen-temporal-stage screen-temporal-stage--taa">
      <div class="screen-temporal-badges">
        <span class="screen-temporal-badge">raw jittered current frame vs history reprojection</span>
        <span class="screen-temporal-badge">velocity 会告诉 history 该回到哪儿</span>
        <span class="screen-temporal-badge screen-temporal-badge--cool">neighborhood clamp 会决定它敢不敢继续积</span>
      </div>
      <div class="screen-temporal-controls">
        <div class="screen-temporal-control screen-temporal-control--toggle">
          <span>Jitter</span>
          <button type="button" class="screen-temporal-toggle screen-temporal-toggle--active" data-role="jitter-button">开启 jitter</button>
          <strong>当前帧会不会继续做亚像素抖动</strong>
        </div>
        <label class="screen-temporal-control">
          <span>History Blend</span>
          <strong data-role="history-value">90%</strong>
          <input data-role="history-range" type="range" min="55" max="96" step="1" value="90" />
        </label>
        <label class="screen-temporal-control">
          <span>Clamp Strength</span>
          <strong data-role="clamp-value">65%</strong>
          <input data-role="clamp-range" type="range" min="25" max="95" step="1" value="65" />
        </label>
        <div class="screen-temporal-control screen-temporal-control--toggle">
          <span>History</span>
          <button type="button" class="screen-temporal-toggle" data-role="reset-button">reset history</button>
          <strong>参数大改或相机跳变以后重新收敛</strong>
        </div>
      </div>
      <div class="screen-temporal-labels screen-temporal-labels--two">
        <article class="screen-temporal-label">
          <p class="eyebrow">Left</p>
          <strong>Raw Jittered Frame</strong>
          <span>每帧都带亚像素抖动，高频细节会显得更不稳。</span>
        </article>
        <article class="screen-temporal-label screen-temporal-label--cool">
          <p class="eyebrow">Right</p>
          <strong>TAA Result</strong>
          <span>把上一帧 history 重投影回来，再继续和当前帧混合。</span>
        </article>
      </div>
      <div class="screen-temporal-frame">
        <canvas class="screen-temporal-canvas" aria-label="TAA and history reprojection lesson preview"></canvas>
      </div>
      <div class="screen-temporal-card-grid">
        <article class="screen-temporal-card">
          <p class="eyebrow">Raw</p>
          <strong>先观察 jitter 以后高频细节怎么抖。</strong>
          <p data-role="raw-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">History</p>
          <strong>右栏真正看的不是当前帧，而是 current + history 的混合。</strong>
          <p data-role="taa-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">当前实验</p>
          <strong>TAA 的收益和代价要一起看。</strong>
          <p data-role="observation-card"></p>
        </article>
      </div>
      <article class="screen-temporal-legend">
        <strong>本课知识点</strong>
        <p data-role="legend-value">这一课会把 jitter、history 和 reprojection 串到一起，单独看清 TAA 是怎么从时间里补细节的。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const jitterButton = host.querySelector<HTMLButtonElement>('[data-role="jitter-button"]');
  const historyRange = host.querySelector<HTMLInputElement>('[data-role="history-range"]');
  const historyValue = host.querySelector<HTMLElement>('[data-role="history-value"]');
  const clampRange = host.querySelector<HTMLInputElement>('[data-role="clamp-range"]');
  const clampValue = host.querySelector<HTMLElement>('[data-role="clamp-value"]');
  const resetButton = host.querySelector<HTMLButtonElement>('[data-role="reset-button"]');
  const rawCard = host.querySelector<HTMLElement>('[data-role="raw-card"]');
  const taaCard = host.querySelector<HTMLElement>('[data-role="taa-card"]');
  const observationCard = host.querySelector<HTMLElement>('[data-role="observation-card"]');
  const legend = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !jitterButton ||
    !historyRange ||
    !historyValue ||
    !clampRange ||
    !clampValue ||
    !resetButton ||
    !rawCard ||
    !taaCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("第 66 课的 DOM 初始化失败。");
  }

  const refs: TaaHudRefs = {
    jitterButton,
    historyRange,
    historyValue,
    clampRange,
    clampValue,
    resetButton,
    rawCard,
    taaCard,
    observationCard,
    legend,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const scenePipeline = createScenePipeline(gpu.device, "rgba16float", "rgba16float");
  const taaPipeline = createTaaPipeline(gpu.device, "rgba16float");
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
  const taaUniformBuffer = gpu.device.createBuffer({
    size: 8 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sampler = gpu.device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
  const targets: SceneTargets = {
    colorTexture: null,
    colorView: null,
    velocityTexture: null,
    velocityView: null,
    depthTexture: null,
    depthView: null,
    taaTextures: [null, null],
    taaViews: [null, null],
    taaBindGroups: [null, null],
    presentBindGroup: null,
    width: 0,
    height: 0,
  };
  const renderObjects = createRenderObjects(
    gpu.device,
    scenePipeline,
    buildSceneObjects()
  );

  const settings: TaaSettings = {
    jitterEnabled: true,
    historyBlend: 0.9,
    clampStrength: 0.65,
  };

  updateHud(refs, settings);
  setStatus({
    title: "TAA history reprojection 已运行",
    detail:
      "左栏是每帧带 jitter 的当前帧原图，右栏会把上一帧颜色沿 velocity 重投影回来再继续积累。关闭 jitter 以后，右栏的稳定收益会明显下降。",
    tone: "ok",
  });

  let historyReadIndex = 0;
  let historyWriteIndex = 1;
  let historyValid = false;
  let frameIndex = 0;

  const resetHistory = () => {
    historyValid = false;
    historyReadIndex = 0;
    historyWriteIndex = 1;
  };

  const controller = createOrbitCameraController(canvas, {
    eye: [0, 2.2, 11.2],
    target: [0, 0.7, 0],
    minRadius: 6.4,
    maxRadius: 19,
    onChange: resetHistory,
  });

  jitterButton.addEventListener("click", () => {
    settings.jitterEnabled = !settings.jitterEnabled;
    updateHud(refs, settings);
    resetHistory();
  });
  historyRange.addEventListener("input", () => {
    settings.historyBlend = Number(historyRange.value) / 100;
    updateHud(refs, settings);
    resetHistory();
  });
  clampRange.addEventListener("input", () => {
    settings.clampStrength = Number(clampRange.value) / 100;
    updateHud(refs, settings);
    resetHistory();
  });
  resetButton.addEventListener("click", resetHistory);

  let animationFrameId = 0;

  const renderFrame = () => {
    gpu.resize();
    const resized = ensureTargets(
      gpu,
      targets,
      taaPipeline,
      presentPipeline,
      sampler,
      taaUniformBuffer
    );
    if (resized) {
      resetHistory();
    }

    const width = gpu.context.getCurrentTexture().width;
    const height = gpu.context.getCurrentTexture().height;
    const aspect = width / height;
    const camera = controller.getSnapshot();
    const baseProjection = createPerspectiveMatrix(Math.PI / 3.05, aspect, CAMERA_NEAR, CAMERA_FAR);
    const currentJitter = settings.jitterEnabled
      ? JITTER_SEQUENCE[frameIndex % JITTER_SEQUENCE.length]
      : [0.5, 0.5];
    const previousJitter =
      settings.jitterEnabled && historyValid
        ? JITTER_SEQUENCE[(frameIndex - 1 + JITTER_SEQUENCE.length) % JITTER_SEQUENCE.length]
        : currentJitter;
    const currentProjection = applyProjectionJitter(
      baseProjection,
      ((currentJitter[0] - 0.5) * 2) / width,
      ((currentJitter[1] - 0.5) * 2) / height
    );
    const previousProjection = applyProjectionJitter(
      baseProjection,
      ((previousJitter[0] - 0.5) * 2) / width,
      ((previousJitter[1] - 0.5) * 2) / height
    );
    const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
    const currentViewProjectionMatrix = multiplyMatrices(currentProjection, viewMatrix);
    const previousViewProjectionMatrix = multiplyMatrices(previousProjection, viewMatrix);

    gpu.device.queue.writeBuffer(
      frameUniformBuffer,
      0,
      createFrameUniformData(currentViewProjectionMatrix, previousViewProjectionMatrix)
    );
    gpu.device.queue.writeBuffer(
      taaUniformBuffer,
      0,
      createTaaUniformData(width, height, settings, historyValid)
    );

    renderObjects.forEach((renderObject) => {
      const modelMatrix = multiplyMatrices(
        createTranslationMatrix(
          renderObject.config.translation[0],
          renderObject.config.translation[1],
          renderObject.config.translation[2]
        ),
        createScaleMatrix(
          renderObject.config.scale[0],
          renderObject.config.scale[1],
          renderObject.config.scale[2]
        )
      );

      gpu.device.queue.writeBuffer(
        renderObject.uniformBuffer,
        0,
        createObjectUniformData(modelMatrix, renderObject.config.color)
      );
    });

    const commandEncoder = gpu.device.createCommandEncoder({
      label: "lesson-66-command-encoder",
    });

    const scenePass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.colorView!,
          clearValue: { r: 0.03, g: 0.04, b: 0.06, a: 1 },
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

    const taaPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.taaViews[historyWriteIndex]!,
          clearValue: { r: 0.03, g: 0.04, b: 0.06, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    taaPass.setPipeline(taaPipeline);
    taaPass.setBindGroup(0, targets.taaBindGroups[historyReadIndex]!);
    taaPass.draw(3);
    taaPass.end();

    targets.presentBindGroup = gpu.device.createBindGroup({
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: targets.colorView! },
        { binding: 2, resource: targets.taaViews[historyWriteIndex]! },
      ],
    });

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
    presentPass.setBindGroup(0, targets.presentBindGroup);
    presentPass.draw(3);
    presentPass.end();

    gpu.device.queue.submit([commandEncoder.finish()]);

    historyValid = true;
    frameIndex += 1;
    const nextReadIndex = historyWriteIndex;
    historyWriteIndex = historyReadIndex;
    historyReadIndex = nextReadIndex;
    animationFrameId = window.requestAnimationFrame(renderFrame);
  };

  animationFrameId = window.requestAnimationFrame(renderFrame);

  return () => {
    window.cancelAnimationFrame(animationFrameId);
    controller.dispose();
    destroyTargets(targets);
    frameUniformBuffer.destroy();
    taaUniformBuffer.destroy();
    meshBuffers.vertexBuffer.destroy();
    meshBuffers.indexBuffer.destroy();
    renderObjects.forEach((renderObject) => renderObject.uniformBuffer.destroy());
  };
}
