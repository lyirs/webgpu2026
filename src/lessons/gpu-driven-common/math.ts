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
 * @returns {Vector3} 同时垂直于两者的结果向量。
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
 * @returns {Vector3} 单位化之后的结果；如果输入长度接近 0，则返回零向量。
 */
export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length < 0.000001) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * 创建一个 column-major 4x4 透视投影矩阵。
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
 * 创建一个 column-major 4x4 look-at 视图矩阵。
 * @param {Vector3} eye 相机位置。
 * @param {Vector3} target 观察目标。
 * @param {Vector3} up 用来约束相机朝上的参考方向。
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
 * 以 column-major 规则相乘两个 4x4 矩阵。
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
 * 用 4x4 矩阵变换一个三维点，并返回齐次坐标。
 * @param {Float32Array} matrix 4x4 column-major 矩阵。
 * @param {Vector3} point 要变换的点。
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
 * 从 viewProjection 矩阵中提取 6 个视锥平面。
 * @param {Float32Array} matrix 当前相机的 viewProjection 矩阵。
 * @returns {Float32Array} 长度为 24 的连续平面数组，每 4 个 float 表示一个 `ax + by + cz + d = 0` 平面。
 */
export function extractFrustumPlanes(matrix: Float32Array): Float32Array {
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

  const rawPlanes: Array<[number, number, number, number]> = [
    [m03 + m00, m13 + m10, m23 + m20, m33 + m30],
    [m03 - m00, m13 - m10, m23 - m20, m33 - m30],
    [m03 + m01, m13 + m11, m23 + m21, m33 + m31],
    [m03 - m01, m13 - m11, m23 - m21, m33 - m31],
    [m03 + m02, m13 + m12, m23 + m22, m33 + m32],
    [m03 - m02, m13 - m12, m23 - m22, m33 - m32],
  ];

  const planes = new Float32Array(24);

  rawPlanes.forEach((plane, planeIndex) => {
    const length = Math.hypot(plane[0], plane[1], plane[2]) || 1;
    const offset = planeIndex * 4;

    planes[offset] = plane[0] / length;
    planes[offset + 1] = plane[1] / length;
    planes[offset + 2] = plane[2] / length;
    planes[offset + 3] = plane[3] / length;
  });

  return planes;
}

/**
 * 判断一个包围球是否和当前视锥相交。
 * @param {Float32Array} planes 视锥平面数组，每 4 个 float 表示一个平面。
 * @param {Vector3} center 包围球中心。
 * @param {number} radius 包围球半径。
 * @returns {boolean} `true` 表示当前球体在视锥内或与其相交。
 */
export function sphereIntersectsFrustum(
  planes: Float32Array,
  center: Vector3,
  radius: number
): boolean {
  for (let planeIndex = 0; planeIndex < 6; planeIndex += 1) {
    const offset = planeIndex * 4;
    const distance =
      planes[offset] * center[0] +
      planes[offset + 1] * center[1] +
      planes[offset + 2] * center[2] +
      planes[offset + 3];

    if (distance < -radius) {
      return false;
    }
  }

  return true;
}
