import {
  generateBlueNoiseLikePoints,
  generateStratifiedJitterPoints,
  generateWhiteNoisePoints,
  type SamplePoint,
} from "@/lessons/path-tracing-common/sampling";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type BlueNoiseSettings = {
  sampleCount: number;
  pointSize: number;
  animateSeed: boolean;
  showIntegralResult: boolean;
};

type BlueNoiseHudRefs = {
  sampleRange: HTMLInputElement;
  sampleValue: HTMLElement;
  pointRange: HTMLInputElement;
  pointValue: HTMLElement;
  animateButton: HTMLButtonElement;
  integralButton: HTMLButtonElement;
  whiteCard: HTMLElement;
  stratifiedCard: HTMLElement;
  blueCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type PatternSet = {
  label: string;
  subtitle: string;
  points: SamplePoint[];
  color: string;
};

const PATTERN_COLORS = {
  white: "#f7cf8d",
  stratified: "#8de0ff",
  blue: "#d8b6ff",
};

function formatCount(value: number): string {
  return `${Math.round(value)} samples`;
}

function updateHud(refs: BlueNoiseHudRefs, settings: BlueNoiseSettings): void {
  refs.sampleValue.textContent = formatCount(settings.sampleCount);
  refs.pointValue.textContent = `${settings.pointSize.toFixed(1)} px`;
  refs.animateButton.classList.toggle("path-trace-toggle--active", settings.animateSeed);
  refs.integralButton.classList.toggle(
    "path-trace-toggle--active",
    settings.showIntegralResult
  );
  refs.whiteCard.textContent =
    "左栏会随机把样本撒在整块区域里，所以最容易出现聚团和空洞；它的积分结果因此总是最像“颗粒化的偶然命中”。";
  refs.stratifiedCard.textContent =
    "中栏先把区域拆格再抖动，分布会立刻均匀很多，但格子的结构感仍然在，结果也会保留一点规则纹样。";
  refs.blueCard.textContent =
    "右栏用 best-candidate 近似 blue-noise 分布：它并不是完全平均，而是尽量避免样本彼此挤太近，所以聚团最少。";
  refs.observationCard.textContent =
    settings.showIntegralResult
      ? "盯住下半条软阴影带：上面点集一旦更均匀，下面的面积平均估计就会更稳定，不必先靠大样本数才看起来“像回事”。"
      : "现在只看上半的点集分布。打开 `show integral result` 以后，你会更直观看到“分布本身”怎样决定积分颗粒和条纹。";
  refs.legend.textContent =
    "这节课先讲清楚一个更早的前提：很多随机渲染问题不是“样本太少”，而是“样本分布方式决定了你会看到什么噪声”。";
}

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

function lineHitsCircle(receiverX: number, lightX: number): boolean {
  const startX = receiverX;
  const startY = 0;
  const endX = lightX;
  const endY = 1.3;
  const circleX = 0;
  const circleY = 0.62;
  const radius = 0.29;
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const projection =
    ((circleX - startX) * segmentX + (circleY - startY) * segmentY) /
    Math.max(segmentX * segmentX + segmentY * segmentY, 1e-6);
  const t = Math.min(Math.max(projection, 0), 1);
  const closestX = startX + segmentX * t;
  const closestY = startY + segmentY * t;
  const dx = closestX - circleX;
  const dy = closestY - circleY;
  return dx * dx + dy * dy < radius * radius;
}

function computeShadowStrip(points: SamplePoint[], columns: number): Float32Array {
  const output = new Float32Array(columns);
  for (let column = 0; column < columns; column += 1) {
    const x = -1.2 + (column / Math.max(columns - 1, 1)) * 2.4;
    let visibleCount = 0;
    for (const point of points) {
      const lightX = -0.95 + point.x * 1.9;
      if (!lineHitsCircle(x, lightX)) {
        visibleCount += 1;
      }
    }
    output[column] = visibleCount / Math.max(points.length, 1);
  }
  return output;
}

function drawStrip(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  strip: Float32Array,
  color: string
): void {
  context.save();
  context.fillStyle = "rgba(11, 20, 32, 0.94)";
  context.fillRect(x, y, width, height);
  for (let index = 0; index < strip.length; index += 1) {
    const value = strip[index];
    const barX = x + (index / strip.length) * width;
    const barWidth = Math.ceil(width / strip.length) + 1;
    context.fillStyle = `rgba(255, 245, 230, ${0.12 + value * 0.82})`;
    context.fillRect(barX, y, barWidth, height);
    context.fillStyle = color;
    context.globalAlpha = 0.08 + value * 0.12;
    context.fillRect(barX, y + (1 - value) * height, barWidth, value * height);
    context.globalAlpha = 1;
  }
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
  context.restore();
}

function drawPatternPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  pattern: PatternSet,
  settings: BlueNoiseSettings
): void {
  const innerX = x + 18;
  const innerY = y + 48;
  const plotWidth = width - 36;
  const plotHeight = Math.round(height * 0.5) - 58;
  const resultY = innerY + plotHeight + 24;
  const resultHeight = Math.max(46, height - (resultY - y) - 18);

  context.fillStyle = "rgba(7, 16, 28, 0.94)";
  context.fillRect(x, y, width, height);
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

  context.fillStyle = "#ffffff";
  context.font = "600 14px 'Georgia', 'Times New Roman', serif";
  context.fillText(pattern.label, x + 18, y + 24);
  context.fillStyle = "rgba(205, 219, 242, 0.75)";
  context.font = "12px sans-serif";
  context.fillText(pattern.subtitle, x + 18, y + 42);

  context.fillStyle = "rgba(11, 20, 32, 0.94)";
  context.fillRect(innerX, innerY, plotWidth, plotHeight);
  context.strokeStyle = "rgba(255,255,255,0.08)";
  context.strokeRect(innerX + 0.5, innerY + 0.5, plotWidth - 1, plotHeight - 1);

  context.fillStyle = pattern.color;
  for (const point of pattern.points) {
    const px = innerX + point.x * plotWidth;
    const py = innerY + point.y * plotHeight;
    context.beginPath();
    context.arc(px, py, settings.pointSize, 0, Math.PI * 2);
    context.fill();
  }

  if (settings.showIntegralResult) {
    const strip = computeShadowStrip(pattern.points, 58);
    drawStrip(context, innerX, resultY, plotWidth, resultHeight, strip, pattern.color);
    context.fillStyle = "rgba(205, 219, 242, 0.75)";
    context.font = "11px sans-serif";
    context.fillText("same sample set drives a 1D soft-shadow estimate", innerX, resultY - 8);
  } else {
    context.fillStyle = "rgba(255,255,255,0.04)";
    context.fillRect(innerX, resultY, plotWidth, resultHeight);
    context.strokeStyle = "rgba(255,255,255,0.06)";
    context.strokeRect(innerX + 0.5, resultY + 0.5, plotWidth - 1, resultHeight - 1);
    context.fillStyle = "rgba(205, 219, 242, 0.65)";
    context.font = "12px sans-serif";
    context.fillText("integral result hidden", innerX + 12, resultY + resultHeight * 0.5);
  }
}

