import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-59-dispatch-workgroups-indirect-and-gpu-written-dispatch-args/indirect-dispatch.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const cellCount = 256;
const cellBufferSize = cellCount * 4;
const maxGroups = 4;

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

export async function mountDispatchWorkgroupsIndirectAndGpuWrittenDispatchArgsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--indirect-dispatch">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="dispatchWorkgroupsIndirect preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>GPU writes dispatch args, next compute pass consumes them</strong>
            <span>左 direct dispatch reference；右 dispatchWorkgroupsIndirect，从 GPU 写出的 args buffer 取 x/y/z。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>direct groups</span><strong data-direct>pending</strong></article>
          <article class="webgpu-api-metric"><span>indirect args</span><strong data-args>pending</strong></article>
          <article class="webgpu-api-metric"><span>active cells</span><strong data-cells>pending</strong></article>
          <article class="webgpu-api-metric"><span>args source</span><strong data-source>GPU storage buffer</strong></article>
        </div>
        <div class="webgpu-api-note">indirect dispatch 常用于 GPU-driven compute：上一段 compute 决定下一段 compute 要开多少 workgroup。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const directLabel = host.querySelector<HTMLElement>("[data-direct]");
  const argsLabel = host.querySelector<HTMLElement>("[data-args]");
  const cellsLabel = host.querySelector<HTMLElement>("[data-cells]");
  if (!canvas || !stage || !directLabel || !argsLabel || !cellsLabel) {
    throw new Error("Indirect dispatch lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ code: shaderSource });
    const writeArgsPipeline = gpu.device.createComputePipeline({
      label: "lesson-59-write-dispatch-args-pipeline",
      layout: "auto",
      compute: { module, entryPoint: "writeArgs" },
    });
    const fillPipeline = gpu.device.createComputePipeline({
      label: "lesson-59-fill-cells-pipeline",
      layout: "auto",
      compute: { module, entryPoint: "fillCells" },
    });
    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-59-present-indirect-dispatch-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });

    const paramsBuffer = gpu.device.createBuffer({
      label: "lesson-59-dispatch-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const directBuffer = gpu.device.createBuffer({
      label: "lesson-59-direct-cells",
      size: cellBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const indirectBuffer = gpu.device.createBuffer({
      label: "lesson-59-indirect-cells",
      size: cellBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const argsBuffer = gpu.device.createBuffer({
      label: "lesson-59-gpu-written-dispatch-args",
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    const argsReadbackBuffer = gpu.device.createBuffer({
      label: "lesson-59-dispatch-args-readback",
      size: 16,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const argsBindGroup = gpu.device.createBindGroup({
      layout: writeArgsPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: argsBuffer } },
        { binding: 1, resource: { buffer: paramsBuffer } },
      ],
    });
    const directBindGroup = gpu.device.createBindGroup({
      layout: fillPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: directBuffer } },
        { binding: 1, resource: { buffer: paramsBuffer } },
      ],
    });
    const indirectBindGroup = gpu.device.createBindGroup({
      layout: fillPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: indirectBuffer } },
        { binding: 1, resource: { buffer: paramsBuffer } },
      ],
    });
    const renderBindGroup = gpu.device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: directBuffer } },
        { binding: 1, resource: { buffer: indirectBuffer } },
      ],
    });

    let frameId = 0;
    let readbackBusy = false;
    let disposed = false;
    let latestArgs = new Uint32Array([1, 1, 1, 0]);

    const scheduleArgsReadback = async () => {
      if (readbackBusy || disposed) return;
      readbackBusy = true;
      try {
        await argsReadbackBuffer.mapAsync(GPUMapMode.READ);
        if (disposed) {
          argsReadbackBuffer.unmap();
          return;
        }
        latestArgs = new Uint32Array(argsReadbackBuffer.getMappedRange().slice(0));
        argsReadbackBuffer.unmap();
        argsLabel.textContent = `${latestArgs[0]}, ${latestArgs[1]}, ${latestArgs[2]}`;
      } catch {
        if (!disposed) {
          argsLabel.textContent = "readback delayed";
        }
      } finally {
        readbackBusy = false;
      }
    };

    const render = (time = 0) => {
      syncApiViewport(host, stage);
      gpu.resize();
      const groups = 1 + (Math.floor(time * 0.0012) % maxGroups);
      const activeCells = groups * 64;
      directLabel.textContent = `${groups}, 1, 1`;
      cellsLabel.textContent = `${activeCells} / ${cellCount}`;
      gpu.device.queue.writeBuffer(paramsBuffer, 0, new Uint32Array([groups, cellCount, Math.floor(time * 0.01), 0]));

      const encoder = gpu.device.createCommandEncoder({ label: "lesson-59-command-encoder" });
      encoder.clearBuffer(directBuffer);
      encoder.clearBuffer(indirectBuffer);
      encoder.clearBuffer(argsBuffer);

      const writePass = encoder.beginComputePass({ label: "lesson-59-write-args-pass" });
      writePass.setPipeline(writeArgsPipeline);
      writePass.setBindGroup(0, argsBindGroup);
      writePass.dispatchWorkgroups(1);
      writePass.end();

      const directPass = encoder.beginComputePass({ label: "lesson-59-direct-dispatch-pass" });
      directPass.setPipeline(fillPipeline);
      directPass.setBindGroup(0, directBindGroup);
      directPass.dispatchWorkgroups(groups);
      directPass.end();

      const indirectPass = encoder.beginComputePass({ label: "lesson-59-indirect-dispatch-pass" });
      indirectPass.setPipeline(fillPipeline);
      indirectPass.setBindGroup(0, indirectBindGroup);
      indirectPass.dispatchWorkgroupsIndirect(argsBuffer, 0);
      indirectPass.end();

      if (!readbackBusy) {
        encoder.copyBufferToBuffer(argsBuffer, 0, argsReadbackBuffer, 0, 16);
      }

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.016, g: 0.026, b: 0.045, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(renderPipeline);
      pass.setBindGroup(0, renderBindGroup);
      pass.draw(3);
      pass.end();

      gpu.device.queue.submit([encoder.finish()]);
      void scheduleArgsReadback();
      frameId = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Indirect dispatch 已就绪",
      detail: "第一段 compute 写 dispatch args，第二段 compute 通过 dispatchWorkgroupsIndirect 消费它。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      paramsBuffer.destroy();
      directBuffer.destroy();
      indirectBuffer.destroy();
      argsBuffer.destroy();
      argsReadbackBuffer.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
