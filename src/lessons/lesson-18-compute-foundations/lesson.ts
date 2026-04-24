import computeShaderSource from "@/lessons/lesson-18-compute-foundations/compute.wgsl?raw";
import {
  createComputeFoundationsSeedData,
  type ComputeFoundationsSeed,
} from "@/lessons/lesson-18-compute-foundations/seed";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type ComputeFoundationsMetrics = {
  elementCount: number;
  workgroupSize: number;
  workgroupCount: number;
  focusIndex: number;
  focusValue: number;
  readbackLatencyMs: number;
  snapshotAgeMs: number;
  pulseStrength: number;
  sweepSpeed: number;
};

type ComputeFoundationsSampleRow = {
  index: number;
  workgroup: number;
  local: number;
  value: number;
};

type ComputeFoundationsHudRefs = {
  chartCanvas: HTMLCanvasElement;
  pulseRange: HTMLInputElement;
  pulseValue: HTMLElement;
  speedRange: HTMLInputElement;
  speedValue: HTMLElement;
  elementCountValue: HTMLElement;
  workgroupValue: HTMLElement;
  dispatchValue: HTMLElement;
  latencyValue: HTMLElement;
  focusValue: HTMLElement;
  readbackBadge: HTMLElement;
  focusBadge: HTMLElement;
  caption: HTMLElement;
  samples: HTMLElement;
  formula: HTMLElement;
  legend: HTMLElement;
};

const FLOATS_PER_CELL = 4;
const ELEMENT_COUNT = 96;
const READBACK_INTERVAL_MS = 140;

/**
 * 申请一台只用于 compute 的 GPUDevice。
 * @returns {Promise<GPUDevice>} 后续负责创建 buffer、pipeline 和提交 compute 命令的设备对象。
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
 * 把当前帧的控制参数打包成 uniform 数据。
 * @param {number} timeSeconds 当前演示已经运行的秒数。
 * @param {ComputeFoundationsSeed} seed 当前 storage buffer 的种子配置。
 * @param {number} focusIndex 当前聚焦的元素索引。
 * @param {number} pulseStrength 当前聚焦脉冲强度。
 * @returns {Float32Array} 依次写入 time、elementCount、focusIndex 与 pulseStrength 的 uniform 数组。
 */
function createComputeUniformData(
  timeSeconds: number,
  seed: ComputeFoundationsSeed,
  focusIndex: number,
  pulseStrength: number
): Float32Array {
  return new Float32Array([
    timeSeconds,
    seed.elementCount,
    focusIndex,
    pulseStrength,
  ]);
}

/**
 * 让 2D canvas 的像素尺寸和显示尺寸保持一致。
 * @param {HTMLCanvasElement} canvas 要绘制条带视图的 2D 画布。
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
 * 根据自动扫描状态或鼠标悬停位置得到当前聚焦的元素索引。
 * @param {number} elementCount 当前 storage buffer 内的元素数量。
 * @param {number | null} hoveredIndex 用户悬停的元素索引；如果为空，则进入自动扫描模式。
 * @param {number} timeMs 当前帧时间戳。
 * @param {number} sweepSpeed 自动扫描速度。
 * @returns {number} 当前应该被聚焦的元素索引。
 */
function resolveFocusIndex(
  elementCount: number,
  hoveredIndex: number | null,
  timeMs: number,
  sweepSpeed: number
): number {
  if (hoveredIndex !== null) {
    return Math.max(0, Math.min(elementCount - 1, hoveredIndex));
  }

  const cycle = ((timeMs * 0.000035 * sweepSpeed) % 1 + 1) % 1;
  return Math.max(0, Math.min(elementCount - 1, Math.floor(cycle * elementCount)));
}

/**
 * 从最近一次 readback 快照里读出某个元素当前的数值。
 * @param {Float32Array} snapshot 最近一次 CPU 侧缓存下来的 storage buffer 快照。
 * @param {number} index 当前想读取的元素索引。
 * @returns {number} 当前元素归一化到 0-1 之间的可视化值。
 */
function readCellValue(snapshot: Float32Array, index: number): number {
  const offset = index * FLOATS_PER_CELL + 2;
  return snapshot[offset] ?? 0;
}

/**
 * 生成围绕聚焦索引的几条线程样本，帮助展示 global / local / workgroup 的关系。
 * @param {Float32Array} snapshot 最近一次 readback 快照。
 * @param {number} focusIndex 当前聚焦元素索引。
 * @param {ComputeFoundationsSeed} seed 当前 compute 配置。
 * @returns {ComputeFoundationsSampleRow[]} 适合渲染成侧边样本列表的数据数组。
 */
