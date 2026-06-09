import { createOrbitCameraController } from "@/core/orbit-camera";
import { createQueryLessonGeometry } from "@/lessons/lesson-95-gpu-queries-and-profiling/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-95-gpu-queries-and-profiling/math";
import fragmentShaderSource from "@/lessons/lesson-95-gpu-queries-and-profiling/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-95-gpu-queries-and-profiling/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type QueryWebGpuCanvas = {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  resize: () => void;
  supportsTimestampQuery: boolean;
};

type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  rotationY: number;
  scale: Vector3;
  color: [number, number, number, number];
  queryIndex?: 0 | 1;
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  modelMatrix: Float32Array;
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type QueryHudRefs = {
  timestampBadge: HTMLElement;
  occlusionBadge: HTMLElement;
  samplingBadge: HTMLElement;
  cpuValue: HTMLElement;
  cpuMeta: HTMLElement;
  gpuValue: HTMLElement;
  gpuMeta: HTMLElement;
  visibleValue: HTMLElement;
  visibleMeta: HTMLElement;
  visibleFill: HTMLElement;
  hiddenValue: HTMLElement;
  hiddenMeta: HTMLElement;
  hiddenFill: HTMLElement;
  legendBody: HTMLElement;
};

type MetricState = {
  cpuMs: number;
  hasCpuMetric: boolean;
  gpuMs: number | null;
  visibleSamples: number | null;
  hiddenSamples: number | null;
  pending: boolean;
};

const QUERY_SAMPLE_INTERVAL = 0.35;
const CPU_SMOOTHING = 0.18;

/**
 * 创建一份对象 uniform 数据，里面包含 MVP、模型矩阵和颜色。
 * @param {Float32Array} modelViewProjectionMatrix 当前对象的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {[number, number, number, number]} color 当前对象颜色。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续 float 数据。
 */
function createObjectUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  color: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(color, 32);
  return uniformData;
}

/**
 * 把光源位置、相机位置和环境光打包成场景级 uniform 数据。
 * @param {Vector3} lightPosition 当前帧点光源位置。
 * @param {Vector3} eyePosition 当前帧相机位置。
 * @returns {Float32Array} 供整个场景共用的连续 float 数据。
 */
function createSceneUniformData(
  lightPosition: Vector3,
  eyePosition: Vector3
): Float32Array {
  return new Float32Array([
    lightPosition[0], lightPosition[1], lightPosition[2], 1,
    eyePosition[0], eyePosition[1], eyePosition[2], 1,
    0.09, 0.11, 0.15, 1,
  ]);
}

/**
 * 组合对象的模型矩阵。
 * @param {SceneObjectConfig} config 当前对象静态配置。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createModelMatrix(config: SceneObjectConfig): Float32Array {
  return multiplyMatrices(
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
}

/**
 * 把数字格式化成更适合 HUD 展示的毫秒文本。
 * @param {number | null} value 当前毫秒数。
 * @returns {string} 对应的字符串。
 */
function formatMilliseconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "等待首轮";
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ms`;
}

/**
 * 把 occlusion query 的采样数量格式化成更短的数字文本。
 * @param {number | null} value 当前可见采样数量。
 * @returns {string} 对应的展示文本。
 */
function formatSampleCount(value: number | null): string {
  if (value === null) {
    return "等待首轮";
  }

  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 把可见采样数量映射成一条可视化进度条宽度。
 * @param {number | null} value 当前可见采样数量。
 * @returns {number} 0-100 之间的百分比。
 */
function sampleFillPercent(value: number | null): number {
  if (!value || value <= 0) {
    return 0;
  }

  return Math.min(100, 16 + Math.log10(value + 1) * 26);
}

/**
 * 安全释放深度纹理。
 * @param {DepthTarget} target 当前 lesson 使用的深度目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 用 lesson 自己的 device 申请逻辑初始化 canvas，这样才能按需开启 timestamp-query。
 * @param {HTMLCanvasElement} canvas 当前 lesson 要绑定的画布。
 * @returns {Promise<QueryWebGpuCanvas>} 包含 device、context、format、resize 和时间戳能力标记。
 */
async function createQueryWebGpuCanvas(
  canvas: HTMLCanvasElement
): Promise<QueryWebGpuCanvas> {
  if (!("gpu" in navigator)) {
    throw new Error("当前浏览器没有提供 WebGPU。");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("没有拿到可用的 GPUAdapter。");
  }

  const supportsTimestampQuery = adapter.features.has("timestamp-query");
  let device: GPUDevice;
  let timestampQueryEnabled = supportsTimestampQuery;

  try {
    device = await adapter.requestDevice({
      requiredFeatures: supportsTimestampQuery ? ["timestamp-query"] : [],
    });
  } catch {
    device = await adapter.requestDevice();
    timestampQueryEnabled = false;
  }

  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("没有拿到 WebGPUCanvasContext。");
  }

  const format = navigator.gpu.getPreferredCanvasFormat();

  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
  };

  resize();

  return {
    device,
    context,
    format,
    resize,
    supportsTimestampQuery: timestampQueryEnabled,
  };
}

/**
 * 按当前指标状态更新 HUD 文案和条形图。
 * @param {QueryHudRefs} refs HUD 里要更新的 DOM 引用。
 * @param {MetricState} metrics 当前 CPU / GPU / occlusion 指标。
 * @param {boolean} supportsTimestampQuery 当前设备是否真正启用了 timestamp-query。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(
  refs: QueryHudRefs,
  metrics: MetricState,
  supportsTimestampQuery: boolean
): void {
  refs.timestampBadge.textContent = supportsTimestampQuery
    ? "timestamp-query · 已启用"
    : "timestamp-query · 当前适配器不支持";
  refs.timestampBadge.className = supportsTimestampQuery
    ? "query-badge query-badge--ok"
    : "query-badge query-badge--warn";

  refs.occlusionBadge.textContent = "occlusion query · 同步统计可见采样";
  refs.occlusionBadge.className = "query-badge query-badge--cool";

  refs.samplingBadge.textContent = metrics.pending
    ? "query 采样中..."
    : `query 每 ${QUERY_SAMPLE_INTERVAL.toFixed(2)} 秒采一轮`;
  refs.samplingBadge.className = metrics.pending
    ? "query-badge query-badge--accent"
    : "query-badge";

  refs.cpuValue.textContent = metrics.hasCpuMetric
    ? formatMilliseconds(metrics.cpuMs)
    : "等待首帧";
  refs.cpuMeta.textContent = "CPU 侧：编码命令与 queue.submit 的滑动平均。";

  refs.gpuValue.textContent = supportsTimestampQuery
    ? formatMilliseconds(metrics.gpuMs)
    : "未启用";
  refs.gpuMeta.textContent = supportsTimestampQuery
    ? metrics.pending
      ? "GPU 侧：正在读取这一轮 render pass 的时间戳。"
      : "GPU 侧：同一 render pass 在 GPU 时间线上的真实跨度。"
    : "当前环境缺少 timestamp-query，所以这里只保留 CPU 与 occlusion。";

  refs.visibleValue.textContent = formatSampleCount(metrics.visibleSamples);
  refs.visibleMeta.textContent =
    metrics.visibleSamples === null
      ? "青色探针还没拿到结果。"
      : metrics.visibleSamples > 0
        ? "青色探针有片元真正通过深度测试。"
        : "青色探针这一轮没有留下可见采样。";
  refs.visibleFill.style.width = `${sampleFillPercent(metrics.visibleSamples)}%`;

  refs.hiddenValue.textContent = formatSampleCount(metrics.hiddenSamples);
  refs.hiddenMeta.textContent =
    metrics.hiddenSamples === null
      ? "琥珀探针还没拿到结果。"
      : metrics.hiddenSamples > 0
        ? "琥珀探针已经从墙后露出来了。"
        : "琥珀探针当前仍被遮挡墙完全挡住。";
  refs.hiddenFill.style.width = `${sampleFillPercent(metrics.hiddenSamples)}%`;

  refs.legendBody.textContent =
    metrics.hiddenSamples !== null && metrics.hiddenSamples > 0
      ? "现在从侧面已经能看见墙后的琥珀探针了，occlusion query 也会从 0 变成非零。"
      : "默认视角里，青色探针始终在墙外，琥珀探针躲在墙后。拖动相机绕到侧面时，右侧这项会先于肉眼形成稳定证据。";
}

/**
 * 挂载第 39 课“GPU Query 与性能测量”，把 timestamp query、occlusion query 和 CPU/GPU 时间区别放进同一个场景。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步 lesson 当前状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源。
 */
export async function mountGpuQueriesAndProfilingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--query">
      <div class="query-hud">
        <div class="query-hud__badges">
          <span class="query-badge" data-query-badge="timestamp"></span>
          <span class="query-badge" data-query-badge="occlusion"></span>
          <span class="query-badge" data-query-badge="sampling"></span>
        </div>
        <div class="preview-frame query-hud__frame">
          <canvas class="preview-canvas" aria-label="GPU queries and profiling lesson preview"></canvas>
        </div>
        <div class="query-grid">
          <article class="query-card">
            <p class="query-card__label">CPU 提交时间</p>
            <strong class="query-card__value" data-query-value="cpu"></strong>
            <p class="query-card__meta" data-query-meta="cpu"></p>
          </article>
          <article class="query-card">
            <p class="query-card__label">GPU pass 时间</p>
            <strong class="query-card__value" data-query-value="gpu"></strong>
            <p class="query-card__meta" data-query-meta="gpu"></p>
          </article>
          <article class="query-card query-card--cool">
            <p class="query-card__label">青色探针可见采样</p>
            <strong class="query-card__value" data-query-value="visible"></strong>
            <div class="query-bar">
              <span class="query-bar__fill query-bar__fill--cool" data-query-fill="visible"></span>
            </div>
            <p class="query-card__meta" data-query-meta="visible"></p>
          </article>
          <article class="query-card query-card--warm">
            <p class="query-card__label">琥珀探针可见采样</p>
            <strong class="query-card__value" data-query-value="hidden"></strong>
            <div class="query-bar">
              <span class="query-bar__fill query-bar__fill--warm" data-query-fill="hidden"></span>
            </div>
            <p class="query-card__meta" data-query-meta="hidden"></p>
          </article>
        </div>
        <div class="query-hud__legend">
          <p class="query-hud__legend-title">当前实验</p>
          <p class="query-hud__legend-body" data-query-legend-body></p>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const viewport = host.querySelector<HTMLDivElement>(".preview-viewport");
  if (!canvas) {
    throw new Error("预览 canvas 没有创建成功。");
  }
  if (!viewport) {
    throw new Error("预览视口没有创建成功。");
  }

  const hudRefs: QueryHudRefs = {
    timestampBadge: host.querySelector<HTMLElement>('[data-query-badge="timestamp"]')!,
    occlusionBadge: host.querySelector<HTMLElement>('[data-query-badge="occlusion"]')!,
    samplingBadge: host.querySelector<HTMLElement>('[data-query-badge="sampling"]')!,
    cpuValue: host.querySelector<HTMLElement>('[data-query-value="cpu"]')!,
    cpuMeta: host.querySelector<HTMLElement>('[data-query-meta="cpu"]')!,
    gpuValue: host.querySelector<HTMLElement>('[data-query-value="gpu"]')!,
    gpuMeta: host.querySelector<HTMLElement>('[data-query-meta="gpu"]')!,
    visibleValue: host.querySelector<HTMLElement>('[data-query-value="visible"]')!,
    visibleMeta: host.querySelector<HTMLElement>('[data-query-meta="visible"]')!,
    visibleFill: host.querySelector<HTMLElement>('[data-query-fill="visible"]')!,
    hiddenValue: host.querySelector<HTMLElement>('[data-query-value="hidden"]')!,
    hiddenMeta: host.querySelector<HTMLElement>('[data-query-meta="hidden"]')!,
    hiddenFill: host.querySelector<HTMLElement>('[data-query-fill="hidden"]')!,
    legendBody: host.querySelector<HTMLElement>("[data-query-legend-body]")!,
  };

  const depthTarget: DepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };

  const metrics: MetricState = {
    cpuMs: 0,
    hasCpuMetric: false,
    gpuMs: null,
    visibleSamples: null,
    hiddenSamples: null,
    pending: false,
  };

  try {
    const gpu = await createQueryWebGpuCanvas(canvas);
    updateHud(hudRefs, metrics, gpu.supportsTimestampQuery);

    const syncViewport = () => {
      // 39 课已经把 HUD 放到画布外面了，这里不再需要把整块 lesson
      // 压成固定宽高比；直接占满可用预览区，才能给真正的画面框留下稳定高度。
      viewport.style.width = "100%";
      viewport.style.height = "100%";
    };

    syncViewport();

    const geometry = createQueryLessonGeometry();

    const vertexBuffer = gpu.device.createBuffer({
      size: geometry.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(vertexBuffer, 0, geometry.vertexData);

    const indexBuffer = gpu.device.createBuffer({
      size: geometry.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(indexBuffer, 0, geometry.indexData);

    const objectBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const sceneBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-39-query-scene",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [objectBindGroupLayout, sceneBindGroupLayout],
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: vertexShaderSource }),
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 3 * 4, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: fragmentShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const sceneUniformBuffer = gpu.device.createBuffer({
      size: 12 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const sceneBindGroup = gpu.device.createBindGroup({
      layout: sceneBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: sceneUniformBuffer } }],
    });

    const sceneObjects: SceneObjectConfig[] = [
      {
        label: "floor",
        translation: [0, -1.25, 0],
        rotationY: 0,
        scale: [6.2, 0.25, 6.2],
        color: [0.18, 0.22, 0.28, 1],
      },
      {
        label: "wall",
        translation: [0, 0.35, -0.95],
        rotationY: 0,
        scale: [2.15, 2.05, 0.5],
        color: [0.33, 0.38, 0.47, 1],
      },
      {
        label: "visible-probe",
        translation: [-2.75, -0.1, 0.8],
        rotationY: 0.25,
        scale: [0.68, 1.2, 0.68],
        color: [0.30, 0.80, 1.0, 1],
        queryIndex: 0,
      },
      {
        label: "hidden-probe",
        translation: [0.0, -0.1, -3.05],
        rotationY: -0.18,
        scale: [0.68, 1.2, 0.68],
        color: [1.0, 0.67, 0.28, 1],
        queryIndex: 1,
      },
      {
        label: "front-left",
        translation: [-3.1, -0.35, 2.2],
        rotationY: 0.4,
        scale: [0.7, 0.9, 0.7],
        color: [0.53, 0.82, 0.40, 1],
      },
      {
        label: "front-right",
        translation: [2.8, -0.3, 2.4],
        rotationY: -0.55,
        scale: [0.95, 1.05, 0.95],
        color: [0.52, 0.44, 0.86, 1],
      },
      {
        label: "rear-left-a",
        translation: [-3.6, 0.0, -2.9],
        rotationY: 0.18,
        scale: [0.6, 1.25, 0.6],
        color: [0.94, 0.42, 0.30, 1],
      },
      {
        label: "rear-left-b",
        translation: [-2.3, -0.35, -3.9],
        rotationY: 0.7,
        scale: [0.72, 0.9, 0.72],
        color: [0.22, 0.66, 0.92, 1],
      },
      {
        label: "rear-right-a",
        translation: [2.4, 0.05, -3.5],
        rotationY: -0.42,
        scale: [0.85, 1.35, 0.85],
        color: [0.96, 0.85, 0.36, 1],
      },
      {
        label: "rear-right-b",
        translation: [3.5, -0.35, -2.1],
        rotationY: 0.3,
        scale: [0.65, 0.9, 0.65],
        color: [0.34, 0.79, 0.58, 1],
      },
      {
        label: "center-left",
        translation: [-1.3, -0.45, -0.15],
        rotationY: -0.22,
        scale: [0.55, 0.75, 0.55],
        color: [0.99, 0.62, 0.42, 1],
      },
      {
        label: "center-right",
        translation: [1.55, -0.4, 0.35],
        rotationY: 0.55,
        scale: [0.62, 0.82, 0.62],
        color: [0.34, 0.74, 0.96, 1],
      },
    ];

    const renderObjects: RenderObject[] = sceneObjects.map((config) => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 36 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = gpu.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });

      return {
        config,
        uniformBuffer,
        bindGroup,
        modelMatrix: createModelMatrix(config),
      };
    });

    const occlusionQuerySet = gpu.device.createQuerySet({
      type: "occlusion",
      count: 2,
    });
    const occlusionResolveBuffer = gpu.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    const occlusionReadbackBuffer = gpu.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const timestampQuerySet = gpu.supportsTimestampQuery
      ? gpu.device.createQuerySet({
          type: "timestamp",
          count: 2,
        })
      : null;
    const timestampResolveBuffer =
      gpu.supportsTimestampQuery && timestampQuerySet
        ? gpu.device.createBuffer({
            size: 256,
            usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
          })
        : null;
    const timestampReadbackBuffer =
      gpu.supportsTimestampQuery && timestampQuerySet
        ? gpu.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
          })
        : null;

    const ensureDepthTarget = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (depthTarget.view && depthTarget.width === width && depthTarget.height === height) {
        return depthTarget.view;
      }

      destroyDepthTarget(depthTarget);

      depthTarget.texture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTarget.view = depthTarget.texture.createView();
      depthTarget.width = width;
      depthTarget.height = height;

      return depthTarget.view;
    };

    const orbitCamera = createOrbitCameraController(canvas, {
      eye: [0.45, 4.5, 9.4],
      target: [0, 0.35, -1.15],
      up: [0, 1, 0],
      minRadius: 5.5,
      maxRadius: 16,
      rotateSpeed: 0.01,
      zoomSpeed: 0.0035,
      onChange: () => render(performance.now()),
    });

    let animationFrameId = 0;
    let disposed = false;
    let lastQuerySampleTime = -QUERY_SAMPLE_INTERVAL;

    const readQueryResults = async () => {
      try {
        let nextGpuMs = metrics.gpuMs;

        if (timestampReadbackBuffer) {
          await timestampReadbackBuffer.mapAsync(GPUMapMode.READ);
          const timestampRange = timestampReadbackBuffer.getMappedRange();
          const timestampValues = new BigUint64Array(timestampRange.slice(0));
          timestampReadbackBuffer.unmap();

          if (timestampValues.length >= 2) {
            const delta = Number(timestampValues[1] - timestampValues[0]) / 1_000_000;
            nextGpuMs = Number.isFinite(delta) ? delta : null;
          }
        }

        await occlusionReadbackBuffer.mapAsync(GPUMapMode.READ);
        const occlusionRange = occlusionReadbackBuffer.getMappedRange();
        const occlusionValues = new BigUint64Array(occlusionRange.slice(0));
        occlusionReadbackBuffer.unmap();

        if (disposed) {
          return;
        }

        metrics.gpuMs = nextGpuMs;
        metrics.visibleSamples = Number(occlusionValues[0] ?? 0n);
        metrics.hiddenSamples = Number(occlusionValues[1] ?? 0n);
      } catch (error) {
        if (!disposed) {
          const message =
            error instanceof Error ? error.message : "读取 query 结果时发生未知错误。";

          setStatus({
            title: "Query 读取失败",
            detail: message,
            tone: "warn",
          });
        }
      } finally {
        if (!disposed) {
          metrics.pending = false;
          updateHud(hudRefs, metrics, gpu.supportsTimestampQuery);
        }
      }
    };

    const render = (timestamp: number) => {
      if (disposed) {
        return;
      }

      syncViewport();
      gpu.resize();

      const depthView = ensureDepthTarget();
      const shouldSampleQueries =
        !metrics.pending &&
        timestamp * 0.001 - lastQuerySampleTime >= QUERY_SAMPLE_INTERVAL;

      if (shouldSampleQueries) {
        lastQuerySampleTime = timestamp * 0.001;
        metrics.pending = true;
        updateHud(hudRefs, metrics, gpu.supportsTimestampQuery);
      }

      const camera = orbitCamera.getSnapshot();
      const aspect = canvas.width / canvas.height;
      const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.4, aspect, 0.1, 100);
      const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);

      const time = timestamp * 0.001;
      const lightPosition: Vector3 = [
        Math.cos(time * 0.65) * 4.7,
        4.4 + Math.sin(time * 0.95) * 0.45,
        Math.sin(time * 0.65) * 4.7 - 0.4,
      ];
      gpu.device.queue.writeBuffer(
        sceneUniformBuffer,
        0,
        createSceneUniformData(lightPosition, camera.eye)
      );

      renderObjects.forEach((object) => {
        const modelViewProjectionMatrix = multiplyMatrices(
          viewProjectionMatrix,
          object.modelMatrix
        );
        const uniformData = createObjectUniformData(
          modelViewProjectionMatrix,
          object.modelMatrix,
          object.config.color
        );
        gpu.device.queue.writeBuffer(object.uniformBuffer, 0, uniformData);
      });

      const cpuStart = performance.now();

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-39-command-encoder",
      });

      const passDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.032, g: 0.058, b: 0.112, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      };

      if (shouldSampleQueries) {
        passDescriptor.occlusionQuerySet = occlusionQuerySet;
        if (timestampQuerySet) {
          passDescriptor.timestampWrites = {
            querySet: timestampQuerySet,
            beginningOfPassWriteIndex: 0,
            endOfPassWriteIndex: 1,
          };
        }
      }

      const pass = commandEncoder.beginRenderPass(passDescriptor);
      pass.setPipeline(renderPipeline);
      pass.setBindGroup(1, sceneBindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");

      renderObjects.forEach((object) => {
        pass.setBindGroup(0, object.bindGroup);

        if (shouldSampleQueries && object.config.queryIndex !== undefined) {
          pass.beginOcclusionQuery(object.config.queryIndex);
        }

        pass.drawIndexed(geometry.indexCount);

        if (shouldSampleQueries && object.config.queryIndex !== undefined) {
          pass.endOcclusionQuery();
        }
      });
      pass.end();

      if (shouldSampleQueries) {
        if (timestampQuerySet && timestampResolveBuffer && timestampReadbackBuffer) {
          commandEncoder.resolveQuerySet(
            timestampQuerySet,
            0,
            2,
            timestampResolveBuffer,
            0
          );
          commandEncoder.copyBufferToBuffer(
            timestampResolveBuffer,
            0,
            timestampReadbackBuffer,
            0,
            16
          );
        }

        commandEncoder.resolveQuerySet(occlusionQuerySet, 0, 2, occlusionResolveBuffer, 0);
        commandEncoder.copyBufferToBuffer(
          occlusionResolveBuffer,
          0,
          occlusionReadbackBuffer,
          0,
          16
        );
      }

      gpu.device.queue.submit([commandEncoder.finish()]);

      const cpuFrameMs = performance.now() - cpuStart;
      metrics.cpuMs = metrics.hasCpuMetric
        ? metrics.cpuMs * (1 - CPU_SMOOTHING) + cpuFrameMs * CPU_SMOOTHING
        : cpuFrameMs;
      metrics.hasCpuMetric = true;
      updateHud(hudRefs, metrics, gpu.supportsTimestampQuery);

      if (shouldSampleQueries) {
        void readQueryResults();
      }
    };

    const frame = (timestamp: number) => {
      render(timestamp);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      destroyDepthTarget(depthTarget);
      render(performance.now());
    });
    resizeObserver.observe(host);

    render(performance.now());
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus(
      gpu.supportsTimestampQuery
        ? {
            title: "GPU Query 已运行",
            detail:
              "拖动相机绕到遮挡墙侧面时，琥珀探针的 occlusion query 会从 0 变成非零；同时 HUD 会周期性显示 CPU 提交时间和 GPU render pass 时间。",
            tone: "ok",
          }
        : {
            title: "GPU Query 已运行（timestamp 未启用）",
            detail:
              "当前适配器没有启用 timestamp-query，所以这节会继续演示 CPU 时间与 occlusion query；如果换到支持时间戳查询的设备，HUD 会同步显示 GPU render pass 时间。",
            tone: "warn",
          }
    );

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitCamera.dispose();
      destroyDepthTarget(depthTarget);
      vertexBuffer.destroy();
      indexBuffer.destroy();
      sceneUniformBuffer.destroy();
      renderObjects.forEach((object) => object.uniformBuffer.destroy());
      occlusionQuerySet.destroy();
      occlusionResolveBuffer.destroy();
      occlusionReadbackBuffer.destroy();
      timestampQuerySet?.destroy();
      timestampResolveBuffer?.destroy();
      timestampReadbackBuffer?.destroy();
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知的 WebGPU 错误。";

    host.innerHTML = `
      <div class="preview-empty">
        <h3>预览不可用</h3>
        <p>${message}</p>
      </div>
    `;

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
