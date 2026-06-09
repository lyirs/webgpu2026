import { createWebGpuCanvas } from "@/core/webgpu";
import computeShaderSource from "@/lessons/lesson-88-compute-bitonic-sort/bitonic-sort.compute.wgsl?raw";
import fragmentShaderSource from "@/lessons/lesson-88-compute-bitonic-sort/bitonic-sort.frag.wgsl?raw";
import {
  createBitonicSortSeedData,
  type SortSeed,
} from "@/lessons/lesson-88-compute-bitonic-sort/sort-data";
import vertexShaderSource from "@/lessons/lesson-88-compute-bitonic-sort/bitonic-sort.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type SortStage = {
  compareDistance: number;
  sequenceSize: number;
  sorted: boolean;
};

const SORT_STEP_INTERVAL = 0.03;
const MAX_SORT_STEPS_PER_FRAME = 4;
const SORTED_HOLD_DURATION = 3.0;

/**
 * 把当前 bitonic sort 阶段写成 GPU uniform 数据。
 * @param {SortSeed} seed 当前排序种子，包含元素总数。
 * @param {SortStage} stage 当前 bitonic 阶段信息。
 * @returns {ArrayBuffer} 供 compute 与 render 共用的 uniform 缓冲内容。
 */
function createSortUniformData(seed: SortSeed, stage: SortStage): ArrayBuffer {
  const buffer = new ArrayBuffer(32);
  const u32View = new Uint32Array(buffer, 0, 4);
  const f32View = new Float32Array(buffer, 16, 4);

  u32View[0] = seed.itemCount;
  u32View[1] = stage.compareDistance;
  u32View[2] = stage.sequenceSize;
  u32View[3] = stage.sorted ? 1 : 0;

  f32View[0] = 0;
  f32View[1] = 0;
  f32View[2] = 0;
  f32View[3] = 0;

  return buffer;
}

/**
 * 推进 bitonic sort 的下一轮阶段。
 * @param {SortSeed} seed 当前排序种子。
 * @param {SortStage} stage 当前阶段。
 * @returns {SortStage} 下一轮 compute dispatch 应该使用的阶段。
 */
function advanceBitonicStage(seed: SortSeed, stage: SortStage): SortStage {
  if (stage.sorted) {
    return stage;
  }

  if (stage.compareDistance > 1) {
    return {
      compareDistance: stage.compareDistance / 2,
      sequenceSize: stage.sequenceSize,
      sorted: false,
    };
  }

  const nextSequenceSize = stage.sequenceSize * 2;
  if (nextSequenceSize > seed.itemCount) {
    return {
      compareDistance: stage.compareDistance,
      sequenceSize: stage.sequenceSize,
      sorted: true,
    };
  }

  return {
    compareDistance: nextSequenceSize / 2,
    sequenceSize: nextSequenceSize,
    sorted: false,
  };
}

/**
 * 挂载第 34 课“Compute：Bitonic Sort”。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换课程时释放监听和动画帧。
 */
