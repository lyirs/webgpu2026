import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-68-color-target-state-blend-and-write-mask/color-target-state.wgsl?raw";

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
  const width = Math.floor(canvas.width / 4);
  const x = panel * width;
  const panelWidth = panel === 3 ? canvas.width - x : width;
  pass.setViewport(x, 0, panelWidth, canvas.height, 0, 1);
  pass.setScissorRect(x, 0, panelWidth, canvas.height);
}

function createVertexBuffer(device: GPUDevice) {
  const vertices = new Float32Array([
    -0.70, -0.45, 0.25, 0.72, 1.0, 0.58,
    0.18, -0.45, 0.25, 0.72, 1.0, 0.58,
    0.18, 0.48, 0.25, 0.72, 1.0, 0.58,
    -0.70, -0.45, 0.25, 0.72, 1.0, 0.58,
    0.18, 0.48, 0.25, 0.72, 1.0, 0.58,
    -0.70, 0.48, 0.25, 0.72, 1.0, 0.58,
    -0.18, -0.32, 1.0, 0.56, 0.20, 0.58,
    0.70, -0.32, 1.0, 0.56, 0.20, 0.58,
    0.70, 0.62, 1.0, 0.56, 0.20, 0.58,
    -0.18, -0.32, 1.0, 0.56, 0.20, 0.58,
    0.70, 0.62, 1.0, 0.56, 0.20, 0.58,
    -0.18, 0.62, 1.0, 0.56, 0.20, 0.58,
  ]);
  const buffer = device.createBuffer({
    label: "lesson-46-blend-vertices",
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(buffer.getMappedRange()).set(vertices);
  buffer.unmap();
  return buffer;
}

export async function mountColorTargetStateBlendAndWriteMaskLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Color target state blend and write mask preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>ColorTargetState</strong>
            <span>从左到右：无 blend 覆盖、alpha blend、additive blend、writeMask 只写 R/B 通道。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>target 0</span><strong>replace</strong></article>
          <article class="webgpu-api-metric"><span>target 1</span><strong>alpha blend</strong></article>
          <article class="webgpu-api-metric"><span>target 2</span><strong>additive</strong></article>
          <article class="webgpu-api-metric"><span>writeMask</span><strong>R | B</strong></article>
        </div>
        <div class="webgpu-api-note">blend 决定新片元如何和已有颜色混合；writeMask 决定哪些颜色通道真正写入 render target。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Color target state lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ code: shaderSource });
    const vertexBuffer = createVertexBuffer(gpu.device);
    const vertexLayout: GPUVertexBufferLayout = {
      arrayStride: 24,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" },
        { shaderLocation: 1, offset: 8, format: "float32x4" },
      ],
    };
    const makePipeline = (label: string, target: GPUColorTargetState) =>
      gpu.device.createRenderPipeline({
        label,
        layout: "auto",
        vertex: { module, entryPoint: "vsMain", buffers: [vertexLayout] },
        fragment: { module, entryPoint: "fsMain", targets: [target] },
        primitive: { topology: "triangle-list" },
      });
    const replacePipeline = makePipeline("lesson-46-replace-pipeline", { format: gpu.format });
    const alphaPipeline = makePipeline("lesson-46-alpha-blend-pipeline", {
      format: gpu.format,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
      },
    });
    const additivePipeline = makePipeline("lesson-46-additive-blend-pipeline", {
      format: gpu.format,
      blend: {
        color: { srcFactor: "src-alpha", dstFactor: "one", operation: "add" },
        alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
      },
    });
    const writeMaskPipeline = makePipeline("lesson-46-write-mask-pipeline", {
      format: gpu.format,
      writeMask: 0x1 | 0x4,
    });
    const pipelines = [replacePipeline, alphaPipeline, additivePipeline, writeMaskPipeline];

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-46-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.10, g: 0.12, b: 0.15, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setVertexBuffer(0, vertexBuffer);
      for (let panel = 0; panel < pipelines.length; panel += 1) {
        setPanelViewport(pass, canvas, panel);
        pass.setPipeline(pipelines[panel]);
        pass.draw(12);
      }
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Color target state 已就绪",
      detail: "replace、alpha blend、additive blend 与 writeMask 正在同屏对照。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      vertexBuffer.destroy();
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
