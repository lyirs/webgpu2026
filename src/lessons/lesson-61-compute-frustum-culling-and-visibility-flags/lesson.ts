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
import computeShaderSource from "@/lessons/lesson-61-compute-frustum-culling-and-visibility-flags/compute.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/gpu-driven-common/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/gpu-driven-common/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type VisibilitySettings = {
  fov: number;
  farPlane: number;
};

type VisibilityHudRefs = {
  fovRange: HTMLInputElement;
  fovValue: HTMLElement;
  farRange: HTMLInputElement;
  farValue: HTMLElement;
  cpuValue: HTMLElement;
  gpuValue: HTMLElement;
  mismatchValue: HTMLElement;
  dispatchValue: HTMLElement;
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

function updateHud(
  refs: VisibilityHudRefs,
  settings: VisibilitySettings,
  cpuVisibleCount: number,
  gpuVisibleCount: number | null,
  mismatchCount: number | null,
  workgroupCount: number
): void {
  refs.fovValue.textContent = formatDegrees(settings.fov);
  refs.farValue.textContent = formatDistance(settings.farPlane);
  refs.cpuValue.textContent = formatCount(cpuVisibleCount);
  refs.gpuValue.textContent =
    gpuVisibleCount === null ? "等待首轮" : formatCount(gpuVisibleCount);
  refs.mismatchValue.textContent =
    mismatchCount === null ? "等待首轮" : formatCount(mismatchCount);
  refs.dispatchValue.textContent = `${workgroupCount} groups`;
  refs.observationValue.textContent =
    gpuVisibleCount === null
      ? "右栏已经由 GPU flags 驱动，但诊断读回还在等待第一轮 mapAsync 完成。"
      : mismatchCount === 0
        ? "CPU 参考路径与 GPU flags 当前完全一致；右栏现在已经不需要 CPU 先压一份 visible list 才能显示结果。"
        : "当前出现了 CPU / GPU 不一致，说明 frustum planes 或 compute 判定逻辑还有偏差。";
  refs.legendValue.textContent =
    "这一课只把“可见性标记”搬进 compute：GPU 会为每个实例写一位 visibility flag，并单独累计可见数量；真正的 compacted visible list 留到下一课。";
}

function createScenePipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-61-scene-pipeline",
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

function drawScenePanel(
  pass: GPURenderPassEncoder,
  rect: PanelRect,
  pipeline: GPURenderPipeline,
  meshBuffers: ReturnType<typeof createGpuDrivenMeshBuffers>,
  staticBindGroup: GPUBindGroup,
  dynamicBindGroup: GPUBindGroup,
  dynamicCount: number
): void {
  pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
  pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
  pass.setPipeline(pipeline);
  pass.setVertexBuffer(0, meshBuffers.vertexBuffer);
  pass.setIndexBuffer(meshBuffers.indexBuffer, "uint16");

  pass.setBindGroup(0, staticBindGroup);
  pass.drawIndexed(meshBuffers.indexCount, 5);

  if (dynamicCount > 0) {
    pass.setBindGroup(0, dynamicBindGroup);
    pass.drawIndexed(meshBuffers.indexCount, dynamicCount);
  }
}

export async function mountComputeFrustumCullingAndVisibilityFlagsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--gpu-driven-flags";
  host.innerHTML = `
    <div class="gpu-driven-stage gpu-driven-stage--flags">
      <div class="gpu-driven-badges">
        <span class="gpu-driven-badge">${formatCount(INSTANCE_COUNT)} 个动态实例</span>
        <span class="gpu-driven-badge gpu-driven-badge--warm">CPU reference</span>
        <span class="gpu-driven-badge gpu-driven-badge--cool">GPU visibility flags</span>
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
          <span>Dispatch</span>
          <strong data-role="dispatch-value">${Math.ceil(INSTANCE_COUNT / WORKGROUP_SIZE)} groups</strong>
          <small>1 个 thread 负责 1 个包围球测试</small>
        </article>
      </div>
      <div class="gpu-driven-labels">
        <article class="gpu-driven-label">
          <p class="eyebrow">左侧</p>
          <strong>CPU Reference</strong>
          <span>CPU 先生成 visible list，再提交右边相同的视角结果</span>
        </article>
        <article class="gpu-driven-label gpu-driven-label--cool">
          <p class="eyebrow">右侧</p>
          <strong>GPU Flags</strong>
          <span>GPU 直接给每个实例写 visibility flag，由 render pass 读取</span>
        </article>
      </div>
      <div class="gpu-driven-frame">
        <canvas class="gpu-driven-canvas"></canvas>
      </div>
      <div class="gpu-driven-card-grid">
        <article class="gpu-driven-card">
          <p class="eyebrow">CPU Visible</p>
          <strong data-role="cpu-value">0</strong>
          <p>左栏是包围球 vs 视锥平面的 CPU 参考结果。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">GPU Visible</p>
          <strong data-role="gpu-value">等待首轮</strong>
          <p>右栏的 flags 计数来自 GPU readback，而不是 CPU 重新数一遍。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">Mismatch</p>
          <strong data-role="mismatch-value">等待首轮</strong>
          <p>只要 mismatch 不是 0，就说明 planes 上传或 shader 判定逻辑还不一致。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">观察</p>
          <strong data-role="observation-value">等待首帧</strong>
          <p>这节先只做 flags，不做 compaction，也不做 indirect draw。</p>
        </article>
      </div>
      <article class="gpu-driven-legend">
        <strong>当前实验</strong>
        <p data-role="legend-value">GPU 会先对每个实例做 frustum test，并把结果写成一组 visibility flags；下一课再把这组 flags 压紧成真正的 visible list。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const fovRange = host.querySelector<HTMLInputElement>('[data-role="fov-range"]');
  const farRange = host.querySelector<HTMLInputElement>('[data-role="far-range"]');
  const fovValue = host.querySelector<HTMLElement>('[data-role="fov-value"]');
  const farValue = host.querySelector<HTMLElement>('[data-role="far-value"]');
  const cpuValue = host.querySelector<HTMLElement>('[data-role="cpu-value"]');
  const gpuValue = host.querySelector<HTMLElement>('[data-role="gpu-value"]');
  const mismatchValue = host.querySelector<HTMLElement>('[data-role="mismatch-value"]');
  const dispatchValue = host.querySelector<HTMLElement>('[data-role="dispatch-value"]');
  const observationValue = host.querySelector<HTMLElement>('[data-role="observation-value"]');
  const legendValue = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !fovRange ||
    !farRange ||
    !fovValue ||
    !farValue ||
    !cpuValue ||
    !gpuValue ||
    !mismatchValue ||
    !dispatchValue ||
    !observationValue ||
    !legendValue
  ) {
    throw new Error("第 61 课的 DOM 初始化失败。");
  }

  const refs: VisibilityHudRefs = {
    fovRange,
    fovValue,
    farRange,
    farValue,
    cpuValue,
    gpuValue,
    mismatchValue,
    dispatchValue,
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

  const cpuVisibleInstanceBuffer = gpu.device.createBuffer({
    size: allDynamicData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const gpuFlagsBuffer = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const visibleCounterBuffer = gpu.device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  const readbackBuffer = gpu.device.createBuffer({
    size: scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT + 4,
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
  const gpuDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const cullingUniformBuffer = gpu.device.createBuffer({
    size: 112,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const zeroCounter = new Uint32Array([0]);

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
    gpuDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 1)
  );

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
  const gpuFlagsBindGroup = gpu.device.createBindGroup({
    layout: sceneBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: allDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: gpuFlagsBuffer } },
      { binding: 3, resource: { buffer: gpuDrawUniformBuffer } },
    ],
  });

  const computePipeline = gpu.device.createComputePipeline({
    label: "lesson-61-frustum-compute-pipeline",
    layout: "auto",
    compute: {
      module: gpu.device.createShaderModule({ code: computeShaderSource }),
      entryPoint: "csMain",
    },
  });
  const computeBindGroup = gpu.device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: cullingUniformBuffer } },
      { binding: 1, resource: { buffer: allDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: gpuFlagsBuffer } },
      { binding: 3, resource: { buffer: visibleCounterBuffer } },
    ],
  });

  const depthTarget: DepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };
  const settings: VisibilitySettings = {
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
  let lastGpuVisibleCount: number | null = null;
  let lastMismatchCount: number | null = null;

  const scheduleReadback = (cpuFlagsSnapshot: Uint32Array) => {
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
        const gpuFlags = mapped.slice(0, scene.dynamicInstances.length);
        const gpuVisibleCount = mapped[scene.dynamicInstances.length] ?? 0;
        let mismatchCount = 0;

        for (let index = 0; index < cpuFlagsSnapshot.length; index += 1) {
          mismatchCount += gpuFlags[index] === cpuFlagsSnapshot[index] ? 0 : 1;
        }

        lastGpuVisibleCount = gpuVisibleCount;
        lastMismatchCount = mismatchCount;
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
      cullingUniformBuffer,
      0,
      createCullingUniformData(frustumPlanes, scene.dynamicInstances.length)
    );
    gpu.device.queue.writeBuffer(visibleCounterBuffer, 0, zeroCounter);

    updateHud(
      refs,
      settings,
      countVisibleFlags(cpuFlags),
      lastGpuVisibleCount,
      lastMismatchCount,
      Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE)
    );

    const encoder = gpu.device.createCommandEncoder({
      label: "lesson-61-command-encoder",
    });
    const computePass = encoder.beginComputePass({
      label: "lesson-61-compute-pass",
    });
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE));
    computePass.end();

    if (!pendingReadback) {
      const flagsBytes = scene.dynamicInstances.length * Uint32Array.BYTES_PER_ELEMENT;
      encoder.copyBufferToBuffer(gpuFlagsBuffer, 0, readbackBuffer, 0, flagsBytes);
      encoder.copyBufferToBuffer(visibleCounterBuffer, 0, readbackBuffer, flagsBytes, 4);
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

    drawScenePanel(
      renderPass,
      leftRect,
      scenePipeline,
      sceneMeshBuffers,
      staticBindGroup,
      cpuVisibleBindGroup,
      cpuVisibleInstances.length
    );
    drawScenePanel(
      renderPass,
      rightRect,
      scenePipeline,
      sceneMeshBuffers,
      staticBindGroup,
      gpuFlagsBindGroup,
      scene.dynamicInstances.length
    );

    renderPass.end();
    gpu.device.queue.submit([encoder.finish()]);

    if (!pendingReadback) {
      scheduleReadback(cpuFlags.slice());
    }

    frameHandle = requestAnimationFrame(renderFrame);
  };

  fovRange.addEventListener("input", () => {
    settings.fov = (Number(fovRange.value) * Math.PI) / 180;
  });
  farRange.addEventListener("input", () => {
    settings.farPlane = Number(farRange.value);
  });

  updateHud(
    refs,
    settings,
    scene.dynamicInstances.length,
    null,
    null,
    Math.ceil(scene.dynamicInstances.length / WORKGROUP_SIZE)
  );
  setStatus({
    title: "Compute Frustum Culling 已运行",
    detail:
      "左栏仍是 CPU 参考路径，右栏则直接读取 GPU 生成的 visibility flags；当前这节只到 flags，不做 compaction，也不做 indirect draw。",
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
    cpuVisibleInstanceBuffer.destroy();
    gpuFlagsBuffer.destroy();
    visibleCounterBuffer.destroy();
    if (!pendingReadback) {
      readbackBuffer.destroy();
    }
    placeholderFlagsBuffer.destroy();
    frameUniformBuffer.destroy();
    staticDrawUniformBuffer.destroy();
    cpuDrawUniformBuffer.destroy();
    gpuDrawUniformBuffer.destroy();
    cullingUniformBuffer.destroy();
  };
}
