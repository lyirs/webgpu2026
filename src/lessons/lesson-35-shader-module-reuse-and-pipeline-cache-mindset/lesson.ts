import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-35-shader-module-reuse-and-pipeline-cache-mindset/module-reuse.wgsl?raw";

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

export async function mountShaderModuleReuseAndPipelineCacheMindsetLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--pipeline-cache">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Shader module reuse and pipeline cache preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>one GPUShaderModule, shared layout, multiple pipelines</strong>
            <span>同一 shader module 通过不同 pipeline constants 创建多条 pipeline；layout 被 render/compute 共用。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>shader modules</span><strong>1</strong></article>
          <article class="webgpu-api-metric"><span>render pipelines</span><strong>3</strong></article>
          <article class="webgpu-api-metric"><span>compute pipelines</span><strong>1</strong></article>
          <article class="webgpu-api-metric"><span>pipelineLayout</span><strong>shared</strong></article>
        </div>
        <div class="webgpu-api-note">WebGPU 不暴露显式 pipeline cache 对象，但工程上仍应复用 shader module、bind group layout 和 pipeline layout，避免重复创建。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  if (!canvas || !stage) {
    throw new Error("Pipeline cache lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ label: "lesson-30-shared-shader-module", code: shaderSource });
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-30-cache-stats-uniform",
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const storageBuffer = gpu.device.createBuffer({
      label: "lesson-30-compute-output",
      size: 16,
      usage: GPUBufferUsage.STORAGE,
    });
    const bindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-30-shared-bind-group-layout",
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      ],
    });
    const pipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-30-shared-pipeline-layout",
      bindGroupLayouts: [bindGroupLayout],
    });
    const renderPipelines = [0, 1, 2].map((mode) => gpu.device.createRenderPipeline({
      label: `lesson-30-render-pipeline-mode-${mode}`,
      layout: pipelineLayout,
      vertex: { module, entryPoint: "vsMain" },
      fragment: { module, entryPoint: "fsMain", constants: { MODE: mode }, targets: [{ format: gpu.format }] },
    }));
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-30-compute-pipeline-same-module",
      layout: pipelineLayout,
      compute: { module, entryPoint: "csMain", constants: { MODE: 2 } },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-30-shared-bind-group",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: storageBuffer } },
      ],
    });

    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      const pulse = performance.now() * 0.001;
      gpu.device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([pulse, renderPipelines.length + 1, 1, 0]));
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-30-command-encoder" });
      const computePass = encoder.beginComputePass({ label: "lesson-30-cache-compute-pass" });
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, bindGroup);
      computePass.dispatchWorkgroups(1);
      computePass.end();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: gpu.context.getCurrentTexture().createView(),
          clearValue: { r: 0.025, g: 0.04, b: 0.07, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);
      for (let i = 0; i < renderPipelines.length; i += 1) {
        pass.setViewport((width / 3) * i, 0, width / 3, height, 0, 1);
        pass.setPipeline(renderPipelines[i]);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3);
      }
      pass.end();
      gpu.device.queue.submit([encoder.finish()]);
    };

    render();
    const resizeObserver = new ResizeObserver(render);
    resizeObserver.observe(host);
    setStatus({ title: "Shader module reuse 已就绪", detail: "一份 shader module 和一份 pipeline layout 正在驱动多条 render/compute pipeline。", tone: "ok" });

    return () => {
      resizeObserver.disconnect();
      uniformBuffer.destroy();
      storageBuffer.destroy();
      gpu.device.destroy();
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `<div class="preview-empty"><h3>预览不可用</h3><p>${message}</p></div>`;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
