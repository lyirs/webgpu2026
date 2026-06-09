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
import sceneFragmentShaderSource from "@/lessons/lesson-132-ssgi-and-screen-space-indirect-light/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-132-ssgi-and-screen-space-indirect-light/scene.vert.wgsl?raw";
import ssgiShaderSource from "@/lessons/lesson-132-ssgi-and-screen-space-indirect-light/ssgi.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type SsgiSettings = {
  maxSteps: number;
  stepScale: number;
  thickness: number;
  indirectStrength: number;
};

type SsgiHudRefs = {
  stepsRange: HTMLInputElement;
  stepsValue: HTMLElement;
  scaleRange: HTMLInputElement;
  scaleValue: HTMLElement;
  thicknessRange: HTMLInputElement;
  thicknessValue: HTMLElement;
  strengthRange: HTMLInputElement;
  strengthValue: HTMLElement;
  baseCard: HTMLElement;
  ssgiCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneObjectConfig = {
  colorEmissive: [number, number, number, number];
  translation: Vector3;
  scale: Vector3;
  rotationY: number;
};

type RenderObject = {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type SsgiTargets = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  normalTexture: GPUTexture | null;
  normalView: GPUTextureView | null;
  positionTexture: GPUTexture | null;
  positionView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  ssgiBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 36;
const LIGHT_DIRECTION: Vector3 = [-0.25, -0.92, -0.18];

function buildSceneObjects(): SceneObjectConfig[] {
  return [
    { colorEmissive: [0.1, 0.1, 0.12, 0], translation: [0, -1.05, 0], scale: [8.2, 0.08, 8.2], rotationY: 0 },
    { colorEmissive: [0.32, 0.12, 0.16, 0], translation: [0, 2.15, -4.0], scale: [8.2, 3.6, 0.18], rotationY: 0 },
    { colorEmissive: [0.12, 0.24, 0.28, 0], translation: [-4.0, 2.15, 0], scale: [0.18, 3.6, 8.2], rotationY: 0 },
    { colorEmissive: [0.18, 0.16, 0.34, 0], translation: [4.0, 2.15, 0], scale: [0.18, 3.6, 8.2], rotationY: 0 },
    { colorEmissive: [0.96, 0.84, 0.58, 4.2], translation: [0.0, 2.25, -2.4], scale: [2.8, 0.18, 0.18], rotationY: 0.0 },
    { colorEmissive: [0.74, 0.92, 1.0, 2.8], translation: [-2.35, 1.55, -3.0], scale: [0.16, 1.75, 0.16], rotationY: 0.0 },
    { colorEmissive: [1.0, 0.78, 0.9, 2.8], translation: [2.35, 1.65, -2.1], scale: [0.16, 1.95, 0.16], rotationY: 0.0 },
    { colorEmissive: [0.82, 0.72, 0.54, 0], translation: [-1.2, -0.25, 0.4], scale: [1.0, 1.4, 1.0], rotationY: 0.22 },
    { colorEmissive: [0.66, 0.86, 1.0, 0], translation: [1.55, -0.12, -0.9], scale: [0.85, 1.15, 0.85], rotationY: -0.32 },
    { colorEmissive: [0.74, 0.92, 0.68, 0], translation: [0.15, 0.2, 2.1], scale: [0.48, 1.7, 0.48], rotationY: 0.18 },
  ];
}

function formatScalar(value: number): string {
  return `${value.toFixed(2)}x`;
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
  colorEmissive: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelMatrix, 0);
  uniformData.set(colorEmissive, 16);
  return uniformData;
}

function createSsgiUniformData(
  projectionMatrix: Float32Array,
  settings: SsgiSettings
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(projectionMatrix, 0);
  uniformData.set(
    [
      settings.maxSteps,
      settings.stepScale,
      settings.thickness,
      settings.indirectStrength,
      0,
      0,
      0,
      0,
    ],
    16
  );
  return uniformData;
}

function updateHud(refs: SsgiHudRefs, settings: SsgiSettings): void {
  refs.stepsValue.textContent = `${Math.round(settings.maxSteps)} steps`;
  refs.scaleValue.textContent = `${settings.stepScale.toFixed(2)}m`;
  refs.thicknessValue.textContent = `${settings.thickness.toFixed(2)}m`;
  refs.strengthValue.textContent = formatScalar(settings.indirectStrength);
  refs.baseCard.textContent =
    "左栏只有基础环境光，所以彩色墙面和发光灯条不会把自己的颜色真正弹回周围几何。";
  refs.ssgiCard.textContent =
    `右栏会沿屏幕空间射线寻找命中，并把当前帧颜色当成一次近似 bounce；当前最多走 ${Math.round(settings.maxSteps)} 步。`;
  refs.observationCard.textContent =
    settings.thickness > 0.2
      ? "当前 thickness 偏大，命中会更稳，但也更容易把本来没撞上的表面误当成 bounce 来源。"
      : "看靠近彩色墙和发光灯条的位置：右栏会出现屏幕空间里的间接染色，但一旦目标离开屏幕，信息也会立刻不足。";
  refs.legend.textContent =
    "SSGI 不是完整 GI，它只是沿当前帧已有的 color / normal / depth 做一次 screen-space 间接光近似，所以天然会继承屏幕边界和漏信息问题。";
}

function createScenePipeline(device: GPUDevice): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-72-scene-pipeline",
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

function createSsgiPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: ssgiShaderSource });
  return device.createRenderPipeline({
    label: "lesson-72-ssgi-pipeline",
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsFullscreen",
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

function destroyTargets(targets: SsgiTargets): void {
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
  targets.ssgiBindGroup = null;
  targets.width = 0;
  targets.height = 0;
}

function ensureTargets(
  device: GPUDevice,
  targets: SsgiTargets,
  width: number,
  height: number,
  pipeline: GPURenderPipeline,
  sampler: GPUSampler,
  uniformBuffer: GPUBuffer
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
    "lesson-72-color",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.colorView = targets.colorTexture.createView();
  targets.normalTexture = makeTexture(
    "lesson-72-normal",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.normalView = targets.normalTexture.createView();
  targets.positionTexture = makeTexture(
    "lesson-72-position",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.positionView = targets.positionTexture.createView();
  targets.depthTexture = makeTexture(
    "lesson-72-depth",
    "depth24plus",
    GPUTextureUsage.RENDER_ATTACHMENT
  );
  targets.depthView = targets.depthTexture.createView();
  targets.ssgiBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: targets.colorView },
      { binding: 1, resource: targets.normalView },
      { binding: 2, resource: targets.positionView },
      { binding: 3, resource: sampler },
      { binding: 4, resource: { buffer: uniformBuffer } },
    ],
  });
  targets.width = width;
  targets.height = height;
}

