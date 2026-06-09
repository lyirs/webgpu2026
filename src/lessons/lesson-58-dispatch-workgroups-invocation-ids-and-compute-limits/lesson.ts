import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-58-dispatch-workgroups-invocation-ids-and-compute-limits/dispatch-ids.compute.wgsl?raw";
import renderShaderSource from "@/lessons/lesson-58-dispatch-workgroups-invocation-ids-and-compute-limits/dispatch-ids.render.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const COLUMNS = 80;
const ROWS = 45;
const WORKGROUP_X = 8;
const WORKGROUP_Y = 4;
const DISPATCH_X = Math.ceil(COLUMNS / WORKGROUP_X);
const DISPATCH_Y = Math.ceil(ROWS / WORKGROUP_Y);

function syncApiViewport(host: HTMLElement, viewport: HTMLElement) {
  const width = host.clientWidth;
  const height = host.clientHeight;
  const aspect = 16 / 9;
  let nextWidth = width;
  let nextHeight = nextWidth / aspect;

  if (nextHeight > height) {
    nextHeight = height;
    nextWidth = nextHeight * aspect;
  }

  viewport.style.width = `${Math.floor(nextWidth)}px`;
  viewport.style.height = `${Math.floor(nextHeight)}px`;
}

export async function mountDispatchWorkgroupsInvocationIdsAndComputeLimitsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--dispatch-ids">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Dispatch workgroups and invocation ids preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>dispatchWorkgroups(${DISPATCH_X}, ${DISPATCH_Y})</strong>
            <span>颜色来自 local_invocation_id，棋盘条纹来自 workgroup_id，越界线程被 guard 掉。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>@workgroup_size</span><strong>${WORKGROUP_X} x ${WORKGROUP_Y}</strong></article>
          <article class="webgpu-api-metric"><span>dispatch grid</span><strong>${DISPATCH_X} x ${DISPATCH_Y}</strong></article>
          <article class="webgpu-api-metric"><span>active invocations</span><strong>${COLUMNS * ROWS}</strong></article>
          <article class="webgpu-api-metric"><span>maxComputeWorkgroupSizeX</span><strong data-limit>x</strong></article>
        </div>
        <div class="webgpu-api-note">dispatch 数量按 workgroup 计数，不按线程计数；shader 内用 global_invocation_id 映射实际数据，并用边界判断处理多出来的 invocation。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const limitValue = host.querySelector<HTMLElement>("[data-limit]");
  if (!canvas || !stage || !limitValue) {
    throw new Error("Dispatch ids lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    limitValue.textContent = String(gpu.device.limits.maxComputeWorkgroupSizeX);
    const computeModule = gpu.device.createShaderModule({ label: "lesson-47-dispatch-compute-shader", code: computeShaderSource });
    const renderModule = gpu.device.createShaderModule({ label: "lesson-47-dispatch-render-shader", code: renderShaderSource });
    const paramsBuffer = gpu.device.createBuffer({
      label: "lesson-47-dispatch-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const outputBuffer = gpu.device.createBuffer({
      label: "lesson-47-dispatch-output",
      size: COLUMNS * ROWS * 16,
      usage: GPUBufferUsage.STORAGE,
    });
    gpu.device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([COLUMNS, ROWS, COLUMNS * ROWS, 0]));
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-47-dispatch-compute-pipeline",
      layout: "auto",
      compute: { module: computeModule, entryPoint: "csMain" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-47-dispatch-render-pipeline",
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vsMain" },
      fragment: { module: renderModule, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const computeBindGroup = gpu.device.createBindGroup({
      label: "lesson-47-dispatch-compute-bind-group",
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
      ],
    });
    const renderBindGroup = gpu.device.createBindGroup({
      label: "lesson-47-dispatch-render-bind-group",
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
      ],
    });

    const render = (includeCompute: boolean) => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-47-command-encoder" });
      if (includeCompute) {
        const computePass = encoder.beginComputePass({ label: "lesson-47-dispatch-pass" });
        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, computeBindGroup);
        computePass.dispatchWorkgroups(DISPATCH_X, DISPATCH_Y);
        computePass.end();
      }
      const renderPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, renderBindGroup);
      renderPass.draw(6, COLUMNS * ROWS);
      renderPass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    render(true);
    const resizeObserver = new ResizeObserver(() => render(false));
    resizeObserver.observe(host);
    setStatus({
      title: "dispatchWorkgroups 已就绪",
      detail: "Compute pass 正在把 workgroup/local/global invocation id 映射成可视化网格。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      paramsBuffer.destroy();
      outputBuffer.destroy();
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
