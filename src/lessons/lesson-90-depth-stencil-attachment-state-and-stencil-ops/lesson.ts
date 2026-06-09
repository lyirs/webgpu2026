import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-90-depth-stencil-attachment-state-and-stencil-ops/stencil-state.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type DepthStencilTarget = {
  width: number;
  height: number;
  texture: GPUTexture;
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

function createFloatBuffer(device: GPUDevice, label: string, data: Float32Array, usage: GPUBufferUsageFlags) {
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

function setPanelViewport(pass: GPURenderPassEncoder, canvas: HTMLCanvasElement, panel: number) {
  const width = Math.floor(canvas.width / 3);
  const x = panel * width;
  const panelWidth = panel === 2 ? canvas.width - x : width;
  pass.setViewport(x, 0, panelWidth, canvas.height, 0, 1);
  pass.setScissorRect(x, 0, panelWidth, canvas.height);
}

function makeQuad(x0: number, y0: number, x1: number, y1: number, color: [number, number, number, number]) {
  return [
    x0, y0, ...color,
    x1, y0, ...color,
    x1, y1, ...color,
    x0, y0, ...color,
    x1, y1, ...color,
    x0, y1, ...color,
  ];
}

export async function mountDepthStencilAttachmentStateAndStencilOpsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Depth stencil attachment state and stencil ops preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>depth24plus-stencil8</strong>
            <span>左：无 stencil；中：stencil equal 只显示 reference=1 的区域；右：not-equal 反向显示外轮廓区域。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>format</span><strong>depth24plus-stencil8</strong></article>
          <article class="webgpu-api-metric"><span>stencil ref</span><strong>1</strong></article>
          <article class="webgpu-api-metric"><span>compare</span><strong>always / equal / not-equal</strong></article>
          <article class="webgpu-api-metric"><span>write mask</span><strong>0xff</strong></article>
        </div>
        <div class="webgpu-api-note">mask pass 用 pass.setStencilReference(1) 和 passOp: "replace" 写入模板值；后续 pass 只改变 stencil compare，就能得到裁剪或反选效果。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Stencil lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ code: shaderSource });
    const vertexLayout: GPUVertexBufferLayout = {
      arrayStride: 24,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x2" },
        { shaderLocation: 1, offset: 8, format: "float32x4" },
      ],
    };
    const createPipeline = (
      label: string,
      stencilFront: GPUStencilFaceState,
      writeMask = 0xff,
      colorWriteMask = 0xf
    ) =>
      gpu.device.createRenderPipeline({
        label,
        layout: "auto",
        vertex: { module, entryPoint: "vsMain", buffers: [vertexLayout] },
        fragment: {
          module,
          entryPoint: "fsMain",
          targets: [{ format: gpu.format, writeMask: colorWriteMask }],
        },
        primitive: { topology: "triangle-list" },
        depthStencil: {
          format: "depth24plus-stencil8",
          depthWriteEnabled: false,
          depthCompare: "always",
          stencilFront,
          stencilBack: stencilFront,
          stencilReadMask: 0xff,
          stencilWriteMask: writeMask,
        },
      });

    const drawPipeline = createPipeline("lesson-63-no-stencil-pipeline", {
      compare: "always",
      passOp: "keep",
    });
    const maskPipeline = createPipeline(
      "lesson-63-mask-write-pipeline",
      { compare: "always", passOp: "replace" },
      0xff,
      0
    );
    const equalPipeline = createPipeline("lesson-63-stencil-equal-pipeline", {
      compare: "equal",
      passOp: "keep",
    });
    const invertedPipeline = createPipeline("lesson-63-stencil-not-equal-pipeline", {
      compare: "not-equal",
      passOp: "keep",
    });

    const objectVertices = new Float32Array([
      ...makeQuad(-0.82, -0.68, 0.82, 0.68, [0.22, 0.78, 1.0, 1.0]),
      ...makeQuad(-0.44, -0.32, 0.44, 0.32, [1.0, 0.74, 0.28, 1.0]),
    ]);
    const maskVertices = new Float32Array([
      -0.38, -0.72, 1, 1, 1, 1,
      0.34, -0.72, 1, 1, 1, 1,
      0.62, 0.06, 1, 1, 1, 1,
      -0.38, -0.72, 1, 1, 1, 1,
      0.62, 0.06, 1, 1, 1, 1,
      -0.08, 0.74, 1, 1, 1, 1,
    ]);
    const objectBuffer = createFloatBuffer(
      gpu.device,
      "lesson-63-stencil-object-buffer",
      objectVertices,
      GPUBufferUsage.VERTEX
    );
    const maskBuffer = createFloatBuffer(
      gpu.device,
      "lesson-63-stencil-mask-buffer",
      maskVertices,
      GPUBufferUsage.VERTEX
    );

    let depthStencilTarget: DepthStencilTarget | null = null;
    const ensureDepthStencilTarget = () => {
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);
      if (depthStencilTarget && depthStencilTarget.width === width && depthStencilTarget.height === height) {
        return depthStencilTarget;
      }
      depthStencilTarget?.texture.destroy();
      depthStencilTarget = {
        width,
        height,
        texture: gpu.device.createTexture({
          label: "lesson-63-depth-stencil-target",
          size: { width, height },
          format: "depth24plus-stencil8",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        }),
      };
      return depthStencilTarget;
    };

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const target = ensureDepthStencilTarget();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-63-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: target.texture.createView(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "discard",
          stencilClearValue: 0,
          stencilLoadOp: "clear",
          stencilStoreOp: "store",
        },
      });

      pass.setStencilReference(1);
      pass.setPipeline(maskPipeline);
      pass.setVertexBuffer(0, maskBuffer);
      setPanelViewport(pass, canvas, 1);
      pass.draw(6);
      setPanelViewport(pass, canvas, 2);
      pass.draw(6);

      pass.setVertexBuffer(0, objectBuffer);
      setPanelViewport(pass, canvas, 0);
      pass.setPipeline(drawPipeline);
      pass.draw(12);

      setPanelViewport(pass, canvas, 1);
      pass.setPipeline(equalPipeline);
      pass.draw(12);

      setPanelViewport(pass, canvas, 2);
      pass.setPipeline(invertedPipeline);
      pass.draw(12);
      pass.end();

      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Depth/stencil attachment 已就绪",
      detail: "stencilFront/stencilBack、read/write mask 与 setStencilReference 正在真实 pass 中生效。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      objectBuffer.destroy();
      maskBuffer.destroy();
      depthStencilTarget?.texture.destroy();
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
