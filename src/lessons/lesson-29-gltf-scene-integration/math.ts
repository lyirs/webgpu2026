export type Vector3 = [number, number, number];

/**
 * 创建一个 4x4 单位矩阵。
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
 * 创建一个绕 y 轴旋转的 4x4 矩阵。
 * @param {number} angleRad 旋转角度，单位为弧度。
 * @returns {Float32Array} 对应的旋转矩阵。
 */
export function createRotationYMatrix(angleRad: number): Float32Array {
  const cosine = Math.cos(angleRad);
  const sine = Math.sin(angleRad);

  return new Float32Array([
    cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * 创建一个平移矩阵。
 * @param {number} x x 方向位移。
 * @param {number} y y 方向位移。
 * @param {number} z z 方向位移。
 * @returns {Float32Array} 对应的平移矩阵。
 */
export function createTranslationMatrix(
  x: number,
  y: number,
  z: number
): Float32Array {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

/**
 * 创建一个缩放矩阵。
 * @param {number} x x 方向缩放。
 * @param {number} y y 方向缩放。
 * @param {number} z z 方向缩放。
 * @returns {Float32Array} 对应的缩放矩阵。
 */
export function createScaleMatrix(
  x: number,
  y: number,
  z: number
): Float32Array {
  return new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
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
 * 归一化一个 3D 向量。
 * @param {Vector3} vector 原始向量。
 * @returns {Vector3} 归一化后的单位向量。
 */
export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length <= 1e-6) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * 计算两个 3D 向量的叉乘。
 * @param {Vector3} left 左向量。
 * @param {Vector3} right 右向量。
 * @returns {Vector3} 叉乘结果。
 */
function cross(left: Vector3, right: Vector3): Vector3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

/**
 * 计算两个 3D 向量的点乘。
 * @param {Vector3} left 左向量。
 * @param {Vector3} right 右向量。
 * @returns {number} 点乘结果。
 */
function dot(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

/**
 * 创建一个透视投影矩阵。
 * @param {number} fovYRad 竖直方向视角，单位为弧度。
 * @param {number} aspect 画布宽高比。
 * @param {number} near 近裁剪面。
 * @param {number} far 远裁剪面。
 * @returns {Float32Array} 对应的 4x4 透视投影矩阵。
 */
export function createPerspectiveMatrix(
  fovYRad: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1 / Math.tan(fovYRad / 2);
  const rangeInv = 1 / (near - far);

  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * rangeInv, -1,
    0, 0, 2 * far * near * rangeInv, 0,
  ]);
}

/**
 * 创建一个 lookAt 视图矩阵。
 * @param {Vector3} eye 相机位置。
 * @param {Vector3} target 相机观察目标。
 * @param {Vector3} up 世界空间里的上方向。
 * @returns {Float32Array} 对应的 4x4 视图矩阵。
 */
export function createLookAtViewMatrix(
  eye: Vector3,
  target: Vector3,
  up: Vector3
): Float32Array {
  const forward = normalizeVector([
    eye[0] - target[0],
    eye[1] - target[1],
    eye[2] - target[2],
  ]);
  const right = normalizeVector(cross(up, forward));
  const cameraUp = cross(forward, right);

  return new Float32Array([
    right[0], cameraUp[0], forward[0], 0,
    right[1], cameraUp[1], forward[1], 0,
    right[2], cameraUp[2], forward[2], 0,
    -dot(right, eye), -dot(cameraUp, eye), -dot(forward, eye), 1,
  ]);
}
