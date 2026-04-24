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
import sceneFragmentShaderSource from "@/lessons/lesson-71-temporal-accumulation-and-disocclusion/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-71-temporal-accumulation-and-disocclusion/scene.vert.wgsl?raw";
import temporalShaderSource from "@/lessons/lesson-71-temporal-accumulation-and-disocclusion/temporal.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type TemporalSettings = {
  historyBlend: number;
  rejectionThreshold: number;
  disocclusionBias: number;
};

type TemporalHudRefs = {
  historyRange: HTMLInputElement;
  historyValue: HTMLElement;
  thresholdRange: HTMLInputElement;
  thresholdValue: HTMLElement;
  biasRange: HTMLInputElement;
  biasValue: HTMLElement;
  resetButton: HTMLButtonElement;
  currentCard: HTMLElement;
  naiveCard: HTMLElement;
  awareCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneObjectConfig = {
  color: [number, number, number, number];
  translation: Vector3;
  scale: Vector3;
  motion:
    | { type: "static" }
    | { type: "slide-x"; amplitude: number; frequency: number; phase: number };
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type TemporalTargets = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  velocityTexture: GPUTexture | null;
  velocityView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  historyNaiveTextures: [GPUTexture | null, GPUTexture | null];
  historyNaiveViews: [GPUTextureView | null, GPUTextureView | null];
  historyAwareTextures: [GPUTexture | null, GPUTexture | null];
  historyAwareViews: [GPUTextureView | null, GPUTextureView | null];
  width: number;
  height: number;
};

const LIGHT_DIRECTION: Vector3 = [-0.3, -0.92, -0.18];
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 30;

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function buildSceneObjects(): SceneObjectConfig[] {
  const objects: SceneObjectConfig[] = [
    {
      color: [0.08, 0.1, 0.14, 1],
      translation: [0, -1.0, 0],
      scale: [7.2, 0.08, 14.5],
      motion: { type: "static" },
    },
    {
      color: [0.1, 0.16, 0.22, 1],
      translation: [0, 2.05, -6.3],
      scale: [7.2, 3.4, 0.16],
      motion: { type: "static" },
    },
  ];

  for (let lane = 0; lane < 3; lane += 1) {
    const x = -1.5 + lane * 1.5;
    for (let index = 0; index < 18; index += 1) {
      objects.push({
        color: lane === 1 ? [0.78, 0.86, 1.0, 1] : [1.0, 0.84, 0.7, 1],
        translation: [x, -0.05 + (index % 2) * 0.14, -9.0 + index * 0.92],
        scale: [0.05, 1.45 + ((lane + index) % 3) * 0.18, 0.05],
        motion: { type: "static" },
      });
    }
  }

  objects.push({
    color: [0.88, 0.78, 0.54, 1],
    translation: [0, 0.35, -1.4],
    scale: [1.65, 1.9, 0.42],
    motion: { type: "slide-x", amplitude: 2.35, frequency: 0.44, phase: 0.0 },
  });

  objects.push({
    color: [0.66, 0.82, 1.0, 1],
    translation: [0, 1.45, 1.2],
    scale: [0.28, 0.28, 0.28],
    motion: { type: "static" },
  });

  return objects;
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

function createTemporalUniformData(
  settings: TemporalSettings,
  historyValid: boolean
): Float32Array {
  return new Float32Array([
    settings.historyBlend,
    settings.rejectionThreshold,
    settings.disocclusionBias,
    historyValid ? 1 : 0,
  ]);
}

function updateHud(refs: TemporalHudRefs, settings: TemporalSettings): void {
  refs.historyValue.textContent = formatPercent(settings.historyBlend);
  refs.thresholdValue.textContent = settings.rejectionThreshold.toFixed(2);
  refs.biasValue.textContent = settings.disocclusionBias.toFixed(2);
  refs.currentCard.textContent =
    "左栏只显示当前帧，所以前景遮挡板刚移开时，后面的细栅栏会立刻恢复成正确画面。";
  refs.naiveCard.textContent =
    `中栏会直接拿 history 继续累积，当前仍有 ${formatPercent(settings.historyBlend)} 的历史权重，所以最容易在刚暴露出的背景上留下脏尾巴。`;
  refs.awareCard.textContent =
    settings.rejectionThreshold < 0.18
      ? "右栏当前会更积极地丢弃历史，只要当前帧和 history 差异一大，就会尽快把新暴露区域拉回当前帧。"
      : "右栏会先比较当前颜色和 reprojected history 的差异，再决定该不该继续保留历史。";
  refs.observationCard.textContent =
    settings.disocclusionBias > 0.28
      ? "当前 disocclusion bias 偏大，右栏恢复会更快，但也可能更早放弃本来还能稳定复用的 history。"
      : "注意前景板边缘：中栏会把已经失效的 history 拖过来，右栏则会更快识别“遮挡刚刚被揭开”的区域。";
  refs.legend.textContent =
    "时间累积的难点不在“有没有 history”，而在“什么时候该勇敢扔掉 history”。disocclusion-aware accumulation 就是在补这个判断。";
}

function createScenePipeline(device: GPUDevice): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-71-scene-pipeline",
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

function createTemporalPipeline(device: GPUDevice): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: temporalShaderSource });
  return device.createRenderPipeline({
    label: "lesson-71-temporal-pipeline",
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsFullscreen",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "accumulateFs",
      targets: [{ format: "rgba16float" }, { format: "rgba16float" }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

function createPresentPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: temporalShaderSource });
  return device.createRenderPipeline({
    label: "lesson-71-present-pipeline",
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

function destroyTargets(targets: TemporalTargets): void {
  targets.colorTexture?.destroy();
  targets.velocityTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.historyNaiveTextures[0]?.destroy();
  targets.historyNaiveTextures[1]?.destroy();
  targets.historyAwareTextures[0]?.destroy();
  targets.historyAwareTextures[1]?.destroy();
  targets.colorTexture = null;
  targets.colorView = null;
  targets.velocityTexture = null;
  targets.velocityView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.historyNaiveTextures = [null, null];
  targets.historyNaiveViews = [null, null];
  targets.historyAwareTextures = [null, null];
  targets.historyAwareViews = [null, null];
  targets.width = 0;
  targets.height = 0;
}

function ensureTargets(device: GPUDevice, targets: TemporalTargets, width: number, height: number): void {
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
    "lesson-71-color",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.colorView = targets.colorTexture.createView();
  targets.velocityTexture = makeTexture(
    "lesson-71-velocity",
    "rgba16float",
    GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
  );
  targets.velocityView = targets.velocityTexture.createView();
  targets.depthTexture = makeTexture(
    "lesson-71-depth",
    "depth24plus",
    GPUTextureUsage.RENDER_ATTACHMENT
  );
  targets.depthView = targets.depthTexture.createView();

  for (let index = 0; index < 2; index += 1) {
    targets.historyNaiveTextures[index] = makeTexture(
      `lesson-71-history-naive-${index}`,
      "rgba16float",
      GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    );
    targets.historyNaiveViews[index] = targets.historyNaiveTextures[index]!.createView();
    targets.historyAwareTextures[index] = makeTexture(
      `lesson-71-history-aware-${index}`,
      "rgba16float",
      GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    );
    targets.historyAwareViews[index] = targets.historyAwareTextures[index]!.createView();
  }

  targets.width = width;
  targets.height = height;
}

function createModelMatrix(config: SceneObjectConfig, time: number): Float32Array {
  let x = config.translation[0];
  if (config.motion.type === "slide-x") {
    x += Math.sin(time * config.motion.frequency + config.motion.phase) * config.motion.amplitude;
  }

  return multiplyMatrices(
    createTranslationMatrix(x, config.translation[1], config.translation[2]),
    createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
  );
}

export async function mountTemporalAccumulationAndDisocclusionLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--temporal-accumulation">
      <div class="screen-reconstruct-stage">
        <div class="screen-reconstruct-badges">
          <span class="screen-reconstruct-badge">foreground occluder + fine background</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--warm">naive accumulation 会拖残影</span>
          <span class="screen-reconstruct-badge screen-reconstruct-badge--cool">右栏会主动丢失效 history</span>
        </div>
        <div class="screen-reconstruct-controls">
          <label class="screen-reconstruct-control">
            <span>History Blend</span>
            <strong id="temporal-history-value"></strong>
            <input id="temporal-history-range" type="range" min="0.05" max="0.95" step="0.01" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Rejection Threshold</span>
            <strong id="temporal-threshold-value"></strong>
            <input id="temporal-threshold-range" type="range" min="0.04" max="0.48" step="0.01" />
          </label>
          <label class="screen-reconstruct-control">
            <span>Disocclusion Bias</span>
            <strong id="temporal-bias-value"></strong>
            <input id="temporal-bias-range" type="range" min="0.04" max="0.4" step="0.01" />
          </label>
          <div class="screen-reconstruct-control screen-reconstruct-control--toggle">
            <span>History Lifecycle</span>
            <strong>Reset History</strong>
            <div class="screen-reconstruct-toggle-row">
              <button id="temporal-reset-button" class="screen-reconstruct-toggle" type="button">清空 history</button>
            </div>
          </div>
        </div>
        <div class="screen-reconstruct-labels screen-reconstruct-labels--three">
          <article class="screen-reconstruct-label">
            <span class="eyebrow">左栏</span>
            <strong>Current Frame</strong>
            <span>永远只看当前帧，不会拿历史来稳图。</span>
          </article>
          <article class="screen-reconstruct-label">
            <span class="eyebrow">中栏</span>
            <strong>Naive Accumulation</strong>
            <span>直接积 history，所以最容易把已失效区域拖脏。</span>
          </article>
          <article class="screen-reconstruct-label screen-reconstruct-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Disocclusion-aware</strong>
            <span>历史和当前帧差异太大时，会更快退回当前帧。</span>
          </article>
        </div>
        <div class="screen-reconstruct-frame screen-reconstruct-frame--wide">
          <canvas class="screen-reconstruct-canvas"></canvas>
        </div>
        <div class="screen-reconstruct-card-grid">
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Current</span>
            <strong id="temporal-current-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Naive</span>
            <strong id="temporal-naive-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">Aware</span>
            <strong id="temporal-aware-card"></strong>
          </article>
          <article class="screen-reconstruct-card">
            <span class="eyebrow">观察</span>
            <strong id="temporal-observation-card"></strong>
          </article>
        </div>
        <article class="screen-reconstruct-legend">
          <strong>当前实验</strong>
          <span id="temporal-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: TemporalHudRefs = {
    historyRange: host.querySelector("#temporal-history-range") as HTMLInputElement,
    historyValue: host.querySelector("#temporal-history-value") as HTMLElement,
    thresholdRange: host.querySelector("#temporal-threshold-range") as HTMLInputElement,
    thresholdValue: host.querySelector("#temporal-threshold-value") as HTMLElement,
    biasRange: host.querySelector("#temporal-bias-range") as HTMLInputElement,
    biasValue: host.querySelector("#temporal-bias-value") as HTMLElement,
    resetButton: host.querySelector("#temporal-reset-button") as HTMLButtonElement,
    currentCard: host.querySelector("#temporal-current-card") as HTMLElement,
    naiveCard: host.querySelector("#temporal-naive-card") as HTMLElement,
    awareCard: host.querySelector("#temporal-aware-card") as HTMLElement,
    observationCard: host.querySelector("#temporal-observation-card") as HTMLElement,
    legend: host.querySelector("#temporal-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-71 缺少 canvas。");
  }

  const settings: TemporalSettings = {
    historyBlend: 0.82,
    rejectionThreshold: 0.16,
    disocclusionBias: 0.18,
  };
  refs.historyRange.value = settings.historyBlend.toString();
  refs.thresholdRange.value = settings.rejectionThreshold.toString();
  refs.biasRange.value = settings.disocclusionBias.toString();
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

  const mesh = createMeshBuffers(device, createBoxGeometry());
  const scenePipeline = createScenePipeline(device);
  const temporalPipeline = createTemporalPipeline(device);
  const presentPipeline = createPresentPipeline(device, format);
  const sceneBindLayout = scenePipeline.getBindGroupLayout(0);
  const temporalUniformBuffer = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const frameUniformBuffer = device.createBuffer({
    size: 36 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const sceneObjects = buildSceneObjects();
  const renderObjects: RenderObject[] = sceneObjects.map((config) => {
    const uniformBuffer = device.createBuffer({
      size: 36 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = device.createBindGroup({
      layout: sceneBindLayout,
      entries: [
        { binding: 0, resource: { buffer: frameUniformBuffer } },
        { binding: 1, resource: { buffer: uniformBuffer } },
      ],
    });
    return { config, uniformBuffer, bindGroup };
  });

  const targets: TemporalTargets = {
    colorTexture: null,
    colorView: null,
    velocityTexture: null,
    velocityView: null,
    depthTexture: null,
    depthView: null,
    historyNaiveTextures: [null, null],
    historyNaiveViews: [null, null],
    historyAwareTextures: [null, null],
    historyAwareViews: [null, null],
    width: 0,
    height: 0,
  };

  let historyIndex = 0;
  let historyValid = false;
  let destroyed = false;
  let frameHandle = 0;
  let previousTime = 0;

  const resetHistory = () => {
    historyValid = false;
    historyIndex = 0;
  };

  const syncSettings = () => {
    updateHud(refs, settings);
    resetHistory();
  };

  refs.historyRange.addEventListener("input", () => {
    settings.historyBlend = Number(refs.historyRange.value);
    syncSettings();
  });
  refs.thresholdRange.addEventListener("input", () => {
    settings.rejectionThreshold = Number(refs.thresholdRange.value);
    syncSettings();
  });
  refs.biasRange.addEventListener("input", () => {
    settings.disocclusionBias = Number(refs.biasRange.value);
    syncSettings();
  });
  refs.resetButton.addEventListener("click", () => {
    resetHistory();
  });

  setStatus({
    title: "Temporal Accumulation 与遮挡暴露已运行",
    detail:
      "中栏会故意保留 naive history，所以前景板移开时容易拖残影；右栏则会用最小 rejection 规则更快丢掉失效 history。",
    tone: "ok",
  });

  const viewMatrix = createLookAtViewMatrix([0, 1.8, 7.8], [0, 0.45, 0], [0, 1, 0]);

  const renderFrame = (timestamp: number) => {
    if (destroyed) {
      return;
    }

    gpu.resize();
    const width = canvas.width;
    const height = canvas.height;
    const resized = targets.width !== width || targets.height !== height;
    ensureTargets(device, targets, width, height);
    if (resized) {
      resetHistory();
    }

    const time = timestamp * 0.001;
    const previousSampleTime = historyValid ? previousTime : time - 1 / 60;
    previousTime = time;

    const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.6, width / Math.max(height, 1), CAMERA_NEAR, CAMERA_FAR);
    const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
    device.queue.writeBuffer(
      frameUniformBuffer,
      0,
      createFrameUniformData(viewProjectionMatrix, viewProjectionMatrix)
    );

    for (const renderObject of renderObjects) {
      const currentModel = createModelMatrix(renderObject.config, time);
      const previousModel = createModelMatrix(renderObject.config, previousSampleTime);
      device.queue.writeBuffer(
        renderObject.uniformBuffer,
        0,
        createObjectUniformData(currentModel, previousModel, renderObject.config.color)
      );
    }

    const readIndex = historyIndex;
    const writeIndex = (historyIndex + 1) % 2;

    device.queue.writeBuffer(
      temporalUniformBuffer,
      0,
      createTemporalUniformData(settings, historyValid)
    );

    const temporalBindGroup = device.createBindGroup({
      layout: temporalPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: targets.colorView! },
        { binding: 1, resource: targets.velocityView! },
        { binding: 2, resource: targets.historyNaiveViews[readIndex]! },
        { binding: 3, resource: targets.historyAwareViews[readIndex]! },
        { binding: 4, resource: sampler },
        { binding: 5, resource: { buffer: temporalUniformBuffer } },
      ],
    });

    const presentBindGroup = device.createBindGroup({
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: targets.colorView! },
        { binding: 1, resource: targets.historyNaiveViews[writeIndex]! },
        { binding: 2, resource: targets.historyAwareViews[writeIndex]! },
        { binding: 3, resource: sampler },
      ],
    });

    const encoder = device.createCommandEncoder({ label: "lesson-71-command-encoder" });

    const scenePass = encoder.beginRenderPass({
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
    scenePass.setVertexBuffer(0, mesh.vertexBuffer);
    scenePass.setIndexBuffer(mesh.indexBuffer, "uint16");
    for (const renderObject of renderObjects) {
      scenePass.setBindGroup(0, renderObject.bindGroup);
      scenePass.drawIndexed(mesh.indexCount);
    }
    scenePass.end();

    const temporalPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: targets.historyNaiveViews[writeIndex]!,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
        {
          view: targets.historyAwareViews[writeIndex]!,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    temporalPass.setPipeline(temporalPipeline);
    temporalPass.setBindGroup(0, temporalBindGroup);
    temporalPass.draw(3);
    temporalPass.end();

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
    historyIndex = writeIndex;
    historyValid = true;
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
    temporalUniformBuffer.destroy();
    for (const renderObject of renderObjects) {
      renderObject.uniformBuffer.destroy();
    }
  };
}
