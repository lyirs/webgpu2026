import {
  clamp,
  normalizeVector,
  radialDistanceSquared,
  reflectVector,
  toWorldDirection,
  type Vector3,
} from "@/lessons/path-tracing-common/math";

export type SamplePoint = {
  x: number;
  y: number;
};

export type HemisphereSample = {
  direction: Vector3;
  pdf: number;
};

export type RectLightSample = {
  position: Vector3;
  pdf: number;
};

export type LightCandidate = {
  lightIndex: number;
  proposalPdf: number;
  targetValue: number;
  rawWeight: number;
};

export function createMulberry32(seed: number): () => number {
  let current = seed >>> 0;
  return () => {
    current = (current + 0x6d2b79f5) >>> 0;
    let t = Math.imul(current ^ (current >>> 15), 1 | current);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function radicalInverseVdc(value: number): number {
  let bits = value;
  bits = ((bits << 16) | (bits >>> 16)) >>> 0;
  bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
  bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
  bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
  bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
  return bits * 2.3283064365386963e-10;
}

export function generateWhiteNoisePoints(count: number, seed: number): SamplePoint[] {
  const random = createMulberry32(seed);
  const points: SamplePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    points.push({ x: random(), y: random() });
  }
  return points;
}

export function generateStratifiedJitterPoints(count: number, seed: number): SamplePoint[] {
  const random = createMulberry32(seed);
  const points: SamplePoint[] = [];
  const grid = Math.max(1, Math.ceil(Math.sqrt(count)));
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      if (points.length >= count) {
        break;
      }
      points.push({
        x: (x + random()) / grid,
        y: (y + random()) / grid,
      });
    }
  }
  return points;
}

export function generateBlueNoiseLikePoints(count: number, seed: number): SamplePoint[] {
  const random = createMulberry32(seed);
  const points: SamplePoint[] = [];
  const candidatesPerStep = 12;
  for (let index = 0; index < count; index += 1) {
    if (points.length === 0) {
      points.push({ x: random(), y: random() });
      continue;
    }
    let bestPoint: SamplePoint = { x: random(), y: random() };
    let bestScore = -1;
    for (let candidateIndex = 0; candidateIndex < candidatesPerStep; candidateIndex += 1) {
      const candidate = { x: random(), y: random() };
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const point of points) {
        nearestDistance = Math.min(
          nearestDistance,
          radialDistanceSquared([candidate.x, candidate.y], [point.x, point.y])
        );
      }
      if (nearestDistance > bestScore) {
        bestScore = nearestDistance;
        bestPoint = candidate;
      }
    }
    points.push(bestPoint);
  }
  return points;
}

export function sampleUniformHemisphere(u1: number, u2: number): HemisphereSample {
  const phi = Math.PI * 2 * u1;
  const y = u2;
  const radial = Math.sqrt(Math.max(0, 1 - y * y));
  const direction: Vector3 = [Math.cos(phi) * radial, y, Math.sin(phi) * radial];
  return {
    direction,
    pdf: 1 / (Math.PI * 2),
  };
}

export function sampleCosineHemisphere(u1: number, u2: number): HemisphereSample {
  const r = Math.sqrt(u1);
  const phi = 2 * Math.PI * u2;
  const x = r * Math.cos(phi);
  const z = r * Math.sin(phi);
  const y = Math.sqrt(Math.max(0, 1 - x * x - z * z));
  return {
    direction: [x, y, z],
    pdf: y / Math.PI,
  };
}

export function generateUniformHemisphereSamples(count: number, seed: number): HemisphereSample[] {
  const random = createMulberry32(seed);
  const samples: HemisphereSample[] = [];
  for (let index = 0; index < count; index += 1) {
    samples.push(sampleUniformHemisphere(random(), random()));
  }
  return samples;
}

export function generateHammersleyHemisphereSamples(count: number): HemisphereSample[] {
  const samples: HemisphereSample[] = [];
  for (let index = 0; index < count; index += 1) {
    samples.push(sampleUniformHemisphere((index + 0.5) / count, radicalInverseVdc(index)));
  }
  return samples;
}

export function sampleRectLight(
  u1: number,
  u2: number,
  center: Vector3,
  halfSize: Vector3
): RectLightSample {
  return {
    position: [
      center[0] + (u1 * 2 - 1) * halfSize[0],
      center[1],
      center[2] + (u2 * 2 - 1) * halfSize[2],
    ],
    pdf: 1 / Math.max(halfSize[0] * 2 * halfSize[2] * 2, 1e-5),
  };
}

export function sampleUniformCone(
  u1: number,
  u2: number,
  axis: Vector3,
  coneAngle: number
): HemisphereSample {
  const clampedAngle = clamp(coneAngle, 0.001, Math.PI * 0.5 - 0.001);
  const cosTheta = 1 - u1 * (1 - Math.cos(clampedAngle));
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  const phi = 2 * Math.PI * u2;
  const local: Vector3 = [Math.cos(phi) * sinTheta, cosTheta, Math.sin(phi) * sinTheta];
  const direction = normalizeVector(toWorldDirection(local, axis));
  const pdf = 1 / Math.max(2 * Math.PI * (1 - Math.cos(clampedAngle)), 1e-5);
  return {
    direction,
    pdf,
  };
}

