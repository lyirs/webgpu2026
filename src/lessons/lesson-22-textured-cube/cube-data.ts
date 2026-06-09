export type TexturedCubeGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

/**
 * 创建一个带位置、顶点颜色和 UV 的立方体几何数据。
 * @returns {TexturedCubeGeometry} 包含 [x, y, z, r, g, b, u, v] 顶点数组、索引数组和索引数量的立方体数据。
 */
export function createTexturedCubeGeometry(): TexturedCubeGeometry {
  /**
   * Float32Array
   * @param {ArrayLike<number>} source 一组 32 位浮点数；这里按 [x, y, z, r, g, b, u, v] 的顺序交错存放每个顶点的数据。
   * @returns {Float32Array} 可直接写入 vertex buffer 的连续顶点数组。
   */
  const vertexData = new Float32Array([
    // front
    -1, 1, 1, 1.0, 0.58, 0.42, 0, 0,
    -1, -1, 1, 1.0, 0.58, 0.42, 0, 1,
    1, -1, 1, 1.0, 0.58, 0.42, 1, 1,
    1, 1, 1, 1.0, 0.58, 0.42, 1, 0,

    // right
    1, 1, 1, 0.39, 0.72, 1.0, 0, 0,
    1, -1, 1, 0.39, 0.72, 1.0, 0, 1,
    1, -1, -1, 0.39, 0.72, 1.0, 1, 1,
    1, 1, -1, 0.39, 0.72, 1.0, 1, 0,

    // back
    1, 1, -1, 0.48, 0.9, 0.73, 0, 0,
    1, -1, -1, 0.48, 0.9, 0.73, 0, 1,
    -1, -1, -1, 0.48, 0.9, 0.73, 1, 1,
    -1, 1, -1, 0.48, 0.9, 0.73, 1, 0,

    // left
    -1, 1, -1, 0.67, 0.63, 1.0, 0, 0,
    -1, -1, -1, 0.67, 0.63, 1.0, 0, 1,
    -1, -1, 1, 0.67, 0.63, 1.0, 1, 1,
    -1, 1, 1, 0.67, 0.63, 1.0, 1, 0,

    // top
    -1, 1, -1, 0.98, 0.88, 0.44, 0, 0,
    -1, 1, 1, 0.98, 0.88, 0.44, 0, 1,
    1, 1, 1, 0.98, 0.88, 0.44, 1, 1,
    1, 1, -1, 0.98, 0.88, 0.44, 1, 0,

    // bottom
    -1, -1, 1, 0.36, 0.42, 0.92, 0, 0,
    -1, -1, -1, 0.36, 0.42, 0.92, 0, 1,
    1, -1, -1, 0.36, 0.42, 0.92, 1, 1,
    1, -1, 1, 0.36, 0.42, 0.92, 1, 0,
  ]);

  /**
   * Uint16Array
   * @param {ArrayLike<number>} source 一组 16 位无符号整数；这里每 6 个索引对应一个面的两个三角形。
   * @returns {Uint16Array} 可直接写入 index buffer 的连续索引数组。
   */
  const indexData = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  return {
    vertexData,
    indexData,
    indexCount: indexData.length,
  };
}
