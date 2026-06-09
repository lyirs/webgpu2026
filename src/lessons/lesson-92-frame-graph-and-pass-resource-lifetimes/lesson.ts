import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-92-frame-graph-and-pass-resource-lifetimes/frame-graph.compute.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-92-frame-graph-and-pass-resource-lifetimes/frame-graph.present.wgsl?raw";
import sceneShaderSource from "@/lessons/lesson-92-frame-graph-and-pass-resource-lifetimes/frame-graph.scene.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type GraphResource = {
  name: string;
  reads: string[];
  writes: string[];
  lifetime: string;
};

const graphResources: GraphResource[] = [
  { name: "tileBuffer", reads: ["scene pass"], writes: ["compute pass"], lifetime: "frame persistent" },
  { name: "offscreenColor", reads: ["post pass"], writes: ["scene pass"], lifetime: "resize dependent" },
  { name: "depthTarget", reads: [], writes: ["scene pass"], lifetime: "resize dependent" },
  { name: "canvas", reads: [], writes: ["post pass"], lifetime: "current frame" },
];

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

function makeTimelineMarkup() {
  return graphResources
    .map(
      (resource) => `
        <article class="webgpu-api-resource">
          <strong>${resource.name}</strong>
          <span>write: ${resource.writes.join(", ") || "none"}</span>
          <span>read: ${resource.reads.join(", ") || "none"}</span>
          <em>${resource.lifetime}</em>
        </article>
      `
    )
    .join("");
}

export async function mountFrameGraphAndPassResourceLifetimesLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Frame graph preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>compute -> offscreen render -> post to canvas</strong>
            <span>frame graph 记录 pass 顺序与资源读写生命周期</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-timeline">
          <span class="webgpu-api-step">compute writes tileBuffer</span>
          <span class="webgpu-api-step">render writes offscreen/depth</span>
          <span class="webgpu-api-step">post samples offscreen</span>
        </div>
        <div class="webgpu-api-resource-grid">${makeTimelineMarkup()}</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Frame graph lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const tileBuffer = gpu.device.createBuffer({
      label: "lesson-48-tile-buffer",
      size: 16 * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    const sampler = gpu.device.createSampler({
      label: "lesson-48-present-sampler",
      magFilter: "linear",
      minFilter: "linear",
    });

    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-48-compute-pipeline",
      layout: "auto",
      compute: {
        module: gpu.device.createShaderModule({ code: computeShaderSource }),
        entryPoint: "csMain",
      },
    });
    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-48-scene-pipeline",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({ code: sceneShaderSource }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: sceneShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: "rgba8unorm" }],
      },
      primitive: { topology: "triangle-list" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-48-present-pipeline",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({ code: presentShaderSource }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: presentShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
    });
    const computeBindGroup = gpu.device.createBindGroup({
      label: "lesson-48-compute-bind-group",
      layout: computePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: tileBuffer } }],
    });
    const sceneBindGroup = gpu.device.createBindGroup({
      label: "lesson-48-scene-bind-group",
      layout: scenePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: tileBuffer } }],
    });

    let offscreenTexture: GPUTexture | null = null;
    let depthTexture: GPUTexture | null = null;
    let presentBindGroup: GPUBindGroup | null = null;

    const ensureTargets = () => {
      const width = Math.max(1, gpu.context.canvas.width);
      const height = Math.max(1, gpu.context.canvas.height);
      offscreenTexture?.destroy();
      depthTexture?.destroy();
      offscreenTexture = gpu.device.createTexture({
        label: "lesson-48-offscreen-color",
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      depthTexture = gpu.device.createTexture({
        label: "lesson-48-depth-target",
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      presentBindGroup = gpu.device.createBindGroup({
        label: "lesson-48-present-bind-group",
        layout: presentPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: offscreenTexture.createView() },
        ],
      });
    };

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      ensureTargets();
      if (!offscreenTexture || !depthTexture || !presentBindGroup) return;

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-48-frame-graph-command-encoder",
      });
      const computePass = commandEncoder.beginComputePass({
        label: "lesson-48-graph-compute-pass",
      });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(1);
      computePass.end();

      const scenePass = commandEncoder.beginRenderPass({
        label: "lesson-48-graph-scene-pass",
        colorAttachments: [
          {
            view: offscreenTexture.createView(),
            clearValue: { r: 0.018, g: 0.026, b: 0.044, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
      scenePass.setPipeline(scenePipeline);
      scenePass.setBindGroup(0, sceneBindGroup);
      scenePass.draw(16 * 6);
      scenePass.end();

      const postPass = commandEncoder.beginRenderPass({
        label: "lesson-48-graph-post-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      postPass.setPipeline(presentPipeline);
      postPass.setBindGroup(0, presentBindGroup);
      postPass.draw(6);
      postPass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Frame graph 已就绪",
      detail: "本课用 lesson-local graph 串起 compute、offscreen render 和 post pass 的资源读写。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      tileBuffer.destroy();
      offscreenTexture?.destroy();
      depthTexture?.destroy();
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
