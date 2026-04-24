import {
  createDefaultSharedSettings,
  MAX_PIXEL_RATIO,
  type MainToWorkerMessage,
  type SharedRenderSettings,
  type WorkerToMainMessage,
} from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/shared";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type MessageDirection = "main" | "worker";

type MessageLogEntry = {
  direction: MessageDirection;
  label: string;
  detail: string;
  timeMs: number;
};

type CanvasMeasurement = {
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
};

type WorkerMessagingMetrics = {
  workerSupported: boolean;
  canvasTransferred: boolean;
  workerReady: boolean;
  usesWorkerRaf: boolean;
  currentVersion: number;
  workerVersion: number;
  messagesSent: number;
  messagesReceived: number;
  messagesProcessed: number;
  lastSyncLatencyMs: number | null;
  lastPingLatencyMs: number | null;
  workerPixelWidth: number;
  workerPixelHeight: number;
  heartbeatFrame: number;
  workerErrorMessage: string | null;
};

type WorkerMessagingHudRefs = {
  supportBadge: HTMLElement;
  transferBadge: HTMLElement;
  versionBadge: HTMLElement;
  spinOutput: HTMLElement;
  radiusOutput: HTMLElement;
  canvasBadge: HTMLElement;
  canvasNote: HTMLElement;
  sentValue: HTMLElement;
  sentMeta: HTMLElement;
  processedValue: HTMLElement;
  processedMeta: HTMLElement;
  latencyValue: HTMLElement;
  latencyMeta: HTMLElement;
  pixelsValue: HTMLElement;
  pixelsMeta: HTMLElement;
  legendBody: HTMLElement;
  logList: HTMLElement;
  workerFallback: HTMLElement;
};

const MAX_LOG_ENTRIES = 8;

/**
 * 把数字格式化成更适合 HUD 的短文本。
 * @param {number} value 当前数字。
 * @returns {string} 格式化后的字符串。
 */
