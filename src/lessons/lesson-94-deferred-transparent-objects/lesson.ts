import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createDeferredTransparentSceneGeometry } from "@/lessons/lesson-94-deferred-transparent-objects/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  type Vector3,
} from "@/lessons/lesson-94-deferred-transparent-objects/math";
import forwardFragmentShaderSource from "@/lessons/lesson-94-deferred-transparent-objects/forward.frag.wgsl?raw";
import forwardVertexShaderSource from "@/lessons/lesson-94-deferred-transparent-objects/forward.vert.wgsl?raw";
import gbufferFragmentShaderSource from "@/lessons/lesson-94-deferred-transparent-objects/gbuffer.frag.wgsl?raw";
import gbufferVertexShaderSource from "@/lessons/lesson-94-deferred-transparent-objects/gbuffer.vert.wgsl?raw";
import lightingFragmentShaderSource from "@/lessons/lesson-94-deferred-transparent-objects/lighting.frag.wgsl?raw";
import lightingVertexShaderSource from "@/lessons/lesson-94-deferred-transparent-objects/lighting.vert.wgsl?raw";
import presentFragmentShaderSource from "@/lessons/lesson-94-deferred-transparent-objects/present.frag.wgsl?raw";
import presentVertexShaderSource from "@/lessons/lesson-94-deferred-transparent-objects/present.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type SceneObjectConfig = {
  label: string;
  mesh: "cube" | "quad";
  translation: Vector3;
  rotationY: number;
  scale: Vector3;
  color: [number, number, number, number];
  transparent: boolean;
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  modelMatrix: Float32Array;
};

type PanelTargets = {
  albedoTexture: GPUTexture | null;
  albedoView: GPUTextureView | null;
  normalTexture: GPUTexture | null;
  normalView: GPUTextureView | null;
  worldTexture: GPUTexture | null;
  worldView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  sceneTexture: GPUTexture | null;
  sceneView: GPUTextureView | null;
  lightingBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

/**
 * 把当前对象的 MVP、模型矩阵和颜色打包成 uniform 数据。
 * @param {Float32Array} modelViewProjectionMatrix 当前对象的 MVP。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {[number, number, number, number]} color 当前对象颜色与透明度。
 * @returns {Float32Array} 适合写入 uniform buffer 的连续 float。
 */
function createObjectUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  color: [number, number, number, number]
): Float32Array {
  const data = new Float32Array(36);
  data.set(modelViewProjectionMatrix, 0);
  data.set(modelMatrix, 16);
  data.set(color, 32);
  return data;
}

/**
 * 打包三盏点光源的位置、颜色和环境光。
 * @param {Vector3[]} lightPositions 当前帧光源位置。
 * @param {[number, number, number, number][]} lightColors 当前帧光源颜色与强度。
 * @returns {Float32Array} 光照 pass 和 forward 透明 pass 共用的 uniform 数据。
 */
function createLightUniformData(
  lightPositions: Vector3[],
  lightColors: [number, number, number, number][]
): Float32Array {
  const data = new Float32Array(28);
  lightPositions.forEach((position, index) => {
    data.set([position[0], position[1], position[2], 1], index * 4);
  });
  lightColors.forEach((color, index) => {
    data.set(color, 12 + index * 4);
  });
  data.set([0.08, 0.08, 0.12, 1], 24);
  return data;
}

/**
 * 组合对象的模型矩阵。
 * @param {SceneObjectConfig} config 当前对象静态配置。
 * @returns {Float32Array} 4x4 模型矩阵。
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
 * 销毁单侧面板使用的全部离屏纹理。
 * @param {PanelTargets} targets 当前面板的离屏目标。
 * @returns {void} 只做销毁和引用清空。
 */
function destroyPanelTargets(targets: PanelTargets): void {
  targets.albedoTexture?.destroy();
  targets.normalTexture?.destroy();
  targets.worldTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.sceneTexture?.destroy();
  targets.albedoTexture = null;
  targets.albedoView = null;
  targets.normalTexture = null;
  targets.normalView = null;
  targets.worldTexture = null;
  targets.worldView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.sceneTexture = null;
  targets.sceneView = null;
  targets.lightingBindGroup = null;
}

