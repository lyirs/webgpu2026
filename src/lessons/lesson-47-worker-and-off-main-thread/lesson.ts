import { createThreadRenderer, type ThreadRenderer } from "@/lessons/lesson-47-worker-and-off-main-thread/renderer";
import {
  createDefaultSharedSettings,
  HUD_UPDATE_INTERVAL_MS,
  MAX_PIXEL_RATIO,
  METRIC_WINDOW_MS,
  type MainToWorkerMessage,
  type SharedRenderSettings,
  type WorkerToMainMessage,
} from "@/lessons/lesson-47-worker-and-off-main-thread/shared";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type FrameSample = {
  timeMs: number;
  frameMs: number;
};

type HudRefs = {
  supportBadge: HTMLElement;
  loadBadge: HTMLElement;
  syncBadge: HTMLElement;
  mainPanelBadge: HTMLElement;
  workerPanelBadge: HTMLElement;
  mainPanelNote: HTMLElement;
  workerPanelNote: HTMLElement;
  mainFrameValue: HTMLElement;
  mainFrameMeta: HTMLElement;
  workerFrameValue: HTMLElement;
  workerFrameMeta: HTMLElement;
  syncValue: HTMLElement;
  syncMeta: HTMLElement;
  versionValue: HTMLElement;
  versionMeta: HTMLElement;
  legendBody: HTMLElement;
  workerFallback: HTMLElement;
  busyOutput: HTMLElement;
  spinOutput: HTMLElement;
  radiusOutput: HTMLElement;
};

type MetricsState = {
  busyMs: number;
  burstCount: number;
  mainFrameMs: number | null;
  workerFrameMs: number | null;
  lastSyncLatencyMs: number | null;
  currentSettingsVersion: number;
  workerSettingsVersion: number;
  workerMessages: number;
  mainPixelWidth: number;
  mainPixelHeight: number;
  workerPixelWidth: number;
  workerPixelHeight: number;
  workerAvailable: boolean;
  workerReady: boolean;
  workerUsesRaf: boolean;
  workerErrorMessage: string | null;
};

type CanvasMeasurement = {
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
};

const BURST_BLOCK_MS = 180;

/**
 * 把主线程滑杆上的额外工作时间格式化成短文本。
 * @param {number} value 当前每帧额外工作时间。
 * @returns {string} 对应的展示文本。
 */
function formatBusyMilliseconds(value: number): string {
  return `${value.toFixed(0)} ms`;
}

/**
 * 把一个倍率格式化成适合滑杆旁展示的文本。
 * @param {number} value 当前倍率。
 * @returns {string} 对应的展示文本。
 */
function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}x`;
}

/**
 * 把一个距离值格式化成短文本。
 * @param {number} value 当前相机半径。
 * @returns {string} 对应的展示文本。
 */
function formatDistance(value: number): string {
  return `${value.toFixed(1)}`;
}

/**
 * 把像素尺寸格式化成更适合 HUD 的字符串。
 * @param {number} width 当前宽度。
 * @param {number} height 当前高度。
 * @returns {string} 对应的尺寸文本。
 */
function formatSize(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    return "等待 resize";
  }

  return `${new Intl.NumberFormat("zh-CN").format(width)} × ${new Intl.NumberFormat("zh-CN").format(height)}`;
}

/**
 * 把毫秒值格式化成适合 HUD 展示的文本。
 * @param {number | null} value 当前毫秒值。
 * @param {string} fallback 没有采样时显示的占位文本。
 * @returns {string} 对应的 HUD 文本。
 */
function formatMilliseconds(value: number | null, fallback: string): string {
  if (value === null || !Number.isFinite(value)) {
    return fallback;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ms`;
}

/**
 * 把当前版本号格式化成更适合卡片展示的文本。
 * @param {number} value 当前版本号。
 * @returns {string} 对应的版本字符串。
 */
function formatVersion(value: number): string {
  return `v${value}`;
}

/**
 * 在主线程主动做一小段忙等，用来模拟 UI、布局或业务逻辑把渲染循环拖慢。
 * @param {number} durationMs 目标阻塞时长。
 * @returns {void} 只占用主线程时间，不返回额外结果。
 */
