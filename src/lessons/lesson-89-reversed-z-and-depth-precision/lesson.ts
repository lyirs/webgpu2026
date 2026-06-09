import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createDepthPrecisionSceneGeometry } from "@/lessons/lesson-89-reversed-z-and-depth-precision/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createReversedZPerspectiveMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-89-reversed-z-and-depth-precision/math";
import presentFragmentShaderSource from "@/lessons/lesson-89-reversed-z-and-depth-precision/present.frag.wgsl?raw";
import presentVertexShaderSource from "@/lessons/lesson-89-reversed-z-and-depth-precision/present.vert.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-89-reversed-z-and-depth-precision/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-89-reversed-z-and-depth-precision/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type RenderTargetBundle = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  width: number;
  height: number;
};

type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  scale: Vector3;
  color: [number, number, number, number];
};

type RenderObject = {
  config: SceneObjectConfig;
  modelMatrix: Float32Array;
  normalUniformBuffer: GPUBuffer;
  normalBindGroup: GPUBindGroup;
  reversedUniformBuffer: GPUBuffer;
  reversedBindGroup: GPUBindGroup;
};

/**
 * 把当前对象的 MVP 矩阵和基础颜色打包成一份 uniform 数据。
 * @param {Float32Array} modelViewProjectionMatrix 当前对象的 MVP 矩阵。
 * @param {[number, number, number, number]} color 当前对象的 RGBA 颜色。
 * @returns {Float32Array} 可直接写进 GPU uniform buffer 的连续数据。
 */
function createObjectUniformData(
  modelViewProjectionMatrix: Float32Array,
  color: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(color, 16);
  return uniformData;
}

