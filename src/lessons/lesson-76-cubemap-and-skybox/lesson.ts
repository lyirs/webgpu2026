import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createCubemapLessonGeometry } from "@/lessons/lesson-76-cubemap-and-skybox/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createSkyboxViewMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-76-cubemap-and-skybox/math";
import reflectiveFragmentShaderSource from "@/lessons/lesson-76-cubemap-and-skybox/reflective.frag.wgsl?raw";
import reflectiveVertexShaderSource from "@/lessons/lesson-76-cubemap-and-skybox/reflective.vert.wgsl?raw";
import skyboxFragmentShaderSource from "@/lessons/lesson-76-cubemap-and-skybox/skybox.frag.wgsl?raw";
import skyboxVertexShaderSource from "@/lessons/lesson-76-cubemap-and-skybox/skybox.vert.wgsl?raw";

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

type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  scale: Vector3;
  baseColor: [number, number, number];
  reflectivity: number;
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

/**
 * 把当前帧的 VP、天空盒矩阵、相机位置和主光方向打包成一份 frame uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前帧的常规 VP 矩阵。
 * @param {Float32Array} skyboxViewProjectionMatrix 当前帧给天空盒使用的旋转 VP 矩阵。
 * @param {Vector3} cameraPosition 当前相机位置。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续 float 数据。
 */
function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  skyboxViewProjectionMatrix: Float32Array,
  cameraPosition: Vector3,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(40);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set(skyboxViewProjectionMatrix, 16);
  uniformData.set([cameraPosition[0], cameraPosition[1], cameraPosition[2], 0], 32);
  uniformData.set([lightDirection[0], lightDirection[1], lightDirection[2], 0], 36);
  return uniformData;
}

/**
 * 把单个物体的模型矩阵、基础颜色和反射强度打包成一份对象 uniform 数据。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {[number, number, number]} baseColor 当前对象的基础颜色。
 * @param {number} reflectivity 当前对象的环境反射强度。
 * @returns {Float32Array} 可直接写进 uniform buffer 的对象数据。
 */
function createObjectUniformData(
  modelMatrix: Float32Array,
  baseColor: [number, number, number],
  reflectivity: number
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(modelMatrix, 0);
  uniformData.set([baseColor[0], baseColor[1], baseColor[2], 1], 16);
  uniformData.set([reflectivity, 0, 0, 0], 20);
  return uniformData;
}

/**
 * 组合一份对象的模型矩阵；这里先缩放，再旋转，最后平移到场景里。
 * @param {Vector3} translation 当前对象的平移。
 * @param {Vector3} scale 当前对象的缩放。
 * @param {number} rotationY 围绕 y 轴的旋转角度。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createModelMatrix(
  translation: Vector3,
  scale: Vector3,
  rotationY: number
): Float32Array {
  return multiplyMatrices(
    createTranslationMatrix(translation[0], translation[1], translation[2]),
    multiplyMatrices(
      createRotationYMatrix(rotationY),
      createScaleMatrix(scale[0], scale[1], scale[2])
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
 * 生成一张带渐变和高光条纹的 cubemap 面数据，让六个方向一眼就能区分开。
 * @param {number} size 当前 cubemap 面的像素尺寸。
 * @param {number} faceIndex 当前面索引，按 +X/-X/+Y/-Y/+Z/-Z 顺序传入。
 * @returns {Uint8Array} 对应面的 RGBA8 像素数据。
 */
function createCubemapFaceData(size: number, faceIndex: number): Uint8Array {
  const palettes = [
    { top: [255, 174, 99], bottom: [172, 81, 33], accent: [255, 230, 180] },
    { top: [99, 208, 232], bottom: [26, 112, 145], accent: [195, 245, 255] },
    { top: [255, 238, 176], bottom: [195, 150, 62], accent: [255, 251, 220] },
    { top: [116, 109, 219], bottom: [40, 49, 118], accent: [205, 198, 255] },
    { top: [255, 146, 182], bottom: [150, 62, 104], accent: [255, 214, 230] },
    { top: [128, 233, 196], bottom: [35, 116, 91], accent: [218, 255, 238] },
  ] as const;
  const palette = palettes[faceIndex];
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / Math.max(size - 1, 1);
      const v = y / Math.max(size - 1, 1);
      const diagonal = Math.abs(u + v - 1);
      const glow = Math.max(0, 1 - Math.hypot(u - 0.5, v - 0.42) * 1.6);
      const stripe = Math.max(0, 1 - diagonal * 7.5);
      const blend = Math.pow(1 - v, 1.3);
      const pixelIndex = (y * size + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const base =
          palette.bottom[channel] * (1 - blend) + palette.top[channel] * blend;
        const lit = base * (1 - stripe * 0.18) + palette.accent[channel] * stripe * 0.18;
        pixels[pixelIndex + channel] = Math.round(
          lit * (1 - glow * 0.18) + palette.accent[channel] * glow * 0.18
        );
      }

      pixels[pixelIndex + 3] = 255;
    }
  }

  return pixels;
}

