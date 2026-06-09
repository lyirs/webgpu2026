export type SamplerDemoGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

/**
 * 创建一块带高频 UV 的采样演示面板。
 * @returns {SamplerDemoGeometry} 位置、法线、UV 都已经准备好的平面网格。
 */
export function createSamplerDemoGeometry(): SamplerDemoGeometry {
  const vertexData = new Float32Array([
    -1, 1, 0, 0, 0, 1, 0, 0,
    -1, -1, 0, 0, 0, 1, 0, 8,
    1, -1, 0, 0, 0, 1, 10, 8,
    1, 1, 0, 0, 0, 1, 10, 0,
  ]);

  const indexData = new Uint16Array([0, 1, 2, 0, 2, 3]);

  return {
    vertexData,
    indexData,
    indexCount: indexData.length,
  };
}
