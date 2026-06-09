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
import sceneFragmentShaderSource from "@/lessons/lesson-133-contact-shadows-and-screen-space-shadows/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-133-contact-shadows-and-screen-space-shadows/scene.vert.wgsl?raw";
import shadowShaderSource from "@/lessons/lesson-133-contact-shadows-and-screen-space-shadows/shadow.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type ContactShadowSettings = {
  rayLength: number;
  stepCount: number;
  thickness: number;
  shadowStrength: number;
};

type ContactShadowHudRefs = {
  lengthRange: HTMLInputElement;
  lengthValue: HTMLElement;
  stepsRange: HTMLInputElement;
  stepsValue: HTMLElement;
  thicknessRange: HTMLInputElement;
  thicknessValue: HTMLElement;
  strengthRange: HTMLInputElement;
  strengthValue: HTMLElement;
  baseCard: HTMLElement;
  shadowCard: HTMLElement;
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

type ContactShadowTargets = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  normalTexture: GPUTexture | null;
  normalView: GPUTextureView | null;
  positionTexture: GPUTexture | null;
  positionView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  shadowBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 32;
const LIGHT_DIRECTION: Vector3 = [-0.72, -0.48, -0.32];

function buildSceneObjects(): SceneObjectConfig[] {
  return [
    { color: [0.11, 0.12, 0.14, 1], translation: [0, -1.06, 0], scale: [9.5, 0.08, 9.5], rotationY: 0 },
    { color: [0.16, 0.16, 0.19, 1], translation: [0, 2.0, -4.2], scale: [9.5, 3.4, 0.18], rotationY: 0 },
    { color: [0.74, 0.84, 1.0, 1], translation: [-1.6, -0.28, 0.3], scale: [1.4, 0.56, 1.4], rotationY: 0.18 },
    { color: [1.0, 0.82, 0.7, 1], translation: [1.4, -0.16, -1.4], scale: [1.05, 0.8, 1.05], rotationY: -0.28 },
    { color: [0.86, 0.9, 0.62, 1], translation: [0.0, 0.55, 1.8], scale: [0.9, 1.0, 0.9], rotationY: 0.12 },
    { color: [0.9, 0.76, 0.58, 1], translation: [-2.0, 0.62, -2.0], scale: [0.52, 1.8, 0.52], rotationY: 0.0 },
    { color: [0.7, 0.9, 1.0, 1], translation: [2.1, 0.85, 0.9], scale: [0.52, 2.1, 0.52], rotationY: 0.0 },
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
  color: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelMatrix, 0);
  uniformData.set(color, 16);
  return uniformData;
}

function createShadowUniformData(
  projectionMatrix: Float32Array,
  viewMatrix: Float32Array,
  settings: ContactShadowSettings
): Float32Array {
  const lightDirectionView = [
    viewMatrix[0] * LIGHT_DIRECTION[0] + viewMatrix[4] * LIGHT_DIRECTION[1] + viewMatrix[8] * LIGHT_DIRECTION[2],
    viewMatrix[1] * LIGHT_DIRECTION[0] + viewMatrix[5] * LIGHT_DIRECTION[1] + viewMatrix[9] * LIGHT_DIRECTION[2],
    viewMatrix[2] * LIGHT_DIRECTION[0] + viewMatrix[6] * LIGHT_DIRECTION[1] + viewMatrix[10] * LIGHT_DIRECTION[2],
  ];
  const uniformData = new Float32Array(28);
  uniformData.set(projectionMatrix, 0);
  uniformData.set([lightDirectionView[0], lightDirectionView[1], lightDirectionView[2], settings.rayLength], 16);
  uniformData.set([settings.stepCount, settings.thickness, settings.shadowStrength, 0], 20);
  uniformData.set([0, 0, 0, 0], 24);
  return uniformData;
}

function updateHud(refs: ContactShadowHudRefs, settings: ContactShadowSettings): void {
  refs.lengthValue.textContent = `${settings.rayLength.toFixed(2)}m`;
  refs.stepsValue.textContent = `${Math.round(settings.stepCount)} steps`;
  refs.thicknessValue.textContent = `${settings.thickness.toFixed(2)}m`;
  refs.strengthValue.textContent = formatScalar(settings.shadowStrength);
  refs.baseCard.textContent =
    "左栏只保留主光和基础环境光，所以物体虽然贴近地面，但接触处缺少那一圈最先变暗的小尺度阴影。";
  refs.shadowCard.textContent =
    "右栏会沿光方向在屏幕空间里做近距离 ray march，把最接近接触点的遮挡补回来。";
  refs.observationCard.textContent =
    settings.rayLength > 0.95
      ? "当前 ray length 偏长，阴影会向更大范围延展；这节课最应该盯的是接触区，而不是把它拖成整片大阴影。"
      : "观察悬浮物体底部和靠墙位置：右栏会先把最贴近接触面的阴影补出来，离得远的部分则不该被明显压黑。";
  refs.legend.textContent =
    "Contact shadows 的任务不是替代主阴影，而是利用屏幕空间深度把“离得很近但主阴影分辨率不够”的那一圈暗部补细。";
}

function createScenePipeline(device: GPUDevice): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-73-scene-pipeline",
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

function createShadowPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: shadowShaderSource });
  return device.createRenderPipeline({
    label: "lesson-73-shadow-pipeline",
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

function destroyTargets(targets: ContactShadowTargets): void {
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
  targets.shadowBindGroup = null;
  targets.width = 0;
  targets.height = 0;
}

function ensureTargets(
  device: GPUDevice,
  targets: ContactShadowTargets,
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
    "lesson-73-color",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.colorView = targets.colorTexture.createView();
  targets.normalTexture = makeTexture(
    "lesson-73-normal",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.normalView = targets.normalTexture.createView();
  targets.positionTexture = makeTexture(
    "lesson-73-position",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.positionView = targets.positionTexture.createView();
  targets.depthTexture = makeTexture(
    "lesson-73-depth",
    "depth24plus",
    GPUTextureUsage.RENDER_ATTACHMENT
  );
  targets.depthView = targets.depthTexture.createView();
  targets.shadowBindGroup = device.createBindGroup({
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

export async function mountContactShadowsAndScreenSpaceShadowsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--contact-shadows">
      <div class="screen-reconstruct-stage">
        <div class="screen-reconstruct-badges">
          <span class="screen-reconstruct-badge">hovering objects + grazing light</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--warm">left: no contact shadows</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--cool">right: screen-space shadow补偿</span>
        </div>
        <div class="screen-reconstruct-controls">
          <label class="screen-reconstruct-control">
            <span>Ray Length</span>
            <strong id="contact-length-value"></strong>
            <input id="contact-length-range" type="range" min="0.18" max="1.4" step="0.01" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Step Count</span>
            <strong id="contact-steps-value"></strong>
            <input id="contact-steps-range" type="range" min="4" max="28" step="1" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Thickness</span>
            <strong id="contact-thickness-value"></strong>
            <input id="contact-thickness-range" type="range" min="0.03" max="0.28" step="0.01" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Shadow Strength</span>
            <strong id="contact-strength-value"></strong>
            <input id="contact-strength-range" type="range" min="0.2" max="1.5" step="0.01" />
          </label>
        </div>
        <div class="screen-reconstruct-labels screen-reconstruct-labels--two">
          <article class="screen-reconstruct-label">
            <span class="eyebrow">左栏</span>
            <strong>Base Lighting</strong>
            <span>主光和环境光都在，但最贴近接触点的小尺度阴影还没补回来。</span>
          </article>
          <article class="screen-reconstruct-label screen-reconstruct-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Contact Shadows</strong>
            <span>沿光方向做 screen-space ray march，只增强最贴近遮挡的那一圈阴影。</span>
          </article>
        </div>
        <div class="screen-reconstruct-frame screen-reconstruct-frame--wide">
          <canvas class="screen-reconstruct-canvas"></canvas>
        </div>
        <div class="screen-reconstruct-card-grid">
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Base</span>
            <strong id="contact-base-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Contact Shadows</span>
            <strong id="contact-shadow-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">观察</span>
            <strong id="contact-observation-card"></strong>
          </article>
        </div>
        <article class="screen-reconstruct-legend">
          <strong>当前实验</strong>
          <span id="contact-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: ContactShadowHudRefs = {
    lengthRange: host.querySelector("#contact-length-range") as HTMLInputElement,
    lengthValue: host.querySelector("#contact-length-value") as HTMLElement,
    stepsRange: host.querySelector("#contact-steps-range") as HTMLInputElement,
    stepsValue: host.querySelector("#contact-steps-value") as HTMLElement,
    thicknessRange: host.querySelector("#contact-thickness-range") as HTMLInputElement,
    thicknessValue: host.querySelector("#contact-thickness-value") as HTMLElement,
    strengthRange: host.querySelector("#contact-strength-range") as HTMLInputElement,
    strengthValue: host.querySelector("#contact-strength-value") as HTMLElement,
    baseCard: host.querySelector("#contact-base-card") as HTMLElement,
    shadowCard: host.querySelector("#contact-shadow-card") as HTMLElement,
    observationCard: host.querySelector("#contact-observation-card") as HTMLElement,
    legend: host.querySelector("#contact-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-73 缺少 canvas。");
  }

  const settings: ContactShadowSettings = {
    rayLength: 0.62,
    stepCount: 12,
    thickness: 0.1,
    shadowStrength: 0.82,
  };
  refs.lengthRange.value = settings.rayLength.toString();
  refs.stepsRange.value = settings.stepCount.toString();
  refs.thicknessRange.value = settings.thickness.toString();
  refs.strengthRange.value = settings.shadowStrength.toString();
  updateHud(refs, settings);

  const gpu = await createWebGpuCanvas(canvas);
  const { device, context, format } = gpu;
  const camera = createOrbitCameraController(canvas, {
    eye: [6.2, 4.0, 6.8],
    target: [0.0, 0.4, -0.4],
    minRadius: 4.6,
    maxRadius: 13.8,
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
  const shadowPipeline = createShadowPipeline(device, format);
  const frameUniformBuffer = device.createBuffer({
    size: 36 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const shadowUniformBuffer = device.createBuffer({
    size: 28 * 4,
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

  const targets: ContactShadowTargets = {
    colorTexture: null,
    colorView: null,
    normalTexture: null,
    normalView: null,
    positionTexture: null,
    positionView: null,
    depthTexture: null,
    depthView: null,
    shadowBindGroup: null,
    width: 0,
    height: 0,
  };

  let destroyed = false;
  let frameHandle = 0;

  const syncSettings = () => {
    updateHud(refs, settings);
  };

  refs.lengthRange.addEventListener("input", () => {
    settings.rayLength = Number(refs.lengthRange.value);
    syncSettings();
  });
  refs.stepsRange.addEventListener("input", () => {
    settings.stepCount = Number(refs.stepsRange.value);
    syncSettings();
  });
  refs.thicknessRange.addEventListener("input", () => {
    settings.thickness = Number(refs.thicknessRange.value);
    syncSettings();
  });
  refs.strengthRange.addEventListener("input", () => {
    settings.shadowStrength = Number(refs.strengthRange.value);
    syncSettings();
  });

  setStatus({
    title: "Contact Shadows 与屏幕空间阴影已运行",
    detail:
      "右栏会沿主光方向在屏幕空间深度里补近距离接触阴影，所以最明显的差别应该先出现在贴地和贴墙的位置。",
    tone: "ok",
  });

  const renderFrame = () => {
    if (destroyed) {
      return;
    }

    gpu.resize();
    const width = canvas.width;
    const height = canvas.height;
    ensureTargets(device, targets, width, height, shadowPipeline, sampler, shadowUniformBuffer);

    const snapshot = camera.getSnapshot();
    const viewMatrix = createLookAtViewMatrix(snapshot.eye, snapshot.target, snapshot.up);
    const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.5, width / Math.max(height, 1), CAMERA_NEAR, CAMERA_FAR);
    const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
    device.queue.writeBuffer(frameUniformBuffer, 0, createFrameUniformData(viewProjectionMatrix, viewMatrix));
    device.queue.writeBuffer(shadowUniformBuffer, 0, createShadowUniformData(projectionMatrix, viewMatrix, settings));

    const encoder = device.createCommandEncoder({ label: "lesson-73-command-encoder" });
    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.colorView!,
          clearValue: { r: 0.03, g: 0.04, b: 0.06, a: 1 },
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

    const shadowPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.03, g: 0.04, b: 0.06, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    shadowPass.setPipeline(shadowPipeline);
    shadowPass.setBindGroup(0, targets.shadowBindGroup!);
    shadowPass.draw(3);
    shadowPass.end();

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
    shadowUniformBuffer.destroy();
    for (const renderObject of renderObjects) {
      renderObject.uniformBuffer.destroy();
    }
  };
}
