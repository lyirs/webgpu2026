import { createWebGpuCanvas } from "@/core/webgpu";
import {
  conePdf,
  createMulberry32,
  generateHammersleyHemisphereSamples,
  ggxReflectionPdf,
  ggxDistribution,
  powerHeuristic,
  sampleGgxReflection,
  sampleUniformCone,
} from "@/lessons/path-tracing-common/sampling";
import {
  clamp,
  dotVectors,
  normalizeVector,
  reflectVector,
  type Vector3,
} from "@/lessons/path-tracing-common/math";
import visualizationShaderSource from "@/lessons/lesson-82-multiple-importance-sampling/visualization.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type MisSettings = {
  roughness: number;
  sampleCount: number;
  lightSize: number;
  freezeSeed: boolean;
};

type MisHudRefs = {
  roughnessRange: HTMLInputElement;
  roughnessValue: HTMLElement;
  sampleRange: HTMLInputElement;
  sampleValue: HTMLElement;
  lightRange: HTMLInputElement;
  lightValue: HTMLElement;
  freezeButton: HTMLButtonElement;
  lightCard: HTMLElement;
  brdfCard: HTMLElement;
  misCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type EstimateResult = {
  estimate: [number, number, number];
  lightPdf: number;
  brdfPdf: number;
  misWeight: number;
};

type MisGpuState = {
  settingsBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

const NORMAL: Vector3 = [0, 1, 0];
const VIEW_DIRECTION = normalizeVector([0.0, 0.58, 0.82]);

function luminance(color: [number, number, number]): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function highlightDirection(): Vector3 {
  return normalizeVector(reflectVector([-VIEW_DIRECTION[0], -VIEW_DIRECTION[1], -VIEW_DIRECTION[2]], NORMAL));
}

function environmentRadiance(direction: Vector3, lightSize: number): [number, number, number] {
  const light = highlightDirection();
  const angular = 1 - clamp(dotVectors(direction, light), -1, 1);
  const highlight = Math.exp(-angular / Math.max(lightSize * lightSize, 0.018)) * 18;
  return [0.08 + highlight, 0.09 + highlight * 0.92, 0.12 + highlight * 0.84];
}

function highlightConeAngle(lightSize: number): number {
  return clamp(lightSize * 1.35, 0.08, 0.72);
}

function evaluateSpecularBrdf(incoming: Vector3, roughness: number): number {
  const outgoing = VIEW_DIRECTION;
  const normalDotLight = clamp(dotVectors(NORMAL, incoming), 0, 1);
  const normalDotView = clamp(dotVectors(NORMAL, outgoing), 0, 1);
  if (normalDotLight <= 0 || normalDotView <= 0) {
    return 0;
  }
  const halfVector = normalizeVector([
    incoming[0] + outgoing[0],
    incoming[1] + outgoing[1],
    incoming[2] + outgoing[2],
  ]);
  const normalDotHalf = clamp(dotVectors(NORMAL, halfVector), 0, 1);
  const viewDotHalf = clamp(dotVectors(outgoing, halfVector), 0, 1);
  const alpha = Math.max(roughness * roughness, 0.03);
  const distribution = ggxDistribution(normalDotHalf, alpha);
  const k = ((alpha + 1) * (alpha + 1)) / 8;
  const geometry =
    (normalDotLight / Math.max(normalDotLight * (1 - k) + k, 1e-5)) *
    (normalDotView / Math.max(normalDotView * (1 - k) + k, 1e-5));
  const fresnel = 0.08 + (1 - 0.08) * Math.pow(1 - viewDotHalf, 5);
  return (distribution * geometry * fresnel) / Math.max(4 * normalDotLight * normalDotView, 1e-5);
}

function estimateLightSampling(sampleCount: number, roughness: number, lightSize: number, seed: number): EstimateResult {
  const random = createMulberry32(seed);
  let estimate: [number, number, number] = [0, 0, 0];
  let lightPdf = 0;
  let brdfPdf = 0;
  const coneAngle = highlightConeAngle(lightSize);
  const lightAxis = highlightDirection();
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = sampleUniformCone(random(), random(), lightAxis, coneAngle);
    const radiance = environmentRadiance(sample.direction, lightSize);
    const brdfValue = evaluateSpecularBrdf(sample.direction, roughness);
    const brdfSamplePdf = ggxReflectionPdf(sample.direction, roughness, VIEW_DIRECTION, NORMAL);
    estimate = [
      estimate[0] + (radiance[0] * brdfValue * Math.max(sample.direction[1], 0)) / sample.pdf,
      estimate[1] + (radiance[1] * brdfValue * Math.max(sample.direction[1], 0)) / sample.pdf,
      estimate[2] + (radiance[2] * brdfValue * Math.max(sample.direction[1], 0)) / sample.pdf,
    ];
    lightPdf += sample.pdf;
    brdfPdf += brdfSamplePdf;
  }
  const scale = 1 / Math.max(sampleCount, 1);
  return {
    estimate: [estimate[0] * scale, estimate[1] * scale, estimate[2] * scale],
    lightPdf: lightPdf * scale,
    brdfPdf: brdfPdf * scale,
    misWeight: 1,
  };
}

function estimateBrdfSampling(sampleCount: number, roughness: number, lightSize: number, seed: number): EstimateResult {
  const random = createMulberry32(seed);
  let estimate: [number, number, number] = [0, 0, 0];
  let lightPdf = 0;
  let brdfPdf = 0;
  const coneAngle = highlightConeAngle(lightSize);
  const lightAxis = highlightDirection();
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = sampleGgxReflection(random(), random(), roughness, VIEW_DIRECTION, NORMAL);
    if (!sample) {
      continue;
    }
    const radiance = environmentRadiance(sample.direction, lightSize);
    const brdfValue = evaluateSpecularBrdf(sample.direction, roughness);
    estimate = [
      estimate[0] + (radiance[0] * brdfValue * Math.max(sample.direction[1], 0)) / sample.pdf,
      estimate[1] + (radiance[1] * brdfValue * Math.max(sample.direction[1], 0)) / sample.pdf,
      estimate[2] + (radiance[2] * brdfValue * Math.max(sample.direction[1], 0)) / sample.pdf,
    ];
    brdfPdf += sample.pdf;
    lightPdf += conePdf(sample.direction, lightAxis, coneAngle);
  }
  const scale = 1 / Math.max(sampleCount, 1);
  return {
    estimate: [estimate[0] * scale, estimate[1] * scale, estimate[2] * scale],
    lightPdf: lightPdf * scale,
    brdfPdf: brdfPdf * scale,
    misWeight: 1,
  };
}

