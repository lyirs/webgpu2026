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
import boundsFragmentShaderSource from "@/lessons/gpu-driven-common/bounds.frag.wgsl?raw";
import boundsVertexShaderSource from "@/lessons/gpu-driven-common/bounds.vert.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/gpu-driven-common/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/gpu-driven-common/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type FrustumCullingSettings = {
  fov: number;
  farPlane: number;
  showBounds: boolean;
};

type FrustumCullingHudRefs = {
  fovRange: HTMLInputElement;
  fovValue: HTMLElement;
  farRange: HTMLInputElement;
  farValue: HTMLElement;
  boundsButton: HTMLButtonElement;
  boundsBadge: HTMLElement;
  totalValue: HTMLElement;
  visibleValue: HTMLElement;
  culledValue: HTMLElement;
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
    {
      x: 0,
      y: 0,
      width: panelWidth,
      height,
    },
    {
      x: panelWidth + gap,
      y: 0,
      width: panelWidth,
      height,
    },
  ];
}

function createSceneObservation(
  visibleCount: number,
  totalCount: number,
  showBounds: boolean
): string {
  const ratio = visibleCount / Math.max(totalCount, 1);

  if (showBounds) {
    return `右栏保留了 ${Math.round(ratio * 100)}% 的实例；球体只要和任意平面相交就会留下来，所以它比“完全进入视锥”更宽松。`;
  }

  if (ratio < 0.34) {
    return "当前视角下大部分实例已经离开视锥，右栏会明显稀疏；这就是最基础 frustum culling 能直接省掉的提交量。";
  }

  if (ratio > 0.72) {
    return "当前视锥覆盖比较宽，右栏会保留大多数实例；视锥裁剪不是魔法，它只在真正看不见时才会开始工作。";
  }

  return "拖动相机时，右栏只保留包围球仍与视锥相交的实例；左栏则始终把整批街区都画出来。";
}

function updateHud(
  refs: FrustumCullingHudRefs,
  settings: FrustumCullingSettings,
  totalCount: number,
  visibleCount: number
): void {
  const culledCount = totalCount - visibleCount;

  refs.fovValue.textContent = formatDegrees(settings.fov);
  refs.farValue.textContent = formatDistance(settings.farPlane);
  refs.boundsBadge.textContent = settings.showBounds ? "包围球已显示" : "包围球已隐藏";
  refs.boundsButton.textContent = settings.showBounds ? "隐藏包围球" : "显示包围球";
  refs.boundsButton.classList.toggle("gpu-driven-toggle--active", settings.showBounds);
  refs.totalValue.textContent = formatCount(totalCount);
  refs.visibleValue.textContent = formatCount(visibleCount);
  refs.culledValue.textContent = formatCount(culledCount);
  refs.observationValue.textContent = createSceneObservation(
    visibleCount,
    totalCount,
    settings.showBounds
  );
  refs.legendValue.textContent =
    "这一课统一使用 bounding sphere vs frustum planes：只要球心到任意平面的距离没有小到完全落在球半径之外，实例就会被保留。";
}

function createScenePipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: sceneVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: sceneFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-60-scene-pipeline",
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

function createBoundsPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): GPURenderPipeline {
  const vertexModule = device.createShaderModule({ code: boundsVertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: boundsFragmentShaderSource });

  return device.createRenderPipeline({
    label: "lesson-60-bounds-pipeline",
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
        {
          format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "less-equal",
    },
  });
}

function drawScenePanel(
  pass: GPURenderPassEncoder,
  rect: PanelRect,
  scenePipeline: GPURenderPipeline,
  sceneMeshBuffers: ReturnType<typeof createGpuDrivenMeshBuffers>,
  staticBindGroup: GPUBindGroup,
  dynamicBindGroup: GPUBindGroup,
  dynamicCount: number,
  boundsPipeline: GPURenderPipeline,
  sphereMeshBuffers: ReturnType<typeof createGpuDrivenMeshBuffers>,
  boundsBindGroup: GPUBindGroup | null,
  showBounds: boolean
): void {
  pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
  pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);

  pass.setPipeline(scenePipeline);
  pass.setVertexBuffer(0, sceneMeshBuffers.vertexBuffer);
  pass.setIndexBuffer(sceneMeshBuffers.indexBuffer, "uint16");

  pass.setBindGroup(0, staticBindGroup);
  pass.drawIndexed(sceneMeshBuffers.indexCount, 5);

  if (dynamicCount > 0) {
    pass.setBindGroup(0, dynamicBindGroup);
    pass.drawIndexed(sceneMeshBuffers.indexCount, dynamicCount);
  }

  if (!showBounds || !boundsBindGroup || dynamicCount === 0) {
    return;
  }

  pass.setPipeline(boundsPipeline);
  pass.setVertexBuffer(0, sphereMeshBuffers.vertexBuffer);
  pass.setIndexBuffer(sphereMeshBuffers.indexBuffer, "uint16");
  pass.setBindGroup(0, boundsBindGroup);
  pass.drawIndexed(sphereMeshBuffers.indexCount, dynamicCount);
}

