import { createWebGpuCanvas } from "@/core/webgpu";
import { createOrbitCameraController } from "@/core/orbit-camera";
import { createShadowSceneGeometry } from "@/lessons/lesson-48-shadow-mapping/cube-data";
import {
  createLookAtViewMatrix,
  createOrthographicMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-48-shadow-mapping/math";
import sceneFragmentShaderSource from "@/lessons/lesson-48-shadow-mapping/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-48-shadow-mapping/scene.vert.wgsl?raw";
import shadowVertexShaderSource from "@/lessons/lesson-48-shadow-mapping/shadow.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type RenderableMesh = {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  modelMatrix: Float32Array;
};

type RenderableObject = RenderableMesh & {
  shadowUniformBuffer: GPUBuffer;
  sceneUniformBuffer: GPUBuffer;
  shadowBindGroup: GPUBindGroup;
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
 * @param {Float32Array} lightViewProjectionMatrix 当前光源视角的 VP 矩阵。
 * @param {Vector3} lightDirection 世界空间里的光线方向。
 * @returns {Float32Array} 适合写进场景 uniform buffer 的连续 float 数据。
 */
function createSceneUniformData(
  cameraViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  lightViewProjectionMatrix: Float32Array,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(52);
  uniformData.set(cameraViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(lightViewProjectionMatrix, 32);
  uniformData.set([lightDirection[0], lightDirection[1], lightDirection[2], 0], 48);
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
 * @param {GPUTextureView} shadowTextureView 提供给主场景 pass 采样的 shadow map 视图。
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
  shadowTextureView: GPUTextureView,
  shadowSampler: GPUSampler,
  vertexData: Float32Array,
  indexData: Uint16Array,
  modelMatrix: Float32Array
): RenderableObject {
  const mesh = createRenderableMesh(device, vertexData, indexData, modelMatrix);
  const shadowUniformBuffer = device.createBuffer({
    size: 16 * 4 * 2,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const sceneUniformBuffer = device.createBuffer({
    size: 16 * 4 * 3 + 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shadowBindGroup = device.createBindGroup({
    layout: shadowPipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: shadowUniformBuffer,
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
        resource: shadowTextureView,
      },
      {
        binding: 2,
        resource: shadowSampler,
      },
    ],
  });

  return {
    ...mesh,
    shadowUniformBuffer,
    sceneUniformBuffer,
    shadowBindGroup,
    sceneBindGroup,
  };
}

/**
 * 挂载第 14 课“单光源下的多物体阴影”预览，让学习者看到同一张 shadow map 如何同时服务多个物体。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台。
 * @returns {Promise<(() => void) | void>} 成功时返回清理函数；失败时返回空结果。
 */
export async function mountMultiObjectShadowsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Multi object shadows lesson preview"></canvas>
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
    const shadowTexture = gpu.device.createTexture({
      size: [shadowMapSize, shadowMapSize],
      format: "depth32float",
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    const shadowTextureView = shadowTexture.createView();
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
      label: "lesson-14-shadow-pass",
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
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float",
      },
    });

    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-14-scene-pass",
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
    const bridgeModelMatrix = multiplyMatrices(
      createTranslationMatrix(0.25, 2.25, -0.15),
      multiplyMatrices(
        createRotationYMatrix(0.42),
        createScaleMatrix(3.4, 0.45, 1.05)
      )
    );
    const frontCubeModelMatrix = multiplyMatrices(
      createTranslationMatrix(-0.55, 0.45, 2.1),
      createScaleMatrix(0.95, 0.95, 0.95)
    );

    const floorMesh = createRenderableObject(
      gpu.device,
      shadowPipeline,
      scenePipeline,
      shadowTextureView,
      shadowSampler,
      scene.plane.vertexData,
      scene.plane.indexData,
      floorModelMatrix
    );
    const pillarLeftMesh = createRenderableObject(
      gpu.device,
      shadowPipeline,
      scenePipeline,
      shadowTextureView,
      shadowSampler,
      scene.cube.vertexData,
      scene.cube.indexData,
      pillarLeftModelMatrix
    );
    const pillarRightMesh = createRenderableObject(
      gpu.device,
      shadowPipeline,
      scenePipeline,
      shadowTextureView,
      shadowSampler,
      scene.cube.vertexData,
      scene.cube.indexData,
      pillarRightModelMatrix
    );
    const bridgeMesh = createRenderableObject(
      gpu.device,
      shadowPipeline,
      scenePipeline,
      shadowTextureView,
      shadowSampler,
      scene.cube.vertexData,
      scene.cube.indexData,
      bridgeModelMatrix
    );
    const frontCubeMesh = createRenderableObject(
      gpu.device,
      shadowPipeline,
      scenePipeline,
      shadowTextureView,
      shadowSampler,
      scene.cube.vertexData,
      scene.cube.indexData,
      frontCubeModelMatrix
    );

    const sceneObjects: RenderableObject[] = [
      floorMesh,
      pillarLeftMesh,
      pillarRightMesh,
      bridgeMesh,
      frontCubeMesh,
    ];

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
    let lightDirection: Vector3 = normalizeVector([0.42, 0.88, 0.24]);

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
      mesh: RenderableObject
    ) => {
      const shadowUniformData = createShadowUniformData(
        lightViewProjectionMatrix,
        mesh.modelMatrix
      );
      gpu.device.queue.writeBuffer(
        mesh.shadowUniformBuffer,
        0,
        shadowUniformData
      );
      pass.setBindGroup(0, mesh.shadowBindGroup);
      pass.setVertexBuffer(0, mesh.vertexBuffer);
      pass.setIndexBuffer(mesh.indexBuffer, "uint16");
      pass.drawIndexed(mesh.indexCount);
    };

    /**
     * 把一个对象写进主场景 pass。
     * @param {GPURenderPassEncoder} pass 当前主场景渲染通道。
     * @param {Float32Array} cameraViewProjectionMatrix 当前相机视角的 VP 矩阵。
     * @param {Float32Array} lightViewProjectionMatrix 当前光源视角的 VP 矩阵。
     * @param {RenderableObject} mesh 当前要绘制到屏幕的对象。
     * @returns {void} 只负责编码 drawIndexed，不返回额外结果。
     */
    const renderObjectToScenePass = (
      pass: GPURenderPassEncoder,
      cameraViewProjectionMatrix: Float32Array,
      lightViewProjectionMatrix: Float32Array,
      mesh: RenderableObject
    ) => {
      const sceneUniformData = createSceneUniformData(
        cameraViewProjectionMatrix,
        mesh.modelMatrix,
        lightViewProjectionMatrix,
        lightDirection
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

      const lightEye: Vector3 = [
        target[0] + Math.sin(elapsed * 0.55) * 8.8,
        target[1] + 7.8,
        target[2] + Math.cos(elapsed * 0.55) * 8.8,
      ];
      lightDirection = normalizeVector([
        lightEye[0] - target[0],
        lightEye[1] - target[1],
        lightEye[2] - target[2],
      ]);
      const lightViewMatrix = createLookAtViewMatrix(lightEye, target, [0, 1, 0]);
      const lightProjectionMatrix = createOrthographicMatrix(
        -11,
        11,
        -9,
        9,
        0.1,
        30
      );
      const lightViewProjectionMatrix = multiplyMatrices(
        lightProjectionMatrix,
        lightViewMatrix
      );

      const currentSceneDepthTexture = ensureSceneDepthTexture();
      const commandEncoder = gpu.device.createCommandEncoder();

      const shadowPass = commandEncoder.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: shadowTextureView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      shadowPass.setPipeline(shadowPipeline);
      sceneObjects.forEach((mesh) => {
        renderObjectToShadowPass(shadowPass, lightViewProjectionMatrix, mesh);
      });
      shadowPass.end();

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
          lightViewProjectionMatrix,
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
      title: "多物体阴影已运行",
      detail:
        "同一张 shadow map 现在会同时服务多个投影物，重点观察不同物体的阴影如何一起落到平台上。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      window.cancelAnimationFrame(animationFrameId);
      destroyGpuTexture(sceneDepthTexture);
      shadowTexture.destroy();
      sceneObjects.forEach((object) => {
        object.vertexBuffer.destroy();
        object.indexBuffer.destroy();
        object.shadowUniformBuffer.destroy();
        object.sceneUniformBuffer.destroy();
      });
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
