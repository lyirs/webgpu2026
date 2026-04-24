import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-19-compute-particles/particles.compute.wgsl?raw";
import fragmentShaderSource from "@/lessons/lesson-19-compute-particles/particles.frag.wgsl?raw";
import {
  createParticleSeedData,
  type ParticleSeed,
} from "@/lessons/lesson-19-compute-particles/particle-data";
import vertexShaderSource from "@/lessons/lesson-19-compute-particles/particles.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

/**
 * 生成 compute pass 需要的 uniform 数据。
 * @param {number} deltaTime 当前帧距离上一帧经过的秒数。
 * @param {ParticleSeed} seed 粒子数量和 workgroup 信息。
 * @returns {Float32Array} 依次写入 deltaTime、particleCount 和可活动边界的 uniform 数据。
 */
function createSimulationParamsData(
  deltaTime: number,
  seed: ParticleSeed
): Float32Array {
  return new Float32Array([
    deltaTime,
    seed.particleCount,
    0.92,
    0.72,
  ]);
}

/**
 * 挂载第 14 课“Compute 与粒子”预览，并让 compute shader 每帧更新粒子位置。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听和动画帧；如果挂载失败，则返回空结果。
 */
export async function mountComputeParticlesLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Compute particles lesson preview"></canvas>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const viewport = host.querySelector<HTMLDivElement>(".preview-viewport");
  if (!canvas) {
    throw new Error("预览 canvas 没有创建成功。");
  }
  if (!viewport) {
    throw new Error("预览视口没有创建成功。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);

    /**
     * 根据宿主容器尺寸同步中间预览区的 16:9 画幅。
     * @returns {void} 只更新预览视口的宽高样式，不返回额外结果。
     */
    const syncViewport = () => {
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
    };

    const seed = createParticleSeedData();

    /**
     * createBuffer
     * 把粒子数组创建成一块 storage buffer，让 compute pass 能读写它，render pass 也能继续读取它。
     * @param {GPUBufferDescriptor} descriptor GPUBuffer 描述对象，这里会把用途声明成 STORAGE 和 COPY_DST。
     * @returns {GPUBuffer} 真正存放粒子位置、速度、颜色和尺寸的 GPUBuffer。
     */
    const particleBuffer = gpu.device.createBuffer({
      size: seed.particleData.byteLength,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(particleBuffer, 0, seed.particleData);

    const simulationParamsBuffer = gpu.device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    /**
     * createComputePipeline
     * 创建一条 compute pipeline，让 GPU 不经过光栅化也能并行更新粒子状态。
     * @param {GPUComputePipelineDescriptor} descriptor compute 管线描述对象，这里只关心 compute shader 模块和入口函数。
     * @returns {GPUComputePipeline} 之后会在 compute pass 中执行的计算管线。
     */
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-19-compute-particles",
      layout: "auto",
      compute: {
        module: gpu.device.createShaderModule({
          code: computeShaderSource,
        }),
        entryPoint: "csMain",
      },
    });

    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-14-particle-render",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({
          code: vertexShaderSource,
        }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({
          code: fragmentShaderSource,
        }),
        entryPoint: "fsMain",
        targets: [
          {
            format: gpu.format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const computeBindGroup = gpu.device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: simulationParamsBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: particleBuffer,
          },
        },
      ],
    });

    const renderBindGroup = gpu.device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: simulationParamsBuffer,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: particleBuffer,
          },
        },
      ],
    });

    let animationFrameId = 0;
    let previousTime = performance.now();

    const render = (time: number) => {
      syncViewport();
      gpu.resize();

      const deltaTime = Math.min((time - previousTime) * 0.001, 0.033);
      previousTime = time;
      const simulationParams = createSimulationParamsData(deltaTime, seed);

      gpu.device.queue.writeBuffer(simulationParamsBuffer, 0, simulationParams);

      const commandEncoder = gpu.device.createCommandEncoder();

      /**
       * beginComputePass
       * 打开一段 compute pass，接下来这段命令不会直接画图，而是先更新 storage buffer 里的粒子数据。
       * @returns {GPUComputePassEncoder} 当前这次计算阶段的命令编码器。
       */
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      /**
       * dispatchWorkgroups
       * 按 workgroup 为单位启动 compute shader，这里让 GPU 为整批粒子分配足够的并行线程。
       * @param {number} workgroupCountX x 方向启动的工作组数量，这里等于粒子数除以每组线程数后向上取整。
       * @returns {void} 只负责触发计算，不返回额外结果。
       */
      computePass.dispatchWorkgroups(seed.workgroupCount);
      computePass.end();

      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.043, g: 0.074, b: 0.141, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      renderPass.setPipeline(renderPipeline);
      renderPass.setBindGroup(0, renderBindGroup);
      /**
       * draw
       * 这次 `draw(6, instanceCount)` 的第一个参数代表每个粒子四边形需要的 6 个顶点，第二个参数才是粒子实例数量。
       * @param {number} vertexCount 每个实例要生成的顶点数，这里是 2 个三角形组成的 6 个顶点。
       * @param {number} instanceCount 要绘制的粒子实例数量。
       * @returns {void} 只负责把所有粒子提交给当前 render pass，不返回额外结果。
       */
      renderPass.draw(6, seed.particleCount);
      renderPass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);
      animationFrameId = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
    });

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(render);

    setStatus({
      title: "Compute 粒子已运行",
      detail:
        "现在粒子位置先在 compute pass 里更新，再在 render pass 里批量绘制，这一课重点就是 storage buffer、dispatchWorkgroups 和两段 pass 的分工。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
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

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
