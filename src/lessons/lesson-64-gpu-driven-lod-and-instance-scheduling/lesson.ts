import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createGpuDrivenSceneGeometry } from "@/lessons/gpu-driven-common/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  extractFrustumPlanes,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/gpu-driven-common/math";
import {
  createGpuDrivenStreetScene,
  createAllVisibleFlags,
  createGpuDrivenInstanceData,
} from "@/lessons/gpu-driven-common/scene";
import {
  createDrawUniformData,
  createFrameUniformData,
  createGpuDrivenMeshBuffers,
  destroyDepthTarget,
  ensureDepthTarget,
  type DepthTarget,
  type GpuDrivenMeshBuffers,
} from "@/lessons/gpu-driven-common/render";
import computeShaderSource from "@/lessons/lesson-64-gpu-driven-lod-and-instance-scheduling/compute.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/gpu-driven-common/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/gpu-driven-common/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type GpuDrivenLodSettings = {
  fov: number;
  lodDistanceScale: number;
  freezeCamera: boolean;
  showLodTint: boolean;
};

type CameraSnapshot = ReturnType<
  ReturnType<typeof createOrbitCameraController>["getSnapshot"]
>;

type GpuDrivenLodHudRefs = {
  fovRange: HTMLInputElement;
  fovValue: HTMLElement;
  distanceRange: HTMLInputElement;
  distanceValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  tintButton: HTMLButtonElement;
  lod0Value: HTMLElement;
  lod1Value: HTMLElement;
  lod2Value: HTMLElement;
  totalValue: HTMLElement;
  observationValue: HTMLElement;
  legendValue: HTMLElement;
};

type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LodBuffers = {
  flagsBuffer: GPUBuffer;
  scanBufferA: GPUBuffer;
  scanBufferB: GPUBuffer;
  compactedBuffer: GPUBuffer;
  indirectArgsBuffer: GPUBuffer;
  compactUniformBuffer: GPUBuffer;
  seedBindGroup: GPUBindGroup;
  scanBindGroupsAToB: GPUBindGroup[];
  scanBindGroupsBToA: GPUBindGroup[];
  compactBindGroup: GPUBindGroup;
  indirectBindGroup: GPUBindGroup;
  drawUniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  meshBuffers: GpuDrivenMeshBuffers;
};

const INSTANCE_COUNT = 1024;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 46;
const LIGHT_DIRECTION: Vector3 = [-0.42, -0.92, -0.18];
const INITIAL_FOV = Math.PI / 3.15;
const INITIAL_DISTANCE_SCALE = 1;
const WORKGROUP_SIZE = 64;

function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDegrees(value: number): string {
  return `${Math.round((value * 180) / Math.PI)}°`;
}

function formatScale(value: number): string {
  return `${value.toFixed(2)}x`;
}

function createPanelRects(width: number, height: number): [PanelRect, PanelRect] {
  const gap = Math.max(12, Math.floor(width * 0.014));
  const panelWidth = Math.max(1, Math.floor((width - gap) * 0.5));

  return [
    { x: 0, y: 0, width: panelWidth, height },
    { x: panelWidth + gap, y: 0, width: panelWidth, height },
  ];
}

