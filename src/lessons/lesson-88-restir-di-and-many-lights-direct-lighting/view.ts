import type { RestirHudRefs, RestirSettings } from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/types";

export type RestirDiView = {
  canvas: HTMLCanvasElement;
  refs: RestirHudRefs;
};

export function createRestirDiView(host: HTMLElement): RestirDiView {
  host.innerHTML = `
    <section class="preview-viewport preview-viewport--restir-di">
      <div class="path-trace-stage">
        <div class="path-trace-badges">
          <span class="path-trace-badge">many tiny lights, same room, same budget</span>
          <span class="path-trace-badge path-trace-badge--warm">left: naive 1-sample direct lighting</span>
          <span class="path-trace-badge path-trace-badge--cool">right: ReSTIR DI</span>
        </div>
        <div class="path-trace-controls">
          <label class="path-trace-control">
            <span>Light Count</span>
            <strong id="restir-di-light-value"></strong>
            <input id="restir-di-light-range" type="range" min="16" max="96" step="8" />
          </label>
          <label class="path-trace-control">
            <span>Candidates / Pixel</span>
            <strong id="restir-di-candidate-value"></strong>
            <input id="restir-di-candidate-range" type="range" min="2" max="12" step="1" />
          </label>
          <label class="path-trace-control">
            <span>Spatial Reuse Radius</span>
            <strong id="restir-di-radius-value"></strong>
            <input id="restir-di-radius-range" type="range" min="1" max="4" step="0.5" />
          </label>
          <div class="path-trace-control path-trace-control--toggle">
            <span>Camera</span>
            <strong>Freeze Camera</strong>
            <div class="path-trace-toggle-row">
              <button id="restir-di-freeze-button" class="path-trace-toggle" type="button">freeze</button>
            </div>
          </div>
        </div>
        <div class="path-trace-labels path-trace-labels--two">
          <article class="path-trace-label">
            <span class="eyebrow">左栏</span>
            <strong>Naive 1-sample Direct Lighting</strong>
            <span>每像素只碰 1 次灯，完全靠运气。</span>
          </article>
          <article class="path-trace-label path-trace-label--cool">
            <span class="eyebrow">右栏</span>
            <strong>ReSTIR DI</strong>
            <span>current candidates → temporal reuse → spatial reuse → final estimate。</span>
          </article>
        </div>
        <div class="path-trace-frame path-trace-frame--wide">
          <canvas id="restir-di-canvas" class="path-trace-canvas"></canvas>
        </div>
        <div class="path-trace-card-grid">
          <article class="path-trace-card"><span class="eyebrow">Naive</span><strong id="restir-di-naive-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">ReSTIR</span><strong id="restir-di-restir-card"></strong></article>
          <article class="path-trace-card"><span class="eyebrow">GPU Notes</span><strong id="restir-di-stats-card"></strong></article>
        </div>
        <article class="path-trace-card">
          <span class="eyebrow">观察</span>
          <strong id="restir-di-observation-card"></strong>
        </article>
        <aside class="path-trace-legend">
          <strong>本课结论</strong>
          <span id="restir-di-legend"></span>
        </aside>
      </div>
    </section>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("#restir-di-canvas");
  const lightRange = host.querySelector<HTMLInputElement>("#restir-di-light-range");
  const lightValue = host.querySelector<HTMLElement>("#restir-di-light-value");
  const candidateRange = host.querySelector<HTMLInputElement>("#restir-di-candidate-range");
  const candidateValue = host.querySelector<HTMLElement>("#restir-di-candidate-value");
  const radiusRange = host.querySelector<HTMLInputElement>("#restir-di-radius-range");
  const radiusValue = host.querySelector<HTMLElement>("#restir-di-radius-value");
  const freezeButton = host.querySelector<HTMLButtonElement>("#restir-di-freeze-button");
  const naiveCard = host.querySelector<HTMLElement>("#restir-di-naive-card");
  const restirCard = host.querySelector<HTMLElement>("#restir-di-restir-card");
  const statsCard = host.querySelector<HTMLElement>("#restir-di-stats-card");
  const observationCard = host.querySelector<HTMLElement>("#restir-di-observation-card");
  const legend = host.querySelector<HTMLElement>("#restir-di-legend");

  if (
    !canvas ||
    !lightRange ||
    !lightValue ||
    !candidateRange ||
    !candidateValue ||
    !radiusRange ||
    !radiusValue ||
    !freezeButton ||
    !naiveCard ||
    !restirCard ||
    !statsCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("Lesson 88 failed to bind DOM nodes.");
  }

  return {
    canvas,
    refs: {
      lightRange,
      lightValue,
      candidateRange,
      candidateValue,
      radiusRange,
      radiusValue,
      freezeButton,
      naiveCard,
      restirCard,
      statsCard,
      observationCard,
      legend,
    },
  };
}

export function updateRestirDiHud(refs: RestirHudRefs, settings: RestirSettings): void {
  refs.lightValue.textContent = `${settings.lightCount} lights`;
  refs.candidateValue.textContent = `${settings.candidatesPerPixel} cand / px`;
  refs.radiusValue.textContent = `${settings.spatialReuseRadius.toFixed(1)} px`;
  refs.freezeButton.classList.toggle("path-trace-toggle--active", settings.freezeCamera);
  refs.naiveCard.textContent =
    "左栏现在是真正的 GPU current-frame direct-lighting 估计：每像素只采 1 盏灯，所以 many-lights 一多就会很快退化。";
  refs.restirCard.textContent =
    "右栏 current candidates、temporal reuse 和 spatial reuse 都已经迁进 compute pass：重用的是样本，不是把整块结果直接抹平均。";
  refs.statsCard.textContent =
    "这版重点看结构和亮斑：右栏应该更稳，但仍保留 direct-lighting 估计该有的 stochastic grain，而不是一整块发白。";
  refs.observationCard.textContent = settings.freezeCamera
    ? "冻结相机以后，右栏会更稳定地保住 many-lights 下的高贡献小亮斑。"
    : "相机轻微平移时，右栏会通过 temporal + spatial reuse 保住更多结构，而左栏仍然主要靠运气。";
  refs.legend.textContent =
    "这节课现在的重点是“真正用 WebGPU 做出教学版 ReSTIR DI”：compute 负责生成 current candidates、temporal reuse 和 spatial reuse，present pass 只负责把低分辨率结果稳定展示出来。";
}
