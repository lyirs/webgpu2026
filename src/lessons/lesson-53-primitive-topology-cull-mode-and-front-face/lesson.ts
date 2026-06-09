import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-53-primitive-topology-cull-mode-and-front-face/primitive-state.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const listVertices = new Float32Array([
  -0.78, -0.62, 0, 0.2, 0.68, 1.0,
  -0.08, -0.54, 0, 0.2, 0.68, 1.0,
  -0.48, 0.52, 0, 0.2, 0.68, 1.0,
  0.1, -0.52, 0, 1.0, 0.6, 0.24,
  0.72, -0.58, 0, 1.0, 0.6, 0.24,
  0.46, 0.5, 0, 1.0, 0.6, 0.24,
]);

const stripVertices = new Float32Array([
  -0.72, -0.56, 0, 0.28, 0.84, 0.56,
  -0.42, 0.5, 0, 0.28, 0.84, 0.56,
  -0.08, -0.5, 0, 0.9, 0.54, 1.0,
  0.26, 0.46, 0, 0.9, 0.54, 1.0,
  0.72, -0.5, 0, 0.9, 0.54, 1.0,
]);

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

export async function mountPrimitiveTopologyCullModeAndFrontFaceLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Primitive topology and culling preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>primitive state controls assembly + culling</strong>
            <span>左：triangle-list / no cull，中：back cull / ccw，右：triangle-strip / cw</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-resource-grid">
          <article class="webgpu-api-resource"><span>topology</span><strong>triangle-list / triangle-strip</strong><small>决定顶点如何组装成图元</small></article>
          <article class="webgpu-api-resource"><span>cullMode</span><strong>none / back</strong><small>剔除背面能减少无用片元</small></article>
          <article class="webgpu-api-resource"><span>frontFace</span><strong>ccw / cw</strong><small>正面方向必须和网格绕序一致</small></article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Primitive state lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const shaderModule = gpu.device.createShaderModule({
      label: "lesson-31-primitive-state-shader",
      code: shaderSource,
    });
    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 24,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
      ],
    };
    const createPipeline = (
      topology: GPUPrimitiveTopology,
      cullMode: GPUCullMode,
      frontFace: GPUFrontFace
    ) =>
      gpu.device.createRenderPipeline({
        label: `lesson-31-${topology}-${cullMode}-${frontFace}`,
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vsMain",
          buffers: [vertexBufferLayout],
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fsMain",
          targets: [{ format: gpu.format }],
        },
        primitive: { topology, cullMode, frontFace },
      });

    const pipelines = [
      createPipeline("triangle-list", "none", "ccw"),
      createPipeline("triangle-list", "back", "ccw"),
      createPipeline("triangle-strip", "back", "cw"),
    ];
    const listBuffer = gpu.device.createBuffer({
      label: "lesson-31-list-vertices",
      size: listVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const stripBuffer = gpu.device.createBuffer({
      label: "lesson-31-strip-vertices",
      size: stripVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(listBuffer, 0, listVertices);
    gpu.device.queue.writeBuffer(stripBuffer, 0, stripVertices);

    let animationFrame = 0;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-31-command-encoder",
      });
      const pass = encoder.beginRenderPass({
        label: "lesson-31-primitive-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      const panelWidth = canvas.width / 3;
      pipelines.forEach((pipeline, index) => {
        pass.setViewport(index * panelWidth, 0, panelWidth, canvas.height, 0, 1);
        pass.setPipeline(pipeline);
        if (index < 2) {
          pass.setVertexBuffer(0, listBuffer);
          pass.draw(6);
        } else {
          pass.setVertexBuffer(0, stripBuffer);
          pass.draw(5);
        }
      });
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Primitive state 已就绪",
      detail: "三条 pipeline 使用不同 topology、cullMode 和 frontFace 显示同一批顶点的装配差异。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      listBuffer.destroy();
      stripBuffer.destroy();
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
