import {
  createMulberry32,
  generateHammersleyHemisphereSamples,
  ggxDistribution,
  sampleGgxReflection,
  sampleUniformHemisphere,
} from "@/lessons/path-tracing-common/sampling";
import {
  clamp,
  dotVectors,
  normalizeVector,
  projectHemisphereDirection,
  reflectVector,
  type Vector3,
} from "@/lessons/path-tracing-common/math";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type ImportanceSamplingSettings = {
  roughness: number;
  sampleCount: number;
  highlightWidth: number;
  animateSeed: boolean;
};

type ImportanceSamplingHudRefs = {
  roughnessRange: HTMLInputElement;
  roughnessValue: HTMLElement;
  sampleRange: HTMLInputElement;
  sampleValue: HTMLElement;
  widthRange: HTMLInputElement;
  widthValue: HTMLElement;
  animateButton: HTMLButtonElement;
  uniformCard: HTMLElement;
  importanceCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

const NORMAL: Vector3 = [0, 1, 0];
const VIEW_DIRECTION = normalizeVector([0.0, 0.58, 0.82]);

function resizeCanvas(canvas: HTMLCanvasElement): { width: number; height: number; ratio: number } {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height, ratio };
}

function luminance(color: [number, number, number]): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function highlightDirection(): Vector3 {
  return normalizeVector(reflectVector([-VIEW_DIRECTION[0], -VIEW_DIRECTION[1], -VIEW_DIRECTION[2]], NORMAL));
}

function environmentRadiance(direction: Vector3, width: number): [number, number, number] {
  const light = highlightDirection();
  const angular = 1 - clamp(dotVectors(direction, light), -1, 1);
  const highlight = Math.exp(-angular / Math.max(width * width, 0.02)) * 16;
  return [
    0.1 + highlight * 1.0 + Math.max(direction[0], 0) * 0.06,
    0.12 + highlight * 0.9,
    0.16 + highlight * 0.78 + Math.max(direction[2], 0) * 0.04,
  ];
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
  const k = (alpha + 1) * (alpha + 1) / 8;
  const geometry =
    (normalDotLight / Math.max(normalDotLight * (1 - k) + k, 1e-5)) *
    (normalDotView / Math.max(normalDotView * (1 - k) + k, 1e-5));
  const fresnel = 0.08 + (1 - 0.08) * Math.pow(1 - viewDotHalf, 5);
  return (distribution * geometry * fresnel) / Math.max(4 * normalDotLight * normalDotView, 1e-5);
}

function estimateUniform(
  sampleCount: number,
  roughness: number,
  width: number,
  seed: number
): { estimate: [number, number, number]; directions: Vector3[] } {
  const random = createMulberry32(seed);
  const directions: Vector3[] = [];
  let estimate: [number, number, number] = [0, 0, 0];
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = sampleUniformHemisphere(random(), random());
    directions.push(sample.direction);
    const radiance = environmentRadiance(sample.direction, width);
    const weight =
      evaluateSpecularBrdf(sample.direction, roughness) *
      Math.max(sample.direction[1], 0) /
      sample.pdf;
    estimate = [
      estimate[0] + radiance[0] * weight,
      estimate[1] + radiance[1] * weight,
      estimate[2] + radiance[2] * weight,
    ];
  }
  const scale = 1 / Math.max(sampleCount, 1);
  return {
    estimate: [estimate[0] * scale, estimate[1] * scale, estimate[2] * scale],
    directions,
  };
}

function estimateImportance(
  sampleCount: number,
  roughness: number,
  width: number,
  seed: number
): { estimate: [number, number, number]; directions: Vector3[] } {
  const random = createMulberry32(seed);
  const directions: Vector3[] = [];
  let estimate: [number, number, number] = [0, 0, 0];
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = sampleGgxReflection(random(), random(), roughness, VIEW_DIRECTION, NORMAL);
    if (!sample) {
      continue;
    }
    directions.push(sample.direction);
    const radiance = environmentRadiance(sample.direction, width);
    const weight =
      evaluateSpecularBrdf(sample.direction, roughness) *
      Math.max(sample.direction[1], 0) /
      sample.pdf;
    estimate = [
      estimate[0] + radiance[0] * weight,
      estimate[1] + radiance[1] * weight,
      estimate[2] + radiance[2] * weight,
    ];
  }
  const scale = 1 / Math.max(sampleCount, 1);
  return {
    estimate: [estimate[0] * scale, estimate[1] * scale, estimate[2] * scale],
    directions,
  };
}

function estimateReference(roughness: number, width: number): [number, number, number] {
  const samples = generateHammersleyHemisphereSamples(8192);
  let estimate: [number, number, number] = [0, 0, 0];
  for (const sample of samples) {
    const radiance = environmentRadiance(sample.direction, width);
    const weight =
      evaluateSpecularBrdf(sample.direction, roughness) *
      Math.max(sample.direction[1], 0) /
      sample.pdf;
    estimate = [
      estimate[0] + radiance[0] * weight,
      estimate[1] + radiance[1] * weight,
      estimate[2] + radiance[2] * weight,
    ];
  }
  const scale = 1 / samples.length;
  return [estimate[0] * scale, estimate[1] * scale, estimate[2] * scale];
}