export function conePdf(direction: Vector3, axis: Vector3, coneAngle: number): number {
  const clampedAngle = clamp(coneAngle, 0.001, Math.PI * 0.5 - 0.001);
  return dotVectorNormalized(direction, axis) >= Math.cos(clampedAngle)
    ? 1 / Math.max(2 * Math.PI * (1 - Math.cos(clampedAngle)), 1e-5)
    : 0;
}

export function computeTargetPdf(targetValue: number, totalTarget: number): number {
  if (targetValue <= 0 || totalTarget <= 0) {
    return 0;
  }
  return targetValue / totalTarget;
}

export function createUniformLightCandidate(
  lightIndex: number,
  lightCount: number,
  targetValue: number
): LightCandidate {
  const proposalPdf = 1 / Math.max(lightCount, 1);
  return {
    lightIndex,
    proposalPdf,
    targetValue,
    rawWeight: targetValue / Math.max(proposalPdf, 1e-6),
  };
}

export function weightedSampleIndex(weights: number[], random: number): number {
  const total = weights.reduce((sum, value) => sum + Math.max(value, 0), 0);
  if (total <= 0) {
    return 0;
  }
  let threshold = random * total;
  for (let index = 0; index < weights.length; index += 1) {
    threshold -= Math.max(weights[index], 0);
    if (threshold <= 0) {
      return index;
    }
  }
  return Math.max(0, weights.length - 1);
}

export function ggxDistribution(normalDotHalf: number, alpha: number): number {
  const alphaSq = alpha * alpha;
  const denominator = normalDotHalf * normalDotHalf * (alphaSq - 1) + 1;
  return alphaSq / Math.max(Math.PI * denominator * denominator, 1e-5);
}

export function powerHeuristic(pdfA: number, pdfB: number, beta = 2): number {
  const a = Math.pow(pdfA, beta);
  const b = Math.pow(pdfB, beta);
  return a / Math.max(a + b, 1e-6);
}

export function schlickSmithMasking(normalDotValue: number, alpha: number): number {
  const k = (alpha + 1) * (alpha + 1) / 8;
  return normalDotValue / Math.max(normalDotValue * (1 - k) + k, 1e-5);
}

export function sampleGgxHalfVector(
  u1: number,
  u2: number,
  roughness: number
): Vector3 {
  const alpha = Math.max(roughness * roughness, 0.03);
  const alphaSq = alpha * alpha;
  const phi = 2 * Math.PI * u1;
  const cosTheta = Math.sqrt((1 - u2) / Math.max(1 + (alphaSq - 1) * u2, 1e-5));
  const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  return [Math.cos(phi) * sinTheta, cosTheta, Math.sin(phi) * sinTheta];
}

export function sampleGgxReflection(
  u1: number,
  u2: number,
  roughness: number,
  viewDirection: Vector3,
  normal: Vector3
): HemisphereSample | null {
  const localHalf = sampleGgxHalfVector(u1, u2, roughness);
  const worldHalf = toWorldDirection(localHalf, normal);
  const incoming = normalizeVector(reflectVector(scaleVector(viewDirection, -1), worldHalf));
  const normalDotLight = clamp(dotVectorNormalized(normal, incoming), 0, 1);
  const normalDotHalf = clamp(dotVectorNormalized(normal, worldHalf), 0, 1);
  const viewDotHalf = clamp(
    viewDirection[0] * worldHalf[0] + viewDirection[1] * worldHalf[1] + viewDirection[2] * worldHalf[2],
    0,
    1
  );
  if (normalDotLight <= 0 || viewDotHalf <= 0 || normalDotHalf <= 0) {
    return null;
  }
  const alpha = Math.max(roughness * roughness, 0.03);
  const pdf = ggxDistribution(normalDotHalf, alpha) * normalDotHalf / Math.max(4 * viewDotHalf, 1e-5);
  return {
    direction: incoming,
    pdf: Math.max(pdf, 1e-5),
  };
}

export function ggxReflectionPdf(
  direction: Vector3,
  roughness: number,
  viewDirection: Vector3,
  normal: Vector3
): number {
  const normalDotLight = clamp(dotVectorNormalized(normal, direction), 0, 1);
  const normalDotView = clamp(dotVectorNormalized(normal, viewDirection), 0, 1);
  if (normalDotLight <= 0 || normalDotView <= 0) {
    return 0;
  }
  const halfVector = normalizeVector([
    direction[0] + viewDirection[0],
    direction[1] + viewDirection[1],
    direction[2] + viewDirection[2],
  ]);
  const normalDotHalf = clamp(dotVectorNormalized(normal, halfVector), 0, 1);
  const viewDotHalf = clamp(dotVectorNormalized(viewDirection, halfVector), 0, 1);
  if (normalDotHalf <= 0 || viewDotHalf <= 0) {
    return 0;
  }
  const alpha = Math.max(roughness * roughness, 0.03);
  return Math.max(
    ggxDistribution(normalDotHalf, alpha) * normalDotHalf / Math.max(4 * viewDotHalf, 1e-5),
    1e-5
  );
}

function scaleVector(vector: Vector3, scale: number): Vector3 {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

function dotVectorNormalized(left: Vector3, right: Vector3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}
