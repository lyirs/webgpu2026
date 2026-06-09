import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-27-buffer-map-lifecycle-and-staging-patterns/staging-patterns.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const itemCount = 16;
const bufferSize = itemCount * 16;

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

function makeSamples(seed: number) {
  const values = new Float32Array(itemCount * 4);
  for (let index = 0; index < itemCount; index += 1) {
    const value = 0.18 + 0.72 * Math.abs(Math.sin(seed * 0.77 + index * 0.61));
    values[index * 4] = value;
    values[index * 4 + 1] = index / itemCount;
    values[index * 4 + 2] = 1;
    values[index * 4 + 3] = 1;
  }
  return values;
}

function checksum(values: Float32Array) {
  return values.reduce((sum, value) => sum + Math.round(value * 1000), 0);
}

export async function mountBufferMapLifecycleAndStagingPatternsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--staging">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Buffer map lifecycle and staging pattern preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>mappedAtCreation -> copy -> render -> MAP_READ</strong>
            <span>mapped buffer 只做 staging，真正渲染读 GPU-only uniform buffer。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <button type="button" data-upload>重新 map staging</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>upload path</span><strong>mappedAtCreation + unmap</strong></article>
          <article class="webgpu-api-metric"><span>device buffer</span><strong>UNIFORM | COPY_DST | COPY_SRC</strong></article>
          <article class="webgpu-api-metric"><span>readback</span><strong>MAP_READ | COPY_DST</strong></article>
          <article class="webgpu-api-metric"><span>checksum</span><strong data-checksum>pending</strong></article>
        </div>
        <div class="webgpu-api-note">MAP_WRITE / MAP_READ buffer 不直接参与 shader 读写；它们通过 copyBufferToBuffer 做 staging 上传和 readback。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const uploadButton = host.querySelector<HTMLButtonElement>("[data-upload]");
  const checksumLabel = host.querySelector<HTMLElement>("[data-checksum]");
  if (!canvas || !stage || !uploadButton || !checksumLabel) {
    throw new Error("Staging pattern lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ label: "lesson-25-staging-shader", code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-25-staging-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const deviceBuffer = gpu.device.createBuffer({
      label: "lesson-25-device-local-uniform-buffer",
      size: bufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    });
    const readbackBuffer = gpu.device.createBuffer({
      label: "lesson-25-map-readback-buffer",
      size: bufferSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-25-uniform-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: deviceBuffer } }],
    });

    let seed = 1;
    let frameId = 0;
    let readbackBusy = false;
    let needsUpload = true;

    const uploadAndReadback = async () => {
      if (readbackBusy) return;
      readbackBusy = true;
      const values = makeSamples(seed);
      const staging = gpu.device.createBuffer({
        label: "lesson-25-map-write-staging-buffer",
        size: bufferSize,
        usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
        mappedAtCreation: true,
      });
      new Float32Array(staging.getMappedRange()).set(values);
      staging.unmap();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-25-staging-copy-encoder" });
      encoder.copyBufferToBuffer(staging, 0, deviceBuffer, 0, bufferSize);
      encoder.copyBufferToBuffer(deviceBuffer, 0, readbackBuffer, 0, bufferSize);
      gpu.device.queue.submit([encoder.finish()]);
      await readbackBuffer.mapAsync(GPUMapMode.READ);
      const readback = new Float32Array(readbackBuffer.getMappedRange().slice(0));
      readbackBuffer.unmap();
      staging.destroy();
      checksumLabel.textContent = `${checksum(readback)} / ${checksum(values)}`;
      readbackBusy = false;
    };

    uploadButton.addEventListener("click", () => {
      seed += 1;
      needsUpload = true;
    });

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      if (needsUpload && !readbackBusy) {
        needsUpload = false;
        void uploadAndReadback();
      }
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-25-render-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: gpu.context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0.02, g: 0.04, b: 0.08, a: 1 } }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      frameId = requestAnimationFrame(render);
    };
    render();
    setStatus({ title: "Map lifecycle", detail: "mappedAtCreation staging 上传、GPU-only uniform 渲染、MAP_READ readback 校验已串起来。", tone: "ok" });
    return () => cancelAnimationFrame(frameId);
  } catch (error) {
    setStatus({ title: "WebGPU 初始化失败", detail: error instanceof Error ? error.message : String(error), tone: "warn" });
  }
}
