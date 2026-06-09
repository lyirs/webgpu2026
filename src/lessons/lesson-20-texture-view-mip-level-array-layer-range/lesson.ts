import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-20-texture-view-mip-level-array-layer-range/texture-view-range.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const baseSize = 128;
const mipCount = 4;
const layerCount = 4;

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

function alignTo(value: number, alignment: number) {
  return Math.ceil(value / alignment) * alignment;
}

function createMipLayerData(width: number, height: number, mip: number, layer: number) {
  const bytesPerRow = alignTo(width * 4, 256);
  const data = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * bytesPerRow + x * 4;
      const checker = (Math.floor(x / Math.max(1, 8 >> mip)) + Math.floor(y / Math.max(1, 8 >> mip))) % 2;
      data[offset] = 40 + layer * 48 + checker * 28;
      data[offset + 1] = 90 + mip * 42;
      data[offset + 2] = 210 - layer * 24 + checker * 18;
      data[offset + 3] = 255;
    }
  }
  return { data, bytesPerRow };
}

export async function mountTextureViewMipLevelArrayLayerRangeLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--view-range">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Texture view mip and layer range preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>createView({ baseMipLevel, baseArrayLayer })</strong>
            <span>左：完整 range view；中：selected mip view；右：selected layer view。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <button type="button" data-mip>切换 mip</button>
          <button type="button" data-layer>切换 layer</button>
        </div>
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>baseMipLevel</span><strong data-mip-value>0</strong></article>
          <article class="webgpu-api-metric"><span>mipLevelCount</span><strong>1 / 4</strong></article>
          <article class="webgpu-api-metric"><span>baseArrayLayer</span><strong data-layer-value>0</strong></article>
          <article class="webgpu-api-metric"><span>arrayLayerCount</span><strong>1 / 4</strong></article>
        </div>
        <div class="webgpu-api-note">同一张 GPUTexture 可以创建多个 GPUTextureView；view 决定 shader 看到哪一段 mip/layer range。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const mipButton = host.querySelector<HTMLButtonElement>("[data-mip]");
  const layerButton = host.querySelector<HTMLButtonElement>("[data-layer]");
  const mipValue = host.querySelector<HTMLElement>("[data-mip-value]");
  const layerValue = host.querySelector<HTMLElement>("[data-layer-value]");
  if (!canvas || !stage || !mipButton || !layerButton || !mipValue || !layerValue) {
    throw new Error("Texture view range lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const texture = gpu.device.createTexture({
      label: "lesson-18-mip-layer-texture",
      size: { width: baseSize, height: baseSize, depthOrArrayLayers: layerCount },
      mipLevelCount: mipCount,
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    for (let layer = 0; layer < layerCount; layer += 1) {
      for (let mip = 0; mip < mipCount; mip += 1) {
        const width = Math.max(1, baseSize >> mip);
        const height = Math.max(1, baseSize >> mip);
        const { data, bytesPerRow } = createMipLayerData(width, height, mip, layer);
        gpu.device.queue.writeTexture(
          { texture, mipLevel: mip, origin: { x: 0, y: 0, z: layer } },
          data,
          { bytesPerRow, rowsPerImage: height },
          { width, height, depthOrArrayLayers: 1 }
        );
      }
    }

    const sampler = gpu.device.createSampler({ magFilter: "nearest", minFilter: "nearest", mipmapFilter: "nearest" });
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-18-view-range-uniforms",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const module = gpu.device.createShaderModule({ label: "lesson-18-view-range-shader", code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-18-view-range-pipeline",
      layout: "auto",
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });

    let selectedMip = 0;
    let selectedLayer = 0;
    let bindGroup = gpu.device.createBindGroup({
      label: "lesson-18-view-range-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.createView({ dimension: "2d-array", baseMipLevel: 0, mipLevelCount: mipCount, baseArrayLayer: 0, arrayLayerCount: layerCount }) },
        { binding: 2, resource: texture.createView({ dimension: "2d", baseMipLevel: selectedMip, mipLevelCount: 1, baseArrayLayer: selectedLayer, arrayLayerCount: 1 }) },
        { binding: 3, resource: texture.createView({ dimension: "2d", baseMipLevel: 0, mipLevelCount: 1, baseArrayLayer: selectedLayer, arrayLayerCount: 1 }) },
        { binding: 4, resource: { buffer: uniformBuffer } },
      ],
    });

    const rebuildBindGroup = () => {
      bindGroup = gpu.device.createBindGroup({
        label: "lesson-18-view-range-bind-group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: texture.createView({ dimension: "2d-array", baseMipLevel: 0, mipLevelCount: mipCount, baseArrayLayer: 0, arrayLayerCount: layerCount }) },
          { binding: 2, resource: texture.createView({ dimension: "2d", baseMipLevel: selectedMip, mipLevelCount: 1, baseArrayLayer: selectedLayer, arrayLayerCount: 1 }) },
          { binding: 3, resource: texture.createView({ dimension: "2d", baseMipLevel: 0, mipLevelCount: 1, baseArrayLayer: selectedLayer, arrayLayerCount: 1 }) },
          { binding: 4, resource: { buffer: uniformBuffer } },
        ],
      });
    };

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      gpu.device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([selectedMip, selectedLayer, mipCount, layerCount]));
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-18-command-encoder" });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: gpu.context.getCurrentTexture().createView(),
          clearValue: { r: 0.02, g: 0.035, b: 0.06, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
      mipValue.textContent = String(selectedMip);
      layerValue.textContent = String(selectedLayer);
    };

    mipButton.addEventListener("click", () => {
      selectedMip = (selectedMip + 1) % mipCount;
      rebuildBindGroup();
      render();
    });
    layerButton.addEventListener("click", () => {
      selectedLayer = (selectedLayer + 1) % layerCount;
      rebuildBindGroup();
      render();
    });
    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    setStatus({ title: "Texture view range 已就绪", detail: "同一 texture 正在通过不同 mip/layer view 被采样。", tone: "ok" });

    return () => {
      resizeObserver.disconnect();
      texture.destroy();
      uniformBuffer.destroy();
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
