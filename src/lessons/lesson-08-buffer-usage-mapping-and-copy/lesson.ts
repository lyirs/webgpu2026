import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-08-buffer-usage-mapping-and-copy/buffer-bars.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

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

export async function mountBufferUsageMappingAndCopyLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Buffer usage and copy preview"></canvas>
          <div class="webgpu-api-overlay">
            <strong>writeBuffer -> mapAsync -> copyBufferToBuffer</strong>
            <span>同一批数值先上传，再从 GPU readback 校验</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>buffer bytes</span><strong data-bytes>0</strong></article>
          <article class="webgpu-api-metric"><span>readback sum</span><strong data-sum>pending</strong></article>
          <article class="webgpu-api-metric"><span>copy path</span><strong>MAP_WRITE -> COPY_SRC -> COPY_DST</strong></article>
        </div>
        <div class="webgpu-api-note">柱状图来自 storage buffer；readback 数值来自 MAP_READ buffer。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const bytesLabel = host.querySelector<HTMLElement>("[data-bytes]");
  const sumLabel = host.querySelector<HTMLElement>("[data-sum]");
  if (!canvas || !stage || !bytesLabel || !sumLabel) {
    throw new Error("Buffer lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const values = new Float32Array([
      0.18, 0.52, 0.74, 0.33, 0.91, 0.43, 0.63, 0.28,
      0.82, 0.57, 0.37, 0.96, 0.49, 0.69, 0.22, 0.79,
    ]);

    const storageBuffer = gpu.device.createBuffer({
      label: "lesson-04-storage-buffer",
      size: values.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    gpu.device.queue.writeBuffer(storageBuffer, 0, values);

    const stagingBuffer = gpu.device.createBuffer({
      label: "lesson-04-staging-map-write",
      size: values.byteLength,
      usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
    });
    await stagingBuffer.mapAsync(GPUMapMode.WRITE);
    new Float32Array(stagingBuffer.getMappedRange()).set(values.map((value) => Math.min(1, value * 0.92 + 0.06)));
    stagingBuffer.unmap();

    const readbackBuffer = gpu.device.createBuffer({
      label: "lesson-04-readback-map-read",
      size: values.byteLength,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-04-buffer-bars-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-04-buffer-bars-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: storageBuffer } }],
    });

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-04-command-encoder",
      });
      commandEncoder.copyBufferToBuffer(stagingBuffer, 0, storageBuffer, 0, values.byteLength);

      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.035, g: 0.055, b: 0.09, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(values.length * 6);
      pass.end();

      commandEncoder.copyBufferToBuffer(storageBuffer, 0, readbackBuffer, 0, values.byteLength);
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    render();
    await gpu.device.queue.onSubmittedWorkDone();
    await readbackBuffer.mapAsync(GPUMapMode.READ);
    const readback = new Float32Array(readbackBuffer.getMappedRange());
    const sum = Array.from(readback).reduce((total, value) => total + value, 0);
    readbackBuffer.unmap();

    bytesLabel.textContent = `${values.byteLength}`;
    sumLabel.textContent = sum.toFixed(2);

    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Buffer copy 链路已就绪",
      detail: "writeBuffer、mapAsync、copyBufferToBuffer 与 MAP_READ readback 都已跑通。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      storageBuffer.destroy();
      stagingBuffer.destroy();
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
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
