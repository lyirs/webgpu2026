import { createWebGpuCanvas } from "@/core/webgpu";
import {
  createOccluderData,
  createPresentPipeline,
  createPresentUniformData,
  createSettingsData,
  createSpatialPipeline,
  createStorageBuffer,
  createTemporalPipeline,
  createUniformBuffer,
  rebuildLightDependentResources,
  resetHistory,
} from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/gpu";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  OCCLUDER_STRIDE,
  RESERVOIR_STRIDE,
  SURFACE_STRIDE,
  VALUE_STRIDE,
  type RestirGpuState,
  type RestirSettings,
  type StatusUpdate,
} from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/types";
import {
  createRestirDiView,
  updateRestirDiHud,
} from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/view";

export async function mountRestirDiAndManyLightsDirectLightingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  const { canvas, refs } = createRestirDiView(host);

  const settings: RestirSettings = {
    lightCount: 48,
    candidatesPerPixel: 6,
    spatialReuseRadius: 2,
    freezeCamera: false,
  };
  refs.lightRange.value = `${settings.lightCount}`;
  refs.candidateRange.value = `${settings.candidatesPerPixel}`;
  refs.radiusRange.value = `${settings.spatialReuseRadius}`;

  const gpu = await createWebGpuCanvas(canvas);
  const temporalPipeline = createTemporalPipeline(gpu.device);
  const spatialPipeline = createSpatialPipeline(gpu.device);
  const presentPipeline = createPresentPipeline(gpu.device, gpu.format);

  const state: RestirGpuState = {
    settingsBuffer: createUniformBuffer(gpu.device, 64, "lesson-88-settings-buffer"),
    presentUniformBuffer: createUniformBuffer(gpu.device, 16, "lesson-88-present-uniform-buffer"),
    occluderBuffer: createStorageBuffer(gpu.device, 3 * OCCLUDER_STRIDE, "lesson-88-occluder-buffer"),
    lightsBuffer: null,
    previousReservoirBuffer: createStorageBuffer(
      gpu.device,
      GRID_WIDTH * GRID_HEIGHT * RESERVOIR_STRIDE,
      "lesson-88-previous-reservoir-buffer"
    ),
    temporalReservoirBuffer: createStorageBuffer(
      gpu.device,
      GRID_WIDTH * GRID_HEIGHT * RESERVOIR_STRIDE,
      "lesson-88-temporal-reservoir-buffer"
    ),
    finalReservoirBuffer: createStorageBuffer(
      gpu.device,
      GRID_WIDTH * GRID_HEIGHT * RESERVOIR_STRIDE,
      "lesson-88-final-reservoir-buffer"
    ),
    previousSurfaceBuffer: createStorageBuffer(
      gpu.device,
      GRID_WIDTH * GRID_HEIGHT * SURFACE_STRIDE,
      "lesson-88-previous-surface-buffer"
    ),
    currentSurfaceBuffer: createStorageBuffer(
      gpu.device,
      GRID_WIDTH * GRID_HEIGHT * SURFACE_STRIDE,
      "lesson-88-current-surface-buffer"
    ),
    naiveValueBuffer: createStorageBuffer(
      gpu.device,
      GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE,
      "lesson-88-naive-value-buffer"
    ),
    restirValueBuffer: createStorageBuffer(
      gpu.device,
      GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE,
      "lesson-88-restir-value-buffer"
    ),
    temporalBindGroup: null,
    spatialBindGroup: null,
    presentBindGroup: null,
    activeLightCount: 0,
  };

  gpu.device.queue.writeBuffer(state.occluderBuffer, 0, createOccluderData());
  resetHistory(gpu, state);
  updateRestirDiHud(refs, settings);

  let previousOffset = 0;
  let animationFrame = 0;
  let disposed = false;

  const resetAndRebuild = () => {
    rebuildLightDependentResources(gpu, state, temporalPipeline, spatialPipeline, presentPipeline, settings);
    resetHistory(gpu, state);
    previousOffset = 0;
  };

  resetAndRebuild();

  const render = (time: number) => {
    if (disposed) {
      return;
    }

    gpu.resize();
    if (!state.temporalBindGroup || !state.spatialBindGroup || !state.presentBindGroup) {
      resetAndRebuild();
    }

    const currentOffset = settings.freezeCamera ? previousOffset : Math.sin(time * 0.00035) * 0.08;
    gpu.device.queue.writeBuffer(
      state.settingsBuffer,
      0,
      createSettingsData(settings, currentOffset, previousOffset, time)
    );
    gpu.device.queue.writeBuffer(
      state.presentUniformBuffer,
      0,
      createPresentUniformData(canvas.width, canvas.height)
    );

    const commandEncoder = gpu.device.createCommandEncoder({
      label: "lesson-88-command-encoder",
    });

    const temporalPass = commandEncoder.beginComputePass({
      label: "lesson-88-temporal-pass",
    });
    temporalPass.setPipeline(temporalPipeline);
    temporalPass.setBindGroup(0, state.temporalBindGroup!);
    temporalPass.dispatchWorkgroups(Math.ceil(GRID_WIDTH / 8), Math.ceil(GRID_HEIGHT / 8));
    temporalPass.end();

    const spatialPass = commandEncoder.beginComputePass({
      label: "lesson-88-spatial-pass",
    });
    spatialPass.setPipeline(spatialPipeline);
    spatialPass.setBindGroup(0, state.spatialBindGroup!);
    spatialPass.dispatchWorkgroups(Math.ceil(GRID_WIDTH / 8), Math.ceil(GRID_HEIGHT / 8));
    spatialPass.end();

    commandEncoder.copyBufferToBuffer(
      state.finalReservoirBuffer,
      0,
      state.previousReservoirBuffer,
      0,
      GRID_WIDTH * GRID_HEIGHT * RESERVOIR_STRIDE
    );
    commandEncoder.copyBufferToBuffer(
      state.currentSurfaceBuffer,
      0,
      state.previousSurfaceBuffer,
      0,
      GRID_WIDTH * GRID_HEIGHT * SURFACE_STRIDE
    );

    const renderPass = commandEncoder.beginRenderPass({
      label: "lesson-88-present-pass",
      colorAttachments: [
        {
          view: gpu.context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.04, b: 0.08, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.setPipeline(presentPipeline);
    renderPass.setBindGroup(0, state.presentBindGroup!);
    renderPass.draw(3);
    renderPass.end();

    gpu.device.queue.submit([commandEncoder.finish()]);
    previousOffset = currentOffset;
    animationFrame = requestAnimationFrame(render);
  };

  const handleLightInput = () => {
    settings.lightCount = Number(refs.lightRange.value);
    resetAndRebuild();
    updateRestirDiHud(refs, settings);
  };
  const handleCandidateInput = () => {
    settings.candidatesPerPixel = Number(refs.candidateRange.value);
    resetHistory(gpu, state);
    updateRestirDiHud(refs, settings);
  };
  const handleRadiusInput = () => {
    settings.spatialReuseRadius = Number(refs.radiusRange.value);
    resetHistory(gpu, state);
    updateRestirDiHud(refs, settings);
  };
  const handleFreeze = () => {
    settings.freezeCamera = !settings.freezeCamera;
    updateRestirDiHud(refs, settings);
  };

  refs.lightRange.addEventListener("input", handleLightInput);
  refs.candidateRange.addEventListener("input", handleCandidateInput);
  refs.radiusRange.addEventListener("input", handleRadiusInput);
  refs.freezeButton.addEventListener("click", handleFreeze);

  setStatus({
    title: "ReSTIR DI 与多光源直射光已运行",
    detail:
      "这一版已经迁成真正的 WebGPU lesson：左栏是 current-frame naive direct lighting，右栏是 compute pass 里的 current candidates + temporal reuse + spatial reuse。",
    tone: "ok",
  });

  animationFrame = requestAnimationFrame(render);
  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    refs.lightRange.removeEventListener("input", handleLightInput);
    refs.candidateRange.removeEventListener("input", handleCandidateInput);
    refs.radiusRange.removeEventListener("input", handleRadiusInput);
    refs.freezeButton.removeEventListener("click", handleFreeze);
    state.lightsBuffer?.destroy();
    state.settingsBuffer.destroy();
    state.presentUniformBuffer.destroy();
    state.occluderBuffer.destroy();
    state.previousReservoirBuffer.destroy();
    state.temporalReservoirBuffer.destroy();
    state.finalReservoirBuffer.destroy();
    state.previousSurfaceBuffer.destroy();
    state.currentSurfaceBuffer.destroy();
    state.naiveValueBuffer.destroy();
    state.restirValueBuffer.destroy();
  };
}
