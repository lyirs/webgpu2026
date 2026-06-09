import {
  generateHammersleyHemisphereSamples,
  generateUniformHemisphereSamples,
  type HemisphereSample,
} from "@/lessons/path-tracing-common/sampling";
import { clamp, dotVectors, projectHemisphereDirection, type Vector3 } from "@/lessons/path-tracing-common/math";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type MonteCarloSettings = {
  samplesPerFrame: number;
  accumulationEnabled: boolean;
  environmentContrast: number;
};

type MonteCarloHudRefs = {
  sampleRange: HTMLInputElement;
  sampleValue: HTMLElement;
  contrastRange: HTMLInputElement;
  contrastValue: HTMLElement;
  accumulationButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  currentCard: HTMLElement;
  runningCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

const LIGHT_DIRECTION: Vector3 = [0.42, 0.82, 0.38];

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

function environmentColor(direction: Vector3, contrast: number): [number, number, number] {
  const highlight = Math.pow(Math.max(dotVectors(direction, LIGHT_DIRECTION), 0), 3 + contrast * 9);
  return [
    0.18 + highlight * 1.18 + Math.max(direction[0], 0) * 0.14,
    0.22 + highlight * 0.86 + Math.max(direction[2], 0) * 0.08,
    0.28 + highlight * 0.62 + Math.max(direction[1], 0) * 0.1,
  ];
}

function luminance(color: [number, number, number]): number {
  return color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
}

function estimateIrradiance(samples: HemisphereSample[], contrast: number): [number, number, number] {
  let sum: [number, number, number] = [0, 0, 0];
  for (const sample of samples) {
    const color = environmentColor(sample.direction, contrast);
    const cosine = Math.max(sample.direction[1], 0);
    const weight = cosine / Math.max(sample.pdf, 1e-5);
    sum = [
      sum[0] + color[0] * weight,
      sum[1] + color[1] * weight,
      sum[2] + color[2] * weight,
    ];
  }
  const scale = 1 / Math.max(samples.length, 1);
  return [sum[0] * scale, sum[1] * scale, sum[2] * scale];
}

function updateHud(
  refs: MonteCarloHudRefs,
  settings: MonteCarloSettings,
  currentEstimate: [number, number, number],
  runningEstimate: [number, number, number],
  reference: [number, number, number],
  accumulatedFrames: number
): void {
  refs.sampleValue.textContent = `${settings.samplesPerFrame} spp`;
  refs.contrastValue.textContent = `${settings.environmentContrast.toFixed(2)}x`;
  refs.accumulationButton.classList.toggle(
    "path-trace-toggle--active",
    settings.accumulationEnabled
  );
  refs.currentCard.textContent = `当前帧亮度约 ${luminance(currentEstimate).toFixed(3)}，它会随着这一帧刚抽到的方向一起抖动。`;
  refs.runningCard.textContent =
    accumulatedFrames > 0
      ? `累计 ${accumulatedFrames} 帧以后，右栏平均亮度约 ${luminance(runningEstimate).toFixed(3)}；reference 是 ${luminance(reference).toFixed(3)}。`
      : "右栏还没有累计历史，所以它暂时只是在等第一批样本。";
  refs.observationCard.textContent = settings.accumulationEnabled
    ? "打开 accumulation 时，右栏会把每一帧 noisy estimate 继续平均下去，所以它收敛得慢，但会逐渐稳定。"
    : "现在 history 被暂停了，所以右栏不会继续向 reference 收敛；你看到的只是单帧估计在不停抽样。";
  refs.legend.textContent =
    "Monte Carlo 的关键不是“这一帧够不够像答案”，而是“无偏估计在很多帧之后会不会朝真正的积分值靠近”。";
}

function drawColorPatch(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: [number, number, number]
): void {
  context.fillStyle = `rgb(${Math.round(clamp(color[0], 0, 1.4) * 255)}, ${Math.round(
    clamp(color[1], 0, 1.4) * 255
  )}, ${Math.round(clamp(color[2], 0, 1.4) * 255)})`;
  context.fillRect(x, y, width, height);
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
}

function drawLineChart(
  context: CanvasRenderingContext2D,
  values: number[],
  referenceValue: number,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string
): void {
  context.fillStyle = "rgba(11, 20, 32, 0.94)";
  context.fillRect(x, y, width, height);
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

  const allValues = values.length > 0 ? [...values, referenceValue] : [referenceValue];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const scale = maxValue - minValue < 1e-5 ? 1 : maxValue - minValue;

  const refY = y + height - ((referenceValue - minValue) / scale) * height;
  context.strokeStyle = "rgba(255, 200, 140, 0.9)";
  context.setLineDash([4, 4]);
  context.beginPath();
  context.moveTo(x, refY);
  context.lineTo(x + width, refY);
  context.stroke();
  context.setLineDash([]);

  if (values.length >= 2) {
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.beginPath();
    values.forEach((value, index) => {
      const px = x + (index / Math.max(values.length - 1, 1)) * width;
      const py = y + height - ((value - minValue) / scale) * height;
      if (index === 0) {
        context.moveTo(px, py);
      } else {
        context.lineTo(px, py);
      }
    });
    context.stroke();
  }
}

export async function mountMonteCarloIntegrationAndHemisphereSamplingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--monte-carlo">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">uniform hemisphere sampling</span>
          <span class="path-trace-badge path-trace-badge--warm">single-frame estimate is noisy</span>
          <span class="path-trace-badge path-trace-badge--cool">running average slowly converges</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Samples per Frame</span>
            <strong id="monte-carlo-sample-value"></strong>
            <input id="monte-carlo-sample-range" type="range" min="4" max="192" step="4" />
          </label>
          <label class="path-trace-control">
            <span>Environment Contrast</span>
            <strong id="monte-carlo-contrast-value"></strong>
            <input id="monte-carlo-contrast-range" type="range" min="0.5" max="2.2" step="0.05" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>History</span>
            <strong>Accumulation</strong>
            <div class="path-trace-toggle-row">
              <button id="monte-carlo-accumulation-button" class="path-trace-toggle" type="button">accumulate</button>
            </div>
          </div>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Estimate</span>
            <strong>Reset</strong>
            <div class="path-trace-toggle-row">
              <button id="monte-carlo-reset-button" class="path-trace-toggle" type="button">reset</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--three">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Sample Directions</strong>
            <span>当前这一帧真正抽到的半球方向，以及它们各自带来的环境颜色。</span>
          </article>
          <article class="path-trace-label">
            <span class="eyebrow">中栏</span>
            <strong>Current Estimate</strong>
            <span>只用这一帧样本做出来的 Monte Carlo 估计，所以会明显抖动。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Running Average</strong>
            <span>继续把 noisy frame 平均下去，才会慢慢靠近 reference。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card">
            <span class="eyebrow">Current Frame</span>
            <strong id="monte-carlo-current-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">Running Average</span>
            <strong id="monte-carlo-running-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">观察</span>
            <strong id="monte-carlo-observation-card"></strong>
          </article>
        </div>
        <article class="path-trace-legend">
          <strong>当前实验</strong>
          <span id="monte-carlo-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: MonteCarloHudRefs = {
    sampleRange: host.querySelector("#monte-carlo-sample-range") as HTMLInputElement,
    sampleValue: host.querySelector("#monte-carlo-sample-value") as HTMLElement,
    contrastRange: host.querySelector("#monte-carlo-contrast-range") as HTMLInputElement,
    contrastValue: host.querySelector("#monte-carlo-contrast-value") as HTMLElement,
    accumulationButton: host.querySelector("#monte-carlo-accumulation-button") as HTMLButtonElement,
    resetButton: host.querySelector("#monte-carlo-reset-button") as HTMLButtonElement,
    currentCard: host.querySelector("#monte-carlo-current-card") as HTMLElement,
    runningCard: host.querySelector("#monte-carlo-running-card") as HTMLElement,
    observationCard: host.querySelector("#monte-carlo-observation-card") as HTMLElement,
    legend: host.querySelector("#monte-carlo-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-76 缺少 canvas。");
  }

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("lesson-76 无法创建 2D context。");
  }

  const settings: MonteCarloSettings = {
    samplesPerFrame: 32,
    accumulationEnabled: true,
    environmentContrast: 1.2,
  };
  refs.sampleRange.value = settings.samplesPerFrame.toString();
  refs.contrastRange.value = settings.environmentContrast.toString();

  let destroyed = false;
  let frameHandle = 0;
  let seed = 1;
  let lastStep = 0;
  let currentEstimate: [number, number, number] = [0, 0, 0];
  let runningEstimate: [number, number, number] = [0, 0, 0];
  let referenceEstimate: [number, number, number] = [0, 0, 0];
  let accumulatedFrames = 0;
  let history: number[] = [];
  let currentSamples: HemisphereSample[] = [];

  const recomputeReference = () => {
    referenceEstimate = estimateIrradiance(
      generateHammersleyHemisphereSamples(8192),
      settings.environmentContrast
    );
  };

  const resetEstimate = () => {
    currentEstimate = [0, 0, 0];
    runningEstimate = [0, 0, 0];
    accumulatedFrames = 0;
    history = [];
    seed = 1;
  };

  const syncHud = () => {
    updateHud(
      refs,
      settings,
      currentEstimate,
      runningEstimate,
      referenceEstimate,
      accumulatedFrames
    );
  };

  const step = () => {
    currentSamples = generateUniformHemisphereSamples(settings.samplesPerFrame, seed * 13 + 5);
    seed += 1;
    currentEstimate = estimateIrradiance(currentSamples, settings.environmentContrast);
    if (settings.accumulationEnabled) {
      accumulatedFrames += 1;
      const blend = 1 / accumulatedFrames;
      runningEstimate = [
        runningEstimate[0] + (currentEstimate[0] - runningEstimate[0]) * blend,
        runningEstimate[1] + (currentEstimate[1] - runningEstimate[1]) * blend,
        runningEstimate[2] + (currentEstimate[2] - runningEstimate[2]) * blend,
      ];
      history.push(luminance(runningEstimate));
      if (history.length > 160) {
        history.shift();
      }
    }
    syncHud();
  };

  refs.sampleRange.addEventListener("input", () => {
    settings.samplesPerFrame = Number(refs.sampleRange.value);
    resetEstimate();
    syncHud();
  });
  refs.contrastRange.addEventListener("input", () => {
    settings.environmentContrast = Number(refs.contrastRange.value);
    recomputeReference();
    resetEstimate();
    syncHud();
  });
  refs.accumulationButton.addEventListener("click", () => {
    settings.accumulationEnabled = !settings.accumulationEnabled;
    syncHud();
  });
  refs.resetButton.addEventListener("click", () => {
    resetEstimate();
    syncHud();
  });

  recomputeReference();
  step();

  setStatus({
    title: "Monte Carlo 积分与半球采样已运行",
    detail:
      "左栏显示这一帧实际抽到的方向，中栏是单帧 estimate，右栏则继续把 noisy frame 平均下去，直到接近 reference。",
    tone: "ok",
  });

  const renderFrame = (timestamp: number) => {
    if (destroyed) {
      return;
    }
    const { width, height, ratio } = resizeCanvas(canvas);
    if (timestamp - lastStep > 220) {
      step();
      lastStep = timestamp;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.scale(ratio, ratio);

    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const gap = 16;
    const panelWidth = (cssWidth - gap * 2) / 3;
    const halfHeight = cssHeight * 0.54;

    for (let panelIndex = 0; panelIndex < 3; panelIndex += 1) {
      const panelX = panelIndex * (panelWidth + gap);
      context.fillStyle = "rgba(7, 16, 28, 0.94)";
      context.fillRect(panelX, 0, panelWidth, cssHeight);
      context.strokeStyle = "rgba(255,255,255,0.08)";
      context.strokeRect(panelX + 0.5, 0.5, panelWidth - 1, cssHeight - 1);
    }

    const scatterX = 18;
    const scatterY = 48;
    const scatterSize = panelWidth - 36;
    const scatterCenterX = scatterX + scatterSize * 0.5;
    const scatterCenterY = scatterY + scatterSize * 0.5;
    const scatterRadius = scatterSize * 0.42;
    context.strokeStyle = "rgba(255,255,255,0.12)";
    context.beginPath();
    context.arc(scatterCenterX, scatterCenterY, scatterRadius, Math.PI, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(scatterCenterX - scatterRadius, scatterCenterY);
    context.lineTo(scatterCenterX + scatterRadius, scatterCenterY);
    context.stroke();
    for (const sample of currentSamples) {
      const projected = projectHemisphereDirection(sample.direction);
      const pointX = scatterCenterX + projected[0] * scatterRadius;
      const pointY = scatterCenterY + projected[1] * scatterRadius;
      const color = environmentColor(sample.direction, settings.environmentContrast);
      context.fillStyle = `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
      context.beginPath();
      context.arc(pointX, pointY, 3.2, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "#ffffff";
    context.font = "600 14px 'Georgia', 'Times New Roman', serif";
    context.fillText("Sample Directions", 18, 24);
    context.fillStyle = "rgba(205, 219, 242, 0.75)";
    context.font = "12px sans-serif";
    context.fillText("uniform hemisphere, colored by sampled environment", 18, 42);

    drawColorPatch(
      context,
      panelWidth + gap + 18,
      56,
      panelWidth - 36,
      halfHeight - 72,
      currentEstimate
    );
    context.fillStyle = "#ffffff";
    context.font = "600 14px 'Georgia', 'Times New Roman', serif";
    context.fillText("Current Estimate", panelWidth + gap + 18, 24);
    context.fillStyle = "rgba(205, 219, 242, 0.75)";
    context.font = "12px sans-serif";
    context.fillText(
      `luminance ${luminance(currentEstimate).toFixed(3)}`,
      panelWidth + gap + 18,
      halfHeight + 10
    );

    drawColorPatch(
      context,
      (panelWidth + gap) * 2 + 18,
      56,
      panelWidth - 36,
      halfHeight - 72,
      accumulatedFrames > 0 ? runningEstimate : referenceEstimate
    );
    drawLineChart(
      context,
      history,
      luminance(referenceEstimate),
      (panelWidth + gap) * 2 + 18,
      halfHeight + 28,
      panelWidth - 36,
      cssHeight - halfHeight - 46,
      "#8de0ff"
    );
    context.fillStyle = "#ffffff";
    context.font = "600 14px 'Georgia', 'Times New Roman', serif";
    context.fillText("Running Average vs Reference", (panelWidth + gap) * 2 + 18, 24);
    context.fillStyle = "rgba(205, 219, 242, 0.75)";
    context.font = "12px sans-serif";
    context.fillText(
      `reference luminance ${luminance(referenceEstimate).toFixed(3)}`,
      (panelWidth + gap) * 2 + 18,
      halfHeight + 16
    );

    frameHandle = window.requestAnimationFrame(renderFrame);
  };

  frameHandle = window.requestAnimationFrame(renderFrame);

  return () => {
    destroyed = true;
    window.cancelAnimationFrame(frameHandle);
  };
}
