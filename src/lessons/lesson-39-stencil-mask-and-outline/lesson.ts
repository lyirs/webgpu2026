import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createStencilLessonGeometry } from "@/lessons/lesson-39-stencil-mask-and-outline/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-39-stencil-mask-and-outline/math";
import outlineFragmentShaderSource from "@/lessons/lesson-39-stencil-mask-and-outline/outline.frag.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-39-stencil-mask-and-outline/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-39-stencil-mask-and-outline/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  rotationY: number;
  scale: Vector3;
  color: [number, number, number, number];
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  modelMatrix: Float32Array;
};

type DepthStencilTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

/**
 * 把当前对象的 MVP、模型矩阵、颜色和主光方向打包成一份 uniform 数据。
 * @param {Float32Array} modelViewProjectionMatrix 当前对象的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {[number, number, number, number]} color 当前对象的颜色。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续 float 数据。
 */
function createObjectUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  color: [number, number, number, number],
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(40);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(color, 32);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    36
  );
  return uniformData;
}

/**
 * 组合一份对象的模型矩阵；这里先缩放，再旋转，最后平移到场景里。
 * @param {SceneObjectConfig} config 当前对象配置。
 * @param {number} [outlineScaleMultiplier] 可选的整体放大倍数，用来给描边外壳留出厚度。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createModelMatrix(
  config: SceneObjectConfig,
  outlineScaleMultiplier = 1
): Float32Array {
  return multiplyMatrices(
    createTranslationMatrix(
      config.translation[0],
      config.translation[1],
      config.translation[2]
    ),
    multiplyMatrices(
      createRotationYMatrix(config.rotationY),
      createScaleMatrix(
        config.scale[0] * outlineScaleMultiplier,
        config.scale[1] * outlineScaleMultiplier,
        config.scale[2] * outlineScaleMultiplier
      )
    )
  );
}

/**
 * 释放当前 lesson 使用的深度 + stencil 纹理。
 * @param {DepthStencilTarget} target 当前 lesson 维护的深度模板目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyDepthStencilTarget(target: DepthStencilTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 挂载第 36 课“Stencil 蒙版与描边”，演示一遍写模板、一遍按模板差值画描边的最小流程。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步 lesson 当前状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听和 GPU 资源。
 */
export async function mountStencilMaskAndOutlineLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
 ) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Stencil mask and outline lesson preview"></canvas>
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

  const depthStencilTarget: DepthStencilTarget = {
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

    const geometry = createStencilLessonGeometry();

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
    const outlineFragmentShaderModule = gpu.device.createShaderModule({
      code: outlineFragmentShaderSource,
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
      bindGroupLayouts: [objectBindGroupLayout],
    });

    const baseVertexState: GPUVertexState = {
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
    };

    const floorPipeline = gpu.device.createRenderPipeline({
      label: "lesson-36-floor",
      layout: pipelineLayout,
      vertex: baseVertexState,
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
        format: "depth24plus-stencil8",
        stencilFront: {
          compare: "always",
          failOp: "keep",
          depthFailOp: "keep",
          passOp: "keep",
        },
        stencilBack: {
          compare: "always",
          failOp: "keep",
          depthFailOp: "keep",
          passOp: "keep",
        },
        stencilReadMask: 0xff,
        stencilWriteMask: 0x00,
      },
    });

    const objectPipeline = gpu.device.createRenderPipeline({
      label: "lesson-36-object",
      layout: pipelineLayout,
      vertex: baseVertexState,
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
        format: "depth24plus-stencil8",
        stencilFront: {
          compare: "always",
          failOp: "keep",
          depthFailOp: "keep",
          // passOp replace：物体真正画出来的像素会把 stencil 写成 reference 值。
          passOp: "replace",
        },
        stencilBack: {
          compare: "always",
          failOp: "keep",
          depthFailOp: "keep",
          passOp: "replace",
        },
        stencilReadMask: 0xff,
        stencilWriteMask: 0xff,
      },
    });

    const outlinePipeline = gpu.device.createRenderPipeline({
      label: "lesson-36-outline",
      layout: pipelineLayout,
      vertex: baseVertexState,
      fragment: {
        module: outlineFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
        // cullMode front：只画放大外壳的背面，更容易留下干净的轮廓边。
        cullMode: "front",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: "depth24plus-stencil8",
        stencilFront: {
          // compare not-equal：只有不是“本体像素”的地方才允许这层外壳画出来。
          compare: "not-equal",
          failOp: "keep",
          depthFailOp: "keep",
          passOp: "keep",
        },
        stencilBack: {
          compare: "not-equal",
          failOp: "keep",
          depthFailOp: "keep",
          passOp: "keep",
        },
        stencilReadMask: 0xff,
        stencilWriteMask: 0x00,
      },
    });

    /**
     * createBuffer
     * 为场景中的每个绘制对象准备一块 uniform buffer，后面只需要每帧写入矩阵和颜色。
     * @param {GPUBufferDescriptor} descriptor GPUBuffer 描述对象，这里声明为 UNIFORM + COPY_DST。
     * @returns {GPUBuffer} 当前对象自己的 uniform 缓冲区。
     */
    const createRenderObject = (config: SceneObjectConfig): RenderObject => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 40 * 4,
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
        modelMatrix: createModelMatrix(config),
      };
    };

    const floorObject = createRenderObject({
      label: "floor",
      translation: [0, -0.22, 0],
      rotationY: 0,
      scale: [5.6, 0.22, 5.6],
      color: [0.14, 0.19, 0.29, 1],
    });

    const cubeObject = createRenderObject({
      label: "cube",
      translation: [0, 1.12, 0],
      rotationY: 0.58,
      scale: [1.05, 1.68, 1.05],
      color: [0.79, 0.86, 0.96, 1],
    });

    const outlineObject = createRenderObject({
      label: "outline",
      translation: cubeObject.config.translation,
      rotationY: cubeObject.config.rotationY,
      scale: cubeObject.config.scale,
      color: [1.0, 0.62, 0.24, 1],
    });

    /**
     * 根据当前画布像素尺寸重建深度 + stencil 附件。
     * @returns {GPUTextureView | null} 当前可用的深度模板视图。
     */
    const ensureDepthStencilTarget = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        depthStencilTarget.view &&
        depthStencilTarget.width === width &&
        depthStencilTarget.height === height
      ) {
        return depthStencilTarget.view;
      }

      destroyDepthStencilTarget(depthStencilTarget);

      depthStencilTarget.texture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus-stencil8",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthStencilTarget.view = depthStencilTarget.texture.createView();
      depthStencilTarget.width = width;
      depthStencilTarget.height = height;

      return depthStencilTarget.view;
    };

    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, 1.0, 0],
      eye: [5.2, 3.8, 6.2],
      minRadius: 4.2,
      maxRadius: 11.5,
      onChange: () => render(),
    });

    const lightDirection = normalizeVector([0.45, 1.0, 0.35]);

    /**
     * 用当前相机状态重写场景和描边外壳的 uniform，并录制一帧 stencil 演示命令。
     * @returns {void} 只负责编码和提交当前帧。
     */
    const render = () => {
      syncViewport();
      gpu.resize();

      const depthStencilView = ensureDepthStencilTarget();
      if (!depthStencilView) {
        return;
      }

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(
        camera.eye,
        camera.target,
        camera.up
      );
      const projectionMatrix = createPerspectiveMatrix(
        (45 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);

      floorObject.modelMatrix = createModelMatrix(floorObject.config);
      cubeObject.modelMatrix = createModelMatrix(cubeObject.config);
      outlineObject.modelMatrix = createModelMatrix(outlineObject.config, 1.12);

      const updateObjectUniforms = (object: RenderObject) => {
        const modelViewProjectionMatrix = multiplyMatrices(
          viewProjectionMatrix,
          object.modelMatrix
        );
        gpu.device.queue.writeBuffer(
          object.uniformBuffer,
          0,
          createObjectUniformData(
            modelViewProjectionMatrix,
            object.modelMatrix,
            object.config.color,
            lightDirection
          )
        );
      };

      updateObjectUniforms(floorObject);
      updateObjectUniforms(cubeObject);
      updateObjectUniforms(outlineObject);

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-36-command-encoder",
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.039, g: 0.066, b: 0.128, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthStencilView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
          stencilClearValue: 0,
          stencilLoadOp: "clear",
          stencilStoreOp: "store",
        },
      });

      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");

      pass.setPipeline(floorPipeline);
      pass.setBindGroup(0, floorObject.bindGroup);
      pass.drawIndexed(geometry.indexCount);

      pass.setPipeline(objectPipeline);
      /**
       * setStencilReference(1)：把本体写进 stencil 时使用的“标记值”设成 1。
       */
      pass.setStencilReference(1);
      pass.setBindGroup(0, cubeObject.bindGroup);
      pass.drawIndexed(geometry.indexCount);

      pass.setPipeline(outlinePipeline);
      /**
       * stencil compare not-equal + reference 1：只有 stencil 不是 1 的像素，外壳才能留下来。
       */
      pass.setStencilReference(1);
      pass.setBindGroup(0, outlineObject.bindGroup);
      pass.drawIndexed(geometry.indexCount);

      pass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    const resizeObserver = new ResizeObserver(() => {
      render();
    });
    resizeObserver.observe(host);

    render();

    setStatus({
      title: "Stencil 描边已运行",
      detail:
        "平台会先正常绘制，本体立方体会把 stencil 写成 1，然后放大外壳只在 stencil != 1 的地方出现，这一课重点就是模板写入和描边外壳之间的关系。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      destroyDepthStencilTarget(depthStencilTarget);
      floorObject.uniformBuffer.destroy();
      cubeObject.uniformBuffer.destroy();
      outlineObject.uniformBuffer.destroy();
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

    destroyDepthStencilTarget(depthStencilTarget);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
