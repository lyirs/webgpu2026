import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-37-wgsl-memory-layout-padding-and-struct-alignment/layout-probe.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const uniformFloats = 24;

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

function createAlignedData() {
  const data = new Float32Array(uniformFloats);
  data.set([0.12, 0.68, 0.86], 0);
  data.set([
    1.0, 0.04, 0.0, 0.0,
    0.0, 0.86, 0.0, 0.0,
    0.0, 0.0, 0.72, 0.0,
    0.12, 0.18, 0.0, 1.0,
  ], 4);
  data.set([0.18, 0.52, 0.28], 20);
  data[23] = 0.92;
  return data;
}

function createCompactData() {
  const data = new Float32Array(uniformFloats);
  data.set([0.12, 0.68, 0.86], 0);
  data.set([
    1.0, 0.04, 0.0, 0.0,
    0.0, 0.86, 0.0, 0.0,
    0.0, 0.0, 0.72, 0.0,
    0.12, 0.18, 0.0, 1.0,
  ], 3);
  data.set([0.18, 0.52, 0.28], 19);
  data[22] = 0.92;
  return data;
}

export async function mountWgslMemoryLayoutPaddingAndStructAlignmentLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="WGSL memory layout preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>same struct, different CPU packing</strong>
            <span>左：期望值，中：紧凑错误写入，右：按 WGSL alignment 写入</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-resource-grid">
          <article class="webgpu-api-resource"><span>vec3f alignment</span><strong>16 bytes</strong><small>size is 12, next aligned field starts at 16</small></article>
          <article class="webgpu-api-resource"><span>mat4x4f offset</span><strong>float[4]</strong><small>not float[3]</small></article>
          <article class="webgpu-api-resource"><span>struct size</span><strong>${uniformFloats * 4} bytes</strong><small>rounded to max alignment</small></article>
        </div>
        <div class="webgpu-api-note">紧凑写入不会报错，但 shader 会在 WGSL 规定的 offset 读取，于是字段整体错位。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("WGSL layout lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const compactBuffer = gpu.device.createBuffer({
      label: "lesson-16-compact-uniform-buffer",
      size: uniformFloats * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const alignedBuffer = gpu.device.createBuffer({
      label: "lesson-16-aligned-uniform-buffer",
      size: uniformFloats * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const paramsBuffer = gpu.device.createBuffer({
      label: "lesson-16-layout-params",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(compactBuffer, 0, createCompactData());
    gpu.device.queue.writeBuffer(alignedBuffer, 0, createAlignedData());

    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-16-layout-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-16-layout-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: compactBuffer } },
        { binding: 1, resource: { buffer: alignedBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    });

    let animationFrame = 0;
    const render = (time: number) => {
      syncApiViewport(host, stage);
      gpu.resize();
      gpu.device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([time * 0.001, 4, 3, 4]));
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-16-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    setStatus({
      title: "WGSL layout 对照已就绪",
      detail: "中间面板故意紧凑写入，右侧按 padding/stride 对齐后读数恢复稳定。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      compactBuffer.destroy();
      alignedBuffer.destroy();
      paramsBuffer.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `
      <div class="preview-empty">
        <h3>预览不可用</h3>
        <p>${message}</p>
      </div>
    `;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
