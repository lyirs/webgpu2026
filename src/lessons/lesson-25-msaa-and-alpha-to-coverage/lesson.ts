import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createMsaaSceneGeometry } from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/math";
import presentFragmentShaderSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/present.frag.wgsl?raw";
import presentVertexShaderSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/present.vert.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  rotationX: number;
  rotationY: number;
  scale: Vector3;
  color: [number, number, number, number];
  cutout: boolean;
};

type RenderObject = {
  config: SceneObjectConfig;
  singleSampleUniformBuffer: GPUBuffer;
  singleSampleBindGroup: GPUBindGroup;
  msaaUniformBuffer: GPUBuffer;
  msaaBindGroup: GPUBindGroup;
  modelMatrix: Float32Array;
};

type RenderTargetBundle = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  multisampleTexture: GPUTexture | null;
  multisampleView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  width: number;
  height: number;
};

/**
 * 打包当前对象的 MVP、模型矩阵、颜色和 cutout 设置。
 * @param {Float32Array} modelViewProjectionMatrix 当前对象的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {[number, number, number, number]} color 当前对象的 RGBA 颜色。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @param {boolean} cutout 当前对象是否使用 alpha cutout。
 * @param {number} renderMode 0 表示硬裁切，1 表示 alpha-to-coverage。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续数据。
 */
function createObjectUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  color: [number, number, number, number],
  lightDirection: Vector3,
  cutout: boolean,
  renderMode: number
): Float32Array {
  const uniformData = new Float32Array(44);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(color, 32);
  uniformData.set(
    [
      lightDirection[0],
      lightDirection[1],
      lightDirection[2],
      0,
      cutout ? 1 : 0,
      renderMode,
      0,
      0,
    ],
    36
  );
  return uniformData;
}