function createSampleRows(
  snapshot: Float32Array,
  focusIndex: number,
  seed: ComputeFoundationsSeed
): ComputeFoundationsSampleRow[] {
  const rows: ComputeFoundationsSampleRow[] = [];

  for (let offset = -2; offset <= 2; offset += 1) {
    const index = Math.max(0, Math.min(seed.elementCount - 1, focusIndex + offset));
    rows.push({
      index,
      workgroup: Math.floor(index / seed.workgroupSize),
      local: index % seed.workgroupSize,
      value: readCellValue(snapshot, index),
    });
  }

  return rows;
}

/**
 * 把最近一次 storage buffer 快照画成一张带有 workgroup 分段的条带图。
 * @param {HTMLCanvasElement} canvas 用来显示 storage buffer 可视化结果的 2D 画布。
 * @param {Float32Array} snapshot 最近一次 readback 快照。
 * @param {ComputeFoundationsSeed} seed 当前 compute 配置。
 * @param {number} focusIndex 当前聚焦元素索引。
 * @returns {void} 只负责把当前快照画到 2D canvas，不返回额外结果。
 */
function drawStorageBufferView(
  canvas: HTMLCanvasElement,
  snapshot: Float32Array,
  seed: ComputeFoundationsSeed,
  focusIndex: number
) {
  const { context, width, height } = measureCanvas(canvas);
  const stripHeight = 36;
  const labelHeight = 24;
  const chartHeight = Math.max(80, height - stripHeight - labelHeight - 12);
  const cellWidth = width / seed.elementCount;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#091426";
  context.fillRect(0, 0, width, height);

  for (let workgroup = 0; workgroup < seed.workgroupCount; workgroup += 1) {
    const startIndex = workgroup * seed.workgroupSize;
    const startX = startIndex * cellWidth;
    const groupWidth = Math.min(seed.workgroupSize, seed.elementCount - startIndex) * cellWidth;
    const tint = workgroup % 2 === 0 ? "rgba(95, 200, 255, 0.07)" : "rgba(255, 159, 104, 0.07)";

    context.fillStyle = tint;
    context.fillRect(startX, labelHeight, groupWidth, chartHeight);
    context.fillStyle = "rgba(255,255,255,0.06)";
    context.fillRect(startX, labelHeight + chartHeight + 8, groupWidth, stripHeight - 8);
    context.fillStyle = "#7dcfff";
    context.font = "12px Cascadia Code, monospace";
    context.fillText(`wg ${workgroup}`, startX + 6, 16);
  }

  for (let index = 0; index < seed.elementCount; index += 1) {
    const value = readCellValue(snapshot, index);
    const workgroup = Math.floor(index / seed.workgroupSize);
    const local = index % seed.workgroupSize;
    const x = index * cellWidth;
    const barWidth = Math.max(1.5, cellWidth - 1.5);
    const barHeight = Math.max(8, value * (chartHeight - 18));
    const hue = 190 + (workgroup % 6) * 20;

    context.fillStyle = `hsla(${hue}, 82%, ${46 + value * 24}%, 0.92)`;
    context.fillRect(x + 0.75, labelHeight + chartHeight - barHeight, barWidth, barHeight);

    const localShade = 0.18 + (local / Math.max(1, seed.workgroupSize - 1)) * 0.5;
    context.fillStyle = `rgba(255,255,255,${localShade})`;
    context.fillRect(x + 0.75, labelHeight + chartHeight + 13, barWidth, 11);

    if (local === 0 && index > 0) {
      context.fillStyle = "rgba(255,255,255,0.08)";
      context.fillRect(x - 0.5, labelHeight + 2, 1.5, chartHeight + stripHeight + 8);
    }
  }

  const focusX = focusIndex * cellWidth;
  const focusGroup = Math.floor(focusIndex / seed.workgroupSize);
  const focusLocal = focusIndex % seed.workgroupSize;

  context.strokeStyle = "#ffe39b";
  context.lineWidth = 2;
  context.strokeRect(focusX + 0.5, labelHeight + 1, Math.max(4, cellWidth - 1), chartHeight + stripHeight + 5);
  context.fillStyle = "#ffe39b";
  context.font = "13px Cascadia Code, monospace";
  context.fillText(
    `global ${focusIndex} = wg ${focusGroup} * ${seed.workgroupSize} + local ${focusLocal}`,
    10,
    height - 6
  );
}

