import {
  createLookAtViewMatrix,
  createOrbitEyePosition,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  createRotationZMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-106-worker-and-off-main-thread/math";

export type Color4 = [number, number, number, number];

export type SharedRenderSettings = {
  version: number;
  spinSpeed: number;
  cameraRadius: number;
};

export type WorkerInitMessage = {
  type: "init";
  canvas: OffscreenCanvas;
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
  settings: SharedRenderSettings;
  sentAtMs: number;
};

export type WorkerResizeMessage = {
  type: "resize";
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
  sentAtMs: number;
};

export type WorkerSettingsMessage = {
  type: "settings";
  settings: SharedRenderSettings;
  sentAtMs: number;
};

export type MainToWorkerMessage =
  | WorkerInitMessage
  | WorkerResizeMessage
  | WorkerSettingsMessage;

export type WorkerReadyMessage = {
  type: "ready";
  usesWorkerRaf: boolean;
};

export type WorkerSyncMessage = {
  type: "sync";
  reason: "init" | "resize" | "settings";
  latencyMs: number;
  settingsVersion: number;
  messagesProcessed: number;
  pixelWidth: number;
  pixelHeight: number;
};

export type WorkerMetricsMessage = {
  type: "metrics";
  frameMs: number;
  fps: number;
  settingsVersion: number;
  messagesProcessed: number;
  lastSyncLatencyMs: number | null;
  pixelWidth: number;
  pixelHeight: number;
};

export type WorkerErrorMessage = {
  type: "error";
  message: string;
};

export type WorkerToMainMessage =
  | WorkerReadyMessage
  | WorkerSyncMessage
  | WorkerMetricsMessage
  | WorkerErrorMessage;

export type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  rotation: Vector3;
  scale: Vector3;
  color: Color4;
  surfaceMode: 0 | 1;
  detailScale: number;
  phase: number;
  orbitRadius: number;
  orbitSpeed: number;
  bobAmplitude: number;
  bobSpeed: number;
  spinBoost: number;
};

export type SceneFrameData = {
  viewProjectionMatrix: Float32Array;
  lightPosition: Vector3;
  eyePosition: Vector3;
};

export const MAX_PIXEL_RATIO = 2;
export const METRIC_WINDOW_MS = 2400;
export const HUD_UPDATE_INTERVAL_MS = 240;
export const WORKER_METRIC_POST_INTERVAL_MS = 240;

const CAMERA_TARGET: Vector3 = [0, 0.22, 0];
const CAMERA_PITCH = 0.84;
const CAMERA_YAW_SPEED = 0.34;
const FIELD_OF_VIEW_RAD = Math.PI / 4.6;

/**
 * 生成 0-1 之间的稳定伪随机数，保证 lesson 每次刷新时场景一致。
 * @param {number} index 当前对象索引。
 * @param {number} salt 用来切换随机流的偏移量。
 * @returns {number} 一个稳定的 0-1 浮点数。
 */
function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

/**
 * 生成一份默认共享参数，主线程和 worker 都从这里起步。
 * @returns {SharedRenderSettings} 一份初始设置。
 */
export function createDefaultSharedSettings(): SharedRenderSettings {
  return {
    version: 1,
    spinSpeed: 1.1,
    cameraRadius: 6.8,
  };
}

/**
 * 生成这节课里主线程和 worker 都会复用的一批场景对象。
 * @returns {SceneObjectConfig[]} 一份偏“信号塔 / 消息环带”的对象数组。
 */
