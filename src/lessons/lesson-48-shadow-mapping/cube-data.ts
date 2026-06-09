export type ShadowMeshGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

export type ShadowSceneGeometry = {
  cube: ShadowMeshGeometry;
  plane: ShadowMeshGeometry;
};

/**
 * 创建一个带法线和顶点颜色的 box 几何。
 * @param {Array<[number, number, number]>} faceColors 六个面的颜色，顺序为 right/left/top/bottom/front/back。
 * @returns {ShadowMeshGeometry} 可直接送进 GPU 的 box 顶点和索引数据。
 */
function createBoxGeometry(
  faceColors: Array<[number, number, number]>
): ShadowMeshGeometry {
  const [
    rightColor,
    leftColor,
    topColor,
    bottomColor,
    frontColor,
    backColor,
  ] = faceColors;

  return {
    vertexData: new Float32Array([
      // right
      0.5, 0.5, 0.5, ...rightColor, 1, 0, 0,
      0.5, 0.5, -0.5, ...rightColor, 1, 0, 0,
      0.5, -0.5, 0.5, ...rightColor, 1, 0, 0,
      0.5, -0.5, -0.5, ...rightColor, 1, 0, 0,

      // left
      -0.5, 0.5, -0.5, ...leftColor, -1, 0, 0,
      -0.5, 0.5, 0.5, ...leftColor, -1, 0, 0,
      -0.5, -0.5, -0.5, ...leftColor, -1, 0, 0,
      -0.5, -0.5, 0.5, ...leftColor, -1, 0, 0,

      // top
      -0.5, 0.5, -0.5, ...topColor, 0, 1, 0,
      0.5, 0.5, -0.5, ...topColor, 0, 1, 0,
      -0.5, 0.5, 0.5, ...topColor, 0, 1, 0,
      0.5, 0.5, 0.5, ...topColor, 0, 1, 0,

      // bottom
      -0.5, -0.5, 0.5, ...bottomColor, 0, -1, 0,
      0.5, -0.5, 0.5, ...bottomColor, 0, -1, 0,
      -0.5, -0.5, -0.5, ...bottomColor, 0, -1, 0,
      0.5, -0.5, -0.5, ...bottomColor, 0, -1, 0,

      // front
      -0.5, 0.5, 0.5, ...frontColor, 0, 0, 1,
      0.5, 0.5, 0.5, ...frontColor, 0, 0, 1,
      -0.5, -0.5, 0.5, ...frontColor, 0, 0, 1,
      0.5, -0.5, 0.5, ...frontColor, 0, 0, 1,

      // back
      0.5, 0.5, -0.5, ...backColor, 0, 0, -1,
      -0.5, 0.5, -0.5, ...backColor, 0, 0, -1,
      0.5, -0.5, -0.5, ...backColor, 0, 0, -1,
      -0.5, -0.5, -0.5, ...backColor, 0, 0, -1,
    ]),
    indexData: new Uint16Array([
      0, 2, 1, 2, 3, 1,
      4, 6, 5, 6, 7, 5,
      8, 10, 9, 10, 11, 9,
      12, 14, 13, 14, 15, 13,
      16, 18, 17, 18, 19, 17,
      20, 22, 21, 22, 23, 21,
    ]),
    indexCount: 36,
  };
}

/**
 * 创建第 11 课需要的场景几何：一个投影柱体和一个接收阴影的平台。
 * @returns {ShadowSceneGeometry} 分别包含立方体和地面的顶点数据、索引数据与索引数量。
 */
export function createShadowSceneGeometry(): ShadowSceneGeometry {
  const cube = createBoxGeometry([
    [0.82, 0.48, 0.35],
    [0.31, 0.58, 0.84],
    [0.32, 0.2, 0.14],
    [0.24, 0.3, 0.4],
    [0.86, 0.75, 0.33],
    [0.18, 0.18, 0.2],
  ]);

  const plane = createBoxGeometry([
    [0.9, 0.92, 0.95],
    [0.76, 0.79, 0.84],
    [0.9, 0.92, 0.95],
    [0.76, 0.79, 0.84],
    [0.94, 0.95, 0.98],
    [0.68, 0.71, 0.78],
  ]);

  return {
    cube,
    plane,
  };
}
