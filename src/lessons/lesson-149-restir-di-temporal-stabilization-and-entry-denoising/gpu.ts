import type { createWebGpuCanvas } from "@/core/webgpu";
import { createManyLightsRoomPreset } from "@/lessons/path-tracing-common/scene";
import accumulateComputeShaderSource from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/accumulate.compute.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/present.wgsl?raw";
import spatialComputeShaderSource from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/spatial.compute.wgsl?raw";
import temporalComputeShaderSource from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/temporal.compute.wgsl?raw";
import {
  CANDIDATES,
  GRID_HEIGHT,
  GRID_WIDTH,
  LIGHT_COUNT,
  LIGHT_STRIDE,
  OCCLUDER_COUNT,
  OCCLUDER_STRIDE,
  RESERVOIR_STRIDE,
  SPATIAL_RADIUS,
  SURFACE_STRIDE,
  VALUE_STRIDE,
  type RestirGpuState,
  type StabilizationSettings,
} from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/types";

export type Lesson89Gpu = Awaited<ReturnType<typeof createWebGpuCanvas>>;

export function createSettingsData(
  settings: StabilizationSettings,
  currentOffset: number,
  previousOffset: number,
  time: number
): Float32Array {
  return new Float32Array([
    GRID_WIDTH,
    GRID_HEIGHT,
    LIGHT_COUNT,
    CANDIDATES,
    SPATIAL_RADIUS,
    currentOffset,
    previousOffset,
    time,
    OCCLUDER_COUNT,
    settings.historyBlend,
    settings.clampStrength,
    settings.lightAnimation ? 1 : 0,
  ]);
}

export function createPresentUniformData(displayWidth: number, displayHeight: number): Float32Array {
  return new Float32Array([displayWidth, displayHeight, GRID_WIDTH, GRID_HEIGHT]);
}

function createOccluderData(): Float32Array {
  const preset = createManyLightsRoomPreset(LIGHT_COUNT);
  const data = new Float32Array(preset.occluders.length * 8);
  preset.occluders.forEach((occluder, index) => {
    const offset = index * 8;
    data.set([occluder.x, occluder.y, occluder.width, occluder.height], offset);
    data.set([occluder.depth, occluder.roughness, index, 0], offset + 4);
  });
  return data;
}

function createLightData(): Float32Array {
  const preset = createManyLightsRoomPreset(LIGHT_COUNT);
  const data = new Float32Array(preset.lights.length * 8);
  preset.lights.forEach((light, index) => {
    const offset = index * 8;
    data.set([light.position[0], light.position[1], light.radius, light.intensity], offset);
    data.set([light.color[0], light.color[1], light.color[2], 0], offset + 4);
  });
  return data;
}

function createStorageBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
}

function createUniformBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function writeZeroBuffer(device: GPUDevice, buffer: GPUBuffer, size: number): void {
  device.queue.writeBuffer(buffer, 0, new Uint8Array(size));
}

export function createTemporalPipeline(device: GPUDevice): GPUComputePipeline {
  const shaderModule = device.createShaderModule({ code: temporalComputeShaderSource });
  return device.createComputePipeline({
    label: "lesson-89-restir-temporal-pipeline",
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
    label: "lesson-89-restir-spatial-pipeline",
    layout: "auto",
    compute: {
      module: shaderModule,
      entryPoint: "buildSpatialMain",
    },
  });
}

export function createAccumulationPipeline(device: GPUDevice): GPUComputePipeline {
  const shaderModule = device.createShaderModule({ code: accumulateComputeShaderSource });
  return device.createComputePipeline({
    label: "lesson-89-restir-accumulation-pipeline",
    layout: "auto",
    compute: {
      module: shaderModule,
      entryPoint: "accumulateMain",
    },
  });
}

