import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createGpuDrivenSceneGeometry } from "@/lessons/gpu-driven-common/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  extractFrustumPlanes,
  multiplyMatrices,
  sphereIntersectsFrustum,
  type Vector3,
} from "@/lessons/gpu-driven-common/math";
import {
  createGpuDrivenStreetScene,
  buildVisibleInstances,
  createAllVisibleFlags,
  createGpuDrivenInstanceData,
  countVisibleFlags,
} from "@/lessons/gpu-driven-common/scene";
import {
  createDrawUniformData,
  createFrameUniformData,
  createGpuDrivenMeshBuffers,
  destroyDepthTarget,
  ensureDepthTarget,
  type DepthTarget,
} from "@/lessons/gpu-driven-common/render";
import computeShaderSource from "@/lessons/lesson-123-hiz-and-occlusion-culling/compute.wgsl?raw";
import depthCopyShaderSource from "@/lessons/lesson-123-hiz-and-occlusion-culling/depth-copy.wgsl?raw";
import depthDownsampleShaderSource from "@/lessons/lesson-123-hiz-and-occlusion-culling/depth-downsample.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/gpu-driven-common/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/gpu-driven-common/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type HiZOcclusionSettings = {
  fov: number;
  farPlane: number;
};

type HiZOcclusionHudRefs = {
  fovRange: HTMLInputElement;
  fovValue: HTMLElement;
  farRange: HTMLInputElement;
  farValue: HTMLElement;
  frustumValue: HTMLElement;
  occludedValue: HTMLElement;
  submittedValue: HTMLElement;
  levelsValue: HTMLElement;
  observationValue: HTMLElement;
  legendValue: HTMLElement;
};

type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type HiZLevel = {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
};

type HiZResources = {
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  levels: HiZLevel[];
  width: number;
  height: number;
};

const INSTANCE_COUNT = 1024;
const CAMERA_NEAR = 0.1;
const LIGHT_DIRECTION: Vector3 = [-0.42, -0.92, -0.18];
const INITIAL_FOV = Math.PI / 3.15;
const INITIAL_FAR = 40;
const WORKGROUP_SIZE = 64;
const MAX_HIZ_LEVELS = 6;
const OCCLUSION_BIAS = 0.0025;

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDegrees(value: number): string {
  return `${Math.round((value * 180) / Math.PI)}°`;
}

function formatDistance(value: number): string {
  return `${value.toFixed(1)}m`;
}

function createPanelRects(width: number, height: number): [PanelRect, PanelRect] {
  const gap = Math.max(12, Math.floor(width * 0.014));
  const panelWidth = Math.max(1, Math.floor((width - gap) * 0.5));

  return [
    { x: 0, y: 0, width: panelWidth, height },
    { x: panelWidth + gap, y: 0, width: panelWidth, height },
  ];
}

function createOcclusionUniformData(
  frustumPlanes: Float32Array,
  viewMatrix: Float32Array,
  projectionMatrix: Float32Array,
  instanceCount: number,
  levelCount: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(240);
  const floats = new Float32Array(buffer);
  const uints = new Uint32Array(buffer);
  floats.set(frustumPlanes, 0);
  floats.set(viewMatrix, 24);
  floats.set(projectionMatrix, 40);
  floats[56] = instanceCount;
  floats[57] = levelCount;
  floats[58] = OCCLUSION_BIAS;
  uints[59] = 0;
  return buffer;
}

function createScanUniformData(
  instanceCount: number,
  offset: number,
  indexCount: number
): Uint32Array {
  return new Uint32Array([instanceCount, offset, indexCount, 0]);
}

function createScanOffsets(instanceCount: number): number[] {
  const offsets: number[] = [];
  for (let offset = 1; offset < instanceCount; offset *= 2) {
    offsets.push(offset);
  }
  return offsets;
}

