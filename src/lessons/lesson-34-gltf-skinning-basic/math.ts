export type Vector3 = [number, number, number];
export type Quaternion = [number, number, number, number];

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
 * 把一个四元数转换成 4x4 旋转矩阵。
 * @param {Quaternion} quaternion glTF 节点常见的 `[x, y, z, w]` 四元数。
 * @returns {Float32Array} 对应的旋转矩阵。
 */
export function createQuaternionMatrix(
  quaternion: Quaternion
): Float32Array {
  const [x, y, z, w] = quaternion;
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  const xy = x * y;
  const xz = x * z;
  const yz = y * z;
  const wx = w * x;
  const wy = w * y;
  const wz = w * z;

  return new Float32Array([
    1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
    2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
    2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
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
 * 对一个 4x4 矩阵求逆。
 * @param {Float32Array} matrix 要求逆的 4x4 矩阵。
 * @returns {Float32Array} 对应的逆矩阵；如果矩阵不可逆，则返回单位矩阵。
 */
export function invertMatrix(matrix: Float32Array): Float32Array {
  const result = new Float32Array(16);

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

  result[0] =
    m11 * m22 * m33 -
    m11 * m23 * m32 -
    m21 * m12 * m33 +
    m21 * m13 * m32 +
    m31 * m12 * m23 -
    m31 * m13 * m22;
  result[4] =
    -m10 * m22 * m33 +
    m10 * m23 * m32 +
    m20 * m12 * m33 -
    m20 * m13 * m32 -
    m30 * m12 * m23 +
    m30 * m13 * m22;
  result[8] =
    m10 * m21 * m33 -
    m10 * m23 * m31 -
    m20 * m11 * m33 +
    m20 * m13 * m31 +
    m30 * m11 * m23 -
    m30 * m13 * m21;
  result[12] =
    -m10 * m21 * m32 +
    m10 * m22 * m31 +
    m20 * m11 * m32 -
    m20 * m12 * m31 -
    m30 * m11 * m22 +
    m30 * m12 * m21;
  result[1] =
    -m01 * m22 * m33 +
    m01 * m23 * m32 +
    m21 * m02 * m33 -
    m21 * m03 * m32 -
    m31 * m02 * m23 +
    m31 * m03 * m22;
  result[5] =
    m00 * m22 * m33 -
    m00 * m23 * m32 -
    m20 * m02 * m33 +
    m20 * m03 * m32 +
    m30 * m02 * m23 -
    m30 * m03 * m22;
  result[9] =
    -m00 * m21 * m33 +
    m00 * m23 * m31 +
    m20 * m01 * m33 -
    m20 * m03 * m31 -
    m30 * m01 * m23 +
    m30 * m03 * m21;
  result[13] =
    m00 * m21 * m32 -
    m00 * m22 * m31 -
    m20 * m01 * m32 +
    m20 * m02 * m31 +
    m30 * m01 * m22 -
    m30 * m02 * m21;
  result[2] =
    m01 * m12 * m33 -
    m01 * m13 * m32 -
    m11 * m02 * m33 +
    m11 * m03 * m32 +
    m31 * m02 * m13 -
    m31 * m03 * m12;
  result[6] =
    -m00 * m12 * m33 +
    m00 * m13 * m32 +
    m10 * m02 * m33 -
    m10 * m03 * m32 -
    m30 * m02 * m13 +
    m30 * m03 * m12;
  result[10] =
    m00 * m11 * m33 -
    m00 * m13 * m31 -
    m10 * m01 * m33 +
    m10 * m03 * m31 +
    m30 * m01 * m13 -
    m30 * m03 * m11;
  result[14] =
    -m00 * m11 * m32 +
    m00 * m12 * m31 +
    m10 * m01 * m32 -
    m10 * m02 * m31 -
    m30 * m01 * m12 +
    m30 * m02 * m11;
  result[3] =
    -m01 * m12 * m23 +
    m01 * m13 * m22 +
    m11 * m02 * m23 -
    m11 * m03 * m22 -
    m21 * m02 * m13 +
    m21 * m03 * m12;
  result[7] =
    m00 * m12 * m23 -
    m00 * m13 * m22 -
    m10 * m02 * m23 +
    m10 * m03 * m22 +
    m20 * m02 * m13 -
    m20 * m03 * m12;
  result[11] =
    -m00 * m11 * m23 +
    m00 * m13 * m21 +
    m10 * m01 * m23 -
    m10 * m03 * m21 -
    m20 * m01 * m13 +
    m20 * m03 * m11;
  result[15] =
    m00 * m11 * m22 -
    m00 * m12 * m21 -
    m10 * m01 * m22 +
    m10 * m02 * m21 +
    m20 * m01 * m12 -
    m20 * m02 * m11;

  const determinant =
    m00 * result[0] +
    m01 * result[4] +
    m02 * result[8] +
    m03 * result[12];

  if (Math.abs(determinant) <= 1e-8) {
    return createIdentityMatrix();
  }

  const inverseDeterminant = 1 / determinant;
  for (let index = 0; index < 16; index += 1) {
    result[index] *= inverseDeterminant;
  }

  return result;
}

/**
 * 根据平移、旋转和缩放组合一个节点本地矩阵。
 * @param {Vector3} translation 平移量。
 * @param {Quaternion} rotation 四元数旋转。
 * @param {Vector3} scale 缩放量。
 * @returns {Float32Array} 节点的本地变换矩阵。
 */
export function composeNodeMatrix(
  translation: Vector3,
  rotation: Quaternion,
  scale: Vector3
): Float32Array {
  return multiplyMatrices(
    createTranslationMatrix(translation[0], translation[1], translation[2]),
    multiplyMatrices(
      createQuaternionMatrix(rotation),
      createScaleMatrix(scale[0], scale[1], scale[2])
    )
  );
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
 * @returns {Vector3} 长度为 1 的方向向量；如果输入是零向量，则返回 `[0, 0, 0]`。
 */
export function normalizeVector(vector: Vector3): Vector3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);

  if (length <= 1e-6) {
    return [0, 0, 0];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/**
 * 把一个四元数归一化。
 * @param {Quaternion} quaternion 原始四元数。
 * @returns {Quaternion} 长度为 1 的四元数。
 */
export function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const length = Math.hypot(
    quaternion[0],
    quaternion[1],
    quaternion[2],
    quaternion[3]
  );

  if (length <= 1e-6) {
    return [0, 0, 0, 1];
  }

  return [
    quaternion[0] / length,
    quaternion[1] / length,
    quaternion[2] / length,
    quaternion[3] / length,
  ];
}

/**
 * 对两个三维向量做线性插值。
 * @param {Vector3} start 起点向量。
 * @param {Vector3} end 终点向量。
 * @param {number} alpha 插值系数，范围 `[0, 1]`。
 * @returns {Vector3} 插值结果。
 */
export function lerpVector3(
  start: Vector3,
  end: Vector3,
  alpha: number
): Vector3 {
  return [
    start[0] + (end[0] - start[0]) * alpha,
    start[1] + (end[1] - start[1]) * alpha,
    start[2] + (end[2] - start[2]) * alpha,
  ];
}

/**
 * 对两个四元数做最短路径球面插值。
 * @param {Quaternion} start 起始四元数。
 * @param {Quaternion} end 结束四元数。
 * @param {number} alpha 插值系数，范围 `[0, 1]`。
 * @returns {Quaternion} 插值后的旋转四元数。
 */
export function slerpQuaternion(
  start: Quaternion,
  end: Quaternion,
  alpha: number
): Quaternion {
  let target = [...end] as Quaternion;
  let cosine =
    start[0] * target[0] +
    start[1] * target[1] +
    start[2] * target[2] +
    start[3] * target[3];

  if (cosine < 0) {
    cosine = -cosine;
    target = [-target[0], -target[1], -target[2], -target[3]];
  }

  if (cosine > 0.9995) {
    return normalizeQuaternion([
      start[0] + (target[0] - start[0]) * alpha,
      start[1] + (target[1] - start[1]) * alpha,
      start[2] + (target[2] - start[2]) * alpha,
      start[3] + (target[3] - start[3]) * alpha,
    ]);
  }

  const theta = Math.acos(cosine);
  const sine = Math.sin(theta);
  const startWeight = Math.sin((1 - alpha) * theta) / sine;
  const endWeight = Math.sin(alpha * theta) / sine;

  return normalizeQuaternion([
    start[0] * startWeight + target[0] * endWeight,
    start[1] * startWeight + target[1] * endWeight,
    start[2] * startWeight + target[2] * endWeight,
    start[3] * startWeight + target[3] * endWeight,
  ]);
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
