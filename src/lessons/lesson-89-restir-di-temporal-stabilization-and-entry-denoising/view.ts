import type {
  StabilizationHudRefs,
  StabilizationSettings,
} from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/types";

export type StabilizationView = {
  canvas: HTMLCanvasElement;
  refs: StabilizationHudRefs;
};

export function createStabilizationView(host: HTMLElement): StabilizationView {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--restir-stabilization">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">same ReSTIR DI input, different history policies</span>
          <span class="path-trace-badge path-trace-badge--warm">middle: naive accumulation</span>
          <span class="path-trace-badge path-trace-badge--cool">right: reprojected + clamped</span>
        </div>
        <div class="path-trace-controls">
          <div class="path-trace-control path-trace-control--toggle">
            <span>Motion Mode</span>
            <strong>Static / Pan</strong>
            <div class="path-trace-toggle-row">
              <button id="restir-stabilization-mode-button" class="path-trace-toggle" type="button">pan mode</button>
            </div>
          </div>
          <label class="path-trace-control">
            <span>History Blend</span>
            <strong id="restir-stabilization-blend-value"></strong>
            <input id="restir-stabilization-blend-range" type="range" min="0.2" max="0.96" step="0.04" />
          </label>
          <label class="path-trace-control">
            <span>Clamp Strength</span>
            <strong id="restir-stabilization-clamp-value"></strong>
            <input id="restir-stabilization-clamp-range" type="range" min="0.08" max="0.4" step="0.02" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Lights</span>
            <strong>Animation</strong>
            <div class="path-trace-toggle-row">
              <button id="restir-stabilization-light-button" class="path-trace-toggle" type="button">animate</button>
            </div>
          </div>
          <div class="path-trace-control path-trace-control--toggle">
            <span>History</span>
            <strong>Reset</strong>
            <div class="path-trace-toggle-row">
              <button id="restir-stabilization-reset-button" class="path-trace-toggle" type="button">reset</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--three">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Current ReSTIR DI</strong>
            <span>只看当前帧 reservoir 输出。</span>
          </article>
          <article class="path-trace-label">
            <span class="eyebrow">中栏</span>
            <strong>Naive Accumulation</strong>
            <span>不重投影，只在同一像素继续平均旧 history。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>Reprojected + Clamped</strong>
            <span>先把 history 带回来，再决定它还值不值得信。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="restir-stabilization-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Current</span><strong id="restir-stabilization-current-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Naive</span><strong id="restir-stabilization-naive-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">Stabilized</span><strong id="restir-stabilization-stabilized-card"></strong></article>
        </div>
        <article class="path-trace-card">
          <span class="eyebrow">观察</span>
          <strong id="restir-stabilization-observation-card"></strong>
        </article>
        <aside class="path-trace-legend">
          <strong>本课结论</strong>
          <span id="restir-stabilization-legend"></span>
        </aside>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#restir-stabilization-canvas");
  const modeButton = host.querySelector<HTMLButtonElement>("#restir-stabilization-mode-button");
  const blendRange = host.querySelector<HTMLInputElement>("#restir-stabilization-blend-range");
  const blendValue = host.querySelector<HTMLElement>("#restir-stabilization-blend-value");
  const clampRange = host.querySelector<HTMLInputElement>("#restir-stabilization-clamp-range");
  const clampValue = host.querySelector<HTMLElement>("#restir-stabilization-clamp-value");
  const lightButton = host.querySelector<HTMLButtonElement>("#restir-stabilization-light-button");
  const resetButton = host.querySelector<HTMLButtonElement>("#restir-stabilization-reset-button");
  const currentCard = host.querySelector<HTMLElement>("#restir-stabilization-current-card");
  const naiveCard = host.querySelector<HTMLElement>("#restir-stabilization-naive-card");
  const stabilizedCard = host.querySelector<HTMLElement>("#restir-stabilization-stabilized-card");
  const observationCard = host.querySelector<HTMLElement>("#restir-stabilization-observation-card");
  const legend = host.querySelector<HTMLElement>("#restir-stabilization-legend");

  if (
    !canvas ||
    !modeButton ||
    !blendRange ||
    !blendValue ||
    !clampRange ||
    !clampValue ||
    !lightButton ||
    !resetButton ||
    !currentCard ||
    !naiveCard ||
    !stabilizedCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("Lesson 89 failed to bind DOM nodes.");
  }

  return {
    canvas,
    refs: {
      modeButton,
      blendRange,
      blendValue,
      clampRange,
      clampValue,
      lightButton,
      resetButton,
      currentCard,
      naiveCard,
      stabilizedCard,
      observationCard,
      legend,
    },
  };
}

export function updateStabilizationHud(
  refs: StabilizationHudRefs,
  settings: StabilizationSettings,
  accumulatedFrames: number
): void {
  refs.modeButton.classList.toggle("path-trace-toggle--active", settings.motionMode === "pan");
  refs.modeButton.textContent = settings.motionMode === "pan" ? "pan mode" : "static mode";
  refs.blendValue.textContent = `${settings.historyBlend.toFixed(2)}x`;
  refs.clampValue.textContent = `${settings.clampStrength.toFixed(2)}x`;
  refs.lightButton.classList.toggle("path-trace-toggle--active", settings.lightAnimation);
  refs.currentCard.textContent =
    "左栏只看当前帧 ReSTIR DI current estimate，所以它仍然保留 1 spp many-lights 输入该有的 stochastic grain。";
  refs.naiveCard.textContent =
    accumulatedFrames > 1
      ? `中栏当前已经累计 ${accumulatedFrames} 帧；静止时会收敛，但一动起来，旧 history 仍然会黏在原像素附近。`
      : "中栏还处在 history 刚开始建立的阶段，所以你会先看到它从 current frame 往平均值收拢。";
  refs.stabilizedCard.textContent =
    "右栏先做 velocity-like reprojection，再做 neighborhood clamp，必要时才做很轻的 edge-aware clean-up。";
  refs.observationCard.textContent =
    settings.motionMode === "pan"
      ? "当前在相机平移模式下，中栏更容易拖出脏 history；右栏会把无效 history 更快拒掉。"
      : "静止模式下，中栏和右栏都会继续收敛，但右栏更容易压住错误高亮点和坏 history。";
  refs.legend.textContent =
    "ReSTIR DI 不是时域稳定化的终点。current-frame reservoir 再聪明，只要一旦进入实时显示链路，reprojection、history clamp 和轻量 clean-up 仍然是必需品。";
}
