import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-09-index-buffer-drawindexed-and-index-format/index-buffer.wgsl?raw";

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

function makeBuffer(
  device: GPUDevice,
  label: string,
  data: Float32Array | Uint16Array | Uint32Array,
  usage: GPUBufferUsageFlags
) {
  const buffer = device.createBuffer({
    label,
    size: data.byteLength,
    usage,
    mappedAtCreation: true,
  });
  const mapped = buffer.getMappedRange();
  if (data instanceof Float32Array) {
    new Float32Array(mapped).set(data);
  } else if (data instanceof Uint16Array) {
    new Uint16Array(mapped).set(data);
  } else {
    new Uint32Array(mapped).set(data);
  }
  buffer.unmap();
  return buffer;
}

function setPanelViewport(pass: GPURenderPassEncoder, canvas: HTMLCanvasElement, panel: number) {
  const width = Math.floor(canvas.width / 3);
  const x = panel * width;
  const panelWidth = panel === 2 ? canvas.width - x : width;
  pass.setViewport(x, 0, panelWidth, canvas.height, 0, 1);
  pass.setScissorRect(x, 0, panelWidth, canvas.height);
}

export async function mountIndexBufferDrawIndexedAndIndexFormatLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Index buffer drawIndexed preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>draw vs drawIndexed</strong>
            <span>左：重复顶点直接 draw；中/右：setIndexBuffer 后用 uint16 / uint32 index format 复用顶点。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>non-indexed vertices</span><strong>6</strong></article>
          <article class="webgpu-api-metric"><span>indexed vertices</span><strong>4 unique</strong></article>
          <article class="webgpu-api-metric"><span>index count</span><strong>6</strong></article>
          <article class="webgpu-api-metric"><span>index format</span><strong>uint16 / uint32</strong></article>
        </div>
        <div class="webgpu-api-note">这个例子故意只画一个四边形：小到能看清 API，大到能体现共享顶点如何减少重复 vertex 数据。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Index buffer lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-06-index-buffer-pipeline",
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 20,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x3" },
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

    const duplicateVertices = new Float32Array([
      -0.62, -0.55, 0.32, 0.78, 1.0,
      0.62, -0.55, 1.0, 0.74, 0.36,
      0.58, 0.52, 0.35, 1.0, 0.66,
      -0.62, -0.55, 0.32, 0.78, 1.0,
      0.58, 0.52, 0.35, 1.0, 0.66,
      -0.58, 0.48, 0.94, 0.48, 1.0,
    ]);
    const uniqueVertices = new Float32Array([
      -0.62, -0.55, 0.32, 0.78, 1.0,
      0.62, -0.55, 1.0, 0.74, 0.36,
      0.58, 0.52, 0.35, 1.0, 0.66,
      -0.58, 0.48, 0.94, 0.48, 1.0,
    ]);
    const indices16 = new Uint16Array([0, 1, 2, 0, 2, 3]);
    const indices32 = new Uint32Array(indices16);

    const duplicateBuffer = makeBuffer(
      gpu.device,
      "lesson-06-non-indexed-vertices",
      duplicateVertices,
      GPUBufferUsage.VERTEX
    );
    const vertexBuffer = makeBuffer(
      gpu.device,
      "lesson-06-indexed-unique-vertices",
      uniqueVertices,
      GPUBufferUsage.VERTEX
    );
    const index16Buffer = makeBuffer(
      gpu.device,
      "lesson-06-index-buffer-u16",
      indices16,
      GPUBufferUsage.INDEX
    );
    const index32Buffer = makeBuffer(
      gpu.device,
      "lesson-06-index-buffer-u32",
      indices32,
      GPUBufferUsage.INDEX
    );

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-06-command-encoder" });
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
      setPanelViewport(pass, canvas, 0);
      pass.setVertexBuffer(0, duplicateBuffer);
      pass.draw(6);

      setPanelViewport(pass, canvas, 1);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(index16Buffer, "uint16");
      pass.drawIndexed(6);

      setPanelViewport(pass, canvas, 2);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(index32Buffer, "uint32");
      pass.drawIndexed(6);
      pass.end();

      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Index buffer 链路已就绪",
      detail: "非索引 draw、uint16 drawIndexed 与 uint32 drawIndexed 正在并排渲染。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      duplicateBuffer.destroy();
      vertexBuffer.destroy();
      index16Buffer.destroy();
      index32Buffer.destroy();
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
