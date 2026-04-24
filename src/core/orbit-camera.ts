type OrbitVector3 = [number, number, number];

type OrbitAngles = {
  yaw: number;
  pitch: number;
  radius: number;
};

export type OrbitCameraSnapshot = {
  eye: OrbitVector3;
  target: OrbitVector3;
  up: OrbitVector3;
  yaw: number;
  pitch: number;
  radius: number;
};

export type OrbitCameraController = {
  getSnapshot: () => OrbitCameraSnapshot;
  dispose: () => void;
};

export type OrbitCameraOptions = {
  target: OrbitVector3;
  eye: OrbitVector3;
  minRadius?: number;
  maxRadius?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
  up?: OrbitVector3;
  onChange?: () => void;
};

/**
 * 把数值限制在一个安全区间里。
 * @param {number} value 当前数值。
 * @param {number} min 允许的最小值。
 * @param {number} max 允许的最大值。
 * @returns {number} 夹在最小值和最大值之间的结果。
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 根据初始 eye 和 target 反推出轨道相机的 yaw / pitch / radius。
 * @param {OrbitVector3} eye 初始相机位置。
 * @param {OrbitVector3} target 初始观察目标。
 * @returns {OrbitAngles} 与这组位置对应的轨道相机球坐标参数。
 */
function createOrbitAnglesFromEye(
  eye: OrbitVector3,
  target: OrbitVector3
): OrbitAngles {
  const offsetX = eye[0] - target[0];
  const offsetY = eye[1] - target[1];
  const offsetZ = eye[2] - target[2];
  const radius = Math.max(Math.hypot(offsetX, offsetY, offsetZ), 0.0001);

  return {
    yaw: Math.atan2(offsetZ, offsetX),
    pitch: Math.asin(clamp(offsetY / radius, -1, 1)),
    radius,
  };
}

/**
 * 根据 yaw / pitch / radius 重新求出当前轨道相机的 eye 位置。
 * @param {number} yaw 水平旋转角。
 * @param {number} pitch 俯仰角。
 * @param {number} radius 相机与目标点之间的距离。
 * @param {OrbitVector3} target 当前观察目标。
 * @returns {OrbitVector3} 当前轨道相机的世界空间位置。
 */
function createOrbitEyePosition(
  yaw: number,
  pitch: number,
  radius: number,
  target: OrbitVector3
): OrbitVector3 {
  const horizontalRadius = Math.cos(pitch) * radius;
  return [
    target[0] + Math.cos(yaw) * horizontalRadius,
    target[1] + Math.sin(pitch) * radius,
    target[2] + Math.sin(yaw) * horizontalRadius,
  ];
}

/**
 * 把一个 canvas 接成受限轨道相机，让后续 lesson 统一使用拖拽旋转和滚轮缩放。
 * @param {HTMLCanvasElement} canvas 要接入交互的画布。
 * @param {OrbitCameraOptions} options 初始 eye/target、缩放范围和交互速度配置。
 * @returns {OrbitCameraController} 可读取当前相机快照并在清理阶段解绑监听器的控制器。
 */
export function createOrbitCameraController(
  canvas: HTMLCanvasElement,
  options: OrbitCameraOptions
): OrbitCameraController {
  const target: OrbitVector3 = [...options.target];
  const up: OrbitVector3 = options.up ? [...options.up] : [0, 1, 0];
  const angles = createOrbitAnglesFromEye(options.eye, target);
  const minRadius = options.minRadius ?? Math.max(angles.radius * 0.45, 1.2);
  const maxRadius = options.maxRadius ?? Math.max(angles.radius * 1.85, minRadius + 1);
  const rotateSpeed = options.rotateSpeed ?? 0.01;
  const zoomSpeed = options.zoomSpeed ?? 0.01;
  const maxPitch = Math.PI * 0.5 - 0.01;
  const onChange = options.onChange;

  const previousCursor = canvas.style.cursor;
  const previousTouchAction = canvas.style.touchAction;

  canvas.style.cursor = "grab";
  canvas.style.touchAction = "none";

  let activePointerId = -1;
  let lastPointerX = 0;
  let lastPointerY = 0;

  /**
   * 读取当前相机状态，方便在 render 循环里随时取用。
   * @returns {OrbitCameraSnapshot} 当前帧应该使用的 eye、target、up 和球坐标参数。
   */
  const getSnapshot = (): OrbitCameraSnapshot => ({
    eye: createOrbitEyePosition(angles.yaw, angles.pitch, angles.radius, target),
    target: [...target],
    up: [...up],
    yaw: angles.yaw,
    pitch: angles.pitch,
    radius: angles.radius,
  });

  const onPointerDown = (event: PointerEvent) => {
    activePointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    angles.yaw += deltaX * rotateSpeed;
    angles.pitch = clamp(
      angles.pitch + deltaY * rotateSpeed,
      -maxPitch,
      maxPitch
    );
    onChange?.();
  };

  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = -1;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    canvas.style.cursor = "grab";
  };

  const onWheel = (event: WheelEvent) => {
    event.preventDefault();
    angles.radius = clamp(
      angles.radius + event.deltaY * zoomSpeed,
      minRadius,
      maxRadius
    );
    onChange?.();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  return {
    getSnapshot,
    dispose: () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("wheel", onWheel);
      canvas.style.cursor = previousCursor;
      canvas.style.touchAction = previousTouchAction;
    },
  };
}