function updateHud(
  refs: ImportanceSamplingHudRefs,
  settings: ImportanceSamplingSettings,
  uniformEstimate: [number, number, number],
  importanceEstimate: [number, number, number],
  reference: [number, number, number]
): void {
  refs.roughnessValue.textContent = settings.roughness.toFixed(2);
  refs.sampleValue.textContent = `${settings.sampleCount} samples`;
  refs.widthValue.textContent = settings.highlightWidth.toFixed(2);
  refs.animateButton.classList.toggle("path-trace-toggle--active", settings.animateSeed);
  refs.uniformCard.textContent =
    `uniform 采样当前亮度约 ${luminance(uniformEstimate).toFixed(3)}；高光越尖，它越容易浪费样本在几乎没贡献的方向上。`;
  refs.importanceCard.textContent =
    `importance sampling 当前亮度约 ${luminance(importanceEstimate).toFixed(3)}；reference 是 ${luminance(reference).toFixed(3)}。`;
  refs.observationCard.textContent =
    settings.roughness < 0.3
      ? "当前 roughness 很低，所以高光 lobe 很尖。越尖的积分，越值得把采样往真正有贡献的方向挤过去。"
      : "roughness 拉高以后，高光 lobe 会变宽，所以 uniform 与 importance 的差距会自然缩小，但不会完全消失。";
  refs.legend.textContent =
    "Importance sampling 不是魔法，它只是让样本分布更贴近真正高贡献的方向，因此同样预算下方差会更低。";
}

