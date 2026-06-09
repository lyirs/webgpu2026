import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-11-packed-vertex-formats-normalized-attributes-and-stride/packed-vertex.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type DemoVertex = {
  position: [number, number];
  normal: [number, number];
  color: [number, number, number, number];
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

function createBuffer(device: GPUDevice, label: string, bytes: ArrayBuffer) {
  const buffer = device.createBuffer({
    label,
    size: bytes.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(bytes));
  buffer.unmap();
  return buffer;
}

function packSnorm16(value: number) {
  return Math.max(-32768, Math.min(32767, Math.round(Math.max(-1, Math.min(1, value)) * 32767)));
}

function packUnorm8(value: number) {
  return Math.max(0, Math.min(255, Math.round(Math.max(0, Math.min(1, value)) * 255)));
}

function createFloatVertexBytes(vertices: DemoVertex[]) {
  const floats = new Float32Array(vertices.length * 8);
  vertices.forEach((vertex, index) => {
    const offset = index * 8;
    floats.set(vertex.position, offset);
    floats.set(vertex.normal, offset + 2);
    floats.set(vertex.color, offset + 4);
  });
  return floats.buffer;
}

function createPackedVertexBytes(vertices: DemoVertex[]) {
  const bytes = new ArrayBuffer(vertices.length * 16);
  const view = new DataView(bytes);
  vertices.forEach((vertex, index) => {
    const offset = index * 16;
    view.setFloat32(offset, vertex.position[0], true);
    view.setFloat32(offset + 4, vertex.position[1], true);
    view.setInt16(offset + 8, packSnorm16(vertex.normal[0]), true);
    view.setInt16(offset + 10, packSnorm16(vertex.normal[1]), true);
    view.setUint8(offset + 12, packUnorm8(vertex.color[0]));
    view.setUint8(offset + 13, packUnorm8(vertex.color[1]));
    view.setUint8(offset + 14, packUnorm8(vertex.color[2]));
    view.setUint8(offset + 15, packUnorm8(vertex.color[3]));
  });
  return bytes;
}

function createDemoVertices(centerX: number): DemoVertex[] {
  const top: DemoVertex = { position: [centerX, 0.58], normal: [0, 1], color: [0.42, 0.86, 1, 1] };
  const left: DemoVertex = { position: [centerX - 0.46, -0.42], normal: [-0.7, -0.2], color: [1, 0.66, 0.28, 1] };
  const right: DemoVertex = { position: [centerX + 0.46, -0.42], normal: [0.7, -0.2], color: [0.72, 1, 0.55, 1] };
  const inner: DemoVertex = { position: [centerX, -0.05], normal: [0, 0.8], color: [1, 0.93, 0.58, 1] };
  return [top, left, inner, top, inner, right, left, right, inner];
}

export async function mountPackedVertexFormatsNormalizedAttributesAndStrideLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--packed-vertex">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Packed vertex formats preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>float attributes vs packed normalized attributes</strong>
            <span>左侧 float32，右侧 unorm8x4 / snorm16x2；视觉一致，但 stride 从 32 bytes 降到 16 bytes。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>float stride</span><strong>32 bytes</strong></article>
          <article class="webgpu-api-metric"><span>packed stride</span><strong>16 bytes</strong></article>
          <article class="webgpu-api-metric"><span>packed normal</span><strong>snorm16x2</strong></article>
          <article class="webgpu-api-metric"><span>packed color</span><strong>unorm8x4</strong></article>
        </div>
        <div class="webgpu-api-note">normalized attribute 会在进入 WGSL 前自动解包到 0-1 或 -1-1 的 float 值，shader 不需要知道 CPU 侧用了更紧凑的格式。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Packed vertex lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ label: "lesson-10-packed-vertex-shader", code: shaderSource });
    const floatPipeline = gpu.device.createRenderPipeline({
      label: "lesson-10-float-vertex-pipeline",
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x2" },
              { shaderLocation: 2, offset: 16, format: "float32x4" },
            ],
          },
        ],
      },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const packedPipeline = gpu.device.createRenderPipeline({
      label: "lesson-10-packed-vertex-pipeline",
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 16,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "snorm16x2" },
              { shaderLocation: 2, offset: 12, format: "unorm8x4" },
            ],
          },
        ],
      },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });

    const floatBuffer = createBuffer(gpu.device, "lesson-10-float-vertex-buffer", createFloatVertexBytes(createDemoVertices(-0.48)));
    const packedBuffer = createBuffer(gpu.device, "lesson-10-packed-vertex-buffer", createPackedVertexBytes(createDemoVertices(0.48)));

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-10-command-encoder" });
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
      pass.setPipeline(floatPipeline);
      pass.setVertexBuffer(0, floatBuffer);
      pass.draw(9);
      pass.setPipeline(packedPipeline);
      pass.setVertexBuffer(0, packedBuffer);
      pass.draw(9);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    setStatus({
      title: "Packed vertex attributes 已就绪",
      detail: "两条 pipeline 使用同一 WGSL 输入，右侧通过 normalized packed format 自动解包。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      floatBuffer.destroy();
      packedBuffer.destroy();
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
