import computeShaderSource from "@/lessons/lesson-59-prefix-sum-and-stream-compaction/compute.wgsl?raw";
import {
  createPrefixSumSeedData,
  type PrefixSumSeed,
} from "@/lessons/lesson-59-prefix-sum-and-stream-compaction/seed";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type PrefixSumSnapshot = {
  source: Uint32Array;
  scan: Uint32Array;
  compacted: Uint32Array;
  keptCount: number;
  removedCount: number;
  firstKeptIndex: number;
};

type PrefixSumMetrics = {
  itemCount: number;
  keptCount: number;
  removedCount: number;
  scanPassCount: number;
  workgroupCount: number;
  focusIndex: number;
  focusValue: number;
  focusFlag: number;
  focusScan: number;
  focusOutputIndex: number | null;
  threshold: number;
  phase: number;
  readbackLatencyMs: number;
};

type PrefixSumSampleRow = {
  index: number;
  value: number;
  keepFlag: number;
  inclusiveScan: number;
  exclusiveScan: number;
  compactIndex: number | null;
};

type PrefixSumHudRefs = {
  chartCanvas: HTMLCanvasElement;
  thresholdRange: HTMLInputElement;
  thresholdValue: HTMLElement;
  phaseRange: HTMLInputElement;
  phaseValue: HTMLElement;
  keptBadge: HTMLElement;
  focusBadge: HTMLElement;
  caption: HTMLElement;
  samples: HTMLElement;
  formula: HTMLElement;
  sourceCountValue: HTMLElement;
  keptCountValue: HTMLElement;
  removedCountValue: HTMLElement;
  scanPassValue: HTMLElement;
  dispatchValue: HTMLElement;
  focusValue: HTMLElement;
  latencyValue: HTMLElement;
  legend: HTMLElement;
};

type ChartPanelLayout = {
  titleY: number;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ChartLayout = {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  panels: [ChartPanelLayout, ChartPanelLayout, ChartPanelLayout];
};

const ITEM_COUNT = 128;
const READBACK_SOURCE_WORDS = ITEM_COUNT * 4;
const READBACK_SCAN_WORDS = ITEM_COUNT;
const READBACK_COMPACTED_WORDS = ITEM_COUNT * 4;

/**
 * 申请一台只负责 compute 的 GPUDevice。
 * @returns {Promise<GPUDevice>} 后续负责创建 buffer、pipeline 与提交 compute pass 的设备对象。
 */
async function requestComputeDevice(): Promise<GPUDevice> {
  if (!("gpu" in navigator)) {
    throw new Error("当前浏览器没有提供 WebGPU。");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("没有拿到可用的 GPUAdapter。");
  }

  return adapter.requestDevice();
}

/**
 * 把 itemCount 和 scan offset 打包成一份 uniform 数据。
 * @param {number} itemCount 当前参与 scan 的元素总数。
 * @param {number} offset 当前这轮 prefix sum 要读取的历史偏移。
 * @param {number} columns 当前 2D 视图每行展示的列数。
 * @returns {Uint32Array} 可以直接写进 uniform buffer 的 16 字节数据。
 */
function createScanStepUniformData(
  itemCount: number,
  offset: number,
  columns: number
): Uint32Array {
  return new Uint32Array([itemCount, offset, columns, 0]);
}

/**
 * 让 2D canvas 的像素尺寸和显示尺寸保持一致。
 * @param {HTMLCanvasElement} canvas 用来绘制三层数据视图的 2D 画布。
 * @returns {{ context: CanvasRenderingContext2D; width: number; height: number }} 绘图上下文与逻辑尺寸。
 */
function measureCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("没有拿到 2D canvas 上下文。");
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(canvas.clientWidth));
  const height = Math.max(1, Math.floor(canvas.clientHeight));
  const pixelWidth = Math.max(1, Math.floor(width * pixelRatio));
  const pixelHeight = Math.max(1, Math.floor(height * pixelRatio));

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { context, width, height };
}

/**
 * 根据当前画布尺寸计算三层面板的网格布局。
 * @param {number} width 当前 2D 画布的逻辑宽度。
 * @param {number} height 当前 2D 画布的逻辑高度。
 * @param {PrefixSumSeed} seed 当前 lesson 的源数据配置。
 * @returns {ChartLayout} 供绘图和鼠标命中测试共用的统一布局结果。
 */
