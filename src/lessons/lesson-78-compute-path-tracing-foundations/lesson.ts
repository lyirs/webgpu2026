import { createWebGpuCanvas } from "@/core/webgpu";
import {
  createBoxGeometry,
  createMeshBuffers,
} from "@/lessons/screen-space-common/geometry";
import {
  CORNELL_CAMERA,
  createCornellRasterObjects,
  createCornellSceneStorageData,
  getCornellLightColor,
  getCornellLightPosition,
} from "@/lessons/path-tracing-common/scene";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  crossVectors,
  normalizeVector,
  subtractVectors,
  type Vector3,
} from "@/lessons/path-tracing-common/math";
import pathTraceShaderSource from "@/lessons/lesson-78-compute-path-tracing-foundations/path-trace.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-78-compute-path-tracing-foundations/present.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-78-compute-path-tracing-foundations/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-78-compute-path-tracing-foundations/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type PathTracingSettings = {
  maxBounce: number;
  samplesPerFrame: number;
  exposure: number;
  freezeSeed: boolean;
};

type PathTracingHudRefs = {
  bounceRange: HTMLInputElement;
  bounceValue: HTMLElement;
  sampleRange: HTMLInputElement;
  sampleValue: HTMLElement;
  exposureRange: HTMLInputElement;
  exposureValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  referenceCard: HTMLElement;
  pathTraceCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type RenderObject = {
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type PathTracingTargets = {
  referenceTexture: GPUTexture | null;
  referenceView: GPUTextureView | null;
  referenceDepthTexture: GPUTexture | null;
  referenceDepthView: GPUTextureView | null;
  traceBuffer: GPUBuffer | null;
  presentBindGroup: GPUBindGroup | null;
  computeBindGroup: GPUBindGroup | null;
  panelWidth: number;
  panelHeight: number;
};

const CAMERA_FOV = Math.PI / 3.5;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 12;

function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  lightPosition: Vector3,
  lightColor: Vector3
): Float32Array {
  const data = new Float32Array(24);
  data.set(viewProjectionMatrix, 0);
  data.set([...lightPosition, 1], 16);
  data.set([...lightColor, 1], 20);
  return data;
}

function createObjectUniformData(
  modelMatrix: Float32Array,
  albedo: [number, number, number, number],
  emission: [number, number, number, number]
): Float32Array {
  const data = new Float32Array(24);
  data.set(modelMatrix, 0);
  data.set(albedo, 16);
  data.set(emission, 20);
  return data;
}

function createTraceUniformData(
  panelWidth: number,
  panelHeight: number,
  settings: PathTracingSettings,
  seed: number
): Float32Array {
  const eye = CORNELL_CAMERA.eye;
  const target = CORNELL_CAMERA.target;
  const worldUp: Vector3 = [0, 1, 0];
  const forward = normalizeVector(subtractVectors(target, eye));
  const right = normalizeVector(crossVectors(forward, worldUp));
  const up = normalizeVector(crossVectors(right, forward));
  const aspect = panelWidth / Math.max(panelHeight, 1);
  const halfHeight = Math.tan(CAMERA_FOV * 0.5);
  const halfWidth = halfHeight * aspect;

  const data = new Float32Array(24);
  data.set([panelWidth, panelHeight, aspect, seed], 0);
  data.set([eye[0], eye[1], eye[2], settings.maxBounce], 4);
  data.set([forward[0], forward[1], forward[2], settings.samplesPerFrame], 8);
  data.set([right[0] * halfWidth, right[1] * halfWidth, right[2] * halfWidth, 0], 12);
  data.set([up[0] * halfHeight, up[1] * halfHeight, up[2] * halfHeight, 8], 16);
  data.set([0.02, 0.025, 0.04, 0], 20);
  return data;
}

function createPresentUniformData(
  panelWidth: number,
  panelHeight: number,
  settings: PathTracingSettings
): Float32Array {
  return new Float32Array([panelWidth, panelHeight, settings.exposure, 0]);
}

function updateHud(refs: PathTracingHudRefs, settings: PathTracingSettings): void {
  refs.bounceValue.textContent = `${settings.maxBounce}`;
  refs.sampleValue.textContent = `${settings.samplesPerFrame} spp`;
  refs.exposureValue.textContent = `${settings.exposure.toFixed(2)}x`;
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeSeed);
  refs.referenceCard.textContent =
    "左栏还是传统 raster direct light：它能稳定给出主光照和 emissive，但不会自己长出真正的多次 diffuse bounce。";
  refs.pathTraceCard.textContent =
    "右栏在 compute 里发射随机路径，所以 1 spp 时一定 noisy；它的价值在于现在已经能开始显出 color bleeding 和 bounce light 倾向。";
  refs.observationCard.textContent =
    settings.maxBounce <= 1
      ? "当前 bounce 只有 1 次，右栏更像“带 emissive 命中”的直接路径；把 bounce 拉高以后，房间内部的间接染色会更明显。"
      : settings.freezeSeed
        ? "现在 seed 被冻结了，所以你看到的是固定噪声图样；这有助于把注意力放在“间接光结构”本身，而不是噪声闪动。"
        : "保持随机 seed 动起来时，右栏会持续抖动；这正是下一课为什么要继续接 progressive accumulation 与 denoise 的原因。";
  refs.legend.textContent =
    "这节课故意保留 noisy 单帧路径追踪：真正的教学重点不是“马上好看”，而是看清 stochastic 输入第一次怎样把间接光带进画面。";
}

