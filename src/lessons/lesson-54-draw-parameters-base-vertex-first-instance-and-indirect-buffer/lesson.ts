import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-54-draw-parameters-base-vertex-first-instance-and-indirect-buffer/draw-parameters.wgsl?raw";

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

function setPanelViewport(pass: GPURenderPassEncoder, canvas: HTMLCanvasElement, panel: number) {
  const width = Math.floor(canvas.width / 3);
  const x = panel * width;
  const panelWidth = panel === 2 ? canvas.width - x : width;
  pass.setViewport(x, 0, panelWidth, canvas.height, 0, 1);
  pass.setScissorRect(x, 0, panelWidth, canvas.height);
}

function createBufferFromBytes(
  device: GPUDevice,
  label: string,
  data: Float32Array | Uint16Array | Uint32Array | Int32Array,
  usage: GPUBufferUsageFlags
) {
  const buffer = device.createBuffer({
    label,
    size: Math.ceil(data.byteLength / 4) * 4,
    usage,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  buffer.unmap();
  return buffer;
}

export async function mountDrawParametersBaseVertexFirstInstanceAndIndirectBufferLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Draw parameters preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>draw 参数不是只有 vertexCount</strong>
            <span>左：firstVertex / firstInstance；中：drawIndexed 的 baseVertex；右：drawIndirect 与 drawIndexedIndirect 从 buffer 取参数。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>draw</span><strong>3, 2, 0, 1</strong></article>
          <article class="webgpu-api-metric"><span>drawIndexed</span><strong>baseVertex 3</strong></article>
          <article class="webgpu-api-metric"><span>indirect args</span><strong>4 / 5 u32</strong></article>
          <article class="webgpu-api-metric"><span>firstInstance</span><strong>visible color shift</strong></article>
        </div>
        <div class="webgpu-api-note">这节只讲 draw 调用如何解释参数；真正由 compute 写 indirect buffer 会在后面的 GPU-driven 课程继续展开。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Draw parameters lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-38-draw-parameters-pipeline",
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x4" },
            ],
          },
        ],
      },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
      primitive: { topology: "triangle-list" },
    });

    const vertices = new Float32Array([
      -0.46, -0.42, 0.32, 0.78, 1.0, 1.0,
      0.02, 0.46, 0.32, 0.78, 1.0, 1.0,
      0.46, -0.42, 0.32, 0.78, 1.0, 1.0,
      -0.36, -0.34, 1.0, 0.58, 0.28, 1.0,
      0.08, 0.42, 1.0, 0.80, 0.28, 1.0,
      0.48, -0.34, 1.0, 0.52, 0.72, 1.0,
    ]);
    const indices = new Uint16Array([0, 1, 2]);
    // Indirect draws keep firstInstance = 0 so the lesson works without the
    // optional "indirect-first-instance" feature on every adapter.
    const drawIndirectArgs = new Uint32Array([3, 2, 0, 0]);
    const drawIndexedIndirectArgs = new Int32Array([3, 1, 0, 3, 0]);

    const vertexBuffer = createBufferFromBytes(gpu.device, "lesson-38-vertices", vertices, GPUBufferUsage.VERTEX);
    const indexBuffer = createBufferFromBytes(gpu.device, "lesson-38-indices", indices, GPUBufferUsage.INDEX);
    const drawIndirectBuffer = createBufferFromBytes(
      gpu.device,
      "lesson-38-draw-indirect-buffer",
      drawIndirectArgs,
      GPUBufferUsage.INDIRECT
    );
    const drawIndexedIndirectBuffer = createBufferFromBytes(
      gpu.device,
      "lesson-38-draw-indexed-indirect-buffer",
      drawIndexedIndirectArgs,
      GPUBufferUsage.INDIRECT
    );

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-38-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");

      setPanelViewport(pass, canvas, 0);
      pass.draw(3, 2, 0, 1);

      setPanelViewport(pass, canvas, 1);
      pass.drawIndexed(3, 1, 0, 3, 1);

      setPanelViewport(pass, canvas, 2);
      pass.drawIndirect(drawIndirectBuffer, 0);
      pass.drawIndexedIndirect(drawIndexedIndirectBuffer, 0);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Draw 参数已就绪",
      detail: "firstVertex、firstInstance、baseVertex 与 indirect 参数 buffer 已并排展示。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      drawIndirectBuffer.destroy();
      drawIndexedIndirectBuffer.destroy();
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