function updateHud(
  refs: HiZOcclusionHudRefs,
  settings: HiZOcclusionSettings,
  frustumVisible: number,
  submittedAfterOcclusion: number | null,
  levelCount: number
): void {
  const occludedCount =
    submittedAfterOcclusion === null ? null : Math.max(frustumVisible - submittedAfterOcclusion, 0);

  refs.fovValue.textContent = formatDegrees(settings.fov);
  refs.farValue.textContent = formatDistance(settings.farPlane);
  refs.frustumValue.textContent = formatCount(frustumVisible);
  refs.occludedValue.textContent =
    occludedCount === null ? "等待首轮" : formatCount(occludedCount);
  refs.submittedValue.textContent =
    submittedAfterOcclusion === null ? "等待首轮" : formatCount(submittedAfterOcclusion);
  refs.levelsValue.textContent = `${levelCount} levels`;
  refs.observationValue.textContent =
    submittedAfterOcclusion === null
      ? "右栏已经开始构建 depth pyramid，但 GPU 读回还在等待第一轮完成。"
      : occludedCount === 0
        ? "当前视角里虽然 depth pyramid 已经建好，但右栏还没有遇到足够稳定的遮挡关系。"
        : "左栏只做 frustum culling；右栏会先生成 depth pyramid，再把被墙真正挡住的实例从 draw 输入里剔掉。";
  refs.legendValue.textContent =
    "这一课会把“在视锥里”继续推进到“虽然在视锥里，但其实被挡住了”：右栏先为 occluder 生成 depth pyramid，再做 conservative occlusion test。";
}

function createScenePipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-63-scene-pipeline",
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
      targets: [{ format }],
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

function createOccluderDepthPipeline(device: GPUDevice): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });

  return device.createRenderPipeline({
    label: "lesson-63-occluder-depth-pipeline",
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
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    depthStencil: {
      format: "depth32float",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });
}

