import { createWebGpuCanvas } from "@/core/webgpu";
import fragmentShaderSource from "@/lessons/lesson-10-camera-controls/cube.frag.wgsl?raw";
import { createCameraCubeGeometry } from "@/lessons/lesson-10-camera-controls/cube-data";
import {
  createIdentityMatrix,
  createLookAtViewMatrix,
  createOrbitCameraPosition,
  createPerspectiveMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-10-camera-controls/math";
import vertexShaderSource from "@/lessons/lesson-10-camera-controls/cube.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type OrbitState = {
  yaw: number;
  pitch: number;
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
 * 把两张 4x4 矩阵按顺序写进一个连续的 uniform 数组。
 * @param {Float32Array} modelViewProjectionMatrix 当前帧的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前帧的模型矩阵。
 * @returns {Float32Array} 适合直接写入 uniform buffer 的 32 个 float。
 */
function createCameraUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array
): Float32Array {
  const uniformData = new Float32Array(32);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  return uniformData;
}

/**
 * 挂载第 08 课“相机与控制”预览，并完成轨道相机、拖拽旋转和滚轮缩放。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountCameraControlsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Camera controls lesson preview"></canvas>
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

    const cube = createCameraCubeGeometry();
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
      size: 16 * 4 * 2,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const vertexShaderModule = gpu.device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-10-camera-controls",
      layout: "auto",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            // 这一课的顶点顺序仍然是 [position.xyz, color.rgb, normal.xyz]。
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

    const orbitState: OrbitState = {
      yaw: 0.75,
      pitch: 0.45,
      radius: 5.8,
    };
    const maxPitch = Math.PI * 0.5 - 0.01;
    const target: Vector3 = [0, 0, 0];
    const up: Vector3 = [0, 1, 0];
    const modelMatrix = createIdentityMatrix();

    const render = () => {
      syncViewport();
      gpu.resize();

      const aspect = canvas.width / canvas.height;
      const eye = createOrbitCameraPosition(
        orbitState.yaw,
        orbitState.pitch,
        orbitState.radius,
        target
      );
      const viewMatrix = createLookAtViewMatrix(eye, target, up);
      const projectionMatrix = createPerspectiveMatrix(
        (60 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewModelMatrix = multiplyMatrices(viewMatrix, modelMatrix);
      const modelViewProjectionMatrix = multiplyMatrices(
        projectionMatrix,
        viewModelMatrix
      );
      const uniformData = createCameraUniformData(
        modelViewProjectionMatrix,
        modelMatrix
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

      orbitState.yaw -= deltaX * 0.01;
      orbitState.pitch = clamp(
        orbitState.pitch + deltaY * 0.01,
        -maxPitch,
        maxPitch
      );
      render();
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
      orbitState.radius = clamp(orbitState.radius + event.deltaY * 0.01, 3.2, 9);
      render();
    };

    const resizeObserver = new ResizeObserver(() => {
      render();
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    resizeObserver.observe(host);

    render();

    setStatus({
      title: "轨道相机已接入",
      detail: "拖拽可以绕着立方体旋转视角，滚轮可以拉近和拉远相机。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
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
