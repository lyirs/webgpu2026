import { createWebGpuCanvas } from "@/core/webgpu";

import linearIndexingShaderSource from "./linear-indexing.wgsl?raw";
import manualAndPresentShaderSource from "./manual-and-present.wgsl?raw";

type GpuWithLanguageFeatures = GPU & {
  wgslLanguageFeatures?: Set<string>;
};

type AdapterInfoLike = {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
};

const GRID_WIDTH = 32;
const GRID_HEIGHT = 16;
const CELL_COUNT = GRID_WIDTH * GRID_HEIGHT;
const CELL_BUFFER_SIZE = CELL_COUNT * Uint32Array.BYTES_PER_ELEMENT;
const WORKGROUP_SIZE_X = 4;
const WORKGROUP_SIZE_Y = 4;
const DISPATCH_X = Math.ceil(GRID_WIDTH / WORKGROUP_SIZE_X);
const DISPATCH_Y = Math.ceil(GRID_HEIGHT / WORKGROUP_SIZE_Y);
const LINEAR_INDEXING_FEATURE = "linear_indexing";

function syncUpdateViewport(host: HTMLElement, canvas: HTMLCanvasElement): void {
  const bounds = host.getBoundingClientRect();
  const cssWidth = Math.max(720, Math.min(1280, Math.floor(bounds.width - 28)));
  const cssHeight = Math.max(360, Math.round(cssWidth * 0.5));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
}

function getLanguageFeatureSet(): Set<string> | null {
  if (!("gpu" in navigator)) {
    return null;
  }

  return (navigator.gpu as GpuWithLanguageFeatures).wgslLanguageFeatures ?? null;
}

