import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-21-texture-view-dimension-and-sample-type-compatibility/sample-type-compatibility.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const textureSize = 128;

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

function createRgba8Layer(layer = 0) {
  const bytesPerRow = alignTo(textureSize * 4, 256);
  const data = new Uint8Array(bytesPerRow * textureSize);
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const offset = y * bytesPerRow + x * 4;
      const stripe = (Math.floor(x / 12) + Math.floor(y / 12) + layer) % 2;
      data[offset] = layer === 0 ? 50 + stripe * 120 : 40;
      data[offset + 1] = layer === 1 ? 120 + stripe * 90 : 80 + y;
      data[offset + 2] = 210 - stripe * 70;
      data[offset + 3] = 255;
    }
  }
  return { data, bytesPerRow };
}

function createRgba32FloatTextureData() {
  const bytesPerRow = alignTo(textureSize * 16, 256);
  const floatsPerRow = bytesPerRow / 4;
  const data = new Float32Array(floatsPerRow * textureSize);
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const offset = y * floatsPerRow + x * 4;
      data[offset] = 0.2 + x / textureSize * 0.7;
      data[offset + 1] = 0.35 + y / textureSize * 0.45;
      data[offset + 2] = 0.95;
      data[offset + 3] = 1;
    }
  }
  return { data, bytesPerRow };
}

export async function mountTextureViewDimensionAndSampleTypeCompatibilityLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--sample-type">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Texture view dimension and sample type compatibility preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>viewDimension + sampleType must match the actual view</strong>
            <span>左：filterable 2d；中：2d-array layer；右：unfilterable-float。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>viewDimension</span><strong data-view-dimension>2d / 2d-array</strong></article>
          <article class="webgpu-api-metric"><span>sampleType</span><strong data-sample-type>float + unfilterable-float</strong></article>
          <article class="webgpu-api-metric"><span>filtering sampler</span><strong>rgba8unorm only</strong></article>
          <article class="webgpu-api-metric"><span>safe mismatch path</span><strong>explained, not submitted</strong></article>
        </div>
        <div class="webgpu-api-note">这节课不故意提交非法 bind group：不兼容组合用 HUD 解释，真实 pipeline 只绑定合法的 viewDimension/sampleType。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Sample type compatibility lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const filterableTexture = gpu.device.createTexture({
      label: "lesson-19-filterable-rgba8-texture",
      size: [textureSize, textureSize],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const arrayTexture = gpu.device.createTexture({
      label: "lesson-19-2d-array-texture",
      size: { width: textureSize, height: textureSize, depthOrArrayLayers: 2 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    const unfilterableTexture = gpu.device.createTexture({
      label: "lesson-19-unfilterable-rgba32float-texture",
      size: [textureSize, textureSize],
      format: "rgba32float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    const filterableData = createRgba8Layer(0);
    gpu.device.queue.writeTexture({ texture: filterableTexture }, filterableData.data, { bytesPerRow: filterableData.bytesPerRow }, { width: textureSize, height: textureSize });
    for (let layer = 0; layer < 2; layer += 1) {
      const layerData = createRgba8Layer(layer);
      gpu.device.queue.writeTexture({ texture: arrayTexture, origin: { x: 0, y: 0, z: layer } }, layerData.data, { bytesPerRow: layerData.bytesPerRow, rowsPerImage: textureSize }, { width: textureSize, height: textureSize, depthOrArrayLayers: 1 });
    }
    const floatData = createRgba32FloatTextureData();
    gpu.device.queue.writeTexture({ texture: unfilterableTexture }, floatData.data, { bytesPerRow: floatData.bytesPerRow }, { width: textureSize, height: textureSize });

    const bindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-19-explicit-sample-type-bgl",
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float", viewDimension: "2d" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float", viewDimension: "2d-array" } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "non-filtering" } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "unfilterable-float", viewDimension: "2d" } },
      ],
    });
    const pipelineLayout = gpu.device.createPipelineLayout({ label: "lesson-19-pipeline-layout", bindGroupLayouts: [bindGroupLayout] });
    const module = gpu.device.createShaderModule({ label: "lesson-19-sample-type-shader", code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-19-sample-type-pipeline",
      layout: pipelineLayout,
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-19-compatible-bind-group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: gpu.device.createSampler({ magFilter: "linear", minFilter: "linear" }) },
        { binding: 1, resource: filterableTexture.createView({ dimension: "2d" }) },
        { binding: 2, resource: arrayTexture.createView({ dimension: "2d-array", arrayLayerCount: 2 }) },
        { binding: 3, resource: gpu.device.createSampler({ magFilter: "nearest", minFilter: "nearest" }) },
        { binding: 4, resource: unfilterableTexture.createView({ dimension: "2d" }) },
      ],
    });

    let frameId = 0;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-19-command-encoder" });
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
    setStatus({ title: "Sample type compatibility", detail: "explicit BGL 成功绑定 2d / 2d-array / unfilterable-float 三条合法路径。", tone: "ok" });
    return () => cancelAnimationFrame(frameId);
  } catch (error) {
    setStatus({ title: "WebGPU 初始化失败", detail: error instanceof Error ? error.message : String(error), tone: "warn" });
  }
}
