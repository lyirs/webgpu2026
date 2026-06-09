/**
 * 创建一个 4x4 单位矩阵。
 * @returns {Float32Array} 主对角线为 1 的 column-major 矩阵。
 */
function createIdentityMatrix(): Float32Array {
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
 * 创建一个平移矩阵。
 * @param {number} x 在 x 轴上的平移量。
 * @param {number} y 在 y 轴上的平移量。
 * @param {number} z 在 z 轴上的平移量。
 * @returns {Float32Array} 对应的 4x4 平移矩阵。
 */
export function createTranslationMatrix(
  x: number,
  y: number,
  z: number
): Float32Array {
  const matrix = createIdentityMatrix();
  matrix[12] = x;
  matrix[13] = y;
  matrix[14] = z;
  return matrix;
}

/**
 * 创建绕 x 轴旋转的矩阵。
 * @param {number} angleRad 旋转角度，单位为弧度。
 * @returns {Float32Array} 对应的 4x4 旋转矩阵。
 */
export function createRotationXMatrix(angleRad: number): Float32Array {
  const sine = Math.sin(angleRad);
  const cosine = Math.cos(angleRad);

  return new Float32Array([
    1, 0, 0, 0,
    0, cosine, sine, 0,
    0, -sine, cosine, 0,
    0, 0, 0, 1,
  ]);
}

/**
 * 创建绕 y 轴旋转的矩阵。
 * @param {number} angleRad 旋转角度，单位为弧度。
 * @returns {Float32Array} 对应的 4x4 旋转矩阵。
 */
export function createRotationYMatrix(angleRad: number): Float32Array {
  const sine = Math.sin(angleRad);
  const cosine = Math.cos(angleRad);

  return new Float32Array([
    cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1,
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
 * 创建第 4 课要写入 uniform buffer 的 MVP 矩阵。
 * @param {number} aspect 当前画布的宽高比。
 * @param {number} timeSeconds 当前动画已经运行的秒数。
 * @returns {Float32Array} `projection * view * model` 的最终矩阵结果。
 */
export function createModelViewProjectionMatrix(
  aspect: number,
  timeSeconds: number
): Float32Array {
  const projectionMatrix = createPerspectiveMatrix(
    (60 * Math.PI) / 180,
    aspect,
    0.1,
    100
  );
  const viewMatrix = createTranslationMatrix(0, 0, -4.5);
  const rotationXMatrix = createRotationXMatrix(timeSeconds * 0.7);
  const rotationYMatrix = createRotationYMatrix(timeSeconds * 1.1);
  const modelMatrix = multiplyMatrices(rotationYMatrix, rotationXMatrix);
  const viewModelMatrix = multiplyMatrices(viewMatrix, modelMatrix);

  return multiplyMatrices(projectionMatrix, viewModelMatrix);
}
