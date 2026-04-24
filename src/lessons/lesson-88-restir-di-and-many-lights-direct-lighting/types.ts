export type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

export type RestirSettings = {
  lightCount: number;
  candidatesPerPixel: number;
  spatialReuseRadius: number;
  freezeCamera: boolean;
};

export type RestirHudRefs = {
  lightRange: HTMLInputElement;
  lightValue: HTMLElement;
  candidateRange: HTMLInputElement;
  candidateValue: HTMLElement;
  radiusRange: HTMLInputElement;
  radiusValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  naiveCard: HTMLElement;
  restirCard: HTMLElement;
  statsCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

export type RestirGpuState = {
  settingsBuffer: GPUBuffer;
  presentUniformBuffer: GPUBuffer;
  occluderBuffer: GPUBuffer;
  lightsBuffer: GPUBuffer | null;
  previousReservoirBuffer: GPUBuffer;
  temporalReservoirBuffer: GPUBuffer;
  finalReservoirBuffer: GPUBuffer;
  previousSurfaceBuffer: GPUBuffer;
  currentSurfaceBuffer: GPUBuffer;
  naiveValueBuffer: GPUBuffer;
  restirValueBuffer: GPUBuffer;
  temporalBindGroup: GPUBindGroup | null;
  spatialBindGroup: GPUBindGroup | null;
  presentBindGroup: GPUBindGroup | null;
  activeLightCount: number;
};

export const GRID_WIDTH = 58;
export const GRID_HEIGHT = 36;
export const RESERVOIR_STRIDE = 32;
export const SURFACE_STRIDE = 16;
export const VALUE_STRIDE = 16;
export const OCCLUDER_STRIDE = 32;
export const LIGHT_STRIDE = 32;
