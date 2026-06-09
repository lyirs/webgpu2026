import { createWebGpuCanvas } from "@/core/webgpu";
import { createPointLightGeometry } from "@/lessons/lesson-41-point-lights/cube-data";
import fragmentShaderSource from "@/lessons/lesson-41-point-lights/point-light.frag.wgsl?raw";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-41-point-lights/math";
import vertexShaderSource from "@/lessons/lesson-41-point-lights/point-light.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type LightState = {
  position: Vector3;
  color: [number, number, number, number];
};

type SceneObject = {
  modelMatrix: Float32Array;
  baseColor: [number, number, number, number];
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
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
 * 把当前帧的投影矩阵和点光源数据打包成一块 uniform。
 * @param {Float32Array} viewProjectionMatrix 当前帧的视图投影矩阵。
 * @param {LightState} light 当前点光源的位置和颜色。
 * @returns {Float32Array} 可直接写进 frame uniform buffer 的连续 float 数据。
 */
function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  light: LightState
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set([light.position[0], light.position[1], light.position[2], 1], 16);
  uniformData.set(light.color, 20);
  return uniformData;
}

/**
 * 把模型矩阵和这一个物体的底色打包进 object uniform。
 * @param {Float32Array} modelMatrix 当前物体的模型矩阵。
 * @param {[number, number, number, number]} baseColor 当前物体的基础颜色。
 * @returns {Float32Array} 可直接写进 object uniform buffer 的连续 float 数据。
 */
function createObjectUniformData(
  modelMatrix: Float32Array,
  baseColor: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelMatrix, 0);
  uniformData.set(baseColor, 16);
  return uniformData;
}

/**
 * 创建一个场景物体，并顺手准备好它自己的 uniform buffer 与 bind group。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPURenderPipeline} pipeline 点光源渲染管线，用于推导 group(1) 的布局。
 * @param {Float32Array} modelMatrix 当前物体的模型矩阵。
 * @param {[number, number, number, number]} baseColor 当前物体的基础颜色。
 * @returns {SceneObject} 已经具备独立 uniform 和 bind group 的场景物体。
 */
function createSceneObject(
  device: GPUDevice,
  pipeline: GPURenderPipeline,
  modelMatrix: Float32Array,
  baseColor: [number, number, number, number]
): SceneObject {
  const uniformBuffer = device.createBuffer({
    size: 20 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(1),
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
    modelMatrix,
    baseColor,
    uniformBuffer,
    bindGroup,
  };
}

/**
 * 挂载第 08 课“环境光与点光源”预览，让光第一次从一个具体位置照向场景。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台。
 * @returns {Promise<(() => void) | void>} 成功时返回清理函数；失败时返回空结果。
 */
export async function mountPointLightsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Point light lesson preview"></canvas>
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

    const geometry = createPointLightGeometry();
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

    const frameUniformBuffer = gpu.device.createBuffer({
      size: 24 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const vertexShaderModule = gpu.device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-41-point-lights",
      layout: "auto",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 3 * 4, format: "float32x3" },
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
        cullMode: "back",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    /**
     * getBindGroupLayout
     * @param {number} index 要读取的绑定组布局索引；这里传入 0，表示 frame uniform 所在的第 0 组资源。
     * @returns {GPUBindGroupLayout} 当前管线在指定组号上推导出来的绑定布局。
     */
    const frameBindGroupLayout = pipeline.getBindGroupLayout(0);
    /**
     * createBindGroup
     * @param {GPUBindGroupDescriptor} descriptor 绑定组描述对象；这里把点光源位置和整帧共享矩阵绑定到 group(0)。
     * @returns {GPUBindGroup} 可在每次 draw 前重复复用的 frame 绑定组。
     */
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

    const pillarModelMatrix = multiplyMatrices(
      createTranslationMatrix(0, 0.15, 0),
      createScaleMatrix(1.4, 4.2, 1.4)
    );
    const floorModelMatrix = multiplyMatrices(
      createTranslationMatrix(0, -2.4, 0),
      createScaleMatrix(12, 0.6, 12)
    );

    const sceneObjects: SceneObject[] = [
      createSceneObject(gpu.device, pipeline, pillarModelMatrix, [0.54, 0.38, 0.29, 1]),
      createSceneObject(gpu.device, pipeline, floorModelMatrix, [0.82, 0.84, 0.89, 1]),
    ];

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

    const cameraPosition: Vector3 = [0, 5.9, 10.8];
    const cameraTarget: Vector3 = [0, 0.75, 0];
    const cameraUp: Vector3 = [0, 1, 0];

    const render = (elapsed: number) => {
      syncViewport();
      gpu.resize();

      const aspect = canvas.width / canvas.height;
      const viewMatrix = createLookAtViewMatrix(
        cameraPosition,
        cameraTarget,
        cameraUp
      );
      const projectionMatrix = createPerspectiveMatrix(
        (52 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const light: LightState = {
        position: [Math.sin(elapsed * 0.85) * 6.2, 4.5, Math.cos(elapsed * 0.85) * 6.2],
        color: [1.28, 1.05, 0.74, 1],
      };
      const frameUniformData = createFrameUniformData(viewProjectionMatrix, light);
      const currentDepthTexture = ensureDepthTexture();

      /**
       * queue.writeBuffer
       * @param {GPUBuffer} buffer 要写入的目标 GPUBuffer；这里是所有物体共享的 frame uniform buffer。
       * @param {number} bufferOffset 写入起始偏移，这里从 0 开始。
       * @param {AllowSharedBufferSource} data 要拷贝进去的源数据，这里是当前帧的投影矩阵和点光源信息。
       * @returns {void} 只负责把共享帧数据上传进 GPU，不返回额外结果。
       */
      gpu.device.queue.writeBuffer(frameUniformBuffer, 0, frameUniformData);

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

      /**
       * setBindGroup
       * @param {number} index 要绑定的资源组编号；这里先绑定第 0 组 frame 数据。
       * @param {GPUBindGroup} bindGroup 要绑定的资源组对象；这里包含整帧共享矩阵和点光源数据。
       * @returns {void} 只更新当前 pass 的资源绑定状态，不返回额外结果。
       */
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, frameBindGroup);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");

      sceneObjects.forEach((sceneObject) => {
        const objectUniformData = createObjectUniformData(
          sceneObject.modelMatrix,
          sceneObject.baseColor
        );

        gpu.device.queue.writeBuffer(
          sceneObject.uniformBuffer,
          0,
          objectUniformData
        );
        pass.setBindGroup(1, sceneObject.bindGroup);
        pass.drawIndexed(geometry.indexCount);
      });

      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    let animationFrameId = 0;
    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
    });
    const frame = (time: number) => {
      render(time * 0.001);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "点光源已运行",
      detail:
        "环境光先保住最基础的亮度，点光源再从一个具体位置把亮度集中打到场景上。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      sceneObjects.forEach((sceneObject) => {
        sceneObject.uniformBuffer.destroy();
      });
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
