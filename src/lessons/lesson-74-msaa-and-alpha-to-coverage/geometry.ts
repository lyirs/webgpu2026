export type MsaaSceneGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

/**
 * 创建一份可复用的平面网格，地面和叶片卡片都共用这份几何。
 * @returns {MsaaSceneGeometry} 位置、法线、UV 交错排布的平面数据。
 */
export function createMsaaSceneGeometry(): MsaaSceneGeometry {
  const vertexData = new Float32Array([
    -1, 1, 0, 0, 0, 1, 0, 0,
    -1, -1, 0, 0, 0, 1, 0, 1,
    1, -1, 0, 0, 0, 1, 1, 1,
    1, 1, 0, 0, 0, 1, 1, 0,
  ]);

  const indexData = new Uint16Array([0, 1, 2, 0, 2, 3]);

  return {
    vertexData,
    indexData,
    indexCount: indexData.length,
  };
}