function blockMainThread(durationMs: number): void {
  const startTimeMs = performance.now();
  while (performance.now() - startTimeMs < durationMs) {
    // busy loop
  }
}

/**
 * 把一帧 frame interval 推进固定窗口，并回写当前窗口的平均值。
 * @param {FrameSample[]} samples 最近一段时间的帧间隔采样。
 * @param {number} timeMs 当前采样时刻。
 * @param {number} frameMs 当前帧间隔。
 * @returns {number} 最近窗口内的平均 frame interval。
 */
function recordFrameSample(
  samples: FrameSample[],
  timeMs: number,
  frameMs: number
): number {
  samples.push({ timeMs, frameMs });

  const cutoffTimeMs = timeMs - METRIC_WINDOW_MS;
  while (samples.length > 0 && samples[0].timeMs < cutoffTimeMs) {
    samples.shift();
  }

  let total = 0;
  for (const sample of samples) {
    total += sample.frameMs;
  }

  return total / Math.max(1, samples.length);
}

/**
 * 读取当前 canvas 的 CSS 尺寸和像素比，供主线程和 worker 统一 resize。
 * @param {HTMLCanvasElement} canvas 要测量的画布元素。
 * @returns {CanvasMeasurement} 对应的 CSS 尺寸与 DPR。
 */
function measureCanvas(canvas: HTMLCanvasElement): CanvasMeasurement {
  const rect = canvas.getBoundingClientRect();
  return {
    cssWidth: Math.max(1, rect.width),
    cssHeight: Math.max(1, rect.height),
    pixelRatio: Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
  };
}

/**
 * 根据当前主线程负载和两侧 frame interval，生成更贴近这节课讲解重点的文案。
 * @param {MetricsState} metrics 当前 HUD 指标状态。
 * @returns {string} 对应的总结说明。
 */
function createLegendCopy(metrics: MetricsState): string {
  if (!metrics.workerAvailable) {
    return "当前环境没有把右侧画布真正交给 worker，所以这节课先退化成“主线程渲染 + 概念提示”。真正的重点是：一旦 OffscreenCanvas 能转移出去，render loop 和页面逻辑就不必继续挤在同一个线程。";
  }

  if (!metrics.workerReady) {
    return "左侧已经开始在主线程里渲染，右侧正在初始化 worker。等 worker 拿到 OffscreenCanvas 以后，主线程就只负责 UI、resize 和参数同步，render loop 会独立跑在另一条线程里。";
  }

  if (
    metrics.busyMs >= 8 &&
    metrics.mainFrameMs !== null &&
    metrics.workerFrameMs !== null &&
    metrics.workerFrameMs < metrics.mainFrameMs * 0.86
  ) {
    return `当前主线程每帧额外承担 ${formatBusyMilliseconds(metrics.busyMs)} 的工作时，左侧主线程 render loop 的平均帧间隔已经拉到 ${formatMilliseconds(metrics.mainFrameMs, "—")}，而右侧 worker 仍维持在 ${formatMilliseconds(metrics.workerFrameMs, "—")} 左右。worker 并不是“渲染更快”本身，而是把渲染和页面逻辑隔离开了。`;
  }

  return `当前负载下，两侧 frame interval 还比较接近。这里更值得注意的是边界变化：右侧 canvas 已经通过 OffscreenCanvas 交给 worker，主线程只发送 settings / resize；最近一次同步延迟约 ${formatMilliseconds(metrics.lastSyncLatencyMs, "等待消息")}，这就是离主线程渲染真正要管理的新成本。`;
}

