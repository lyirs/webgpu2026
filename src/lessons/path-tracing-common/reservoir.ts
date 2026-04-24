export type Reservoir<T> = {
  sample: T | null;
  weightSum: number;
  streamLength: number;
  targetValue: number;
  proposalPdf: number;
};

export function createEmptyReservoir<T>(): Reservoir<T> {
  return {
    sample: null,
    weightSum: 0,
    streamLength: 0,
    targetValue: 0,
    proposalPdf: 1,
  };
}

export function candidateRawWeight(targetValue: number, proposalPdf: number): number {
  if (targetValue <= 0 || proposalPdf <= 0) {
    return 0;
  }
  return targetValue / proposalPdf;
}

export function updateReservoir<T>(
  reservoir: Reservoir<T>,
  sample: T,
  targetValue: number,
  proposalPdf: number,
  random: number
): boolean {
  const rawWeight = candidateRawWeight(targetValue, proposalPdf);
  reservoir.streamLength += 1;
  if (rawWeight <= 0) {
    return false;
  }
  reservoir.weightSum += rawWeight;
  const accepted = random * reservoir.weightSum < rawWeight;
  if (accepted) {
    reservoir.sample = sample;
    reservoir.targetValue = targetValue;
    reservoir.proposalPdf = proposalPdf;
  }
  return accepted;
}

export function mergeReservoir<T>(
  target: Reservoir<T>,
  source: Reservoir<T>,
  random: number,
  scale = 1
): boolean {
  if (source.sample === null || source.weightSum <= 0) {
    return false;
  }
  const weighted = source.weightSum * scale;
  target.streamLength += Math.max(1, source.streamLength);
  target.weightSum += weighted;
  const accepted = random * target.weightSum < weighted;
  if (accepted) {
    target.sample = source.sample;
    target.targetValue = source.targetValue;
    target.proposalPdf = source.proposalPdf;
  }
  return accepted;
}

export function estimateFromReservoir<T>(reservoir: Reservoir<T>): number {
  if (reservoir.streamLength <= 0) {
    return 0;
  }
  return reservoir.weightSum / reservoir.streamLength;
}

export function cloneReservoir<T>(reservoir: Reservoir<T>): Reservoir<T> {
  return {
    sample: reservoir.sample,
    weightSum: reservoir.weightSum,
    streamLength: reservoir.streamLength,
    targetValue: reservoir.targetValue,
    proposalPdf: reservoir.proposalPdf,
  };
}

export function reservoirConfidence<T>(reservoir: Reservoir<T>): number {
  if (reservoir.streamLength <= 0 || reservoir.weightSum <= 0) {
    return 0;
  }
  const selectedRawWeight = candidateRawWeight(reservoir.targetValue, reservoir.proposalPdf);
  return selectedRawWeight / reservoir.weightSum;
}
