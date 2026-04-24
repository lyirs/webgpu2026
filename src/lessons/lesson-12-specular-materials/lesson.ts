import { createWebGpuCanvas } from "@/core/webgpu";
import fragmentShaderSource from "@/lessons/lesson-12-specular-materials/cube.frag.wgsl?raw";
import { createSpecularCubeGeometry } from "@/lessons/lesson-12-specular-materials/cube-data";
import {
  addVectors,
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  crossVectors,
  multiplyMatrices,
  normalizeVector,
  rotateVectorAroundAxis,
  scaleVector,
  type Vector3,
} from "@/lessons/lesson-12-specular-materials/math";
import vertexShaderSource from "@/lessons/lesson-12-specular-materials/cube.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type OrbitBasis = {
  right: Vector3;
  up: Vector3;
  back: Vector3;
  radius: number;
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
 * 把数值限制在一个安全区间里。
 * @param {number} value 当前数值。
 * @param {number} min 允许的最小值。
 * @param {number} max 允许的最大值。
 * @returns {number} 夹在最小值和最大值之间的结果。
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 把两张矩阵、相机位置和材质参数写进同一个 uniform 数组。
 * @param {Float32Array} modelViewProjectionMatrix 当前帧的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前帧的模型矩阵。
 * @param {Vector3} eye 当前相机位置。
 * @returns {Float32Array} 适合直接写入 uniform buffer 的连续 float 数据。
 */
function createSpecularUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  eye: Vector3
): Float32Array {
  const uniformData = new Float32Array(40);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  // eyePosition 用 vec4f 存，是为了让 uniform 对齐保持清晰稳定。
  uniformData.set([eye[0], eye[1], eye[2], 1], 32);
  // materialParams = [shininess, specularStrength, ambient, padding]。
  uniformData.set([36, 0.72, 0.18, 0], 36);
  return uniformData;
}

/**
 * 把自由轨道相机的三个局部轴重新整理成一组正交基。
 * @param {OrbitBasis} basis 当前相机的 right / up / back 和半径。
 * @returns {OrbitBasis} 经过单位化和正交化之后的新相机基。
 */
function orthonormalizeBasis(basis: OrbitBasis): OrbitBasis {
  const back = normalizeVector(basis.back);
  const right = normalizeVector(crossVectors(basis.up, back));
  const up = normalizeVector(crossVectors(back, right));

  return {
    right,
    up,
    back,
    radius: basis.radius,
  };
}

/**
 * 挂载第 10 课“高光与材质”预览，并完成最基础的镜面高光计算。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountSpecularMaterialsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Specular materials lesson preview"></canvas>
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

    const cube = createSpecularCubeGeometry();
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

    const uniformBuffer = gpu.device.createBuffer({
      size: 16 * 4 * 2 + 4 * 4 * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const vertexShaderModule = gpu.device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-12-specular-materials",
      layout: "auto",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 9 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 3 * 4, format: "float32x3" },
              { shaderLocation: 2, offset: 6 * 4, format: "float32x3" },
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

    const target: Vector3 = [0, 0, 0];
    let basis = orthonormalizeBasis({
      right: [1, 0, 0],
      up: [0, 1, 0],
      back: normalizeVector([3.6, 2.3, 5.4]),
      radius: Math.hypot(3.6, 2.3, 5.4),
    });

    const render = (elapsed: number) => {
      syncViewport();
      gpu.resize();

      const aspect = canvas.width / canvas.height;
      const eye = addVectors(target, scaleVector(basis.back, basis.radius));
      const viewMatrix = createLookAtViewMatrix(eye, target, basis.up);
      const projectionMatrix = createPerspectiveMatrix(
        (60 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const rotationXMatrix = createRotationXMatrix(elapsed * 0.45);
      const rotationYMatrix = createRotationYMatrix(elapsed * 0.75);
      const modelMatrix = multiplyMatrices(rotationYMatrix, rotationXMatrix);
      const viewModelMatrix = multiplyMatrices(viewMatrix, modelMatrix);
      const modelViewProjectionMatrix = multiplyMatrices(
        projectionMatrix,
        viewModelMatrix
      );
      const uniformData = createSpecularUniformData(
        modelViewProjectionMatrix,
        modelMatrix,
        eye
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
      pass.setIndexBuffer(indexBuffer, "uint16");
      pass.drawIndexed(cube.indexCount);
      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";

    let activePointerId = -1;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let animationFrameId = 0;
    const startTime = performance.now();

    const onPointerDown = (event: PointerEvent) => {
      activePointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      const deltaX = event.clientX - lastPointerX;
      const deltaY = event.clientY - lastPointerY;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;

      const horizontalAxis = normalizeVector(basis.up);
      const horizontalAngle = -deltaX * 0.01;
      let nextBack = rotateVectorAroundAxis(
        basis.back,
        horizontalAxis,
        horizontalAngle
      );
      let nextRight = rotateVectorAroundAxis(
        basis.right,
        horizontalAxis,
        horizontalAngle
      );
      let nextUp = basis.up;

      const verticalAxis = normalizeVector(nextRight);
      const verticalAngle = -deltaY * 0.01;
      nextBack = rotateVectorAroundAxis(nextBack, verticalAxis, verticalAngle);
      nextUp = rotateVectorAroundAxis(nextUp, verticalAxis, verticalAngle);

      basis = orthonormalizeBasis({
        right: nextRight,
        up: nextUp,
        back: nextBack,
        radius: basis.radius,
      });
    };

    const endDrag = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) {
        return;
      }

      activePointerId = -1;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      canvas.style.cursor = "grab";
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      basis = {
        ...basis,
        radius: clamp(basis.radius + event.deltaY * 0.01, 3.2, 9.5),
      };
    };

    const frame = (time: number) => {
      const elapsed = (time - startTime) * 0.001;
      render(elapsed);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "高光材质已运行",
      detail:
        "拖拽相机时可以直接观察高光如何跟着视角移动，这一课重点就是 viewDirection、reflect 和 shininess。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("wheel", onWheel);
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
