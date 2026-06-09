export type Vector3 = [number, number, number];

/**
 * 创建一个 4x4 单位矩阵。
 * @returns {Float32Array} 主对角线为 1 的 column-major 矩阵。
 */
export function createIdentityMatrix(): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * 按 column-major 规则相乘两个 4x4 矩阵。
 * @param {Float32Array} left 左侧矩阵。
 * @param {Float32Array} right 右侧矩阵。
 * @returns {Float32Array} `left * right` 的乘积结果。
 */
export function multiplyMatrices(
  left: Float32Array,
  right: Float32Array
): Float32Array {
  const result = new Float32Array(16);

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] =
        left[0 * 4 + row] * right[column * 4 + 0] +
        left[1 * 4 + row] * right[column * 4 + 1] +
        left[2 * 4 + row] * right[column * 4 + 2] +
        left[3 * 4 + row] * right[column * 4 + 3];
    }
  }

  return result;
}

/**
 * 创建符合 WebGPU 深度范围的透视投影矩阵。
 * @param {number} fieldOfViewRad 垂直视场角，单位为弧度。
 * @param {number} aspect 画布宽高比。
 * @param {number} near 近裁剪面距离。
 * @param {number} far 远裁剪面距离。
 * @returns {Float32Array} 对应的 4x4 透视投影矩阵。
 */
export function createPerspectiveMatrix(
  fieldOfViewRad: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1 / Math.tan(fieldOfViewRad * 0.5);
  const rangeInv = 1 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, far * rangeInv, -1,
    0, 0, near * far * rangeInv, 0,
  ]);
}

/**
 * 计算两个向量的差。
 * @param {Vector3} left 被减向量。
 * @param {Vector3} right 减数向量。
 * @returns {Vector3} `left - right` 的结果。
 */
function subtractVectors(left: Vector3, right: Vector3): Vector3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

/**
 * 计算两个向量的叉积。
 * @param {Vector3} left 左侧向量。
 * @param {Vector3} right 右侧向量。
 * @returns {Vector3} 垂直于两者的向量结果。
 */
function crossVectors(left: Vector3, right: Vector3): Vector3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

/**
 * 计算两个向量的点积。
 * @param {Vector3} left 左侧向量。
 * @param {Vector3} right 右侧向量。
 * @returns {number} 两个向量的点积结果。
 */
function dotVectors(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

/**
 * 把一个 3D 向量单位化。
 * @param {Vector3} vector 原始向量。
 * @returns {Vector3} 长度为 1 的方向向量；如果输入是零向量，则返回 [0, 0, 0]。
 */
function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length === 0) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * 根据相机位置、目标点和上方向创建一个 view 矩阵。
 * @param {Vector3} eye 相机所在位置。
 * @param {Vector3} target 相机正在看的目标点。
 * @param {Vector3} up 用来确定“头顶朝上”方向的参考向量。
 * @returns {Float32Array} 可直接参与 `projection * view * model` 的 view 矩阵。
 */
export function createLookAtViewMatrix(
  eye: Vector3,
  target: Vector3,
  up: Vector3
): Float32Array {
  const zAxis = normalizeVector(subtractVectors(eye, target));
  const xAxis = normalizeVector(crossVectors(up, zAxis));
  const yAxis = crossVectors(zAxis, xAxis);

  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dotVectors(xAxis, eye), -dotVectors(yAxis, eye), -dotVectors(zAxis, eye), 1,
  ]);
}

/**
 * 根据轨道相机的 yaw、pitch 和 radius 计算相机位置。
 * @param {number} yawRad 围绕 y 轴旋转的角度，单位为弧度。
 * @param {number} pitchRad 围绕 x 轴上下抬头的角度，单位为弧度。
 * @param {number} radius 相机到目标点的距离。
 * @param {Vector3} target 轨道中心点。
 * @returns {Vector3} 当前轨道相机的世界坐标位置。
 */
export function createOrbitCameraPosition(
  yawRad: number,
  pitchRad: number,
  radius: number,
  target: Vector3
): Vector3 {
  const cosPitch = Math.cos(pitchRad);
  const sinPitch = Math.sin(pitchRad);
  const sinYaw = Math.sin(yawRad);
  const cosYaw = Math.cos(yawRad);

  return [
    target[0] + sinYaw * cosPitch * radius,
    target[1] + sinPitch * radius,
    target[2] + cosYaw * cosPitch * radius,
  ];
}