function createFullscreenPipeline(
  device: GPUDevice,
  code: string,
  label: string
): GPURenderPipeline {
  const module = device.createShaderModule({ code });

  return device.createRenderPipeline({
    label,
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vsMain",
    },
    fragment: {
      module,
      entryPoint: "fsMain",
      targets: [{ format: "rgba16float" }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });
}

function destroyHiZResources(resources: HiZResources): void {
  resources.depthTexture?.destroy();
  resources.depthTexture = null;
  resources.depthView = null;
  resources.levels.forEach((level) => {
    level.texture.destroy();
  });
  resources.levels = [];
  resources.width = 0;
  resources.height = 0;
}

function ensureHiZResources(
  device: GPUDevice,
  resources: HiZResources,
  width: number,
  height: number
): number {
  if (
    resources.depthTexture &&
    resources.depthView &&
    resources.width === width &&
    resources.height === height &&
    resources.levels.length === MAX_HIZ_LEVELS
  ) {
    return resources.levels.length;
  }

  destroyHiZResources(resources);

  resources.depthTexture = device.createTexture({
    size: [width, height, 1],
    format: "depth32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });
  resources.depthView = resources.depthTexture.createView();
  resources.width = width;
  resources.height = height;

  let levelWidth = width;
  let levelHeight = height;

  for (let levelIndex = 0; levelIndex < MAX_HIZ_LEVELS; levelIndex += 1) {
    const texture = device.createTexture({
      size: [levelWidth, levelHeight, 1],
      format: "rgba16float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    resources.levels.push({
      texture,
      view: texture.createView(),
      width: levelWidth,
      height: levelHeight,
    });
    levelWidth = Math.max(1, Math.floor(levelWidth * 0.5));
    levelHeight = Math.max(1, Math.floor(levelHeight * 0.5));
  }

  return resources.levels.length;
}

function drawCpuPanel(
  pass: GPURenderPassEncoder,
  rect: PanelRect,
  pipeline: GPURenderPipeline,
  meshBuffers: ReturnType<typeof createGpuDrivenMeshBuffers>,
  staticBindGroup: GPUBindGroup,
  cpuVisibleBindGroup: GPUBindGroup,
  cpuVisibleCount: number
): void {
  pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
  pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, meshBuffers.vertexBuffer);
  pass.setIndexBuffer(meshBuffers.indexBuffer, "uint16");
  pass.setBindGroup(0, staticBindGroup);
  pass.drawIndexed(meshBuffers.indexCount, 5);

  if (cpuVisibleCount > 0) {
    pass.setBindGroup(0, cpuVisibleBindGroup);
    pass.drawIndexed(meshBuffers.indexCount, cpuVisibleCount);
  }
}

function drawIndirectPanel(
  pass: GPURenderPassEncoder,
  rect: PanelRect,
  pipeline: GPURenderPipeline,
  meshBuffers: ReturnType<typeof createGpuDrivenMeshBuffers>,
  staticBindGroup: GPUBindGroup,
  compactedBindGroup: GPUBindGroup,
  indirectArgsBuffer: GPUBuffer
): void {
  pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
  pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, meshBuffers.vertexBuffer);
  pass.setIndexBuffer(meshBuffers.indexBuffer, "uint16");
  pass.setBindGroup(0, staticBindGroup);
  pass.drawIndexed(meshBuffers.indexCount, 5);
  pass.setBindGroup(0, compactedBindGroup);
  pass.drawIndexedIndirect(indirectArgsBuffer, 0);
}

export async function mountHiZAndOcclusionCullingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--gpu-driven-hiz";
  host.innerHTML = `
    <div class="gpu-driven-stage gpu-driven-stage--hiz">
      <div class="gpu-driven-badges">
        <span class="gpu-driven-badge">${formatCount(INSTANCE_COUNT)} 个动态实例</span>
        <span class="gpu-driven-badge gpu-driven-badge--warm">左侧 frustum-only</span>
        <span class="gpu-driven-badge gpu-driven-badge--cool">右侧 depth pyramid + occlusion</span>
      </div>
      <div class="gpu-driven-controls">
        <label class="gpu-driven-control">
          <span>FOV</span>
          <strong data-role="fov-value">0°</strong>
          <input data-role="fov-range" type="range" min="38" max="86" step="1" value="${Math.round((INITIAL_FOV * 180) / Math.PI)}" />
        </label>
        <label class="gpu-driven-control">
          <span>Far Plane</span>
          <strong data-role="far-value">0m</strong>
          <input data-role="far-range" type="range" min="18" max="64" step="1" value="${INITIAL_FAR}" />
        </label>
        <article class="gpu-driven-control gpu-driven-control--metric">
          <span>Hi-Z Levels</span>
          <strong data-role="levels-value">${MAX_HIZ_LEVELS} levels</strong>
          <small>右栏会先为遮挡墙构建 depth pyramid</small>
        </article>
      </div>
      <div class="gpu-driven-labels">
        <article class="gpu-driven-label">
          <p class="eyebrow">左侧</p>
          <strong>Frustum Only</strong>
          <span>只看包围球是否进入视锥，不判断它是不是已经被墙挡住</span>
        </article>
        <article class="gpu-driven-label gpu-driven-label--cool">
          <p class="eyebrow">右侧</p>
          <strong>Frustum + Occlusion</strong>
          <span>先渲染 occluder 深度，再用 depth pyramid 做 conservative occlusion test</span>
        </article>
      </div>
      <div class="gpu-driven-frame">
        <canvas class="gpu-driven-canvas"></canvas>
      </div>
      <div class="gpu-driven-card-grid">
        <article class="gpu-driven-card">
          <p class="eyebrow">Frustum Visible</p>
          <strong data-role="frustum-value">0</strong>
          <p>这是左栏纯 frustum culling 后依然落在视锥里的实例数量。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">Occluded</p>
          <strong data-role="occluded-value">等待首轮</strong>
          <p>右栏会把这些“虽然在视锥里，但已经被墙挡住”的实例剔掉。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">Submitted After Occlusion</p>
          <strong data-role="submitted-value">等待首轮</strong>
          <p>右栏最后真正写进 indirect draw 的实例数量。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">观察</p>
          <strong data-role="observation-value">等待首帧</strong>
          <p>遮挡测试一旦成立，右栏不是“把像素抹掉”，而是直接不再把这些实例送进 draw 输入。</p>
        </article>
      </div>
      <article class="gpu-driven-legend">
        <strong>当前实验</strong>
        <p data-role="legend-value">右栏会先把几堵大墙渲成 depth pyramid，再做 conservative occlusion culling；绕到侧面以后，那些实例会重新进入 draw 输入。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const fovRange = host.querySelector<HTMLInputElement>('[data-role="fov-range"]');
  const farRange = host.querySelector<HTMLInputElement>('[data-role="far-range"]');
  const fovValue = host.querySelector<HTMLElement>('[data-role="fov-value"]');
  const farValue = host.querySelector<HTMLElement>('[data-role="far-value"]');
  const frustumValue = host.querySelector<HTMLElement>('[data-role="frustum-value"]');
  const occludedValue = host.querySelector<HTMLElement>('[data-role="occluded-value"]');
  const submittedValue = host.querySelector<HTMLElement>('[data-role="submitted-value"]');
  const levelsValue = host.querySelector<HTMLElement>('[data-role="levels-value"]');
  const observationValue = host.querySelector<HTMLElement>('[data-role="observation-value"]');
  const legendValue = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !fovRange ||
    !farRange ||
    !fovValue ||
    !farValue ||
    !frustumValue ||
    !occludedValue ||
    !submittedValue ||
    !levelsValue ||
    !observationValue ||
    !legendValue
  ) {
    throw new Error("第 63 课的 DOM 初始化失败。");
  }

  const refs: HiZOcclusionHudRefs = {
    fovRange,
    fovValue,
    farRange,
    farValue,
    frustumValue,
    occludedValue,
    submittedValue,
    levelsValue,
    observationValue,
    legendValue,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const sceneGeometry = createGpuDrivenSceneGeometry();
  const sceneMeshBuffers = createGpuDrivenMeshBuffers(gpu.device, sceneGeometry.lod0);
  const scenePipeline = createScenePipeline(gpu.device, gpu.format);
  const occluderDepthPipeline = createOccluderDepthPipeline(gpu.device);
  const depthCopyPipeline = createFullscreenPipeline(
    gpu.device,
    depthCopyShaderSource,
    "lesson-63-depth-copy-pipeline"
  );
  const depthDownsamplePipeline = createFullscreenPipeline(
    gpu.device,
    depthDownsampleShaderSource,
    "lesson-63-depth-downsample-pipeline"
  );
  const scene = createGpuDrivenStreetScene(INSTANCE_COUNT);
  const maxInstanceCount = Math.max(
    scene.dynamicInstances.length,
    scene.staticInstances.length
  );
  const scanOffsets = createScanOffsets(scene.dynamicInstances.length);
  const scanPassCount = scanOffsets.length;
  const finalScanLivesInA = scanPassCount % 2 === 0;
  const placeholderFlags = createAllVisibleFlags(maxInstanceCount);
  const placeholderFlagsBuffer = gpu.device.createBuffer({
    size: placeholderFlags.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(placeholderFlagsBuffer.getMappedRange()).set(placeholderFlags);
  placeholderFlagsBuffer.unmap();

  const staticInstanceBuffer = gpu.device.createBuffer({
    size: createGpuDrivenInstanceData(scene.staticInstances).byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(staticInstanceBuffer.getMappedRange()).set(
    createGpuDrivenInstanceData(scene.staticInstances)
  );
  staticInstanceBuffer.unmap();

  const occluderInstanceBuffer = gpu.device.createBuffer({
    size: createGpuDrivenInstanceData(scene.occluderInstances).byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(occluderInstanceBuffer.getMappedRange()).set(
    createGpuDrivenInstanceData(scene.occluderInstances)
  );
  occluderInstanceBuffer.unmap();

  const allDynamicData = createGpuDrivenInstanceData(scene.dynamicInstances);
  const allDynamicInstanceBuffer = gpu.device.createBuffer({
    size: allDynamicData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(allDynamicInstanceBuffer.getMappedRange()).set(allDynamicData);
  allDynamicInstanceBuffer.unmap();

  const cpuVisibleInstanceBuffer = gpu.device.createBuffer({
    size: allDynamicData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const visibilityFlagsBuffer = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const countersBuffer = gpu.device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const scanBufferA = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const scanBufferB = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const compactedInstanceBuffer = gpu.device.createBuffer({
    size: allDynamicData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const indirectArgsBuffer = gpu.device.createBuffer({
    size: 20,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.INDIRECT |
      GPUBufferUsage.COPY_SRC |
      GPUBufferUsage.COPY_DST,
  });
  const readbackBuffer = gpu.device.createBuffer({
    size: 28,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const frameUniformBuffer = gpu.device.createBuffer({
    size: 96,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const staticDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const cpuDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const compactedDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const occlusionUniformBuffer = gpu.device.createBuffer({
    size: 240,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const seedUniformBuffer = gpu.device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const compactUniformBuffer = gpu.device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const scanStepUniformBuffers = scanOffsets.map(() =>
    gpu.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  );
  const zeroCounters = new Uint32Array([0, 0]);

  gpu.device.queue.writeBuffer(
    staticDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 0)
  );
  gpu.device.queue.writeBuffer(
    cpuDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 0)
  );
  gpu.device.queue.writeBuffer(
    compactedDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 0)
  );
  gpu.device.queue.writeBuffer(
    seedUniformBuffer,
    0,
    createScanUniformData(scene.dynamicInstances.length, 0, sceneMeshBuffers.indexCount)
  );
  gpu.device.queue.writeBuffer(
    compactUniformBuffer,
    0,
    createScanUniformData(scene.dynamicInstances.length, 0, sceneMeshBuffers.indexCount)
  );
  scanOffsets.forEach((offset, index) => {
    gpu.device.queue.writeBuffer(
      scanStepUniformBuffers[index],
      0,
      createScanUniformData(
        scene.dynamicInstances.length,
        offset,
        sceneMeshBuffers.indexCount
      )
    );
  });

  const sceneBindGroupLayout = scenePipeline.getBindGroupLayout(0);
  const staticBindGroup = gpu.device.createBindGroup({
    layout: sceneBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: staticInstanceBuffer } },
      { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
      { binding: 3, resource: { buffer: staticDrawUniformBuffer } },
    ],
  });
  const cpuVisibleBindGroup = gpu.device.createBindGroup({
    layout: sceneBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: cpuVisibleInstanceBuffer } },
      { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
      { binding: 3, resource: { buffer: cpuDrawUniformBuffer } },
    ],
  });
  const compactedBindGroup = gpu.device.createBindGroup({
    layout: sceneBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: compactedInstanceBuffer } },
      { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
      { binding: 3, resource: { buffer: compactedDrawUniformBuffer } },
    ],
  });

  const occluderBindGroup = gpu.device.createBindGroup({
    layout: occluderDepthPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: occluderInstanceBuffer } },
      { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
      { binding: 3, resource: { buffer: staticDrawUniformBuffer } },
    ],
  });

  const computeModule = gpu.device.createShaderModule({ code: computeShaderSource });
  const occlusionPipeline = gpu.device.createComputePipeline({
    label: "lesson-63-occlusion-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csOcclusionFlags" },
  });
  const seedPipeline = gpu.device.createComputePipeline({
    label: "lesson-63-seed-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csSeedScan" },
  });
  const scanPipeline = gpu.device.createComputePipeline({
    label: "lesson-63-scan-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csPrefixSumStep" },
  });
  const compactPipeline = gpu.device.createComputePipeline({
    label: "lesson-63-compact-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csCompact" },
  });
  const indirectPipeline = gpu.device.createComputePipeline({
    label: "lesson-63-indirect-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csWriteIndirect" },
  });

  const seedBindGroup = gpu.device.createBindGroup({
    layout: seedPipeline.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: seedUniformBuffer } },
      { binding: 1, resource: { buffer: visibilityFlagsBuffer } },
      { binding: 3, resource: { buffer: scanBufferA } },
    ],
  });
  const scanBindGroupsAToB = scanStepUniformBuffers.map((buffer) =>
    gpu.device.createBindGroup({
      layout: scanPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer } },
        { binding: 2, resource: { buffer: scanBufferA } },
        { binding: 3, resource: { buffer: scanBufferB } },
      ],
    })
  );
  const scanBindGroupsBToA = scanStepUniformBuffers.map((buffer) =>
    gpu.device.createBindGroup({
      layout: scanPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer } },
        { binding: 2, resource: { buffer: scanBufferB } },
        { binding: 3, resource: { buffer: scanBufferA } },
      ],
    })
  );
  const compactBindGroup = gpu.device.createBindGroup({
    layout: compactPipeline.getBindGroupLayout(2),
    entries: [
      { binding: 0, resource: { buffer: compactUniformBuffer } },
      { binding: 1, resource: { buffer: visibilityFlagsBuffer } },
      {
        binding: 2,
        resource: { buffer: finalScanLivesInA ? scanBufferA : scanBufferB },
      },
      { binding: 3, resource: { buffer: allDynamicInstanceBuffer } },
      { binding: 4, resource: { buffer: compactedInstanceBuffer } },
    ],
  });
  const indirectBindGroup = gpu.device.createBindGroup({
    layout: indirectPipeline.getBindGroupLayout(2),
    entries: [
      { binding: 0, resource: { buffer: compactUniformBuffer } },
      { binding: 1, resource: { buffer: visibilityFlagsBuffer } },
      {
        binding: 2,
        resource: { buffer: finalScanLivesInA ? scanBufferA : scanBufferB },
      },
      { binding: 5, resource: { buffer: indirectArgsBuffer } },
    ],
  });

  const depthTarget: DepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };
  const hizResources: HiZResources = {
    depthTexture: null,
    depthView: null,
    levels: [],
    width: 0,
    height: 0,
  };
  const settings: HiZOcclusionSettings = {
    fov: INITIAL_FOV,
    farPlane: INITIAL_FAR,
  };

  const camera = createOrbitCameraController(canvas, {
    eye: [18, 15, 18],
    target: [0, 1.8, 0],
    minRadius: 12,
    maxRadius: 42,
  });

  let frameHandle = 0;
  let pendingReadback = false;
  let disposed = false;
  let lastSubmittedCount: number | null = null;

  const scheduleReadback = () => {
    if (pendingReadback) {
      return;
    }

    pendingReadback = true;
    readbackBuffer
      .mapAsync(GPUMapMode.READ)
      .then(() => {
        if (disposed) {
          if (readbackBuffer.mapState === "mapped") {
            readbackBuffer.unmap();
          }
          return;
        }
        const mapped = new Uint32Array(readbackBuffer.getMappedRange());
        lastSubmittedCount = mapped[1] ?? 0;
        readbackBuffer.unmap();
      })
      .catch((error) => {
        if (!disposed) {
          console.error(error);
        }
      })
      .finally(() => {
        pendingReadback = false;
        if (disposed) {
          readbackBuffer.destroy();
        }
      });
  };

  const renderFrame = () => {
    gpu.resize();
    ensureDepthTarget(gpu.device, depthTarget, canvas.width, canvas.height);
    if (!depthTarget.view) {
      frameHandle = requestAnimationFrame(renderFrame);
      return;
    }

    const [leftRect, rightRect] = createPanelRects(canvas.width, canvas.height);
    const levelCount = ensureHiZResources(
      gpu.device,
      hizResources,
      Math.max(1, rightRect.width),
      Math.max(1, rightRect.height)
    );

    if (!hizResources.depthView) {
      frameHandle = requestAnimationFrame(renderFrame);
      return;
    }

    const aspect = leftRect.width / Math.max(leftRect.height, 1);
    const cameraSnapshot = camera.getSnapshot();
    const viewMatrix = createLookAtViewMatrix(
      cameraSnapshot.eye,
      cameraSnapshot.target,
      cameraSnapshot.up
    );
    const projectionMatrix = createPerspectiveMatrix(
      settings.fov,
      aspect,
      CAMERA_NEAR,
      settings.farPlane
    );
    const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
    const frustumPlanes = extractFrustumPlanes(viewProjectionMatrix);
    const cpuFlags = new Uint32Array(scene.dynamicInstances.length);

    scene.dynamicInstances.forEach((instance, index) => {
      cpuFlags[index] = sphereIntersectsFrustum(
        frustumPlanes,
        instance.translation,
        instance.radius
      )
        ? 1
        : 0;
    });

    const cpuVisibleInstances = buildVisibleInstances(scene.dynamicInstances, cpuFlags);
    const cpuVisibleData = createGpuDrivenInstanceData(cpuVisibleInstances);
    if (cpuVisibleData.byteLength > 0) {
      gpu.device.queue.writeBuffer(cpuVisibleInstanceBuffer, 0, cpuVisibleData);
    }

    gpu.device.queue.writeBuffer(
      frameUniformBuffer,
      0,
      createFrameUniformData(viewProjectionMatrix, LIGHT_DIRECTION, cameraSnapshot.eye)
    );
    gpu.device.queue.writeBuffer(
      occlusionUniformBuffer,
      0,
      createOcclusionUniformData(
        frustumPlanes,
        viewMatrix,
        projectionMatrix,
        scene.dynamicInstances.length,
        levelCount
      )
    );
    gpu.device.queue.writeBuffer(countersBuffer, 0, zeroCounters);

    updateHud(
      refs,
      settings,
      countVisibleFlags(cpuFlags),
      lastSubmittedCount,
      levelCount
    );

    const copyBindGroup = gpu.device.createBindGroup({
      layout: depthCopyPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: hizResources.depthView }],
    });
    const downsampleBindGroups = hizResources.levels
      .slice(0, -1)
      .map((level) =>
        gpu.device.createBindGroup({
          layout: depthDownsamplePipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: level.view }],
        })
      );
    const occlusionBindGroup = gpu.device.createBindGroup({
      layout: occlusionPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: occlusionUniformBuffer } },
        { binding: 1, resource: { buffer: allDynamicInstanceBuffer } },
        { binding: 2, resource: { buffer: visibilityFlagsBuffer } },
        { binding: 3, resource: { buffer: countersBuffer } },
        { binding: 4, resource: hizResources.levels[0].view },
        { binding: 5, resource: hizResources.levels[1].view },
        { binding: 6, resource: hizResources.levels[2].view },
        { binding: 7, resource: hizResources.levels[3].view },
        { binding: 8, resource: hizResources.levels[4].view },
        { binding: 9, resource: hizResources.levels[5].view },
      ],
    });

    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-63-command-encoder",
    });

    const occluderPass = encoder.beginRenderPass({
      label: "lesson-63-occluder-depth-pass",
      colorAttachments: [],
      depthStencilAttachment: {
        view: hizResources.depthView,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    occluderPass.setViewport(0, 0, rightRect.width, rightRect.height, 0, 1);
    occluderPass.setScissorRect(0, 0, rightRect.width, rightRect.height);
    occluderPass.setPipeline(occluderDepthPipeline);
    occluderPass.setVertexBuffer(0, sceneMeshBuffers.vertexBuffer);
    occluderPass.setIndexBuffer(sceneMeshBuffers.indexBuffer, "uint16");
    occluderPass.setBindGroup(0, occluderBindGroup);
    occluderPass.drawIndexed(sceneMeshBuffers.indexCount, scene.occluderInstances.length);
    occluderPass.end();

    const copyPass = encoder.beginRenderPass({
      label: "lesson-63-depth-copy-pass",
      colorAttachments: [
        {
          view: hizResources.levels[0].view,
          clearValue: { r: 1, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    copyPass.setPipeline(depthCopyPipeline);
    copyPass.setBindGroup(0, copyBindGroup);
    copyPass.draw(3);
    copyPass.end();

    hizResources.levels.slice(1).forEach((level, index) => {
      const downsamplePass = encoder.beginRenderPass({
        label: `lesson-63-depth-downsample-${index + 1}`,
        colorAttachments: [
          {
            view: level.view,
            clearValue: { r: 1, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      downsamplePass.setPipeline(depthDownsamplePipeline);
      downsamplePass.setBindGroup(0, downsampleBindGroups[index]);
      downsamplePass.draw(3);
      downsamplePass.end();
    });

    const occlusionPass = encoder.beginComputePass({
      label: "lesson-63-occlusion-compute-pass",
    });
    occlusionPass.setPipeline(occlusionPipeline);
    occlusionPass.setBindGroup(0, occlusionBindGroup);
    occlusionPass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
    occlusionPass.end();

    const seedPass = encoder.beginComputePass({
      label: "lesson-63-seed-pass",
    });
    seedPass.setPipeline(seedPipeline);
    seedPass.setBindGroup(1, seedBindGroup);
    seedPass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
    seedPass.end();

    scanOffsets.forEach((_, index) => {
      const scanPass = encoder.beginComputePass({
        label: `lesson-63-scan-step-${index}`,
      });
      scanPass.setPipeline(scanPipeline);
      scanPass.setBindGroup(
        1,
        index % 2 === 0 ? scanBindGroupsAToB[index] : scanBindGroupsBToA[index]
      );
      scanPass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
      scanPass.end();
    });

    const compactPass = encoder.beginComputePass({
      label: "lesson-63-compact-pass",
    });
    compactPass.setPipeline(compactPipeline);
    compactPass.setBindGroup(2, compactBindGroup);
    compactPass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
    compactPass.end();

    const indirectPass = encoder.beginComputePass({
      label: "lesson-63-indirect-pass",
    });
    indirectPass.setPipeline(indirectPipeline);
    indirectPass.setBindGroup(2, indirectBindGroup);
    indirectPass.dispatchWorkgroups(1);
    indirectPass.end();

    if (!pendingReadback) {
      encoder.copyBufferToBuffer(countersBuffer, 0, readbackBuffer, 0, 8);
      encoder.copyBufferToBuffer(indirectArgsBuffer, 0, readbackBuffer, 8, 20);
    }

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpu.context.getCurrentTexture().createView(),
          clearValue: { r: 0.03, g: 0.04, b: 0.06, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthTarget.view,
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    drawCpuPanel(
      renderPass,
      leftRect,
      scenePipeline,
      sceneMeshBuffers,
      staticBindGroup,
      cpuVisibleBindGroup,
      cpuVisibleInstances.length
    );
    drawIndirectPanel(
      renderPass,
      rightRect,
      scenePipeline,
      sceneMeshBuffers,
      staticBindGroup,
      compactedBindGroup,
      indirectArgsBuffer
    );

    renderPass.end();
    gpu.device.queue.submit([encoder.finish()]);

    if (!pendingReadback) {
      scheduleReadback();
    }

    frameHandle = requestAnimationFrame(renderFrame);
  };

  fovRange.addEventListener("input", () => {
    settings.fov = (Number(fovRange.value) * Math.PI) / 180;
  });
  farRange.addEventListener("input", () => {
    settings.farPlane = Number(farRange.value);
  });

  updateHud(refs, settings, scene.dynamicInstances.length, null, MAX_HIZ_LEVELS);
  setStatus({
    title: "Hi-Z 与 Occlusion Culling 已运行",
    detail:
      "左栏仍然只做 frustum culling；右栏会先把几堵大墙渲进 depth pyramid，再把真正被挡住的实例从 indirect draw 输入里剔掉。",
    tone: "ok",
  });
  frameHandle = requestAnimationFrame(renderFrame);

  return () => {
    disposed = true;
    cancelAnimationFrame(frameHandle);
    camera.dispose();
    destroyDepthTarget(depthTarget);
    destroyHiZResources(hizResources);
    sceneMeshBuffers.vertexBuffer.destroy();
    sceneMeshBuffers.indexBuffer.destroy();
    staticInstanceBuffer.destroy();
    occluderInstanceBuffer.destroy();
    allDynamicInstanceBuffer.destroy();
    cpuVisibleInstanceBuffer.destroy();
    visibilityFlagsBuffer.destroy();
    countersBuffer.destroy();
    scanBufferA.destroy();
    scanBufferB.destroy();
    compactedInstanceBuffer.destroy();
    indirectArgsBuffer.destroy();
    if (!pendingReadback) {
      readbackBuffer.destroy();
    }
    placeholderFlagsBuffer.destroy();
    frameUniformBuffer.destroy();
    staticDrawUniformBuffer.destroy();
    cpuDrawUniformBuffer.destroy();
    compactedDrawUniformBuffer.destroy();
    occlusionUniformBuffer.destroy();
    seedUniformBuffer.destroy();
    compactUniformBuffer.destroy();
    scanStepUniformBuffers.forEach((buffer) => buffer.destroy());
  };
}
