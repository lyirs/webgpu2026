import { createWebGpuCanvas } from "@/core/webgpu";
import { createOrbitCameraController } from "@/core/orbit-camera";
import { createShadowSceneGeometry } from "@/lessons/lesson-48-shadow-mapping/cube-data";
import {
  createLookAtViewMatrix,
  createOrthographicMatrix,
  createPerspectiveMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-48-shadow-mapping/math";
import sceneFragmentShaderSource from "@/lessons/lesson-50-multi-light-shadows/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-50-multi-light-shadows/scene.vert.wgsl?raw";
import shadowVertexShaderSource from "@/lessons/lesson-50-multi-light-shadows/shadow.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type LightState = {
  position: Vector3;
  direction: Vector3;
  color: [number, number, number, number];
};

type RenderableMesh = {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  modelMatrix: Float32Array;
};

type RenderableObject = RenderableMesh & {
  shadowUniformBufferOne: GPUBuffer;
  shadowUniformBufferTwo: GPUBuffer;
  sceneUniformBuffer: GPUBuffer;
  shadowBindGroupOne: GPUBindGroup;
  shadowBindGroupTwo: GPUBindGroup;
  sceneBindGroup: GPUBindGroup;
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
 * 生成 shadow pass 需要的 uniform 数据。
 * @param {Float32Array} lightViewProjectionMatrix 当前光源视角的 VP 矩阵。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @returns {Float32Array} 适合写进 shadow uniform buffer 的连续 float 数据。
 */
function createShadowUniformData(
  lightViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array
): Float32Array {
  const uniformData = new Float32Array(32);
  uniformData.set(lightViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  return uniformData;
}

/**
 * 生成主场景 pass 需要的 uniform 数据。
 * @param {Float32Array} cameraViewProjectionMatrix 当前相机视角的 VP 矩阵。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {Float32Array} lightOneViewProjectionMatrix 第一盏灯的 VP 矩阵。
 * @param {Float32Array} lightTwoViewProjectionMatrix 第二盏灯的 VP 矩阵。
 * @param {LightState} lightOne 第一盏灯的位置、方向和颜色。
 * @param {LightState} lightTwo 第二盏灯的位置、方向和颜色。
 * @returns {Float32Array} 适合写进场景 uniform buffer 的连续 float 数据。
 */
function createSceneUniformData(
  cameraViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  lightOneViewProjectionMatrix: Float32Array,
  lightTwoViewProjectionMatrix: Float32Array,
  lightOne: LightState,
  lightTwo: LightState
): Float32Array {
  const uniformData = new Float32Array(80);
  uniformData.set(cameraViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(lightOneViewProjectionMatrix, 32);
  uniformData.set(lightTwoViewProjectionMatrix, 48);
  uniformData.set(
    [lightOne.direction[0], lightOne.direction[1], lightOne.direction[2], 0],
    64
  );
  uniformData.set(lightOne.color, 68);
  uniformData.set(
    [lightTwo.direction[0], lightTwo.direction[1], lightTwo.direction[2], 0],
    72
  );
  uniformData.set(lightTwo.color, 76);
  return uniformData;
}

/**
 * 创建一组真正可绘制的 GPU 顶点/索引缓冲对象。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {Float32Array} vertexData 顶点数据。
 * @param {Uint16Array} indexData 索引数据。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @returns {RenderableMesh} 已经创建并填充完毕的渲染对象。
 */
function createRenderableMesh(
  device: GPUDevice,
  vertexData: Float32Array,
  indexData: Uint16Array,
  modelMatrix: Float32Array
): RenderableMesh {
  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  return {
    vertexBuffer,
    indexBuffer,
    indexCount: indexData.length,
    modelMatrix,
  };
}


/**
 * 创建一组完整的可绘制对象，包括顶点/索引缓冲、uniform 缓冲和对应 bind group。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPURenderPipeline} shadowPipeline 阴影 pass 使用的渲染管线。
 * @param {GPURenderPipeline} scenePipeline 主场景 pass 使用的渲染管线。
 * @param {GPUTextureView} shadowTextureOneView 第一张 shadow map 视图。
 * @param {GPUTextureView} shadowTextureTwoView 第二张 shadow map 视图。
 * @param {GPUSampler} shadowSampler 用于深度比较采样的比较采样器。
 * @param {Float32Array} vertexData 顶点数据。
 * @param {Uint16Array} indexData 索引数据。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @returns {RenderableObject} 已经具备完整渲染资源的对象。
 */
function createRenderableObject(
  device: GPUDevice,
  shadowPipeline: GPURenderPipeline,
  scenePipeline: GPURenderPipeline,
  shadowTextureOneView: GPUTextureView,
  shadowTextureTwoView: GPUTextureView,
  shadowSampler: GPUSampler,
  vertexData: Float32Array,
  indexData: Uint16Array,
  modelMatrix: Float32Array
): RenderableObject {
  const mesh = createRenderableMesh(device, vertexData, indexData, modelMatrix);
  const shadowUniformBufferOne = device.createBuffer({
    size: 16 * 4 * 2,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const shadowUniformBufferTwo = device.createBuffer({
    size: 16 * 4 * 2,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sceneUniformBuffer = device.createBuffer({
    size: 16 * 4 * 4 + 4 * 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shadowBindGroupOne = device.createBindGroup({
    layout: shadowPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: shadowUniformBufferOne,
        },
      },
    ],
  });
  const shadowBindGroupTwo = device.createBindGroup({
    layout: shadowPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: shadowUniformBufferTwo,
        },
      },
    ],
  });

  const sceneBindGroup = device.createBindGroup({
    layout: scenePipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: sceneUniformBuffer,
        },
      },
      {
        binding: 1,
        resource: shadowTextureOneView,
      },
      {
        binding: 2,
        resource: shadowTextureTwoView,
      },
      {
        binding: 3,
        resource: shadowSampler,
      },
    ],
  });

  return {
    ...mesh,
    shadowUniformBufferOne,
    shadowUniformBufferTwo,
    sceneUniformBuffer,
    shadowBindGroupOne,
    shadowBindGroupTwo,
    sceneBindGroup,
  };
}