export async function mountSsgiAndScreenSpaceIndirectLightLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--ssgi">
      <div class="screen-reconstruct-stage">
        <div class="screen-reconstruct-badges">
          <span class="screen-reconstruct-badge">emissive panel + colored walls</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--warm">left: no SSGI</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--cool">right: screen-space indirect light</span>
        </div>
        <div class="screen-reconstruct-controls">
          <label class="screen-reconstruct-control">
            <span>Max Steps</span>
            <strong id="ssgi-steps-value"></strong>
            <input id="ssgi-steps-range" type="range" min="6" max="28" step="1" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Step Scale</span>
            <strong id="ssgi-scale-value"></strong>
            <input id="ssgi-scale-range" type="range" min="0.12" max="0.55" step="0.01" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Thickness</span>
            <strong id="ssgi-thickness-value"></strong>
            <input id="ssgi-thickness-range" type="range" min="0.04" max="0.3" step="0.01" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Indirect Strength</span>
            <strong id="ssgi-strength-value"></strong>
            <input id="ssgi-strength-range" type="range" min="0.2" max="1.8" step="0.01" />
          </label>
        </div>
        <div class="screen-reconstruct-labels screen-reconstruct-labels--two">
          <article class="screen-reconstruct-label">
            <span class="eyebrow">左栏</span>
            <strong>Base Ambient</strong>
            <span>只有基础环境光和直接光，缺少来自屏幕内其它表面的 bounce。</span>
          </article>
          <article class="screen-reconstruct-label screen-reconstruct-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>SSGI Result</strong>
            <span>沿屏幕空间射线命中当前帧颜色，再把近似间接光混回材质。</span>
          </article>
        </div>
        <div class="screen-reconstruct-frame screen-reconstruct-frame--wide">
          <canvas class="screen-reconstruct-canvas"></canvas>
        </div>
        <div class="screen-reconstruct-card-grid">
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Base</span>
            <strong id="ssgi-base-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">SSGI</span>
            <strong id="ssgi-result-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">观察</span>
            <strong id="ssgi-observation-card"></strong>
          </article>
        </div>
        <article class="screen-reconstruct-legend">
          <strong>当前实验</strong>
          <span id="ssgi-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: SsgiHudRefs = {
    stepsRange: host.querySelector("#ssgi-steps-range") as HTMLInputElement,
    stepsValue: host.querySelector("#ssgi-steps-value") as HTMLElement,
    scaleRange: host.querySelector("#ssgi-scale-range") as HTMLInputElement,
    scaleValue: host.querySelector("#ssgi-scale-value") as HTMLElement,
    thicknessRange: host.querySelector("#ssgi-thickness-range") as HTMLInputElement,
    thicknessValue: host.querySelector("#ssgi-thickness-value") as HTMLElement,
    strengthRange: host.querySelector("#ssgi-strength-range") as HTMLInputElement,
    strengthValue: host.querySelector("#ssgi-strength-value") as HTMLElement,
    baseCard: host.querySelector("#ssgi-base-card") as HTMLElement,
    ssgiCard: host.querySelector("#ssgi-result-card") as HTMLElement,
    observationCard: host.querySelector("#ssgi-observation-card") as HTMLElement,
    legend: host.querySelector("#ssgi-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-72 缺少 canvas。");
  }

  const settings: SsgiSettings = {
    maxSteps: 16,
    stepScale: 0.22,
    thickness: 0.12,
    indirectStrength: 0.82,
  };
  refs.stepsRange.value = settings.maxSteps.toString();
  refs.scaleRange.value = settings.stepScale.toString();
  refs.thicknessRange.value = settings.thickness.toString();
  refs.strengthRange.value = settings.indirectStrength.toString();
  updateHud(refs, settings);

  const gpu = await createWebGpuCanvas(canvas);
  const { device, context, format } = gpu;
  const camera = createOrbitCameraController(canvas, {
    eye: [5.8, 4.2, 6.8],
    target: [0.0, 0.4, -0.6],
    minRadius: 4.8,
    maxRadius: 13.4,
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

  const mesh = createMeshBuffers(device, createBoxGeometry());
  const scenePipeline = createScenePipeline(device);
  const ssgiPipeline = createSsgiPipeline(device, format);
  const frameUniformBuffer = device.createBuffer({
    size: 36 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const ssgiUniformBuffer = device.createBuffer({
    size: 24 * 4,
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
      multiplyMatrices(
        createRotationYMatrix(config.rotationY),
        createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
      )
    );
    const uniformBuffer = device.createBuffer({
      size: 20 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, createObjectUniformData(modelMatrix, config.colorEmissive));
    const bindGroup = device.createBindGroup({
      layout: sceneBindLayout,
      entries: [
        { binding: 0, resource: { buffer: frameUniformBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
      ],
    });
    return { uniformBuffer, bindGroup };
  });

  const targets: SsgiTargets = {
    colorTexture: null,
    colorView: null,
    normalTexture: null,
    normalView: null,
    positionTexture: null,
    positionView: null,
    depthTexture: null,
    depthView: null,
    ssgiBindGroup: null,
    width: 0,
    height: 0,
  };

  let destroyed = false;
  let frameHandle = 0;

  const syncSettings = () => {
    updateHud(refs, settings);
  };

  refs.stepsRange.addEventListener("input", () => {
    settings.maxSteps = Number(refs.stepsRange.value);
    syncSettings();
  });
  refs.scaleRange.addEventListener("input", () => {
    settings.stepScale = Number(refs.scaleRange.value);
    syncSettings();
  });
  refs.thicknessRange.addEventListener("input", () => {
    settings.thickness = Number(refs.thicknessRange.value);
    syncSettings();
  });
  refs.strengthRange.addEventListener("input", () => {
    settings.indirectStrength = Number(refs.strengthRange.value);
    syncSettings();
  });

  setStatus({
    title: "SSGI 与屏幕空间间接光已运行",
    detail:
      "左栏只有基础环境光，右栏会沿屏幕空间射线寻找当前帧颜色命中并把间接染色混回场景。",
    tone: "ok",
  });

  const renderFrame = () => {
    if (destroyed) {
      return;
    }

    gpu.resize();
    const width = canvas.width;
    const height = canvas.height;
    ensureTargets(device, targets, width, height, ssgiPipeline, sampler, ssgiUniformBuffer);

    const snapshot = camera.getSnapshot();
    const viewMatrix = createLookAtViewMatrix(snapshot.eye, snapshot.target, snapshot.up);
    const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.55, width / Math.max(height, 1), CAMERA_NEAR, CAMERA_FAR);
    const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
    device.queue.writeBuffer(frameUniformBuffer, 0, createFrameUniformData(viewProjectionMatrix, viewMatrix));
    device.queue.writeBuffer(ssgiUniformBuffer, 0, createSsgiUniformData(projectionMatrix, settings));

    const encoder = device.createCommandEncoder({ label: "lesson-72-command-encoder" });
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.colorView!,
          clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
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

    const ssgiPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    ssgiPass.setPipeline(ssgiPipeline);
    ssgiPass.setBindGroup(0, targets.ssgiBindGroup!);
    ssgiPass.draw(3);
    ssgiPass.end();

    device.queue.submit([encoder.finish()]);
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
    ssgiUniformBuffer.destroy();
    for (const renderObject of renderObjects) {
      renderObject.uniformBuffer.destroy();
    }
  };
}
