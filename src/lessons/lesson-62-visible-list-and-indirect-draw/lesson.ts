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
} from "@/lessons/gpu-driven-common/render";
import computeShaderSource from "@/lessons/lesson-62-visible-list-and-indirect-draw/compute.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/gpu-driven-common/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/gpu-driven-common/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type VisibleListSettings = {
  fov: number;
  farPlane: number;
};

type VisibleListHudRefs = {
  fovRange: HTMLInputElement;
  fovValue: HTMLElement;
  farRange: HTMLInputElement;
  farValue: HTMLElement;
  totalValue: HTMLElement;
  visibleValue: HTMLElement;
  scanValue: HTMLElement;
  indirectValue: HTMLElement;
  observationValue: HTMLElement;
  legendValue: HTMLElement;
};

type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const INSTANCE_COUNT = 1024;
const CAMERA_NEAR = 0.1;
const LIGHT_DIRECTION: Vector3 = [-0.42, -0.92, -0.18];
const INITIAL_FOV = Math.PI / 3.15;
const INITIAL_FAR = 40;
const WORKGROUP_SIZE = 64;

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

function createCullingUniformData(
  frustumPlanes: Float32Array,
  instanceCount: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(112);
  const floats = new Float32Array(buffer);
  const uints = new Uint32Array(buffer);
  floats.set(frustumPlanes, 0);
  uints[24] = instanceCount;
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
  refs: VisibleListHudRefs,
  settings: VisibleListSettings,
  totalCount: number,
  visibleCount: number | null,
  scanPassCount: number,
  indirectCount: number | null
): void {
  refs.fovValue.textContent = formatDegrees(settings.fov);
  refs.farValue.textContent = formatDistance(settings.farPlane);
  refs.totalValue.textContent = formatCount(totalCount);
  refs.visibleValue.textContent =
    visibleCount === null ? "等待首轮" : formatCount(visibleCount);
  refs.scanValue.textContent = `${scanPassCount} passes`;
  refs.indirectValue.textContent =
    indirectCount === null ? "等待首轮" : formatCount(indirectCount);
  refs.observationValue.textContent =
    indirectCount === null
      ? "右栏已经在走 flags -> scan -> compact 路线，但 GPU 读回还在等待第一轮。"
      : "左栏仍然遍历完整实例数组，只靠 flags 在 shader 里决定画不画；右栏则真正把可见实例压成连续列表，再交给 indirect draw。";
  refs.legendValue.textContent =
    "这一课正式兑现第 59 课：先做 visibility flags，再做 prefix sum / stream compaction，最后把 indirect args 也交给 GPU 生成。";
}

function createScenePipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-62-scene-pipeline",
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
  meshBuffers: ReturnType<typeof createGpuDrivenMeshBuffers>,
  staticBindGroup: GPUBindGroup,
  flaggedBindGroup: GPUBindGroup,
  totalDynamicCount: number
): void {
  pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
  pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, meshBuffers.vertexBuffer);
  pass.setIndexBuffer(meshBuffers.indexBuffer, "uint16");
  pass.setBindGroup(0, staticBindGroup);
  pass.drawIndexed(meshBuffers.indexCount, 5);
  pass.setBindGroup(0, flaggedBindGroup);
  pass.drawIndexed(meshBuffers.indexCount, totalDynamicCount);
}