function createChartLayout(
  width: number,
  height: number,
  seed: PrefixSumSeed
): ChartLayout {
  const columns = seed.columns;
  const rows = Math.ceil(seed.itemCount / columns);
  const outerPadding = 18;
  const panelGap = 18;
  const titleHeight = 24;
  const availableHeight =
    height - outerPadding * 2 - panelGap * 2 - titleHeight * 3;
  const panelHeight = Math.max(112, availableHeight / 3);
  const gridWidth = Math.max(240, width - outerPadding * 2);
  const gridHeight = Math.max(96, panelHeight);
  const cellWidth = gridWidth / columns;
  const cellHeight = gridHeight / rows;

  const panelTop = (panelIndex: number) =>
    outerPadding + panelIndex * (titleHeight + gridHeight + panelGap);

  return {
    columns,
    rows,
    cellWidth,
    cellHeight,
    panels: [
      {
        titleY: panelTop(0) + 16,
        title: "Source Flags",
        subtitle: "flag[i] = keep ? 1 : 0",
        x: outerPadding,
        y: panelTop(0) + titleHeight,
        width: gridWidth,
        height: gridHeight,
      },
      {
        titleY: panelTop(1) + 16,
        title: "Inclusive Scan",
        subtitle: "scan[i] = sum(flag[0..i])",
        x: outerPadding,
        y: panelTop(1) + titleHeight,
        width: gridWidth,
        height: gridHeight,
      },
      {
        titleY: panelTop(2) + 16,
        title: "Compacted Stream",
        subtitle: "out[scan[i] - 1] = item[i]",
        x: outerPadding,
        y: panelTop(2) + titleHeight,
        width: gridWidth,
        height: gridHeight,
      },
    ],
  };
}

/**
 * 读取源数组中某个元素的 value。
 * @param {Uint32Array} sourceSnapshot 最近一次读回的源数组快照。
 * @param {number} index 当前想读取的元素索引。
 * @returns {number} 对应元素的 value。
 */
function readSourceValue(sourceSnapshot: Uint32Array, index: number): number {
  return sourceSnapshot[index * 4] ?? 0;
}

/**
 * 读取源数组中某个元素的 keep flag。
 * @param {Uint32Array} sourceSnapshot 最近一次读回的源数组快照。
 * @param {number} index 当前想读取的元素索引。
 * @returns {number} 1 表示当前元素会进入 compacted stream，0 表示被丢弃。
 */
function readKeepFlag(sourceSnapshot: Uint32Array, index: number): number {
  return sourceSnapshot[index * 4 + 1] ?? 0;
}

/**
 * 读取 compacted 输出中某个位置对应的原始 source index。
 * @param {Uint32Array} compactedSnapshot 最近一次读回的压紧结果。
 * @param {number} compactIndex 当前 compacted stream 的位置。
 * @returns {number} 该位置来自源数组中的哪个元素。
 */
function readCompactedSourceIndex(
  compactedSnapshot: Uint32Array,
  compactIndex: number
): number {
  return compactedSnapshot[compactIndex * 4 + 2] ?? 0;
}

/**
 * 根据 value 和 source index 生成一组稳定的教学用颜色。
 * @param {number} value 当前元素的 value。
 * @param {number} sourceIndex 当前元素原始索引。
 * @param {number} alpha 当前颜色透明度。
 * @returns {string} 可直接赋给 canvas 填充样式的 hsla 字符串。
 */
function itemColor(value: number, sourceIndex: number, alpha = 1): string {
  const hue = 205 - value * 0.88 + (sourceIndex % 16) * 2.9;
  const lightness = 26 + value * 0.38;
  return `hsla(${hue.toFixed(1)}, 76%, ${lightness.toFixed(1)}%, ${alpha})`;
}

/**
 * 根据当前快照把围绕聚焦索引的几条样本行整理出来，方便放进侧栏说明。
 * @param {PrefixSumSnapshot} snapshot 最近一次 GPU 读回的完整快照。
 * @param {number} focusIndex 当前聚焦的源数组索引。
 * @returns {PrefixSumSampleRow[]} 适合渲染成右侧样本列表的行数组。
 */
function createSampleRows(
  snapshot: PrefixSumSnapshot,
  focusIndex: number
): PrefixSumSampleRow[] {
  const rows: PrefixSumSampleRow[] = [];

  for (let offset = -2; offset <= 2; offset += 1) {
    const index = Math.max(
      0,
      Math.min(snapshot.scan.length - 1, focusIndex + offset)
    );
    const value = readSourceValue(snapshot.source, index);
    const keepFlag = readKeepFlag(snapshot.source, index);
    const inclusiveScan = snapshot.scan[index] ?? 0;

    rows.push({
      index,
      value,
      keepFlag,
      inclusiveScan,
      exclusiveScan: Math.max(0, inclusiveScan - keepFlag),
      compactIndex: keepFlag === 1 ? inclusiveScan - 1 : null,
    });
  }

  return rows;
}

/**
 * 在 2D 画布上画出 source flags、prefix sum 和 compacted output 三层状态。
 * @param {HTMLCanvasElement} canvas 用来承载三层视图的 2D 画布。
 * @param {PrefixSumSnapshot} snapshot 最近一次 GPU 读回的完整快照。
 * @param {PrefixSumSeed} seed 当前 lesson 的种子配置。
 * @param {number} focusIndex 当前聚焦的源数组索引。
 * @returns {void} 只把当前快照画到画布上，不返回额外结果。
 */