export async function mountBitonicSortLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Compute bitonic sort lesson preview"></canvas>
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

    let seed = createBitonicSortSeedData();
    const itemBuffers = [
      gpu.device.createBuffer({
        size: seed.itemData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      gpu.device.createBuffer({
        size: seed.itemData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];

    const sortUniformBuffer = gpu.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    /**
     * 把一轮新的随机排序数据重新上传到 GPU。
     * @returns {void} 只负责重置排序状态，不返回额外结果。
     */
    const uploadSeed = () => {
      seed = createBitonicSortSeedData();
      gpu.device.queue.writeBuffer(itemBuffers[0], 0, seed.itemData);
      gpu.device.queue.writeBuffer(itemBuffers[1], 0, seed.itemData);
    };

    uploadSeed();

    const computeBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
      ],
    });

    const computePipeline = gpu.device.createComputePipeline({
      label: "lesson-34-bitonic-compute",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [computeBindGroupLayout],
      }),
      compute: {
        module: gpu.device.createShaderModule({ code: computeShaderSource }),
        entryPoint: "csMain",
      },
    });

    const renderBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" },
        },
      ],
    });

    const renderPipeline = gpu.device.createRenderPipeline({
      label: "lesson-34-bitonic-render",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [renderBindGroupLayout],
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: vertexShaderSource }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: fragmentShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    let stage: SortStage = {
      compareDistance: 1,
      sequenceSize: 2,
      sorted: false,
    };

    const createComputeBindGroups = () => {
      return [
        gpu.device.createBindGroup({
          layout: computeBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: sortUniformBuffer } },
            { binding: 1, resource: { buffer: itemBuffers[0] } },
            { binding: 2, resource: { buffer: itemBuffers[1] } },
          ],
        }),
        gpu.device.createBindGroup({
          layout: computeBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: sortUniformBuffer } },
            { binding: 1, resource: { buffer: itemBuffers[1] } },
            { binding: 2, resource: { buffer: itemBuffers[0] } },
          ],
        }),
      ];
    };

    const createRenderBindGroups = () => {
      return [
        gpu.device.createBindGroup({
          layout: renderBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: sortUniformBuffer } },
            { binding: 1, resource: { buffer: itemBuffers[0] } },
          ],
        }),
        gpu.device.createBindGroup({
          layout: renderBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: sortUniformBuffer } },
            { binding: 1, resource: { buffer: itemBuffers[1] } },
          ],
        }),
      ];
    };

    let computeBindGroups = createComputeBindGroups();
    let renderBindGroups = createRenderBindGroups();
    let currentStateIndex = 0;
    let animationFrameId = 0;
    let previousTime = performance.now();
    let stepAccumulator = 0;
    let sortedHoldTime = 0;

    const resetSort = () => {
      uploadSeed();
      stage = {
        compareDistance: 1,
        sequenceSize: 2,
        sorted: false,
      };
      currentStateIndex = 0;
      stepAccumulator = 0;
      sortedHoldTime = 0;
      computeBindGroups = createComputeBindGroups();
      renderBindGroups = createRenderBindGroups();
    };

    /**
     * 推进一轮 bitonic compare-swap 阶段。
     * @returns {void} 只把当前阶段推进到下一轮，不返回额外结果。
     */
    const runSortStep = () => {
      gpu.device.queue.writeBuffer(
        sortUniformBuffer,
        0,
        createSortUniformData(seed, stage)
      );

      const computeEncoder = gpu.device.createCommandEncoder();
      const computePass = computeEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroups[currentStateIndex]);
      computePass.dispatchWorkgroups(seed.workgroupCount);
      computePass.end();
      gpu.device.queue.submit([computeEncoder.finish()]);

      currentStateIndex = 1 - currentStateIndex;
      stage = advanceBitonicStage(seed, stage);
    };

    const render = (time: number) => {
      syncViewport();
      gpu.resize();

      const deltaTime = Math.min((time - previousTime) * 0.001, 0.05);
      previousTime = time;
      stepAccumulator += deltaTime;

      let didStep = false;

      if (!stage.sorted) {
        let stepsThisFrame = 0;
        while (
          !stage.sorted &&
          stepAccumulator >= SORT_STEP_INTERVAL &&
          stepsThisFrame < MAX_SORT_STEPS_PER_FRAME
        ) {
          stepAccumulator -= SORT_STEP_INTERVAL;
          runSortStep();
          didStep = true;
          stepsThisFrame += 1;
        }
      } else if (stage.sorted) {
        sortedHoldTime += deltaTime;
        if (sortedHoldTime >= SORTED_HOLD_DURATION) {
          resetSort();
        }
      }

      gpu.device.queue.writeBuffer(
        sortUniformBuffer,
        0,
        createSortUniformData(seed, stage)
      );

      const commandEncoder = gpu.device.createCommandEncoder();
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
       * 每个排序条都用 6 个顶点组成一个小矩形，实例数量等于当前待排序元素数量。
       * @param {number} vertexCount 每个矩形需要的顶点数，这里固定为 6。
       * @param {number} instanceCount 当前可视化的条目总数。
       * @returns {void} 只负责把当前排序状态画出来，不返回额外结果。
       */
      renderPass.draw(6, seed.itemCount);
      renderPass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);

      if (didStep && stage.sorted) {
        sortedHoldTime = 0;
      }

      animationFrameId = window.requestAnimationFrame(render);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      gpu.resize();
    });

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(render);

    setStatus({
      title: "Bitonic Sort 已运行",
      detail:
        "32 条柱会按 compareDistance 和 sequenceSize 推进 15 轮排序阶段，排完后会停留一会再重置。",
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
