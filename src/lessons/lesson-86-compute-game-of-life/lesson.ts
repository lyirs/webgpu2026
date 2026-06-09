import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-86-compute-game-of-life/game-of-life.compute.wgsl?raw";
import fragmentShaderSource from "@/lessons/lesson-86-compute-game-of-life/game-of-life.frag.wgsl?raw";
import {
  createGameOfLifeSeed,
  type GameOfLifeSeed,
} from "@/lessons/lesson-86-compute-game-of-life/seed";
import vertexShaderSource from "@/lessons/lesson-86-compute-game-of-life/game-of-life.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

/**
 * 生成第 32 课 compute 与 render 共用的模拟参数。
 * @param {GameOfLifeSeed} seed 当前网格种子对象，里面包含宽高和 dispatch 所需信息。
 * @returns {Uint32Array} 依次写入 width、height 和两项 padding 的 uniform 数据。
 */
function createSimulationUniformData(seed: GameOfLifeSeed): Uint32Array {
  return new Uint32Array([seed.width, seed.height, 0, 0]);
}

/**
 * 挂载第 32 课“Compute：Game of Life”。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听和动画帧。
 */
export async function mountGameOfLifeLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Game of Life lesson preview"></canvas>
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
     * 把 lesson 预览区保持在 16:9 比例，方便和其他课程一致。
     * @returns {void} 只更新视口样式，不返回额外结果。
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

    const seed = createGameOfLifeSeed();
    const stateBuffers = [
      gpu.device.createBuffer({
        size: seed.state.byteLength,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST,
      }),
      gpu.device.createBuffer({
        size: seed.state.byteLength,
        usage:
          GPUBufferUsage.STORAGE |
          GPUBufferUsage.COPY_DST,
      }),
    ];
    gpu.device.queue.writeBuffer(stateBuffers[0], 0, seed.state);

    const simulationUniformBuffer = gpu.device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(
      simulationUniformBuffer,
      0,
      createSimulationUniformData(seed)
    );

    /**
     * createComputePipeline
     * 创建生命游戏的 compute 管线，让 GPU 在规则网格上并行推演“下一状态”。
     * @param {GPUComputePipelineDescriptor} descriptor compute 管线描述对象，这里定义 compute shader 模块和入口函数。
     * @returns {GPUComputePipeline} 之后会在 compute pass 中执行的计算管线。
     */
    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-32-game-of-life-compute",
      layout: "auto",
      compute: {
        module: gpu.device.createShaderModule({
          code: computeShaderSource,
        }),
        entryPoint: "csMain",
      },
    });

    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-32-game-of-life-render",
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

    const computeBindGroups = [
      gpu.device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: simulationUniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: stateBuffers[0] },
          },
          {
            binding: 2,
            resource: { buffer: stateBuffers[1] },
          },
        ],
      }),
      gpu.device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: simulationUniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: stateBuffers[1] },
          },
          {
            binding: 2,
            resource: { buffer: stateBuffers[0] },
          },
        ],
      }),
    ];

    const renderBindGroups = [
      gpu.device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: simulationUniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: stateBuffers[0] },
          },
        ],
      }),
      gpu.device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: { buffer: simulationUniformBuffer },
          },
          {
            binding: 1,
            resource: { buffer: stateBuffers[1] },
          },
        ],
      }),
    ];

    let currentStateIndex = 0;
    let animationFrameId = 0;
    let previousTime = performance.now();
    let stepAccumulator = 0;
    const stepInterval = 0.085;

    const render = (time: number) => {
      syncViewport();
      gpu.resize();

      const deltaTime = Math.min((time - previousTime) * 0.001, 0.12);
      previousTime = time;
      stepAccumulator += deltaTime;

      const commandEncoder = gpu.device.createCommandEncoder();

      const stepsThisFrame = Math.min(Math.floor(stepAccumulator / stepInterval), 4);
      if (stepsThisFrame > 0) {
        /**
         * beginComputePass
         * 进入 compute pass，让 GPU 根据当前网格状态生成下一帧状态。
         * @returns {GPUComputePassEncoder} 当前这次 compute 阶段的命令编码器。
         */
        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(computePipeline);

        for (let step = 0; step < stepsThisFrame; step += 1) {
          computePass.setBindGroup(0, computeBindGroups[currentStateIndex]);
          /**
           * dispatchWorkgroups
           * 这里按二维 workgroup 网格发射 compute 线程，让每个细胞都能并行计算自己的下一状态。
           * @param {number} workgroupCountX x 方向工作组数量，对应网格宽度。
           * @param {number} workgroupCountY y 方向工作组数量，对应网格高度。
           * @returns {void} 只负责触发计算，不返回额外结果。
           */
          computePass.dispatchWorkgroups(
            seed.workgroupCountX,
            seed.workgroupCountY
          );
          currentStateIndex = 1 - currentStateIndex;
        }

        computePass.end();
        stepAccumulator -= stepsThisFrame * stepInterval;
      }

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
       * 这里还是一块 quad 对应 6 个顶点，但实例数量等于整张网格的细胞总数。
       * @param {number} vertexCount 每个细胞 quad 需要的顶点数量，这里固定为 6。
       * @param {number} instanceCount 要渲染的细胞数量。
       * @returns {void} 只负责把整张细胞网格画出来，不返回额外结果。
       */
      renderPass.draw(6, seed.cellCount);
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
      title: "Compute 生命游戏已运行",
      detail:
        "这一课重点是两份 storage buffer 轮流读写，再把当前网格状态直接可视化出来。",
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