function drawPrefixSumChart(
  canvas: HTMLCanvasElement,
  snapshot: PrefixSumSnapshot,
  seed: PrefixSumSeed,
  focusIndex: number
) {
  const { context, width, height } = measureCanvas(canvas);
  const layout = createChartLayout(width, height, seed);

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#091426";
  context.fillRect(0, 0, width, height);

  layout.panels.forEach((panel, panelIndex) => {
    context.fillStyle = "rgba(255,255,255,0.05)";
    context.fillRect(panel.x, panel.y, panel.width, panel.height);

    context.fillStyle = panelIndex === 0 ? "#9ee3ff" : panelIndex === 1 ? "#ffd29c" : "#8fe8c3";
    context.font = "600 13px Sora, Segoe UI, sans-serif";
    context.fillText(panel.title, panel.x, panel.titleY);

    context.fillStyle = "rgba(216, 236, 255, 0.68)";
    context.font = "11px Cascadia Code, monospace";
    context.fillText(panel.subtitle, panel.x + 118, panel.titleY);
  });

  for (let index = 0; index < seed.itemCount; index += 1) {
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const x = layout.panels[0].x + column * layout.cellWidth;
    const ySource = layout.panels[0].y + row * layout.cellHeight;
    const yScan = layout.panels[1].y + row * layout.cellHeight;
    const yCompacted = layout.panels[2].y + row * layout.cellHeight;
    const insetX = 2;
    const insetY = 2;
    const drawWidth = Math.max(6, layout.cellWidth - 4);
    const drawHeight = Math.max(6, layout.cellHeight - 4);
    const value = readSourceValue(snapshot.source, index);
    const flag = readKeepFlag(snapshot.source, index);
    const scanValue = snapshot.scan[index] ?? 0;
    const normalizedScan =
      snapshot.keptCount > 0 ? scanValue / snapshot.keptCount : 0;

    context.fillStyle =
      flag === 1
        ? itemColor(value, index, 0.95)
        : "rgba(48, 66, 92, 0.78)";
    context.fillRect(x + insetX, ySource + insetY, drawWidth, drawHeight);

    if (flag === 0) {
      context.strokeStyle = "rgba(255,255,255,0.08)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + insetX + 2, ySource + insetY + 2);
      context.lineTo(x + insetX + drawWidth - 2, ySource + insetY + drawHeight - 2);
      context.stroke();
    } else {
      context.fillStyle = "rgba(255, 227, 155, 0.9)";
      context.fillRect(
        x + insetX,
        ySource + insetY + drawHeight - 4,
        drawWidth,
        4
      );
    }

    context.fillStyle =
      scanValue === 0
        ? "rgba(33, 49, 71, 0.92)"
        : `hsla(${36 + normalizedScan * 104}, 74%, ${22 + normalizedScan * 44}%, 0.96)`;
    context.fillRect(x + insetX, yScan + insetY, drawWidth, drawHeight);

    if (layout.cellWidth >= 32 && layout.cellHeight >= 16) {
      context.fillStyle = scanValue === 0 ? "rgba(210,225,242,0.46)" : "#081321";
      context.font = "11px Cascadia Code, monospace";
      context.fillText(
        scanValue.toString(),
        x + insetX + 6,
        yScan + insetY + drawHeight * 0.66
      );
    }

    if (index < snapshot.keptCount) {
      const compactValue = snapshot.compacted[index * 4] ?? 0;
      const compactSourceIndex = readCompactedSourceIndex(snapshot.compacted, index);
      context.fillStyle = itemColor(compactValue, compactSourceIndex, 0.95);
      context.fillRect(
        x + insetX,
        yCompacted + insetY,
        drawWidth,
        drawHeight
      );

      if (layout.cellWidth >= 32 && layout.cellHeight >= 16) {
        context.fillStyle = "#081321";
        context.font = "11px Cascadia Code, monospace";
        context.fillText(
          compactValue.toString(),
          x + insetX + 6,
          yCompacted + insetY + drawHeight * 0.66
        );
      }
    } else {
      context.fillStyle = "rgba(17, 28, 45, 0.92)";
      context.fillRect(
        x + insetX,
        yCompacted + insetY,
        drawWidth,
        drawHeight
      );
    }
  }

  const focusColumn = focusIndex % layout.columns;
  const focusRow = Math.floor(focusIndex / layout.columns);
  const focusX = layout.panels[0].x + focusColumn * layout.cellWidth;
  const focusYOffset = focusRow * layout.cellHeight;
  const focusFlag = readKeepFlag(snapshot.source, focusIndex);
  const focusScan = snapshot.scan[focusIndex] ?? 0;

  [layout.panels[0], layout.panels[1]].forEach((panel) => {
    context.strokeStyle = "#ffe39b";
    context.lineWidth = 2;
    context.strokeRect(
      focusX + 1.5,
      panel.y + focusYOffset + 1.5,
      Math.max(4, layout.cellWidth - 3),
      Math.max(4, layout.cellHeight - 3)
    );
  });

  if (focusFlag === 1 && focusScan > 0) {
    const compactIndex = focusScan - 1;
    const compactColumn = compactIndex % layout.columns;
    const compactRow = Math.floor(compactIndex / layout.columns);
    const compactX = layout.panels[2].x + compactColumn * layout.cellWidth;
    const compactY = layout.panels[2].y + compactRow * layout.cellHeight;

    context.strokeStyle = "#8fe8c3";
    context.lineWidth = 2;
    context.strokeRect(
      compactX + 1.5,
      compactY + 1.5,
      Math.max(4, layout.cellWidth - 3),
      Math.max(4, layout.cellHeight - 3)
    );
  }

  context.fillStyle = "rgba(216, 236, 255, 0.72)";
  context.font = "11px Cascadia Code, monospace";
  context.fillText(
    `hover source #${focusIndex} -> flag ${focusFlag} -> scan ${focusScan}`,
    layout.panels[2].x,
    height - 8
  );
}