export function createWorkerOffMainThreadSceneConfigs(): SceneObjectConfig[] {
  const objects: SceneObjectConfig[] = [
    {
      label: "floor",
      translation: [0, -1.26, 0],
      rotation: [0, 0, 0],
      scale: [6.6, 0.10, 6.6],
      color: [0.15, 0.20, 0.27, 1],
      surfaceMode: 1,
      detailScale: 3.1,
      phase: 0,
      orbitRadius: 0,
      orbitSpeed: 0,
      bobAmplitude: 0,
      bobSpeed: 0,
      spinBoost: 0,
    },
    {
      label: "plinth",
      translation: [0, -0.88, 0],
      rotation: [0, 0, 0],
      scale: [2.9, 0.26, 2.9],
      color: [0.21, 0.27, 0.35, 1],
      surfaceMode: 1,
      detailScale: 7.8,
      phase: 0,
      orbitRadius: 0,
      orbitSpeed: 0,
      bobAmplitude: 0,
      bobSpeed: 0,
      spinBoost: 0,
    },
    {
      label: "core",
      translation: [0, 0.24, 0],
      rotation: [0.14, 0.28, 0.06],
      scale: [0.92, 1.92, 0.92],
      color: [0.29, 0.82, 1.0, 1],
      surfaceMode: 0,
      detailScale: 0,
      phase: 0.12,
      orbitRadius: 0.18,
      orbitSpeed: 0.16,
      bobAmplitude: 0.08,
      bobSpeed: 0.74,
      spinBoost: 0.14,
    },
    {
      label: "bridge-x",
      translation: [0, 0.12, 0],
      rotation: [0.0, 0.0, 0.42],
      scale: [2.55, 0.12, 0.22],
      color: [1.0, 0.71, 0.31, 1],
      surfaceMode: 0,
      detailScale: 0,
      phase: 0.6,
      orbitRadius: 0.08,
      orbitSpeed: 0.22,
      bobAmplitude: 0.05,
      bobSpeed: 0.9,
      spinBoost: 0.1,
    },
    {
      label: "bridge-z",
      translation: [0, 0.00, 0],
      rotation: [-0.18, Math.PI * 0.5, 0.0],
      scale: [2.15, 0.12, 0.22],
      color: [0.56, 0.87, 0.43, 1],
      surfaceMode: 0,
      detailScale: 0,
      phase: 1.1,
      orbitRadius: 0.08,
      orbitSpeed: 0.24,
      bobAmplitude: 0.05,
      bobSpeed: 0.78,
      spinBoost: 0.1,
    },
  ];

  const palette: Color4[] = [
    [0.29, 0.82, 1.0, 1],
    [1.0, 0.70, 0.30, 1],
    [0.56, 0.87, 0.43, 1],
    [0.94, 0.62, 0.96, 1],
  ];

  for (let index = 0; index < 18; index += 1) {
    const normalized = index / 18;
    const angle = normalized * Math.PI * 2;
    const radius = 1.52 + seededUnit(index, 3) * 0.16;
    const height = -0.08 + seededUnit(index, 9) * 1.10;
    const columnScale = 0.48 + seededUnit(index, 14) * 1.08;
    const color = palette[index % palette.length];

    objects.push({
      label: `relay-${index}`,
      translation: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
      rotation: [seededUnit(index, 21) * 0.38, angle, seededUnit(index, 28) * 0.32],
      scale: [0.18, columnScale, 0.18],
      color,
      surfaceMode: seededUnit(index, 41) > 0.52 ? 1 : 0,
      detailScale: 7.2 + seededUnit(index, 49) * 6.0,
      phase: angle,
      orbitRadius: 0.16 + seededUnit(index, 56) * 0.22,
      orbitSpeed: 0.62 + seededUnit(index, 63) * 0.36,
      bobAmplitude: 0.06 + seededUnit(index, 72) * 0.14,
      bobSpeed: 0.92 + seededUnit(index, 81) * 0.72,
      spinBoost: 0.22 + seededUnit(index, 94) * 0.48,
    });
  }

  for (let index = 0; index < 24; index += 1) {
    const normalized = index / 24;
    const angle = normalized * Math.PI * 2;
    const radius = 2.62 + seededUnit(index, 107) * 0.24;
    const height = -0.30 + seededUnit(index, 113) * 0.52;
    const width = 0.12 + seededUnit(index, 127) * 0.10;
    const depth = 0.12 + seededUnit(index, 132) * 0.12;
    const beamLength = 0.38 + seededUnit(index, 139) * 0.56;
    const color = palette[(index + 1) % palette.length];

    objects.push({
      label: `packet-${index}`,
      translation: [Math.cos(angle) * radius, height, Math.sin(angle) * radius],
      rotation: [seededUnit(index, 145) * 0.52, angle, seededUnit(index, 151) * 0.48],
      scale: [beamLength, width, depth],
      color,
      surfaceMode: 0,
      detailScale: 0,
      phase: angle * 1.4,
      orbitRadius: 0.22 + seededUnit(index, 159) * 0.24,
      orbitSpeed: 0.78 + seededUnit(index, 166) * 0.52,
      bobAmplitude: 0.04 + seededUnit(index, 173) * 0.18,
      bobSpeed: 1.10 + seededUnit(index, 181) * 0.70,
      spinBoost: 0.64 + seededUnit(index, 197) * 0.52,
    });
  }

  return objects;
}

