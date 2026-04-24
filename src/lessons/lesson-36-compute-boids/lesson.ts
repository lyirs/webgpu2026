import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-36-compute-boids/boids.compute.wgsl?raw";
import fragmentShaderSource from "@/lessons/lesson-36-compute-boids/boids.frag.wgsl?raw";
import {
  createBoidSeedData,
  type BoidSeed,
} from "@/lessons/lesson-36-compute-boids/boid-data";
import vertexShaderSource from "@/lessons/lesson-36-compute-boids/boids.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

/**
 * 生成 boids 模拟需要的 uniform 数据。
 * @param {number} deltaTime 当前帧距离上一帧过去的秒数。
 * @param {BoidSeed} seed 当前 boid 种子对象，里面包含总数量和 dispatch 信息。
 * @returns {Float32Array} 依次写入 deltaTime、boidCount、邻域半径、最大速度和边界尺寸等模拟参数。
 */
function createSimulationParamsData(
  deltaTime: number,
  seed: BoidSeed
): Float32Array {
  return new Float32Array([
    deltaTime,
    seed.boidCount,
    0.2,
    0.34,
    0.12,
    0.48,
    0.024,
    0.96,
  ]);
}

/**
 * 挂载第 33 课“Compute：Boids 群集”。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听和动画帧。
 */
export async function mountComputeBoidsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Compute boids lesson preview"></canvas>
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
     * 把中间预览区保持成 16:9，和其他课程统一。
     * @returns {void} 只更新预览视口样式，不返回额外结果。
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

    const seed = createBoidSeedData();
    const boidBuffers = [
      gpu.device.createBuffer({
        size: seed.boidData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      gpu.device.createBuffer({
        size: seed.boidData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];
    gpu.device.queue.writeBuffer(boidBuffers[0], 0, seed.boidData);

    const simulationParamsBuffer = gpu.device.createBuffer({
      size: 8 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    /**
     * createComputePipeline
     * 这条 compute pipeline 负责把每只 boid 周围的邻居关系汇总成新的速度和位置。
     * @param {GPUComputePipelineDescriptor} descriptor compute 管线描述对象，这里定义 compute shader 模块和入口函数。
     * @returns {GPUComputePipeline} 之后会在 compute pass 中执行 boids 规则更新的管线。
     */
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-33-boids-compute",
      layout: "auto",
      compute: {
        module: gpu.device.createShaderModule({
          code: computeShaderSource,
        }),
        entryPoint: "csMain",
      },
    });

    const renderBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "uniform",
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: {
            type: "read-only-storage",
          },
        },
      ],
    });

    const renderPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [renderBindGroupLayout],
    });

    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-33-boids-render",
      layout: renderPipelineLayout,
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
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const computeBindGroups = [
      gpu.device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: simulationParamsBuffer },
          },
          {
            binding: 1,
            resource: { buffer: boidBuffers[0] },
          },
          {
            binding: 2,
            resource: { buffer: boidBuffers[1] },
          },
        ],
      }),
      gpu.device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: simulationParamsBuffer },
          },
          {
            binding: 1,
            resource: { buffer: boidBuffers[1] },
          },
          {
            binding: 2,
            resource: { buffer: boidBuffers[0] },
          },
        ],
      }),
    ];

    const renderBindGroups = [
      gpu.device.createBindGroup({
        layout: renderBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: simulationParamsBuffer },
          },
          {
            binding: 1,
            resource: { buffer: boidBuffers[0] },
          },
        ],
      }),
      gpu.device.createBindGroup({
        layout: renderBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: simulationParamsBuffer },
          },
          {
            binding: 1,
            resource: { buffer: boidBuffers[1] },
          },
        ],
      }),
    ];

    let currentStateIndex = 0;
    let animationFrameId = 0;
    let previousTime = performance.now();

    const render = (time: number) => {
      syncViewport();
      gpu.resize();

      const deltaTime = Math.min((time - previousTime) * 0.001, 0.033);
      previousTime = time;
      gpu.device.queue.writeBuffer(
        simulationParamsBuffer,
        0,
        createSimulationParamsData(deltaTime, seed)
      );

      const commandEncoder = gpu.device.createCommandEncoder();

      /**
       * beginComputePass
       * 进入 compute pass，让 GPU 先按邻域规则更新所有 boid 的下一状态。
       * @returns {GPUComputePassEncoder} 当前这一轮 boids 更新的命令编码器。
       */
      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroups[currentStateIndex]);
      /**
       * dispatchWorkgroups
       * 这里按一维 workgroup 队列发射线程，每个线程负责更新一只 boid。
       * @param {number} workgroupCountX x 方向工作组数量，这里等于 boid 总数除以每组线程数后向上取整。
       * @returns {void} 只负责触发计算，不返回额外结果。
       */
      computePass.dispatchWorkgroups(seed.workgroupCount);
      computePass.end();
      currentStateIndex = 1 - currentStateIndex;

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
      renderPass.setBindGroup(0, renderBindGroups[currentStateIndex]);
      /**
       * draw
       * 每只 boid 用 3 个顶点组成一个朝向速度方向的小三角形，实例数量等于 boid 总数。
       * @param {number} vertexCount 每个 boid 三角形需要的顶点数量，这里固定为 3。
       * @param {number} instanceCount 要渲染的 boid 数量。
       * @returns {void} 只负责把当前 boid 群集画出来，不返回额外结果。
       */
      renderPass.draw(3, seed.boidCount);
      renderPass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);
      animationFrameId = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      gpu.resize();
    });

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(render);

    setStatus({
      title: "Compute Boids 已运行",
      detail:
        "这一课重点是 alignment、cohesion、separation 三条规则如何一起驱动群体运动。",
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