/**
 * 挂载第 15 课“多光源阴影”预览，让学习者看到两张 shadow map 如何共同参与同一场景的明暗计算。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台。
 * @returns {Promise<(() => void) | void>} 成功时返回清理函数；失败时返回空结果。
 */
export async function mountMultiLightShadowsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Multi light shadows lesson preview"></canvas>
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

  let sceneDepthTexture: GPUTexture | null = null;
  let sceneDepthTextureWidth = 0;
  let sceneDepthTextureHeight = 0;

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

    const scene = createShadowSceneGeometry();
    const shadowMapSize = 1024;
    const shadowTextureOne = gpu.device.createTexture({
      size: [shadowMapSize, shadowMapSize],
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const shadowTextureTwo = gpu.device.createTexture({
      size: [shadowMapSize, shadowMapSize],
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const shadowTextureOneView = shadowTextureOne.createView();
    const shadowTextureTwoView = shadowTextureTwo.createView();
    const shadowSampler = gpu.device.createSampler({
      compare: "less-equal",
      magFilter: "linear",
      minFilter: "linear",
    });

    const shadowShaderModule = gpu.device.createShaderModule({
      code: shadowVertexShaderSource,
    });
    const sceneVertexShaderModule = gpu.device.createShaderModule({
      code: sceneVertexShaderSource,
    });
    const sceneFragmentShaderModule = gpu.device.createShaderModule({
      code: sceneFragmentShaderSource,
    });

    const shadowPipeline = gpu.device.createRenderPipeline({
      label: "lesson-15-shadow-pass",
      layout: "auto",
      vertex: {
        module: shadowShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 9 * 4,
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float",
        depthBias: 0,
        depthBiasSlopeScale: 1,
        depthBiasClamp: 0,
      },
    });

    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-15-scene-pass",
      layout: "auto",
      vertex: {
        module: sceneVertexShaderModule,
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
        module: sceneFragmentShaderModule,
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

    const floorModelMatrix = multiplyMatrices(
      createTranslationMatrix(0, -0.25, 0),
      createScaleMatrix(9.5, 0.5, 7.5)
    );
    const pillarLeftModelMatrix = multiplyMatrices(
      createTranslationMatrix(-2.15, 1.55, -1.25),
      createScaleMatrix(1, 3.1, 1)
    );
    const pillarRightModelMatrix = multiplyMatrices(
      createTranslationMatrix(2.05, 0.95, 1.25),
      createScaleMatrix(1.35, 1.9, 1.35)
    );

    const floorMesh = createRenderableObject(
      gpu.device,
      shadowPipeline,
      scenePipeline,
      shadowTextureOneView,
      shadowTextureTwoView,
      shadowSampler,
      scene.plane.vertexData,
      scene.plane.indexData,
      floorModelMatrix
    );
    const pillarLeftMesh = createRenderableObject(
      gpu.device,
      shadowPipeline,
      scenePipeline,
      shadowTextureOneView,
      shadowTextureTwoView,
      shadowSampler,
      scene.cube.vertexData,
      scene.cube.indexData,
      pillarLeftModelMatrix
    );
    const pillarRightMesh = createRenderableObject(
      gpu.device,
      shadowPipeline,
      scenePipeline,
      shadowTextureOneView,
      shadowTextureTwoView,
      shadowSampler,
      scene.cube.vertexData,
      scene.cube.indexData,
      pillarRightModelMatrix
    );

    const shadowCasters: RenderableObject[] = [pillarLeftMesh, pillarRightMesh];
    const sceneObjects: RenderableObject[] = [floorMesh, pillarLeftMesh, pillarRightMesh];

    const ensureSceneDepthTexture = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        sceneDepthTexture &&
        sceneDepthTextureWidth === width &&
        sceneDepthTextureHeight === height
      ) {
        return sceneDepthTexture;
      }

      sceneDepthTexture?.destroy();
      sceneDepthTextureWidth = width;
      sceneDepthTextureHeight = height;

      sceneDepthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      return sceneDepthTexture;
    };

    const target: Vector3 = [0, 1.15, 0.1];
    const cameraEye: Vector3 = [11.2, 8.6, 13.2];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye: cameraEye,
    });

    /**
     * 把一个对象写进 shadow pass。
     * @param {GPURenderPassEncoder} pass 当前阴影渲染通道。
     * @param {Float32Array} lightViewProjectionMatrix 当前光源视角的 VP 矩阵。
     * @param {RenderableObject} mesh 当前要投影的对象。
     * @returns {void} 只负责编码 drawIndexed，不返回额外结果。
     */
    const renderObjectToShadowPass = (
      pass: GPURenderPassEncoder,
      lightViewProjectionMatrix: Float32Array,
      shadowUniformBuffer: GPUBuffer,
      shadowBindGroup: GPUBindGroup,
      mesh: RenderableObject
    ) => {
      const shadowUniformData = createShadowUniformData(
        lightViewProjectionMatrix,
        mesh.modelMatrix
      );
      gpu.device.queue.writeBuffer(
        shadowUniformBuffer,
        0,
        shadowUniformData
      );
      pass.setBindGroup(0, shadowBindGroup);
      pass.setVertexBuffer(0, mesh.vertexBuffer);
      pass.setIndexBuffer(mesh.indexBuffer, "uint16");
      pass.drawIndexed(mesh.indexCount);
    };

    /**
     * 把一个对象写进主场景 pass。
     * @param {GPURenderPassEncoder} pass 当前主场景渲染通道。
     * @param {Float32Array} cameraViewProjectionMatrix 当前相机视角的 VP 矩阵。
     * @param {Float32Array} lightOneViewProjectionMatrix 第一盏灯的 VP 矩阵。
     * @param {Float32Array} lightTwoViewProjectionMatrix 第二盏灯的 VP 矩阵。
     * @param {LightState} lightOne 第一盏灯。
     * @param {LightState} lightTwo 第二盏灯。
     * @param {RenderableObject} mesh 当前要绘制到屏幕的对象。
     * @returns {void} 只负责编码 drawIndexed，不返回额外结果。
     */
    const renderObjectToScenePass = (
      pass: GPURenderPassEncoder,
      cameraViewProjectionMatrix: Float32Array,
      lightOneViewProjectionMatrix: Float32Array,
      lightTwoViewProjectionMatrix: Float32Array,
      lightOne: LightState,
      lightTwo: LightState,
      mesh: RenderableObject
    ) => {
      const sceneUniformData = createSceneUniformData(
        cameraViewProjectionMatrix,
        mesh.modelMatrix,
        lightOneViewProjectionMatrix,
        lightTwoViewProjectionMatrix,
        lightOne,
        lightTwo
      );
      gpu.device.queue.writeBuffer(mesh.sceneUniformBuffer, 0, sceneUniformData);
      pass.setBindGroup(0, mesh.sceneBindGroup);
      pass.setVertexBuffer(0, mesh.vertexBuffer);
      pass.setIndexBuffer(mesh.indexBuffer, "uint16");
      pass.drawIndexed(mesh.indexCount);
    };

    const render = (elapsed: number) => {
      syncViewport();
      gpu.resize();

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const cameraViewMatrix = createLookAtViewMatrix(
        camera.eye,
        target,
        camera.up
      );
      const cameraProjectionMatrix = createPerspectiveMatrix(
        (58 * Math.PI) / 180,
        aspect,
        0.1,
        120
      );
      const cameraViewProjectionMatrix = multiplyMatrices(
        cameraProjectionMatrix,
        cameraViewMatrix
      );

      const lightOnePosition: Vector3 = [
        target[0] + Math.sin(elapsed * 0.55) * 8.8,
        target[1] + 8.1,
        target[2] + Math.cos(elapsed * 0.55) * 8.8,
      ];
      const lightTwoPosition: Vector3 = [
        target[0] - Math.sin(elapsed * 0.55 + 0.8) * 8.1,
        target[1] + 6.9,
        target[2] - Math.cos(elapsed * 0.55 + 0.8) * 8.1,
      ];

      const lightOne: LightState = {
        position: lightOnePosition,
        direction: normalizeVector([
          lightOnePosition[0] - target[0],
          lightOnePosition[1] - target[1],
          lightOnePosition[2] - target[2],
        ]),
        color: [1.12, 0.54, 0.38, 1],
      };

      const lightTwo: LightState = {
        position: lightTwoPosition,
        direction: normalizeVector([
          lightTwoPosition[0] - target[0],
          lightTwoPosition[1] - target[1],
          lightTwoPosition[2] - target[2],
        ]),
        color: [0.38, 0.62, 1.08, 1],
      };

      const lightOneViewMatrix = createLookAtViewMatrix(
        lightOne.position,
        target,
        [0, 1, 0]
      );
      const lightTwoViewMatrix = createLookAtViewMatrix(
        lightTwo.position,
        target,
        [0, 1, 0]
      );
      const lightOneProjectionMatrix = createOrthographicMatrix(
        -11,
        11,
        -9,
        9,
        0.1,
        30
      );
      const lightTwoProjectionMatrix = createOrthographicMatrix(
        -11,
        11,
        -9,
        9,
        0.1,
        30
      );
      const lightOneViewProjectionMatrix = multiplyMatrices(
        lightOneProjectionMatrix,
        lightOneViewMatrix
      );
      const lightTwoViewProjectionMatrix = multiplyMatrices(
        lightTwoProjectionMatrix,
        lightTwoViewMatrix
      );

      const currentSceneDepthTexture = ensureSceneDepthTexture();
      const commandEncoder = gpu.device.createCommandEncoder();

      const shadowPassOne = commandEncoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: shadowTextureOneView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      shadowPassOne.setPipeline(shadowPipeline);
      shadowCasters.forEach((mesh) => {
        renderObjectToShadowPass(
          shadowPassOne,
          lightOneViewProjectionMatrix,
          mesh.shadowUniformBufferOne,
          mesh.shadowBindGroupOne,
          mesh
        );
      });
      shadowPassOne.end();

      const shadowPassTwo = commandEncoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: shadowTextureTwoView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      shadowPassTwo.setPipeline(shadowPipeline);
      shadowCasters.forEach((mesh) => {
        renderObjectToShadowPass(
          shadowPassTwo,
          lightTwoViewProjectionMatrix,
          mesh.shadowUniformBufferTwo,
          mesh.shadowBindGroupTwo,
          mesh
        );
      });
      shadowPassTwo.end();

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
          view: currentSceneDepthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      scenePass.setPipeline(scenePipeline);
        sceneObjects.forEach((mesh) => {
          renderObjectToScenePass(
            scenePass,
            cameraViewProjectionMatrix,
            lightOneViewProjectionMatrix,
            lightTwoViewProjectionMatrix,
            lightOne,
            lightTwo,
            mesh
          );
        });
        scenePass.end();

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
      title: "多光源阴影已运行",
      detail:
        "现在每一盏灯都会写入自己独立的 shadow map，再在主场景里分别参与阴影与光照的合成。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      window.cancelAnimationFrame(animationFrameId);
      destroyGpuTexture(sceneDepthTexture);
      shadowTextureOne.destroy();
      shadowTextureTwo.destroy();
      floorMesh.shadowUniformBufferOne.destroy();
      floorMesh.shadowUniformBufferTwo.destroy();
      pillarLeftMesh.shadowUniformBufferOne.destroy();
      pillarLeftMesh.shadowUniformBufferTwo.destroy();
      pillarRightMesh.shadowUniformBufferOne.destroy();
      pillarRightMesh.shadowUniformBufferTwo.destroy();
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

    destroyGpuTexture(sceneDepthTexture);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