function estimateMis(sampleCount: number, roughness: number, lightSize: number, seed: number): EstimateResult {
  const random = createMulberry32(seed);
  let estimate: [number, number, number] = [0, 0, 0];
  let lightPdf = 0;
  let brdfPdf = 0;
  let misWeight = 0;
  const coneAngle = highlightConeAngle(lightSize);
  const lightAxis = highlightDirection();
  for (let index = 0; index < sampleCount; index += 1) {
    const useLight = index % 2 === 0;
    let direction: Vector3 | null = null;
    let sourcePdf = 0;
    let competingPdf = 0;
    if (useLight) {
      const lightSample = sampleUniformCone(random(), random(), lightAxis, coneAngle);
      direction = lightSample.direction;
      sourcePdf = lightSample.pdf;
      competingPdf = ggxReflectionPdf(direction, roughness, VIEW_DIRECTION, NORMAL);
    } else {
      const brdfSample = sampleGgxReflection(random(), random(), roughness, VIEW_DIRECTION, NORMAL);
      if (!brdfSample) {
        continue;
      }
      direction = brdfSample.direction;
      sourcePdf = brdfSample.pdf;
      competingPdf = conePdf(direction, lightAxis, coneAngle);
    }
    if (!direction || sourcePdf <= 0) {
      continue;
    }
    lightPdf += useLight ? sourcePdf : competingPdf;
    brdfPdf += useLight ? competingPdf : sourcePdf;
    misWeight += powerHeuristic(sourcePdf, competingPdf, 2);
    const radiance = environmentRadiance(direction, lightSize);
    const brdfValue = evaluateSpecularBrdf(direction, roughness);
    const value =
      (brdfValue * Math.max(direction[1], 0)) /
      Math.max(sourcePdf, 1e-5) *
      powerHeuristic(sourcePdf, competingPdf, 2) *
      2;
    estimate = [
      estimate[0] + radiance[0] * value,
      estimate[1] + radiance[1] * value,
      estimate[2] + radiance[2] * value,
    ];
  }
  const scale = 1 / Math.max(sampleCount, 1);
  return {
    estimate: [estimate[0] * scale, estimate[1] * scale, estimate[2] * scale],
    lightPdf: lightPdf * scale,
    brdfPdf: brdfPdf * scale,
    misWeight: misWeight * scale,
  };
}

function estimateReference(roughness: number, lightSize: number): [number, number, number] {
  const samples = generateHammersleyHemisphereSamples(4096);
  let estimate: [number, number, number] = [0, 0, 0];
  for (const sample of samples) {
    const radiance = environmentRadiance(sample.direction, lightSize);
    const brdfValue = evaluateSpecularBrdf(sample.direction, roughness);
    estimate = [
      estimate[0] + (radiance[0] * brdfValue * Math.max(sample.direction[1], 0)) / sample.pdf,
      estimate[1] + (radiance[1] * brdfValue * Math.max(sample.direction[1], 0)) / sample.pdf,
      estimate[2] + (radiance[2] * brdfValue * Math.max(sample.direction[1], 0)) / sample.pdf,
    ];
  }
  const scale = 1 / samples.length;
  return [estimate[0] * scale, estimate[1] * scale, estimate[2] * scale];
}

