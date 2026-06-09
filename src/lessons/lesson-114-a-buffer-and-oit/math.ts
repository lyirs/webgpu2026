export type Vector3 = [number, number, number];

/**
 * 创建一个 4x4 平移矩阵。
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
 * 创建一个 4x4 缩放矩阵。
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
 * 创建一个绕 X 轴旋转的 4x4 矩阵。
 * @param {number} radians 旋转角度，单位弧度。
 * @returns {Float32Array} 对应的旋转矩阵。
 */
export function createRotationXMatrix(radians: number): Float32Array {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return new Float32Array([
    1, 0, 0, 0,
    0, cosine, sine, 0,
    0, -sine, cosine, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * 创建一个绕 Y 轴旋转的 4x4 矩阵。
 * @param {number} radians 旋转角度，单位弧度。
 * @returns {Float32Array} 对应的旋转矩阵。
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
        left[row] * right[column * 4] +
        left[4 + row] * right[column * 4 + 1] +
        left[8 + row] * right[column * 4 + 2] +
        left[12 + row] * right[column * 4 + 3];
    }
  }

  return result;
}

/**
 * 创建一个透视投影矩阵。
 * @param {number} fieldOfViewRad 垂直视场角，单位为弧度。
 * @param {number} aspect 画布宽高比。
 * @param {number} near 近裁剪面距离。
 * @param {number} far 远裁剪面距离。
 * @returns {Float32Array} 对应的透视投影矩阵。
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
 * @returns {Vector3} 垂直于两者的结果向量。
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
 * 把一个向量单位化。
 * @param {Vector3} vector 原始向量。
 * @returns {Vector3} 单位化结果；如果输入为零向量，则返回 [0, 0, 0]。
 */
export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length === 0) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * 创建一个 look-at 视图矩阵。
 * @param {Vector3} eye 相机位置。
 * @param {Vector3} target 相机观察目标。
 * @param {Vector3} up 用来约束头顶朝向的参考向量。
 * @returns {Float32Array} 对应的视图矩阵。
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
