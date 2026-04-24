import { createWebGpuCanvas } from "@/core/webgpu";
import {
  createAccumulationPipeline,
  createPresentPipeline,
  createPresentUniformData,
  createRestirGpuState,
  createSettingsData,
  createSpatialPipeline,
  createTemporalPipeline,
  resetHistory,
} from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/gpu";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  RESERVOIR_STRIDE,
  SURFACE_STRIDE,
  VALUE_STRIDE,
  type StabilizationSettings,
  type StatusUpdate,
} from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/types";
import {
  createStabilizationView,
  updateStabilizationHud,
} from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/view";

export async function mountRestirDiTemporalStabilizationAndEntryDenoisingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  const { canvas, refs } = createStabilizationView(host);

  const settings: StabilizationSettings = {
    motionMode: "pan",
    historyBlend: 0.72,
    clampStrength: 0.2,
    lightAnimation: false,
  };
  refs.blendRange.value = `${settings.historyBlend}`;
  refs.clampRange.value = `${settings.clampStrength}`;

  const gpu = await createWebGpuCanvas(canvas);
  const temporalPipeline = createTemporalPipeline(gpu.device);
  const spatialPipeline = createSpatialPipeline(gpu.device);
  const accumulationPipeline = createAccumulationPipeline(gpu.device);
  const presentPipeline = createPresentPipeline(gpu.device, gpu.format);
  const state = createRestirGpuState(
    gpu,
    temporalPipeline,
    spatialPipeline,
    accumulationPipeline,
    presentPipeline
  );

  let previousOffset = 0;
  let accumulatedFrames = 0;
  let animationFrame = 0;
  let disposed = false;
  let lastCanvasWidth = 0;
  let lastCanvasHeight = 0;

  const clearHistory = () => {
    resetHistory(gpu, state);
    previousOffset = 0;
    accumulatedFrames = 0;
  };

  clearHistory();
  updateStabilizationHud(refs, settings, accumulatedFrames);

  const render = (time: number) => {
    if (disposed) {
      return;
    }

    gpu.resize();
    if (canvas.width !== lastCanvasWidth || canvas.height !== lastCanvasHeight) {
      lastCanvasWidth = canvas.width;
      lastCanvasHeight = canvas.height;
      clearHistory();
    }

    const currentOffset =
      settings.motionMode === "pan" ? Math.sin(time * 0.00035) * 0.08 : previousOffset;

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
      label: "lesson-89-command-encoder",
    });

    const temporalPass = commandEncoder.beginComputePass({
      label: "lesson-89-temporal-pass",
    });
    temporalPass.setPipeline(temporalPipeline);
    temporalPass.setBindGroup(0, state.temporalBindGroup);
    temporalPass.dispatchWorkgroups(Math.ceil(GRID_WIDTH / 8), Math.ceil(GRID_HEIGHT / 8));
    temporalPass.end();

    const spatialPass = commandEncoder.beginComputePass({
      label: "lesson-89-spatial-pass",
    });
    spatialPass.setPipeline(spatialPipeline);
    spatialPass.setBindGroup(0, state.spatialBindGroup);
    spatialPass.dispatchWorkgroups(Math.ceil(GRID_WIDTH / 8), Math.ceil(GRID_HEIGHT / 8));
    spatialPass.end();

    const accumulationPass = commandEncoder.beginComputePass({
      label: "lesson-89-accumulation-pass",
    });
    accumulationPass.setPipeline(accumulationPipeline);
    accumulationPass.setBindGroup(0, state.accumulationBindGroup);
    accumulationPass.dispatchWorkgroups(Math.ceil(GRID_WIDTH / 8), Math.ceil(GRID_HEIGHT / 8));
    accumulationPass.end();

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
    commandEncoder.copyBufferToBuffer(
      state.naiveAccumBuffer,
      0,
      state.previousNaiveAccumBuffer,
      0,
      GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE
    );
    commandEncoder.copyBufferToBuffer(
      state.stabilizedAccumBuffer,
      0,
      state.previousStabilizedAccumBuffer,
      0,
      GRID_WIDTH * GRID_HEIGHT * VALUE_STRIDE
    );

    const renderPass = commandEncoder.beginRenderPass({
      label: "lesson-89-present-pass",
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
    renderPass.setBindGroup(0, state.presentBindGroup);
    renderPass.draw(3);
    renderPass.end();

    gpu.device.queue.submit([commandEncoder.finish()]);

    accumulatedFrames += 1;
    previousOffset = currentOffset;
    updateStabilizationHud(refs, settings, accumulatedFrames);
    animationFrame = requestAnimationFrame(render);
  };

  const handleMode = () => {
    settings.motionMode = settings.motionMode === "pan" ? "static" : "pan";
    clearHistory();
    updateStabilizationHud(refs, settings, accumulatedFrames);
  };
  const handleBlend = () => {
    settings.historyBlend = Number(refs.blendRange.value);
    clearHistory();
    updateStabilizationHud(refs, settings, accumulatedFrames);
  };
  const handleClamp = () => {
    settings.clampStrength = Number(refs.clampRange.value);
    clearHistory();
    updateStabilizationHud(refs, settings, accumulatedFrames);
  };
  const handleLight = () => {
    settings.lightAnimation = !settings.lightAnimation;
    clearHistory();
    updateStabilizationHud(refs, settings, accumulatedFrames);
  };
  const handleReset = () => {
    clearHistory();
    updateStabilizationHud(refs, settings, accumulatedFrames);
  };

  refs.modeButton.addEventListener("click", handleMode);
  refs.blendRange.addEventListener("input", handleBlend);
  refs.clampRange.addEventListener("input", handleClamp);
  refs.lightButton.addEventListener("click", handleLight);
  refs.resetButton.addEventListener("click", handleReset);

  setStatus({
    title: "ReSTIR DI 的时域稳定化与入口级降噪已运行",
    detail:
      "左栏保持 current ReSTIR DI，中栏只做 naive accumulation，右栏再加 reprojection + history clamp。重点看运动时 history 会不会变脏。",
    tone: "ok",
  });

  animationFrame = requestAnimationFrame(render);
  return () => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    refs.modeButton.removeEventListener("click", handleMode);
    refs.blendRange.removeEventListener("input", handleBlend);
    refs.clampRange.removeEventListener("input", handleClamp);
    refs.lightButton.removeEventListener("click", handleLight);
    refs.resetButton.removeEventListener("click", handleReset);
    state.settingsBuffer.destroy();
    state.presentUniformBuffer.destroy();
    state.occluderBuffer.destroy();
    state.lightsBuffer.destroy();
    state.previousReservoirBuffer.destroy();
    state.temporalReservoirBuffer.destroy();
    state.finalReservoirBuffer.destroy();
    state.previousSurfaceBuffer.destroy();
    state.currentSurfaceBuffer.destroy();
    state.currentValueBuffer.destroy();
    state.previousNaiveAccumBuffer.destroy();
    state.naiveAccumBuffer.destroy();
    state.previousStabilizedAccumBuffer.destroy();
    state.stabilizedAccumBuffer.destroy();
  };
}
