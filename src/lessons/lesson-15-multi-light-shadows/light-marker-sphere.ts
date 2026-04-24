export type SphereMesh = {
  vertexData: Float32Array;
  indexData: Uint16Array;
};

/**
 * 生成一个轻量的 UV Sphere 几何，给光源位置标记使用。
 * @param {number} radius 球体半径。
 * @param {number} widthSegments 经线分段数。
 * @param {number} heightSegments 纬线分段数。
 * @returns {SphereMesh} 包含 position / normal / uv 的顶点与索引数据。
 */
export function createSphereMesh(
  radius: number,
  widthSegments = 18,
  heightSegments = 10
): SphereMesh {
  const vertexData: number[] = [];
  const indexData: number[] = [];
  const grid: number[][] = [];

  const safeWidthSegments = Math.max(3, Math.floor(widthSegments));
  const safeHeightSegments = Math.max(2, Math.floor(heightSegments));
  let index = 0;

  for (let iy = 0; iy <= safeHeightSegments; iy += 1) {
    const row: number[] = [];
    const v = iy / safeHeightSegments;

    for (let ix = 0; ix <= safeWidthSegments; ix += 1) {
      const u = ix / safeWidthSegments;
      const theta = u * Math.PI * 2;
      const phi = v * Math.PI;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      const x = -cosTheta * sinPhi;
      const y = cosPhi;
      const z = sinTheta * sinPhi;

      vertexData.push(x * radius, y * radius, z * radius);
      vertexData.push(x, y, z);
      vertexData.push(u, 1 - v);

      row.push(index);
      index += 1;
    }

    grid.push(row);
  }

  for (let iy = 0; iy < safeHeightSegments; iy += 1) {
    for (let ix = 0; ix < safeWidthSegments; ix += 1) {
      const a = grid[iy][ix + 1];
      const b = grid[iy][ix];
      const c = grid[iy + 1][ix];
      const d = grid[iy + 1][ix + 1];

      if (iy !== 0) {
        indexData.push(a, b, d);
      }
      if (iy !== safeHeightSegments - 1) {
        indexData.push(b, c, d);
      }
    }
  }

  return {
    vertexData: new Float32Array(vertexData),
    indexData: new Uint16Array(indexData),
  };
}
