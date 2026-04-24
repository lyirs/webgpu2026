export type DepthPrecisionSceneGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

/**
 * 创建一个位于 XY 平面的单位四边形，后续会把它缩放成前后几乎重合的测试卡片。
 * @returns {DepthPrecisionSceneGeometry} 包含顶点与索引数据的最小场景几何。
 */
export function createDepthPrecisionSceneGeometry(): DepthPrecisionSceneGeometry {
  return {
    vertexData: new Float32Array([
      -0.5, -0.5, 0,
      0.5, -0.5, 0,
      0.5, 0.5, 0,
      -0.5, 0.5, 0,
    ]),
    indexData: new Uint16Array([0, 1, 2, 0, 2, 3]),
    indexCount: 6,
  };
}
