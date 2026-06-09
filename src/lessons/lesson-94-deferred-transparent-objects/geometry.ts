export type MeshData = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

export type DeferredTransparentSceneGeometry = {
  cube: MeshData;
  quad: MeshData;
};

/**
 * 创建第 38 课要用到的共享几何：立方体负责不透明场景，竖直四边形负责半透明玻璃板。
 * @returns {DeferredTransparentSceneGeometry} 包含 cube 和 quad 两套网格数据。
 */
export function createDeferredTransparentSceneGeometry(): DeferredTransparentSceneGeometry {
  const cubeVertexData = new Float32Array([
    -1, -1, 1, 0, 0, 1,
    1, -1, 1, 0, 0, 1,
    1, 1, 1, 0, 0, 1,
    -1, 1, 1, 0, 0, 1,

    1, -1, -1, 0, 0, -1,
    -1, -1, -1, 0, 0, -1,
    -1, 1, -1, 0, 0, -1,
    1, 1, -1, 0, 0, -1,

    -1, -1, -1, -1, 0, 0,
    -1, -1, 1, -1, 0, 0,
    -1, 1, 1, -1, 0, 0,
    -1, 1, -1, -1, 0, 0,

    1, -1, 1, 1, 0, 0,
    1, -1, -1, 1, 0, 0,
    1, 1, -1, 1, 0, 0,
    1, 1, 1, 1, 0, 0,

    -1, 1, 1, 0, 1, 0,
    1, 1, 1, 0, 1, 0,
    1, 1, -1, 0, 1, 0,
    -1, 1, -1, 0, 1, 0,

    -1, -1, -1, 0, -1, 0,
    1, -1, -1, 0, -1, 0,
    1, -1, 1, 0, -1, 0,
    -1, -1, 1, 0, -1, 0,
  ]);

  const cubeIndexData = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  const quadVertexData = new Float32Array([
    -1, -1, 0, 0, 0, 1,
    1, -1, 0, 0, 0, 1,
    1, 1, 0, 0, 0, 1,
    -1, 1, 0, 0, 0, 1,
  ]);

  const quadIndexData = new Uint16Array([0, 1, 2, 0, 2, 3]);

  return {
    cube: {
      vertexData: cubeVertexData,
      indexData: cubeIndexData,
      indexCount: cubeIndexData.length,
    },
    quad: {
      vertexData: quadVertexData,
      indexData: quadIndexData,
      indexCount: quadIndexData.length,
    },
  };
}