export async function mountBlueNoiseAndSamplingPatternsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
): Promise<() => void> {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--blue-noise">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">same sample budget, different distributions</span>
          <span class="path-trace-badge path-trace-badge--warm">top: pattern</span>
          <span class="path-trace-badge path-trace-badge--cool">bottom: same samples drive an area estimate</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Sample Count</span>
            <strong id="blue-noise-sample-value"></strong>
            <input id="blue-noise-sample-range" type="range" min="16" max="196" step="4" />
          </label>
          <label class="path-trace-control">
            <span>Point Size</span>
            <strong id="blue-noise-point-value"></strong>
            <input id="blue-noise-point-range" type="range" min="2" max="7" step="0.5" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Seed</span>
            <strong>Animate Seed</strong>
            <div class="path-trace-toggle-row">
              <button id="blue-noise-animate-button" class="path-trace-toggle" type="button">animate</button>
            </div>
          </div>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Result</span>
            <strong>Show Integral Result</strong>
            <div class="path-trace-toggle-row">
              <button id="blue-noise-integral-button" class="path-trace-toggle" type="button">show strip</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--three">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>White Noise</strong>
            <span>完全独立随机，最容易聚团，也最容易留下大块空洞。</span>
          </article>
          <article class="path-trace-label">
            <span class="eyebrow">中栏</span>
            <strong>Stratified Jitter</strong>
            <span>先铺格子再抖动，均匀性立刻提升，但仍带一点格状结构。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Blue-noise-like</strong>
            <span>尽量避免样本挤太近，所以最少出现局部扎堆。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card">
            <span class="eyebrow">White Noise</span>
            <strong id="blue-noise-white-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">Stratified</span>
            <strong id="blue-noise-stratified-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">Blue Noise</span>
            <strong id="blue-noise-blue-card"></strong>
          </article>
          <article class="path-trace-card">
            <span class="eyebrow">观察</span>
            <strong id="blue-noise-observation-card"></strong>
          </article>
        </div>
        <article class="path-trace-legend">
          <strong>当前实验</strong>
          <span id="blue-noise-legend"></span>
        </article>
      </div>
    </section>
  `;

  const canvas = host.querySelector("canvas");
  const refs: BlueNoiseHudRefs = {
    sampleRange: host.querySelector("#blue-noise-sample-range") as HTMLInputElement,
    sampleValue: host.querySelector("#blue-noise-sample-value") as HTMLElement,
    pointRange: host.querySelector("#blue-noise-point-range") as HTMLInputElement,
    pointValue: host.querySelector("#blue-noise-point-value") as HTMLElement,
    animateButton: host.querySelector("#blue-noise-animate-button") as HTMLButtonElement,
    integralButton: host.querySelector("#blue-noise-integral-button") as HTMLButtonElement,
    whiteCard: host.querySelector("#blue-noise-white-card") as HTMLElement,
    stratifiedCard: host.querySelector("#blue-noise-stratified-card") as HTMLElement,
    blueCard: host.querySelector("#blue-noise-blue-card") as HTMLElement,
    observationCard: host.querySelector("#blue-noise-observation-card") as HTMLElement,
    legend: host.querySelector("#blue-noise-legend") as HTMLElement,
  };

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error("lesson-75 缺少 canvas。");
  }

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("lesson-75 无法创建 2D context。");
  }

  const settings: BlueNoiseSettings = {
    sampleCount: 64,
    pointSize: 3.5,
    animateSeed: true,
    showIntegralResult: true,
  };

  refs.sampleRange.value = settings.sampleCount.toString();
  refs.pointRange.value = settings.pointSize.toString();
  updateHud(refs, settings);

  let destroyed = false;
  let frameHandle = 0;
  let seed = 1;
  let lastReseed = 0;
  let patterns: PatternSet[] = [];

  const regeneratePatterns = () => {
    patterns = [
      {
        label: "White Noise",
        subtitle: "independent random samples",
        points: generateWhiteNoisePoints(settings.sampleCount, seed * 17 + 3),
        color: PATTERN_COLORS.white,
      },
      {
        label: "Stratified Jitter",
        subtitle: "same count, but every cell contributes once",
        points: generateStratifiedJitterPoints(settings.sampleCount, seed * 17 + 11),
        color: PATTERN_COLORS.stratified,
      },
      {
        label: "Blue-noise-like",
        subtitle: "best-candidate placement reduces local clustering",
        points: generateBlueNoiseLikePoints(settings.sampleCount, seed * 17 + 29),
        color: PATTERN_COLORS.blue,
      },
    ];
  };

  const sync = (forceSeedAdvance: boolean) => {
    if (forceSeedAdvance) {
      seed += 1;
    }
    updateHud(refs, settings);
    regeneratePatterns();
  };

  refs.sampleRange.addEventListener("input", () => {
    settings.sampleCount = Number(refs.sampleRange.value);
    sync(false);
  });
  refs.pointRange.addEventListener("input", () => {
    settings.pointSize = Number(refs.pointRange.value);
    updateHud(refs, settings);
  });
  refs.animateButton.addEventListener("click", () => {
    settings.animateSeed = !settings.animateSeed;
    updateHud(refs, settings);
  });
  refs.integralButton.addEventListener("click", () => {
    settings.showIntegralResult = !settings.showIntegralResult;
    updateHud(refs, settings);
  });

  sync(false);

  setStatus({
    title: "Blue Noise 与采样模式已运行",
    detail:
      "上半先比较点集分布，下半再用同样的样本去估软阴影条带，所以“采样方式本身”怎样影响积分稳定性会非常直观。",
    tone: "ok",
  });

  const renderFrame = (timestamp: number) => {
    if (destroyed) {
      return;
    }

    const { width, height, ratio } = resizeCanvas(canvas);
    if (settings.animateSeed && timestamp - lastReseed > 280) {
      seed += 1;
      regeneratePatterns();
      lastReseed = timestamp;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.scale(ratio, ratio);

    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    const panelGap = 16;
    const columnWidth = (cssWidth - panelGap * 2) / 3;

    for (let index = 0; index < patterns.length; index += 1) {
      drawPatternPanel(
        context,
        index * (columnWidth + panelGap),
        0,
        columnWidth,
        cssHeight,
        patterns[index],
        settings
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
