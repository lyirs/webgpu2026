import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-25-bind-group-reuse-resource-lifetime-and-rebinding/bind-reuse.wgsl?raw";

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

function createDemoTexture(device: GPUDevice, label: string, warm: boolean) {
  const size = 4;
  const bytesPerRow = 256;
  const data = new Uint8Array(bytesPerRow * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = y * bytesPerRow + x * 4;
      const even = (x + y) % 2 === 0;
      data[offset] = warm ? (even ? 255 : 180) : (even ? 42 : 20);
      data[offset + 1] = warm ? (even ? 175 : 105) : (even ? 220 : 145);
      data[offset + 2] = warm ? (even ? 70 : 35) : (even ? 255 : 190);
      data[offset + 3] = 255;
    }
  }
  const texture = device.createTexture({
    label,
    size: [size, size],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture },
    data,
    { bytesPerRow, rowsPerImage: size },
    { width: size, height: size }
  );
  return texture;
}

export async function mountBindGroupReuseResourceLifetimeAndRebindingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--bind-reuse">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Bind group reuse and rebinding preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>same bind group, mutable buffer contents</strong>
            <span>uniform buffer 每帧 writeBuffer；只有切换 texture view 时才重建 GPUBindGroup。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <button type="button" data-texture-toggle>切换 texture view 并 rebind</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>bind group reuse</span><strong data-reuse>0</strong></article>
          <article class="webgpu-api-metric"><span>rebind count</span><strong data-rebind>1</strong></article>
          <article class="webgpu-api-metric"><span>buffer update</span><strong>queue.writeBuffer</strong></article>
          <article class="webgpu-api-metric"><span>texture view</span><strong data-texture>warm</strong></article>
        </div>
        <div class="webgpu-api-note">GPUBindGroup 本身不可变：binding 指向哪张 texture view 创建后不能改；但它引用的 GPUBuffer 内容可以继续被 queue.writeBuffer 更新。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const toggle = host.querySelector<HTMLButtonElement>("[data-texture-toggle]");
  const reuseValue = host.querySelector<HTMLElement>("[data-reuse]");
  const rebindValue = host.querySelector<HTMLElement>("[data-rebind]");
  const textureValue = host.querySelector<HTMLElement>("[data-texture]");
  if (!canvas || !stage || !toggle || !reuseValue || !rebindValue || !textureValue) {
    throw new Error("Bind group reuse lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ label: "lesson-21-bind-reuse-shader", code: shaderSource });
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-21-mutable-uniform-buffer",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const warmTexture = createDemoTexture(gpu.device, "lesson-21-warm-texture", true);
    const coolTexture = createDemoTexture(gpu.device, "lesson-21-cool-texture", false);
    const sampler = gpu.device.createSampler({
      label: "lesson-21-reused-sampler",
      magFilter: "nearest",
      minFilter: "nearest",
    });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-21-bind-reuse-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });

    let useWarmTexture = true;
    let rebindCount = 1;
    let reuseCount = 0;
    let animationFrame = 0;
    const startedAt = performance.now();
    const createBindGroup = () =>
      gpu.device.createBindGroup({
        label: `lesson-21-bind-group-${useWarmTexture ? "warm" : "cool"}`,
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: sampler },
          { binding: 2, resource: (useWarmTexture ? warmTexture : coolTexture).createView() },
        ],
      });
    let bindGroup = createBindGroup();

    toggle.addEventListener("click", () => {
      useWarmTexture = !useWarmTexture;
      bindGroup = createBindGroup();
      rebindCount += 1;
      textureValue.textContent = useWarmTexture ? "warm" : "cool";
      rebindValue.textContent = String(rebindCount);
    });

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const time = (performance.now() - startedAt) / 1000;
      gpu.device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([time, Math.sin(time) * 0.5 + 0.5, useWarmTexture ? 0 : 1, 0]));
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-21-command-encoder" });
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
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      reuseCount += 1;
      reuseValue.textContent = String(reuseCount);
      animationFrame = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Bind group reuse 已就绪",
      detail: "同一 bind group 正在跨帧复用；切换 texture view 时才触发 rebind。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      uniformBuffer.destroy();
      warmTexture.destroy();
      coolTexture.destroy();
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