async function getAdapterSummary(): Promise<string> {
  if (!("gpu" in navigator)) {
    return "navigator.gpu 不可用";
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    return "没有可用 GPUAdapter";
  }

  const info = (adapter as GPUAdapter & { info?: AdapterInfoLike }).info;
  const parts = [
    info?.vendor,
    info?.architecture,
    info?.device,
    info?.description,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : "adapter info unavailable";
}

function platformSummary(): string {
  const withUaData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return withUaData.userAgentData?.platform ?? navigator.platform ?? "unknown";
}

export async function mountChrome147148WebGpuUpdateLab(
  host: HTMLElement,
  setStatus: (status: { title: string; detail: string; tone: "info" | "ok" | "warn" }) => void
): Promise<() => void> {
  host.innerHTML = `
    <div class="update-lab-shell">
      <div class="update-lab-stage">
        <div class="update-lab-canvas-card">
          <canvas class="update-lab-canvas" aria-label="Chrome 147-148 WebGPU update lab"></canvas>
          <div class="update-lab-overlay">
            <strong>Chrome 147-148: linear_indexing</strong>
            <span>左侧手动 flatten index；右侧在支持时使用 WGSL builtin linear index。</span>
          </div>
          <div class="update-lab-panel-label update-lab-panel-label--left">manual formula</div>
          <div class="update-lab-panel-label update-lab-panel-label--right">linear_indexing / fallback</div>
        </div>
      </div>

      <div class="update-lab-sidecar">
        <div class="update-lab-badges">
          <span>official update lab</span>
          <span>Chrome 147-148</span>
          <span>runtime feature gate</span>
        </div>

        <div class="update-lab-metrics">
          <article>
            <span>WGSL feature</span>
            <strong data-feature>checking...</strong>
          </article>
          <article>
            <span>右侧模式</span>
            <strong data-mode>fallback</strong>
          </article>
          <article>
            <span>结果差异</span>
            <strong data-mismatch>0 cells</strong>
          </article>
          <article>
            <span>dispatch grid</span>
            <strong>${DISPATCH_X} x ${DISPATCH_Y}</strong>
          </article>
        </div>

        <div class="update-lab-cards">
          <article>
            <h3>Linux NVIDIA 覆盖</h3>
            <p data-platform>detecting adapter...</p>
          </article>
          <article>
            <h3>Dawn native 更新</h3>
            <p data-dawn>Dawn 侧更新不一定直接改变网页画面；这类条目适合记录为运行时/平台能力边界。</p>
          </article>
          <article>
            <h3>本课知识点</h3>
            <p>使用 <code>navigator.gpu.wgslLanguageFeatures</code> 做 feature gate；支持时编译 <code>requires linear_indexing</code> shader，不支持时保留旧公式路径。</p>
          </article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>(".update-lab-canvas")!;
  const featureValue = host.querySelector<HTMLElement>("[data-feature]")!;
  const modeValue = host.querySelector<HTMLElement>("[data-mode]")!;
  const mismatchValue = host.querySelector<HTMLElement>("[data-mismatch]")!;
  const platformValue = host.querySelector<HTMLElement>("[data-platform]")!;

  syncUpdateViewport(host, canvas);
  const resizeObserver = new ResizeObserver(() => syncUpdateViewport(host, canvas));
  resizeObserver.observe(host);

  const featureSet = getLanguageFeatureSet();
  const featureIsListed = featureSet?.has(LINEAR_INDEXING_FEATURE) ?? false;
  featureValue.textContent = featureIsListed ? "linear_indexing listed" : "not exposed";
  platformValue.textContent = `平台：${platformSummary()}；Adapter：${await getAdapterSummary()}`;

  const { device, context, format, resize } = await createWebGpuCanvas(canvas);

  const manualModule = device.createShaderModule({
    label: "update-u147-148-manual-and-present-module",
    code: manualAndPresentShaderSource,
  });

  const manualPipeline = device.createComputePipeline({
    label: "update-u147-148-manual-linear-index-pipeline",
    layout: "auto",
    compute: {
      module: manualModule,
      entryPoint: "csManual",
    },
  });

  const renderPipeline = device.createRenderPipeline({
    label: "update-u147-148-present-pipeline",
    layout: "auto",
    vertex: {
      module: manualModule,
      entryPoint: "vsFullscreen",
    },
    fragment: {
      module: manualModule,
      entryPoint: "fsFullscreen",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  let linearPipeline: GPUComputePipeline | null = null;
  let mode = 0;
  if (featureIsListed) {
    device.pushErrorScope("validation");
    try {
      const linearModule = device.createShaderModule({
        label: "update-u147-148-linear-indexing-module",
        code: linearIndexingShaderSource,
      });
      linearPipeline = device.createComputePipeline({
        label: "update-u147-148-linear-indexing-pipeline",
        layout: "auto",
        compute: {
          module: linearModule,
          entryPoint: "csLinear",
        },
      });
    } catch {
      linearPipeline = null;
    }

    const validationError = await device.popErrorScope();
    if (validationError) {
      linearPipeline = null;
      modeValue.textContent = "fallback: compile rejected";
    } else {
      mode = 1;
      modeValue.textContent = "builtin global/workgroup index";
    }
  } else {
    modeValue.textContent = "fallback: manual formula";
  }

  const paramsBuffer = device.createBuffer({
    label: "update-u147-148-params-buffer",
    size: 8 * Uint32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const manualBuffer = device.createBuffer({
    label: "update-u147-148-manual-cells-buffer",
    size: CELL_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const updateBuffer = device.createBuffer({
    label: "update-u147-148-update-cells-buffer",
    size: CELL_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const readbackBuffer = device.createBuffer({
    label: "update-u147-148-readback-buffer",
    size: CELL_BUFFER_SIZE * 2,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const createComputeBindGroup = (
    pipeline: GPUComputePipeline,
    buffer: GPUBuffer,
    label: string
  ) =>
    device.createBindGroup({
      label,
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer } },
        { binding: 1, resource: { buffer: paramsBuffer } },
      ],
    });

  const manualBindGroup = createComputeBindGroup(
    manualPipeline,
    manualBuffer,
    "update-u147-148-manual-bind-group"
  );
  const fallbackBindGroup = createComputeBindGroup(
    manualPipeline,
    updateBuffer,
    "update-u147-148-fallback-bind-group"
  );
  const linearBindGroup =
    linearPipeline === null
      ? null
      : createComputeBindGroup(
          linearPipeline,
          updateBuffer,
          "update-u147-148-linear-bind-group"
        );

  const renderBindGroup = device.createBindGroup({
    label: "update-u147-148-present-bind-group",
    layout: renderPipeline.getBindGroupLayout(1),
    entries: [
      { binding: 0, resource: { buffer: manualBuffer } },
      { binding: 1, resource: { buffer: updateBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });

  const params = new Uint32Array([
    GRID_WIDTH,
    GRID_HEIGHT,
    0,
    mode,
    DISPATCH_X,
    DISPATCH_Y,
    WORKGROUP_SIZE_X,
    WORKGROUP_SIZE_Y,
  ]);

  let animationFrame = 0;
  let frame = 0;
  let disposed = false;
  let readbackBusy = false;

  const scheduleReadback = async () => {
    if (readbackBusy || disposed) {
      return;
    }

    readbackBusy = true;
    try {
      await readbackBuffer.mapAsync(GPUMapMode.READ);
      if (disposed) {
        return;
      }

      const mapped = readbackBuffer.getMappedRange();
      const manual = new Uint32Array(mapped.slice(0, CELL_BUFFER_SIZE));
      const update = new Uint32Array(
        mapped.slice(CELL_BUFFER_SIZE, CELL_BUFFER_SIZE * 2)
      );
      let mismatch = 0;
      for (let index = 0; index < CELL_COUNT; index += 1) {
        if (manual[index] !== update[index]) {
          mismatch += 1;
        }
      }
      mismatchValue.textContent = `${mismatch} cells`;
    } catch {
      if (!disposed) {
        mismatchValue.textContent = "readback pending";
      }
    } finally {
      if (readbackBuffer.mapState === "mapped") {
        readbackBuffer.unmap();
      }
      readbackBusy = false;
    }
  };

  const render = () => {
    if (disposed) {
      return;
    }

    resize();
    frame += 1;
    params[2] = frame;
    params[3] = mode;
    device.queue.writeBuffer(paramsBuffer, 0, params);

    const encoder = device.createCommandEncoder({
      label: "update-u147-148-command-encoder",
    });

    const computePass = encoder.beginComputePass({
      label: "update-u147-148-compute-pass",
    });
    computePass.setPipeline(manualPipeline);
    computePass.setBindGroup(0, manualBindGroup);
    computePass.dispatchWorkgroups(DISPATCH_X, DISPATCH_Y, 1);

    if (linearPipeline !== null && linearBindGroup !== null) {
      computePass.setPipeline(linearPipeline);
      computePass.setBindGroup(0, linearBindGroup);
    } else {
      computePass.setPipeline(manualPipeline);
      computePass.setBindGroup(0, fallbackBindGroup);
    }
    computePass.dispatchWorkgroups(DISPATCH_X, DISPATCH_Y, 1);
    computePass.end();

    const pass = encoder.beginRenderPass({
      label: "update-u147-148-render-pass",
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.008, g: 0.014, b: 0.025, a: 1 },
        },
      ],
    });
    pass.setPipeline(renderPipeline);
    pass.setBindGroup(1, renderBindGroup);
    pass.draw(3);
    pass.end();

    if (!readbackBusy) {
      encoder.copyBufferToBuffer(manualBuffer, 0, readbackBuffer, 0, CELL_BUFFER_SIZE);
      encoder.copyBufferToBuffer(
        updateBuffer,
        0,
        readbackBuffer,
        CELL_BUFFER_SIZE,
        CELL_BUFFER_SIZE
      );
    }

    device.queue.submit([encoder.finish()]);
    void scheduleReadback();

    animationFrame = window.requestAnimationFrame(render);
  };

  setStatus({
    title: linearPipeline ? "Chrome 147-148 update lab" : "Chrome 147-148 fallback lab",
    detail: linearPipeline
      ? "正在对照 manual flatten 与 linear_indexing builtin 输出。"
      : "当前浏览器未暴露 linear_indexing，本课保留旧公式路径并展示 feature gate。",
    tone: linearPipeline ? "ok" : "info",
  });

  render();

  return () => {
    disposed = true;
    if (animationFrame !== 0) {
      window.cancelAnimationFrame(animationFrame);
    }
    resizeObserver.disconnect();
    if (readbackBuffer.mapState === "mapped") {
      readbackBuffer.unmap();
    }
    manualBuffer.destroy();
    updateBuffer.destroy();
    paramsBuffer.destroy();
    readbackBuffer.destroy();
  };
}
