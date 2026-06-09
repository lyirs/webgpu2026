import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-97-occlusion-query-and-visibility-feedback/occlusion-feedback.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type QueryReadback = {
  buffer: GPUBuffer;
  pending: boolean;
  frame: number;
};

const queryCount = 2;
const queryBytes = queryCount * 8;
const occluderBounds = { minX: -0.52, maxX: 0.16 };
const movingTargetHalfWidth = 0.22;

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

function ensureDepthTarget(device: GPUDevice, target: DepthTarget, width: number, height: number) {
  if (target.texture && target.width === width && target.height === height) {
    return;
  }
  target.texture?.destroy();
  target.texture = device.createTexture({
    label: "lesson-59-depth-target",
    size: [width, height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  target.view = target.texture.createView();
  target.width = width;
  target.height = height;
}

function getMovingTargetState(timeSeconds: number) {
  const phase = (Math.sin(timeSeconds * 0.9 - Math.PI / 2) + 1) * 0.5;
  const centerX = -0.72 + phase * 1.28;
  const minX = centerX - movingTargetHalfWidth;
  const maxX = centerX + movingTargetHalfWidth;
  const fullyBehindOccluder = minX >= occluderBounds.minX && maxX <= occluderBounds.maxX;
  return {
    centerX,
    fullyBehindOccluder,
  };
}

export async function mountOcclusionQueryAndVisibilityFeedbackLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Occlusion query visibility feedback preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>occlusion query is delayed feedback</strong>
            <span>移动目标本帧提交 query；旧 readback 结果驱动当前 tint。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-timeline">
          <span class="webgpu-api-step">beginOcclusionQuery</span>
          <span class="webgpu-api-step">draw tested object</span>
          <span class="webgpu-api-step">resolveQuerySet</span>
          <span class="webgpu-api-step">copyBufferToBuffer</span>
          <span class="webgpu-api-step">mapAsync next frame</span>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>moving target now</span><strong data-current>moving</strong></article>
          <article class="webgpu-api-metric"><span>moving target samples</span><strong data-hidden>pending</strong></article>
          <article class="webgpu-api-metric"><span>reference samples</span><strong data-side>pending</strong></article>
          <article class="webgpu-api-metric"><span>feedback age</span><strong data-age>pending</strong></article>
          <article class="webgpu-api-metric"><span>pending map</span><strong data-pending>0</strong></article>
        </div>
        <div class="webgpu-api-note">深色板先写 depth；移动目标在 query 区间绘制。青色表示上一轮 query 认为它可见，红色表示上一轮 query 认为它被遮挡。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const hiddenLabel = host.querySelector<HTMLElement>("[data-hidden]");
  const sideLabel = host.querySelector<HTMLElement>("[data-side]");
  const currentLabel = host.querySelector<HTMLElement>("[data-current]");
  const ageLabel = host.querySelector<HTMLElement>("[data-age]");
  const pendingLabel = host.querySelector<HTMLElement>("[data-pending]");
  if (!canvas || !stage || !hiddenLabel || !sideLabel || !currentLabel || !ageLabel || !pendingLabel) {
    throw new Error("Occlusion query lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const feedbackBuffer = gpu.device.createBuffer({
      label: "lesson-59-feedback-buffer",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-59-occlusion-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-59-feedback-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: feedbackBuffer } }],
    });
    const querySet = gpu.device.createQuerySet({
      label: "lesson-59-occlusion-query-set",
      type: "occlusion",
      count: queryCount,
    });
    const resolveBuffer = gpu.device.createBuffer({
      label: "lesson-59-query-resolve-buffer",
      size: queryBytes,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    const readback: QueryReadback = {
      buffer: gpu.device.createBuffer({
        label: "lesson-59-query-readback-buffer",
        size: queryBytes,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      }),
      pending: false,
      frame: 0,
    };
    const depthTarget: DepthTarget = { texture: null, view: null, width: 0, height: 0 };
    let hiddenSamples = 0n;
    let sideSamples = 0n;
    let frame = 0;
    let disposed = false;
    let animationFrame = 0;

    const consumeReadback = async () => {
      readback.pending = true;
      pendingLabel.textContent = "1";
      try {
        await readback.buffer.mapAsync(GPUMapMode.READ);
        const values = new BigUint64Array(readback.buffer.getMappedRange());
        hiddenSamples = values[0];
        sideSamples = values[1];
        readback.buffer.unmap();
        readback.pending = false;
        if (!disposed) {
          hiddenLabel.textContent = `${hiddenSamples}`;
          sideLabel.textContent = `${sideSamples}`;
          ageLabel.textContent = `${Math.max(0, frame - readback.frame)} frame(s)`;
          pendingLabel.textContent = "0";
        }
      } catch {
        readback.pending = false;
        if (!disposed) {
          pendingLabel.textContent = "0";
        }
      }
    };

    const render = (time: number) => {
      syncApiViewport(host, stage);
      gpu.resize();
      ensureDepthTarget(gpu.device, depthTarget, canvas.width, canvas.height);
      if (!depthTarget.view) {
        return;
      }
      frame += 1;
      const timeSeconds = time * 0.001;
      const targetState = getMovingTargetState(timeSeconds);
      currentLabel.textContent = targetState.fullyBehindOccluder ? "behind occluder" : "visible area";
      const hiddenVisible = hiddenSamples > 0n ? 1 : 0;
      const sideVisible = sideSamples > 0n ? 1 : 0;
      gpu.device.queue.writeBuffer(feedbackBuffer, 0, new Float32Array([hiddenVisible, sideVisible, timeSeconds, 0]));
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-59-command-encoder" });
      const pass = encoder.beginRenderPass({
        label: "lesson-59-render-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthTarget.view,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
        occlusionQuerySet: querySet,
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(6, 1, 0, 0);
      pass.beginOcclusionQuery(0);
      pass.draw(6, 1, 0, 1);
      pass.endOcclusionQuery();
      pass.beginOcclusionQuery(1);
      pass.draw(6, 1, 0, 2);
      pass.endOcclusionQuery();
      pass.end();
      encoder.resolveQuerySet(querySet, 0, queryCount, resolveBuffer, 0);
      if (!readback.pending) {
        readback.frame = frame;
        encoder.copyBufferToBuffer(resolveBuffer, 0, readback.buffer, 0, queryBytes);
      }
      gpu.device.queue.submit([encoder.finish()]);
      if (!readback.pending) {
        void consumeReadback();
      }
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    setStatus({
      title: "Occlusion query feedback 已就绪",
      detail: "query 结果经 resolve/readback 延迟回到 CPU，用上一帧结果驱动反馈显示。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      feedbackBuffer.destroy();
      querySet.destroy();
      resolveBuffer.destroy();
      readback.buffer.destroy();
      depthTarget.texture?.destroy();
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
