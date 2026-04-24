export type SortSeed = {
  itemData: Float32Array;
  itemCount: number;
  workgroupCount: number;
};

function hslToRgb(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const scaledHue = hue / 60;
  const second = chroma * (1 - Math.abs((scaledHue % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (scaledHue >= 0 && scaledHue < 1) {
    red = chroma;
    green = second;
  } else if (scaledHue < 2) {
    red = second;
    green = chroma;
  } else if (scaledHue < 3) {
    green = chroma;
    blue = second;
  } else if (scaledHue < 4) {
    green = second;
    blue = chroma;
  } else if (scaledHue < 5) {
    red = second;
    blue = chroma;
  } else {
    red = chroma;
    blue = second;
  }

  const match = lightness - chroma / 2;
  return [red + match, green + match, blue + match];
}

function shuffle(values: number[]) {
  const output = values.slice();
  for (let index = output.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temp = output[index];
    output[index] = output[randomIndex];
    output[randomIndex] = temp;
  }
  return output;
}

/**
 * 生成第 34 课 bitonic sort 的初始数据。
 * @returns {SortSeed} 包含排序条目、元素数量和 dispatch 所需工作组数量。
 */
export function createBitonicSortSeedData(): SortSeed {
  const itemCount = 32;
  const values = Array.from({ length: itemCount }, (_value, index) => {
    return 0.08 + (index / (itemCount - 1)) * 0.92;
  });
  const shuffledValues = shuffle(values);
  const itemData = new Float32Array(itemCount * 4);

  shuffledValues.forEach((value, index) => {
    const hue = 210 - value * 155;
    const [red, green, blue] = hslToRgb(hue, 0.62, 0.54);
    const offset = index * 4;
    itemData[offset + 0] = value;
    itemData[offset + 1] = red;
    itemData[offset + 2] = green;
    itemData[offset + 3] = blue;
  });

  return {
    itemData,
    itemCount,
    workgroupCount: Math.ceil(itemCount / 64),
  };
}
