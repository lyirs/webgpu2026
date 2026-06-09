import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-32-viewport-scissor-and-render-pass-dynamic-state/viewport-scissor.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
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

function rectText(rect: Rect) {
  return `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
}

function setRect(pass: GPURenderPassEncoder, viewport: Rect, scissor: Rect) {
  pass.setViewport(viewport.x, viewport.y, viewport.width, viewport.height, 0, 1);
  pass.setScissorRect(
    Math.max(0, Math.floor(scissor.x)),
    Math.max(0, Math.floor(scissor.y)),
    Math.max(1, Math.floor(scissor.width)),
    Math.max(1, Math.floor(scissor.height))
  );
}

export async function mountViewportScissorAndRenderPassDynamicStateLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--viewport-scissor">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Viewport and scissor dynamic state preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>setViewport() + setScissorRect()</strong>
            <span>同一个 pass 内切换动态状态：左 full，中 viewport inset，右 scissor clipping。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>left viewport</span><strong data-left>pending</strong></article>
          <article class="webgpu-api-metric"><span>middle viewport</span><strong data-middle>pending</strong></article>
          <article class="webgpu-api-metric"><span>right scissor</span><strong data-right>pending</strong></article>
          <article class="webgpu-api-metric"><span>clipped pixels</span><strong data-clipped>pending</strong></article>
        </div>
        <div class="webgpu-api-note">viewport 改变 NDC 到像素的映射；scissor 是额外的像素裁剪盒，两者都是 render pass 内动态状态。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const leftLabel = host.querySelector<HTMLElement>("[data-left]");
  const middleLabel = host.querySelector<HTMLElement>("[data-middle]");
  const rightLabel = host.querySelector<HTMLElement>("[data-right]");
  const clippedLabel = host.querySelector<HTMLElement>("[data-clipped]");

  if (!canvas || !stage || !leftLabel || !middleLabel || !rightLabel || !clippedLabel) {
    throw new Error("Viewport/scissor lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-32-viewport-scissor-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const panelWidth = Math.floor(canvas.width / 3);
      const height = canvas.height;
      const leftViewport: Rect = { x: 0, y: 0, width: panelWidth, height };
      const middleViewport: Rect = {
        x: panelWidth + panelWidth * 0.12,
        y: height * 0.16,
        width: panelWidth * 0.76,
        height: height * 0.68,
      };
      const rightViewport: Rect = { x: panelWidth * 2, y: 0, width: canvas.width - panelWidth * 2, height };
      const rightScissor: Rect = {
        x: panelWidth * 2 + rightViewport.width * 0.24,
        y: height * 0.18,
        width: rightViewport.width * 0.52,
        height: height * 0.64,
      };

      leftLabel.textContent = rectText(leftViewport);
      middleLabel.textContent = rectText(middleViewport);
      rightLabel.textContent = rectText(rightScissor);
      clippedLabel.textContent = `${Math.round(rightViewport.width * rightViewport.height - rightScissor.width * rightScissor.height)}`;

      const encoder = gpu.device.createCommandEncoder({ label: "lesson-32-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.018, g: 0.028, b: 0.05, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      setRect(pass, leftViewport, leftViewport);
      pass.draw(3);
      setRect(pass, middleViewport, middleViewport);
      pass.draw(3);
      setRect(pass, rightViewport, rightScissor);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);

    setStatus({
      title: "Viewport / Scissor 已就绪",
      detail: "同一个 render pass 内多次切换 viewport 与 scissor，裁剪结果可直接观察。",
      tone: "ok",
    });

    return () => resizeObserver.disconnect();
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
