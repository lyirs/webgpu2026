import {
  createWorkerThreadLessonGeometry,
  type WorkerThreadLessonGeometry,
} from "@/lessons/lesson-106-worker-and-off-main-thread/geometry";
import {
  createAnimatedModelMatrix,
  createFrameUniformData,
  createObjectUniformData,
  createSceneFrameData,
  createWorkerOffMainThreadSceneConfigs,
  MAX_PIXEL_RATIO,
  type SceneObjectConfig,
  type SharedRenderSettings,
} from "@/lessons/lesson-106-worker-and-off-main-thread/shared";
import fragmentShaderSource from "@/lessons/lesson-106-worker-and-off-main-thread/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-106-worker-and-off-main-thread/scene.vert.wgsl?raw";

type CanvasDimensions = {
  cssWidth: number;
  cssHeight: number;
  pixelRatio: number;
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

export type ThreadRenderer = {
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  resize: (dimensions: CanvasDimensions) => void;
  render: (timeSeconds: number, settings: SharedRenderSettings) => void;
  destroy: () => void;
};

/**
 * 销毁当前画布的深度附件，避免旧尺寸纹理继续占资源。
 * @param {DepthTarget} target 当前深度附件状态。
 * @returns {void} 只负责销毁纹理，不返回额外结果。
 */
function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
  target.width = 0;
  target.height = 0;
}

/**
 * 按当前像素尺寸确保深度附件可用。
 * @param {GPUDevice} device 当前渲染器使用的 GPUDevice。
 * @param {DepthTarget} target 当前深度附件状态。
 * @param {number} width 目标宽度。
 * @param {number} height 目标高度。
 * @returns {GPUTextureView} 一份可直接塞进 render pass 的深度视图。
 */
function ensureDepthTarget(
  device: GPUDevice,
  target: DepthTarget,
  width: number,
  height: number
): GPUTextureView {
  if (target.view && target.width === width && target.height === height) {
    return target.view;
  }

  destroyDepthTarget(target);
  target.texture = device.createTexture({
    size: [width, height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  target.view = target.texture.createView();
  target.width = width;
  target.height = height;
  return target.view;
}

/**
 * 创建这一课要复用的一套渲染器，既可以跑在主线程，也可以跑在 worker。
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas 当前线程持有的画布对象。
 * @param {CanvasDimensions} initialDimensions 初始 CSS 尺寸和像素比。
 * @returns {Promise<ThreadRenderer>} 一个可以 resize / render / destroy 的运行时对象。
 */
export async function createThreadRenderer(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  initialDimensions: CanvasDimensions
): Promise<ThreadRenderer> {
  if (!("gpu" in navigator)) {
    throw new Error("当前环境没有提供 WebGPU。");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("没有拿到可用的 GPUAdapter。");
  }

  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");

  if (!context) {
    throw new Error("没有拿到 WebGPUCanvasContext。");
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  const geometry: WorkerThreadLessonGeometry = createWorkerThreadLessonGeometry();
  const sceneConfigs = createWorkerOffMainThreadSceneConfigs();
  const depthTarget: DepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };

  const vertexBuffer = device.createBuffer({
    size: geometry.vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, geometry.vertexData);

  const indexBuffer = device.createBuffer({
    size: geometry.indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, geometry.indexData);

  const frameUniformBuffer = device.createBuffer({
    size: 24 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shaderModule = device.createShaderModule({ code: vertexShaderSource });
  const fragmentModule = device.createShaderModule({ code: fragmentShaderSource });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shaderModule,
      entryPoint: "vsMain",
      buffers: [
        {
          arrayStride: 6 * Float32Array.BYTES_PER_ELEMENT,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3",
            },
            {
              shaderLocation: 1,
              offset: 3 * Float32Array.BYTES_PER_ELEMENT,
              format: "float32x3",
            },
          ],
        },
      ],
    },
    fragment: {
      module: fragmentModule,
      entryPoint: "fsMain",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  const frameBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: frameUniformBuffer },
      },
    ],
  });

  const renderObjects: RenderObject[] = sceneConfigs.map((config) => {
    const uniformBuffer = device.createBuffer({
      size: 24 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    return {
      config,
      uniformBuffer,
      bindGroup: device.createBindGroup({
        layout: pipeline.getBindGroupLayout(1),
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      }),
    };
  });

  let pixelWidth = 1;
  let pixelHeight = 1;

  /**
   * 把传进来的 CSS 尺寸同步成当前画布真正的像素尺寸，并重新 configure context。
   * @param {CanvasDimensions} dimensions 当前测到的 CSS 宽高和 DPR。
   * @returns {void} 只更新尺寸与 context 配置，不返回额外结果。
   */
  const applyDimensions = (dimensions: CanvasDimensions): void => {
    const appliedPixelRatio = Math.min(
      Math.max(dimensions.pixelRatio || 1, 1),
      MAX_PIXEL_RATIO
    );
    pixelWidth = Math.max(1, Math.floor(dimensions.cssWidth * appliedPixelRatio));
    pixelHeight = Math.max(1, Math.floor(dimensions.cssHeight * appliedPixelRatio));
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;

    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
  };

  applyDimensions(initialDimensions);

  return {
    get pixelWidth() {
      return pixelWidth;
    },
    get pixelHeight() {
      return pixelHeight;
    },
    resize(nextDimensions) {
      applyDimensions(nextDimensions);
    },
    render(timeSeconds, settings) {
      const depthView = ensureDepthTarget(device, depthTarget, pixelWidth, pixelHeight);
      const frameData = createSceneFrameData(pixelWidth / pixelHeight, timeSeconds, settings);
      device.queue.writeBuffer(
        frameUniformBuffer,
        0,
        createFrameUniformData(
          frameData.viewProjectionMatrix,
          frameData.lightPosition,
          frameData.eyePosition
        )
      );

      for (const object of renderObjects) {
        device.queue.writeBuffer(
          object.uniformBuffer,
          0,
          createObjectUniformData(
            createAnimatedModelMatrix(object.config, timeSeconds, settings),
            object.config.color,
            object.config.surfaceMode,
            object.config.detailScale
          )
        );
      }

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.028, g: 0.062, b: 0.112, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: depthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");
      pass.setBindGroup(0, frameBindGroup);

      for (const object of renderObjects) {
        pass.setBindGroup(1, object.bindGroup);
        pass.drawIndexed(geometry.indexCount);
      }

      pass.end();
      device.queue.submit([encoder.finish()]);
    },
    destroy() {
      destroyDepthTarget(depthTarget);
      vertexBuffer.destroy();
      indexBuffer.destroy();
      frameUniformBuffer.destroy();
      renderObjects.forEach((object) => object.uniformBuffer.destroy());
    },
  };
}