/**
 * 把当前 metrics 和样本行同步进 HUD。
 * @param {ComputeFoundationsHudRefs} refs lesson 18 需要更新的 DOM 引用集合。
 * @param {ComputeFoundationsMetrics} metrics 当前 compute lesson 的实时指标。
 * @param {ComputeFoundationsSampleRow[]} sampleRows 围绕当前聚焦索引生成的线程样本列表。
 * @returns {void} 只更新 DOM 内容，不返回额外结果。
 */
function updateHud(
  refs: ComputeFoundationsHudRefs,
  metrics: ComputeFoundationsMetrics,
  sampleRows: ComputeFoundationsSampleRow[]
) {
  refs.pulseValue.textContent = `${Math.round(metrics.pulseStrength * 100)}%`;
  refs.speedValue.textContent = `${metrics.sweepSpeed.toFixed(2)}x`;
  refs.elementCountValue.textContent = metrics.elementCount.toString();
  refs.workgroupValue.textContent = `${metrics.workgroupSize} threads`;
  refs.dispatchValue.textContent = `${metrics.workgroupCount} groups`;
  refs.latencyValue.textContent = `${metrics.readbackLatencyMs.toFixed(2)} ms`;
  refs.focusValue.textContent = `#${metrics.focusIndex} · ${(metrics.focusValue * 100).toFixed(0)}%`;
  refs.readbackBadge.textContent = `readback age ${metrics.snapshotAgeMs.toFixed(0)} ms`;
  refs.focusBadge.textContent = `global ${metrics.focusIndex}`;
  refs.caption.textContent =
    "上面这条带图显示的是最近一次从 storage buffer 读回 CPU 的结果；每 16 个元素就是一个 workgroup。";

  refs.samples.innerHTML = sampleRows
    .map(
      (row) => `
        <div class="compute-foundations-sample">
          <span class="compute-foundations-sample__index">#${row.index}</span>
          <span>wg ${row.workgroup}</span>
          <span>local ${row.local}</span>
          <strong>${(row.value * 100).toFixed(0)}%</strong>
        </div>
      `
    )
    .join("");

  const focusGroup = Math.floor(metrics.focusIndex / metrics.workgroupSize);
  const focusLocal = metrics.focusIndex % metrics.workgroupSize;
  refs.formula.innerHTML = `
    <strong>当前聚焦元素</strong>
    <span>\`global_invocation_id.x = ${metrics.focusIndex}\`</span>
    <span>\`workgroup_id.x = ${focusGroup}\`</span>
    <span>\`local_invocation_id.x = ${focusLocal}\`</span>
  `;
  refs.legend.textContent =
    `当前实验：聚焦第 ${metrics.focusIndex} 个元素时，它落在第 ${focusGroup} 个 workgroup 的 local ${focusLocal} 号线程里。` +
    " 这节课先只看 compute pass 怎样批量写 storage buffer，再定期 copy 到 readback buffer 给 CPU 做可视化。";
}

