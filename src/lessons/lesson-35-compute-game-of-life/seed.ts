export type GameOfLifeSeed = {
  width: number;
  height: number;
  cellCount: number;
  workgroupCountX: number;
  workgroupCountY: number;
  state: Uint32Array;
};

function stampPattern(
  state: Uint32Array,
  width: number,
  height: number,
  originX: number,
  originY: number,
  pattern: string[]
) {
  pattern.forEach((row, rowIndex) => {
    [...row].forEach((cell, columnIndex) => {
      if (cell !== "1") {
        return;
      }

      const x = (originX + columnIndex + width) % width;
      const y = (originY + rowIndex + height) % height;
      state[y * width + x] = 1;
    });
  });
}

function createSeededRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

/**
 * 生成第 32 课生命游戏的初始网格状态。
 * @param {number} width 网格宽度，也就是每一行的细胞数量。
 * @param {number} height 网格高度，也就是网格总共有多少行。
 * @returns {GameOfLifeSeed} 包含初始状态、总细胞数和 dispatchWorkgroups 所需尺寸的种子对象。
 */
export function createGameOfLifeSeed(
  width = 96,
  height = 54
): GameOfLifeSeed {
  const state = new Uint32Array(width * height);

  stampPattern(state, width, height, 10, 8, ["010", "001", "111"]);
  stampPattern(state, width, height, 22, 18, ["111"]);
  stampPattern(state, width, height, 54, 12, ["100", "001", "111"]);
  stampPattern(state, width, height, 68, 31, ["0111", "1001", "0001"]);
  stampPattern(state, width, height, 35, 34, ["0110", "0110"]);

  const random = createSeededRandom(32026);
  const centerX = Math.floor(width * 0.5);
  const centerY = Math.floor(height * 0.54);

  for (let offsetY = -8; offsetY <= 8; offsetY += 1) {
    for (let offsetX = -14; offsetX <= 14; offsetX += 1) {
      if (random() < 0.21) {
        const x = centerX + offsetX;
        const y = centerY + offsetY;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          state[y * width + x] = 1;
        }
      }
    }
  }

  return {
    width,
    height,
    cellCount: width * height,
    workgroupCountX: Math.ceil(width / 8),
    workgroupCountY: Math.ceil(height / 8),
    state,
  };
}
