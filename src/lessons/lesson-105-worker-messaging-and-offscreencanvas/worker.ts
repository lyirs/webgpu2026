import {
  createThreadRenderer,
  type WorkerMessagingRenderer,
} from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/renderer";
import {
  createDefaultSharedSettings,
  WORKER_HEARTBEAT_INTERVAL_MS,
  type MainToWorkerMessage,
  type SharedRenderSettings,
  type WorkerToMainMessage,
} from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/shared";

type WorkerScopeLike = {
  postMessage: (message: WorkerToMainMessage) => void;
  onmessage: ((event: MessageEvent<MainToWorkerMessage>) => void) | null;
  requestAnimationFrame?: (callback: (timestamp: number) => void) => number;
  cancelAnimationFrame?: (handle: number) => void;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

const workerScope = self as unknown as WorkerScopeLike;

type ResizeMessage = Extract<MainToWorkerMessage, { type: "resize" }>;
type SettingsMessage = Extract<MainToWorkerMessage, { type: "settings" }>;

let renderer: WorkerMessagingRenderer | null = null;
let settings: SharedRenderSettings = createDefaultSharedSettings();
let usingWorkerRaf = false;
let messagesProcessed = 0;
let animationHandle: number | null = null;
let frameCount = 0;
let lastHeartbeatTimeMs = 0;
let pendingResizeMessage: ResizeMessage | null = null;
let pendingSettingsMessage: SettingsMessage | null = null;

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
 * 把最近一次 init / resize / settings 应用结果回发给主线程。
 * @param {"init" | "resize" | "settings"} reason 这次同步是由哪类消息触发的。
 * @param {number} sentAtMs 主线程发出该消息时附带的时间戳。
 * @returns {void} 只发送同步结果，不返回额外结果。
 */
function sendSync(reason: "init" | "resize" | "settings", sentAtMs: number): void {
  workerScope.postMessage({
    type: "sync",
    reason,
    latencyMs: Math.max(0, performance.now() - sentAtMs),
    settingsVersion: settings.version,
    messagesProcessed,
    pixelWidth: renderer?.pixelWidth ?? 0,
    pixelHeight: renderer?.pixelHeight ?? 0,
  });
}

/**
 * 定期回发一条 heartbeat，说明 worker 的 render loop 仍在独立推进。
 * @returns {void} 只发送一条 heartbeat 消息。
 */
function sendHeartbeat(): void {
  workerScope.postMessage({
    type: "heartbeat",
    frameCount,
    settingsVersion: settings.version,
    messagesProcessed,
    pixelWidth: renderer?.pixelWidth ?? 0,
    pixelHeight: renderer?.pixelHeight ?? 0,
  });
}

/**
 * worker 真正的渲染循环：持续提交一帧，并周期性发 heartbeat。
 * @param {number} timeMs 当前时间，单位毫秒。
 * @returns {void} 只负责绘制和调度下一帧。
 */
function frame(timeMs: number): void {
  if (!renderer) {
    return;
  }

  renderer.render(timeMs * 0.001, settings);
  frameCount += 1;

  if (timeMs - lastHeartbeatTimeMs >= WORKER_HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatTimeMs = timeMs;
    sendHeartbeat();
  }

  scheduleNextFrame();
}

/**
 * 根据主线程发来的消息初始化 worker 渲染器，或同步 resize / settings / ping。
 * @param {MainToWorkerMessage} message 主线程发来的协议消息。
 * @returns {Promise<void>} 异步完成后，worker 自己维护后续渲染循环。
 */
async function handleMessage(message: MainToWorkerMessage): Promise<void> {
  messagesProcessed += 1;

  try {
    if (message.type === "init") {
      cancelScheduledFrame();
      frameCount = 0;
      lastHeartbeatTimeMs = 0;
      settings = message.settings;
      renderer?.destroy();
      renderer = await createThreadRenderer(message.canvas, {
        cssWidth: message.cssWidth,
        cssHeight: message.cssHeight,
        pixelRatio: message.pixelRatio,
      });
      sendSync("init", message.sentAtMs);
      if (pendingResizeMessage) {
        renderer.resize({
          cssWidth: pendingResizeMessage.cssWidth,
          cssHeight: pendingResizeMessage.cssHeight,
          pixelRatio: pendingResizeMessage.pixelRatio,
        });
        sendSync("resize", pendingResizeMessage.sentAtMs);
        pendingResizeMessage = null;
      }
      if (pendingSettingsMessage) {
        settings = pendingSettingsMessage.settings;
        sendSync("settings", pendingSettingsMessage.sentAtMs);
        pendingSettingsMessage = null;
      }
      workerScope.postMessage({
        type: "ready",
        usesWorkerRaf: typeof workerScope.requestAnimationFrame === "function",
      });
      scheduleNextFrame();
      return;
    }

    if (message.type === "ping") {
      workerScope.postMessage({
        type: "pong",
        id: message.id,
        latencyMs: Math.max(0, performance.now() - message.sentAtMs),
        messagesProcessed,
      });
      return;
    }

    if (!renderer) {
      if (message.type === "resize") {
        pendingResizeMessage = message;
      } else if (message.type === "settings") {
        pendingSettingsMessage = message;
        settings = message.settings;
      }
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