/**
 * 根据鼠标位置命中当前图表里的 source / scan / compacted 格子。
 * @param {HTMLCanvasElement} canvas 当前用来展示三层数据的 2D 画布。
 * @param {number} clientX 当前鼠标 X 坐标。
 * @param {number} clientY 当前鼠标 Y 坐标。
 * @param {PrefixSumSnapshot} snapshot 最近一次 GPU 读回的快照。
 * @param {PrefixSumSeed} seed 当前 lesson 的种子配置。
 * @returns {number | null} 命中的源数组索引；如果命中了 compacted panel，则会自动反查回原始 source index。
 */
function pickChartIndex(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  snapshot: PrefixSumSnapshot,
  seed: PrefixSumSeed
): number | null {
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  const layout = createChartLayout(canvas.clientWidth, canvas.clientHeight, seed);

  for (let panelIndex = 0; panelIndex < layout.panels.length; panelIndex += 1) {
    const panel = layout.panels[panelIndex];
    if (
      localX < panel.x ||
      localX > panel.x + panel.width ||
      localY < panel.y ||
      localY > panel.y + panel.height
    ) {
      continue;
    }

    const column = Math.floor((localX - panel.x) / layout.cellWidth);
    const row = Math.floor((localY - panel.y) / layout.cellHeight);
    const index = row * layout.columns + column;

    if (index < 0 || index >= seed.itemCount) {
      return null;
    }

    if (panelIndex === 2) {
      if (index >= snapshot.keptCount) {
        return null;
      }
      return readCompactedSourceIndex(snapshot.compacted, index);
    }

    return index;
  }

  return null;
}

/**
 * 把当前 metrics 和样本列表同步进 HUD。
 * @param {PrefixSumHudRefs} refs 第 59 课需要更新的 DOM 引用集合。
 * @param {PrefixSumMetrics} metrics 当前 prefix sum / compaction 的实时指标。
 * @param {PrefixSumSampleRow[]} sampleRows 围绕聚焦元素整理出来的样本行。
 * @returns {void} 只更新 DOM 内容，不返回额外结果。
 */