export function createPresentPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ code: presentShaderSource });
  return device.createRenderPipeline({
    label: "lesson-89-restir-present-pipeline",
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

export function createRestirGpuState(
  gpu: Lesson89Gpu,
  temporalPipeline: GPUComputePipeline,
  spatialPipeline: GPUComputePipeline,
  accumulationPipeline: GPUComputePipeline,
  presentPipeline: GPURenderPipeline
): RestirGpuState {
  const settingsBuffer = createUniformBuffer(gpu.device, 64, "lesson-89-settings-buffer");
  const presentUniformBuffer = createUniformBuffer(gpu.device, 16, "lesson-89-present-uniform-buffer");
  const occluderBuffer = createStorageBuffer(gpu.device, OCCLUDER_COUNT * OCCLUDER_STRIDE, "lesson-89-occluder-buffer");
  const lightsBuffer = createStorageBuffer(gpu.device, LIGHT_COUNT * LIGHT_STRIDE, "lesson-89-light-buffer");
  const previousReservoirBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * RESERVOIR_STRIDE,
    "lesson-89-previous-reservoir-buffer"
  );
  const temporalReservoirBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * RESERVOIR_STRIDE,
    "lesson-89-temporal-reservoir-buffer"
  );
  const finalReservoirBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * RESERVOIR_STRIDE,
    "lesson-89-final-reservoir-buffer"
  );
  const previousSurfaceBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * SURFACE_STRIDE,
    "lesson-89-previous-surface-buffer"
  );
  const currentSurfaceBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * SURFACE_STRIDE,
    "lesson-89-current-surface-buffer"
  );
  const currentValueBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE,
    "lesson-89-current-value-buffer"
  );
  const previousNaiveAccumBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE,
    "lesson-89-previous-naive-accum-buffer"
  );
  const naiveAccumBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE,
    "lesson-89-naive-accum-buffer"
  );
  const previousStabilizedAccumBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE,
    "lesson-89-previous-stabilized-accum-buffer"
  );
  const stabilizedAccumBuffer = createStorageBuffer(
    gpu.device,
    GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE,
    "lesson-89-stabilized-accum-buffer"
  );

  gpu.device.queue.writeBuffer(occluderBuffer, 0, createOccluderData());
  gpu.device.queue.writeBuffer(lightsBuffer, 0, createLightData());

  return {
    settingsBuffer,
    presentUniformBuffer,
    occluderBuffer,
    lightsBuffer,
    previousReservoirBuffer,
    temporalReservoirBuffer,
    finalReservoirBuffer,
    previousSurfaceBuffer,
    currentSurfaceBuffer,
    currentValueBuffer,
    previousNaiveAccumBuffer,
    naiveAccumBuffer,
    previousStabilizedAccumBuffer,
    stabilizedAccumBuffer,
    temporalBindGroup: gpu.device.createBindGroup({
      label: "lesson-89-temporal-bind-group",
      layout: temporalPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: settingsBuffer } },
        { binding: 1, resource: { buffer: lightsBuffer } },
        { binding: 2, resource: { buffer: occluderBuffer } },
        { binding: 3, resource: { buffer: previousReservoirBuffer } },
        { binding: 4, resource: { buffer: previousSurfaceBuffer } },
        { binding: 5, resource: { buffer: temporalReservoirBuffer } },
        { binding: 6, resource: { buffer: currentSurfaceBuffer } },
      ],
    }),
    spatialBindGroup: gpu.device.createBindGroup({
      label: "lesson-89-spatial-bind-group",
      layout: spatialPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: settingsBuffer } },
        { binding: 1, resource: { buffer: lightsBuffer } },
        { binding: 2, resource: { buffer: occluderBuffer } },
        { binding: 3, resource: { buffer: temporalReservoirBuffer } },
        { binding: 4, resource: { buffer: currentSurfaceBuffer } },
        { binding: 5, resource: { buffer: finalReservoirBuffer } },
        { binding: 6, resource: { buffer: currentValueBuffer } },
      ],
    }),
    accumulationBindGroup: gpu.device.createBindGroup({
      label: "lesson-89-accumulation-bind-group",
      layout: accumulationPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: settingsBuffer } },
        { binding: 1, resource: { buffer: currentSurfaceBuffer } },
        { binding: 2, resource: { buffer: currentValueBuffer } },
        { binding: 3, resource: { buffer: previousSurfaceBuffer } },
        { binding: 4, resource: { buffer: previousNaiveAccumBuffer } },
        { binding: 5, resource: { buffer: previousStabilizedAccumBuffer } },
        { binding: 6, resource: { buffer: naiveAccumBuffer } },
        { binding: 7, resource: { buffer: stabilizedAccumBuffer } },
      ],
    }),
    presentBindGroup: gpu.device.createBindGroup({
      label: "lesson-89-present-bind-group",
      layout: presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: presentUniformBuffer } },
        { binding: 1, resource: { buffer: occluderBuffer } },
        { binding: 2, resource: { buffer: currentSurfaceBuffer } },
        { binding: 3, resource: { buffer: currentValueBuffer } },
        { binding: 4, resource: { buffer: naiveAccumBuffer } },
        { binding: 5, resource: { buffer: stabilizedAccumBuffer } },
      ],
    }),
  };
}

export function resetHistory(gpu: Lesson89Gpu, state: RestirGpuState): void {
  writeZeroBuffer(gpu.device, state.previousReservoirBuffer, GRID_WIDTH * GRID_HEIGHT * RESERVOIR_STRIDE);
  writeZeroBuffer(gpu.device, state.previousSurfaceBuffer, GRID_WIDTH * GRID_HEIGHT * SURFACE_STRIDE);
  writeZeroBuffer(gpu.device, state.previousNaiveAccumBuffer, GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE);
  writeZeroBuffer(gpu.device, state.previousStabilizedAccumBuffer, GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE);
}