/**
 * 创建并上传一张程序生成的 cubemap；六个方向会分别写入不同的教学配色。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPUQueue} queue 当前 lesson 使用的 GPU 队列。
 * @returns {{ texture: GPUTexture; view: GPUTextureView; sampler: GPUSampler }} 后续天空盒和反射采样会共同使用的环境资源。
 */
function createEnvironmentCubemap(
  device: GPUDevice,
  queue: GPUQueue
): { texture: GPUTexture; view: GPUTextureView; sampler: GPUSampler } {
  const faceSize = 96;

  /**
   * createTexture：这里创建的是一张 6 层 2D 纹理，稍后会用 cube view 把它解释成 cubemap。
   */
  const texture = device.createTexture({
    size: [faceSize, faceSize, 6],
    format: "rgba8unorm",
    mipLevelCount: 1,
    dimension: "2d",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  for (let faceIndex = 0; faceIndex < 6; faceIndex += 1) {
    const faceData = createCubemapFaceData(faceSize, faceIndex);

    /**
     * writeTexture：把每个方向面的 RGBA8 像素写进 cubemap 对应的 array layer。
     */
    queue.writeTexture(
      {
        texture,
        origin: { x: 0, y: 0, z: faceIndex },
      },
      faceData,
      {
        bytesPerRow: faceSize * 4,
        rowsPerImage: faceSize,
      },
      {
        width: faceSize,
        height: faceSize,
        depthOrArrayLayers: 1,
      }
    );
  }

  /**
   * createView({ dimension: "cube" })：把 6 个方向面组合成 shader 能直接采样的 cubemap 视图。
   */
  const view = texture.createView({
    dimension: "cube",
  });

  /**
   * createSampler：天空盒和反射都用同一套线性采样规则。
   */
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  return {
    texture,
    view,
    sampler,
  };
}

/**
 * 挂载第 24 课“Cubemap 与天空盒”，演示一张 cubemap 如何同时充当天空背景和环境反射来源。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步 lesson 当前状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放动画帧、监听器和 GPU 资源。
 */
export async function mountCubemapAndSkyboxLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Cubemap and skybox lesson preview"></canvas>
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

    const geometry = createCubemapLessonGeometry();

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

    const reflectiveVertexShaderModule = gpu.device.createShaderModule({
      code: reflectiveVertexShaderSource,
    });
    const reflectiveFragmentShaderModule = gpu.device.createShaderModule({
      code: reflectiveFragmentShaderSource,
    });
    const skyboxVertexShaderModule = gpu.device.createShaderModule({
      code: skyboxVertexShaderSource,
    });
    const skyboxFragmentShaderModule = gpu.device.createShaderModule({
      code: skyboxFragmentShaderSource,
    });

    const frameBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility:
            GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const environmentBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {
            sampleType: "float",
            viewDimension: "cube",
          },
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

    const reflectivePipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [
        frameBindGroupLayout,
        environmentBindGroupLayout,
        objectBindGroupLayout,
      ],
    });

    const skyboxPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [frameBindGroupLayout, environmentBindGroupLayout],
    });

    /**
     * createRenderPipeline：反射物体会使用完整的位置 + 法线输入，并在 fragment 阶段混合环境反射。
     */
    const reflectivePipeline = gpu.device.createRenderPipeline({
      label: "lesson-24-reflective-scene",
      layout: reflectivePipelineLayout,
      vertex: {
        module: reflectiveVertexShaderModule,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 6 * 4,
            attributes: [
              {
                // shaderLocation 0：位置，占 3 个 float32，对应 WGSL 里的 vec3f。
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
              {
                // shaderLocation 1：法线，占 3 个 float32，用于计算漫反射和反射方向。
                shaderLocation: 1,
                offset: 3 * 4,
                format: "float32x3",
              },
            ],
          },
        ],
      },
      fragment: {
        module: reflectiveFragmentShaderModule,
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
     * createRenderPipeline：天空盒只关心位置，真正的颜色来自 cubemap 的方向采样。
     */
    const skyboxPipeline = gpu.device.createRenderPipeline({
      label: "lesson-24-skybox",
      layout: skyboxPipelineLayout,
      vertex: {
        module: skyboxVertexShaderModule,
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
        module: skyboxFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "front",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: "depth24plus",
      },
    });

    const frameUniformBuffer = gpu.device.createBuffer({
      size: 40 * 4,
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

    const environment = createEnvironmentCubemap(gpu.device, gpu.device.queue);

    const environmentBindGroup = gpu.device.createBindGroup({
      layout: environmentBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: environment.sampler,
        },
        {
          binding: 1,
          resource: environment.view,
        },
      ],
    });

    const objectConfigs: SceneObjectConfig[] = [
      {
        label: "platform",
        translation: [0, -0.8, 0],
        scale: [4.8, 0.38, 4.8],
        baseColor: [0.52, 0.58, 0.72],
        reflectivity: 0.08,
      },
      {
        label: "reflective-cube",
        translation: [0, 0.8, 0],
        scale: [1.45, 1.45, 1.45],
        baseColor: [0.84, 0.88, 0.96],
        reflectivity: 0.78,
      },
    ];

    const renderObjects: RenderObject[] = objectConfigs.map((config) => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 24 * 4,
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

    /**
     * 根据当前画布像素尺寸重建深度纹理，保证天空盒和反射物体共享同一深度测试结果。
     * @returns {void} 只在尺寸变化时更新 depth texture，不返回额外结果。
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

      /**
       * createTexture：这里创建的是主场景深度附件，用来保证天空盒永远在最远处、实体物体能正确互相遮挡。
       */
      depthTarget.texture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTarget.view = depthTarget.texture.createView();
      depthTarget.width = width;
      depthTarget.height = height;
    };

    syncViewport();

    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, 0.8, 0],
      eye: [4.8, 3.0, 5.6],
      minRadius: 2.8,
      maxRadius: 12,
      rotateSpeed: 0.008,
      zoomSpeed: 0.008,
    });

    let animationFrameId = 0;

    /**
     * 录制并提交这一帧的天空盒与反射物体绘制命令。
     * @param {number} elapsed 已经经过的秒数。
     * @returns {void} 只负责编码命令和提交队列。
     */
    const render = (elapsed: number) => {
      gpu.resize();
      ensureDepthTarget();

      if (!depthTarget.view) {
        return;
      }

      const camera = orbitCamera.getSnapshot();
      const aspect = Math.max(canvas.width / Math.max(canvas.height, 1), 1e-6);
      const projectionMatrix = createPerspectiveMatrix(
        (40 * Math.PI) / 180,
        aspect,
        0.1,
        120
      );
      const viewMatrix = createLookAtViewMatrix(
        camera.eye,
        camera.target,
        camera.up
      );
      const skyboxViewMatrix = createSkyboxViewMatrix(viewMatrix);
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const skyboxViewProjectionMatrix = multiplyMatrices(
        projectionMatrix,
        skyboxViewMatrix
      );
      const lightDirection = normalizeVector([0.38, -1.0, 0.26]);

      gpu.device.queue.writeBuffer(
        frameUniformBuffer,
        0,
        createFrameUniformData(
          viewProjectionMatrix,
          skyboxViewProjectionMatrix,
          camera.eye,
          lightDirection
        )
      );

      renderObjects.forEach((object) => {
        const rotation =
          object.config.label === "reflective-cube" ? elapsed * 0.55 : 0;
        const modelMatrix = createModelMatrix(
          object.config.translation,
          object.config.scale,
          rotation
        );

        gpu.device.queue.writeBuffer(
          object.uniformBuffer,
          0,
          createObjectUniformData(
            modelMatrix,
            object.config.baseColor,
            object.config.reflectivity
          )
        );
      });

      /**
       * createCommandEncoder：把天空盒和反射物体这两段 pass 录进同一份命令缓冲。
       */
      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-24-command-encoder",
      });
      const currentView = gpu.context.getCurrentTexture().createView();

      /**
       * beginRenderPass：同一遍 pass 里先画天空盒，再画实体物体；天空盒不写深度，实体物体再覆盖它。
       */
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentView,
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

      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");

      pass.setPipeline(skyboxPipeline);
      pass.setBindGroup(0, frameBindGroup);
      pass.setBindGroup(1, environmentBindGroup);
      pass.drawIndexed(geometry.indexCount);

      pass.setPipeline(reflectivePipeline);
      pass.setBindGroup(0, frameBindGroup);
      pass.setBindGroup(1, environmentBindGroup);

      renderObjects.forEach((object) => {
        pass.setBindGroup(2, object.bindGroup);
        pass.drawIndexed(geometry.indexCount);
      });

      pass.end();

      /**
       * queue.submit：把当前帧录好的命令一次性提交给 GPU 执行。
       */
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    /**
     * 统一驱动 lesson 的旋转动画和渲染循环。
     * @param {number} time 浏览器传入的高精度时间戳。
     * @returns {void} 只负责推进动画并发起下一帧。
     */
    const frame = (time: number) => {
      render(time * 0.001);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
      render(performance.now() * 0.001);
    });
    resizeObserver.observe(host);

    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "Cubemap 与天空盒已运行",
      detail:
        "现在背景来自同一张 cubemap，反射立方体也会用它采样环境颜色；这节课重点就是 texture_cube、方向采样和 skybox。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      orbitCamera.dispose();
      destroyDepthTarget(depthTarget);
      frameUniformBuffer.destroy();
      renderObjects.forEach((object) => {
        object.uniformBuffer.destroy();
      });
      vertexBuffer.destroy();
      indexBuffer.destroy();
      environment.texture.destroy();
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
