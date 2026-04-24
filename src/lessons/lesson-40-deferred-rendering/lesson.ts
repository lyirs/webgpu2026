import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createDeferredSceneGeometry } from "@/lessons/lesson-40-deferred-rendering/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-40-deferred-rendering/math";
import gbufferFragmentShaderSource from "@/lessons/lesson-40-deferred-rendering/gbuffer.frag.wgsl?raw";
import gbufferVertexShaderSource from "@/lessons/lesson-40-deferred-rendering/gbuffer.vert.wgsl?raw";
import lightingFragmentShaderSource from "@/lessons/lesson-40-deferred-rendering/lighting.frag.wgsl?raw";
import lightingVertexShaderSource from "@/lessons/lesson-40-deferred-rendering/lighting.vert.wgsl?raw";

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

type GBufferTargets = {
  albedoTexture: GPUTexture | null;
  albedoView: GPUTextureView | null;
  normalTexture: GPUTexture | null;
  normalView: GPUTextureView | null;
  worldPositionTexture: GPUTexture | null;
  worldPositionView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  lightingBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

/**
 * 把当前对象的 MVP、模型矩阵和基色打包成一份 uniform 数据。
 * @param {Float32Array} modelViewProjectionMatrix 当前对象的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {[number, number, number, number]} color 当前对象的基色。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续 float 数据。
 */
function createObjectUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  color: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(color, 32);
  return uniformData;
}

/**
 * 把当前帧 4 盏点光源的位置、颜色和环境光打包成一份 uniform 数据。
 * @param {Vector3[]} positions 当前帧光源位置列表。
 * @param {[number, number, number, number][]} colors 当前帧光源颜色列表。
 * @returns {Float32Array} 适合直接写进 uniform buffer 的连续 float 数据。
 */
function createLightUniformData(
  positions: Vector3[],
  colors: [number, number, number, number][]
): Float32Array {
  const uniformData = new Float32Array(36);

  positions.forEach((position, index) => {
    uniformData.set([position[0], position[1], position[2], 1], index * 4);
  });
  colors.forEach((color, index) => {
    uniformData.set(color, 16 + index * 4);
  });
  uniformData.set([0.08, 0.08, 0.11, 1], 32);

  return uniformData;
}

/**
 * 用平移、旋转和缩放组合一份对象的模型矩阵。
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
 * 安全释放当前 lesson 使用的全部 G-buffer / depth 纹理。
 * @param {GBufferTargets} targets 当前 lesson 管理的离屏目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyGBufferTargets(targets: GBufferTargets): void {
  targets.albedoTexture?.destroy();
  targets.normalTexture?.destroy();
  targets.worldPositionTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.albedoTexture = null;
  targets.albedoView = null;
  targets.normalTexture = null;
  targets.normalView = null;
  targets.worldPositionTexture = null;
  targets.worldPositionView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.lightingBindGroup = null;
}

/**
 * 挂载第 37 课“Deferred Rendering 基础”，演示一遍几何阶段写 G-buffer，再统一做光照的最小流程。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步 lesson 当前状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源。
 */