function drawPatch(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number]
): void {
  context.fillStyle = `rgb(${Math.round(clamp(color[0], 0, 1.8) * 180)}, ${Math.round(
    clamp(color[1], 0, 1.8) * 180
  )}, ${Math.round(clamp(color[2], 0, 1.8) * 180)})`;
  context.fillRect(x, y, width, height);
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

export async function mountBrdfImportanceSamplingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--importance-sampling">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">same budget, two sampling strategies</span>
          <span class="path-trace-badge path-trace-badge--warm">left: uniform hemisphere</span>
          <span class="path-trace-badge path-trace-badge--cool">right: GGX importance sampling</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Roughness</span>
            <strong id="importance-roughness-value"></strong>
            <input id="importance-roughness-range" type="range" min="0.08" max="0.82" step="0.01" />
          </label>
          <label class="path-trace-control">
            <span>Sample Count</span>
            <strong id="importance-sample-value"></strong>
            <input id="importance-sample-range" type="range" min="8" max="192" step="4" />
          </label>
          <label class="path-trace-control">
            <span>Highlight Width</span>
            <strong id="importance-width-value"></strong>
            <input id="importance-width-range" type="range" min="0.08" max="0.42" step="0.01" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Seed</span>
            <strong>Animate Seed</strong>
            <div class="path-trace-toggle-row">
              <button id="importance-animate-button" class="path-trace-toggle" type="button">animate</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--two">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Uniform Sampling</strong>
            <span>样本均匀撒在半球上，所以会在很多几乎没贡献的方向上浪费预算。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>GGX Importance Sampling</strong>
            <span>把样本挤向真正高贡献的镜面 lobe，预算不变但高光更稳。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card">
            <span class="eyebrow">Uniform</span>
            <strong id="importance-uniform-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">Importance</span>
            <strong id="importance-importance-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">观察</span>
            <strong id="importance-observation-card"></strong>
          </article>
        </div>
        <article class="path-trace-legend">
          <strong>当前实验</strong>
          <span id="importance-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: ImportanceSamplingHudRefs = {
    roughnessRange: host.querySelector("#importance-roughness-range") as HTMLInputElement,
    roughnessValue: host.querySelector("#importance-roughness-value") as HTMLElement,
    sampleRange: host.querySelector("#importance-sample-range") as HTMLInputElement,
    sampleValue: host.querySelector("#importance-sample-value") as HTMLElement,
    widthRange: host.querySelector("#importance-width-range") as HTMLInputElement,
    widthValue: host.querySelector("#importance-width-value") as HTMLElement,
    animateButton: host.querySelector("#importance-animate-button") as HTMLButtonElement,
    uniformCard: host.querySelector("#importance-uniform-card") as HTMLElement,
    importanceCard: host.querySelector("#importance-importance-card") as HTMLElement,
    observationCard: host.querySelector("#importance-observation-card") as HTMLElement,
    legend: host.querySelector("#importance-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-77 缺少 canvas。");
  }
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("lesson-77 无法创建 2D context。");
  }

  const settings: ImportanceSamplingSettings = {
    roughness: 0.24,
    sampleCount: 48,
    highlightWidth: 0.18,
    animateSeed: true,
  };
  refs.roughnessRange.value = settings.roughness.toString();
  refs.sampleRange.value = settings.sampleCount.toString();
  refs.widthRange.value = settings.highlightWidth.toString();

  let destroyed = false;
  let frameHandle = 0;
  let seed = 1;
  let lastStep = 0;
  let referenceEstimate = estimateReference(settings.roughness, settings.highlightWidth);
  let uniformEstimate: [number, number, number] = [0, 0, 0];
  let importanceEstimate: [number, number, number] = [0, 0, 0];
  let uniformDirections: Vector3[] = [];
  let importanceDirections: Vector3[] = [];

  const recompute = () => {
    referenceEstimate = estimateReference(settings.roughness, settings.highlightWidth);
    const uniform = estimateUniform(
      settings.sampleCount,
      settings.roughness,
      settings.highlightWidth,
      seed * 19 + 3
    );
    const importance = estimateImportance(
      settings.sampleCount,
      settings.roughness,
      settings.highlightWidth,
      seed * 19 + 11
    );
    uniformEstimate = uniform.estimate;
    importanceEstimate = importance.estimate;
    uniformDirections = uniform.directions;
    importanceDirections = importance.directions;
    updateHud(refs, settings, uniformEstimate, importanceEstimate, referenceEstimate);
  };

  refs.roughnessRange.addEventListener("input", () => {
    settings.roughness = Number(refs.roughnessRange.value);
    recompute();
  });
  refs.sampleRange.addEventListener("input", () => {
    settings.sampleCount = Number(refs.sampleRange.value);
    recompute();
  });
  refs.widthRange.addEventListener("input", () => {
    settings.highlightWidth = Number(refs.widthRange.value);
    recompute();
  });
  refs.animateButton.addEventListener("click", () => {
    settings.animateSeed = !settings.animateSeed;
    updateHud(refs, settings, uniformEstimate, importanceEstimate, referenceEstimate);
  });

  recompute();

  setStatus({
    title: "BRDF Importance Sampling 已运行",
    detail:
      "左栏继续均匀撒样本，右栏则把样本挤向 GGX lobe。盯住低 roughness 时两边估计稳定性的差别就行。",
    tone: "ok",
  });

  const renderFrame = (timestamp: number) => {
    if (destroyed) {
      return;
    }
    const { width, height, ratio } = resizeCanvas(canvas);
    if (settings.animateSeed && timestamp - lastStep > 240) {
      seed += 1;
      recompute();
      lastStep = timestamp;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.scale(ratio, ratio);

    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const gap = 16;
    const panelWidth = (cssWidth - gap) / 2;
    const panelHeight = cssHeight;

    const panels = [
      { x: 0, title: "Uniform Hemisphere", color: "#f7cf8d", directions: uniformDirections, estimate: uniformEstimate },
      { x: panelWidth + gap, title: "GGX Importance", color: "#8de0ff", directions: importanceDirections, estimate: importanceEstimate },
    ];

    for (const panel of panels) {
      context.fillStyle = "rgba(7, 16, 28, 0.94)";
      context.fillRect(panel.x, 0, panelWidth, panelHeight);
      context.strokeStyle = "rgba(255,255,255,0.08)";
      context.strokeRect(panel.x + 0.5, 0.5, panelWidth - 1, panelHeight - 1);
      context.fillStyle = "#ffffff";
      context.font = "600 14px 'Georgia', 'Times New Roman', serif";
      context.fillText(panel.title, panel.x + 18, 24);
      context.fillStyle = "rgba(205, 219, 242, 0.75)";
      context.font = "12px sans-serif";
      context.fillText(`luminance ${luminance(panel.estimate).toFixed(3)}`, panel.x + 18, 42);

      const circleSize = panelWidth - 36;
      const circleX = panel.x + 18;
      const circleY = 56;
      const centerX = circleX + circleSize * 0.5;
      const centerY = circleY + circleSize * 0.5;
      const radius = circleSize * 0.42;
      context.fillStyle = "rgba(11, 20, 32, 0.94)";
      context.fillRect(circleX, circleY, circleSize, circleSize);
      context.strokeStyle = "rgba(255,255,255,0.08)";
      context.strokeRect(circleX + 0.5, circleY + 0.5, circleSize - 1, circleSize - 1);
      context.beginPath();
      context.arc(centerX, centerY, radius, Math.PI, Math.PI * 2);
      context.stroke();
      for (const direction of panel.directions) {
        const projected = projectHemisphereDirection(direction);
        context.fillStyle = panel.color;
        context.beginPath();
        context.arc(centerX + projected[0] * radius, centerY + projected[1] * radius, 3, 0, Math.PI * 2);
        context.fill();
      }

      drawPatch(context, panel.x + 18, circleY + circleSize + 22, panelWidth - 36, 98, panel.estimate);
      context.fillStyle = "rgba(255, 200, 140, 0.85)";
      context.fillRect(panel.x + 18, circleY + circleSize + 132, panelWidth - 36, 3);
      context.fillStyle = "rgba(205, 219, 242, 0.75)";
      context.fillText(
        `reference luminance ${luminance(referenceEstimate).toFixed(3)}`,
        panel.x + 18,
        circleY + circleSize + 152
      );
    }

    frameHandle = window.requestAnimationFrame(renderFrame);
  };

  frameHandle = window.requestAnimationFrame(renderFrame);

  return () => {
    destroyed = true;
    window.cancelAnimationFrame(frameHandle);
  };
}