function createLodUniformData(
  frustumPlanes: Float32Array,
  eyePosition: Vector3,
  instanceCount: number,
  lodDistanceScale: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(128);
  const floats = new Float32Array(buffer);
  floats.set(frustumPlanes, 0);
  floats.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 24);
  floats.set([instanceCount, lodDistanceScale, 0, 0], 28);
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
  refs: GpuDrivenLodHudRefs,
  settings: GpuDrivenLodSettings,
  lodCounts: [number | null, number | null, number | null]
): void {
  const [lod0Count, lod1Count, lod2Count] = lodCounts;
  const totalSubmitted =
    lod0Count === null || lod1Count === null || lod2Count === null
      ? null
      : (lod0Count ?? 0) + (lod1Count ?? 0) + (lod2Count ?? 0);
  const safeLod0Count = lod0Count ?? 0;
  const safeLod2Count = lod2Count ?? 0;

  refs.fovValue.textContent = formatDegrees(settings.fov);
  refs.distanceValue.textContent = formatScale(settings.lodDistanceScale);
  refs.freezeButton.classList.toggle(
    "gpu-driven-toggle--active",
    settings.freezeCamera
  );
  refs.tintButton.classList.toggle(
    "gpu-driven-toggle--active",
    settings.showLodTint
  );
  refs.lod0Value.textContent =
    lod0Count === null ? "等待首轮" : formatCount(lod0Count);
  refs.lod1Value.textContent =
    lod1Count === null ? "等待首轮" : formatCount(lod1Count);
  refs.lod2Value.textContent =
    lod2Count === null ? "等待首轮" : formatCount(lod2Count);
  refs.totalValue.textContent =
    totalSubmitted === null ? "等待首轮" : formatCount(totalSubmitted);
  refs.observationValue.textContent =
    totalSubmitted === null
      ? "右栏已经在按距离写 LOD flags，但 GPU 读回还在等待第一轮完成。"
      : safeLod2Count > safeLod0Count
        ? "当前视角已经偏远，右栏的大多数实例都落到了更便宜的 LOD2 / LOD1；左栏则依然全都固定成 LOD0。"
        : "当前视角更靠近街区核心，右栏仍然会保留更多 LOD0，但距离拉远以后它会自动切向更轻的几何。";
  refs.legendValue.textContent =
    "这一课会把 visibility + compaction 继续推进到 LOD 调度：右栏先按距离给实例分档，再分别 compact 成 3 组 indirect draw 输入。";
}

function createScenePipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-64-scene-pipeline",
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

function drawLeftPanel(
  pass: GPURenderPassEncoder,
  rect: PanelRect,
  pipeline: GPURenderPipeline,
  meshBuffers: GpuDrivenMeshBuffers,
  staticBindGroup: GPUBindGroup,
  visibleBindGroup: GPUBindGroup,
  totalDynamicCount: number
): void {
  pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
  pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, meshBuffers.vertexBuffer);
  pass.setIndexBuffer(meshBuffers.indexBuffer, "uint16");
  pass.setBindGroup(0, staticBindGroup);
  pass.drawIndexed(meshBuffers.indexCount, 5);
  pass.setBindGroup(0, visibleBindGroup);
  pass.drawIndexed(meshBuffers.indexCount, totalDynamicCount);
}

function drawRightPanel(
  pass: GPURenderPassEncoder,
  rect: PanelRect,
  pipeline: GPURenderPipeline,
  staticBindGroup: GPUBindGroup,
  lodBuffers: LodBuffers[]
): void {
  pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
  pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
  pass.setPipeline(pipeline);
  pass.setBindGroup(0, staticBindGroup);
  pass.setVertexBuffer(0, lodBuffers[0].meshBuffers.vertexBuffer);
  pass.setIndexBuffer(lodBuffers[0].meshBuffers.indexBuffer, "uint16");
  pass.drawIndexed(lodBuffers[0].meshBuffers.indexCount, 5);

  lodBuffers.forEach((lodBuffer) => {
    pass.setVertexBuffer(0, lodBuffer.meshBuffers.vertexBuffer);
    pass.setIndexBuffer(lodBuffer.meshBuffers.indexBuffer, "uint16");
    pass.setBindGroup(0, lodBuffer.bindGroup);
    pass.drawIndexedIndirect(lodBuffer.indirectArgsBuffer, 0);
  });
}

