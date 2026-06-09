export type InstancedCubeGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

/**
 * 创建一个只包含位置和法线的立方体几何。
 * @returns {InstancedCubeGeometry} 包含 [x, y, z, nx, ny, nz] 顶点数组、索引数组和索引数量的立方体数据。
 */
export function createInstancedCubeGeometry(): InstancedCubeGeometry {
  const vertexData = new Float32Array([
    // front
    -1, 1, 1, 0, 0, 1,
    -1, -1, 1, 0, 0, 1,
    1, -1, 1, 0, 0, 1,
    1, 1, 1, 0, 0, 1,

    // right
    1, 1, 1, 1, 0, 0,
    1, -1, 1, 1, 0, 0,
    1, -1, -1, 1, 0, 0,
    1, 1, -1, 1, 0, 0,

    // back
    1, 1, -1, 0, 0, -1,
    1, -1, -1, 0, 0, -1,
    -1, -1, -1, 0, 0, -1,
    -1, 1, -1, 0, 0, -1,

    // left
    -1, 1, -1, -1, 0, 0,
    -1, -1, -1, -1, 0, 0,
    -1, -1, 1, -1, 0, 0,
    -1, 1, 1, -1, 0, 0,

    // top
    -1, 1, -1, 0, 1, 0,
    -1, 1, 1, 0, 1, 0,
    1, 1, 1, 0, 1, 0,
    1, 1, -1, 0, 1, 0,

    // bottom
    -1, -1, 1, 0, -1, 0,
    -1, -1, -1, 0, -1, 0,
    1, -1, -1, 0, -1, 0,
    1, -1, 1, 0, -1, 0,
  ]);

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
