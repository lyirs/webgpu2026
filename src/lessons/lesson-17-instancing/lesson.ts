import { createWebGpuCanvas } from "@/core/webgpu";
import { createOrbitCameraController } from "@/core/orbit-camera";
import fragmentShaderSource from "@/lessons/lesson-17-instancing/cube.frag.wgsl?raw";
import { createInstancedCubeGeometry } from "@/lessons/lesson-17-instancing/cube-data";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-17-instancing/math";
import vertexShaderSource from "@/lessons/lesson-17-instancing/cube.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type InstanceGrid = {
  instanceData: Float32Array;
  instanceCount: number;
};

/**
 * 安全释放一张 GPUTexture。
 * @param {GPUTexture | null} resource 要释放的 GPU 纹理对象。
 * @returns {void} 只负责销毁纹理，不返回额外结果。
 */
function destroyGpuTexture(resource: GPUTexture | null): void {
  resource?.destroy();
}

/**
 * 生成实例化课里每个小立方体的偏移和颜色数据。
 * @returns {InstanceGrid} 每个实例都按 [offset.x, offset.y, offset.z, color.r, color.g, color.b] 排列好的 instance buffer 数据。
 */
function createInstanceGrid(): InstanceGrid {
  const columns = 5;
  const rows = 5;
  const spacing = 3.1;
  const payload: number[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const centeredX = (column - (columns - 1) * 0.5) * spacing;
      const centeredZ = (row - (rows - 1) * 0.5) * spacing;
      const lift = Math.cos(column * 0.6 + row * 0.85) * 0.35;
      const color: Vector3 = [
        0.35 + column * 0.11,
        0.45 + row * 0.08,
        0.92 - row * 0.09 + column * 0.02,
      ];

      payload.push(centeredX, lift, centeredZ, color[0], color[1], color[2]);
    }
  }

  return {
    instanceData: new Float32Array(payload),
    instanceCount: rows * columns,
  };
}

/**
 * 把 VP 矩阵、统一旋转矩阵和光线方向打包成一份 uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前相机视角的 VP 矩阵。
 * @param {Float32Array} modelMatrix 当前帧共享给所有实例的旋转矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 适合直接写入 uniform buffer 的连续 float 数据。
 */
function createInstancingUniformData(
  viewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    32
  );
  return uniformData;
}

/**
 * 挂载第 13 课“实例化与批量绘制”预览，并用一次 drawIndexed 画出一整片立方体阵列。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountInstancingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Instancing lesson preview"></canvas>
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

  let depthTexture: GPUTexture | null = null;
  let depthTextureWidth = 0;
  let depthTextureHeight = 0;

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

    const cube = createInstancedCubeGeometry();
    const grid = createInstanceGrid();

    const vertexBuffer = gpu.device.createBuffer({
      size: cube.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(vertexBuffer, 0, cube.vertexData);

    const indexBuffer = gpu.device.createBuffer({
      size: cube.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(indexBuffer, 0, cube.indexData);

    const instanceBuffer = gpu.device.createBuffer({
      size: grid.instanceData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(instanceBuffer, 0, grid.instanceData);

    const uniformBuffer = gpu.device.createBuffer({
      size: 16 * 4 * 2 + 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const vertexShaderModule = gpu.device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-17-instancing",
      layout: "auto",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
              {
                shaderLocation: 1,
                offset: 3 * 4,
                format: "float32x3",
              },
            ],
          },
          {
            arrayStride: 6 * 4,
            // stepMode: "instance" 表示这组属性不再“每个顶点读一次”，而是“每个实例读一次”。
            stepMode: "instance",
            attributes: [
              {
                // shaderLocation 2：这一课把每个实例自己的世界偏移量放在这里。
                shaderLocation: 2,
                offset: 0,
                format: "float32x3",
              },
              {
                // shaderLocation 3：这一课把每个实例自己的基础颜色放在这里。
                shaderLocation: 3,
                offset: 3 * 4,
                format: "float32x3",
              },
            ],
          },
        ],
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const bindGroup = gpu.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniformBuffer,
          },
        },
      ],
    });

    const ensureDepthTexture = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        depthTexture &&
        depthTextureWidth === width &&
        depthTextureHeight === height
      ) {
        return depthTexture;
      }

      depthTexture?.destroy();
      depthTextureWidth = width;
      depthTextureHeight = height;

      depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      return depthTexture;
    };

    const eye: Vector3 = [17, 12, 18];
    const target: Vector3 = [0, 1, 0];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
    });
    const lightDirection = normalizeVector([0.55, 1, 0.35]);

    const render = (elapsed: number) => {
      syncViewport();
      gpu.resize();

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        (60 * Math.PI) / 180,
        aspect,
        0.1,
        120
      );
      const viewProjectionMatrix = multiplyMatrices(
        projectionMatrix,
        viewMatrix
      );
      const rotationXMatrix = createRotationXMatrix(-0.25);
      const rotationYMatrix = createRotationYMatrix(elapsed * 0.75);
      const modelMatrix = multiplyMatrices(rotationYMatrix, rotationXMatrix);
      const uniformData = createInstancingUniformData(
        viewProjectionMatrix,
        modelMatrix,
        lightDirection
      );
      const currentDepthTexture = ensureDepthTexture();

      gpu.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

      const commandEncoder = gpu.device.createCommandEncoder();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.043, g: 0.074, b: 0.141, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: currentDepthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setVertexBuffer(1, instanceBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      // drawIndexed(indexCount, instanceCount)：第一个参数还是几何索引数量，第二个参数开始才是“要画多少个实例”。
      pass.drawIndexed(cube.indexCount, grid.instanceCount);
      pass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    let animationFrameId = 0;
    const startTime = performance.now();

    const frame = (time: number) => {
      const elapsed = (time - startTime) * 0.001;
      render(elapsed);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
    });

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "实例化阵列已运行",
      detail:
        "现在这片立方体阵列共享同一套几何和材质，只是 instance buffer 里的偏移与颜色不同，这一课重点就是 stepMode 和 instanceCount。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      window.cancelAnimationFrame(animationFrameId);
      destroyGpuTexture(depthTexture);
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

    destroyGpuTexture(depthTexture);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
