import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-33-dynamic-offsets-and-buffer-alignment/dynamic-offsets.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const objectCount = 4;
const uniformStructSize = 64;

function alignTo(value: number, alignment: number) {
  return Math.ceil(value / alignment) * alignment;
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

export async function mountDynamicOffsetsAndBufferAlignmentLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Dynamic offsets preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>one uniform buffer -> many objects</strong>
            <span>pass.setBindGroup(0, bindGroup, [dynamicOffset])</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics" data-metrics></div>
        <div class="webgpu-api-note" data-note>每个对象占据同一块 uniform buffer 中一段对齐后的区域。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const metrics = host.querySelector<HTMLElement>("[data-metrics]");
  if (!canvas || !stage || !metrics) {
    throw new Error("Dynamic offsets lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const alignment = gpu.device.limits.minUniformBufferOffsetAlignment;
    const stride = alignTo(uniformStructSize, alignment);
    const uniformBuffer = gpu.device.createBuffer({
      label: "lesson-13-dynamic-uniform-buffer",
      size: stride * objectCount,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroupLayout = gpu.device.createBindGroupLayout({
      label: "lesson-13-dynamic-bind-group-layout",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform",
            hasDynamicOffset: true,
            minBindingSize: uniformStructSize,
          },
        },
      ],
    });
    const pipelineLayout = gpu.device.createPipelineLayout({
      label: "lesson-13-pipeline-layout",
      bindGroupLayouts: [bindGroupLayout],
    });
    const shaderModule = gpu.device.createShaderModule({ code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-13-dynamic-offsets-pipeline",
      layout: pipelineLayout,
      vertex: { module: shaderModule, entryPoint: "vsMain" },
      fragment: {
        module: shaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    const bindGroup = gpu.device.createBindGroup({
      label: "lesson-13-dynamic-bind-group",
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
            size: uniformStructSize,
          },
        },
      ],
    });

    const objectData = new ArrayBuffer(stride * objectCount);
    const objectFloats = new Float32Array(objectData);
    const offsets = Array.from({ length: objectCount }, (_, index) => index * stride);
    const colors = [
      [0.18, 0.66, 1.0, 1],
      [1.0, 0.62, 0.32, 1],
      [0.54, 0.92, 0.48, 1],
      [0.92, 0.52, 1.0, 1],
    ];
    const positions = [
      [-0.58, 0.34, 0.85],
      [0.58, 0.32, 0.7],
      [-0.45, -0.38, 0.64],
      [0.46, -0.36, 0.9],
    ];

    metrics.innerHTML = `
      <article class="webgpu-api-metric"><span>minUniformBufferOffsetAlignment</span><strong>${alignment} B</strong></article>
      <article class="webgpu-api-metric"><span>struct size -> stride</span><strong>${uniformStructSize} -> ${stride} B</strong></article>
      <article class="webgpu-api-metric"><span>dynamic offsets</span><strong>${offsets.join(" / ")}</strong></article>
      <article class="webgpu-api-metric"><span>draw calls</span><strong>${objectCount}</strong></article>
    `;

    let frame = 0;
    let animationFrame = 0;
    const render = () => {
      syncApiViewport(host, stage);
      gpu.resize();
      frame += 1;

      for (let objectIndex = 0; objectIndex < objectCount; objectIndex += 1) {
        const base = offsets[objectIndex] / 4;
        objectFloats.set(colors[objectIndex], base);
        objectFloats.set(
          [
            positions[objectIndex][0],
            positions[objectIndex][1],
            positions[objectIndex][2],
            frame * 0.018 * (objectIndex % 2 === 0 ? 1 : -1),
          ],
          base + 4
        );
        objectFloats.set([objectIndex / objectCount, 0, 0, 0], base + 8);
      }
      gpu.device.queue.writeBuffer(uniformBuffer, 0, objectData);

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-13-command-encoder",
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.03, g: 0.045, b: 0.075, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      pass.setPipeline(pipeline);
      for (let objectIndex = 0; objectIndex < objectCount; objectIndex += 1) {
        pass.setBindGroup(0, bindGroup, [offsets[objectIndex]]);
        pass.draw(6);
      }
      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
      animationFrame = requestAnimationFrame(render);
    };

    render();
    const resizeObserver = new ResizeObserver(() => {
      syncApiViewport(host, stage);
      gpu.resize();
    });
    resizeObserver.observe(host);

    setStatus({
      title: "Dynamic offsets 已就绪",
      detail: `同一 bind group 通过 ${objectCount} 个动态 offset 复用一块 uniform buffer。`,
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      uniformBuffer.destroy();
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "未知的 WebGPU 错误。";
    host.innerHTML = `
      <div class="preview-empty">
        <h3>预览不可用</h3>
        <p>${message}</p>
      </div>
    `;
    setStatus({ title: "预览不可用", detail: message, tone: "warn" });
  }
}
