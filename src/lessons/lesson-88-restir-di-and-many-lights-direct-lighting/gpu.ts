import type { createWebGpuCanvas } from "@/core/webgpu";
import { createManyLightsRoomPreset } from "@/lessons/path-tracing-common/scene";
import presentShaderSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/present.wgsl?raw";
import spatialComputeShaderSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/spatial.compute.wgsl?raw";
import temporalComputeShaderSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/temporal.compute.wgsl?raw";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  LIGHT_STRIDE,
  RESERVOIR_STRIDE,
  SURFACE_STRIDE,
  type RestirGpuState,
  type RestirSettings,
} from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/types";

export type Lesson88Gpu = Awaited<ReturnType<typeof createWebGpuCanvas>>;

export function createSettingsData(
  settings: RestirSettings,
  currentOffset: number,
  previousOffset: number,
  time: number
): Float32Array {
  return new Float32Array([
    GRID_WIDTH,
    GRID_HEIGHT,
    settings.lightCount,
    settings.candidatesPerPixel,
    settings.spatialReuseRadius,
    currentOffset,
    previousOffset,
    time,
    3,
    0,
    0,
    0,
  ]);
}

export function createPresentUniformData(displayWidth: number, displayHeight: number): Float32Array {
  return new Float32Array([displayWidth, displayHeight, GRID_WIDTH, GRID_HEIGHT]);
}

export function createOccluderData(): Float32Array {
  const preset = createManyLightsRoomPreset(16);
  const data = new Float32Array(preset.occluders.length * 8);
  preset.occluders.forEach((occluder, index) => {
    const offset = index * 8;
    data.set([occluder.x, occluder.y, occluder.width, occluder.height], offset);
    data.set([occluder.depth, occluder.roughness, index, 0], offset + 4);
  });
  return data;
}

export function createLightData(lightCount: number): Float32Array {
  const preset = createManyLightsRoomPreset(lightCount);
  const data = new Float32Array(preset.lights.length * 8);
  preset.lights.forEach((light, index) => {
    const offset = index * 8;
    data.set([light.position[0], light.position[1], light.radius, light.intensity], offset);
    data.set([light.color[0], light.color[1], light.color[2], 0], offset + 4);
  });
  return data;
}

export function createStorageBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
}

export function createUniformBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

export function writeZeroBuffer(device: GPUDevice, buffer: GPUBuffer, size: number): void {
  device.queue.writeBuffer(buffer, 0, new Uint8Array(size));
}

export function createTemporalPipeline(device: GPUDevice): GPUComputePipeline {
  const shaderModule = device.createShaderModule({ code: temporalComputeShaderSource });
  return device.createComputePipeline({
    label: "lesson-88-restir-temporal-pipeline",
    layout: "auto",
    compute: {
      module: shaderModule,
      entryPoint: "buildTemporalMain",
    },
  });
}

export function createSpatialPipeline(device: GPUDevice): GPUComputePipeline {
  const shaderModule = device.createShaderModule({ code: spatialComputeShaderSource });
  return device.createComputePipeline({
    label: "lesson-88-restir-spatial-pipeline",
    layout: "auto",
    compute: {
      module: shaderModule,
      entryPoint: "buildSpatialMain",
    },
  });
}

export function createPresentPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: presentShaderSource });
  return device.createRenderPipeline({
    label: "lesson-88-restir-present-pipeline",
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsFullscreen",
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fsPresent",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "none",
    },
  });
}

export function rebuildLightDependentResources(
  gpu: Lesson88Gpu,
  state: RestirGpuState,
  temporalPipeline: GPUComputePipeline,
  spatialPipeline: GPUComputePipeline,
  presentPipeline: GPURenderPipeline,
  settings: RestirSettings
): void {
  if (
    state.activeLightCount === settings.lightCount &&
    state.temporalBindGroup &&
    state.spatialBindGroup &&
    state.presentBindGroup
  ) {
    return;
  }

  state.lightsBuffer?.destroy();
  state.lightsBuffer = createStorageBuffer(
    gpu.device,
    Math.max(settings.lightCount, 1) * LIGHT_STRIDE,
    "lesson-88-light-buffer"
  );
  gpu.device.queue.writeBuffer(state.lightsBuffer, 0, createLightData(settings.lightCount));

  state.temporalBindGroup = gpu.device.createBindGroup({
    label: "lesson-88-temporal-bind-group",
    layout: temporalPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: state.settingsBuffer } },
      { binding: 1, resource: { buffer: state.lightsBuffer } },
      { binding: 2, resource: { buffer: state.occluderBuffer } },
      { binding: 3, resource: { buffer: state.previousReservoirBuffer } },
      { binding: 4, resource: { buffer: state.previousSurfaceBuffer } },
      { binding: 5, resource: { buffer: state.temporalReservoirBuffer } },
      { binding: 6, resource: { buffer: state.currentSurfaceBuffer } },
      { binding: 7, resource: { buffer: state.naiveValueBuffer } },
    ],
  });

  state.spatialBindGroup = gpu.device.createBindGroup({
    label: "lesson-88-spatial-bind-group",
    layout: spatialPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: state.settingsBuffer } },
      { binding: 1, resource: { buffer: state.lightsBuffer } },
      { binding: 2, resource: { buffer: state.occluderBuffer } },
      { binding: 3, resource: { buffer: state.temporalReservoirBuffer } },
      { binding: 4, resource: { buffer: state.currentSurfaceBuffer } },
      { binding: 5, resource: { buffer: state.finalReservoirBuffer } },
      { binding: 6, resource: { buffer: state.restirValueBuffer } },
    ],
  });

  state.presentBindGroup = gpu.device.createBindGroup({
    label: "lesson-88-present-bind-group",
    layout: presentPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: state.presentUniformBuffer } },
      { binding: 1, resource: { buffer: state.occluderBuffer } },
      { binding: 2, resource: { buffer: state.naiveValueBuffer } },
      { binding: 3, resource: { buffer: state.restirValueBuffer } },
    ],
  });

  state.activeLightCount = settings.lightCount;
}

export function resetHistory(gpu: Lesson88Gpu, state: RestirGpuState): void {
  writeZeroBuffer(gpu.device, state.previousReservoirBuffer, GRID_WIDTH * GRID_HEIGHT * RESERVOIR_STRIDE);
  writeZeroBuffer(gpu.device, state.previousSurfaceBuffer, GRID_WIDTH * GRID_HEIGHT * SURFACE_STRIDE);
}