function formatCount(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

/**
 * 把毫秒值格式化成适合卡片展示的文本。
 * @param {number | null} value 当前毫秒值。
 * @param {string} fallback 没有值时显示的占位文本。
 * @returns {string} 对应的时间字符串。
 */
function formatMilliseconds(value: number | null, fallback: string): string {
  if (value === null || !Number.isFinite(value)) {
    return fallback;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ms`;
}

/**
 * 把像素尺寸格式化成“宽 × 高”的字符串。
 * @param {number} width 当前宽度。
 * @param {number} height 当前高度。
 * @returns {string} 对应的尺寸字符串。
 */
function formatSize(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    return "等待 resize";
  }

  return `${formatCount(width)} × ${formatCount(height)}`;
}

/**
 * 把 settings 版本号格式化成带前缀的短文本。
 * @param {number} value 当前版本号。
 * @returns {string} 对应的版本文本。
 */
function formatVersion(value: number): string {
  return `v${value}`;
}

/**
 * 读取当前 canvas 的 CSS 尺寸和像素比，供发送给 worker 的 resize / init 使用。
 * @param {HTMLCanvasElement} canvas 当前主线程里的画布元素。
 * @returns {CanvasMeasurement} 对应的测量结果。
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
 * 按最近消息记录重新渲染左侧日志列表。
 * @param {HTMLElement} container 日志列表容器。
 * @param {MessageLogEntry[]} entries 当前最近消息数组。
 * @returns {void} 只负责重画 DOM。
 */
function renderMessageLog(container: HTMLElement, entries: MessageLogEntry[]): void {
  container.innerHTML = entries
    .map((entry) => {
      const timeLabel = `${Math.round(entry.timeMs % 100000)} ms`;
      return `
        <article class="worker-messaging-log__item worker-messaging-log__item--${entry.direction}">
          <div class="worker-messaging-log__row">
            <span class="worker-messaging-log__chip worker-messaging-log__chip--${entry.direction}">${entry.direction === "main" ? "Main" : "Worker"}</span>
            <strong class="worker-messaging-log__label">${entry.label}</strong>
            <span class="worker-messaging-log__time">${timeLabel}</span>
          </div>
          <p class="worker-messaging-log__detail">${entry.detail}</p>
        </article>
      `;
    })
    .join("");
}

/**
 * 往日志里追加一条主线程 / worker 消息，并控制列表长度。
 * @param {MessageLogEntry[]} entries 当前日志数组。
 * @param {HTMLElement} container 日志列表容器。
 * @param {MessageDirection} direction 消息方向。
 * @param {string} label 本条消息标签。
 * @param {string} detail 本条消息解释。
 * @returns {void} 只负责更新日志数组和 DOM。
 */
function appendMessageLog(
  entries: MessageLogEntry[],
  container: HTMLElement,
  direction: MessageDirection,
  label: string,
  detail: string
): void {
  entries.unshift({
    direction,
    label,
    detail,
    timeMs: performance.now(),
  });

  if (entries.length > MAX_LOG_ENTRIES) {
    entries.length = MAX_LOG_ENTRIES;
  }

  renderMessageLog(container, entries);
}

/**
 * 根据当前消息状态生成更适合 lesson 收尾区域的说明文案。
 * @param {WorkerMessagingMetrics} metrics 当前指标状态。
 * @returns {string} 对应的说明文本。
 */
function createLegendCopy(metrics: WorkerMessagingMetrics): string {
  if (!metrics.workerSupported) {
    return "当前环境没有提供可转移的 OffscreenCanvas 或可用 worker，所以这节课先退化成平台概念说明。真正想讲的是：一旦 canvas 控制权被转走，主线程和 worker 就只能通过 postMessage 协作。";
  }

  if (!metrics.workerReady) {
    return "主线程已经创建 worker，并把 canvas 转成 OffscreenCanvas 发了过去。现在右侧还在等 worker 完成自己的 WebGPU 初始化；一旦 ready 回来，画布就会由另一条线程持续驱动。";
  }

  return `当前已经完成了最小分线程闭环：主线程负责 UI、滑杆和 ping；worker 负责真正的 render loop，并通过 ready / sync / pong / heartbeat 回传状态。最近一次设置同步延迟约 ${formatMilliseconds(metrics.lastSyncLatencyMs, "等待消息")}，最近一次往返 ping 约 ${formatMilliseconds(metrics.lastPingLatencyMs, "还没发送")}。`;
}

/**
 * 按当前指标状态刷新 HUD、标签和卡片文本。
 * @param {WorkerMessagingHudRefs} refs 当前 lesson 的 DOM 引用。
 * @param {WorkerMessagingMetrics} metrics 当前指标状态。
 * @param {SharedRenderSettings} settings 当前共享设置。
 * @returns {void} 只更新界面，不返回额外结果。
 */
function updateHud(
  refs: WorkerMessagingHudRefs,
  metrics: WorkerMessagingMetrics,
  settings: SharedRenderSettings
): void {
  refs.spinOutput.textContent = `${settings.spinSpeed.toFixed(2)}x`;
  refs.radiusOutput.textContent = settings.cameraRadius.toFixed(1);

  refs.supportBadge.textContent = metrics.workerSupported
    ? metrics.workerReady
      ? "worker · 已运行"
      : "worker · 初始化中"
    : "worker · 当前环境不可用";
  refs.supportBadge.className = metrics.workerSupported
    ? metrics.workerReady
      ? "worker-messaging-badge worker-messaging-badge--ok"
      : "worker-messaging-badge worker-messaging-badge--cool"
    : "worker-messaging-badge worker-messaging-badge--warn";

  refs.transferBadge.textContent = metrics.canvasTransferred
    ? "transferControlToOffscreen() · 已调用"
    : "OffscreenCanvas · 尚未转移";
  refs.transferBadge.className = metrics.canvasTransferred
    ? "worker-messaging-badge worker-messaging-badge--accent"
    : "worker-messaging-badge";

  refs.versionBadge.textContent = `settings version · ${formatVersion(
    metrics.currentVersion
  )} -> ${formatVersion(metrics.workerVersion)}`;
  refs.versionBadge.className =
    metrics.workerReady && metrics.workerVersion === metrics.currentVersion
      ? "worker-messaging-badge worker-messaging-badge--cool"
      : "worker-messaging-badge";

  refs.canvasBadge.textContent = metrics.workerSupported
    ? metrics.workerReady
      ? metrics.usesWorkerRaf
        ? "requestAnimationFrame · worker owns canvas"
        : "setTimeout 回退 · worker owns canvas"
      : "OffscreenCanvas · 等待 worker ready"
    : "右侧只剩平台提示";
  refs.canvasBadge.className = metrics.workerSupported
    ? "worker-messaging-canvas__badge worker-messaging-canvas__badge--ok"
    : "worker-messaging-canvas__badge worker-messaging-canvas__badge--warn";

  refs.canvasNote.textContent = metrics.workerSupported
    ? metrics.workerReady
      ? `主线程现在不再直接调用 draw；它只通过 postMessage 发送 resize、settings 和 ping。worker 最近一次 heartbeat 已经跑到第 ${formatCount(metrics.heartbeatFrame)} 帧。`
      : "这块 canvas 的控制权已经从页面线程转走，接下来就等 worker 自己完成初始化并开始持续提交 GPU 命令。"
    : metrics.workerErrorMessage ??
      "当前浏览器没有提供可转移的 OffscreenCanvas 或 worker 内的 WebGPU。";

  refs.sentValue.textContent = formatCount(metrics.messagesSent);
  refs.sentMeta.textContent = `主线程一共发出了 ${formatCount(
    metrics.messagesSent
  )} 条消息；这里统计 init / resize / settings / ping 四类协议。`;

  refs.processedValue.textContent = formatCount(metrics.messagesProcessed);
  refs.processedMeta.textContent = metrics.workerSupported
    ? `worker 已经处理 ${formatCount(metrics.messagesProcessed)} 条消息，并同步到了 ${formatVersion(
        metrics.workerVersion
      )}。`
    : "没有 worker 时，这个计数自然也不会继续增长。";

  refs.latencyValue.textContent = formatMilliseconds(
    metrics.lastPingLatencyMs ?? metrics.lastSyncLatencyMs,
    "等待消息"
  );
  refs.latencyMeta.textContent =
    metrics.lastPingLatencyMs !== null
      ? "这里优先显示最近一次 ping 的往返时间；它比 settings 同步更接近“线程间一次完整来回”。"
      : "还没收到 pong 时，这里会先显示最近一次 init / resize / settings 被 worker 应用的延迟。";

  refs.pixelsValue.textContent = formatSize(metrics.workerPixelWidth, metrics.workerPixelHeight);
  refs.pixelsMeta.textContent = metrics.workerSupported
    ? "当前 OffscreenCanvas 真正分配到的像素尺寸；worker ready 之后右侧就完全按这个 backing store 自己渲染。"
    : "当前环境没有真正转移出 OffscreenCanvas，因此也没有稳定的 worker 侧像素尺寸。";

  refs.legendBody.textContent = createLegendCopy(metrics);
  refs.workerFallback.hidden = metrics.workerSupported;
}

/**
 * 挂载第 43 课“Worker、消息传递与 OffscreenCanvas”，把平台层闭环压缩成最小实验。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 worker。
 */
export async function mountWorkerMessagingAndOffscreenCanvasLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<(() => void) | void> {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--worker-messaging">
      <div class="preview-frame">
        <section class="worker-messaging-stage">
          <div class="worker-messaging-stage__badges">
            <span class="worker-messaging-badge" data-worker-messaging-badge="support"></span>
            <span class="worker-messaging-badge" data-worker-messaging-badge="transfer"></span>
            <span class="worker-messaging-badge" data-worker-messaging-badge="version"></span>
          </div>

          <div class="worker-messaging-controls">
            <label class="worker-messaging-control">
              <span class="worker-messaging-control__row">
                <span class="worker-messaging-control__label">发送转速设置</span>
                <span class="worker-messaging-control__value" data-worker-messaging-output="spin"></span>
              </span>
              <input class="worker-messaging-control__range" data-worker-messaging-control="spin" type="range" min="0.55" max="1.95" step="0.05" value="1.1" />
            </label>

            <label class="worker-messaging-control">
              <span class="worker-messaging-control__row">
                <span class="worker-messaging-control__label">发送相机半径</span>
                <span class="worker-messaging-control__value" data-worker-messaging-output="radius"></span>
              </span>
              <input class="worker-messaging-control__range" data-worker-messaging-control="radius" type="range" min="5.4" max="8.6" step="0.1" value="6.8" />
            </label>

            <button class="worker-messaging-control worker-messaging-control--button" data-worker-messaging-control="ping" type="button">
              发送一次 ping
            </button>
          </div>

          <div class="worker-messaging-grid">
            <section class="worker-messaging-flow">
              <div class="worker-messaging-flow__roles">
                <article class="worker-messaging-role worker-messaging-role--main">
                  <p class="worker-messaging-role__eyebrow">Main Thread</p>
                  <h3 class="worker-messaging-role__title">只保留 UI、resize 与 postMessage</h3>
                  <p class="worker-messaging-role__body">这边负责滑杆、按钮和页面逻辑，但不再直接拥有右侧画布的渲染控制权。</p>
                </article>

                <article class="worker-messaging-role worker-messaging-role--worker">
                  <p class="worker-messaging-role__eyebrow">Worker</p>
                  <h3 class="worker-messaging-role__title">拿到 OffscreenCanvas 后独立跑 render loop</h3>
                  <p class="worker-messaging-role__body">worker 只能通过消息接收 settings / resize / ping，然后把 ready / sync / pong / heartbeat 回给主线程。</p>
                </article>
              </div>

              <div class="worker-messaging-log">
                <p class="worker-messaging-log__title">最近消息</p>
                <div class="worker-messaging-log__list" data-worker-messaging-log></div>
              </div>
            </section>

            <section class="worker-messaging-canvas">
              <div class="worker-messaging-canvas__header">
                <div>
                  <p class="worker-messaging-canvas__eyebrow">OffscreenCanvas</p>
                  <h3 class="worker-messaging-canvas__title">右侧画布被转交给 worker</h3>
                </div>
                <span class="worker-messaging-canvas__badge" data-worker-messaging-canvas-badge></span>
              </div>

              <div class="worker-messaging-canvas__shell">
                <canvas class="worker-messaging-canvas__element" data-worker-messaging-canvas></canvas>
                <div class="worker-messaging-canvas__fallback" data-worker-messaging-fallback hidden></div>
              </div>

              <p class="worker-messaging-canvas__note" data-worker-messaging-note></p>
            </section>
          </div>

          <div class="worker-messaging-cards">
            <article class="worker-messaging-card worker-messaging-card--accent">
              <p class="worker-messaging-card__label">主线程已发送</p>
              <strong class="worker-messaging-card__value" data-worker-messaging-card-value="sent"></strong>
              <p class="worker-messaging-card__meta" data-worker-messaging-card-meta="sent"></p>
            </article>

            <article class="worker-messaging-card worker-messaging-card--cool">
              <p class="worker-messaging-card__label">worker 已处理</p>
              <strong class="worker-messaging-card__value" data-worker-messaging-card-value="processed"></strong>
              <p class="worker-messaging-card__meta" data-worker-messaging-card-meta="processed"></p>
            </article>

            <article class="worker-messaging-card worker-messaging-card--ok">
              <p class="worker-messaging-card__label">最近往返</p>
              <strong class="worker-messaging-card__value" data-worker-messaging-card-value="latency"></strong>
              <p class="worker-messaging-card__meta" data-worker-messaging-card-meta="latency"></p>
            </article>

            <article class="worker-messaging-card">
              <p class="worker-messaging-card__label">worker 像素尺寸</p>
              <strong class="worker-messaging-card__value" data-worker-messaging-card-value="pixels"></strong>
              <p class="worker-messaging-card__meta" data-worker-messaging-card-meta="pixels"></p>
            </article>
          </div>

          <article class="worker-messaging-legend">
            <p class="worker-messaging-legend__eyebrow">当前实验</p>
            <p class="worker-messaging-legend__body" data-worker-messaging-legend></p>
          </article>
        </section>
      </div>
    </div>
  `;

  const supportBadge = host.querySelector<HTMLElement>('[data-worker-messaging-badge="support"]');
  const transferBadge = host.querySelector<HTMLElement>('[data-worker-messaging-badge="transfer"]');
  const versionBadge = host.querySelector<HTMLElement>('[data-worker-messaging-badge="version"]');
  const spinOutput = host.querySelector<HTMLElement>('[data-worker-messaging-output="spin"]');
  const radiusOutput = host.querySelector<HTMLElement>('[data-worker-messaging-output="radius"]');
  const canvasBadge = host.querySelector<HTMLElement>("[data-worker-messaging-canvas-badge]");
  const canvasNote = host.querySelector<HTMLElement>("[data-worker-messaging-note]");
  const sentValue = host.querySelector<HTMLElement>('[data-worker-messaging-card-value="sent"]');
  const sentMeta = host.querySelector<HTMLElement>('[data-worker-messaging-card-meta="sent"]');
  const processedValue = host.querySelector<HTMLElement>('[data-worker-messaging-card-value="processed"]');
  const processedMeta = host.querySelector<HTMLElement>('[data-worker-messaging-card-meta="processed"]');
  const latencyValue = host.querySelector<HTMLElement>('[data-worker-messaging-card-value="latency"]');
  const latencyMeta = host.querySelector<HTMLElement>('[data-worker-messaging-card-meta="latency"]');
  const pixelsValue = host.querySelector<HTMLElement>('[data-worker-messaging-card-value="pixels"]');
  const pixelsMeta = host.querySelector<HTMLElement>('[data-worker-messaging-card-meta="pixels"]');
  const legendBody = host.querySelector<HTMLElement>("[data-worker-messaging-legend]");
  const logList = host.querySelector<HTMLElement>("[data-worker-messaging-log]");
  const workerFallback = host.querySelector<HTMLElement>("[data-worker-messaging-fallback]");
  const workerCanvas = host.querySelector<HTMLCanvasElement>("[data-worker-messaging-canvas]");
  const spinRange = host.querySelector<HTMLInputElement>('[data-worker-messaging-control="spin"]');
  const radiusRange = host.querySelector<HTMLInputElement>('[data-worker-messaging-control="radius"]');
  const pingButton = host.querySelector<HTMLButtonElement>('[data-worker-messaging-control="ping"]');

  if (
    !supportBadge ||
    !transferBadge ||
    !versionBadge ||
    !spinOutput ||
    !radiusOutput ||
    !canvasBadge ||
    !canvasNote ||
    !sentValue ||
    !sentMeta ||
    !processedValue ||
    !processedMeta ||
    !latencyValue ||
    !latencyMeta ||
    !pixelsValue ||
    !pixelsMeta ||
    !legendBody ||
    !logList ||
    !workerFallback ||
    !workerCanvas ||
    !spinRange ||
    !radiusRange ||
    !pingButton
  ) {
    setStatus({
      title: "预览不可用",
      detail: "第 43 课的 DOM 结构没有完整挂载出来。",
      tone: "warn",
    });
    return;
  }

  const refs: WorkerMessagingHudRefs = {
    supportBadge,
    transferBadge,
    versionBadge,
    spinOutput,
    radiusOutput,
    canvasBadge,
    canvasNote,
    sentValue,
    sentMeta,
    processedValue,
    processedMeta,
    latencyValue,
    latencyMeta,
    pixelsValue,
    pixelsMeta,
    legendBody,
    logList,
    workerFallback,
  };

  const sharedSettings = createDefaultSharedSettings();
  const metrics: WorkerMessagingMetrics = {
    workerSupported: false,
    canvasTransferred: false,
    workerReady: false,
    usesWorkerRaf: false,
    currentVersion: sharedSettings.version,
    workerVersion: 0,
    messagesSent: 0,
    messagesReceived: 0,
    messagesProcessed: 0,
    lastSyncLatencyMs: null,
    lastPingLatencyMs: null,
    workerPixelWidth: 0,
    workerPixelHeight: 0,
    heartbeatFrame: 0,
    workerErrorMessage: null,
  };

  const logs: MessageLogEntry[] = [];
  let worker: Worker | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let animationFrameId = 0;
  let disposed = false;
  let nextPingId = 1;
  let lastObservedPixelRatio = measureCanvas(workerCanvas).pixelRatio;

  const flushHud = () => {
    updateHud(refs, metrics, sharedSettings);
  };

  const describeMessage = (message: MainToWorkerMessage): { label: string; detail: string } => {
    if (message.type === "init") {
      return {
        label: "init",
        detail: `把 OffscreenCanvas 与初始 settings ${formatVersion(message.settings.version)} 一起发给 worker。`,
      };
    }

    if (message.type === "resize") {
      return {
        label: "resize",
        detail: `主线程测到 CSS ${formatSize(
          Math.floor(message.cssWidth),
          Math.floor(message.cssHeight)
        )} / DPR ${message.pixelRatio.toFixed(2)}，请求 worker 重新配置 backing store。`,
      };
    }

    if (message.type === "settings") {
      return {
        label: "settings",
        detail: `发送 ${formatVersion(message.settings.version)}：spin ${message.settings.spinSpeed.toFixed(
          2
        )}x，camera radius ${message.settings.cameraRadius.toFixed(1)}。`,
      };
    }

    return {
      label: `ping #${message.id}`,
      detail: "做一次最小往返测试，确认主线程和 worker 的消息通道是否畅通。",
    };
  };

  const sendWorkerMessage = (
    message: MainToWorkerMessage,
    transferables: Transferable[] = []
  ): void => {
    if (!worker) {
      return;
    }

    metrics.messagesSent += 1;
    const summary = describeMessage(message);
    appendMessageLog(logs, refs.logList, "main", summary.label, summary.detail);
    worker.postMessage(message, transferables);
    flushHud();
  };

  const syncWorkerCanvasSize = (): void => {
    if (!worker || !metrics.canvasTransferred) {
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

  const applySharedSettings = (
    patch: Partial<Pick<SharedRenderSettings, "spinSpeed" | "cameraRadius">>
  ): void => {
    sharedSettings.spinSpeed = patch.spinSpeed ?? sharedSettings.spinSpeed;
    sharedSettings.cameraRadius = patch.cameraRadius ?? sharedSettings.cameraRadius;
    sharedSettings.version += 1;
    metrics.currentVersion = sharedSettings.version;

    sendWorkerMessage({
      type: "settings",
      settings: { ...sharedSettings },
      sentAtMs: performance.now(),
    });
  };

  const handleWorkerMessage = (event: MessageEvent<WorkerToMainMessage>): void => {
    const message = event.data;
    metrics.messagesReceived += 1;

    if (message.type === "ready") {
      metrics.workerReady = true;
      metrics.usesWorkerRaf = message.usesWorkerRaf;
      appendMessageLog(
        logs,
        refs.logList,
        "worker",
        "ready",
        message.usesWorkerRaf
          ? "worker 已拿到 OffscreenCanvas，并确认会用 worker 内的 requestAnimationFrame 驱动渲染。"
          : "worker 已拿到 OffscreenCanvas，但当前环境只提供 setTimeout 回退调度。"
      );
      flushHud();
      setStatus({
        title: "Worker、消息传递与 OffscreenCanvas 已运行",
        detail:
          "右侧画布已经被转交给 worker，主线程只剩下滑杆、ping 和 resize 消息；现在可以直接观察消息列表和版本推进。",
        tone: "ok",
      });
      return;
    }

    if (message.type === "sync") {
      metrics.lastSyncLatencyMs = message.latencyMs;
      metrics.workerVersion = message.settingsVersion;
      metrics.messagesProcessed = message.messagesProcessed;
      metrics.workerPixelWidth = message.pixelWidth;
      metrics.workerPixelHeight = message.pixelHeight;
      appendMessageLog(
        logs,
        refs.logList,
        "worker",
        `sync · ${message.reason}`,
        `${message.reason} 已在 worker 侧应用；当前版本 ${formatVersion(
          message.settingsVersion
        )}，延迟约 ${formatMilliseconds(message.latencyMs, "—")}。`
      );
      flushHud();
      return;
    }

    if (message.type === "pong") {
      metrics.lastPingLatencyMs = message.latencyMs;
      metrics.messagesProcessed = message.messagesProcessed;
      appendMessageLog(
        logs,
        refs.logList,
        "worker",
        `pong #${message.id}`,
        `收到 ping #${message.id} 并立即回包；本次往返约 ${formatMilliseconds(
          message.latencyMs,
          "—"
        )}。`
      );
      flushHud();
      return;
    }

    if (message.type === "heartbeat") {
      metrics.heartbeatFrame = message.frameCount;
      metrics.workerVersion = message.settingsVersion;
      metrics.messagesProcessed = message.messagesProcessed;
      metrics.workerPixelWidth = message.pixelWidth;
      metrics.workerPixelHeight = message.pixelHeight;
      flushHud();
      return;
    }

    metrics.workerSupported = false;
    metrics.workerReady = false;
    metrics.workerErrorMessage = message.message;
    workerFallback.textContent = message.message;
    appendMessageLog(logs, refs.logList, "worker", "error", message.message);
    flushHud();
    setStatus({
      title: "右侧 worker 预览不可用",
      detail: message.message,
      tone: "warn",
    });
  };

  const handleWorkerError = (event: ErrorEvent): void => {
    metrics.workerSupported = false;
    metrics.workerReady = false;
    metrics.workerErrorMessage = event.message || "worker 启动失败。";
    workerFallback.textContent = metrics.workerErrorMessage;
    appendMessageLog(logs, refs.logList, "worker", "error", metrics.workerErrorMessage);
    flushHud();
    setStatus({
      title: "右侧 worker 预览不可用",
      detail: metrics.workerErrorMessage,
      tone: "warn",
    });
  };

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

  pingButton.addEventListener("click", () => {
    sendWorkerMessage({
      type: "ping",
      id: nextPingId,
      sentAtMs: performance.now(),
    });
    nextPingId += 1;
  });

  try {
    const supportsWorkerPath =
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      "transferControlToOffscreen" in workerCanvas;

    if (supportsWorkerPath) {
      worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = handleWorkerMessage;
      worker.onerror = handleWorkerError;

      const offscreenCanvas = workerCanvas.transferControlToOffscreen();
      const measurement = measureCanvas(workerCanvas);
      metrics.workerSupported = true;
      metrics.canvasTransferred = true;

      sendWorkerMessage(
        {
          type: "init",
          canvas: offscreenCanvas,
          cssWidth: measurement.cssWidth,
          cssHeight: measurement.cssHeight,
          pixelRatio: measurement.pixelRatio,
          settings: { ...sharedSettings },
          sentAtMs: performance.now(),
        },
        [offscreenCanvas]
      );

      setStatus({
        title: "Worker 消息通道初始化中",
        detail:
          "主线程正在把 OffscreenCanvas 和初始 settings 交给 worker；等 ready 回来后，右侧画布就会开始由另一条线程持续驱动。",
        tone: "info",
      });
    } else {
      metrics.workerErrorMessage =
        "当前环境没有提供可转移的 OffscreenCanvas，因此第 43 课只能展示平台语义，无法真正把画布交给 worker。";
      workerFallback.textContent = metrics.workerErrorMessage;
      setStatus({
        title: "部分预览可用",
        detail: metrics.workerErrorMessage,
        tone: "warn",
      });
    }

    resizeObserver = new ResizeObserver(() => {
      syncWorkerCanvasSize();
    });
    resizeObserver.observe(host);
    resizeObserver.observe(workerCanvas);

    const monitor = () => {
      if (disposed) {
        return;
      }

      const currentPixelRatio = measureCanvas(workerCanvas).pixelRatio;
      if (Math.abs(currentPixelRatio - lastObservedPixelRatio) > 0.01) {
        lastObservedPixelRatio = currentPixelRatio;
        syncWorkerCanvasSize();
      }

      animationFrameId = window.requestAnimationFrame(monitor);
    };

    flushHud();
    animationFrameId = window.requestAnimationFrame(monitor);

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      worker?.terminate();
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "第 43 课初始化失败。";

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
