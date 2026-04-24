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
 * 创建一个绕 x 轴旋转的 4x4 矩阵。
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
 * 把一个四元数转换成 4x4 旋转矩阵。
 * @param {Quaternion} quaternion glTF 节点里常见的 [x, y, z, w] 四元数。
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
 * 根据平移、旋转和缩放组合一个 glTF 节点的本地矩阵。
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