function createScenePipeline(device: GPUDevice): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });
  return device.createRenderPipeline({
    label: "lesson-78-scene-pipeline",
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
      targets: [{ format: "rgba16float" }],
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

function createPathTracePipeline(device: GPUDevice): GPUComputePipeline {
  const shaderModule = device.createShaderModule({ code: pathTraceShaderSource });
  return device.createComputePipeline({
    label: "lesson-78-path-trace-pipeline",
    layout: "auto",
    compute: {
      module: shaderModule,
      entryPoint: "traceMain",
    },
  });
}

function createPresentPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: presentShaderSource });
  return device.createRenderPipeline({
    label: "lesson-78-present-pipeline",
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

function destroyTargets(targets: PathTracingTargets): void {
  targets.referenceTexture?.destroy();
  targets.referenceDepthTexture?.destroy();
  targets.traceBuffer?.destroy();
  targets.referenceTexture = null;
  targets.referenceView = null;
  targets.referenceDepthTexture = null;
  targets.referenceDepthView = null;
  targets.traceBuffer = null;
  targets.presentBindGroup = null;
  targets.computeBindGroup = null;
  targets.panelWidth = 0;
  targets.panelHeight = 0;
}

function ensureTargets(
  device: GPUDevice,
  targets: PathTracingTargets,
  canvasWidth: number,
  canvasHeight: number,
  pathTracePipeline: GPUComputePipeline,
  presentPipeline: GPURenderPipeline,
  sampler: GPUSampler,
  sceneBuffer: GPUBuffer,
  traceUniformBuffer: GPUBuffer,
  presentUniformBuffer: GPUBuffer
): void {
  const panelWidth = Math.max(1, Math.floor(canvasWidth * 0.5));
  const panelHeight = Math.max(1, canvasHeight);
  if (targets.panelWidth === panelWidth && targets.panelHeight === panelHeight) {
    return;
  }

  destroyTargets(targets);

  targets.referenceTexture = device.createTexture({
    label: "lesson-78-reference-texture",
    size: [panelWidth, panelHeight],
    format: "rgba16float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  targets.referenceView = targets.referenceTexture.createView();

  targets.referenceDepthTexture = device.createTexture({
    label: "lesson-78-reference-depth",
    size: [panelWidth, panelHeight],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  targets.referenceDepthView = targets.referenceDepthTexture.createView();

  targets.traceBuffer = device.createBuffer({
    label: "lesson-78-trace-buffer",
    size: panelWidth * panelHeight * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  targets.computeBindGroup = device.createBindGroup({
    layout: pathTracePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: sceneBuffer } },
      { binding: 1, resource: { buffer: targets.traceBuffer } },
      { binding: 2, resource: { buffer: traceUniformBuffer } },
    ],
  });

  targets.presentBindGroup = device.createBindGroup({
    layout: presentPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: sampler },
      { binding: 1, resource: targets.referenceView },
      { binding: 2, resource: { buffer: targets.traceBuffer } },
      { binding: 3, resource: { buffer: presentUniformBuffer } },
    ],
  });

  targets.panelWidth = panelWidth;
  targets.panelHeight = panelHeight;
}

export async function mountComputePathTracingFoundationsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--path-tracing">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">analytic Cornell room</span>
          <span class="path-trace-badge path-trace-badge--warm">left: raster direct-light reference</span>
          <span class="path-trace-badge path-trace-badge--cool">right: 1 spp compute path tracing</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Max Bounce</span>
            <strong id="path-trace-bounce-value"></strong>
            <input id="path-trace-bounce-range" type="range" min="1" max="3" step="1" />
          </label>
          <label class="path-trace-control">
            <span>Samples per Frame</span>
            <strong id="path-trace-sample-value"></strong>
            <input id="path-trace-sample-range" type="range" min="1" max="4" step="1" />
          </label>
          <label class="path-trace-control">
            <span>Exposure</span>
            <strong id="path-trace-exposure-value"></strong>
            <input id="path-trace-exposure-range" type="range" min="0.7" max="2.2" step="0.05" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Seed</span>
            <strong>Freeze Seed</strong>
            <div class="path-trace-toggle-row">
              <button id="path-trace-freeze-button" class="path-trace-toggle" type="button">freeze</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--two">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Raster Direct Light</strong>
            <span>稳定、清楚，但它还只是在做主光照和 emissive，不会自己长出间接 bounce。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>1 spp Compute Path Tracing</strong>
            <span>故意保留单帧噪声，先看清 stochastic 输入怎样第一次把间接光带进场景。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card">
            <span class="eyebrow">Raster Reference</span>
            <strong id="path-trace-reference-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">Compute Trace</span>
            <strong id="path-trace-result-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">观察</span>
            <strong id="path-trace-observation-card"></strong>
          </article>
        </div>
        <article class="path-trace-legend">
          <strong>当前实验</strong>
          <span id="path-trace-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: PathTracingHudRefs = {
    bounceRange: host.querySelector("#path-trace-bounce-range") as HTMLInputElement,
    bounceValue: host.querySelector("#path-trace-bounce-value") as HTMLElement,
    sampleRange: host.querySelector("#path-trace-sample-range") as HTMLInputElement,
    sampleValue: host.querySelector("#path-trace-sample-value") as HTMLElement,
    exposureRange: host.querySelector("#path-trace-exposure-range") as HTMLInputElement,
    exposureValue: host.querySelector("#path-trace-exposure-value") as HTMLElement,
    freezeButton: host.querySelector("#path-trace-freeze-button") as HTMLButtonElement,
    referenceCard: host.querySelector("#path-trace-reference-card") as HTMLElement,
    pathTraceCard: host.querySelector("#path-trace-result-card") as HTMLElement,
    observationCard: host.querySelector("#path-trace-observation-card") as HTMLElement,
    legend: host.querySelector("#path-trace-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-78 缺少 canvas。");
  }

  const settings: PathTracingSettings = {
    maxBounce: 2,
    samplesPerFrame: 1,
    exposure: 1.2,
    freezeSeed: false,
  };
  refs.bounceRange.value = settings.maxBounce.toString();
  refs.sampleRange.value = settings.samplesPerFrame.toString();
  refs.exposureRange.value = settings.exposure.toString();
  updateHud(refs, settings);

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
  const scenePipeline = createScenePipeline(device);
  const pathTracePipeline = createPathTracePipeline(device);
  const presentPipeline = createPresentPipeline(device, format);

  const frameUniformBuffer = device.createBuffer({
    size: 24 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const traceUniformBuffer = device.createBuffer({
    size: 24 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const presentUniformBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sceneBuffer = device.createBuffer({
    size: createCornellSceneStorageData().byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(sceneBuffer, 0, createCornellSceneStorageData());

  const frameBindLayout = scenePipeline.getBindGroupLayout(0);
  const renderObjects: RenderObject[] = createCornellRasterObjects().map((object) => {
    const uniformBuffer = device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      createObjectUniformData(object.modelMatrix, object.albedo, object.emission)
    );
    const bindGroup = device.createBindGroup({
      layout: frameBindLayout,
      entries: [
        { binding: 0, resource: { buffer: frameUniformBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
      ],
    });
    return { uniformBuffer, bindGroup };
  });

  const targets: PathTracingTargets = {
    referenceTexture: null,
    referenceView: null,
    referenceDepthTexture: null,
    referenceDepthView: null,
    traceBuffer: null,
    presentBindGroup: null,
    computeBindGroup: null,
    panelWidth: 0,
    panelHeight: 0,
  };

  let destroyed = false;
  let frameHandle = 0;
  let frameIndex = 0;

  const syncSettings = () => {
    updateHud(refs, settings);
  };

  refs.bounceRange.addEventListener("input", () => {
    settings.maxBounce = Number(refs.bounceRange.value);
    syncSettings();
  });
  refs.sampleRange.addEventListener("input", () => {
    settings.samplesPerFrame = Number(refs.sampleRange.value);
    syncSettings();
  });
  refs.exposureRange.addEventListener("input", () => {
    settings.exposure = Number(refs.exposureRange.value);
    syncSettings();
  });
  refs.freezeButton.addEventListener("click", () => {
    settings.freezeSeed = !settings.freezeSeed;
    syncSettings();
  });

  setStatus({
    title: "Compute Path Tracing 基础已运行",
    detail:
      "左栏保持 raster direct-light reference，右栏则故意只用 1 spp compute path tracing，让你先看到 bounce light 和 color bleeding 是怎样第一次出现的。",
    tone: "ok",
  });

  const renderFrame = () => {
    if (destroyed) {
      return;
    }

    gpu.resize();
    ensureTargets(
      device,
      targets,
      canvas.width,
      canvas.height,
      pathTracePipeline,
      presentPipeline,
      sampler,
      sceneBuffer,
      traceUniformBuffer,
      presentUniformBuffer
    );

    const viewMatrix = createLookAtViewMatrix(
      CORNELL_CAMERA.eye,
      CORNELL_CAMERA.target,
      [0, 1, 0]
    );
    const projectionMatrix = createPerspectiveMatrix(
      CAMERA_FOV,
      targets.panelWidth / Math.max(targets.panelHeight, 1),
      CAMERA_NEAR,
      CAMERA_FAR
    );
    const composed = (() => {
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
      frameUniformBuffer,
      0,
      createFrameUniformData(
        composed,
        getCornellLightPosition(),
        getCornellLightColor()
      )
    );

    const seed = settings.freezeSeed ? 7 : frameIndex + 1;
    device.queue.writeBuffer(
      traceUniformBuffer,
      0,
      createTraceUniformData(targets.panelWidth, targets.panelHeight, settings, seed)
    );
    device.queue.writeBuffer(
      presentUniformBuffer,
      0,
      createPresentUniformData(targets.panelWidth, targets.panelHeight, settings)
    );

    const encoder = device.createCommandEncoder({
      label: "lesson-78-command-encoder",
    });

    const scenePass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.referenceView!,
          clearValue: { r: 0.03, g: 0.035, b: 0.05, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: targets.referenceDepthView!,
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

    const tracePass = encoder.beginComputePass({
      label: "lesson-78-trace-pass",
    });
    tracePass.setPipeline(pathTracePipeline);
    tracePass.setBindGroup(0, targets.computeBindGroup!);
    tracePass.dispatchWorkgroups(
      Math.ceil(targets.panelWidth / 8),
      Math.ceil(targets.panelHeight / 8)
    );
    tracePass.end();

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
    frameIndex += 1;
    frameHandle = window.requestAnimationFrame(renderFrame);
  };

  renderFrame();

  return () => {
    destroyed = true;
    window.cancelAnimationFrame(frameHandle);
    destroyTargets(targets);
    mesh.vertexBuffer.destroy();
    mesh.indexBuffer.destroy();
    frameUniformBuffer.destroy();
    traceUniformBuffer.destroy();
    presentUniformBuffer.destroy();
    sceneBuffer.destroy();
    renderObjects.forEach((renderObject) => renderObject.uniformBuffer.destroy());
  };
}