function writeLodUniforms(
  device: GPUDevice,
  settings: GpuDrivenLodSettings,
  lodBuffers: LodBuffers[]
): void {
  const tintMix = settings.showLodTint ? 0.34 : 0;
  const tintPalette: [number, number, number, number][] = [
    [0.50, 0.74, 1.0, 1],
    [0.66, 0.92, 0.58, 1],
    [1.0, 0.70, 0.42, 1],
  ];

  lodBuffers.forEach((lodBuffer, index) => {
    device.queue.writeBuffer(
      lodBuffer.drawUniformBuffer,
      0,
      createDrawUniformData(tintPalette[index], tintMix, 1, 0)
    );
  });
}

export async function mountGpuDrivenLodAndInstanceSchedulingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--gpu-driven-lod";
  host.innerHTML = `
    <div class="gpu-driven-stage gpu-driven-stage--lod">
      <div class="gpu-driven-badges">
        <span class="gpu-driven-badge">${formatCount(INSTANCE_COUNT)} 个动态实例</span>
        <span class="gpu-driven-badge gpu-driven-badge--warm">左侧固定 LOD0</span>
        <span class="gpu-driven-badge gpu-driven-badge--cool">右侧 GPU-driven LOD</span>
      </div>
      <div class="gpu-driven-controls">
        <label class="gpu-driven-control">
          <span>FOV</span>
          <strong data-role="fov-value">0°</strong>
          <input data-role="fov-range" type="range" min="38" max="86" step="1" value="${Math.round((INITIAL_FOV * 180) / Math.PI)}" />
        </label>
        <label class="gpu-driven-control">
          <span>LOD Distance</span>
          <strong data-role="distance-value">1.00x</strong>
          <input data-role="distance-range" type="range" min="0.55" max="1.85" step="0.01" value="${INITIAL_DISTANCE_SCALE}" />
        </label>
        <div class="gpu-driven-control gpu-driven-control--toggle">
          <span>调试</span>
          <div class="gpu-driven-toggle-row">
            <button class="gpu-driven-toggle" data-role="freeze-button" type="button">冻结相机</button>
            <button class="gpu-driven-toggle" data-role="tint-button" type="button">显示 LOD tint</button>
          </div>
        </div>
      </div>
      <div class="gpu-driven-labels">
        <article class="gpu-driven-label">
          <p class="eyebrow">左侧</p>
          <strong>固定高细节</strong>
          <span>实例虽然也会做可见性判断，但始终统一用 LOD0 mesh 提交</span>
        </article>
        <article class="gpu-driven-label gpu-driven-label--cool">
          <p class="eyebrow">右侧</p>
          <strong>GPU-driven Scheduling</strong>
          <span>先分档，再 compact 成 3 组 visible list，最后分别 indirect draw</span>
        </article>
      </div>
      <div class="gpu-driven-frame">
        <canvas class="gpu-driven-canvas"></canvas>
      </div>
      <div class="gpu-driven-card-grid">
        <article class="gpu-driven-card">
          <p class="eyebrow">LOD0</p>
          <strong data-role="lod0-value">等待首轮</strong>
          <p>离相机最近、保留完整盒体簇的实例数量。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">LOD1</p>
          <strong data-role="lod1-value">等待首轮</strong>
          <p>中距离实例会被压到更简化的三段式几何。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">LOD2</p>
          <strong data-role="lod2-value">等待首轮</strong>
          <p>最远实例只保留单柱体，真正把 draw 负担降下来。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">Total Submitted</p>
          <strong data-role="total-value">等待首轮</strong>
          <p>右栏 3 组 indirect draw 合起来，构成完整的 GPU-driven visibility + scheduling 链。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">观察</p>
          <strong data-role="observation-value">等待首帧</strong>
          <p>冻结相机后再拖动距离比例，会更容易看出 LOD 档位是怎样重新分布的。</p>
        </article>
      </div>
      <article class="gpu-driven-legend">
        <strong>当前实验</strong>
        <p data-role="legend-value">右栏会在 frustum culling 之后继续做 LOD 分档、stream compaction 和 multi-indirect draw；这已经是一条完整的 GPU-driven visibility + scheduling 链。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const fovRange = host.querySelector<HTMLInputElement>('[data-role="fov-range"]');
  const distanceRange = host.querySelector<HTMLInputElement>('[data-role="distance-range"]');
  const fovValue = host.querySelector<HTMLElement>('[data-role="fov-value"]');
  const distanceValue = host.querySelector<HTMLElement>('[data-role="distance-value"]');
  const freezeButton = host.querySelector<HTMLButtonElement>('[data-role="freeze-button"]');
  const tintButton = host.querySelector<HTMLButtonElement>('[data-role="tint-button"]');
  const lod0Value = host.querySelector<HTMLElement>('[data-role="lod0-value"]');
  const lod1Value = host.querySelector<HTMLElement>('[data-role="lod1-value"]');
  const lod2Value = host.querySelector<HTMLElement>('[data-role="lod2-value"]');
  const totalValue = host.querySelector<HTMLElement>('[data-role="total-value"]');
  const observationValue = host.querySelector<HTMLElement>('[data-role="observation-value"]');
  const legendValue = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !fovRange ||
    !distanceRange ||
    !fovValue ||
    !distanceValue ||
    !freezeButton ||
    !tintButton ||
    !lod0Value ||
    !lod1Value ||
    !lod2Value ||
    !totalValue ||
    !observationValue ||
    !legendValue
  ) {
    throw new Error("第 64 课的 DOM 初始化失败。");
  }

  const refs: GpuDrivenLodHudRefs = {
    fovRange,
    fovValue,
    distanceRange,
    distanceValue,
    freezeButton,
    tintButton,
    lod0Value,
    lod1Value,
    lod2Value,
    totalValue,
    observationValue,
    legendValue,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const sceneGeometry = createGpuDrivenSceneGeometry();
  const lod0MeshBuffers = createGpuDrivenMeshBuffers(gpu.device, sceneGeometry.lod0);
  const lod1MeshBuffers = createGpuDrivenMeshBuffers(gpu.device, sceneGeometry.lod1);
  const lod2MeshBuffers = createGpuDrivenMeshBuffers(gpu.device, sceneGeometry.lod2);
  const scenePipeline = createScenePipeline(gpu.device, gpu.format);
  const scene = createGpuDrivenStreetScene(INSTANCE_COUNT);
  const maxInstanceCount = Math.max(
    scene.dynamicInstances.length,
    scene.staticInstances.length
  );
  const scanOffsets = createScanOffsets(scene.dynamicInstances.length);
  const finalScanLivesInA = scanOffsets.length % 2 === 0;
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

  const allDynamicData = createGpuDrivenInstanceData(scene.dynamicInstances);
  const allDynamicInstanceBuffer = gpu.device.createBuffer({
    size: allDynamicData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(allDynamicInstanceBuffer.getMappedRange()).set(allDynamicData);
  allDynamicInstanceBuffer.unmap();

  const visibleFlagsBuffer = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const frameUniformBuffer = gpu.device.createBuffer({
    size: 96,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const staticDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const leftDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const lodUniformBuffer = gpu.device.createBuffer({
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const seedUniformBuffer = gpu.device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const scanStepUniformBuffers = scanOffsets.map(() =>
    gpu.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
  );

  gpu.device.queue.writeBuffer(
    staticDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 0)
  );
  gpu.device.queue.writeBuffer(
    leftDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 1)
  );
  gpu.device.queue.writeBuffer(
    seedUniformBuffer,
    0,
    createScanUniformData(scene.dynamicInstances.length, 0, 0)
  );
  scanOffsets.forEach((offset, index) => {
    gpu.device.queue.writeBuffer(
      scanStepUniformBuffers[index],
      0,
      createScanUniformData(scene.dynamicInstances.length, offset, 0)
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
  const leftVisibleBindGroup = gpu.device.createBindGroup({
    layout: sceneBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: allDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: visibleFlagsBuffer } },
      { binding: 3, resource: { buffer: leftDrawUniformBuffer } },
    ],
  });

  const computeModule = gpu.device.createShaderModule({ code: computeShaderSource });
  const classifyPipeline = gpu.device.createComputePipeline({
    label: "lesson-64-classify-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csClassifyVisibilityAndLod" },
  });
  const seedPipeline = gpu.device.createComputePipeline({
    label: "lesson-64-seed-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csSeedScan" },
  });
  const scanPipeline = gpu.device.createComputePipeline({
    label: "lesson-64-scan-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csPrefixSumStep" },
  });
  const compactPipeline = gpu.device.createComputePipeline({
    label: "lesson-64-compact-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csCompact" },
  });
  const indirectPipeline = gpu.device.createComputePipeline({
    label: "lesson-64-indirect-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csWriteIndirect" },
  });

  const createLodBuffers = (
    flagsBuffer: GPUBuffer,
    meshBuffers: GpuDrivenMeshBuffers,
    tintColor: [number, number, number, number]
  ): LodBuffers => {
    const scanBufferA = gpu.device.createBuffer({
      size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const scanBufferB = gpu.device.createBuffer({
      size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const compactedBuffer = gpu.device.createBuffer({
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
    const compactUniformBuffer = gpu.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(
      compactUniformBuffer,
      0,
      createScanUniformData(
        scene.dynamicInstances.length,
        0,
        meshBuffers.indexCount
      )
    );
    const drawUniformBuffer = gpu.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(
      drawUniformBuffer,
      0,
      createDrawUniformData(tintColor, 0, 1, 0)
    );

    const seedBindGroup = gpu.device.createBindGroup({
      layout: seedPipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: { buffer: seedUniformBuffer } },
        { binding: 1, resource: { buffer: flagsBuffer } },
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
        { binding: 1, resource: { buffer: flagsBuffer } },
        {
          binding: 2,
          resource: { buffer: finalScanLivesInA ? scanBufferA : scanBufferB },
        },
        { binding: 3, resource: { buffer: allDynamicInstanceBuffer } },
        { binding: 4, resource: { buffer: compactedBuffer } },
      ],
    });
    const indirectBindGroup = gpu.device.createBindGroup({
      layout: indirectPipeline.getBindGroupLayout(2),
      entries: [
        { binding: 0, resource: { buffer: compactUniformBuffer } },
        { binding: 1, resource: { buffer: flagsBuffer } },
        {
          binding: 2,
          resource: { buffer: finalScanLivesInA ? scanBufferA : scanBufferB },
        },
        { binding: 5, resource: { buffer: indirectArgsBuffer } },
      ],
    });
    const bindGroup = gpu.device.createBindGroup({
      layout: sceneBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: frameUniformBuffer } },
        { binding: 1, resource: { buffer: compactedBuffer } },
        { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
        { binding: 3, resource: { buffer: drawUniformBuffer } },
      ],
    });

    return {
      flagsBuffer,
      scanBufferA,
      scanBufferB,
      compactedBuffer,
      indirectArgsBuffer,
      compactUniformBuffer,
      seedBindGroup,
      scanBindGroupsAToB,
      scanBindGroupsBToA,
      compactBindGroup,
      indirectBindGroup,
      drawUniformBuffer,
      bindGroup,
      meshBuffers,
    };
  };

  const lod0FlagsBuffer = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const lod1FlagsBuffer = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const lod2FlagsBuffer = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const lodBuffers: LodBuffers[] = [
    createLodBuffers(lod0FlagsBuffer, lod0MeshBuffers, [0.50, 0.74, 1.0, 1]),
    createLodBuffers(lod1FlagsBuffer, lod1MeshBuffers, [0.66, 0.92, 0.58, 1]),
    createLodBuffers(lod2FlagsBuffer, lod2MeshBuffers, [1.0, 0.70, 0.42, 1]),
  ];

  const classifyBindGroup = gpu.device.createBindGroup({
    layout: classifyPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: lodUniformBuffer } },
      { binding: 1, resource: { buffer: allDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: visibleFlagsBuffer } },
      { binding: 3, resource: { buffer: lodBuffers[0].flagsBuffer } },
      { binding: 4, resource: { buffer: lodBuffers[1].flagsBuffer } },
      { binding: 5, resource: { buffer: lodBuffers[2].flagsBuffer } },
    ],
  });

  const readbackBuffer = gpu.device.createBuffer({
    size: 60,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const depthTarget: DepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };
  const settings: GpuDrivenLodSettings = {
    fov: INITIAL_FOV,
    lodDistanceScale: INITIAL_DISTANCE_SCALE,
    freezeCamera: false,
    showLodTint: false,
  };

  const camera = createOrbitCameraController(canvas, {
    eye: [18, 15, 18],
    target: [0, 1.8, 0],
    minRadius: 12,
    maxRadius: 42,
  });

  let frozenSnapshot: CameraSnapshot | null = null;
  let frameHandle = 0;
  let pendingReadback = false;
  let disposed = false;
  let lastLodCounts: [number | null, number | null, number | null] = [
    null,
    null,
    null,
  ];

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
        lastLodCounts = [mapped[1] ?? 0, mapped[6] ?? 0, mapped[11] ?? 0];
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

  const syncButtonsAndUniforms = () => {
    updateHud(refs, settings, lastLodCounts);
    writeLodUniforms(gpu.device, settings, lodBuffers);
  };

  const renderFrame = () => {
    gpu.resize();
    ensureDepthTarget(gpu.device, depthTarget, canvas.width, canvas.height);
    if (!depthTarget.view) {
      frameHandle = requestAnimationFrame(renderFrame);
      return;
    }

    const [leftRect, rightRect] = createPanelRects(canvas.width, canvas.height);
    const aspect = leftRect.width / Math.max(leftRect.height, 1);
    const activeSnapshot =
      settings.freezeCamera && frozenSnapshot ? frozenSnapshot : camera.getSnapshot();
    const viewMatrix = createLookAtViewMatrix(
      activeSnapshot.eye,
      activeSnapshot.target,
      activeSnapshot.up
    );
    const projectionMatrix = createPerspectiveMatrix(
      settings.fov,
      aspect,
      CAMERA_NEAR,
      CAMERA_FAR
    );
    const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
    const frustumPlanes = extractFrustumPlanes(viewProjectionMatrix);

    gpu.device.queue.writeBuffer(
      frameUniformBuffer,
      0,
      createFrameUniformData(viewProjectionMatrix, LIGHT_DIRECTION, activeSnapshot.eye)
    );
    gpu.device.queue.writeBuffer(
      lodUniformBuffer,
      0,
      createLodUniformData(
        frustumPlanes,
        activeSnapshot.eye,
        scene.dynamicInstances.length,
        settings.lodDistanceScale
      )
    );

    updateHud(refs, settings, lastLodCounts);

    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-64-command-encoder",
    });

    const classifyPass = encoder.beginComputePass({
      label: "lesson-64-classify-pass",
    });
    classifyPass.setPipeline(classifyPipeline);
    classifyPass.setBindGroup(0, classifyBindGroup);
    classifyPass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
    classifyPass.end();

    lodBuffers.forEach((lodBuffer, lodIndex) => {
      const seedPass = encoder.beginComputePass({
        label: `lesson-64-seed-pass-${lodIndex}`,
      });
      seedPass.setPipeline(seedPipeline);
      seedPass.setBindGroup(1, lodBuffer.seedBindGroup);
      seedPass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
      seedPass.end();

      scanOffsets.forEach((_, index) => {
        const scanPass = encoder.beginComputePass({
          label: `lesson-64-scan-${lodIndex}-${index}`,
        });
        scanPass.setPipeline(scanPipeline);
        scanPass.setBindGroup(
          1,
          index % 2 === 0
            ? lodBuffer.scanBindGroupsAToB[index]
            : lodBuffer.scanBindGroupsBToA[index]
        );
        scanPass.dispatchWorkgroups(
          Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE)
        );
        scanPass.end();
      });

      const compactPass = encoder.beginComputePass({
        label: `lesson-64-compact-pass-${lodIndex}`,
      });
      compactPass.setPipeline(compactPipeline);
      compactPass.setBindGroup(2, lodBuffer.compactBindGroup);
      compactPass.dispatchWorkgroups(
        Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE)
      );
      compactPass.end();

      const indirectPass = encoder.beginComputePass({
        label: `lesson-64-indirect-pass-${lodIndex}`,
      });
      indirectPass.setPipeline(indirectPipeline);
      indirectPass.setBindGroup(2, lodBuffer.indirectBindGroup);
      indirectPass.dispatchWorkgroups(1);
      indirectPass.end();
    });

    if (!pendingReadback) {
      lodBuffers.forEach((lodBuffer, index) => {
        encoder.copyBufferToBuffer(
          lodBuffer.indirectArgsBuffer,
          0,
          readbackBuffer,
          index * 20,
          20
        );
      });
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

    drawLeftPanel(
      renderPass,
      leftRect,
      scenePipeline,
      lod0MeshBuffers,
      staticBindGroup,
      leftVisibleBindGroup,
      scene.dynamicInstances.length
    );
    drawRightPanel(renderPass, rightRect, scenePipeline, staticBindGroup, lodBuffers);

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
  distanceRange.addEventListener("input", () => {
    settings.lodDistanceScale = Number(distanceRange.value);
  });
  freezeButton.addEventListener("click", () => {
    settings.freezeCamera = !settings.freezeCamera;
    frozenSnapshot = settings.freezeCamera ? camera.getSnapshot() : null;
    syncButtonsAndUniforms();
  });
  tintButton.addEventListener("click", () => {
    settings.showLodTint = !settings.showLodTint;
    syncButtonsAndUniforms();
  });

  syncButtonsAndUniforms();
  setStatus({
    title: "GPU-driven LOD 与实例调度已运行",
    detail:
      "左栏继续保持固定 LOD0，右栏则会在 frustum culling 之后按距离分 3 档，再分别 compact 成多组 indirect draw；这已经是一条完整的 GPU-driven visibility + scheduling 链。",
    tone: "ok",
  });
  frameHandle = requestAnimationFrame(renderFrame);

  return () => {
    cancelAnimationFrame(frameHandle);
    disposed = true;
    camera.dispose();
    destroyDepthTarget(depthTarget);
    lod0MeshBuffers.vertexBuffer.destroy();
    lod0MeshBuffers.indexBuffer.destroy();
    lod1MeshBuffers.vertexBuffer.destroy();
    lod1MeshBuffers.indexBuffer.destroy();
    lod2MeshBuffers.vertexBuffer.destroy();
    lod2MeshBuffers.indexBuffer.destroy();
    staticInstanceBuffer.destroy();
    allDynamicInstanceBuffer.destroy();
    visibleFlagsBuffer.destroy();
    lodUniformBuffer.destroy();
    frameUniformBuffer.destroy();
    staticDrawUniformBuffer.destroy();
    leftDrawUniformBuffer.destroy();
    seedUniformBuffer.destroy();
    if (!pendingReadback) {
      readbackBuffer.destroy();
    }
    placeholderFlagsBuffer.destroy();
    scanStepUniformBuffers.forEach((buffer) => buffer.destroy());
    lodBuffers.forEach((lodBuffer) => {
      lodBuffer.flagsBuffer.destroy();
      lodBuffer.scanBufferA.destroy();
      lodBuffer.scanBufferB.destroy();
      lodBuffer.compactedBuffer.destroy();
      lodBuffer.indirectArgsBuffer.destroy();
      lodBuffer.compactUniformBuffer.destroy();
      lodBuffer.drawUniformBuffer.destroy();
    });
  };
}