/**
 * 组合平移与缩放，生成场景里每个地板或标线的模型矩阵。
 * @param {Vector3} translation 当前对象的平移。
 * @param {Vector3} scale 当前对象的缩放。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createModelMatrix(
  translation: Vector3,
  scale: Vector3
): Float32Array {
  return multiplyMatrices(
    createTranslationMatrix(translation[0], translation[1], translation[2]),
    createScaleMatrix(scale[0], scale[1], scale[2])
  );
}

/**
 * 安全释放一组离屏颜色与深度目标。
 * @param {RenderTargetBundle} bundle 当前要销毁的渲染目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyRenderTargetBundle(bundle: RenderTargetBundle): void {
  bundle.colorTexture?.destroy();
  bundle.depthTexture?.destroy();
  bundle.colorTexture = null;
  bundle.colorView = null;
  bundle.depthTexture = null;
  bundle.depthView = null;
}

/**
 * 挂载第 35 课“Reversed-Z 与深度精度”，左右对比普通深度与 Reversed-Z 在远处贴地标线上的稳定性差异。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountReversedZAndDepthPrecisionLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Reversed-Z and depth precision lesson preview"></canvas>
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

  const normalTarget: RenderTargetBundle = {
    colorTexture: null,
    colorView: null,
    depthTexture: null,
    depthView: null,
    width: 0,
    height: 0,
  };
  const reversedTarget: RenderTargetBundle = {
    colorTexture: null,
    colorView: null,
    depthTexture: null,
    depthView: null,
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

    const geometry = createDepthPrecisionSceneGeometry();

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
    const presentVertexShaderModule = gpu.device.createShaderModule({
      code: presentVertexShaderSource,
    });
    const presentFragmentShaderModule = gpu.device.createShaderModule({
      code: presentFragmentShaderSource,
    });

    const objectBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: {
            type: "uniform",
          },
        },
      ],
    });

    const objectPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [objectBindGroupLayout],
    });

    const scenePipelineBase: Omit<GPURenderPipelineDescriptor, "depthStencil" | "label"> =
      {
        layout: objectPipelineLayout,
        vertex: {
          module: sceneVertexShaderModule,
          entryPoint: "vsMain",
          buffers: [
            {
              arrayStride: 3 * 4,
              attributes: [
                {
                  // shaderLocation 0：位置，占 3 个 float32，对应 WGSL 里的 vec3f。
                  shaderLocation: 0,
                  offset: 0,
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
          cullMode: "none",
        },
      };

    /**
     * createRenderPipeline：左边维持普通 depth，保留 WebGPU 新手最熟悉的 less + clear 1 组合。
     */
    const normalDepthPipeline = gpu.device.createRenderPipeline({
      ...scenePipelineBase,
      label: "lesson-35-normal-depth",
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth32float",
      },
    });

    /**
     * createRenderPipeline：右边切到 Reversed-Z，对应 greater + clear 0 组合。
     */
    const reversedDepthPipeline = gpu.device.createRenderPipeline({
      ...scenePipelineBase,
      label: "lesson-35-reversed-z",
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "greater",
        format: "depth32float",
      },
    });

    const presentSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-35-present",
      layout: "auto",
      vertex: {
        module: presentVertexShaderModule,
        entryPoint: "vsMain",
      },
      fragment: {
        module: presentFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const backCardColor: [number, number, number, number] = [0.22, 0.27, 0.36, 1];
    const frontCardColor: [number, number, number, number] = [1.0, 0.72, 0.22, 1];
    const layoutAspect = 8 / 9;
    const fieldOfView = (18 * Math.PI) / 180;
    const projectionTan = Math.tan(fieldOfView * 0.5);

    const projectCardCenter = (
      distance: number,
      ndcX: number,
      ndcY: number
    ): Vector3 => [
      ndcX * distance * projectionTan * layoutAspect,
      ndcY * distance * projectionTan,
      -distance,
    ];

    const projectCardScale = (
      distance: number,
      ndcWidth: number,
      ndcHeight: number
    ): Vector3 => [
      ndcWidth * distance * projectionTan * layoutAspect,
      ndcHeight * distance * projectionTan,
      1,
    ];

    const cardTests = [
      {
        label: "near",
        distance: 200,
        centerNdc: [0, 0.58],
        sizeNdc: [0.16, 0.24],
        delta: 0.8,
      },
      {
        label: "mid",
        distance: 4000,
        centerNdc: [0, 0],
        sizeNdc: [0.16, 0.24],
        delta: 150,
      },
      {
        label: "far",
        distance: 60000,
        centerNdc: [0, -0.58],
        sizeNdc: [0.16, 0.24],
        delta: 60,
      },
    ] as const;

    const objectConfigs: SceneObjectConfig[] = cardTests.flatMap((card) => {
      const center = projectCardCenter(
        card.distance,
        card.centerNdc[0],
        card.centerNdc[1]
      );
      const frontScale = projectCardScale(
        card.distance,
        card.sizeNdc[0],
        card.sizeNdc[1]
      );
      const backScale: Vector3 = [frontScale[0] * 1.25, frontScale[1] * 1.25, 1];

      return [
        {
          label: `back-card-${card.label}`,
          translation: center,
          scale: backScale,
          color: backCardColor,
        },
        {
          label: `front-card-${card.label}`,
          translation: [center[0], center[1], center[2] + card.delta],
          scale: frontScale,
          color: frontCardColor,
        },
      ];
    });

    const renderObjects = objectConfigs.map((config) => {
      const normalUniformBuffer = gpu.device.createBuffer({
        size: 20 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const reversedUniformBuffer = gpu.device.createBuffer({
        size: 20 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const normalBindGroup = gpu.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: normalUniformBuffer },
          },
        ],
      });

      const reversedBindGroup = gpu.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: reversedUniformBuffer },
          },
        ],
      });

      return {
        config,
        modelMatrix: createModelMatrix(config.translation, config.scale),
        normalUniformBuffer,
        normalBindGroup,
        reversedUniformBuffer,
        reversedBindGroup,
      } satisfies RenderObject;
    });

    /**
     * 根据半屏尺寸重建左右两组离屏渲染目标。
     * @returns {void} 只在尺寸变化时更新颜色和深度纹理，不返回额外结果。
     */
    const ensureRenderTargets = () => {
      const panelWidth = Math.max(1, Math.floor(canvas.width * 0.5));
      const panelHeight = Math.max(1, canvas.height);

      const ensureBundle = (bundle: RenderTargetBundle) => {
        if (
          bundle.colorView &&
          bundle.depthView &&
          bundle.width === panelWidth &&
          bundle.height === panelHeight
        ) {
          return;
        }

        destroyRenderTargetBundle(bundle);
        bundle.width = panelWidth;
        bundle.height = panelHeight;

        bundle.colorTexture = gpu.device.createTexture({
          size: [panelWidth, panelHeight],
          format: gpu.format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        bundle.colorView = bundle.colorTexture.createView();

        bundle.depthTexture = gpu.device.createTexture({
          size: [panelWidth, panelHeight],
          format: "depth32float",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        bundle.depthView = bundle.depthTexture.createView();
      };

      ensureBundle(normalTarget);
      ensureBundle(reversedTarget);
    };

    let presentBindGroup: GPUBindGroup | null = null;
    let presentBindGroupWidth = 0;
    let presentBindGroupHeight = 0;

    /**
     * 在左右离屏纹理尺寸变化后重建 present bind group。
     * @returns {GPUBindGroup} 当前 frame 的屏幕合成 bind group。
     */
    const ensurePresentBindGroup = () => {
      const panelWidth = Math.max(1, Math.floor(canvas.width * 0.5));
      const panelHeight = Math.max(1, canvas.height);

      if (
        presentBindGroup &&
        presentBindGroupWidth === panelWidth &&
        presentBindGroupHeight === panelHeight
      ) {
        return presentBindGroup;
      }

      presentBindGroup = gpu.device.createBindGroup({
        layout: presentPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: presentSampler,
          },
          {
            binding: 1,
            resource: normalTarget.colorView!,
          },
          {
            binding: 2,
            resource: reversedTarget.colorView!,
          },
        ],
      });
      presentBindGroupWidth = panelWidth;
      presentBindGroupHeight = panelHeight;
      return presentBindGroup;
    };

    let render = () => {};

    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, 0, -12000],
      eye: [0, 0, 0],
      minRadius: 120,
      maxRadius: 12000,
      rotateSpeed: 0.008,
      zoomSpeed: 0.35,
      onChange: () => render(),
    });

    const updateObjectUniforms = (
      viewProjectionMatrix: Float32Array,
      target: "normal" | "reversed"
    ) => {
      renderObjects.forEach((object) => {
        const modelViewProjectionMatrix = multiplyMatrices(
          viewProjectionMatrix,
          object.modelMatrix
        );
        const uniformData = createObjectUniformData(
          modelViewProjectionMatrix,
          object.config.color
        );
        gpu.device.queue.writeBuffer(
          target === "normal"
            ? object.normalUniformBuffer
            : object.reversedUniformBuffer,
          0,
          uniformData
        );
      });
    };

    const drawScenePass = (
      commandEncoder: GPUCommandEncoder,
      pipeline: GPURenderPipeline,
      target: RenderTargetBundle,
      depthClearValue: number,
      bindGroupKey: "normal" | "reversed"
    ) => {
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: target.colorView!,
            clearValue: { r: 0.03, g: 0.055, b: 0.11, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: target.depthView!,
          depthClearValue,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");

      renderObjects.forEach((object) => {
        pass.setBindGroup(
          0,
          bindGroupKey === "normal"
            ? object.normalBindGroup
            : object.reversedBindGroup
        );
        pass.drawIndexed(geometry.indexCount);
      });

      pass.end();
    };

    render = () => {
      syncViewport();
      gpu.resize();
      ensureRenderTargets();

      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(
        camera.eye,
        camera.target,
        camera.up
      );
      const panelAspect = Math.max(
        Math.floor(canvas.width * 0.5) / Math.max(canvas.height, 1),
        1e-6
      );
      const near = 0.01;
      const far = 120000;
      const normalProjectionMatrix = createPerspectiveMatrix(
        fieldOfView,
        panelAspect,
        near,
        far
      );
      const reversedProjectionMatrix = createReversedZPerspectiveMatrix(
        fieldOfView,
        panelAspect,
        near,
        far
      );
      const normalViewProjectionMatrix = multiplyMatrices(
        normalProjectionMatrix,
        viewMatrix
      );
      const reversedViewProjectionMatrix = multiplyMatrices(
        reversedProjectionMatrix,
        viewMatrix
      );

      updateObjectUniforms(normalViewProjectionMatrix, "normal");
      updateObjectUniforms(reversedViewProjectionMatrix, "reversed");

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-35-command-encoder",
      });

      // 左边：普通深度，远处贴地标线更容易在低 near / 高 far 比例下开始发抖。
      drawScenePass(
        commandEncoder,
        normalDepthPipeline,
        normalTarget,
        1,
        "normal"
      );

      // 右边：Reversed-Z，把远处深度精度拉回来，贴地标线会稳定得多。
      drawScenePass(
        commandEncoder,
        reversedDepthPipeline,
        reversedTarget,
        0,
        "reversed"
      );

      const presentPass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.032, g: 0.059, b: 0.116, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      presentPass.setPipeline(presentPipeline);
      presentPass.setBindGroup(0, ensurePresentBindGroup());
      presentPass.draw(3);
      presentPass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    const resizeObserver = new ResizeObserver(() => {
      render();
    });
    resizeObserver.observe(host);

    render();

    setStatus({
      title: "Reversed-Z 与深度精度已运行",
      detail:
        "左边是普通深度，右边是 Reversed-Z；上中下三组分别对应近、中、远距离，越往下越应该更容易看出普通深度先开始保不住前景卡片。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      destroyRenderTargetBundle(normalTarget);
      destroyRenderTargetBundle(reversedTarget);
      renderObjects.forEach((object) => {
        object.normalUniformBuffer.destroy();
        object.reversedUniformBuffer.destroy();
      });
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

    destroyRenderTargetBundle(normalTarget);
    destroyRenderTargetBundle(reversedTarget);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