/**
 * 挂载第 38 课“Deferred 与透明物体”，左边演示把透明硬塞进 deferred，右边演示 deferred + forward 混合路线。
 * @param {HTMLElement} host 承载 lesson 的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用来同步当前 lesson 状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数。
 */
export async function mountDeferredTransparentObjectsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Deferred transparent objects lesson preview"></canvas>
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

  const leftTargets: PanelTargets = {
    albedoTexture: null,
    albedoView: null,
    normalTexture: null,
    normalView: null,
    worldTexture: null,
    worldView: null,
    depthTexture: null,
    depthView: null,
    sceneTexture: null,
    sceneView: null,
    lightingBindGroup: null,
    width: 0,
    height: 0,
  };
  const rightTargets: PanelTargets = {
    albedoTexture: null,
    albedoView: null,
    normalTexture: null,
    normalView: null,
    worldTexture: null,
    worldView: null,
    depthTexture: null,
    depthView: null,
    sceneTexture: null,
    sceneView: null,
    lightingBindGroup: null,
    width: 0,
    height: 0,
  };

  try {
    const gpu = await createWebGpuCanvas(canvas);

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

    const geometry = createDeferredTransparentSceneGeometry();

    const cubeVertexBuffer = gpu.device.createBuffer({
      size: geometry.cube.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(cubeVertexBuffer, 0, geometry.cube.vertexData);

    const cubeIndexBuffer = gpu.device.createBuffer({
      size: geometry.cube.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(cubeIndexBuffer, 0, geometry.cube.indexData);

    const quadVertexBuffer = gpu.device.createBuffer({
      size: geometry.quad.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(quadVertexBuffer, 0, geometry.quad.vertexData);

    const quadIndexBuffer = gpu.device.createBuffer({
      size: geometry.quad.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(quadIndexBuffer, 0, geometry.quad.indexData);

    const gbufferVertexShaderModule = gpu.device.createShaderModule({
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
    const forwardVertexShaderModule = gpu.device.createShaderModule({
      code: forwardVertexShaderSource,
    });
    const forwardFragmentShaderModule = gpu.device.createShaderModule({
      code: forwardFragmentShaderSource,
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
          buffer: { type: "uniform" },
        },
      ],
    });
    const gbufferPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [objectBindGroupLayout],
    });
    const gbufferPipeline = gpu.device.createRenderPipeline({
      label: "lesson-38-gbuffer",
      layout: gbufferPipelineLayout,
      vertex: {
        module: gbufferVertexShaderModule,
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
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const lightUniformBuffer = gpu.device.createBuffer({
      size: 28 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const lightingBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
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
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      ],
    });
    const lightingPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [lightingBindGroupLayout],
    });
    const lightingPipeline = gpu.device.createRenderPipeline({
      label: "lesson-38-lighting",
      layout: lightingPipelineLayout,
      vertex: {
        module: lightingVertexShaderModule,
        entryPoint: "vsMain",
      },
      fragment: {
        module: lightingFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: "rgba8unorm" }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const forwardLightBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });
    const forwardPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [objectBindGroupLayout, forwardLightBindGroupLayout],
    });
    const forwardPipeline = gpu.device.createRenderPipeline({
      label: "lesson-38-forward-transparent",
      layout: forwardPipelineLayout,
      vertex: {
        module: forwardVertexShaderModule,
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
        module: forwardFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [
          {
            format: "rgba8unorm",
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    const panelSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });
    const presentBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      ],
    });
    const presentPipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [presentBindGroupLayout],
    });
    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-38-present",
      layout: presentPipelineLayout,
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

    const opaqueObjects: SceneObjectConfig[] = [
      {
        label: "floor",
        mesh: "cube",
        translation: [0, -1.2, 0],
        rotationY: 0,
        scale: [5.8, 0.25, 5.8],
        color: [0.20, 0.23, 0.30, 1],
        transparent: false,
      },
      {
        label: "highlight-cube",
        mesh: "cube",
        translation: [0.0, 0.25, -1.55],
        rotationY: 0.18,
        scale: [1.2, 1.2, 1.2],
        color: [1.0, 0.86, 0.28, 1],
        transparent: false,
      },
      {
        label: "front-cube",
        mesh: "cube",
        translation: [1.55, -0.2, 1.25],
        rotationY: -0.28,
        scale: [1.25, 0.95, 1.25],
        color: [0.25, 0.66, 0.90, 1],
        transparent: false,
      },
      {
        label: "rear-column",
        mesh: "cube",
        translation: [-1.45, 0.55, -2.55],
        rotationY: 0.48,
        scale: [0.85, 1.55, 0.85],
        color: [0.92, 0.42, 0.30, 1],
        transparent: false,
      },
    ];

    const transparentObjects: SceneObjectConfig[] = [
      {
        label: "glass-cyan",
        mesh: "quad",
        translation: [-0.35, 0.95, 0.15],
        rotationY: 0.38,
        scale: [2.35, 3.05, 1],
        color: [0.25, 0.75, 0.98, 0.3],
        transparent: true,
      },
      {
        label: "glass-amber",
        mesh: "quad",
        translation: [0.4, 0.95, -0.35],
        rotationY: -0.4,
        scale: [2.2, 2.95, 1],
        color: [1.0, 0.67, 0.26, 0.28],
        transparent: true,
      },
    ];

    const allObjects = [...opaqueObjects, ...transparentObjects];
    const renderObjects: RenderObject[] = allObjects.map((config) => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 36 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = gpu.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      });
      return {
        config,
        uniformBuffer,
        bindGroup,
        modelMatrix: createModelMatrix(config),
      };
    });
    const opaqueRenderObjects = renderObjects.filter((object) => !object.config.transparent);
    const transparentRenderObjects = renderObjects.filter((object) => object.config.transparent);

    const forwardLightBindGroup = gpu.device.createBindGroup({
      layout: forwardLightBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: lightUniformBuffer } }],
    });

    let presentBindGroup: GPUBindGroup | null = null;

    const ensurePanelTargets = (targets: PanelTargets) => {
      const width = Math.max(1, Math.floor(canvas.width / 2));
      const height = canvas.height;
      if (
        targets.lightingBindGroup &&
        targets.width === width &&
        targets.height === height
      ) {
        return targets.lightingBindGroup;
      }

      destroyPanelTargets(targets);

      targets.albedoTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.albedoView = targets.albedoTexture.createView();

      targets.normalTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.normalView = targets.normalTexture.createView();

      targets.worldTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.worldView = targets.worldTexture.createView();

      targets.depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      targets.depthView = targets.depthTexture.createView();

      targets.sceneTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.sceneView = targets.sceneTexture.createView();

      targets.lightingBindGroup = gpu.device.createBindGroup({
        layout: lightingBindGroupLayout,
        entries: [
          { binding: 0, resource: targets.albedoView },
          { binding: 1, resource: targets.normalView },
          { binding: 2, resource: targets.worldView },
          { binding: 3, resource: { buffer: lightUniformBuffer } },
        ],
      });

      targets.width = width;
      targets.height = height;
      presentBindGroup = null;

      return targets.lightingBindGroup;
    };

    const ensurePresentBindGroup = () => {
      if (presentBindGroup && leftTargets.sceneView && rightTargets.sceneView) {
        return presentBindGroup;
      }
      if (!leftTargets.sceneView || !rightTargets.sceneView) {
        throw new Error("离屏场景纹理还没有准备好。");
      }

      presentBindGroup = gpu.device.createBindGroup({
        layout: presentBindGroupLayout,
        entries: [
          { binding: 0, resource: panelSampler },
          { binding: 1, resource: leftTargets.sceneView },
          { binding: 2, resource: rightTargets.sceneView },
        ],
      });
      return presentBindGroup;
    };

    const orbitCamera = createOrbitCameraController(canvas, {
      eye: [7.1, 5.2, 8.0],
      target: [0, 0.9, -0.45],
      up: [0, 1, 0],
      minRadius: 4.8,
      maxRadius: 16,
      rotateSpeed: 0.01,
      zoomSpeed: 0.0035,
      onChange: () => render(performance.now()),
    });

    let animationFrameId = 0;

    const render = (timestamp: number) => {
      syncViewport();
      gpu.resize();

      const leftLightingBindGroup = ensurePanelTargets(leftTargets);
      const rightLightingBindGroup = ensurePanelTargets(rightTargets);
      const currentPresentBindGroup = ensurePresentBindGroup();
      if (
        !leftTargets.albedoView ||
        !leftTargets.normalView ||
        !leftTargets.worldView ||
        !leftTargets.depthView ||
        !leftTargets.sceneView ||
        !rightTargets.albedoView ||
        !rightTargets.normalView ||
        !rightTargets.worldView ||
        !rightTargets.depthView ||
        !rightTargets.sceneView
      ) {
        return;
      }

      const camera = orbitCamera.getSnapshot();
      const aspect = (canvas.width / 2) / canvas.height;
      const projectionMatrix = createPerspectiveMatrix(Math.PI / 3.2, aspect, 0.1, 80);
      const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, [0, 1, 0]);
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);

      const time = timestamp * 0.001;
      const lightPositions: Vector3[] = [
        [Math.cos(time * 0.65) * 4.0, 3.3, Math.sin(time * 0.65) * 4.0],
        [Math.cos(time * 0.85 + 2.2) * 3.2, 2.7, Math.sin(time * 0.85 + 2.2) * 3.2],
        [Math.cos(time * 0.5 + 4.0) * 4.6, 4.1, Math.sin(time * 0.5 + 4.0) * 4.6],
      ];
      const lightColors: [number, number, number, number][] = [
        [1.0, 0.48, 0.30, 3.0],
        [0.29, 0.82, 1.0, 2.8],
        [1.0, 0.88, 0.35, 2.3],
      ];
      gpu.device.queue.writeBuffer(
        lightUniformBuffer,
        0,
        createLightUniformData(lightPositions, lightColors)
      );

      renderObjects.forEach((object) => {
        const modelViewProjectionMatrix = multiplyMatrices(viewProjectionMatrix, object.modelMatrix);
        const uniformData = createObjectUniformData(
          modelViewProjectionMatrix,
          object.modelMatrix,
          object.config.color
        );
        gpu.device.queue.writeBuffer(object.uniformBuffer, 0, uniformData);
      });

      const sortedTransparentObjects = [...transparentRenderObjects].sort((a, b) => {
        const aPosition = a.config.translation;
        const bPosition = b.config.translation;
        const aDistance =
          (aPosition[0] - camera.eye[0]) ** 2 +
          (aPosition[1] - camera.eye[1]) ** 2 +
          (aPosition[2] - camera.eye[2]) ** 2;
        const bDistance =
          (bPosition[0] - camera.eye[0]) ** 2 +
          (bPosition[1] - camera.eye[1]) ** 2 +
          (bPosition[2] - camera.eye[2]) ** 2;
        return bDistance - aDistance;
      });

      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-38-command-encoder",
      });

      const drawGeometryPass = (
        targets: PanelTargets,
        lightingBindGroup: GPUBindGroup,
        includeTransparentInGBuffer: boolean
      ) => {
        const geometryPass = commandEncoder.beginRenderPass({
          label: includeTransparentInGBuffer
            ? "lesson-38-left-gbuffer-pass"
            : "lesson-38-right-gbuffer-pass",
          colorAttachments: [
            {
              view: targets.albedoView!,
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store",
            },
            {
              view: targets.normalView!,
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store",
            },
            {
              view: targets.worldView!,
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: "clear",
              storeOp: "store",
            },
          ],
          depthStencilAttachment: {
            view: targets.depthView!,
            depthClearValue: 1,
            depthLoadOp: "clear",
            depthStoreOp: "store",
          },
        });

        geometryPass.setPipeline(gbufferPipeline);
        opaqueRenderObjects.forEach((object) => {
          const mesh = object.config.mesh === "cube" ? geometry.cube : geometry.quad;
          const vertexBuffer = object.config.mesh === "cube" ? cubeVertexBuffer : quadVertexBuffer;
          const indexBuffer = object.config.mesh === "cube" ? cubeIndexBuffer : quadIndexBuffer;
          geometryPass.setBindGroup(0, object.bindGroup);
          geometryPass.setVertexBuffer(0, vertexBuffer);
          geometryPass.setIndexBuffer(indexBuffer, "uint16");
          geometryPass.drawIndexed(mesh.indexCount);
        });

        if (includeTransparentInGBuffer) {
          transparentRenderObjects.forEach((object) => {
            geometryPass.setBindGroup(0, object.bindGroup);
            geometryPass.setVertexBuffer(0, quadVertexBuffer);
            geometryPass.setIndexBuffer(quadIndexBuffer, "uint16");
            geometryPass.drawIndexed(geometry.quad.indexCount);
          });
        }
        geometryPass.end();

        const lightingPass = commandEncoder.beginRenderPass({
          label: includeTransparentInGBuffer
            ? "lesson-38-left-lighting-pass"
            : "lesson-38-right-lighting-pass",
          colorAttachments: [
            {
              view: targets.sceneView!,
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
      };

      drawGeometryPass(leftTargets, leftLightingBindGroup, true);
      drawGeometryPass(rightTargets, rightLightingBindGroup, false);

      const transparentPass = commandEncoder.beginRenderPass({
        label: "lesson-38-right-forward-transparent-pass",
        colorAttachments: [
          {
            view: rightTargets.sceneView,
            loadOp: "load",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: rightTargets.depthView,
          depthLoadOp: "load",
          depthStoreOp: "discard",
        },
      });
      transparentPass.setPipeline(forwardPipeline);
      transparentPass.setBindGroup(1, forwardLightBindGroup);
      sortedTransparentObjects.forEach((object) => {
        transparentPass.setBindGroup(0, object.bindGroup);
        transparentPass.setVertexBuffer(0, quadVertexBuffer);
        transparentPass.setIndexBuffer(quadIndexBuffer, "uint16");
        transparentPass.drawIndexed(geometry.quad.indexCount);
      });
      transparentPass.end();

      const presentPass = commandEncoder.beginRenderPass({
        label: "lesson-38-present-pass",
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.039, g: 0.070, b: 0.133, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      presentPass.setPipeline(presentPipeline);
      presentPass.setBindGroup(0, currentPresentBindGroup);
      presentPass.draw(3);
      presentPass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    const resizeObserver = new ResizeObserver(() => {
      destroyPanelTargets(leftTargets);
      destroyPanelTargets(rightTargets);
      syncViewport();
      render(performance.now());
    });
    resizeObserver.observe(host);

    const frame = (timestamp: number) => {
      render(timestamp);
      animationFrameId = window.requestAnimationFrame(frame);
    };
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "Deferred 与透明物体已运行",
      detail:
        "左边故意把两块玻璃板硬塞进 G-buffer，后面的亮色立方体会更像被实体挡住；右边则改成不透明走 deferred、透明走 forward blend，所以还能更自然地透过去看见后面的物体。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      destroyPanelTargets(leftTargets);
      destroyPanelTargets(rightTargets);
      cubeVertexBuffer.destroy();
      cubeIndexBuffer.destroy();
      quadVertexBuffer.destroy();
      quadIndexBuffer.destroy();
      lightUniformBuffer.destroy();
      renderObjects.forEach((object) => object.uniformBuffer.destroy());
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知的 WebGPU 错误。";
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
