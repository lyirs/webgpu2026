export type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

export type StabilizationSettings = {
  motionMode: "static" | "pan";
  historyBlend: number;
  clampStrength: number;
  lightAnimation: boolean;
};

export type StabilizationHudRefs = {
  modeButton: HTMLButtonElement;
  blendRange: HTMLInputElement;
  blendValue: HTMLElement;
  clampRange: HTMLInputElement;
  clampValue: HTMLElement;
  lightButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  currentCard: HTMLElement;
  naiveCard: HTMLElement;
  stabilizedCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

export type RestirGpuState = {
  settingsBuffer: GPUBuffer;
  presentUniformBuffer: GPUBuffer;
  occluderBuffer: GPUBuffer;
  lightsBuffer: GPUBuffer;
  previousReservoirBuffer: GPUBuffer;
  temporalReservoirBuffer: GPUBuffer;
  finalReservoirBuffer: GPUBuffer;
  previousSurfaceBuffer: GPUBuffer;
  currentSurfaceBuffer: GPUBuffer;
  currentValueBuffer: GPUBuffer;
  previousNaiveAccumBuffer: GPUBuffer;
  naiveAccumBuffer: GPUBuffer;
  previousStabilizedAccumBuffer: GPUBuffer;
  stabilizedAccumBuffer: GPUBuffer;
  temporalBindGroup: GPUBindGroup;
  spatialBindGroup: GPUBindGroup;
  accumulationBindGroup: GPUBindGroup;
  presentBindGroup: GPUBindGroup;
};

export const GRID_WIDTH = 58;
export const GRID_HEIGHT = 36;
export const RESERVOIR_STRIDE = 32;
export const SURFACE_STRIDE = 16;
export const VALUE_STRIDE = 16;
export const OCCLUDER_STRIDE = 32;
export const LIGHT_STRIDE = 32;
export const LIGHT_COUNT = 56;
export const CANDIDATES = 6;
export const SPATIAL_RADIUS = 2;
export const OCCLUDER_COUNT = 3;