/**
 * 根据当前指标状态更新 HUD、面板说明和控制旁边的数值文本。
 * @param {HudRefs} refs 当前 lesson 用到的 DOM 引用。
 * @param {MetricsState} metrics 当前指标状态。
 * @param {SharedRenderSettings} settings 当前共享动画参数。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(
  refs: HudRefs,
  metrics: MetricsState,
  settings: SharedRenderSettings
): void {
  refs.busyOutput.textContent = formatBusyMilliseconds(metrics.busyMs);
  refs.spinOutput.textContent = formatMultiplier(settings.spinSpeed);
  refs.radiusOutput.textContent = formatDistance(settings.cameraRadius);

  refs.supportBadge.textContent = metrics.workerAvailable
    ? metrics.workerReady
      ? "OffscreenCanvas · 已转移到 worker"
      : "OffscreenCanvas · worker 初始化中"
    : "Worker 路径 · 当前环境不可用";
  refs.supportBadge.className = metrics.workerAvailable
    ? metrics.workerReady
      ? "worker-badge worker-badge--ok"
      : "worker-badge worker-badge--cool"
    : "worker-badge worker-badge--warn";

  refs.loadBadge.textContent = `主线程额外工作 · ${formatBusyMilliseconds(metrics.busyMs)} / frame`;
  refs.loadBadge.className =
    metrics.busyMs >= 8 ? "worker-badge worker-badge--warn" : "worker-badge worker-badge--accent";

  refs.syncBadge.textContent = metrics.workerAvailable
    ? `同步版本 · ${formatVersion(metrics.currentSettingsVersion)} → ${formatVersion(metrics.workerSettingsVersion)}`
    : "同步版本 · worker 不可用";
  refs.syncBadge.className =
    metrics.workerReady && metrics.workerSettingsVersion === metrics.currentSettingsVersion
      ? "worker-badge worker-badge--cool"
      : "worker-badge";

  refs.mainPanelBadge.textContent = "requestAnimationFrame · 主线程";
  refs.mainPanelBadge.className = "worker-panel__badge worker-panel__badge--warn";
  refs.mainPanelNote.textContent = `左侧的 UI、事件和 render loop 都挤在 window 线程里；当前绘制像素尺寸是 ${formatSize(metrics.mainPixelWidth, metrics.mainPixelHeight)}。`;

  refs.workerPanelBadge.textContent = metrics.workerAvailable
    ? metrics.workerUsesRaf
      ? "requestAnimationFrame · worker"
      : "setTimeout 回退 · worker"
    : "worker 路径不可用";
  refs.workerPanelBadge.className = metrics.workerAvailable
    ? "worker-panel__badge worker-panel__badge--ok"
    : "worker-panel__badge worker-panel__badge--warn";

  refs.workerPanelNote.textContent = metrics.workerAvailable
    ? `主线程现在只通过 postMessage 发送 resize 和 settings；右侧像素尺寸 ${formatSize(metrics.workerPixelWidth, metrics.workerPixelHeight)}，最近一次同步延迟 ${formatMilliseconds(metrics.lastSyncLatencyMs, "等待首条")}。`
    : metrics.workerErrorMessage ??
      "当前浏览器没有提供可转移的 OffscreenCanvas 或 worker 内的 WebGPU。";

  refs.mainFrameValue.textContent = formatMilliseconds(metrics.mainFrameMs, "等待采样");
  refs.mainFrameMeta.textContent =
    metrics.mainFrameMs === null
      ? "左侧：window 线程刚开始渲染，还没有积累足够的 frame interval 样本。"
      : `左侧：最近 ${(METRIC_WINDOW_MS / 1000).toFixed(1)} 秒窗口内，主线程 render loop 的平均帧间隔。`;

  refs.workerFrameValue.textContent = metrics.workerAvailable
    ? formatMilliseconds(metrics.workerFrameMs, metrics.workerReady ? "等待采样" : "初始化中")
    : "不可用";
  refs.workerFrameMeta.textContent = metrics.workerAvailable
    ? metrics.workerFrameMs === null
      ? "右侧：worker 已接管 canvas，但还在积累自己的帧间隔样本。"
      : `右侧：worker 自己上报的平均帧间隔；页面主线程再忙，也不会直接阻塞这条 render loop。`
    : "右侧：当前环境没有真正跑起 worker 渲染路径。";

  refs.syncValue.textContent = metrics.workerAvailable
    ? formatMilliseconds(metrics.lastSyncLatencyMs, "等待消息")
    : "不可用";
  refs.syncMeta.textContent = metrics.workerAvailable
    ? "这里统计的是最近一次 settings / resize 从主线程送到 worker 并被处理的延迟。"
    : "没有 worker 时，自然也不会有跨线程同步延迟。";

  refs.versionValue.textContent = metrics.workerAvailable
    ? formatVersion(metrics.workerSettingsVersion)
    : "—";
  refs.versionMeta.textContent = metrics.workerAvailable
    ? `主线程当前已经发到 ${formatVersion(metrics.currentSettingsVersion)}；worker 已累计处理 ${metrics.workerMessages} 条消息。`
    : "这个版本号本来用来观察 postMessage 同步是否追上主线程。";

  refs.legendBody.textContent = createLegendCopy(metrics);
  refs.workerFallback.hidden = metrics.workerAvailable;
}

/**
 * 挂载第 42 课“Worker 与离主线程渲染”，
 * 把主线程渲染、OffscreenCanvas 转移和消息同步放进一个真实对照实验。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 worker。
 */
export async function mountWorkerAndOffMainThreadLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--worker-thread">
      <div class="preview-frame">
        <div class="worker-stage">
          <div class="worker-stage__badges">
            <span class="worker-badge" data-worker-badge="support"></span>
            <span class="worker-badge" data-worker-badge="load"></span>
            <span class="worker-badge" data-worker-badge="sync"></span>
          </div>

          <div class="worker-controls">
            <label class="worker-control">
              <span class="worker-control__row">
                <span class="worker-control__label">主线程额外工作</span>
                <span class="worker-control__value" data-worker-control-output="busy"></span>
              </span>
              <input class="worker-control__range" data-worker-control="busy" type="range" min="0" max="18" step="1" value="0" />
            </label>

            <label class="worker-control">
              <span class="worker-control__row">
                <span class="worker-control__label">共享转速</span>
                <span class="worker-control__value" data-worker-control-output="spin"></span>
              </span>
              <input class="worker-control__range" data-worker-control="spin" type="range" min="0.55" max="1.9" step="0.05" value="1.1" />
            </label>

            <label class="worker-control">
              <span class="worker-control__row">
                <span class="worker-control__label">共享相机半径</span>
                <span class="worker-control__value" data-worker-control-output="radius"></span>
              </span>
              <input class="worker-control__range" data-worker-control="radius" type="range" min="5.4" max="8.4" step="0.1" value="6.8" />
            </label>

            <button class="worker-burst-button" data-worker-control="burst" type="button">
              阻塞主线程 ${BURST_BLOCK_MS}ms
            </button>
          </div>

          <div class="worker-grid">
            <section class="worker-panel worker-panel--main">
              <div class="worker-panel__header">
                <div>
                  <p class="worker-panel__eyebrow">Main Thread</p>
                  <h3 class="worker-panel__title">渲染、UI 与业务逻辑在同一条线程</h3>
                  <p class="worker-panel__copy">拖高上面的负载滑杆以后，这一侧的 requestAnimationFrame 会最先被拖慢。</p>
                </div>
                <span class="worker-panel__badge" data-worker-panel-badge="main"></span>
              </div>
              <div class="worker-panel__canvas-shell">
                <canvas class="worker-panel__canvas" data-worker-canvas="main"></canvas>
              </div>
              <p class="worker-panel__note" data-worker-panel-note="main"></p>
            </section>

            <section class="worker-panel worker-panel--worker">
              <div class="worker-panel__header">
                <div>
                  <p class="worker-panel__eyebrow">Worker + OffscreenCanvas</p>
                  <h3 class="worker-panel__title">右侧画布被转交给另一条渲染线程</h3>
                  <p class="worker-panel__copy">主线程只同步参数和 resize；worker 自己维护 render loop 与 GPU 资源。</p>
                </div>
                <span class="worker-panel__badge" data-worker-panel-badge="worker"></span>
              </div>
              <div class="worker-panel__canvas-shell">
                <canvas class="worker-panel__canvas" data-worker-canvas="worker"></canvas>
                <div class="worker-panel__fallback" data-worker-fallback hidden></div>
              </div>
              <p class="worker-panel__note" data-worker-panel-note="worker"></p>
            </section>
          </div>

          <div class="worker-card-grid">
            <article class="worker-card worker-card--warn">
              <p class="worker-card__label">主线程帧间隔</p>
              <strong class="worker-card__value" data-worker-card-value="main-frame"></strong>
              <p class="worker-card__meta" data-worker-card-meta="main-frame"></p>
            </article>

            <article class="worker-card worker-card--cool">
              <p class="worker-card__label">Worker 帧间隔</p>
              <strong class="worker-card__value" data-worker-card-value="worker-frame"></strong>
              <p class="worker-card__meta" data-worker-card-meta="worker-frame"></p>
            </article>

            <article class="worker-card worker-card--accent">
              <p class="worker-card__label">同步延迟</p>
              <strong class="worker-card__value" data-worker-card-value="sync"></strong>
              <p class="worker-card__meta" data-worker-card-meta="sync"></p>
            </article>

            <article class="worker-card">
              <p class="worker-card__label">Worker 已同步版本</p>
              <strong class="worker-card__value" data-worker-card-value="version"></strong>
              <p class="worker-card__meta" data-worker-card-meta="version"></p>
            </article>
          </div>

          <div class="worker-stage__legend">
            <p class="worker-stage__legend-title">当前实验</p>
            <p class="worker-stage__legend-body" data-worker-legend></p>
          </div>
        </div>
      </div>
    </div>
  `;

  const supportBadge = host.querySelector<HTMLElement>('[data-worker-badge="support"]');
  const loadBadge = host.querySelector<HTMLElement>('[data-worker-badge="load"]');
  const syncBadge = host.querySelector<HTMLElement>('[data-worker-badge="sync"]');
  const mainPanelBadge = host.querySelector<HTMLElement>('[data-worker-panel-badge="main"]');
  const workerPanelBadge = host.querySelector<HTMLElement>('[data-worker-panel-badge="worker"]');
  const mainPanelNote = host.querySelector<HTMLElement>('[data-worker-panel-note="main"]');
  const workerPanelNote = host.querySelector<HTMLElement>('[data-worker-panel-note="worker"]');
  const mainFrameValue = host.querySelector<HTMLElement>('[data-worker-card-value="main-frame"]');
  const mainFrameMeta = host.querySelector<HTMLElement>('[data-worker-card-meta="main-frame"]');
  const workerFrameValue = host.querySelector<HTMLElement>('[data-worker-card-value="worker-frame"]');
  const workerFrameMeta = host.querySelector<HTMLElement>('[data-worker-card-meta="worker-frame"]');
  const syncValue = host.querySelector<HTMLElement>('[data-worker-card-value="sync"]');
  const syncMeta = host.querySelector<HTMLElement>('[data-worker-card-meta="sync"]');
  const versionValue = host.querySelector<HTMLElement>('[data-worker-card-value="version"]');
  const versionMeta = host.querySelector<HTMLElement>('[data-worker-card-meta="version"]');
  const legendBody = host.querySelector<HTMLElement>("[data-worker-legend]");
  const workerFallback = host.querySelector<HTMLElement>("[data-worker-fallback]");
  const busyOutput = host.querySelector<HTMLElement>('[data-worker-control-output="busy"]');
  const spinOutput = host.querySelector<HTMLElement>('[data-worker-control-output="spin"]');
  const radiusOutput = host.querySelector<HTMLElement>('[data-worker-control-output="radius"]');
  const mainCanvas = host.querySelector<HTMLCanvasElement>('[data-worker-canvas="main"]');
  const workerCanvas = host.querySelector<HTMLCanvasElement>('[data-worker-canvas="worker"]');
  const busyRange = host.querySelector<HTMLInputElement>('[data-worker-control="busy"]');
  const spinRange = host.querySelector<HTMLInputElement>('[data-worker-control="spin"]');
  const radiusRange = host.querySelector<HTMLInputElement>('[data-worker-control="radius"]');
  const burstButton = host.querySelector<HTMLButtonElement>('[data-worker-control="burst"]');

  if (
    !supportBadge ||
    !loadBadge ||
    !syncBadge ||
    !mainPanelBadge ||
    !workerPanelBadge ||
    !mainPanelNote ||
    !workerPanelNote ||
    !mainFrameValue ||
    !mainFrameMeta ||
    !workerFrameValue ||
    !workerFrameMeta ||
    !syncValue ||
    !syncMeta ||
    !versionValue ||
    !versionMeta ||
    !legendBody ||
    !workerFallback ||
    !busyOutput ||
    !spinOutput ||
    !radiusOutput ||
    !mainCanvas ||
    !workerCanvas ||
    !busyRange ||
    !spinRange ||
    !radiusRange ||
    !burstButton
  ) {
    setStatus({
      title: "预览不可用",
      detail: "第 42 课的 DOM 结构没有完整挂载出来。",
      tone: "warn",
    });
    return;
  }

  const refs: HudRefs = {
    supportBadge,
    loadBadge,
    syncBadge,
    mainPanelBadge,
    workerPanelBadge,
    mainPanelNote,
    workerPanelNote,
    mainFrameValue,
    mainFrameMeta,
    workerFrameValue,
    workerFrameMeta,
    syncValue,
    syncMeta,
    versionValue,
    versionMeta,
    legendBody,
    workerFallback,
    busyOutput,
    spinOutput,
    radiusOutput,
  };

  const sharedSettings = createDefaultSharedSettings();
  const metrics: MetricsState = {
    busyMs: 0,
    burstCount: 0,
    mainFrameMs: null,
    workerFrameMs: null,
    lastSyncLatencyMs: null,
    currentSettingsVersion: sharedSettings.version,
    workerSettingsVersion: 0,
    workerMessages: 0,
    mainPixelWidth: 0,
    mainPixelHeight: 0,
    workerPixelWidth: 0,
    workerPixelHeight: 0,
    workerAvailable: false,
    workerReady: false,
    workerUsesRaf: false,
    workerErrorMessage: null,
  };

  const mainFrameSamples: FrameSample[] = [];
  let mainRenderer: ThreadRenderer | null = null;
  let worker: Worker | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let animationFrameId = 0;
  let disposed = false;
  let lastMainFrameTimeMs: number | null = null;
  let lastHudUpdateTimeMs = 0;
  let pendingBurstMs = 0;
  let lastObservedPixelRatio = measureCanvas(mainCanvas).pixelRatio;

  /**
   * 立刻按当前状态把 HUD 刷一遍，避免等待下一个节流周期。
   * @returns {void} 只更新界面，不返回额外结果。
   */
  const flushHud = () => {
    updateHud(refs, metrics, sharedSettings);
    lastHudUpdateTimeMs = performance.now();
  };

  /**
   * 给右侧 worker 发一条协议消息；如果 worker 还没起好，就静默跳过。
   * @param {MainToWorkerMessage} message 要发送的协议消息。
   * @param {Transferable[]} transferables 需要一起转移所有权的对象列表。
   * @returns {void} 只负责发消息，不返回额外结果。
   */
  const sendWorkerMessage = (
    message: MainToWorkerMessage,
    transferables: Transferable[] = []
  ): void => {
    if (!worker) {
      return;
    }

    worker.postMessage(message, transferables);
  };

  /**
   * 把共享设置版本号往前推进一格，并同步给 worker。
   * @param {Partial<Pick<SharedRenderSettings, "spinSpeed" | "cameraRadius">>} patch 本次要改的共享参数。
   * @returns {void} 只更新状态并发消息，不返回额外结果。
   */
  const applySharedSettings = (
    patch: Partial<Pick<SharedRenderSettings, "spinSpeed" | "cameraRadius">>
  ): void => {
    sharedSettings.spinSpeed = patch.spinSpeed ?? sharedSettings.spinSpeed;
    sharedSettings.cameraRadius = patch.cameraRadius ?? sharedSettings.cameraRadius;
    sharedSettings.version += 1;
    metrics.currentSettingsVersion = sharedSettings.version;
    sendWorkerMessage({
      type: "settings",
      settings: { ...sharedSettings },
      sentAtMs: performance.now(),
    });
    flushHud();
  };

  /**
   * 按当前 DOM 尺寸同步左侧主线程画布。
   * @returns {void} 只更新左侧 renderer 的尺寸。
   */
  const syncMainCanvasSize = (): void => {
    if (!mainRenderer) {
      return;
    }

    mainRenderer.resize(measureCanvas(mainCanvas));
    metrics.mainPixelWidth = mainRenderer.pixelWidth;
    metrics.mainPixelHeight = mainRenderer.pixelHeight;
  };

  /**
   * 按当前 DOM 尺寸给右侧 worker 发 resize 消息。
   * @returns {void} 只负责同步 worker 画布尺寸，不返回额外结果。
   */
  const syncWorkerCanvasSize = (): void => {
    if (!worker || !metrics.workerAvailable) {
      return;
    }

    const measurement = measureCanvas(workerCanvas);
    sendWorkerMessage({
      type: "resize",
      cssWidth: measurement.cssWidth,
      cssHeight: measurement.cssHeight,
      pixelRatio: measurement.pixelRatio,
      sentAtMs: performance.now(),
    });
  };

  /**
   * 当主线程和 worker 的 DOM 尺寸变化，或 DPR 变化时，一次性重同步两边画布。
   * @returns {void} 只更新尺寸和 HUD，不返回额外结果。
   */
  const syncAllCanvasSizes = (): void => {
    syncMainCanvasSize();
    syncWorkerCanvasSize();
    flushHud();
  };

  /**
   * 处理 worker 回发的 ready / sync / metrics / error 消息。
   * @param {MessageEvent<WorkerToMainMessage>} event worker 的协议消息事件。
   * @returns {void} 只更新状态和 HUD，不返回额外结果。
   */
  const handleWorkerMessage = (event: MessageEvent<WorkerToMainMessage>): void => {
    const message = event.data;

    if (message.type === "ready") {
      metrics.workerReady = true;
      metrics.workerUsesRaf = message.usesWorkerRaf;
      flushHud();
      setStatus({
        title: "Worker 与离主线程渲染已运行",
        detail:
          "左侧 render loop 仍在主线程里跑，右侧则把 OffscreenCanvas 转给 worker。拖高“主线程额外工作”以后，可以直接观察两边 frame interval 和同步延迟的变化。",
        tone: "ok",
      });
      return;
    }

    if (message.type === "sync") {
      metrics.lastSyncLatencyMs = message.latencyMs;
      metrics.workerSettingsVersion = message.settingsVersion;
      metrics.workerMessages = message.messagesProcessed;
      metrics.workerPixelWidth = message.pixelWidth;
      metrics.workerPixelHeight = message.pixelHeight;
      flushHud();
      return;
    }

    if (message.type === "metrics") {
      metrics.workerFrameMs = message.frameMs > 0.0001 ? message.frameMs : metrics.workerFrameMs;
      metrics.lastSyncLatencyMs = message.lastSyncLatencyMs;
      metrics.workerSettingsVersion = message.settingsVersion;
      metrics.workerMessages = message.messagesProcessed;
      metrics.workerPixelWidth = message.pixelWidth;
      metrics.workerPixelHeight = message.pixelHeight;

      const now = performance.now();
      if (now - lastHudUpdateTimeMs >= HUD_UPDATE_INTERVAL_MS) {
        updateHud(refs, metrics, sharedSettings);
        lastHudUpdateTimeMs = now;
      }
      return;
    }

    metrics.workerAvailable = false;
    metrics.workerReady = false;
    metrics.workerErrorMessage = message.message;
    workerFallback.textContent = message.message;
    flushHud();
    setStatus({
      title: "右侧 worker 预览不可用",
      detail: message.message,
      tone: "warn",
    });
  };

  /**
   * 处理浏览器层面的 worker error 事件。
   * @param {ErrorEvent} event 浏览器派发的错误事件。
   * @returns {void} 只更新状态和提示，不返回额外结果。
   */
  const handleWorkerError = (event: ErrorEvent): void => {
    metrics.workerAvailable = false;
    metrics.workerReady = false;
    metrics.workerErrorMessage = event.message || "worker 启动失败。";
    workerFallback.textContent = metrics.workerErrorMessage;
    flushHud();
    setStatus({
      title: "右侧 worker 预览不可用",
      detail: metrics.workerErrorMessage,
      tone: "warn",
    });
  };

  busyRange.addEventListener("input", () => {
    metrics.busyMs = Number.parseFloat(busyRange.value);
    flushHud();
  });

  spinRange.addEventListener("input", () => {
    applySharedSettings({
      spinSpeed: Number.parseFloat(spinRange.value),
    });
  });

  radiusRange.addEventListener("input", () => {
    applySharedSettings({
      cameraRadius: Number.parseFloat(radiusRange.value),
    });
  });

  burstButton.addEventListener("click", () => {
    pendingBurstMs += BURST_BLOCK_MS;
    metrics.burstCount += 1;
    flushHud();
  });

  try {
    mainRenderer = await createThreadRenderer(mainCanvas, measureCanvas(mainCanvas));
    metrics.mainPixelWidth = mainRenderer.pixelWidth;
    metrics.mainPixelHeight = mainRenderer.pixelHeight;

    const supportsWorkerPath =
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      "transferControlToOffscreen" in workerCanvas;

    if (supportsWorkerPath) {
      const offscreenCanvas = workerCanvas.transferControlToOffscreen();
      worker = new Worker(
        new URL("./worker.ts", import.meta.url),
        { type: "module" }
      );
      worker.onmessage = handleWorkerMessage;
      worker.onerror = handleWorkerError;

      const workerMeasurement = measureCanvas(workerCanvas);
      metrics.workerAvailable = true;
      sendWorkerMessage(
        {
          type: "init",
          canvas: offscreenCanvas,
          cssWidth: workerMeasurement.cssWidth,
          cssHeight: workerMeasurement.cssHeight,
          pixelRatio: workerMeasurement.pixelRatio,
          settings: { ...sharedSettings },
          sentAtMs: performance.now(),
        },
        [offscreenCanvas]
      );
    } else {
      metrics.workerAvailable = false;
      metrics.workerErrorMessage =
        "当前环境没有提供可转移的 OffscreenCanvas，因此右侧无法真正离开主线程。";
      workerFallback.textContent = metrics.workerErrorMessage;
      setStatus({
        title: "部分预览可用",
        detail: metrics.workerErrorMessage,
        tone: "warn",
      });
    }

    resizeObserver = new ResizeObserver(() => {
      syncAllCanvasSizes();
    });
    resizeObserver.observe(host);
    resizeObserver.observe(mainCanvas);
    resizeObserver.observe(workerCanvas);

    flushHud();

    const frame = (timestamp: number) => {
      if (disposed || !mainRenderer) {
        return;
      }

      const currentPixelRatio = measureCanvas(mainCanvas).pixelRatio;
      if (Math.abs(currentPixelRatio - lastObservedPixelRatio) > 0.01) {
        lastObservedPixelRatio = currentPixelRatio;
        syncAllCanvasSizes();
      }

      if (lastMainFrameTimeMs !== null) {
        metrics.mainFrameMs = recordFrameSample(
          mainFrameSamples,
          timestamp,
          timestamp - lastMainFrameTimeMs
        );
      }
      lastMainFrameTimeMs = timestamp;

      const burstWorkMs = pendingBurstMs;
      pendingBurstMs = 0;
      const blockedMs = metrics.busyMs + burstWorkMs;
      if (blockedMs > 0.0001) {
        blockMainThread(blockedMs);
      }

      mainRenderer.render(timestamp * 0.001, sharedSettings);
      metrics.mainPixelWidth = mainRenderer.pixelWidth;
      metrics.mainPixelHeight = mainRenderer.pixelHeight;

      if (timestamp - lastHudUpdateTimeMs >= HUD_UPDATE_INTERVAL_MS) {
        updateHud(refs, metrics, sharedSettings);
        lastHudUpdateTimeMs = timestamp;
      }

      animationFrameId = window.requestAnimationFrame(frame);
    };

    animationFrameId = window.requestAnimationFrame(frame);

    if (!metrics.workerAvailable) {
      flushHud();
    }

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      mainRenderer?.destroy();
      worker?.terminate();
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "第 42 课初始化失败。";

    host.innerHTML = `
      <div class="preview-empty">
        <div>
          <h3>预览不可用</h3>
          <p>${message}</p>
        </div>
      </div>
    `;

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
