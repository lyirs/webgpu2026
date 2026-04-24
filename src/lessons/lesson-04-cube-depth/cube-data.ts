export type CubeGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

/**
 * 创建一个最小可用的立方体几何数据。
 * @returns {CubeGeometry} 包含 position + color 顶点数组、索引数组和索引数量的立方体数据。
 */
export function createCubeGeometry(): CubeGeometry {
  /**
   * Float32Array
   * @param {ArrayLike<number>} source 一组 32 位浮点数；这里按 [x, y, z, r, g, b] 的顺序交错存放每个顶点的数据。
   * @returns {Float32Array} 可直接写入 vertex buffer 的连续浮点数组。
   */
  const vertexData = new Float32Array([
    -1, -1, 1, 1.0, 0.43, 0.29,
    1, -1, 1, 1.0, 0.82, 0.32,
    1, 1, 1, 0.96, 0.94, 0.46,
    -1, 1, 1, 0.67, 0.95, 0.45,
    -1, -1, -1, 0.26, 0.65, 1.0,
    1, -1, -1, 0.34, 0.84, 1.0,
    1, 1, -1, 0.63, 0.56, 1.0,
    -1, 1, -1, 0.43, 0.54, 0.98,
  ]);

  /**
   * Uint16Array
   * @param {ArrayLike<number>} source 一组 16 位无符号整数；这里每 3 个索引组成一个三角形。
   * @returns {Uint16Array} 可直接写入 index buffer 的连续索引数组。
   */
  const indexData = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    1, 5, 6, 1, 6, 2,
    5, 4, 7, 5, 7, 6,
    4, 0, 3, 4, 3, 7,
    3, 2, 6, 3, 6, 7,
    4, 5, 1, 4, 1, 0,
  ]);

  return {
    vertexData,
    indexData,
    indexCount: indexData.length,
  };
}
