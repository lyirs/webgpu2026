import { createThreadRenderer, type ThreadRenderer } from "@/lessons/lesson-47-worker-and-off-main-thread/renderer";
import {
  createDefaultSharedSettings,
  METRIC_WINDOW_MS,
  WORKER_METRIC_POST_INTERVAL_MS,
  type MainToWorkerMessage,
  type SharedRenderSettings,
  type WorkerToMainMessage,
} from "@/lessons/lesson-47-worker-and-off-main-thread/shared";

type WorkerScopeLike = {
  postMessage: (message: WorkerToMainMessage) => void;
  onmessage: ((event: MessageEvent<MainToWorkerMessage>) => void) | null;
  requestAnimationFrame?: (callback: (timestamp: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

type FrameSample = {
  timeMs: number;
  frameMs: number;
};

const workerScope = self as unknown as WorkerScopeLike;

let renderer: ThreadRenderer | null = null;
let settings: SharedRenderSettings = createDefaultSharedSettings();
let usingWorkerRaf = false;
let messagesProcessed = 0;
let lastSyncLatencyMs: number | null = null;
let lastFrameTimeMs: number | null = null;
let lastMetricsPostTimeMs = 0;
let animationHandle: number | null = null;

const frameSamples: FrameSample[] = [];

/**
 * 把一帧 frame interval 推进固定窗口，并回写平滑后的平均值。
 * @param {number} timeMs 当前采样时刻。
 * @param {number} frameMs 当前帧间隔。
 * @returns {number} 最近窗口内的平均 frame interval。
 */
function recordFrameSample(timeMs: number, frameMs: number): number {
  frameSamples.push({ timeMs, frameMs });

  const cutoffTimeMs = timeMs - METRIC_WINDOW_MS;
  while (frameSamples.length > 0 && frameSamples[0].timeMs < cutoffTimeMs) {
    frameSamples.shift();
  }

  let total = 0;
  for (const sample of frameSamples) {
    total += sample.frameMs;
  }

  return total / Math.max(1, frameSamples.length);
}

/**
 * 取消当前已经排队的 worker 帧调度。
 * @returns {void} 只负责停止后续回调，不返回额外结果。
 */
function cancelScheduledFrame(): void {
  if (animationHandle === null) {
    return;
  }

  if (usingWorkerRaf && typeof workerScope.cancelAnimationFrame === "function") {
    workerScope.cancelAnimationFrame(animationHandle);
  } else {
    workerScope.clearTimeout(animationHandle);
  }

  animationHandle = null;
}

/**
 * 按当前环境能力给 worker 排下一帧；优先用 worker 内的 requestAnimationFrame。
 * @returns {void} 只安排下一帧，不返回额外结果。
 */
function scheduleNextFrame(): void {
  if (!renderer) {
    return;
  }

  if (typeof workerScope.requestAnimationFrame === "function") {
    usingWorkerRaf = true;
    animationHandle = workerScope.requestAnimationFrame(frame);
    return;
  }

  usingWorkerRaf = false;
  animationHandle = workerScope.setTimeout(() => frame(performance.now()), 16) as unknown as number;
}

/**
 * 把最近一次消息处理结果回发给主线程，说明 worker 已经同步到哪一个版本。
 * @param {"init" | "resize" | "settings"} reason 这次同步是因为什么消息触发的。
 * @param {number} sentAtMs 主线程发出该消息时附带的时间戳。
 * @returns {void} 只发送同步结果，不返回额外结果。
 */
function sendSync(reason: "init" | "resize" | "settings", sentAtMs: number): void {
  lastSyncLatencyMs = Math.max(0, performance.now() - sentAtMs);
  workerScope.postMessage({
    type: "sync",
    reason,
    latencyMs: lastSyncLatencyMs,
    settingsVersion: settings.version,
    messagesProcessed,
    pixelWidth: renderer?.pixelWidth ?? 0,
    pixelHeight: renderer?.pixelHeight ?? 0,
  });
}

/**
 * 把 worker 当前的帧率和消息状态定期回发给主线程，用来更新 HUD。
 * @param {number} frameMs 最近窗口内的平均 frame interval。
 * @returns {void} 只发送指标，不返回额外结果。
 */
function sendMetrics(frameMs: number): void {
  workerScope.postMessage({
    type: "metrics",
    frameMs,
    fps: frameMs > 0.0001 ? 1000 / frameMs : 0,
    settingsVersion: settings.version,
    messagesProcessed,
    lastSyncLatencyMs,
    pixelWidth: renderer?.pixelWidth ?? 0,
    pixelHeight: renderer?.pixelHeight ?? 0,
  });
}

/**
 * worker 真正的渲染循环：提交一帧，再回发平滑后的时间指标。
 * @param {number} timeMs 当前时间，单位毫秒。
 * @returns {void} 只负责绘制和调度下一帧，不返回额外结果。
 */
function frame(timeMs: number): void {
  if (!renderer) {
    return;
  }

  renderer.render(timeMs * 0.001, settings);

  let smoothedFrameMs = 0;
  if (lastFrameTimeMs !== null) {
    smoothedFrameMs = recordFrameSample(timeMs, timeMs - lastFrameTimeMs);
  }
  lastFrameTimeMs = timeMs;

  if (timeMs - lastMetricsPostTimeMs >= WORKER_METRIC_POST_INTERVAL_MS) {
    lastMetricsPostTimeMs = timeMs;
    sendMetrics(smoothedFrameMs || frameSamples.at(-1)?.frameMs || 0);
  }

  scheduleNextFrame();
}

/**
 * 根据主线程发来的消息初始化 worker 渲染器，或同步 resize / settings。
 * @param {MainToWorkerMessage} message 主线程发来的协议消息。
 * @returns {Promise<void>} 异步完成后，worker 自己维护后续渲染循环。
 */
async function handleMessage(message: MainToWorkerMessage): Promise<void> {
  messagesProcessed += 1;

  try {
    if (message.type === "init") {
      cancelScheduledFrame();
      frameSamples.length = 0;
      lastFrameTimeMs = null;
      lastMetricsPostTimeMs = 0;
      settings = message.settings;
      renderer?.destroy();
      renderer = await createThreadRenderer(message.canvas, {
        cssWidth: message.cssWidth,
        cssHeight: message.cssHeight,
        pixelRatio: message.pixelRatio,
      });
      sendSync("init", message.sentAtMs);
      workerScope.postMessage({
        type: "ready",
        usesWorkerRaf: typeof workerScope.requestAnimationFrame === "function",
      });
      scheduleNextFrame();
      return;
    }

    if (!renderer) {
      return;
    }

    if (message.type === "resize") {
      renderer.resize({
        cssWidth: message.cssWidth,
        cssHeight: message.cssHeight,
        pixelRatio: message.pixelRatio,
      });
      sendSync("resize", message.sentAtMs);
      return;
    }

    settings = message.settings;
    sendSync("settings", message.sentAtMs);
  } catch (error) {
    const messageText =
      error instanceof Error ? error.message : "worker 渲染初始化失败。";
    workerScope.postMessage({
      type: "error",
      message: messageText,
    });
  }
}

workerScope.onmessage = (event) => {
  void handleMessage(event.data);
};
