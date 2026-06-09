import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createPickingSceneGeometry } from "@/lessons/lesson-81-primitive-picking/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-81-primitive-picking/math";
import pickingFragmentShaderSource from "@/lessons/lesson-81-primitive-picking/picking.frag.wgsl?raw";
import pickingVertexShaderSource from "@/lessons/lesson-81-primitive-picking/picking.vert.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-81-primitive-picking/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-81-primitive-picking/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type PickingTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type SceneObjectConfig = {
  id: number;
  label: string;
  translation: Vector3;
  rotationY: number;
  scale: Vector3;
  baseColor: [number, number, number];
  pickable: boolean;
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

/**
 * 把当前帧的 VP 矩阵和主光方向打包成一份 frame uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前帧的 VP 矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续 float 数据。
 */
function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set([lightDirection[0], lightDirection[1], lightDirection[2], 0], 16);
  return uniformData;
}

/**
 * 把单个物体的 model matrix、显示颜色、ID 颜色和选中状态打包成对象 uniform 数据。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {[number, number, number]} baseColor 主场景里看到的基础颜色。
 * @param {number} pickingId 写进 picking 贴图的对象编号。
 * @param {boolean} selected 当前对象是否处于选中状态。
 * @returns {Float32Array} 可直接写进 uniform buffer 的对象数据。
 */
function createObjectUniformData(
  modelMatrix: Float32Array,
  baseColor: [number, number, number],
  pickingId: number,
  selected: boolean
): Float32Array {
  const uniformData = new Float32Array(28);
  uniformData.set(modelMatrix, 0);
  uniformData.set([baseColor[0], baseColor[1], baseColor[2], 1], 16);
  uniformData.set([pickingId / 255, 0, 0, 1], 20);
  uniformData.set([selected ? 1 : 0, 0, 0, 0], 24);
  return uniformData;
}

/**
 * 组合一份对象的模型矩阵；这里先缩放，再旋转，最后平移到场景里。
 * @param {SceneObjectConfig} config 当前对象的静态配置。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createModelMatrix(config: SceneObjectConfig): Float32Array {
  return multiplyMatrices(
    createTranslationMatrix(
      config.translation[0],
      config.translation[1],
      config.translation[2]
    ),
    multiplyMatrices(
      createRotationYMatrix(config.rotationY),
      createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
    )
  );
}

/**
 * 释放当前 lesson 使用的深度纹理。
 * @param {DepthTarget} target 当前 lesson 维护的深度目标。
 * @returns {void} 只负责销毁深度纹理并清空引用。
 */
