import type { Vector3 } from "@/lessons/lesson-109-metaballs-and-implicit-fields/math";

export type MetaballFieldSettings = {
  sliceDepth: number;
  isoLevel: number;
  fieldGain: number;
  orbitRadius: number;
  animationSpeed: number;
};

export type MetaballFieldMetrics = {
  peakField: number;
  occupiedRatio: number;
  sliceCoverage: number;
  metaballCount: number;
};

export const IMPLICIT_METABALL_COUNT = 4;
export const FIELD_EXTENT = 1;
export const SLICE_DEPTH_LIMIT = 0.82;

const METRIC_GRID_RESOLUTION = 18;
const METRIC_SLICE_RESOLUTION = 42;

/**
 * 把 0-1 区间的插值系数转成实际范围内的数值。
 * @param {number} start 起始值。
 * @param {number} end 结束值。
 * @param {number} t 当前 0-1 插值系数。
 * @returns {number} 对应的线性插值结果。
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * 根据当前设置生成四个 metaball 的球心与半径。
 * @param {MetaballFieldSettings} settings 当前 lesson 控制参数。
 * @param {number} timeSeconds 当前时间，单位秒。
 * @returns {Float32Array} 形如 `[x, y, z, radius] * 4` 的连续数据。
 */
export function createMetaballFieldData(
  settings: MetaballFieldSettings,
  timeSeconds: number
): Float32Array {
  const orbit = settings.orbitRadius;
  const time = timeSeconds * settings.animationSpeed;

  return new Float32Array([
    Math.cos(time * 0.82) * orbit,
    Math.sin(time * 1.11) * 0.34,
    Math.sin(time * 0.63 + 0.4) * orbit * 0.74,
    0.44,

    Math.cos(time * 0.57 + 2.1) * orbit * 0.76,
    Math.sin(time * 0.91 + 1.1) * 0.42,
    Math.sin(time * 1.03 + 0.8) * orbit,
    0.39,

    Math.sin(time * 0.73 + 0.5) * orbit,
    Math.cos(time * 0.67 + 2.7) * 0.38,
    Math.cos(time * 0.96 + 1.6) * orbit * 0.82,
    0.47,

    Math.cos(time * 1.14 + 4.1) * orbit * 0.58,
    Math.sin(time * 0.79 + 3.0) * 0.28,
    Math.cos(time * 0.71 + 2.2) * orbit * 0.68,
    0.35,
  ]);
}

/**
 * 在给定空间点上采样 metaball 隐式场。
 * @param {Float32Array} metaballs 当前 metaball 中心与半径数据。
 * @param {Vector3} point 当前空间采样点。
 * @param {number} fieldGain 当前场强增益。
 * @returns {number} 对应的标量场值。
 */
export function evaluateMetaballFieldAtPoint(
  metaballs: Float32Array,
  point: Vector3,
  fieldGain: number
): number {
  let density = 0;

  for (let index = 0; index < IMPLICIT_METABALL_COUNT; index += 1) {
    const offset = index * 4;
    const dx = point[0] - metaballs[offset];
    const dy = point[1] - metaballs[offset + 1];
    const dz = point[2] - metaballs[offset + 2];
    const radius = metaballs[offset + 3];
    const radiusSq = Math.max(radius * radius, 0.00001);
    density += Math.exp(-(dx * dx + dy * dy + dz * dz) / radiusSq);
  }

  return density * fieldGain;
}

/**
 * 粗采样当前 metaball 隐式场，生成 HUD 需要的统计指标。
 * @param {MetaballFieldSettings} settings 当前 lesson 控制参数。
 * @param {number} timeSeconds 当前时间，单位秒。
 * @returns {MetaballFieldMetrics} 对应的峰值、占比与切片覆盖率。
 */
export function sampleMetaballFieldMetrics(
  settings: MetaballFieldSettings,
  timeSeconds: number
): MetaballFieldMetrics {
  const metaballs = createMetaballFieldData(settings, timeSeconds);
  let peakField = 0;
  let occupiedCount = 0;
  let sliceOccupiedCount = 0;

  for (let z = 0; z < METRIC_GRID_RESOLUTION; z += 1) {
    const pointZ = lerp(-FIELD_EXTENT, FIELD_EXTENT, z / (METRIC_GRID_RESOLUTION - 1));

    for (let y = 0; y < METRIC_GRID_RESOLUTION; y += 1) {
      const pointY = lerp(-FIELD_EXTENT, FIELD_EXTENT, y / (METRIC_GRID_RESOLUTION - 1));

      for (let x = 0; x < METRIC_GRID_RESOLUTION; x += 1) {
        const pointX = lerp(
          -FIELD_EXTENT,
          FIELD_EXTENT,
          x / (METRIC_GRID_RESOLUTION - 1)
        );
        const fieldValue = evaluateMetaballFieldAtPoint(
          metaballs,
          [pointX, pointY, pointZ],
          settings.fieldGain
        );

        peakField = Math.max(peakField, fieldValue);
        if (fieldValue >= settings.isoLevel) {
          occupiedCount += 1;
        }
      }
    }
  }

  for (let y = 0; y < METRIC_SLICE_RESOLUTION; y += 1) {
    const pointY = lerp(-FIELD_EXTENT, FIELD_EXTENT, y / (METRIC_SLICE_RESOLUTION - 1));

    for (let x = 0; x < METRIC_SLICE_RESOLUTION; x += 1) {
      const pointX = lerp(-FIELD_EXTENT, FIELD_EXTENT, x / (METRIC_SLICE_RESOLUTION - 1));
      const fieldValue = evaluateMetaballFieldAtPoint(
        metaballs,
        [pointX, pointY, settings.sliceDepth],
        settings.fieldGain
      );

      if (fieldValue >= settings.isoLevel) {
        sliceOccupiedCount += 1;
      }
    }
  }

  return {
    peakField,
    occupiedRatio:
      occupiedCount /
      (METRIC_GRID_RESOLUTION * METRIC_GRID_RESOLUTION * METRIC_GRID_RESOLUTION),
    sliceCoverage:
      sliceOccupiedCount / (METRIC_SLICE_RESOLUTION * METRIC_SLICE_RESOLUTION),
    metaballCount: IMPLICIT_METABALL_COUNT,
  };
}
