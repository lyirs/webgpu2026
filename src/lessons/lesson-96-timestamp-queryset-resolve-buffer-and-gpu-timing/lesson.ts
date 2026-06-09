import shaderSource from "@/lessons/lesson-96-timestamp-queryset-resolve-buffer-and-gpu-timing/timestamp-query.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type TimestampGpu = {
  device: GPUDevice;
  supportsTimestamp: boolean;
};

async function createTimestampDevice(): Promise<TimestampGpu> {
  if (!navigator.gpu) {
    throw new Error("当前浏览器没有提供 WebGPU。");
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("没有拿到可用的 GPUAdapter。");
  }
  const supportsTimestamp = adapter.features.has("timestamp-query");
  try {
    const device = await adapter.requestDevice({
      label: "lesson-77-timestamp-device",
      requiredFeatures: supportsTimestamp ? ["timestamp-query"] : [],
    });
    return { device, supportsTimestamp };
  } catch {
    const device = await adapter.requestDevice({ label: "lesson-77-fallback-device" });
    return { device, supportsTimestamp: false };
  }
}

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

export async function mountTimestampQuerySetResolveBufferAndGpuTimingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--timestamp-query">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Timestamp query preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>timestampWrites -> resolveQuerySet -> mapAsync</strong>
            <span>GPU 时间必须经过 resolve/copy/readback，不能在 pass 内同步拿到。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-timeline">
          <span class="webgpu-api-step">GPUQuerySet</span>
          <span class="webgpu-api-step">timestampWrites</span>
          <span class="webgpu-api-step">resolveQuerySet</span>
          <span class="webgpu-api-step">copyBufferToBuffer</span>
          <span class="webgpu-api-step">mapAsync</span>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>timestamp-query</span><strong data-support>checking</strong></article>
          <article class="webgpu-api-metric"><span>GPU pass time</span><strong data-gpu-ms>--</strong></article>
          <article class="webgpu-api-metric"><span>readback frames</span><strong data-readbacks>0</strong></article>
        </div>
        <div class="webgpu-api-note" data-note>等待 timestamp query 结果...</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const supportLabel = host.querySelector<HTMLElement>("[data-support]");
  const gpuMsLabel = host.querySelector<HTMLElement>("[data-gpu-ms]");
  const readbackLabel = host.querySelector<HTMLElement>("[data-readbacks]");
  const note = host.querySelector<HTMLElement>("[data-note]");
  if (!canvas || !stage || !supportLabel || !gpuMsLabel || !readbackLabel || !note) {
    throw new Error("Timestamp query lesson DOM 初始化失败。");
  }

  try {
    const { device, supportsTimestamp } = await createTimestampDevice();
    const context = canvas.getContext("webgpu");
    if (!context) {
      throw new Error("没有拿到 WebGPUCanvasContext。");
    }
    const format = navigator.gpu.getPreferredCanvasFormat();
    const shaderModule = device.createShaderModule({ code: shaderSource });
    const pipeline = device.createRenderPipeline({
      label: "lesson-77-timestamp-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format }],
      },
    });
    const querySet = supportsTimestamp
      ? device.createQuerySet({ label: "lesson-77-timestamp-query-set", type: "timestamp", count: 2 })
      : null;
    const resolveBuffer = supportsTimestamp
      ? device.createBuffer({
          label: "lesson-77-query-resolve-buffer",
          size: 256,
          usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
        })
      : null;
    const readbackBuffer = supportsTimestamp
      ? device.createBuffer({
          label: "lesson-77-query-readback-buffer",
          size: 16,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        })
      : null;

    let disposed = false;
    let pendingReadback = false;
    let readbackCount = 0;
    supportLabel.textContent = supportsTimestamp ? "enabled" : "unsupported";
    note.textContent = supportsTimestamp
      ? "timestamp query 已启用，等待第一帧 readback。"
      : "当前 adapter 不支持 timestamp-query，仍会渲染 fallback 预览。";

    const readback = async () => {
      if (!readbackBuffer) {
        return;
      }
      try {
        await device.queue.onSubmittedWorkDone();
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        const mappedRange = readbackBuffer.getMappedRange();
        const timestamps = new BigUint64Array(mappedRange.slice(0));
        readbackBuffer.unmap();
        if (disposed || timestamps.length < 2) {
          return;
        }
        const deltaMs = Number(timestamps[1] - timestamps[0]) / 1_000_000;
        gpuMsLabel.textContent = Number.isFinite(deltaMs) ? `${deltaMs.toFixed(3)} ms` : "--";
        readbackCount += 1;
        readbackLabel.textContent = `${readbackCount}`;
        note.textContent = "querySet 结果已经 resolve/copy/map，HUD 显示的是上一轮 GPU pass 的时间。";
      } catch (error) {
        if (!disposed) {
          note.textContent = error instanceof Error ? error.message : "timestamp readback 失败。";
        }
      } finally {
        pendingReadback = false;
      }
    };

    const render = () => {
      if (disposed) {
        return;
      }
      syncApiViewport(host, stage);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
      canvas.height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));
      context.configure({ device, format, alphaMode: "opaque" });

      const commandEncoder = device.createCommandEncoder({ label: "lesson-77-command-encoder" });
      const passDescriptor: GPURenderPassDescriptor = {
        label: "lesson-77-render-pass",
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.018, g: 0.032, b: 0.062, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      };
      const shouldWriteTimestamp = Boolean(querySet && !pendingReadback);
      if (querySet && shouldWriteTimestamp) {
        passDescriptor.timestampWrites = {
          querySet,
          beginningOfPassWriteIndex: 0,
          endOfPassWriteIndex: 1,
        };
      }
      const pass = commandEncoder.beginRenderPass(passDescriptor);
      pass.setPipeline(pipeline);
      pass.draw(6);
      pass.end();

      if (querySet && resolveBuffer && readbackBuffer && shouldWriteTimestamp) {
        commandEncoder.resolveQuerySet(querySet, 0, 2, resolveBuffer, 0);
        commandEncoder.copyBufferToBuffer(resolveBuffer, 0, readbackBuffer, 0, 16);
        pendingReadback = true;
      }

      device.queue.submit([commandEncoder.finish()]);
      if (shouldWriteTimestamp) {
        void readback();
      }
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    setStatus({
      title: supportsTimestamp ? "Timestamp query 已启用" : "Timestamp query fallback",
      detail: supportsTimestamp ? "本课会持续 resolve/readback GPU pass 时间。" : "当前设备不支持 timestamp-query，保留 API fallback 说明。",
      tone: supportsTimestamp ? "ok" : "warn",
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      querySet?.destroy();
      resolveBuffer?.destroy();
      readbackBuffer?.destroy();
      device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