function drawRightPanel(
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

export async function mountVisibleListAndIndirectDrawLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--gpu-driven-visible-list";
  host.innerHTML = `
    <div class="gpu-driven-stage gpu-driven-stage--visible-list">
      <div class="gpu-driven-badges">
        <span class="gpu-driven-badge">${formatCount(INSTANCE_COUNT)} 个动态实例</span>
        <span class="gpu-driven-badge gpu-driven-badge--warm">flags-only 左栏</span>
        <span class="gpu-driven-badge gpu-driven-badge--cool">compaction + indirect 右栏</span>
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
          <span>Scan Passes</span>
          <strong data-role="scan-value">0 passes</strong>
          <small>每个 offset 都会单独做一次 prefix sum step</small>
        </article>
      </div>
      <div class="gpu-driven-labels">
        <article class="gpu-driven-label">
          <p class="eyebrow">左侧</p>
          <strong>Flags Only</strong>
          <span>仍然遍历完整实例数组，但 fragment 会读取 visibility flags</span>
        </article>
        <article class="gpu-driven-label gpu-driven-label--cool">
          <p class="eyebrow">右侧</p>
          <strong>Visible List + Indirect</strong>
          <span>GPU 先压紧可见实例，再直接写出 drawIndexedIndirect 参数</span>
        </article>
      </div>
      <div class="gpu-driven-frame">
        <canvas class="gpu-driven-canvas"></canvas>
      </div>
      <div class="gpu-driven-card-grid">
        <article class="gpu-driven-card">
          <p class="eyebrow">Total Instances</p>
          <strong data-role="total-value">0</strong>
          <p>左栏完整遍历这批实例，再依赖 flags 决定哪些片元真的留下。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">Visible Instances</p>
          <strong data-role="visible-value">等待首轮</strong>
          <p>这个数量来自 GPU 侧 flags / scan 结果，不由 CPU 重新遍历得出。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">Indirect InstanceCount</p>
          <strong data-role="indirect-value">等待首轮</strong>
          <p>右栏真正执行的 instanceCount 直接来自 GPU 写入的 indirect args。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">观察</p>
          <strong data-role="observation-value">等待首帧</strong>
          <p>现在已经不是“知道谁可见”而已，而是把可见数据压成一份真正连续的 draw 输入。</p>
        </article>
      </div>
      <article class="gpu-driven-legend">
        <strong>当前实验</strong>
        <p data-role="legend-value">这一课会把 visibility flags 推到真正的 visible list，再让 drawIndexedIndirect 从 GPU 写好的参数里读取实例数量。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const fovRange = host.querySelector<HTMLInputElement>('[data-role="fov-range"]');
  const farRange = host.querySelector<HTMLInputElement>('[data-role="far-range"]');
  const fovValue = host.querySelector<HTMLElement>('[data-role="fov-value"]');
  const farValue = host.querySelector<HTMLElement>('[data-role="far-value"]');
  const totalValue = host.querySelector<HTMLElement>('[data-role="total-value"]');
  const visibleValue = host.querySelector<HTMLElement>('[data-role="visible-value"]');
  const scanValue = host.querySelector<HTMLElement>('[data-role="scan-value"]');
  const indirectValue = host.querySelector<HTMLElement>('[data-role="indirect-value"]');
  const observationValue = host.querySelector<HTMLElement>('[data-role="observation-value"]');
  const legendValue = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !fovRange ||
    !farRange ||
    !fovValue ||
    !farValue ||
    !totalValue ||
    !visibleValue ||
    !scanValue ||
    !indirectValue ||
    !observationValue ||
    !legendValue
  ) {
    throw new Error("第 62 课的 DOM 初始化失败。");
  }

  const refs: VisibleListHudRefs = {
    fovRange,
    fovValue,
    farRange,
    farValue,
    totalValue,
    visibleValue,
    scanValue,
    indirectValue,
    observationValue,
    legendValue,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const sceneGeometry = createGpuDrivenSceneGeometry();
  const sceneMeshBuffers = createGpuDrivenMeshBuffers(gpu.device, sceneGeometry.lod0);
  const scenePipeline = createScenePipeline(gpu.device, gpu.format);
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

  const allDynamicData = createGpuDrivenInstanceData(scene.dynamicInstances);
  const allDynamicInstanceBuffer = gpu.device.createBuffer({
    size: allDynamicData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(allDynamicInstanceBuffer.getMappedRange()).set(allDynamicData);
  allDynamicInstanceBuffer.unmap();

  const visibilityFlagsBuffer = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const visibleCounterBuffer = gpu.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const scanBufferA = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const scanBufferB = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
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
    size: 24,
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
  const flaggedDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const compactedDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const cullingUniformBuffer = gpu.device.createBuffer({
    size: 112,
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
  const zeroCounter = new Uint32Array([0]);

  gpu.device.queue.writeBuffer(
    staticDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 0)
  );
  gpu.device.queue.writeBuffer(
    flaggedDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 1)
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
  const flaggedBindGroup = gpu.device.createBindGroup({
    layout: sceneBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: allDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: visibilityFlagsBuffer } },
      { binding: 3, resource: { buffer: flaggedDrawUniformBuffer } },
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

  const computeModule = gpu.device.createShaderModule({ code: computeShaderSource });
  const cullPipeline = gpu.device.createComputePipeline({
    label: "lesson-62-cull-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csFrustumFlags" },
  });
  const seedPipeline = gpu.device.createComputePipeline({
    label: "lesson-62-seed-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csSeedScan" },
  });
  const scanPipeline = gpu.device.createComputePipeline({
    label: "lesson-62-scan-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csPrefixSumStep" },
  });
  const compactPipeline = gpu.device.createComputePipeline({
    label: "lesson-62-compact-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csCompact" },
  });
  const indirectPipeline = gpu.device.createComputePipeline({
    label: "lesson-62-indirect-pipeline",
    layout: "auto",
    compute: { module: computeModule, entryPoint: "csWriteIndirect" },
  });

  const cullBindGroup = gpu.device.createBindGroup({
    layout: cullPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: cullingUniformBuffer } },
      { binding: 1, resource: { buffer: allDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: visibilityFlagsBuffer } },
      { binding: 3, resource: { buffer: visibleCounterBuffer } },
    ],
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
  const settings: VisibleListSettings = {
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
  let lastVisibleCount: number | null = null;
  let lastIndirectCount: number | null = null;

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
        lastVisibleCount = mapped[0] ?? 0;
        lastIndirectCount = mapped[6] ?? 0;
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

    gpu.device.queue.writeBuffer(
      frameUniformBuffer,
      0,
      createFrameUniformData(viewProjectionMatrix, LIGHT_DIRECTION, cameraSnapshot.eye)
    );
    gpu.device.queue.writeBuffer(
      cullingUniformBuffer,
      0,
      createCullingUniformData(frustumPlanes, scene.dynamicInstances.length)
    );
    gpu.device.queue.writeBuffer(visibleCounterBuffer, 0, zeroCounter);

    updateHud(
      refs,
      settings,
      scene.dynamicInstances.length,
      lastVisibleCount,
      scanPassCount,
      lastIndirectCount
    );

    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-62-command-encoder",
    });

    const cullPass = encoder.beginComputePass({
      label: "lesson-62-frustum-pass",
    });
    cullPass.setPipeline(cullPipeline);
    cullPass.setBindGroup(0, cullBindGroup);
    cullPass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
    cullPass.end();

    const seedPass = encoder.beginComputePass({
      label: "lesson-62-seed-pass",
    });
    seedPass.setPipeline(seedPipeline);
    seedPass.setBindGroup(1, seedBindGroup);
    seedPass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
    seedPass.end();

    scanOffsets.forEach((_, index) => {
      const scanPass = encoder.beginComputePass({
        label: `lesson-62-scan-step-${index}`,
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
      label: "lesson-62-compact-pass",
    });
    compactPass.setPipeline(compactPipeline);
    compactPass.setBindGroup(2, compactBindGroup);
    compactPass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
    compactPass.end();

    const indirectPass = encoder.beginComputePass({
      label: "lesson-62-indirect-pass",
    });
    indirectPass.setPipeline(indirectPipeline);
    indirectPass.setBindGroup(2, indirectBindGroup);
    indirectPass.dispatchWorkgroups(1);
    indirectPass.end();

    if (!pendingReadback) {
      encoder.copyBufferToBuffer(visibleCounterBuffer, 0, readbackBuffer, 0, 4);
      encoder.copyBufferToBuffer(indirectArgsBuffer, 0, readbackBuffer, 4, 20);
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
      sceneMeshBuffers,
      staticBindGroup,
      flaggedBindGroup,
      scene.dynamicInstances.length
    );
    drawRightPanel(
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

  updateHud(refs, settings, scene.dynamicInstances.length, null, scanPassCount, null);
  setStatus({
    title: "Visible List 与 Indirect Draw 已运行",
    detail:
      "左栏仍停留在 flags-only 路径，右栏则会先做 prefix sum / compaction，再让 drawIndexedIndirect 直接吃 GPU 写好的 instanceCount。",
    tone: "ok",
  });
  frameHandle = requestAnimationFrame(renderFrame);

  return () => {
    disposed = true;
    cancelAnimationFrame(frameHandle);
    camera.dispose();
    destroyDepthTarget(depthTarget);
    sceneMeshBuffers.vertexBuffer.destroy();
    sceneMeshBuffers.indexBuffer.destroy();
    staticInstanceBuffer.destroy();
    allDynamicInstanceBuffer.destroy();
    visibilityFlagsBuffer.destroy();
    visibleCounterBuffer.destroy();
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
    flaggedDrawUniformBuffer.destroy();
    compactedDrawUniformBuffer.destroy();
    cullingUniformBuffer.destroy();
    seedUniformBuffer.destroy();
    compactUniformBuffer.destroy();
    scanStepUniformBuffers.forEach((buffer) => buffer.destroy());
  };
}
