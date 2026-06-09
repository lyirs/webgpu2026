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
import sceneFragmentShaderSource from "@/lessons/lesson-128-ssr-and-screen-space-reflections/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-128-ssr-and-screen-space-reflections/scene.vert.wgsl?raw";
import ssrShaderSource from "@/lessons/lesson-128-ssr-and-screen-space-reflections/ssr.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type SsrSettings = {
  maxSteps: number;
  stepScale: number;
  thickness: number;
  reflectionStrength: number;
};

type SsrHudRefs = {
  stepsRange: HTMLInputElement;
  stepsValue: HTMLElement;
  stepScaleRange: HTMLInputElement;
  stepScaleValue: HTMLElement;
  thicknessRange: HTMLInputElement;
  thicknessValue: HTMLElement;
  strengthRange: HTMLInputElement;
  strengthValue: HTMLElement;
  rawCard: HTMLElement;
  ssrCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneObjectConfig = {
  colorReflectivity: [number, number, number, number];
  translation: Vector3;
  scale: Vector3;
  rotationY: number;
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type SsrTargets = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  normalTexture: GPUTexture | null;
  normalView: GPUTextureView | null;
  positionTexture: GPUTexture | null;
  positionView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  ssrBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 42;
const LIGHT_DIRECTION: Vector3 = [-0.3, -0.92, -0.16];

function formatStrength(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function createSceneObjects(): SceneObjectConfig[] {
  return [
    {
      colorReflectivity: [0.09, 0.11, 0.14, 0.92],
      translation: [0, -1.02, 0],
      scale: [8.6, 0.08, 10.5],
      rotationY: 0,
    },
    {
      colorReflectivity: [0.16, 0.12, 0.18, 0.18],
      translation: [0, 2.5, -5.2],
      scale: [8.6, 3.2, 0.18],
      rotationY: 0,
    },
    {
      colorReflectivity: [0.1, 0.18, 0.22, 0.12],
      translation: [-3.6, 1.15, 0],
      scale: [0.18, 2.2, 10.5],
      rotationY: 0,
    },
    {
      colorReflectivity: [0.24, 0.13, 0.2, 0.12],
      translation: [3.6, 1.15, 0],
      scale: [0.18, 2.2, 10.5],
      rotationY: 0,
    },
    {
      colorReflectivity: [0.92, 0.74, 0.56, 0.34],
      translation: [-1.2, -0.25, -1.6],
      scale: [0.9, 1.5, 0.9],
      rotationY: 0.25,
    },
    {
      colorReflectivity: [0.6, 0.82, 1.0, 0.28],
      translation: [1.6, -0.05, -2.8],
      scale: [0.7, 1.1, 0.7],
      rotationY: -0.4,
    },
    {
      colorReflectivity: [0.96, 0.86, 0.64, 0.16],
      translation: [0, 2.1, -1.8],
      scale: [3.4, 0.12, 0.2],
      rotationY: 0.08,
    },
    {
      colorReflectivity: [0.72, 0.9, 1.0, 0.16],
      translation: [-2.1, 0.5, 2.1],
      scale: [0.18, 2.2, 0.18],
      rotationY: 0.15,
    },
    {
      colorReflectivity: [1.0, 0.82, 0.96, 0.16],
      translation: [2.2, 0.7, 1.4],
      scale: [0.18, 2.6, 0.18],
      rotationY: -0.15,
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
  colorReflectivity: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelMatrix, 0);
  uniformData.set(colorReflectivity, 16);
  return uniformData;
}

function createSsrUniformData(
  projectionMatrix: Float32Array,
  settings: SsrSettings
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(projectionMatrix, 0);
  uniformData.set(
    [
      settings.maxSteps,
      settings.stepScale,
      settings.thickness,
      settings.reflectionStrength,
      0.0025,
      0,
      0,
      0,
    ],
    16
  );
  return uniformData;
}

function updateHud(refs: SsrHudRefs, settings: SsrSettings): void {
  refs.stepsValue.textContent = `${Math.round(settings.maxSteps)} steps`;
  refs.stepScaleValue.textContent = `${settings.stepScale.toFixed(2)}m`;
  refs.thicknessValue.textContent = `${settings.thickness.toFixed(2)}m`;
  refs.strengthValue.textContent = formatStrength(settings.reflectionStrength);
  refs.rawCard.textContent =
    "左栏只保留基础环境反射和高光，所以屏幕里并不会出现来自其它物体的真实屏幕空间反射。";
  refs.ssrCard.textContent =
    `右栏会沿屏幕空间反射方向做 ray march：当前最多走 ${Math.round(settings.maxSteps)} 步，每步 ${settings.stepScale.toFixed(2)}m。`;
  refs.observationCard.textContent =
    settings.thickness > 0.16
      ? "当前 thickness 偏大，命中会更稳定，但也更容易把本不该相交的表面误当成命中。"
      : "拖动画面时注意地面上的反射：一旦目标离开屏幕，右栏就只能退回到基础环境反射，这正是 SSR 的天然边界。";
  refs.legend.textContent =
    "SSR 只能利用当前屏幕里已经存在的颜色、法线和深度信息。它的强项是便宜直观，它的硬边界是“屏幕外一概看不见”。";
}

function createScenePipeline(
  device: GPUDevice
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-68-scene-pipeline",
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
      targets: [
        { format: "rgba16float" },
        { format: "rgba16float" },
        { format: "rgba16float" },
      ],
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

function createSsrPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: ssrShaderSource });

  return device.createRenderPipeline({
    label: "lesson-68-ssr-pipeline",
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

function destroyTargets(targets: SsrTargets): void {
  targets.colorTexture?.destroy();
  targets.normalTexture?.destroy();
  targets.positionTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.colorTexture = null;
  targets.colorView = null;
  targets.normalTexture = null;
  targets.normalView = null;
  targets.positionTexture = null;
  targets.positionView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.ssrBindGroup = null;
  targets.width = 0;
  targets.height = 0;
}

function ensureTargets(
  gpu: Awaited<ReturnType<typeof createWebGpuCanvas>>,
  targets: SsrTargets,
  ssrPipeline: GPURenderPipeline,
  sampler: GPUSampler,
  ssrUniformBuffer: GPUBuffer
): void {
  const width = gpu.context.getCurrentTexture().width;
  const height = gpu.context.getCurrentTexture().height;

  if (
    targets.width === width &&
    targets.height === height &&
    targets.colorView &&
    targets.normalView &&
    targets.positionView &&
    targets.depthView &&
    targets.ssrBindGroup
  ) {
    return;
  }

  destroyTargets(targets);

  targets.colorTexture = gpu.device.createTexture({
    size: [width, height],
    format: "rgba16float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  targets.normalTexture = gpu.device.createTexture({
    size: [width, height],
    format: "rgba16float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  targets.positionTexture = gpu.device.createTexture({
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
  targets.normalView = targets.normalTexture.createView();
  targets.positionView = targets.positionTexture.createView();
  targets.depthView = targets.depthTexture.createView();
  targets.ssrBindGroup = gpu.device.createBindGroup({
    layout: ssrPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: targets.colorView },
      { binding: 2, resource: targets.normalView },
      { binding: 3, resource: targets.positionView },
      { binding: 4, resource: { buffer: ssrUniformBuffer } },
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

export async function mountSsrAndScreenSpaceReflectionsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--ssr";
  host.innerHTML = `
    <div class="screen-temporal-stage screen-temporal-stage--ssr">
      <div class="screen-temporal-badges">
        <span class="screen-temporal-badge">scene color + normal + view position</span>
        <span class="screen-temporal-badge">右栏沿反射方向做 screen-space ray march</span>
        <span class="screen-temporal-badge screen-temporal-badge--cool">屏幕外信息缺失是它的天然边界</span>
      </div>
      <div class="screen-temporal-controls">
        <label class="screen-temporal-control">
          <span>Max Steps</span>
          <strong data-role="steps-value">36 steps</strong>
          <input data-role="steps-range" type="range" min="12" max="72" step="1" value="36" />
        </label>
        <label class="screen-temporal-control">
          <span>Step Scale</span>
          <strong data-role="step-scale-value">0.22m</strong>
          <input data-role="step-scale-range" type="range" min="8" max="44" step="1" value="22" />
        </label>
        <label class="screen-temporal-control">
          <span>Thickness</span>
          <strong data-role="thickness-value">0.10m</strong>
          <input data-role="thickness-range" type="range" min="3" max="24" step="1" value="10" />
        </label>
        <label class="screen-temporal-control">
          <span>Reflection Strength</span>
          <strong data-role="strength-value">72%</strong>
          <input data-role="strength-range" type="range" min="20" max="100" step="1" value="72" />
        </label>
      </div>
      <div class="screen-temporal-labels screen-temporal-labels--two">
        <article class="screen-temporal-label">
          <p class="eyebrow">Left</p>
          <strong>基础环境反射</strong>
          <span>只保留材质本身的高光和环境 tint。</span>
        </article>
        <article class="screen-temporal-label screen-temporal-label--cool">
          <p class="eyebrow">Right</p>
          <strong>SSR Composite</strong>
          <span>命中屏幕内表面以后，把反射颜色混回材质。</span>
        </article>
      </div>
      <div class="screen-temporal-frame">
        <canvas class="screen-temporal-canvas" aria-label="SSR and screen-space reflections lesson preview"></canvas>
      </div>
      <div class="screen-temporal-card-grid">
        <article class="screen-temporal-card">
          <p class="eyebrow">Base Reflection</p>
          <strong>左栏只靠基础高光和环境色。</strong>
          <p data-role="raw-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">SSR</p>
          <strong>右栏会沿屏幕空间反射方向一步步前进。</strong>
          <p data-role="ssr-card"></p>
        </article>
        <article class="screen-temporal-card">
          <p class="eyebrow">当前实验</p>
          <strong>SSR 的优势和边界要一起看。</strong>
          <p data-role="observation-card"></p>
        </article>
      </div>
      <article class="screen-temporal-legend">
        <strong>本课知识点</strong>
        <p data-role="legend-value">这节课会先把基础环境反射和 SSR 对照起来：命中很直观，但一旦目标跑出屏幕，SSR 也会立刻失去来源。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stepsRange = host.querySelector<HTMLInputElement>('[data-role="steps-range"]');
  const stepsValue = host.querySelector<HTMLElement>('[data-role="steps-value"]');
  const stepScaleRange = host.querySelector<HTMLInputElement>('[data-role="step-scale-range"]');
  const stepScaleValue = host.querySelector<HTMLElement>('[data-role="step-scale-value"]');
  const thicknessRange = host.querySelector<HTMLInputElement>('[data-role="thickness-range"]');
  const thicknessValue = host.querySelector<HTMLElement>('[data-role="thickness-value"]');
  const strengthRange = host.querySelector<HTMLInputElement>('[data-role="strength-range"]');
  const strengthValue = host.querySelector<HTMLElement>('[data-role="strength-value"]');
  const rawCard = host.querySelector<HTMLElement>('[data-role="raw-card"]');
  const ssrCard = host.querySelector<HTMLElement>('[data-role="ssr-card"]');
  const observationCard = host.querySelector<HTMLElement>('[data-role="observation-card"]');
  const legend = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !stepsRange ||
    !stepsValue ||
    !stepScaleRange ||
    !stepScaleValue ||
    !thicknessRange ||
    !thicknessValue ||
    !strengthRange ||
    !strengthValue ||
    !rawCard ||
    !ssrCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("第 68 课的 DOM 初始化失败。");
  }

  const refs: SsrHudRefs = {
    stepsRange,
    stepsValue,
    stepScaleRange,
    stepScaleValue,
    thicknessRange,
    thicknessValue,
    strengthRange,
    strengthValue,
    rawCard,
    ssrCard,
    observationCard,
    legend,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const scenePipeline = createScenePipeline(gpu.device);
  const ssrPipeline = createSsrPipeline(gpu.device, gpu.format);
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
  const ssrUniformBuffer = gpu.device.createBuffer({
    size: 24 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sampler = gpu.device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
  const targets: SsrTargets = {
    colorTexture: null,
    colorView: null,
    normalTexture: null,
    normalView: null,
    positionTexture: null,
    positionView: null,
    depthTexture: null,
    depthView: null,
    ssrBindGroup: null,
    width: 0,
    height: 0,
  };
  const renderObjects = createRenderObjects(
    gpu.device,
    scenePipeline,
    createSceneObjects()
  );

  const settings: SsrSettings = {
    maxSteps: 36,
    stepScale: 0.22,
    thickness: 0.1,
    reflectionStrength: 0.72,
  };

  updateHud(refs, settings);
  setStatus({
    title: "SSR 已运行",
    detail:
      "左栏只看基础环境反射，右栏则沿屏幕空间反射方向做 ray march。拖动画面时注意地面反射：一旦目标跑出屏幕，SSR 也会自然消失或回退。",
    tone: "ok",
  });

  const controller = createOrbitCameraController(canvas, {
    eye: [0, 2.3, 7.8],
    target: [0, 0.5, -1.4],
    minRadius: 4.8,
    maxRadius: 14.5,
  });

  stepsRange.addEventListener("input", () => {
    settings.maxSteps = Number(stepsRange.value);
    updateHud(refs, settings);
  });
  stepScaleRange.addEventListener("input", () => {
    settings.stepScale = Number(stepScaleRange.value) / 100;
    updateHud(refs, settings);
  });
  thicknessRange.addEventListener("input", () => {
    settings.thickness = Number(thicknessRange.value) / 100;
    updateHud(refs, settings);
  });
  strengthRange.addEventListener("input", () => {
    settings.reflectionStrength = Number(strengthRange.value) / 100;
    updateHud(refs, settings);
  });

  let animationFrameId = 0;

  const renderFrame = () => {
    gpu.resize();
    ensureTargets(gpu, targets, ssrPipeline, sampler, ssrUniformBuffer);

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
      ssrUniformBuffer,
      0,
      createSsrUniformData(projectionMatrix, settings)
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
        createObjectUniformData(modelMatrix, renderObject.config.colorReflectivity)
      );
    });

    const commandEncoder = gpu.device.createCommandEncoder({
      label: "lesson-68-command-encoder",
    });
    const scenePass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.colorView!,
          clearValue: { r: 0.05, g: 0.04, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: targets.normalView!,
          clearValue: { r: 0.5, g: 0.5, b: 1, a: 0 },
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
    presentPass.setPipeline(ssrPipeline);
    presentPass.setBindGroup(0, targets.ssrBindGroup!);
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
    ssrUniformBuffer.destroy();
    meshBuffers.vertexBuffer.destroy();
    meshBuffers.indexBuffer.destroy();
    renderObjects.forEach((renderObject) => renderObject.uniformBuffer.destroy());
  };
}
