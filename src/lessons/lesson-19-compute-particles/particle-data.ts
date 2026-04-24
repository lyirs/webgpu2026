export type ParticleSeed = {
  particleData: Float32Array;
  particleCount: number;
  workgroupCount: number;
};

/**
 * 生成一批粒子的初始位置、速度、颜色和尺寸。
 * @returns {ParticleSeed} 适合直接写进 storage buffer 的粒子数组，以及对应的实例数量和 workgroup 数量。
 */
export function createParticleSeedData(): ParticleSeed {
  const particleCount = 320;
  const workgroupSize = 64;
  const payload: number[] = [];

  for (let index = 0; index < particleCount; index += 1) {
    const angle = (index / particleCount) * Math.PI * 2;
    const radius = 0.12 + Math.random() * 0.62;
    const positionX = Math.cos(angle) * radius * (0.55 + Math.random() * 0.45);
    const positionY = Math.sin(angle) * radius * (0.55 + Math.random() * 0.45);
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);
    const speed = 0.12 + Math.random() * 0.32;
    const colorShift = index / particleCount;

    payload.push(
      positionX,
      positionY,
      tangentX * speed + (Math.random() - 0.5) * 0.08,
      tangentY * speed + (Math.random() - 0.5) * 0.08,
      0.34 + 0.56 * Math.abs(Math.sin(colorShift * Math.PI * 2)),
      0.45 + 0.45 * Math.abs(Math.sin(colorShift * Math.PI * 2 + 1.6)),
      0.58 + 0.34 * Math.abs(Math.sin(colorShift * Math.PI * 2 + 3.2)),
      0.014 + Math.random() * 0.02
    );
  }

  return {
    particleData: new Float32Array(payload),
    particleCount,
    workgroupCount: Math.ceil(particleCount / workgroupSize),
  };
}
