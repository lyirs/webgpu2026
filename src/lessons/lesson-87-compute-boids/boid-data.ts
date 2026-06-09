export type BoidSeed = {
  boidData: Float32Array;
  boidCount: number;
  workgroupCount: number;
};

function createSeededRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

/**
 * 生成第 33 课 boids 群集模拟的初始状态。
 * @returns {BoidSeed} 包含位置、速度、颜色和尺寸的 boid 数组，以及 dispatch 所需工作组数量。
 */
export function createBoidSeedData(): BoidSeed {
  const boidCount = 128;
  const workgroupSize = 64;
  const payload: number[] = [];
  const random = createSeededRandom(33033);

  for (let index = 0; index < boidCount; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 0.08 + random() * 0.72;
    const positionX = Math.cos(angle) * radius;
    const positionY = Math.sin(angle) * radius * 0.72;
    const heading = random() * Math.PI * 2;
    const speed = 0.16 + random() * 0.28;
    const colorPhase = index / boidCount;

    payload.push(
      positionX,
      positionY,
      Math.cos(heading) * speed,
      Math.sin(heading) * speed,
      0.28 + 0.62 * Math.abs(Math.sin(colorPhase * Math.PI * 2)),
      0.44 + 0.46 * Math.abs(Math.sin(colorPhase * Math.PI * 2 + 1.2)),
      0.54 + 0.34 * Math.abs(Math.sin(colorPhase * Math.PI * 2 + 2.5)),
      0.04 + random() * 0.016
    );
  }

  return {
    boidData: new Float32Array(payload),
    boidCount,
    workgroupCount: Math.ceil(boidCount / workgroupSize),
  };
}
