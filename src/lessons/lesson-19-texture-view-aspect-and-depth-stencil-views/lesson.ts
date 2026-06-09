import shaderSource from "@/lessons/lesson-19-texture-view-aspect-and-depth-stencil-views/aspect-views.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type DepthStencilTarget = {
  texture: GPUTexture | null;
  size: [number, number];
  fullView: GPUTextureView | null;
  depthOnlyView: GPUTextureView | null;
  stencilOnlyView: GPUTextureView | null;
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

function destroyTarget(target: DepthStencilTarget) {
  target.texture?.destroy();
  target.texture = null;
  target.fullView = null;
  target.depthOnlyView = null;
  target.stencilOnlyView = null;
  target.size = [0, 0];
}

function ensureDepthStencilTarget(
  device: GPUDevice,
  target: DepthStencilTarget,
  width: number,
  height: number
) {
  if (target.texture && target.size[0] === width && target.size[1] === height) {
    return target;
  }

  destroyTarget(target);
  const texture = device.createTexture({
    label: "lesson-15-depth-stencil-texture",
    size: [width, height],
    format: "depth24plus-stencil8",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  });

  target.texture = texture;
  target.size = [width, height];
  target.fullView = texture.createView({ label: "lesson-15-full-depth-stencil-view" });
  target.depthOnlyView = texture.createView({
    label: "lesson-15-depth-only-view",
    aspect: "depth-only",
  });
  target.stencilOnlyView = texture.createView({
    label: "lesson-15-stencil-only-view",
    aspect: "stencil-only",
  });
  return target;
}

export async function mountTextureViewAspectAndDepthStencilViewsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--aspect-view">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Texture view aspect preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>depth24plus-stencil8 -> aspect views</strong>
            <span>左侧是 sampled depth-only view，右侧标出 stencil-only view 的创建语义。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>format</span><strong>depth24plus-stencil8</strong></article>
          <article class="webgpu-api-metric"><span>depth view</span><strong data-depth>pending</strong></article>
          <article class="webgpu-api-metric"><span>stencil view</span><strong data-stencil>pending</strong></article>
        </div>
        <div class="webgpu-api-note" data-note>同一张 GPUTexture 可以用 createView({ aspect }) 暴露不同解释方式。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const depthLabel = host.querySelector<HTMLElement>("[data-depth]");
  const stencilLabel = host.querySelector<HTMLElement>("[data-stencil]");
  const note = host.querySelector<HTMLElement>("[data-note]");
  if (!canvas || !stage || !depthLabel || !stencilLabel || !note) {
    throw new Error("Texture aspect lesson DOM 初始化失败。");
  }

  try {
    if (!navigator.gpu) {
      throw new Error("当前浏览器没有提供 WebGPU。");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("没有拿到可用的 GPUAdapter。");
    }
    const device = await adapter.requestDevice({ label: "lesson-15-aspect-device" });
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("没有拿到 WebGPUCanvasContext。");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    const shaderModule = device.createShaderModule({ code: shaderSource });
    const depthPipeline = device.createRenderPipeline({
      label: "lesson-15-depth-write-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsDepth" },
      depthStencil: {
        format: "depth24plus-stencil8",
        depthWriteEnabled: true,
        depthCompare: "less",
        stencilFront: { compare: "always", passOp: "replace" },
        stencilBack: { compare: "always", passOp: "replace" },
      },
    });
    const presentPipeline = device.createRenderPipeline({
      label: "lesson-15-depth-present-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsFullscreen" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsPresent",
        targets: [{ format }],
      },
    });
    const target: DepthStencilTarget = {
      texture: null,
      size: [0, 0],
      fullView: null,
      depthOnlyView: null,
      stencilOnlyView: null,
    };
    let bindGroup: GPUBindGroup | null = null;
    let bindGroupSize = "";

    const render = () => {
      syncApiViewport(host, stage);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
      context.configure({ device, format, alphaMode: "opaque" });
      const currentTarget = ensureDepthStencilTarget(device, target, canvas.width, canvas.height);
      if (!currentTarget.fullView || !currentTarget.depthOnlyView || !currentTarget.stencilOnlyView) {
        return;
      }

      const nextSize = `${canvas.width}x${canvas.height}`;
      if (!bindGroup || bindGroupSize !== nextSize) {
        bindGroup = device.createBindGroup({
          label: "lesson-15-depth-present-bind-group",
          layout: presentPipeline.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: currentTarget.depthOnlyView }],
        });
        bindGroupSize = nextSize;
      }

      const commandEncoder = device.createCommandEncoder({ label: "lesson-15-command-encoder" });
      const depthPass = commandEncoder.beginRenderPass({
        label: "lesson-15-depth-stencil-pass",
        colorAttachments: [],
        depthStencilAttachment: {
          view: currentTarget.fullView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
          stencilClearValue: 0,
          stencilLoadOp: "clear",
          stencilStoreOp: "store",
        },
      });
      depthPass.setPipeline(depthPipeline);
      depthPass.setStencilReference(1);
      depthPass.draw(9);
      depthPass.end();

      const presentPass = commandEncoder.beginRenderPass({
        label: "lesson-15-present-pass",
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.028, b: 0.05, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      presentPass.setPipeline(presentPipeline);
      presentPass.setBindGroup(0, bindGroup);
      presentPass.draw(3);
      presentPass.end();
      device.queue.submit([commandEncoder.finish()]);

      depthLabel.textContent = "sampled";
      stencilLabel.textContent = "created";
      note.textContent = `full/depth-only/stencil-only views 都来自 ${nextSize} 的同一张 depth-stencil texture。`;
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    setStatus({
      title: "Depth/Stencil aspect views 已创建",
      detail: "render pass 写完整 view，present pass 采样 depth-only view。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      destroyTarget(target);
      device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
