export type ComputeFoundationsSeed = {
  elementCount: number;
  workgroupSize: number;
  workgroupCount: number;
  cellData: Float32Array;
};

const CELL_FLOATS = 4;
const WORKGROUP_SIZE = 16;

/**
 * 生成 lesson 18 用的 storage buffer 初始数据。
 * @param {number} elementCount 当前要放进 storage buffer 的元素数量。
 * @returns {ComputeFoundationsSeed} 包含 workgroup 信息与初始 cell 数据的种子对象。
 */
export function createComputeFoundationsSeedData(
  elementCount: number
): ComputeFoundationsSeed {
  const normalizedCount = Math.max(WORKGROUP_SIZE * 2, Math.floor(elementCount / 16) * 16);
  const cellData = new Float32Array(normalizedCount * CELL_FLOATS);

  for (let index = 0; index < normalizedCount; index += 1) {
    const offset = index * CELL_FLOATS;
    const ratio = normalizedCount > 1 ? index / (normalizedCount - 1) : 0;
    const group = Math.floor(index / WORKGROUP_SIZE);
    const local = index % WORKGROUP_SIZE;

    cellData[offset + 0] = 0.18 + ratio * 1.72 + group * 0.07;
    cellData[offset + 1] = 0.55 + local / WORKGROUP_SIZE;
    cellData[offset + 2] = ratio;
    cellData[offset + 3] = group;
  }

  return {
    elementCount: normalizedCount,
    workgroupSize: WORKGROUP_SIZE,
    workgroupCount: Math.ceil(normalizedCount / WORKGROUP_SIZE),
    cellData,
  };
}
