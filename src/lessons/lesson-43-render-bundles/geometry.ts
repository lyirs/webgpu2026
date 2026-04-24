export type RenderBundleLessonGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

/**
 * 创建一份只包含位置和法线的单位立方体数据。
 * @returns {RenderBundleLessonGeometry} 供整圈静态物体复用的基础盒体网格。
 */
export function createRenderBundleLessonGeometry(): RenderBundleLessonGeometry {
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