function updateHud(
  refs: PrefixSumHudRefs,
  metrics: PrefixSumMetrics,
  sampleRows: PrefixSumSampleRow[]
) {
  refs.thresholdValue.textContent = `>= ${metrics.threshold}`;
  refs.phaseValue.textContent = `${Math.round(metrics.phase * 100)}%`;
  refs.keptBadge.textContent = `kept ${metrics.keptCount} / ${metrics.itemCount}`;
  refs.focusBadge.textContent =
    metrics.focusOutputIndex === null
      ? `#${metrics.focusIndex} -> drop`
      : `#${metrics.focusIndex} -> out[${metrics.focusOutputIndex}]`;
  refs.caption.textContent =
    "从上到下分别是源 flag、inclusive scan 和压紧后的输出；悬停任意格子，就能直接看到它有没有进入 compacted stream。";
  refs.samples.innerHTML = sampleRows
    .map(
      (row) => `
        <div class="prefix-sum-sample">
          <span class="prefix-sum-sample__index">#${row.index}</span>
          <span>v ${row.value}</span>
          <span>flag ${row.keepFlag}</span>
          <span>scan ${row.inclusiveScan}</span>
          <strong>${row.compactIndex === null ? "drop" : `out[${row.compactIndex}]`}</strong>
        </div>
      `
    )
    .join("");

  if (metrics.focusFlag === 1 && metrics.focusOutputIndex !== null) {
    refs.formula.innerHTML = `
      <strong>当前聚焦元素</strong>
      <span>\`flag[${metrics.focusIndex}] = 1\`</span>
      <span>\`scan[${metrics.focusIndex}] = ${metrics.focusScan}\`</span>
      <span>\`out[${metrics.focusOutputIndex}] = item[${metrics.focusIndex}]\`</span>
    `;
  } else {
    refs.formula.innerHTML = `
      <strong>当前聚焦元素</strong>
      <span>\`flag[${metrics.focusIndex}] = 0\`</span>
      <span>\`scan[${metrics.focusIndex}] = ${metrics.focusScan}\`</span>
      <span>\`item[${metrics.focusIndex}]\` 不会进入 compacted stream</span>
    `;
  }

  refs.sourceCountValue.textContent = metrics.itemCount.toString();
  refs.keptCountValue.textContent = metrics.keptCount.toString();
  refs.removedCountValue.textContent = metrics.removedCount.toString();
  refs.scanPassValue.textContent = metrics.scanPassCount.toString();
  refs.dispatchValue.textContent = `${metrics.workgroupCount} groups`;
  refs.focusValue.textContent =
    metrics.focusOutputIndex === null
      ? `#${metrics.focusIndex} · drop`
      : `#${metrics.focusIndex} · out[${metrics.focusOutputIndex}]`;
  refs.latencyValue.textContent = `${metrics.readbackLatencyMs.toFixed(2)} ms`;
  refs.legend.innerHTML = `
    <strong>当前实验</strong>
    当前阈值下，${metrics.itemCount} 个源元素里有 ${metrics.keptCount} 个会被保留，剩下 ${metrics.removedCount} 个会被抛弃。
    prefix sum 先把每个元素“如果被保留，它应该去第几个位置”算出来；stream compaction 再把这些保留项压到左边连续区域。
  `;
}

/**
 * 挂载第 59 课“Compute：Prefix Sum 与 Stream Compaction”预览。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 状态同步到工作台。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听与 GPU 资源。
 */
export async function mountPrefixSumAndStreamCompactionLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--prefix-sum">
      <div class="prefix-sum-stage">
        <div class="prefix-sum-badges">
          <span class="prefix-sum-badge">flag -> scan -> compact</span>
          <span class="prefix-sum-badge">compute 工具课 · 不先讲视觉特效</span>
          <span class="prefix-sum-badge">GPU 写结果，CPU 只做 readback 可视化</span>
        </div>

        <div class="prefix-sum-controls">
          <label class="prefix-sum-control">
            <span>保留阈值</span>
            <input type="range" min="20" max="88" value="56" data-threshold-range />
            <strong data-threshold-value>>= 56</strong>
          </label>
          <label class="prefix-sum-control">
            <span>图案 phase</span>
            <input type="range" min="0" max="100" value="18" data-phase-range />
            <strong data-phase-value>18%</strong>
          </label>
        </div>

        <div class="prefix-sum-layout">
          <section class="prefix-sum-panel prefix-sum-panel--chart">
            <div class="prefix-sum-panel__header">
              <div>
                <p class="eyebrow">Compute Data Flow</p>
                <h3>Prefix Sum 与压紧结果</h3>
              </div>
              <span class="prefix-sum-chip" data-kept-badge>kept 0 / 0</span>
            </div>
            <canvas class="prefix-sum-chart" data-chart-canvas aria-label="Prefix sum and stream compaction chart"></canvas>
            <p class="prefix-sum-caption" data-caption></p>
          </section>

          <section class="prefix-sum-panel prefix-sum-panel--side">
            <div class="prefix-sum-panel__header">
              <div>
                <p class="eyebrow">Focus Route</p>
                <h3>聚焦样本</h3>
              </div>
              <span class="prefix-sum-chip prefix-sum-chip--warm" data-focus-badge>#0 -> drop</span>
            </div>
            <div class="prefix-sum-samples" data-samples></div>
            <div class="prefix-sum-formula" data-formula></div>
          </section>
        </div>

        <div class="prefix-sum-card-grid">
          <article class="prefix-sum-card">
            <p>源元素</p>
            <strong data-source-count>0</strong>
          </article>
          <article class="prefix-sum-card">
            <p>保留数量</p>
            <strong data-kept-count>0</strong>
          </article>
          <article class="prefix-sum-card">
            <p>去掉数量</p>
            <strong data-removed-count>0</strong>
          </article>
          <article class="prefix-sum-card">
            <p>scan passes</p>
            <strong data-scan-passes>0</strong>
          </article>
          <article class="prefix-sum-card">
            <p>dispatch</p>
            <strong data-dispatch-count>0</strong>
          </article>
          <article class="prefix-sum-card">
            <p>聚焦去向</p>
            <strong data-focus-value>#0</strong>
          </article>
          <article class="prefix-sum-card">
            <p>最近读回</p>
            <strong data-latency-value>0 ms</strong>
          </article>
        </div>

        <div class="prefix-sum-legend" data-legend></div>
      </div>
    </div>
  `;

  const refs: PrefixSumHudRefs = {
    chartCanvas: host.querySelector<HTMLCanvasElement>("[data-chart-canvas]")!,
    thresholdRange: host.querySelector<HTMLInputElement>("[data-threshold-range]")!,
    thresholdValue: host.querySelector<HTMLElement>("[data-threshold-value]")!,
    phaseRange: host.querySelector<HTMLInputElement>("[data-phase-range]")!,
    phaseValue: host.querySelector<HTMLElement>("[data-phase-value]")!,
    keptBadge: host.querySelector<HTMLElement>("[data-kept-badge]")!,
    focusBadge: host.querySelector<HTMLElement>("[data-focus-badge]")!,
    caption: host.querySelector<HTMLElement>("[data-caption]")!,
    samples: host.querySelector<HTMLElement>("[data-samples]")!,
    formula: host.querySelector<HTMLElement>("[data-formula]")!,
    sourceCountValue: host.querySelector<HTMLElement>("[data-source-count]")!,
    keptCountValue: host.querySelector<HTMLElement>("[data-kept-count]")!,
    removedCountValue: host.querySelector<HTMLElement>("[data-removed-count]")!,
    scanPassValue: host.querySelector<HTMLElement>("[data-scan-passes]")!,
    dispatchValue: host.querySelector<HTMLElement>("[data-dispatch-count]")!,
    focusValue: host.querySelector<HTMLElement>("[data-focus-value]")!,
    latencyValue: host.querySelector<HTMLElement>("[data-latency-value]")!,
    legend: host.querySelector<HTMLElement>("[data-legend]")!,
  };

  if (Object.values(refs).some((value) => !value)) {
    throw new Error("lesson 59 的预览 DOM 没有创建完整。");
  }

  try {
    const device = await requestComputeDevice();
    const itemByteLength = ITEM_COUNT * 4 * Uint32Array.BYTES_PER_ELEMENT;
    const scanByteLength = ITEM_COUNT * Uint32Array.BYTES_PER_ELEMENT;
    const readbackByteLength = itemByteLength + scanByteLength + itemByteLength;

    const itemBuffer = device.createBuffer({
      size: itemByteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    const scanBuffers = [
      device.createBuffer({
        size: scanByteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }),
      device.createBuffer({
        size: scanByteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      }),
    ];
    const compactedBuffer = device.createBuffer({
      size: itemByteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    const readbackBuffer = device.createBuffer({
      size: readbackByteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    const shaderModule = device.createShaderModule({ code: computeShaderSource });
    const seedPipeline = device.createComputePipeline({
      label: "lesson-59-seed-flags-pipeline",
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "csSeedFlags",
      },
    });
    const scanPipeline = device.createComputePipeline({
      label: "lesson-59-prefix-sum-pipeline",
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "csPrefixSumStep",
      },
    });
    const compactPipeline = device.createComputePipeline({
      label: "lesson-59-stream-compaction-pipeline",
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "csCompact",
      },
    });

    const initialSeed = createPrefixSumSeedData(
      ITEM_COUNT,
      Number(refs.thresholdRange.value),
      Number(refs.phaseRange.value) / 100
    );

    const seedUniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const compactUniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(
      seedUniformBuffer,
      0,
      createScanStepUniformData(initialSeed.itemCount, 0, initialSeed.columns)
    );
    device.queue.writeBuffer(
      compactUniformBuffer,
      0,
      createScanStepUniformData(initialSeed.itemCount, 0, initialSeed.columns)
    );

    const seedBindGroup = device.createBindGroup({
      layout: seedPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: seedUniformBuffer } },
        { binding: 1, resource: { buffer: itemBuffer } },
        { binding: 2, resource: { buffer: scanBuffers[0] } },
      ],
    });

    const scanSteps = initialSeed.scanOffsets.map((offset) => {
      const uniformBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(
        uniformBuffer,
        0,
        createScanStepUniformData(initialSeed.itemCount, offset, initialSeed.columns)
      );

      return {
        offset,
        uniformBuffer,
        bindGroups: [
          device.createBindGroup({
            layout: scanPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: uniformBuffer } },
              { binding: 1, resource: { buffer: scanBuffers[0] } },
              { binding: 2, resource: { buffer: scanBuffers[1] } },
            ],
          }),
          device.createBindGroup({
            layout: scanPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: uniformBuffer } },
              { binding: 1, resource: { buffer: scanBuffers[1] } },
              { binding: 2, resource: { buffer: scanBuffers[0] } },
            ],
          }),
        ] as [GPUBindGroup, GPUBindGroup],
      };
    });

    const compactBindGroups = [
      device.createBindGroup({
        layout: compactPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: compactUniformBuffer } },
          { binding: 1, resource: { buffer: itemBuffer } },
          { binding: 2, resource: { buffer: scanBuffers[0] } },
          { binding: 3, resource: { buffer: compactedBuffer } },
        ],
      }),
      device.createBindGroup({
        layout: compactPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: compactUniformBuffer } },
          { binding: 1, resource: { buffer: itemBuffer } },
          { binding: 2, resource: { buffer: scanBuffers[1] } },
          { binding: 3, resource: { buffer: compactedBuffer } },
        ],
      }),
    ] as const;

    const zeroCompactedData = new Uint32Array(ITEM_COUNT * 4);
    const metrics: PrefixSumMetrics = {
      itemCount: initialSeed.itemCount,
      keptCount: 0,
      removedCount: initialSeed.itemCount,
      scanPassCount: initialSeed.scanPassCount,
      workgroupCount: initialSeed.workgroupCount,
      focusIndex: 0,
      focusValue: 0,
      focusFlag: 0,
      focusScan: 0,
      focusOutputIndex: null,
      threshold: initialSeed.threshold,
      phase: initialSeed.phase,
      readbackLatencyMs: 0,
    };

    let currentSeed = initialSeed;
    let currentSnapshot: PrefixSumSnapshot = {
      source: new Uint32Array(READBACK_SOURCE_WORDS),
      scan: new Uint32Array(READBACK_SCAN_WORDS),
      compacted: new Uint32Array(READBACK_COMPACTED_WORDS),
      keptCount: 0,
      removedCount: initialSeed.itemCount,
      firstKeptIndex: 0,
    };
    let focusIndex = 0;
    let pendingReadback = false;
    let queuedSeed: PrefixSumSeed | null = null;
    let disposed = false;

    const renderHud = () => {
      const focusValue = readSourceValue(currentSnapshot.source, focusIndex);
      const focusFlag = readKeepFlag(currentSnapshot.source, focusIndex);
      const focusScan = currentSnapshot.scan[focusIndex] ?? 0;
      const focusOutputIndex = focusFlag === 1 ? focusScan - 1 : null;
      const sampleRows = createSampleRows(currentSnapshot, focusIndex);

      metrics.itemCount = currentSeed.itemCount;
      metrics.keptCount = currentSnapshot.keptCount;
      metrics.removedCount = currentSnapshot.removedCount;
      metrics.scanPassCount = currentSeed.scanPassCount;
      metrics.workgroupCount = currentSeed.workgroupCount;
      metrics.focusIndex = focusIndex;
      metrics.focusValue = focusValue;
      metrics.focusFlag = focusFlag;
      metrics.focusScan = focusScan;
      metrics.focusOutputIndex = focusOutputIndex;
      metrics.threshold = currentSeed.threshold;
      metrics.phase = currentSeed.phase;

      drawPrefixSumChart(refs.chartCanvas, currentSnapshot, currentSeed, focusIndex);
      updateHud(refs, metrics, sampleRows);
    };

    const runGpuPipeline = (seed: PrefixSumSeed) => {
      pendingReadback = true;
      currentSeed = seed;
      metrics.threshold = seed.threshold;
      metrics.phase = seed.phase;

      device.queue.writeBuffer(itemBuffer, 0, seed.itemData);
      device.queue.writeBuffer(compactedBuffer, 0, zeroCompactedData);

      const commandEncoder = device.createCommandEncoder({
        label: "lesson-59-command-encoder",
      });

      const seedPass = commandEncoder.beginComputePass({
        label: "lesson-59-seed-flags-pass",
      });
      seedPass.setPipeline(seedPipeline);
      seedPass.setBindGroup(0, seedBindGroup);
      seedPass.dispatchWorkgroups(seed.workgroupCount);
      seedPass.end();

      let currentScanBufferIndex = 0;
      for (const step of scanSteps) {
        const scanPass = commandEncoder.beginComputePass({
          label: `lesson-59-prefix-sum-offset-${step.offset}`,
        });
        scanPass.setPipeline(scanPipeline);
        scanPass.setBindGroup(0, step.bindGroups[currentScanBufferIndex]);
        scanPass.dispatchWorkgroups(seed.workgroupCount);
        scanPass.end();
        currentScanBufferIndex = 1 - currentScanBufferIndex;
      }

      const compactPass = commandEncoder.beginComputePass({
        label: "lesson-59-stream-compaction-pass",
      });
      compactPass.setPipeline(compactPipeline);
      compactPass.setBindGroup(0, compactBindGroups[currentScanBufferIndex]);
      compactPass.dispatchWorkgroups(seed.workgroupCount);
      compactPass.end();

      commandEncoder.copyBufferToBuffer(
        itemBuffer,
        0,
        readbackBuffer,
        0,
        itemByteLength
      );
      commandEncoder.copyBufferToBuffer(
        scanBuffers[currentScanBufferIndex],
        0,
        readbackBuffer,
        itemByteLength,
        scanByteLength
      );
      commandEncoder.copyBufferToBuffer(
        compactedBuffer,
        0,
        readbackBuffer,
        itemByteLength + scanByteLength,
        itemByteLength
      );

      const startedAt = performance.now();
      device.queue.submit([commandEncoder.finish()]);

      readbackBuffer
        .mapAsync(GPUMapMode.READ)
        .then(() => {
          if (disposed) {
            if (readbackBuffer.mapState === "mapped") {
              readbackBuffer.unmap();
            }
            return;
          }

          const copied = new Uint32Array(readbackBuffer.getMappedRange().slice(0));
          readbackBuffer.unmap();

          const source = copied.slice(0, READBACK_SOURCE_WORDS);
          const scan = copied.slice(
            READBACK_SOURCE_WORDS,
            READBACK_SOURCE_WORDS + READBACK_SCAN_WORDS
          );
          const compacted = copied.slice(
            READBACK_SOURCE_WORDS + READBACK_SCAN_WORDS,
            READBACK_SOURCE_WORDS + READBACK_SCAN_WORDS + READBACK_COMPACTED_WORDS
          );
          const keptCount = scan[seed.itemCount - 1] ?? 0;

          let firstKeptIndex = 0;
          for (let index = 0; index < seed.itemCount; index += 1) {
            if (readKeepFlag(source, index) === 1) {
              firstKeptIndex = index;
              break;
            }
          }

          currentSnapshot = {
            source,
            scan,
            compacted,
            keptCount,
            removedCount: seed.itemCount - keptCount,
            firstKeptIndex,
          };
          focusIndex =
            readKeepFlag(source, focusIndex) === 1 || keptCount === 0
              ? focusIndex
              : firstKeptIndex;
          metrics.readbackLatencyMs = performance.now() - startedAt;
          renderHud();
        })
        .catch(() => {
          if (readbackBuffer.mapState === "mapped") {
            readbackBuffer.unmap();
          }
        })
        .finally(() => {
          pendingReadback = false;
          if (queuedSeed && !disposed) {
            const nextSeed = queuedSeed;
            queuedSeed = null;
            runGpuPipeline(nextSeed);
          }
        });
    };

    const createSeedFromControls = () =>
      createPrefixSumSeedData(
        ITEM_COUNT,
        Number(refs.thresholdRange.value),
        Number(refs.phaseRange.value) / 100
      );

    const scheduleSeedUpdate = () => {
      const nextSeed = createSeedFromControls();
      refs.thresholdValue.textContent = `>= ${nextSeed.threshold}`;
      refs.phaseValue.textContent = `${Math.round(nextSeed.phase * 100)}%`;

      if (pendingReadback) {
        queuedSeed = nextSeed;
        return;
      }

      runGpuPipeline(nextSeed);
    };

    const handleThresholdInput = () => {
      scheduleSeedUpdate();
    };

    const handlePhaseInput = () => {
      scheduleSeedUpdate();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const nextIndex = pickChartIndex(
        refs.chartCanvas,
        event.clientX,
        event.clientY,
        currentSnapshot,
        currentSeed
      );
      if (nextIndex === null || nextIndex === focusIndex) {
        return;
      }

      focusIndex = nextIndex;
      renderHud();
    };

    const handlePointerLeave = () => {
      focusIndex =
        currentSnapshot.keptCount > 0 ? currentSnapshot.firstKeptIndex : 0;
      renderHud();
    };

    refs.thresholdRange.addEventListener("input", handleThresholdInput);
    refs.phaseRange.addEventListener("input", handlePhaseInput);
    refs.chartCanvas.addEventListener("pointermove", handlePointerMove);
    refs.chartCanvas.addEventListener("pointerleave", handlePointerLeave);

    const resizeObserver = new ResizeObserver(() => {
      renderHud();
    });
    resizeObserver.observe(host);

    setStatus({
      title: "Prefix Sum 与 Stream Compaction 已运行",
      detail:
        "拖动阈值和 phase，可以直接看到 flag -> inclusive scan -> compacted output 这条 GPU 数据链怎么联动变化。",
      tone: "ok",
    });

    scheduleSeedUpdate();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      refs.thresholdRange.removeEventListener("input", handleThresholdInput);
      refs.phaseRange.removeEventListener("input", handlePhaseInput);
      refs.chartCanvas.removeEventListener("pointermove", handlePointerMove);
      refs.chartCanvas.removeEventListener("pointerleave", handlePointerLeave);

      if (readbackBuffer.mapState === "mapped") {
        readbackBuffer.unmap();
      }

      seedUniformBuffer.destroy();
      compactUniformBuffer.destroy();
      scanSteps.forEach((step) => {
        step.uniformBuffer.destroy();
      });
      itemBuffer.destroy();
      scanBuffers.forEach((buffer) => buffer.destroy());
      compactedBuffer.destroy();
      readbackBuffer.destroy();
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知的 WebGPU 错误。";

    host.innerHTML = `
      <div class="preview-empty">
        <h3>预览不可用</h3>
        <p>${message}</p>
      </div>
    `;

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
