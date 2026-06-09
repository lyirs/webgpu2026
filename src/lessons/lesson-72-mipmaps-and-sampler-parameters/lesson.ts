import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createSamplerDemoGeometry } from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/geometry";
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
} from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/math";
import fragmentShaderSource from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type PanelConfig = {
  label: string;
  translation: Vector3;
  rotationX: number;
  rotationY: number;
  scale: Vector3;
  sampler: GPUSamplerDescriptor;
};

type RenderPanel = {
  config: PanelConfig;
  uniformBuffer: GPUBuffer;
  uniformBindGroup: GPUBindGroup;
  materialBindGroup: GPUBindGroup;
  modelMatrix: Float32Array;
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type TextureWriteData = {
  data: Uint8Array;
  bytesPerRow: number;
  width: number;
  height: number;
};

/**
 * 把对象的 MVP、模型矩阵和主光方向打包成一份 uniform 数据。
 * @param {Float32Array} modelViewProjectionMatrix 当前对象的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 可以直接写进 uniform buffer 的连续 float 数据。
 */
function createPanelUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    32
  );
  return uniformData;
}

/**
 * 把数值向上补齐到指定对齐粒度。
 * @param {number} value 原始值。
 * @param {number} alignment 对齐粒度。
 * @returns {number} 向上补齐后的结果。
 */
function alignTo(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

/**
 * 计算给定尺寸需要多少级 mipmap。
 * @param {number} size 纹理最长边长度。
 * @returns {number} 包含 1x1 在内的总 mip 层级数。
 */
function getMipLevelCount(size: number): number {
  return Math.floor(Math.log2(size)) + 1;
}

/**
 * 为某一级 mip 生成一张教学用图案。
 * @param {number} width 当前 mip 的宽度。
 * @param {number} height 当前 mip 的高度。
 * @param {number} level 当前 mip 层级。
 * @returns {TextureWriteData} 含 256 对齐行宽的像素数据。
 */
function createMipLevelPixels(
  width: number,
  height: number,
  level: number
): TextureWriteData {
  const palettes = [
    {
      base: [28, 174, 235],
      accent: [248, 113, 113],
      edge: [250, 204, 21],
    },
    {
      base: [59, 130, 246],
      accent: [249, 115, 22],
      edge: [255, 255, 255],
    },
    {
      base: [168, 85, 247],
      accent: [16, 185, 129],
      edge: [251, 191, 36],
    },
    {
      base: [236, 72, 153],
      accent: [34, 197, 94],
      edge: [226, 232, 240],
    },
    {
      base: [14, 165, 233],
      accent: [250, 204, 21],
      edge: [248, 113, 113],
    },
  ] as const;

  const palette = palettes[level % palettes.length];
  const bytesPerRow = alignTo(width * 4, 256);
  const data = new Uint8Array(bytesPerRow * height);
  const border = Math.max(1, Math.floor(width * 0.08));
  const cell = Math.max(1, Math.floor(width / 8));
  const diagonalThickness = Math.max(1, Math.floor(width * 0.04));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelOffset = y * bytesPerRow + x * 4;
      const isBorder =
        x < border ||
        y < border ||
        x >= width - border ||
        y >= height - border;
      const checker =
        (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0
          ? palette.base
          : palette.accent;
      const diagonal =
        Math.abs(x - y) <= diagonalThickness ||
        Math.abs(x + y - (width - 1)) <= diagonalThickness;
      const color = isBorder
        ? palette.edge
        : diagonal
          ? [255, 255, 255]
          : checker;

      data[pixelOffset + 0] = color[0];
      data[pixelOffset + 1] = color[1];
      data[pixelOffset + 2] = color[2];
      data[pixelOffset + 3] = 255;
    }
  }

  return { data, bytesPerRow, width, height };
}

/**
 * 创建并写入一张带完整 mip 层级的教学用调试纹理。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {number} size 基础纹理尺寸。
 * @returns {{ texture: GPUTexture, mipLevelCount: number }} 可采样纹理及其 mip 数量。
 */
