export type Vector3 = [number, number, number];

/**
 * 把一个标量值限制在安全区间里。
 * @param {number} value 当前输入值。
 * @param {number} min 允许的最小值。
 * @param {number} max 允许的最大值。
 * @returns {number} 被夹在最小值和最大值之间的结果。
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 计算两个三维向量的点积。
 * @param {Vector3} left 左侧向量。
 * @param {Vector3} right 右侧向量。
 * @returns {number} 点积结果。
 */
export function dotVectors(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

/**
 * 计算两个三维向量的叉积。
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
 * 把一个三维向量单位化。
 * @param {Vector3} vector 原始向量。
 * @returns {Vector3} 单位化之后的结果；如果输入长度过小，则返回零向量。
 */
export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length < 0.000001) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * 创建一个 column-major 4x4 单位矩阵。
 * @returns {Float32Array} 对应的单位矩阵。
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
 * 创建一个 column-major 4x4 绕 x 轴旋转矩阵。
 * @param {number} angleRad 旋转角度，单位为弧度。
 * @returns {Float32Array} 对应的旋转矩阵。
 */
export function createRotationXMatrix(angleRad: number): Float32Array {
  const cosine = Math.cos(angleRad);
  const sine = Math.sin(angleRad);

  return new Float32Array([
    1, 0, 0, 0,
    0, cosine, sine, 0,
    0, -sine, cosine, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * 创建一个 column-major 4x4 绕 y 轴旋转矩阵。
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
 * 创建一个 column-major 4x4 绕 z 轴旋转矩阵。
 * @param {number} angleRad 旋转角度，单位为弧度。
 * @returns {Float32Array} 对应的旋转矩阵。
 */
export function createRotationZMatrix(angleRad: number): Float32Array {
  const cosine = Math.cos(angleRad);
  const sine = Math.sin(angleRad);

  return new Float32Array([
    cosine, sine, 0, 0,
    -sine, cosine, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * 创建一个 column-major 4x4 平移矩阵。
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
 * 创建一个 column-major 4x4 缩放矩阵。
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
 * @returns {Float32Array} `left * right` 的乘积。
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
 * 创建符合 WebGPU 深度范围的透视投影矩阵。
 * @param {number} fieldOfViewRad 垂直视场角，单位为弧度。
 * @param {number} aspect 画布宽高比。
 * @param {number} near 近裁剪面距离。
 * @param {number} far 远裁剪面距离。
 * @returns {Float32Array} 对应的投影矩阵。
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
 * 根据 eye / target / up 创建一个 look-at 视图矩阵。
 * @param {Vector3} eye 相机位置。
 * @param {Vector3} target 观察目标。
 * @param {Vector3} up 参考上方向。
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

/**
 * 用 4x4 矩阵变换一个三维点，并返回齐次坐标。
 * @param {Float32Array} matrix 4x4 column-major 矩阵。
 * @param {Vector3} point 当前要变换的点。
 * @returns {[number, number, number, number]} 变换后的 `x / y / z / w`。
 */
export function transformPoint(
  matrix: Float32Array,
  point: Vector3
): [number, number, number, number] {
  const x =
    matrix[0] * point[0] +
    matrix[4] * point[1] +
    matrix[8] * point[2] +
    matrix[12];
  const y =
    matrix[1] * point[0] +
    matrix[5] * point[1] +
    matrix[9] * point[2] +
    matrix[13];
  const z =
    matrix[2] * point[0] +
    matrix[6] * point[1] +
    matrix[10] * point[2] +
    matrix[14];
  const w =
    matrix[3] * point[0] +
    matrix[7] * point[1] +
    matrix[11] * point[2] +
    matrix[15];

  return [x, y, z, w];
}

/**
 * 用 4x4 矩阵变换一个方向向量。
 * @param {Float32Array} matrix 4x4 column-major 矩阵。
 * @param {Vector3} direction 要变换的方向。
 * @returns {Vector3} 变换后的方向向量。
 */
export function transformDirection(
  matrix: Float32Array,
  direction: Vector3
): Vector3 {
  return [
    matrix[0] * direction[0] + matrix[4] * direction[1] + matrix[8] * direction[2],
    matrix[1] * direction[0] + matrix[5] * direction[1] + matrix[9] * direction[2],
    matrix[2] * direction[0] + matrix[6] * direction[1] + matrix[10] * direction[2],
  ];
}

/**
 * 求一个 column-major 4x4 矩阵的逆矩阵。
 * @param {Float32Array} matrix 当前要取逆的矩阵。
 * @returns {Float32Array} 对应的逆矩阵；如果矩阵不可逆，则返回单位矩阵。
 */
export function invertMatrix(matrix: Float32Array): Float32Array {
  const m00 = matrix[0];
  const m01 = matrix[1];
  const m02 = matrix[2];
  const m03 = matrix[3];
  const m10 = matrix[4];
  const m11 = matrix[5];
  const m12 = matrix[6];
  const m13 = matrix[7];
  const m20 = matrix[8];
  const m21 = matrix[9];
  const m22 = matrix[10];
  const m23 = matrix[11];
  const m30 = matrix[12];
  const m31 = matrix[13];
  const m32 = matrix[14];
  const m33 = matrix[15];

  const b00 = m00 * m11 - m01 * m10;
  const b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10;
  const b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11;
  const b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30;
  const b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30;
  const b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31;
  const b11 = m22 * m33 - m23 * m32;

  const determinant =
    b00 * b11 -
    b01 * b10 +
    b02 * b09 +
    b03 * b08 -
    b04 * b07 +
    b05 * b06;

  if (Math.abs(determinant) < 0.000001) {
    return createIdentityMatrix();
  }

  const inverseDeterminant = 1 / determinant;

  return new Float32Array([
    (m11 * b11 - m12 * b10 + m13 * b09) * inverseDeterminant,
    (-m01 * b11 + m02 * b10 - m03 * b09) * inverseDeterminant,
    (m31 * b05 - m32 * b04 + m33 * b03) * inverseDeterminant,
    (-m21 * b05 + m22 * b04 - m23 * b03) * inverseDeterminant,
    (-m10 * b11 + m12 * b08 - m13 * b07) * inverseDeterminant,
    (m00 * b11 - m02 * b08 + m03 * b07) * inverseDeterminant,
    (-m30 * b05 + m32 * b02 - m33 * b01) * inverseDeterminant,
    (m20 * b05 - m22 * b02 + m23 * b01) * inverseDeterminant,
    (m10 * b10 - m11 * b08 + m13 * b06) * inverseDeterminant,
    (-m00 * b10 + m01 * b08 - m03 * b06) * inverseDeterminant,
    (m30 * b04 - m31 * b02 + m33 * b00) * inverseDeterminant,
    (-m20 * b04 + m21 * b02 - m23 * b00) * inverseDeterminant,
    (-m10 * b09 + m11 * b07 - m12 * b06) * inverseDeterminant,
    (m00 * b09 - m01 * b07 + m02 * b06) * inverseDeterminant,
    (-m30 * b03 + m31 * b01 - m32 * b00) * inverseDeterminant,
    (m20 * b03 - m21 * b01 + m22 * b00) * inverseDeterminant,
  ]);
}
