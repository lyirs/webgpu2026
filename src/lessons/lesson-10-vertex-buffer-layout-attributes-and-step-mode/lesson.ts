import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-10-vertex-buffer-layout-attributes-and-step-mode/vertex-layout.wgsl?raw";

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

function createMappedBuffer(
  device: GPUDevice,
  label: string,
  data: Float32Array,
  usage: GPUBufferUsageFlags
) {
  const buffer = device.createBuffer({
    label,
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });
  new Float32Array(buffer.getMappedRange()).set(data);
  buffer.unmap();
  return buffer;
}

export async function mountVertexBufferLayoutAttributesAndStepModeLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Vertex buffer layout and instance step mode preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>GPUVertexBufferLayout</strong>
            <span>buffer[0] 按 vertex 前进，buffer[1] 用 stepMode: "instance" 为每个实例提供 offset / scale / color。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>vertex stride</span><strong>24 bytes</strong></article>
          <article class="webgpu-api-metric"><span>instance stride</span><strong>32 bytes</strong></article>
          <article class="webgpu-api-metric"><span>shader locations</span><strong>0 / 1 / 2 / 3</strong></article>
          <article class="webgpu-api-metric"><span>step mode</span><strong>instance</strong></article>
        </div>
        <div class="webgpu-api-note">同一份 6 个顶点的菱形被绘制 18 次；变化都来自第二个 vertex buffer 的 instance-rate attributes。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Vertex layout lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-07-vertex-layout-pipeline",
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 24,
            stepMode: "vertex",
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x4" },
            ],
          },
          {
            arrayStride: 32,
            stepMode: "instance",
            attributes: [
              { shaderLocation: 2, offset: 0, format: "float32x4" },
              { shaderLocation: 3, offset: 16, format: "float32x4" },
            ],
          },
        ],
      },
      fragment: {
        module,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });

    const vertexData = new Float32Array([
      0.0, 0.52, 1.0, 1.0, 1.0, 1.0,
      -0.42, 0.0, 0.72, 0.95, 1.0, 1.0,
      0.0, -0.52, 0.36, 0.82, 1.0, 1.0,
      0.0, 0.52, 1.0, 1.0, 1.0, 1.0,
      0.0, -0.52, 0.36, 0.82, 1.0, 1.0,
      0.42, 0.0, 1.0, 0.72, 0.42, 1.0,
    ]);
    const instances: number[] = [];
    const colors = [
      [0.44, 0.83, 1.0, 1.0],
      [0.96, 0.72, 0.32, 1.0],
      [0.64, 1.0, 0.58, 1.0],
      [1.0, 0.55, 0.82, 1.0],
    ];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const x = -0.78 + col * 0.31;
        const y = -0.48 + row * 0.46;
        const scale = 0.16 + 0.025 * ((row + col) % 3);
        const color = colors[(row * 2 + col) % colors.length];
        instances.push(x, y, scale, scale, color[0], color[1], color[2], color[3]);
      }
    }

    const vertexBuffer = createMappedBuffer(
      gpu.device,
      "lesson-07-per-vertex-buffer",
      vertexData,
      GPUBufferUsage.VERTEX
    );
    const instanceBuffer = createMappedBuffer(
      gpu.device,
      "lesson-07-per-instance-buffer",
      new Float32Array(instances),
      GPUBufferUsage.VERTEX
    );

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-07-command-encoder" });
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
      pass.setVertexBuffer(1, instanceBuffer);
      pass.draw(6, instances.length / 8);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Vertex layout 已就绪",
      detail: "per-vertex attributes 与 per-instance attributes 正在通过两个 buffer 同时喂给同一条 pipeline。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      vertexBuffer.destroy();
      instanceBuffer.destroy();
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