/**
 * 组合对象的模型矩阵。
 * @param {SceneObjectConfig} config 当前对象配置。
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
      multiplyMatrices(
        createRotationXMatrix(config.rotationX),
        createScaleMatrix(config.scale[0], config.scale[1], config.scale[2])
      )
    )
  );
}

/**
 * 安全释放一组离屏渲染目标。
 * @param {RenderTargetBundle} bundle 当前要销毁的颜色、深度和多重采样纹理。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroyRenderTargetBundle(bundle: RenderTargetBundle): void {
  bundle.colorTexture?.destroy();
  bundle.multisampleTexture?.destroy();
  bundle.depthTexture?.destroy();
  bundle.colorTexture = null;
  bundle.colorView = null;
  bundle.multisampleTexture = null;
  bundle.multisampleView = null;
  bundle.depthTexture = null;
  bundle.depthView = null;
}

/**
 * 挂载第 23 课“MSAA 与 Alpha-to-Coverage”预览，并左右对比单采样硬裁切与 4x MSAA+A2C。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountMsaaAndAlphaToCoverageLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="MSAA and alpha-to-coverage lesson preview"></canvas>
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

  const singleSampleTarget: RenderTargetBundle = {
    colorTexture: null,
    colorView: null,
    multisampleTexture: null,
    multisampleView: null,
    depthTexture: null,
    depthView: null,
    width: 0,
    height: 0,
  };
  const msaaTarget: RenderTargetBundle = {
    colorTexture: null,
    colorView: null,
    multisampleTexture: null,
    multisampleView: null,
    depthTexture: null,
    depthView: null,
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

    const geometry = createMsaaSceneGeometry();

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

    const sceneShaderModule = gpu.device.createShaderModule({
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

    const sceneBindGroupLayout = gpu.device.createBindGroupLayout({
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

    const scenePipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [sceneBindGroupLayout],
    });

    const scenePipelineBase: Omit<GPURenderPipelineDescriptor, "fragment" | "multisample"> =
      {
        layout: scenePipelineLayout,
        vertex: {
          module: sceneShaderModule,
          entryPoint: "vsMain",
          buffers: [
            {
              arrayStride: 8 * 4,
              attributes: [
                {
                  shaderLocation: 0,
                  offset: 0,
                  format: "float32x3",
                },
                {
                  shaderLocation: 1,
                  offset: 3 * 4,
                  format: "float32x3",
                },
                {
                  shaderLocation: 2,
                  offset: 6 * 4,
                  format: "float32x2",
                },
              ],
            },
          ],
        },
        primitive: {
          topology: "triangle-list",
          cullMode: "none",
        },
        depthStencil: {
          depthWriteEnabled: true,
          depthCompare: "less",
          format: "depth24plus",
        },
      };

    const singleSamplePipeline = gpu.device.createRenderPipeline({
      ...scenePipelineBase,
      label: "lesson-23-single-sample-hard-cutout",
      fragment: {
        module: sceneFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      multisample: {
        count: 1,
      },
    });

    const msaaPipeline = gpu.device.createRenderPipeline({
      ...scenePipelineBase,
      label: "lesson-23-msaa-a2c",
      fragment: {
        module: sceneFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      multisample: {
        count: 4,
        alphaToCoverageEnabled: true,
      },
    });

    const presentSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });

    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-23-present",
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

    const objectConfigs = [
      {
        label: "floor",
        translation: [0, -0.08, 0],
        rotationX: -Math.PI * 0.5,
        rotationY: 0,
        scale: [4.8, 4.8, 1],
        color: [0.14, 0.17, 0.24, 1],
        cutout: false,
      },
      {
        label: "card-a",
        translation: [0, 3.1, 0],
        rotationX: 0,
        rotationY: 0.55,
        scale: [2.15, 3.2, 1],
        color: [0.42, 0.85, 0.34, 1],
        cutout: true,
      },
      {
        label: "card-b",
        translation: [0, 3.1, 0],
        rotationX: 0,
        rotationY: -0.95,
        scale: [2.15, 3.2, 1],
        color: [0.34, 0.72, 0.24, 1],
        cutout: true,
      },
    ] satisfies SceneObjectConfig[];

    const renderObjects = objectConfigs.map((config) => {
      const singleSampleUniformBuffer = gpu.device.createBuffer({
        size: 44 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const msaaUniformBuffer = gpu.device.createBuffer({
        size: 44 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const singleSampleBindGroup = gpu.device.createBindGroup({
        layout: sceneBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: singleSampleUniformBuffer },
          },
        ],
      });

      const msaaBindGroup = gpu.device.createBindGroup({
        layout: sceneBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: msaaUniformBuffer },
          },
        ],
      });

      return {
        config,
        singleSampleUniformBuffer,
        singleSampleBindGroup,
        msaaUniformBuffer,
        msaaBindGroup,
        modelMatrix: createModelMatrix(config),
      } satisfies RenderObject;
    });

    const ensureRenderTargets = () => {
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);

      const ensureBundle = (
        bundle: RenderTargetBundle,
        sampleCount: number
      ) => {
        if (
          bundle.colorView &&
          bundle.depthView &&
          bundle.width === width &&
          bundle.height === height
        ) {
          return;
        }

        destroyRenderTargetBundle(bundle);
        bundle.width = width;
        bundle.height = height;

        bundle.colorTexture = gpu.device.createTexture({
          size: [width, height],
          format: gpu.format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        bundle.colorView = bundle.colorTexture.createView();

        if (sampleCount > 1) {
          bundle.multisampleTexture = gpu.device.createTexture({
            size: [width, height],
            sampleCount,
            format: gpu.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
          });
          bundle.multisampleView = bundle.multisampleTexture.createView();
        }

        bundle.depthTexture = gpu.device.createTexture({
          size: [width, height],
          sampleCount,
          format: "depth24plus",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        bundle.depthView = bundle.depthTexture.createView();
      };

      ensureBundle(singleSampleTarget, 1);
      ensureBundle(msaaTarget, 4);
    };

    let render = () => {};

    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, 2.55, 0],
      eye: [3.4, 3.15, 4.15],
      minRadius: 2.2,
      maxRadius: 9,
      onChange: () => render(),
    });
    const lightDirection = normalizeVector([0.28, 0.92, 0.34]);

    const updateObjectUniforms = (
      viewProjectionMatrix: Float32Array,
      renderMode: number,
      target: "single-sample" | "msaa"
    ) => {
      renderObjects.forEach((object) => {
        const modelViewProjectionMatrix = multiplyMatrices(
          viewProjectionMatrix,
          object.modelMatrix
        );
        const uniformData = createObjectUniformData(
          modelViewProjectionMatrix,
          object.modelMatrix,
          object.config.color,
          lightDirection,
          object.config.cutout,
          renderMode
        );
        gpu.device.queue.writeBuffer(
          target === "single-sample"
            ? object.singleSampleUniformBuffer
            : object.msaaUniformBuffer,
          0,
          uniformData
        );
      });
    };

    const drawScenePass = (
      commandEncoder: GPUCommandEncoder,
      pipeline: GPURenderPipeline,
      target: RenderTargetBundle,
      passMode: "single-sample" | "msaa"
    ) => {
      const colorAttachment: GPURenderPassColorAttachment = target.multisampleView
        ? {
            view: target.multisampleView,
            resolveTarget: target.colorView!,
            clearValue: { r: 0.036, g: 0.063, b: 0.123, a: 1 },
            loadOp: "clear",
            storeOp: "discard",
          }
        : {
            view: target.colorView!,
            clearValue: { r: 0.036, g: 0.063, b: 0.123, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          };

      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [colorAttachment],
        depthStencilAttachment: {
          view: target.depthView!,
          depthClearValue: 1,
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
          passMode === "single-sample"
            ? object.singleSampleBindGroup
            : object.msaaBindGroup
        );
        pass.drawIndexed(geometry.indexCount);
      });

      pass.end();
    };

    let presentBindGroup: GPUBindGroup | null = null;
    let presentBindGroupWidth = 0;
    let presentBindGroupHeight = 0;

    const ensurePresentBindGroup = () => {
      if (
        presentBindGroup &&
        presentBindGroupWidth === canvas.width &&
        presentBindGroupHeight === canvas.height
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
            resource: singleSampleTarget.colorView!,
          },
          {
            binding: 2,
            resource: msaaTarget.colorView!,
          },
        ],
      });
      presentBindGroupWidth = canvas.width;
      presentBindGroupHeight = canvas.height;
      return presentBindGroup;
    };

    render = () => {
      syncViewport();
      gpu.resize();
      ensureRenderTargets();

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(
        camera.eye,
        camera.target,
        camera.up
      );
      const projectionMatrix = createPerspectiveMatrix(
        (42 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);

      const commandEncoder = gpu.device.createCommandEncoder();

      // 左边：单采样 + 硬裁切，边缘最锯。
      updateObjectUniforms(viewProjectionMatrix, 0, "single-sample");
      drawScenePass(
        commandEncoder,
        singleSamplePipeline,
        singleSampleTarget,
        "single-sample"
      );

      // 右边：4x MSAA + alpha-to-coverage，用 alpha 覆盖率替代硬裁切边缘。
      updateObjectUniforms(viewProjectionMatrix, 1, "msaa");
      drawScenePass(commandEncoder, msaaPipeline, msaaTarget, "msaa");

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
      title: "MSAA 与 Alpha-to-Coverage 已运行",
      detail:
        "左边是单采样硬裁切，右边是 4x MSAA + alpha-to-coverage；拖动相机时叶片边缘会更容易看出差别。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      destroyRenderTargetBundle(singleSampleTarget);
      destroyRenderTargetBundle(msaaTarget);
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

    destroyRenderTargetBundle(singleSampleTarget);
    destroyRenderTargetBundle(msaaTarget);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