/**
 * 根据当前时间和共享参数生成相机与光源数据。
 * @param {number} aspect 当前画布宽高比。
 * @param {number} timeSeconds 当前时间，单位秒。
 * @param {SharedRenderSettings} settings 主线程和 worker 共用的动画参数。
 * @returns {SceneFrameData} 当前帧的 VP、光源和相机位置。
 */
export function createSceneFrameData(
  aspect: number,
  timeSeconds: number,
  settings: SharedRenderSettings
): SceneFrameData {
  const cameraYaw = timeSeconds * settings.spinSpeed * CAMERA_YAW_SPEED;
  const eyePosition = createOrbitEyePosition(
    cameraYaw,
    CAMERA_PITCH,
    settings.cameraRadius,
    CAMERA_TARGET
  );
  const viewMatrix = createLookAtViewMatrix(eyePosition, CAMERA_TARGET, [0, 1, 0]);
  const projectionMatrix = createPerspectiveMatrix(
    FIELD_OF_VIEW_RAD,
    Math.max(0.1, aspect),
    0.1,
    48
  );
  const lightDistance = settings.cameraRadius * 0.54 + 1.4;
  const lightPosition: Vector3 = [
    Math.cos(timeSeconds * 0.66) * lightDistance,
    3.8 + Math.sin(timeSeconds * 1.28) * 0.42,
    Math.sin(timeSeconds * 0.66) * lightDistance,
  ];

  return {
    viewProjectionMatrix: multiplyMatrices(projectionMatrix, viewMatrix),
    lightPosition,
    eyePosition,
  };
}

/**
 * 组合当前对象的平移、旋转和缩放，生成一份带动画的模型矩阵。
 * @param {SceneObjectConfig} config 当前对象配置。
 * @param {number} timeSeconds 当前时间，单位秒。
 * @param {SharedRenderSettings} settings 主线程和 worker 共用的动画参数。
 * @returns {Float32Array} 当前对象的 4x4 模型矩阵。
 */
export function createAnimatedModelMatrix(
  config: SceneObjectConfig,
  timeSeconds: number,
  settings: SharedRenderSettings
): Float32Array {
  const animatedTime = timeSeconds * settings.spinSpeed;
  const orbitPhase = config.phase + animatedTime * config.orbitSpeed;
  const bobPhase = config.phase * 1.7 + animatedTime * config.bobSpeed;
  const translated: Vector3 = [
    config.translation[0] + Math.cos(orbitPhase) * config.orbitRadius,
    config.translation[1] + Math.sin(bobPhase) * config.bobAmplitude,
    config.translation[2] + Math.sin(orbitPhase) * config.orbitRadius,
  ];

  return multiplyMatrices(
    createTranslationMatrix(translated[0], translated[1], translated[2]),
    multiplyMatrices(
      createRotationYMatrix(config.rotation[1] + animatedTime * config.spinBoost),
      multiplyMatrices(
        createRotationXMatrix(config.rotation[0] + Math.sin(bobPhase) * 0.12),
        multiplyMatrices(
          createRotationZMatrix(config.rotation[2] + Math.cos(bobPhase) * 0.12),
          createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
        )
      )
    )
  );
}

/**
 * 把视图矩阵、光源位置和相机位置打包成一份 frame uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前画布的 VP 矩阵。
 * @param {Vector3} lightPosition 当前点光源位置。
 * @param {Vector3} eyePosition 当前相机位置。
 * @returns {Float32Array} 可直接写进 frame uniform buffer 的连续数据。
 */
export function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  lightPosition: Vector3,
  eyePosition: Vector3
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set([lightPosition[0], lightPosition[1], lightPosition[2], 1], 16);
  uniformData.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 20);
  return uniformData;
}

/**
 * 生成一份对象级 uniform 数据，里面包含模型矩阵、颜色和表面细节参数。
 * @param {Float32Array} modelMatrix 当前对象模型矩阵。
 * @param {Color4} color 当前对象颜色。
 * @param {0 | 1} surfaceMode 0 表示纯色表面，1 表示带网格细节的表面。
 * @param {number} detailScale 当前表面细节密度。
 * @returns {Float32Array} 可直接写进对象 uniform buffer 的连续数据。
 */
export function createObjectUniformData(
  modelMatrix: Float32Array,
  color: Color4,
  surfaceMode: 0 | 1,
  detailScale: number
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(modelMatrix, 0);
  uniformData.set(color, 16);
  uniformData.set([surfaceMode, detailScale, 0, 0], 20);
  return uniformData;
}
