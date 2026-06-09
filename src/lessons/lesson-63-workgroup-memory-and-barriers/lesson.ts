import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-63-workgroup-memory-and-barriers/workgroup-memory.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const gridSize = 64;
const workgroupSize = 8;
const cellCount = gridSize * gridSize;

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

function createInputCells() {
  const cells = new Float32Array(cellCount * 4);
  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const index = (y * gridSize + x) * 4;
      const wave = Math.sin(x * 0.28) * 0.18 + Math.cos(y * 0.23) * 0.18;
      const island = Math.exp(-((x - 42) ** 2 + (y - 24) ** 2) / 280);
      cells[index] = Math.max(0, Math.min(1, 0.42 + wave + island * 0.36));
      cells[index + 3] = 1;
    }
  }
  return cells;
}

export async function mountWorkgroupMemoryAndBarriersLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Workgroup memory tiled filtering preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>left: global reads / right: workgroup tile</strong>
            <span>var&lt;workgroup&gt; tile + workgroupBarrier() 保证邻居数据就绪</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>workgroup size</span><strong>${workgroupSize} x ${workgroupSize}</strong></article>
          <article class="webgpu-api-metric"><span>grid cells</span><strong>${cellCount.toLocaleString()}</strong></article>
          <article class="webgpu-api-metric"><span>naive global reads</span><strong>~${(cellCount * 5).toLocaleString()}</strong></article>
          <article class="webgpu-api-metric"><span>tiled loads</span><strong>~${(Math.ceil(gridSize / 8) ** 2 * 100).toLocaleString()}</strong></article>
        </div>
        <div class="webgpu-api-note">两边做同一个 5-tap filter。左边每个线程自己读邻居；右边先把 8x8 tile 和边界读进 workgroup memory，再用 barrier 对齐。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Workgroup memory lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const inputBuffer = gpu.device.createBuffer({
      label: "lesson-28-input-cells",
      size: cellCount * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const naiveBuffer = gpu.device.createBuffer({
      label: "lesson-28-naive-output",
      size: cellCount * 16,
      usage: GPUBufferUsage.STORAGE,
    });
    const tiledBuffer = gpu.device.createBuffer({
      label: "lesson-28-tiled-output",
      size: cellCount * 16,
      usage: GPUBufferUsage.STORAGE,
    });
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-28-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(inputBuffer, 0, createInputCells());

    const bindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-28-shared-bind-group-layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    const pipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-28-shared-pipeline-layout",
      bindGroupLayouts: [bindGroupLayout],
    });
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-28-workgroup-memory-compute-pipeline",
      layout: pipelineLayout,
      compute: { module: shaderModule, entryPoint: "csMain" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-28-workgroup-memory-render-pipeline",
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-28-shared-bind-group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: naiveBuffer } },
        { binding: 2, resource: { buffer: tiledBuffer } },
        { binding: 3, resource: { buffer: uniformBuffer } },
      ],
    });

    let animationFrame = 0;
    const start = performance.now();
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const time = (performance.now() - start) / 1000;
      gpu.device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([time, gridSize, 1, 0]));

      const commandEncoder = gpu.device.createCommandEncoder({ label: "lesson-28-command-encoder" });
      const computePass = commandEncoder.beginComputePass({ label: "lesson-28-filter-pass" });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(Math.ceil(gridSize / workgroupSize), Math.ceil(gridSize / workgroupSize));
      computePass.end();

      const renderPass = commandEncoder.beginRenderPass({
        label: "lesson-28-present-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(3);
      renderPass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Workgroup memory 已就绪",
      detail: "左侧直接读 global 邻居，右侧先载入 tile 并通过 workgroupBarrier 同步。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      inputBuffer.destroy();
      naiveBuffer.destroy();
      tiledBuffer.destroy();
      uniformBuffer.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
