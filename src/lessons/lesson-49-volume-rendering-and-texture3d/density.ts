export type VolumeDensityData = {
  size: number;
  data: Uint8Array;
  voxelCount: number;
  memoryBytes: number;
  activeRatio: number;
};

/**
 * 把数值夹到 0-1 区间。
 * @param {number} value 当前数值。
 * @returns {number} 对应的 0-1 结果。
 */
function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 生成 0-1 区间内的 smoothstep 结果。
 * @param {number} edge0 起始边界。
 * @param {number} edge1 结束边界。
 * @param {number} value 当前输入值。
 * @returns {number} 平滑插值后的结果。
 */
function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * 生成一份单通道体密度数据，后续会直接上传到 `texture3D`。
 * @param {number} size 体纹理边长，默认 64。
 * @returns {VolumeDensityData} 对应的体素字节数据和摘要信息。
 */
export function createVolumeDensityTextureData(size = 64): VolumeDensityData {
  const voxelCount = size * size * size;
  const data = new Uint8Array(voxelCount);
  let activeVoxelCount = 0;

  for (let z = 0; z < size; z += 1) {
    const normalizedZ = z / (size - 1) * 2 - 1;

    for (let y = 0; y < size; y += 1) {
      const normalizedY = y / (size - 1) * 2 - 1;

      for (let x = 0; x < size; x += 1) {
        const normalizedX = x / (size - 1) * 2 - 1;
        const index = z * size * size + y * size + x;

        const radius = Math.hypot(
          normalizedX * 0.92,
          normalizedY * 1.06,
          normalizedZ * 0.94
        );
        const falloff = 1 - smoothstep(0.56, 1.02, radius);

        const core =
          Math.exp(
            -(
              normalizedX * normalizedX * 2.8 +
              normalizedY * normalizedY * 3.6 +
              normalizedZ * normalizedZ * 2.4
            )
          ) * 0.54;

        const plumeOne =
          Math.exp(
            -(
              (normalizedX - 0.34) * (normalizedX - 0.34) * 14 +
              (normalizedY + 0.16) * (normalizedY + 0.16) * 18 +
              (normalizedZ + 0.14) * (normalizedZ + 0.14) * 11
            )
          ) * 0.84;

        const plumeTwo =
          Math.exp(
            -(
              (normalizedX + 0.24) * (normalizedX + 0.24) * 12 +
              (normalizedY - 0.28) * (normalizedY - 0.28) * 15 +
              (normalizedZ - 0.24) * (normalizedZ - 0.24) * 13
            )
          ) * 0.74;

        const ribbonCenter =
          0.18 * Math.sin(normalizedX * 3.2 + normalizedZ * 2.4) -
          0.08 * Math.cos(normalizedY * 4.6);
        const ribbon =
          Math.max(0, 1 - Math.abs(normalizedY - ribbonCenter) * 4.4) *
          Math.exp(-(normalizedX * normalizedX + normalizedZ * normalizedZ) * 1.52) *
          0.44;

        const shell =
          Math.max(0, 1 - Math.abs(radius - 0.68) * 5.2) * 0.12;

        const wave =
          (
            Math.sin(normalizedX * 7.1 + normalizedZ * 3.4) +
            Math.sin(normalizedY * 8.3 - normalizedX * 2.1) +
            Math.cos(normalizedZ * 9.4 + normalizedY * 1.8)
          ) *
          0.034 *
          falloff;

        let density =
          (core + plumeOne + plumeTwo + ribbon + shell + wave) * falloff;
        density = Math.max(0, density - 0.08);
        density *= 1 - smoothstep(0.84, 1.06, radius);
        density = clamp01(density * 1.18);

        if (density > 0.07) {
          activeVoxelCount += 1;
        }

        data[index] = Math.round(density * 255);
      }
    }
  }

  return {
    size,
    data,
    voxelCount,
    memoryBytes: data.byteLength,
    activeRatio: activeVoxelCount / voxelCount,
  };
}