function updateHud(
  refs: MisHudRefs,
  settings: MisSettings,
  lightOnly: EstimateResult,
  brdfOnly: EstimateResult,
  mis: EstimateResult,
  reference: [number, number, number]
): void {
  refs.roughnessValue.textContent = settings.roughness.toFixed(2);
  refs.sampleValue.textContent = `${settings.sampleCount}`;
  refs.lightValue.textContent = settings.lightSize.toFixed(2);
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeSeed);
  refs.lightCard.textContent =
    `左栏估计亮度约 ${luminance(lightOnly.estimate).toFixed(2)}，light pdf ≈ ${lightOnly.lightPdf.toFixed(2)}。小光源时它更容易打中真正重要的位置。`;
  refs.brdfCard.textContent =
    `中栏估计亮度约 ${luminance(brdfOnly.estimate).toFixed(2)}，brdf pdf ≈ ${brdfOnly.brdfPdf.toFixed(2)}。低 roughness 时它会明显偏向高光 lobe。`;
  refs.misCard.textContent =
    `右栏估计亮度约 ${luminance(mis.estimate).toFixed(2)}，当前 MIS weight ≈ ${mis.misWeight.toFixed(2)}；reference ≈ ${luminance(reference).toFixed(2)}。`;
  refs.observationCard.textContent =
    settings.roughness < 0.22
      ? "当前 roughness 很低，所以高光 lobe 很尖；这时左/中栏各自都会偏科，右栏的 MIS 优势会最明显。"
      : "roughness 拉高以后，高光不再那么尖，两种策略的差距会缩小，但 MIS 仍然更不容易在某一侧明显失手。";
  refs.legend.textContent =
    "这节课的三栏可视化现在由 GPU 直接生成：uniform、GGX 和 MIS 各自的 sample lobe 与 glossy patch 都会跟着 roughness 和 light size 改变。";
}

function createSettingsData(width: number, height: number, settings: MisSettings, time: number): Float32Array {
  return new Float32Array([
    width,
    height,
    settings.roughness,
    settings.sampleCount,
    settings.lightSize,
    time,
    settings.freezeSeed ? 1 : 0,
    0,
    0,
    0,
  ]);
}

function createUniformBuffer(device: GPUDevice, size: number, label: string): GPUBuffer {
  return device.createBuffer({
    label,
    size,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
}

function createScenePipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const module = device.createShaderModule({ code: visualizationShaderSource });
  return device.createRenderPipeline({
    label: "lesson-82-visualization-pipeline",
    layout: "auto",
    vertex: { module, entryPoint: "vsFullscreen" },
    fragment: { module, entryPoint: "fsVisualize", targets: [{ format }] },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });
}

function createGpuState(device: GPUDevice, pipeline: GPURenderPipeline): MisGpuState {
  const settingsBuffer = createUniformBuffer(device, 10 * 4, "lesson-82-settings");
  const bindGroup = device.createBindGroup({
    label: "lesson-82-bind-group",
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: settingsBuffer } }],
  });
  return { settingsBuffer, bindGroup };
}

export async function mountMultipleImportanceSamplingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--mis">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">same glossy target, different direct-light strategies</span>
          <span class="path-trace-badge path-trace-badge--warm">left: light sampling only</span>
          <span class="path-trace-badge">middle: BRDF sampling only</span>
          <span class="path-trace-badge path-trace-badge--cool">right: MIS</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Roughness</span>
            <strong id="mis-roughness-value"></strong>
            <input id="mis-roughness-range" type="range" min="0.08" max="0.7" step="0.02" />
          </label>
          <label class="path-trace-control">
            <span>Sample Count</span>
            <strong id="mis-sample-value"></strong>
            <input id="mis-sample-range" type="range" min="8" max="80" step="4" />
          </label>
          <label class="path-trace-control">
            <span>Light Size</span>
            <strong id="mis-light-value"></strong>
            <input id="mis-light-range" type="range" min="0.12" max="0.52" step="0.02" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Seed</span>
            <strong>Freeze Seed</strong>
            <div class="path-trace-toggle-row">
              <button id="mis-freeze-button" class="path-trace-toggle" type="button">freeze</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--three">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Light Sampling</strong>
            <span>更擅长打中小光源，但和 glossy BRDF lobe 不匹配时也会浪费预算。</span>
          </article>
          <article class="path-trace-label">
            <span class="eyebrow">中栏</span>
            <strong>BRDF Sampling</strong>
            <span>更擅长沿高光 lobe 采样，但如果环境高亮不在那里，也会显得低效。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>MIS</strong>
            <span>用 power heuristic 合并两种 direct-light strategy，让它们各自在擅长的地方出力。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="mis-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Light PDF</span><strong id="mis-light-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">BRDF PDF</span><strong id="mis-brdf-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">MIS</span><strong id="mis-mis-card"></strong></article>
        </div>
        <article class="path-trace-observation">
          <span class="eyebrow">当前实验</span>
          <strong id="mis-observation-card"></strong>
        </article>
        <p id="mis-legend" class="path-trace-legend"></p>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#mis-canvas");
  if (!canvas) {
    throw new Error("lesson 82 canvas not found");
  }

  const refs: MisHudRefs = {
    roughnessRange: host.querySelector<HTMLInputElement>("#mis-roughness-range")!,
    roughnessValue: host.querySelector<HTMLElement>("#mis-roughness-value")!,
    sampleRange: host.querySelector<HTMLInputElement>("#mis-sample-range")!,
    sampleValue: host.querySelector<HTMLElement>("#mis-sample-value")!,
    lightRange: host.querySelector<HTMLInputElement>("#mis-light-range")!,
    lightValue: host.querySelector<HTMLElement>("#mis-light-value")!,
    freezeButton: host.querySelector<HTMLButtonElement>("#mis-freeze-button")!,
    lightCard: host.querySelector<HTMLElement>("#mis-light-card")!,
    brdfCard: host.querySelector<HTMLElement>("#mis-brdf-card")!,
    misCard: host.querySelector<HTMLElement>("#mis-mis-card")!,
    observationCard: host.querySelector<HTMLElement>("#mis-observation-card")!,
    legend: host.querySelector<HTMLElement>("#mis-legend")!,
  };

  const gpu = await createWebGpuCanvas(canvas);
  const pipeline = createScenePipeline(gpu.device, gpu.format);
  const gpuState = createGpuState(gpu.device, pipeline);

  const settings: MisSettings = {
    roughness: 0.18,
    sampleCount: 24,
    lightSize: 0.22,
    freezeSeed: false,
  };

  refs.roughnessRange.value = String(settings.roughness);
  refs.sampleRange.value = String(settings.sampleCount);
  refs.lightRange.value = String(settings.lightSize);

  let time = 0;
  let rafId = 0;

  const recomputeHud = () => {
    const lightOnly = estimateLightSampling(settings.sampleCount, settings.roughness, settings.lightSize, 1337);
    const brdfOnly = estimateBrdfSampling(settings.sampleCount, settings.roughness, settings.lightSize, 2667);
    const mis = estimateMis(settings.sampleCount, settings.roughness, settings.lightSize, 3559);
    const reference = estimateReference(settings.roughness, settings.lightSize);
    updateHud(refs, settings, lightOnly, brdfOnly, mis, reference);
  };

  const syncSettings = () => {
    settings.roughness = Number(refs.roughnessRange.value);
    settings.sampleCount = Number(refs.sampleRange.value);
    settings.lightSize = Number(refs.lightRange.value);
    recomputeHud();
  };

  refs.roughnessRange.addEventListener("input", syncSettings);
  refs.sampleRange.addEventListener("input", syncSettings);
  refs.lightRange.addEventListener("input", syncSettings);
  refs.freezeButton.addEventListener("click", () => {
    settings.freezeSeed = !settings.freezeSeed;
    recomputeHud();
  });

  recomputeHud();
  setStatus({
    title: "MIS lesson 已运行",
    detail:
      "三栏 glossy lobe 和底部 estimate patch 现在都由 WebGPU 直接绘制；卡片上的 pdf、reference 和 MIS weight 继续用于解释为什么右栏最稳。",
    tone: "ok",
  });

  const render = () => {
    gpu.resize();
    if (!settings.freezeSeed) {
      time += 0.016;
    }
    gpu.device.queue.writeBuffer(
      gpuState.settingsBuffer,
      0,
      createSettingsData(canvas.width, canvas.height, settings, time)
    );
    const encoder = gpu.device.createCommandEncoder({ label: "lesson-82-command-encoder" });
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: gpu.context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.03, g: 0.05, b: 0.08, a: 1 },
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, gpuState.bindGroup);
    pass.draw(3);
    pass.end();
    gpu.device.queue.submit([encoder.finish()]);
    rafId = requestAnimationFrame(render);
  };

  rafId = requestAnimationFrame(render);

  return () => {
    cancelAnimationFrame(rafId);
    gpuState.settingsBuffer.destroy();
  };
}
