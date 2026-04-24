import type { Vector3 } from "@/lessons/gpu-driven-common/math";

export type Color4 = [number, number, number, number];

export type GpuDrivenInstance = {
  label: string;
  translation: Vector3;
  scale: Vector3;
  color: Color4;
  radius: number;
  lodBias: number;
};

export type GpuDrivenSceneData = {
  dynamicInstances: GpuDrivenInstance[];
  staticInstances: GpuDrivenInstance[];
  occluderInstances: GpuDrivenInstance[];
  gridColumns: number;
  gridRows: number;
};

const FLOATS_PER_INSTANCE = 12;

/**
 * 基于固定数量生成一组程序化“盒体街区”实例和静态遮挡墙。
 * @param {number} instanceCount 动态实例数量。
 * @returns {GpuDrivenSceneData} 后续 60-64 课共用的一套程序化场景数据。
 */
export function createGpuDrivenStreetScene(
  instanceCount = 1024
): GpuDrivenSceneData {
  const gridColumns = Math.round(Math.sqrt(instanceCount));
  const gridRows = Math.ceil(instanceCount / gridColumns);
  const spacing = 1.45;
  const originX = -((gridColumns - 1) * spacing) * 0.5;
  const originZ = -((gridRows - 1) * spacing) * 0.5;
  const palette: Color4[] = [
    [0.26, 0.54, 0.82, 1],
    [0.22, 0.69, 0.44, 1],
    [0.86, 0.56, 0.23, 1],
    [0.74, 0.48, 0.84, 1],
  ];

  const dynamicInstances: GpuDrivenInstance[] = [];

  for (let index = 0; index < instanceCount; index += 1) {
    const column = index % gridColumns;
    const row = Math.floor(index / gridColumns);
    const x = originX + column * spacing;
    const z = originZ + row * spacing;
    const wave =
      Math.sin(column * 0.53) * 0.42 +
      Math.cos(row * 0.37) * 0.31 +
      Math.sin((column + row) * 0.18) * 0.22;
    const height = 0.6 + ((column + row) % 5) * 0.34 + Math.max(0, wave) * 0.65;
    const width = 0.48 + (column % 3) * 0.08;
    const depth = 0.48 + (row % 2) * 0.06;
    const scale: Vector3 = [width, height, depth];
    const radius = Math.hypot(scale[0], scale[1], scale[2]) * 0.5;
    const color = palette[(column + row) % palette.length];

    dynamicInstances.push({
      label: `block-${row}-${column}`,
      translation: [x, height * 0.5 - 0.02, z],
      scale,
      color,
      radius,
      lodBias: ((row * 11 + column * 7) % 9) / 8,
    });
  }

  const staticInstances: GpuDrivenInstance[] = [
    {
      label: "floor",
      translation: [0, -0.16, 0],
      scale: [27.5, 0.24, 27.5],
      color: [0.12, 0.14, 0.18, 1],
      radius: 0,
      lodBias: 0,
    },
    {
      label: "back-wall",
      translation: [0, 2.8, -11.5],
      scale: [20, 5.6, 0.9],
      color: [0.18, 0.16, 0.20, 1],
      radius: 0,
      lodBias: 0,
    },
    {
      label: "left-wall",
      translation: [-8.8, 2.6, 2.5],
      scale: [0.9, 5.2, 18],
      color: [0.15, 0.20, 0.24, 1],
      radius: 0,
      lodBias: 0,
    },
    {
      label: "center-wall",
      translation: [0.2, 2.9, 0.8],
      scale: [0.9, 5.8, 18.5],
      color: [0.20, 0.17, 0.21, 1],
      radius: 0,
      lodBias: 0,
    },
    {
      label: "cross-wall",
      translation: [7.9, 2.4, 8.2],
      scale: [16, 4.8, 0.9],
      color: [0.16, 0.21, 0.24, 1],
      radius: 0,
      lodBias: 0,
    },
  ];

  return {
    dynamicInstances,
    staticInstances,
    occluderInstances: staticInstances.filter((instance) => instance.label !== "floor"),
    gridColumns,
    gridRows,
  };
}

/**
 * 把实例列表打包成 shader 直接读取的 storage buffer 数据。
 * @param {GpuDrivenInstance[]} instances 要上传到 GPU 的实例列表。
 * @returns {Float32Array} 每个实例 3 个 vec4 的连续 float 数据。
 */
export function createGpuDrivenInstanceData(
  instances: GpuDrivenInstance[]
): Float32Array {
  const data = new Float32Array(instances.length * FLOATS_PER_INSTANCE);

  instances.forEach((instance, index) => {
    const offset = index * FLOATS_PER_INSTANCE;
    data.set(
      [
        instance.translation[0],
        instance.translation[1],
        instance.translation[2],
        instance.radius,
        instance.scale[0],
        instance.scale[1],
        instance.scale[2],
        instance.lodBias,
        instance.color[0],
        instance.color[1],
        instance.color[2],
        instance.color[3],
      ],
      offset
    );
  });

  return data;
}

/**
 * 根据一组可见性标记，把源实例压紧成一份新的实例列表。
 * @param {GpuDrivenInstance[]} instances 原始实例列表。
 * @param {ArrayLike<number>} flags 与实例一一对应的可见性标记。
 * @returns {GpuDrivenInstance[]} 只包含保留实例的连续列表。
 */
export function buildVisibleInstances(
  instances: GpuDrivenInstance[],
  flags: ArrayLike<number>
): GpuDrivenInstance[] {
  const visible: GpuDrivenInstance[] = [];

  for (let index = 0; index < instances.length; index += 1) {
    if (flags[index] === 1) {
      visible.push(instances[index]);
    }
  }

  return visible;
}

/**
 * 创建一份所有元素都可见的 flags 缓冲。
 * @param {number} count 元素数量。
 * @returns {Uint32Array} 填满 1 的可见性标记数组。
 */
export function createAllVisibleFlags(count: number): Uint32Array {
  const flags = new Uint32Array(count);
  flags.fill(1);
  return flags;
}

/**
 * 统计一组 flags 中可见元素的数量。
 * @param {ArrayLike<number>} flags 一组与实例一一对应的可见性标记。
 * @returns {number} 当前有多少个元素被保留。
 */
export function countVisibleFlags(flags: ArrayLike<number>): number {
  let visibleCount = 0;

  for (let index = 0; index < flags.length; index += 1) {
    visibleCount += flags[index] ? 1 : 0;
  }

  return visibleCount;
}
