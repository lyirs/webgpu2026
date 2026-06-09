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
 * 计算两个向量的叉积。
 * @param {Vector3} left 左侧向量。
 * @param {Vector3} right 右侧向量。
 * @returns {Vector3} 垂直于两者的向量结果。
 */
export function crossVectors(left: Vector3, right: Vector3): Vector3 {
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
export function dotVectors(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

/**
 * 把一个 3D 向量单位化。
 * @param {Vector3} vector 原始向量。
 * @returns {Vector3} 长度为 1 的方向向量；如果输入是零向量，则返回 [0, 0, 0]。
 */
export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length === 0) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * 计算一个向量和标量的乘积。
 * @param {Vector3} vector 原始向量。
 * @param {number} scalar 缩放系数。
 * @returns {Vector3} 缩放后的向量。
 */
export function scaleVector(vector: Vector3, scalar: number): Vector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

/**
 * 计算两个向量的和。
 * @param {Vector3} left 左侧向量。
 * @param {Vector3} right 右侧向量。
 * @returns {Vector3} 两个向量相加后的结果。
 */
export function addVectors(left: Vector3, right: Vector3): Vector3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
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
  const back = normalizeVector([
    eye[0] - target[0],
    eye[1] - target[1],
    eye[2] - target[2],
  ]);
  const right = normalizeVector(crossVectors(up, back));
  const cameraUp = crossVectors(back, right);

  return new Float32Array([
    right[0], cameraUp[0], back[0], 0,
    right[1], cameraUp[1], back[1], 0,
    right[2], cameraUp[2], back[2], 0,
    -dotVectors(right, eye), -dotVectors(cameraUp, eye), -dotVectors(back, eye), 1,
  ]);
}

/**
 * 使用罗德里格斯公式让一个向量绕指定轴旋转。
 * @param {Vector3} vector 要旋转的向量。
 * @param {Vector3} axis 旋转轴；调用前应保证它是单位向量。
 * @param {number} angleRad 旋转角度，单位为弧度。
 * @returns {Vector3} 旋转后的向量。
 */
export function rotateVectorAroundAxis(
  vector: Vector3,
  axis: Vector3,
  angleRad: number
): Vector3 {
  const cosine = Math.cos(angleRad);
  const sine = Math.sin(angleRad);
  const cross = crossVectors(axis, vector);
  const dot = dotVectors(axis, vector);

  return [
    vector[0] * cosine + cross[0] * sine + axis[0] * dot * (1 - cosine),
    vector[1] * cosine + cross[1] * sine + axis[1] * dot * (1 - cosine),
    vector[2] * cosine + cross[2] * sine + axis[2] * dot * (1 - cosine),
  ];
}