function createMipDebugTexture(
  device: GPUDevice,
  size: number
): { texture: GPUTexture; mipLevelCount: number } {
  const mipLevelCount = getMipLevelCount(size);

  const texture = device.createTexture({
    size: [size, size],
    format: "rgba8unorm",
    mipLevelCount,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  for (let level = 0; level < mipLevelCount; level += 1) {
    const width = Math.max(1, size >> level);
    const height = Math.max(1, size >> level);
    const mipData = createMipLevelPixels(width, height, level);

    /**
     * queue.writeTexture
     * 把 CPU 端生成好的这一层 mip 纹理写进 GPUTexture 的指定 mipLevel。
     * @param {GPUTexelCopyTextureInfo} destination 目标纹理与 mip 层级信息。
     * @param {AllowSharedBufferSource} data 当前 mip 层级的像素字节。
     * @param {GPUTexelCopyBufferLayout} dataLayout 描述字节行宽；这里使用 256 对齐后的 bytesPerRow。
     * @param {GPUExtent3DStrict} size 当前 mip 层级的宽高尺寸。
     * @returns {void} 只负责写入像素，不返回额外结果。
     */
    device.queue.writeTexture(
      {
        texture,
        mipLevel: level,
      },
      mipData.data,
      {
        bytesPerRow: mipData.bytesPerRow,
      },
      {
        width: mipData.width,
        height: mipData.height,
        depthOrArrayLayers: 1,
      }
    );
  }

  return { texture, mipLevelCount };
}

/**
 * 组合一份面板模型矩阵。
 * @param {PanelConfig} config 当前面板配置。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createPanelModelMatrix(config: PanelConfig): Float32Array {
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
 * 安全释放深度纹理。
 * @param {DepthTarget} target 当前 lesson 用到的深度目标信息。
 * @returns {void} 只负责销毁纹理并清空引用，不返回额外结果。
 */
function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 挂载第 22 课“Mipmap 与采样参数”预览，并通过四块面板对比不同 sampler 与 mip 规则。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountMipmapAndSamplerParametersLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Mipmap and sampler parameters lesson preview"></canvas>
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

  let animationFrameId = 0;

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

    const geometry = createSamplerDemoGeometry();

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

    const { texture, mipLevelCount } = createMipDebugTexture(gpu.device, 256);
    const textureView = texture.createView();

    const shaderModule = gpu.device.createShaderModule({ code: vertexShaderSource });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-22-mipmap-and-sampler-parameters",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 8 * 4,
            attributes: [
              {
                // shaderLocation 0：位置，对应 WGSL 里的 vec3f position。
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
              {
                // shaderLocation 1：法线，对应 WGSL 里的 vec3f normal。
                shaderLocation: 1,
                offset: 3 * 4,
                format: "float32x3",
              },
              {
                // shaderLocation 2：UV，对应 WGSL 里的 vec2f uv。
                shaderLocation: 2,
                offset: 6 * 4,
                format: "float32x2",
              },
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

    const uniformBindGroupLayout = pipeline.getBindGroupLayout(0);
    const materialBindGroupLayout = pipeline.getBindGroupLayout(1);

    const panelConfigs = [
      {
        label: "nearest-repeat-base",
        translation: [-2.55, 1.45, -0.9],
        rotationX: -1.03,
        rotationY: 0.24,
        scale: [1.92, 1.42, 1],
        sampler: {
          addressModeU: "repeat",
          addressModeV: "repeat",
          magFilter: "nearest",
          minFilter: "nearest",
          mipmapFilter: "nearest",
          lodMaxClamp: 0,
        },
      },
      {
        label: "linear-repeat-base",
        translation: [2.55, 1.45, -0.9],
        rotationX: -1.03,
        rotationY: -0.24,
        scale: [1.92, 1.42, 1],
        sampler: {
          addressModeU: "repeat",
          addressModeV: "repeat",
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "nearest",
          lodMaxClamp: 0,
        },
      },
      {
        label: "trilinear-repeat",
        translation: [-2.55, -0.82, 1.55],
        rotationX: -1.03,
        rotationY: 0.24,
        scale: [1.92, 1.42, 1],
        sampler: {
          addressModeU: "repeat",
          addressModeV: "repeat",
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
          lodMaxClamp: mipLevelCount - 1,
        },
      },
      {
        label: "trilinear-clamp",
        translation: [2.55, -0.82, 1.55],
        rotationX: -1.03,
        rotationY: -0.24,
        scale: [1.92, 1.42, 1],
        sampler: {
          addressModeU: "clamp-to-edge",
          addressModeV: "clamp-to-edge",
          magFilter: "linear",
          minFilter: "linear",
          mipmapFilter: "linear",
          lodMaxClamp: mipLevelCount - 1,
        },
      },
    ] satisfies PanelConfig[];

    const createRenderPanel = (config: PanelConfig): RenderPanel => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 36 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const sampler = gpu.device.createSampler(config.sampler);

      /**
       * createBindGroup
       * 这一课每块面板都共享同一张纹理，但 sampler 各不相同，所以每块面板都要有自己的材质 bind group。
       * @param {GPUBindGroupDescriptor} descriptor 绑定组描述对象，这里把 sampler 和 texture view 绑到 group(1)。
       * @returns {GPUBindGroup} 当前面板自己的采样参数绑定组。
       */
      const materialBindGroup = gpu.device.createBindGroup({
        layout: materialBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: sampler,
          },
          {
            binding: 1,
            resource: textureView,
          },
        ],
      });

      const uniformBindGroup = gpu.device.createBindGroup({
        layout: uniformBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      return {
        config,
        uniformBuffer,
        uniformBindGroup,
        materialBindGroup,
        modelMatrix: createPanelModelMatrix(config),
      };
    };

    const renderPanels = panelConfigs.map(createRenderPanel);
    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, 0.35, 0.4],
      eye: [0, 3.1, 10.6],
      minRadius: 7.4,
      maxRadius: 16,
    });
    const lightDirection = normalizeVector([0.38, 0.9, 0.22]);

    const ensureDepthTarget = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        depthTarget.view &&
        depthTarget.width === width &&
        depthTarget.height === height
      ) {
        return depthTarget.view;
      }

      destroyDepthTarget(depthTarget);
      depthTarget.width = width;
      depthTarget.height = height;
      depthTarget.texture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTarget.view = depthTarget.texture.createView();
      return depthTarget.view;
    };

    const render = () => {
      syncViewport();
      gpu.resize();

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(
        camera.eye,
        camera.target,
        camera.up
      );
      const projectionMatrix = createPerspectiveMatrix(
        (50 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);

      renderPanels.forEach((panel) => {
        const modelViewProjectionMatrix = multiplyMatrices(
          viewProjectionMatrix,
          panel.modelMatrix
        );
        const uniformData = createPanelUniformData(
          modelViewProjectionMatrix,
          panel.modelMatrix,
          lightDirection
        );
        gpu.device.queue.writeBuffer(panel.uniformBuffer, 0, uniformData);
      });

      const commandEncoder = gpu.device.createCommandEncoder();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.04, g: 0.065, b: 0.128, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: ensureDepthTarget(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");

      renderPanels.forEach((panel) => {
        pass.setBindGroup(0, panel.uniformBindGroup);
        pass.setBindGroup(1, panel.materialBindGroup);
        pass.drawIndexed(geometry.indexCount);
      });

      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    const frame = () => {
      render();
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
    });

    resizeObserver.observe(host);
    syncViewport();
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "Mipmap 与采样参数已运行",
      detail:
        "左上是 nearest + repeat + 固定 base level，右上是 linear + repeat + 固定 base level，左下是 trilinear mip + repeat，右下是 trilinear mip + clamp-to-edge。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitCamera.dispose();
      destroyDepthTarget(depthTarget);
      texture.destroy();
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

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