function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 释放当前 lesson 使用的 picking 颜色纹理。
 * @param {PickingTarget} target 当前 lesson 维护的 picking 目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyPickingTarget(target: PickingTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 把一次点击对应的 CSS 像素坐标转换成当前 canvas 像素坐标。
 * @param {MouseEvent} event 浏览器点击事件。
 * @param {HTMLCanvasElement} canvas 当前预览画布。
 * @returns {{ x: number; y: number }} 对应的 canvas 像素坐标。
 */
function canvasPixelFromPointer(
  event: MouseEvent,
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const normalizedX = (event.clientX - rect.left) / Math.max(rect.width, 1);
  const normalizedY = (event.clientY - rect.top) / Math.max(rect.height, 1);

  return {
    x: Math.min(canvas.width - 1, Math.max(0, Math.floor(normalizedX * canvas.width))),
    y: Math.min(canvas.height - 1, Math.max(0, Math.floor(normalizedY * canvas.height))),
  };
}

/**
 * 挂载第 28 课“Picking 与对象选择”，演示如何先画一张 ID 贴图，再通过读回像素确定用户点中了哪个对象。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听器和 GPU 资源。
 */
export async function mountPrimitivePickingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Primitive picking lesson preview"></canvas>
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

  const depthTarget: DepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };
  const pickingTarget: PickingTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };

  try {
    const gpu = await createWebGpuCanvas(canvas);

    /**
     * 根据宿主容器尺寸同步中间预览区的 16:9 画幅。
     * @returns {void} 只更新预览视口尺寸，不返回额外结果。
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

    syncViewport();

    const geometry = createPickingSceneGeometry();

    const vertexBuffer = gpu.device.createBuffer({
      size: geometry.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(vertexBuffer, 0, geometry.vertexData);

    const indexBuffer = gpu.device.createBuffer({
      size: geometry.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(indexBuffer, 0, geometry.indexData);

    const sceneVertexShaderModule = gpu.device.createShaderModule({
      code: sceneVertexShaderSource,
    });
    const sceneFragmentShaderModule = gpu.device.createShaderModule({
      code: sceneFragmentShaderSource,
    });
    const pickingVertexShaderModule = gpu.device.createShaderModule({
      code: pickingVertexShaderSource,
    });
    const pickingFragmentShaderModule = gpu.device.createShaderModule({
      code: pickingFragmentShaderSource,
    });

    const frameBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const objectBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const pipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, objectBindGroupLayout],
    });

    /**
     * createRenderPipeline：主场景 pass 负责画正常颜色和选中高亮。
     */
    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-28-scene",
      layout: pipelineLayout,
      vertex: {
        module: sceneVertexShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              {
                // shaderLocation 0：位置，占 3 个 float32，对应 WGSL 里的 vec3f position。
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
              {
                // shaderLocation 1：法线，占 3 个 float32，对应 WGSL 里的 vec3f normal。
                shaderLocation: 1,
                offset: 3 * 4,
                format: "float32x3",
              },
            ],
          },
        ],
      },
      fragment: {
        module: sceneFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    /**
     * createRenderPipeline：picking pass 不负责真实颜色，只负责把每个对象的 ID 写进离屏纹理。
     */
    const pickingPipeline = gpu.device.createRenderPipeline({
      label: "lesson-28-picking",
      layout: pipelineLayout,
      vertex: {
        module: pickingVertexShaderModule,
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
            ],
          },
        ],
      },
      fragment: {
        module: pickingFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: "rgba8unorm" }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const frameUniformBuffer = gpu.device.createBuffer({
      size: 20 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const frameBindGroup = gpu.device.createBindGroup({
      layout: frameBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: {
            buffer: frameUniformBuffer,
          },
        },
      ],
    });

    const sceneObjectConfigs: SceneObjectConfig[] = [
      {
        id: 0,
        label: "Platform",
        translation: [0, -0.55, 0],
        rotationY: 0,
        scale: [4.8, 0.35, 4.8],
        baseColor: [0.44, 0.49, 0.64],
        pickable: false,
      },
      {
        id: 1,
        label: "Left pillar",
        translation: [-1.95, 0.85, -0.85],
        rotationY: 0.22,
        scale: [0.58, 1.45, 0.58],
        baseColor: [0.95, 0.54, 0.34],
        pickable: true,
      },
      {
        id: 2,
        label: "Center box",
        translation: [0.15, 0.55, 0.2],
        rotationY: -0.32,
        scale: [0.82, 0.82, 0.82],
        baseColor: [0.36, 0.73, 0.96],
        pickable: true,
      },
      {
        id: 3,
        label: "Right pillar",
        translation: [1.75, 1.1, 1.2],
        rotationY: 0.45,
        scale: [0.72, 1.95, 0.72],
        baseColor: [0.92, 0.8, 0.36],
        pickable: true,
      },
    ];

    const renderObjects: RenderObject[] = sceneObjectConfigs.map((config) => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 28 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = gpu.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: {
              buffer: uniformBuffer,
            },
          },
        ],
      });

      return {
        config,
        uniformBuffer,
        bindGroup,
      };
    });

    const readbackBuffer = gpu.device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    /**
     * 根据当前画布像素尺寸重建深度纹理。
     * @returns {void} 只在尺寸变化时重建深度目标。
     */
    const ensureDepthTarget = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        depthTarget.texture &&
        depthTarget.width === width &&
        depthTarget.height === height
      ) {
        return;
      }

      destroyDepthTarget(depthTarget);

      depthTarget.texture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTarget.view = depthTarget.texture.createView();
      depthTarget.width = width;
      depthTarget.height = height;
    };

    /**
     * 根据当前画布像素尺寸重建 picking 颜色纹理。
     * @returns {void} 只在尺寸变化时重建 ID buffer。
     */
    const ensurePickingTarget = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        pickingTarget.texture &&
        pickingTarget.width === width &&
        pickingTarget.height === height
      ) {
        return;
      }

      destroyPickingTarget(pickingTarget);

      pickingTarget.texture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
      pickingTarget.view = pickingTarget.texture.createView();
      pickingTarget.width = width;
      pickingTarget.height = height;
    };

    let selectedId = 0;
    let pickInFlight = false;
    let disposed = false;

    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, 0.75, 0],
      eye: [5.2, 3.9, 6.1],
      minRadius: 3.2,
      maxRadius: 14,
      rotateSpeed: 0.008,
      zoomSpeed: 0.008,
      onChange: () => {
        render();
      },
    });

    /**
     * 录制并提交当前场景的一帧；先画 picking ID 纹理，再画正常颜色场景。
     * @returns {void} 只负责编码命令和提交队列。
     */
    const render = () => {
      if (disposed) {
        return;
      }

      gpu.resize();
      ensureDepthTarget();
      ensurePickingTarget();

      if (!depthTarget.view || !pickingTarget.view) {
        return;
      }

      const camera = orbitCamera.getSnapshot();
      const aspect = Math.max(canvas.width / Math.max(canvas.height, 1), 1e-6);
      const projectionMatrix = createPerspectiveMatrix(
        (42 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewMatrix = createLookAtViewMatrix(
        camera.eye,
        camera.target,
        camera.up
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const lightDirection = normalizeVector([0.45, -1.0, 0.26]);

      gpu.device.queue.writeBuffer(
        frameUniformBuffer,
        0,
        createFrameUniformData(viewProjectionMatrix, lightDirection)
      );

      renderObjects.forEach((object) => {
        const modelMatrix = createModelMatrix(object.config);

        gpu.device.queue.writeBuffer(
          object.uniformBuffer,
          0,
          createObjectUniformData(
            modelMatrix,
            object.config.baseColor,
            object.config.pickable ? object.config.id : 0,
            object.config.id === selectedId
          )
        );
      });

      /**
       * createCommandEncoder：把 picking pass 和主场景 pass 录进同一份命令缓冲。
       */
      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-28-command-encoder",
      });

      /**
       * beginRenderPass：先画 picking 颜色纹理；这里每个对象只输出一个稳定的 ID 颜色。
       */
      const pickingPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: pickingTarget.view,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthTarget.view,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      pickingPass.setPipeline(pickingPipeline);
      pickingPass.setVertexBuffer(0, vertexBuffer);
      pickingPass.setIndexBuffer(indexBuffer, "uint16");
      pickingPass.setBindGroup(0, frameBindGroup);
      renderObjects.forEach((object) => {
        if (!object.config.pickable) {
          return;
        }

        pickingPass.setBindGroup(1, object.bindGroup);
        pickingPass.drawIndexed(geometry.indexCount);
      });
      pickingPass.end();

      /**
       * beginRenderPass：第二遍才画给用户看的正常场景，选中对象会被加亮。
       */
      const scenePass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.043, g: 0.074, b: 0.141, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthTarget.view,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      scenePass.setPipeline(scenePipeline);
      scenePass.setVertexBuffer(0, vertexBuffer);
      scenePass.setIndexBuffer(indexBuffer, "uint16");
      scenePass.setBindGroup(0, frameBindGroup);
      renderObjects.forEach((object) => {
        scenePass.setBindGroup(1, object.bindGroup);
        scenePass.drawIndexed(geometry.indexCount);
      });
      scenePass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    /**
     * 读取 picking 纹理里被点击像素的对象编号，并更新当前选中对象。
     * @param {MouseEvent} event 当前点击事件。
     * @returns {Promise<void>} 只负责完成一次像素读回和选中状态更新。
     */
    const pickObject = async (event: MouseEvent) => {
      if (disposed || !pickingTarget.texture || pickInFlight) {
        return;
      }

      pickInFlight = true;
      let mapped = false;

      try {
        const pixel = canvasPixelFromPointer(event, canvas);
        const commandEncoder = gpu.device.createCommandEncoder({
          label: "lesson-28-pick-readback",
        });

        /**
         * copyTextureToBuffer：把离屏 ID 纹理里被点击的那 1 个像素复制到 CPU 可读缓冲区。
         */
        commandEncoder.copyTextureToBuffer(
          {
            texture: pickingTarget.texture,
            origin: { x: pixel.x, y: pixel.y, z: 0 },
          },
          {
            buffer: readbackBuffer,
            bytesPerRow: 256,
            rowsPerImage: 1,
          },
          {
            width: 1,
            height: 1,
            depthOrArrayLayers: 1,
          }
        );

        gpu.device.queue.submit([commandEncoder.finish()]);

        /**
         * mapAsync：等待 GPU 把复制结果写完，再让 CPU 安全读取这块缓冲区。
         */
        await readbackBuffer.mapAsync(GPUMapMode.READ);
        mapped = true;

        /**
         * getMappedRange：拿到这块缓冲区当前映射出来的字节视图；这里前 1 个字节就是对象 ID。
         */
        const mappedRange = readbackBuffer.getMappedRange();
        const pixelData = new Uint8Array(mappedRange.slice(0));
        readbackBuffer.unmap();
        mapped = false;
        if (disposed) {
          return;
        }

        selectedId = pixelData[0];

        setStatus({
          title: selectedId === 0 ? "未选中对象" : "对象已选中",
          detail:
            selectedId === 0
              ? "这次点击没有命中可选对象，ID buffer 读回的是 0。"
              : `这次点击命中了对象 ID = ${selectedId}，高亮已经同步到主场景。`,
          tone: "ok",
        });

        render();
      } catch (error) {
        if (!disposed) {
          const message = error instanceof Error ? error.message : "Picking readback 失败。";
          setStatus({ title: "Picking 读回失败", detail: message, tone: "warn" });
        }
      } finally {
        if (mapped) {
          readbackBuffer.unmap();
        }
        pickInFlight = false;
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      render();
    });
    resizeObserver.observe(host);

    canvas.addEventListener("click", pickObject);

    render();

    setStatus({
      title: "Picking 已运行",
      detail:
        "点击场景里的方块时，这一课会先从离屏 ID buffer 读回像素编号，再把命中的对象高亮出来。",
      tone: "ok",
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      canvas.removeEventListener("click", pickObject);
      orbitCamera.dispose();
      destroyDepthTarget(depthTarget);
      destroyPickingTarget(pickingTarget);
      frameUniformBuffer.destroy();
      renderObjects.forEach((object) => {
        object.uniformBuffer.destroy();
      });
      readbackBuffer.destroy();
      vertexBuffer.destroy();
      indexBuffer.destroy();
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

    destroyDepthTarget(depthTarget);
    destroyPickingTarget(pickingTarget);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
