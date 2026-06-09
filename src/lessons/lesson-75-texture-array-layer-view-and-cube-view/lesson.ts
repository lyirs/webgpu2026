import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-75-texture-array-layer-view-and-cube-view/texture-views.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const textureSize = 128;
const layerCount = 6;

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

function createLayerData(layer: number) {
  const data = new Uint8Array(textureSize * textureSize * 4);
  const palette = [
    [239, 68, 68],
    [245, 158, 11],
    [34, 197, 94],
    [56, 189, 248],
    [129, 140, 248],
    [244, 114, 182],
  ];
  const color = palette[layer];
  for (let y = 0; y < textureSize; y += 1) {
    for (let x = 0; x < textureSize; x += 1) {
      const index = (y * textureSize + x) * 4;
      const checker = ((Math.floor(x / 16) + Math.floor(y / 16) + layer) % 2) * 42;
      data[index] = Math.min(255, color[0] + checker);
      data[index + 1] = Math.min(255, color[1] + checker);
      data[index + 2] = Math.min(255, color[2] + checker);
      data[index + 3] = 255;
    }
  }
  return data;
}

export async function mountTextureArrayLayerViewAndCubeViewLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Texture array layer and cube view preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>one texture, multiple view dimensions</strong>
            <span>左：2d-array，中：single layer 2d view，右：cube view</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-controls">
          <label>selected layer <input data-layer type="range" min="0" max="5" value="2" step="1" /></label>
        </div>
        <div class="webgpu-api-metrics" data-metrics></div>
        <div class="webgpu-api-note">同一个 <code>GPUTexture</code> 可以创建 <code>2d-array</code>、单层 <code>2d</code> 和 <code>cube</code> view；shader 绑定类型必须和 view dimension 对齐。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const layerInput = host.querySelector<HTMLInputElement>("[data-layer]");
  const metrics = host.querySelector<HTMLElement>("[data-metrics]");
  if (!canvas || !stage || !layerInput || !metrics) {
    throw new Error("Texture view lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const texture = gpu.device.createTexture({
      label: "lesson-44-layered-texture",
      size: { width: textureSize, height: textureSize, depthOrArrayLayers: layerCount },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    for (let layer = 0; layer < layerCount; layer += 1) {
      gpu.device.queue.writeTexture(
        { texture, origin: { x: 0, y: 0, z: layer } },
        createLayerData(layer),
        { bytesPerRow: textureSize * 4, rowsPerImage: textureSize },
        { width: textureSize, height: textureSize, depthOrArrayLayers: 1 }
      );
    }

    const shaderModule = gpu.device.createShaderModule({
      label: "lesson-44-texture-views-shader",
      code: shaderSource,
    });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-44-texture-views-pipeline",
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const sampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
    const arrayView = texture.createView({
      dimension: "2d-array",
      baseArrayLayer: 0,
      arrayLayerCount: layerCount,
    });
    const cubeView = texture.createView({
      dimension: "cube",
      baseArrayLayer: 0,
      arrayLayerCount: layerCount,
    });
    let selectedLayer = Number(layerInput.value);
    let bindGroup = gpu.device.createBindGroup({
      label: "lesson-44-texture-views-bind-group",
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: arrayView },
        {
          binding: 2,
          resource: texture.createView({
            dimension: "2d",
            baseArrayLayer: selectedLayer,
            arrayLayerCount: 1,
          }),
        },
        { binding: 3, resource: cubeView },
      ],
    });
    const refreshMetrics = () => {
      metrics.innerHTML = `
        <article class="webgpu-api-metric"><span>arrayLayerCount</span><strong>${layerCount}</strong></article>
        <article class="webgpu-api-metric"><span>baseArrayLayer</span><strong>${selectedLayer}</strong></article>
        <article class="webgpu-api-metric"><span>array view</span><strong>dimension: 2d-array</strong></article>
        <article class="webgpu-api-metric"><span>cube view</span><strong>dimension: cube</strong></article>
      `;
    };
    layerInput.addEventListener("input", () => {
      selectedLayer = Number(layerInput.value);
      bindGroup = gpu.device.createBindGroup({
        label: "lesson-44-texture-views-bind-group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: sampler },
          { binding: 1, resource: arrayView },
          {
            binding: 2,
            resource: texture.createView({
              dimension: "2d",
              baseArrayLayer: selectedLayer,
              arrayLayerCount: 1,
            }),
          },
          { binding: 3, resource: cubeView },
        ],
      });
      refreshMetrics();
    });
    refreshMetrics();

    let animationFrame = 0;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-44-command-encoder",
      });
      const pass = encoder.beginRenderPass({
        label: "lesson-44-texture-view-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.025, g: 0.035, b: 0.055, a: 1 },
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
      animationFrame = requestAnimationFrame(render);
    };

    render();
    setStatus({
      title: "Texture views 已就绪",
      detail: "同一 layered texture 已同时创建 2d-array、single-layer 2d 和 cube view。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      texture.destroy();
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