export async function mountDeferredRenderingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Deferred rendering lesson preview"></canvas>
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

  const renderTargets: GBufferTargets = {
    albedoTexture: null,
    albedoView: null,
    normalTexture: null,
    normalView: null,
    worldPositionTexture: null,
    worldPositionView: null,
    depthTexture: null,
    depthView: null,
    lightingBindGroup: null,
    width: 0,
    height: 0,
  };

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

    syncViewport();

    const geometry = createDeferredSceneGeometry();

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

    const geometryShaderModule = gpu.device.createShaderModule({
      code: gbufferVertexShaderSource,
    });
    const gbufferFragmentShaderModule = gpu.device.createShaderModule({
      code: gbufferFragmentShaderSource,
    });
    const lightingVertexShaderModule = gpu.device.createShaderModule({
      code: lightingVertexShaderSource,
    });
    const lightingFragmentShaderModule = gpu.device.createShaderModule({
      code: lightingFragmentShaderSource,
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

    const geometryPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [objectBindGroupLayout],
    });

    const geometryPipeline = gpu.device.createRenderPipeline({
      label: "lesson-37-geometry-pass",
      layout: geometryPipelineLayout,
      vertex: {
        module: geometryShaderModule,
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
        module: gbufferFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [
          { format: "rgba8unorm" },
          { format: "rgba16float" },
          { format: "rgba16float" },
        ],
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

    const lightUniformBuffer = gpu.device.createBuffer({
      size: 36 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const lightingBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const lightingPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [lightingBindGroupLayout],
    });

    const lightingPipeline = gpu.device.createRenderPipeline({
      label: "lesson-37-lighting-pass",
      layout: lightingPipelineLayout,
      vertex: {
        module: lightingVertexShaderModule,
        entryPoint: "vsMain",
      },
      fragment: {
        module: lightingFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const sceneObjects: SceneObjectConfig[] = [
      {
        label: "floor",
        translation: [0, -1.2, 0],
        rotationY: 0,
        scale: [5.8, 0.24, 5.8],
        color: [0.20, 0.23, 0.30, 1],
      },
      {
        label: "tower-left",
        translation: [-2.1, 0.6, -1.4],
        rotationY: 0.28,
        scale: [0.85, 1.8, 0.85],
        color: [0.93, 0.48, 0.29, 1],
      },
      {
        label: "tower-right",
        translation: [1.7, 0.1, 0.9],
        rotationY: -0.45,
        scale: [1.2, 1.25, 1.2],
        color: [0.21, 0.68, 0.91, 1],
      },
      {
        label: "center-block",
        translation: [0, 1.15, 2.2],
        rotationY: 0,
        scale: [0.7, 0.7, 0.7],
        color: [0.95, 0.83, 0.33, 1],
      },
    ];

    const renderObjects: RenderObject[] = sceneObjects.map((config) => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 36 * 4,
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
    });

    /**
     * 根据当前画布尺寸创建或重建 G-buffer 纹理、深度纹理和光照 pass bind group。
     * @returns {GPUBindGroup} 当前帧 lighting pass 要使用的 bind group。
     */
    const ensureRenderTargets = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        renderTargets.lightingBindGroup &&
        renderTargets.width === width &&
        renderTargets.height === height
      ) {
        return renderTargets.lightingBindGroup;
      }

      destroyGBufferTargets(renderTargets);

      renderTargets.albedoTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      renderTargets.albedoView = renderTargets.albedoTexture.createView();

      renderTargets.normalTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      renderTargets.normalView = renderTargets.normalTexture.createView();

      renderTargets.worldPositionTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      renderTargets.worldPositionView = renderTargets.worldPositionTexture.createView();

      renderTargets.depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      renderTargets.depthView = renderTargets.depthTexture.createView();

      renderTargets.lightingBindGroup = gpu.device.createBindGroup({
        layout: lightingBindGroupLayout,
        entries: [
          { binding: 0, resource: renderTargets.albedoView },
          { binding: 1, resource: renderTargets.normalView },
          { binding: 2, resource: renderTargets.worldPositionView },
          { binding: 3, resource: { buffer: lightUniformBuffer } },
        ],
      });

      renderTargets.width = width;
      renderTargets.height = height;

      return renderTargets.lightingBindGroup;
    };

    const orbitCamera = createOrbitCameraController(canvas, {
      eye: [9, 7, 11],
      target: [0, 0.8, 0],
      up: [0, 1, 0],
      minRadius: 6.5,
      maxRadius: 18,
      rotateSpeed: 0.01,
      zoomSpeed: 0.0035,
      onChange: () => render(performance.now()),
    });

    let animationFrameId = 0;

    /**
     * 录制一帧 deferred rendering：先几何 pass 写 G-buffer，再全屏光照 pass 读 G-buffer。
     * @param {number} timestamp 当前动画时间戳，用来让点光源缓慢绕场景运动。
     * @returns {void} 只负责编码并提交当前帧命令。
     */
    const render = (timestamp: number) => {
      syncViewport();
      gpu.resize();

      const lightingBindGroup = ensureRenderTargets();
      if (
        !renderTargets.albedoView ||
        !renderTargets.normalView ||
        !renderTargets.worldPositionView ||
        !renderTargets.depthView
      ) {
        return;
      }

      const camera = orbitCamera.getSnapshot();
      const aspect = canvas.width / canvas.height;
      const projectionMatrix = createPerspectiveMatrix(
        Math.PI / 3.2,
        aspect,
        0.1,
        80
      );
      const viewMatrix = createLookAtViewMatrix(
        camera.eye,
        camera.target,
        [0, 1, 0]
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);

      const time = timestamp * 0.001;
      const lightPositions: Vector3[] = [
        [Math.cos(time * 0.8) * 4.2, 3.4, Math.sin(time * 0.8) * 4.2],
        [Math.cos(time * 0.65 + 1.7) * 3.1, 2.4, Math.sin(time * 0.65 + 1.7) * 3.1],
        [Math.cos(time * 0.9 + 3.2) * 2.6, 4.3, Math.sin(time * 0.9 + 3.2) * 2.6],
        [Math.cos(time * 0.55 + 4.5) * 4.7, 2.9, Math.sin(time * 0.55 + 4.5) * 4.7],
      ];
      const lightColors: [number, number, number, number][] = [
        [1.0, 0.42, 0.24, 3.2],
        [0.24, 0.76, 1.0, 2.8],
        [1.0, 0.88, 0.35, 2.5],
        [0.55, 1.0, 0.48, 2.2],
      ];
      gpu.device.queue.writeBuffer(
        lightUniformBuffer,
        0,
        createLightUniformData(lightPositions, lightColors)
      );

      renderObjects.forEach((object) => {
        const modelViewProjectionMatrix = multiplyMatrices(
          viewProjectionMatrix,
          object.modelMatrix
        );
        const uniformData = createObjectUniformData(
          modelViewProjectionMatrix,
          object.modelMatrix,
          object.config.color
        );
        gpu.device.queue.writeBuffer(object.uniformBuffer, 0, uniformData);
      });

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-37-command-encoder",
      });

      const geometryPass = commandEncoder.beginRenderPass({
        label: "lesson-37-geometry-pass",
        colorAttachments: [
          {
            view: renderTargets.albedoView,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
          {
            view: renderTargets.normalView,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
          {
            view: renderTargets.worldPositionView,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: renderTargets.depthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      geometryPass.setPipeline(geometryPipeline);
      geometryPass.setVertexBuffer(0, vertexBuffer);
      geometryPass.setIndexBuffer(indexBuffer, "uint16");
      renderObjects.forEach((object) => {
        geometryPass.setBindGroup(0, object.bindGroup);
        geometryPass.drawIndexed(geometry.indexCount);
      });
      geometryPass.end();

      const lightingPass = commandEncoder.beginRenderPass({
        label: "lesson-37-lighting-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.039, g: 0.070, b: 0.133, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      lightingPass.setPipeline(lightingPipeline);
      lightingPass.setBindGroup(0, lightingBindGroup);
      lightingPass.draw(3);
      lightingPass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    const frame = (timestamp: number) => {
      render(timestamp);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    syncViewport();
    render(performance.now());
    animationFrameId = window.requestAnimationFrame(frame);

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      destroyGBufferTargets(renderTargets);
      render(performance.now());
    });
    resizeObserver.observe(host);

    setStatus({
      title: "Deferred Rendering 已运行",
      detail:
        "现在会先写 G-buffer，再用全屏光照 pass 统一累加多盏点光源；右上角三块小图分别是 albedo、normal 和 world position。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitCamera.dispose();
      destroyGBufferTargets(renderTargets);
      vertexBuffer.destroy();
      indexBuffer.destroy();
      lightUniformBuffer.destroy();
      renderObjects.forEach((object) => object.uniformBuffer.destroy());
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