export async function mountBoundingVolumesAndFrustumCullingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.className = "preview-viewport preview-viewport--gpu-driven-frustum";
  host.innerHTML = `
    <div class="gpu-driven-stage gpu-driven-stage--frustum">
      <div class="gpu-driven-badges">
        <span class="gpu-driven-badge">${formatCount(INSTANCE_COUNT)} 个动态实例</span>
        <span class="gpu-driven-badge gpu-driven-badge--warm">CPU frustum test</span>
        <span class="gpu-driven-badge gpu-driven-badge--cool" data-role="bounds-badge">包围球已隐藏</span>
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
        <div class="gpu-driven-control gpu-driven-control--toggle">
          <span>Debug Layer</span>
          <button class="gpu-driven-toggle" data-role="bounds-button" type="button">显示包围球</button>
        </div>
      </div>
      <div class="gpu-driven-labels">
        <article class="gpu-driven-label">
          <p class="eyebrow">左侧</p>
          <strong>Draw All</strong>
          <span>完整提交整片街区</span>
        </article>
        <article class="gpu-driven-label gpu-driven-label--cool">
          <p class="eyebrow">右侧</p>
          <strong>CPU Frustum Culling</strong>
          <span>只保留包围球仍与视锥相交的实例</span>
        </article>
      </div>
      <div class="gpu-driven-frame">
        <canvas class="gpu-driven-canvas"></canvas>
      </div>
      <div class="gpu-driven-card-grid">
        <article class="gpu-driven-card">
          <p class="eyebrow">Total</p>
          <strong data-role="total-value">0</strong>
          <p>左栏始终提交整批实例，作为最朴素的参考路径。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">Visible</p>
          <strong data-role="visible-value">0</strong>
          <p>右栏只保留当前视锥内仍可能出现在屏幕上的实例。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">Culled</p>
          <strong data-role="culled-value">0</strong>
          <p>完全离开视锥的实例不会继续进入右栏 draw。</p>
        </article>
        <article class="gpu-driven-card">
          <p class="eyebrow">观察</p>
          <strong data-role="observation-value">等待首帧</strong>
          <p>拖动相机、调 FOV 或拉远 far plane，都能直接改变右栏实例数量。</p>
        </article>
      </div>
      <article class="gpu-driven-legend">
        <strong>当前实验</strong>
        <p data-role="legend-value">这一课会先把包围球与视锥平面测试讲清楚，再进入后续 GPU 版本的 visibility pipeline。</p>
      </article>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const fovRange = host.querySelector<HTMLInputElement>('[data-role="fov-range"]');
  const farRange = host.querySelector<HTMLInputElement>('[data-role="far-range"]');
  const boundsButton = host.querySelector<HTMLButtonElement>('[data-role="bounds-button"]');
  const fovValue = host.querySelector<HTMLElement>('[data-role="fov-value"]');
  const farValue = host.querySelector<HTMLElement>('[data-role="far-value"]');
  const boundsBadge = host.querySelector<HTMLElement>('[data-role="bounds-badge"]');
  const totalValue = host.querySelector<HTMLElement>('[data-role="total-value"]');
  const visibleValue = host.querySelector<HTMLElement>('[data-role="visible-value"]');
  const culledValue = host.querySelector<HTMLElement>('[data-role="culled-value"]');
  const observationValue = host.querySelector<HTMLElement>('[data-role="observation-value"]');
  const legendValue = host.querySelector<HTMLElement>('[data-role="legend-value"]');

  if (
    !canvas ||
    !fovRange ||
    !farRange ||
    !boundsButton ||
    !fovValue ||
    !farValue ||
    !boundsBadge ||
    !totalValue ||
    !visibleValue ||
    !culledValue ||
    !observationValue ||
    !legendValue
  ) {
    throw new Error("第 60 课的 DOM 初始化失败。");
  }

  const refs: FrustumCullingHudRefs = {
    fovRange,
    fovValue,
    farRange,
    farValue,
    boundsButton,
    boundsBadge,
    totalValue,
    visibleValue,
    culledValue,
    observationValue,
    legendValue,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const sceneGeometry = createGpuDrivenSceneGeometry();
  const sceneMeshBuffers = createGpuDrivenMeshBuffers(gpu.device, sceneGeometry.lod0);
  const sphereMeshBuffers = createGpuDrivenMeshBuffers(gpu.device, sceneGeometry.sphere);
  const scenePipeline = createScenePipeline(gpu.device, gpu.format);
  const boundsPipeline = createBoundsPipeline(gpu.device, gpu.format);
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

  const visibleDynamicInstanceBuffer = gpu.device.createBuffer({
    size: allDynamicData.byteLength,
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
  const allDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const visibleDrawUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const leftBoundsUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const rightBoundsUniformBuffer = gpu.device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  gpu.device.queue.writeBuffer(
    staticDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 0)
  );
  gpu.device.queue.writeBuffer(
    allDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 0)
  );
  gpu.device.queue.writeBuffer(
    visibleDrawUniformBuffer,
    0,
    createDrawUniformData([1, 1, 1, 1], 0, 1, 0)
  );
  gpu.device.queue.writeBuffer(
    leftBoundsUniformBuffer,
    0,
    createDrawUniformData([0.45, 0.86, 1, 1], 0, 0.16, 0)
  );
  gpu.device.queue.writeBuffer(
    rightBoundsUniformBuffer,
    0,
    createDrawUniformData([1, 0.74, 0.40, 1], 0, 0.18, 0)
  );

  const bindGroupLayout = scenePipeline.getBindGroupLayout(0);
  const staticBindGroup = gpu.device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: staticInstanceBuffer } },
      { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
      { binding: 3, resource: { buffer: staticDrawUniformBuffer } },
    ],
  });
  const allDynamicBindGroup = gpu.device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: allDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
      { binding: 3, resource: { buffer: allDrawUniformBuffer } },
    ],
  });
  const visibleDynamicBindGroup = gpu.device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: visibleDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
      { binding: 3, resource: { buffer: visibleDrawUniformBuffer } },
    ],
  });
  const leftBoundsBindGroup = gpu.device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: allDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
      { binding: 3, resource: { buffer: leftBoundsUniformBuffer } },
    ],
  });
  const rightBoundsBindGroup = gpu.device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: frameUniformBuffer } },
      { binding: 1, resource: { buffer: visibleDynamicInstanceBuffer } },
      { binding: 2, resource: { buffer: placeholderFlagsBuffer } },
      { binding: 3, resource: { buffer: rightBoundsUniformBuffer } },
    ],
  });

  const depthTarget: DepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };
  const settings: FrustumCullingSettings = {
    fov: INITIAL_FOV,
    farPlane: INITIAL_FAR,
    showBounds: false,
  };

  const camera = createOrbitCameraController(canvas, {
    eye: [18, 15, 18],
    target: [0, 1.8, 0],
    minRadius: 12,
    maxRadius: 42,
  });

  let frameHandle = 0;

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

    const visibleInstances = buildVisibleInstances(scene.dynamicInstances, cpuFlags);
    const visibleData = createGpuDrivenInstanceData(visibleInstances);
    if (visibleData.byteLength > 0) {
      gpu.device.queue.writeBuffer(visibleDynamicInstanceBuffer, 0, visibleData);
    }

    gpu.device.queue.writeBuffer(
      frameUniformBuffer,
      0,
      createFrameUniformData(viewProjectionMatrix, LIGHT_DIRECTION, cameraSnapshot.eye)
    );

    updateHud(
      refs,
      settings,
      scene.dynamicInstances.length,
      countVisibleFlags(cpuFlags)
    );

    const commandEncoder = gpu.device.createCommandEncoder({
      label: "lesson-60-command-encoder",
    });
    const pass = commandEncoder.beginRenderPass({
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
      pass,
      leftRect,
      scenePipeline,
      sceneMeshBuffers,
      staticBindGroup,
      allDynamicBindGroup,
      scene.dynamicInstances.length,
      boundsPipeline,
      sphereMeshBuffers,
      leftBoundsBindGroup,
      settings.showBounds
    );
    drawScenePanel(
      pass,
      rightRect,
      scenePipeline,
      sceneMeshBuffers,
      staticBindGroup,
      visibleDynamicBindGroup,
      visibleInstances.length,
      boundsPipeline,
      sphereMeshBuffers,
      rightBoundsBindGroup,
      settings.showBounds
    );

    pass.end();
    gpu.device.queue.submit([commandEncoder.finish()]);
    frameHandle = requestAnimationFrame(renderFrame);
  };

  fovRange.addEventListener("input", () => {
    settings.fov = (Number(fovRange.value) * Math.PI) / 180;
  });
  farRange.addEventListener("input", () => {
    settings.farPlane = Number(farRange.value);
  });
  boundsButton.addEventListener("click", () => {
    settings.showBounds = !settings.showBounds;
  });

  updateHud(refs, settings, scene.dynamicInstances.length, scene.dynamicInstances.length);
  setStatus({
    title: "包围体与视锥裁剪已运行",
    detail:
      "左栏始终提交整片街区，右栏只保留包围球仍与视锥相交的实例；打开包围球后，更容易直接看到“进不进视锥”这件事到底怎么判。",
    tone: "ok",
  });
  frameHandle = requestAnimationFrame(renderFrame);

  return () => {
    cancelAnimationFrame(frameHandle);
    camera.dispose();
    destroyDepthTarget(depthTarget);
    sceneMeshBuffers.vertexBuffer.destroy();
    sceneMeshBuffers.indexBuffer.destroy();
    sphereMeshBuffers.vertexBuffer.destroy();
    sphereMeshBuffers.indexBuffer.destroy();
    staticInstanceBuffer.destroy();
    allDynamicInstanceBuffer.destroy();
    visibleDynamicInstanceBuffer.destroy();
    placeholderFlagsBuffer.destroy();
    frameUniformBuffer.destroy();
    staticDrawUniformBuffer.destroy();
    allDrawUniformBuffer.destroy();
    visibleDrawUniformBuffer.destroy();
    leftBoundsUniformBuffer.destroy();
    rightBoundsUniformBuffer.destroy();
  };
}