/**
 * 挂载第 18 课“Compute 基础与 Storage Buffer”预览。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听与 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountComputeFoundationsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--compute-foundations">
      <div class="compute-foundations-stage">
        <div class="compute-foundations-badges">
          <span class="compute-foundations-badge">compute pass · 只负责改数据</span>
          <span class="compute-foundations-badge">storage buffer · shader 可读写</span>
          <span class="compute-foundations-badge">CPU 只做 readback 可视化</span>
        </div>

        <div class="compute-foundations-controls">
          <label class="compute-foundations-control">
            <span>聚焦脉冲</span>
            <input type="range" min="0" max="100" value="68" data-pulse-range />
            <strong data-pulse-value>68%</strong>
          </label>
          <label class="compute-foundations-control">
            <span>自动扫描速度</span>
            <input type="range" min="40" max="180" value="92" data-speed-range />
            <strong data-speed-value>0.92x</strong>
          </label>
        </div>

        <div class="compute-foundations-layout">
          <section class="compute-foundations-panel compute-foundations-panel--chart">
            <div class="compute-foundations-panel__header">
              <div>
                <p class="eyebrow">Storage Snapshot</p>
                <h3>storage buffer 条带图</h3>
              </div>
              <span class="compute-foundations-chip" data-readback-badge>readback age 0 ms</span>
            </div>
            <canvas class="compute-foundations-chart" data-chart-canvas aria-label="Compute foundations storage buffer view"></canvas>
            <p class="compute-foundations-caption" data-caption></p>
          </section>

          <section class="compute-foundations-panel compute-foundations-panel--side">
            <div class="compute-foundations-panel__header">
              <div>
                <p class="eyebrow">Thread View</p>
                <h3>线程样本</h3>
              </div>
              <span class="compute-foundations-chip compute-foundations-chip--warm" data-focus-badge>global 0</span>
            </div>
            <div class="compute-foundations-samples" data-samples></div>
            <div class="compute-foundations-formula" data-formula></div>
          </section>
        </div>

        <div class="compute-foundations-card-grid">
          <article class="compute-foundations-card">
            <p>storage 元素</p>
            <strong data-element-count>0</strong>
          </article>
          <article class="compute-foundations-card">
            <p>workgroup</p>
            <strong data-workgroup-size>0</strong>
          </article>
          <article class="compute-foundations-card">
            <p>dispatch</p>
            <strong data-dispatch-count>0</strong>
          </article>
          <article class="compute-foundations-card">
            <p>最近读回</p>
            <strong data-readback-latency>0 ms</strong>
          </article>
          <article class="compute-foundations-card">
            <p>聚焦元素</p>
            <strong data-focus-value>#0</strong>
          </article>
        </div>

        <div class="compute-foundations-legend" data-legend></div>
      </div>
    </div>
  `;

  const refs: ComputeFoundationsHudRefs = {
    chartCanvas: host.querySelector<HTMLCanvasElement>("[data-chart-canvas]")!,
    pulseRange: host.querySelector<HTMLInputElement>("[data-pulse-range]")!,
    pulseValue: host.querySelector<HTMLElement>("[data-pulse-value]")!,
    speedRange: host.querySelector<HTMLInputElement>("[data-speed-range]")!,
    speedValue: host.querySelector<HTMLElement>("[data-speed-value]")!,
    elementCountValue: host.querySelector<HTMLElement>("[data-element-count]")!,
    workgroupValue: host.querySelector<HTMLElement>("[data-workgroup-size]")!,
    dispatchValue: host.querySelector<HTMLElement>("[data-dispatch-count]")!,
    latencyValue: host.querySelector<HTMLElement>("[data-readback-latency]")!,
    focusValue: host.querySelector<HTMLElement>("[data-focus-value]")!,
    readbackBadge: host.querySelector<HTMLElement>("[data-readback-badge]")!,
    focusBadge: host.querySelector<HTMLElement>("[data-focus-badge]")!,
    caption: host.querySelector<HTMLElement>("[data-caption]")!,
    samples: host.querySelector<HTMLElement>("[data-samples]")!,
    formula: host.querySelector<HTMLElement>("[data-formula]")!,
    legend: host.querySelector<HTMLElement>("[data-legend]")!,
  };

  if (Object.values(refs).some((value) => !value)) {
    throw new Error("lesson 18 的预览 DOM 没有创建完整。");
  }

  try {
    const device = await requestComputeDevice();
    const seed = createComputeFoundationsSeedData(ELEMENT_COUNT);
    const snapshotByteLength = seed.cellData.byteLength;

    const uniformBuffer = device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const cellBuffer = device.createBuffer({
      size: snapshotByteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    const readbackBuffer = device.createBuffer({
      size: snapshotByteLength,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    device.queue.writeBuffer(cellBuffer, 0, seed.cellData);

    const computePipeline = device.createComputePipeline({
      label: "lesson-18-compute-foundations",
      layout: "auto",
      compute: {
        module: device.createShaderModule({ code: computeShaderSource }),
        entryPoint: "csMain",
      },
    });

    const computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: cellBuffer } },
      ],
    });

    const metrics: ComputeFoundationsMetrics = {
      elementCount: seed.elementCount,
      workgroupSize: seed.workgroupSize,
      workgroupCount: seed.workgroupCount,
      focusIndex: 0,
      focusValue: readCellValue(seed.cellData, 0),
      readbackLatencyMs: 0,
      snapshotAgeMs: 0,
      pulseStrength: Number(refs.pulseRange.value) / 100,
      sweepSpeed: Number(refs.speedRange.value) / 100,
    };

    let hoveredIndex: number | null = null;
    let pendingReadback = false;
    let lastReadbackRequestMs = -READBACK_INTERVAL_MS;
    let lastSnapshotUpdateMs = performance.now();
    let lastSnapshot = seed.cellData.slice();
    let animationFrameId = 0;
    let disposed = false;

    const renderHud = (timeMs: number) => {
      metrics.snapshotAgeMs = Math.max(0, timeMs - lastSnapshotUpdateMs);
      metrics.focusValue = readCellValue(lastSnapshot, metrics.focusIndex);
      const sampleRows = createSampleRows(lastSnapshot, metrics.focusIndex, seed);

      drawStorageBufferView(refs.chartCanvas, lastSnapshot, seed, metrics.focusIndex);
      updateHud(refs, metrics, sampleRows);
    };

    const scheduleReadback = (startedAtMs: number) => {
      pendingReadback = true;

      readbackBuffer
        .mapAsync(GPUMapMode.READ)
        .then(() => {
          if (disposed) {
            if (readbackBuffer.mapState === "mapped") {
              readbackBuffer.unmap();
            }
            return;
          }

          const copied = new Float32Array(readbackBuffer.getMappedRange().slice(0));
          readbackBuffer.unmap();

          lastSnapshot = copied;
          metrics.readbackLatencyMs = performance.now() - startedAtMs;
          lastSnapshotUpdateMs = performance.now();
        })
        .catch(() => {
          if (readbackBuffer.mapState === "mapped") {
            readbackBuffer.unmap();
          }
        })
        .finally(() => {
          pendingReadback = false;
        });
    };

    const handlePulseInput = () => {
      metrics.pulseStrength = Number(refs.pulseRange.value) / 100;
      renderHud(performance.now());
    };

    const handleSpeedInput = () => {
      metrics.sweepSpeed = Number(refs.speedRange.value) / 100;
      renderHud(performance.now());
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = refs.chartCanvas.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
      hoveredIndex = Math.max(
        0,
        Math.min(seed.elementCount - 1, Math.floor(ratio * seed.elementCount))
      );
    };

    const handlePointerLeave = () => {
      hoveredIndex = null;
    };

    refs.pulseRange.addEventListener("input", handlePulseInput);
    refs.speedRange.addEventListener("input", handleSpeedInput);
    refs.chartCanvas.addEventListener("pointermove", handlePointerMove);
    refs.chartCanvas.addEventListener("pointerleave", handlePointerLeave);

    const resizeObserver = new ResizeObserver(() => {
      renderHud(performance.now());
    });
    resizeObserver.observe(host);

    const renderFrame = (timeMs: number) => {
      metrics.focusIndex = resolveFocusIndex(
        seed.elementCount,
        hoveredIndex,
        timeMs,
        metrics.sweepSpeed
      );

      device.queue.writeBuffer(
        uniformBuffer,
        0,
        createComputeUniformData(timeMs * 0.001, seed, metrics.focusIndex, metrics.pulseStrength)
      );

      const commandEncoder = device.createCommandEncoder({
        label: "lesson-18-compute-command-encoder",
      });
      const computePass = commandEncoder.beginComputePass({
        label: "lesson-18-compute-pass",
      });

      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(seed.workgroupCount);
      computePass.end();

      let readbackStartedAtMs = 0;
      if (!pendingReadback && timeMs - lastReadbackRequestMs >= READBACK_INTERVAL_MS) {
        commandEncoder.copyBufferToBuffer(cellBuffer, 0, readbackBuffer, 0, snapshotByteLength);
        lastReadbackRequestMs = timeMs;
        readbackStartedAtMs = performance.now();
      }

      device.queue.submit([commandEncoder.finish()]);

      if (readbackStartedAtMs > 0) {
        scheduleReadback(readbackStartedAtMs);
      }

      renderHud(timeMs);
      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    setStatus({
      title: "Compute 基础实验已运行",
      detail:
        "这一课现在只做一件事：让 compute pass 按 workgroup 批量更新 storage buffer，再定期把结果读回 CPU 做可视化。",
      tone: "ok",
    });

    renderHud(performance.now());
    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      refs.pulseRange.removeEventListener("input", handlePulseInput);
      refs.speedRange.removeEventListener("input", handleSpeedInput);
      refs.chartCanvas.removeEventListener("pointermove", handlePointerMove);
      refs.chartCanvas.removeEventListener("pointerleave", handlePointerLeave);

      if (readbackBuffer.mapState === "mapped") {
        readbackBuffer.unmap();
      }

      uniformBuffer.destroy();
      cellBuffer.destroy();
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
