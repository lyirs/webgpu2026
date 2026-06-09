export type PrefixSumSeed = {
  itemData: Uint32Array;
  itemCount: number;
  columns: number;
  workgroupSize: number;
  workgroupCount: number;
  scanOffsets: number[];
  scanPassCount: number;
  threshold: number;
  phase: number;
};

/**
 * 生成第 59 课的源数据：每个元素都带有 value、keep flag 和 source index。
 * @param {number} itemCount 当前演示包含的元素总数。
 * @param {number} threshold 只有 value >= threshold 的元素才会被保留。
 * @param {number} phase 用来平移图案相位，让保留分布发生变化。
 * @returns {PrefixSumSeed} 包含源数组、scan 阶段配置与 workgroup 信息的种子对象。
 */
export function createPrefixSumSeedData(
  itemCount: number,
  threshold: number,
  phase: number
): PrefixSumSeed {
  const columns = 16;
  const workgroupSize = 64;
  const workgroupCount = Math.ceil(itemCount / workgroupSize);
  const scanOffsets: number[] = [];

  for (let offset = 1; offset < itemCount; offset *= 2) {
    scanOffsets.push(offset);
  }

  const itemData = new Uint32Array(itemCount * 4);
  const phaseRadians = phase * Math.PI * 2;
  const phaseShift = Math.floor(phase * 29);

  for (let index = 0; index < itemCount; index += 1) {
    const waveA = 0.5 + 0.5 * Math.sin(index * 0.37 + phaseRadians);
    const waveB = 0.5 + 0.5 * Math.sin(index * 0.13 - phaseRadians * 1.7);
    const saw = ((index * 5 + phaseShift) % 19) / 18;
    const valueNormalized = waveA * 0.56 + waveB * 0.28 + saw * 0.16;
    const value = Math.max(4, Math.min(99, Math.round(8 + valueNormalized * 91)));
    const keepFlag = value >= threshold ? 1 : 0;
    const offset = index * 4;

    itemData[offset + 0] = value;
    itemData[offset + 1] = keepFlag;
    itemData[offset + 2] = index;
    itemData[offset + 3] = Math.floor(index / columns);
  }

  return {
    itemData,
    itemCount,
    columns,
    workgroupSize,
    workgroupCount,
    scanOffsets,
    scanPassCount: scanOffsets.length,
    threshold,
    phase,
  };
}
