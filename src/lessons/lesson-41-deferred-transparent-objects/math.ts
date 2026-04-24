export type Vector3 = [number, number, number];

/**
 * 创建 4x4 单位矩阵。
 * @returns {Float32Array} 单位矩阵。
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
 * 创建平移矩阵。
 * @param {number} x x 方向位移。
 * @param {number} y y 方向位移。
 * @param {number} z z 方向位移。
 * @returns {Float32Array} 4x4 平移矩阵。
 */
export function createTranslationMatrix(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

/**
 * 创建绕 y 轴旋转矩阵。
 * @param {number} radians 旋转弧度。
 * @returns {Float32Array} 4x4 旋转矩阵。
 */
export function createRotationYMatrix(radians: number): Float32Array {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return new Float32Array([
    cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * 创建缩放矩阵。
 * @param {number} x x 方向缩放。
 * @param {number} y y 方向缩放。
 * @param {number} z z 方向缩放。
 * @returns {Float32Array} 4x4 缩放矩阵。
 */
export function createScaleMatrix(x: number, y: number, z: number): Float32Array {
  return new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * 以 column-major 规则相乘两个 4x4 矩阵。
 * @param {Float32Array} left 左侧矩阵。
 * @param {Float32Array} right 右侧矩阵。
 * @returns {Float32Array} `left * right` 的乘积矩阵。
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
 * 对三维向量做归一化。
 * @param {Vector3} vector 输入向量。
 * @returns {Vector3} 归一化后的向量。
 */
export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length < 1e-6) {
    return [0, 0, 0];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * 计算两个向量的叉积。
 * @param {Vector3} a 第一个向量。
 * @param {Vector3} b 第二个向量。
 * @returns {Vector3} 叉积结果。
 */
export function crossProduct(a: Vector3, b: Vector3): Vector3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * 计算向量减法。
 * @param {Vector3} a 被减数。
 * @param {Vector3} b 减数。
 * @returns {Vector3} a - b。
 */
export function subtractVectors(a: Vector3, b: Vector3): Vector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/**
 * 创建 look-at 视图矩阵。
 * @param {Vector3} eye 相机位置。
 * @param {Vector3} target 观察目标。
 * @param {Vector3} up 世界向上方向。
 * @returns {Float32Array} 4x4 视图矩阵。
 */
export function createLookAtViewMatrix(
  eye: Vector3,
  target: Vector3,
  up: Vector3
): Float32Array {
  const back = normalizeVector(subtractVectors(eye, target));
  const right = normalizeVector(crossProduct(up, back));
  const cameraUp = crossProduct(back, right);

  return new Float32Array([
    right[0], cameraUp[0], back[0], 0,
    right[1], cameraUp[1], back[1], 0,
    right[2], cameraUp[2], back[2], 0,
    -(right[0] * eye[0] + right[1] * eye[1] + right[2] * eye[2]),
    -(cameraUp[0] * eye[0] + cameraUp[1] * eye[1] + cameraUp[2] * eye[2]),
    -(back[0] * eye[0] + back[1] * eye[1] + back[2] * eye[2]),
    1,
  ]);
}

/**
 * 创建透视投影矩阵。
 * @param {number} fieldOfViewY 垂直视角弧度。
 * @param {number} aspect 画布宽高比。
 * @param {number} near 近裁剪面。
 * @param {number} far 远裁剪面。
 * @returns {Float32Array} 4x4 透视投影矩阵。
 */
export function createPerspectiveMatrix(
  fieldOfViewY: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1 / Math.tan(fieldOfViewY / 2);
  const rangeInv = 1 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, far * rangeInv, -1,
    0, 0, near * far * rangeInv, 0,
  ]);
}
