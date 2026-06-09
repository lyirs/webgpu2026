export type GeometryMesh = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

export type VolumeLessonGeometry = {
  cube: GeometryMesh;
  plane: GeometryMesh;
};

/**
 * 创建第 43 课会复用的盒体和切片平面几何。
 * @returns {VolumeLessonGeometry} 包含单位立方体和单位平面的网格数据。
 */
export function createVolumeLessonGeometry(): VolumeLessonGeometry {
  const cubeVertexData = new Float32Array([
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

  const cubeIndexData = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  const planeVertexData = new Float32Array([
    -1, 1, 0, 0, 0, 1,
    -1, -1, 0, 0, 0, 1,
    1, -1, 0, 0, 0, 1,
    1, 1, 0, 0, 0, 1,
  ]);

  const planeIndexData = new Uint16Array([
    0, 1, 2, 0, 2, 3,
  ]);

  return {
    cube: {
      vertexData: cubeVertexData,
      indexData: cubeIndexData,
      indexCount: cubeIndexData.length,
    },
    plane: {
      vertexData: planeVertexData,
      indexData: planeIndexData,
      indexCount: planeIndexData.length,
    },
  };
}
