import damagedHelmetUrl from "@/assets/damaged-helmet-basic.glb?url";
import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createCubemapLessonGeometry } from "@/lessons/lesson-76-cubemap-and-skybox/geometry";
import {
  loadPbrGlbScene,
  type LoadedPbrGlbDrawable,
  type LoadedPbrGlbMaterial,
} from "@/lessons/lesson-83-gltf-pbr-basic/glb";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationXMatrix,
  createRotationYMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-83-gltf-pbr-basic/math";
import modelFragmentShaderSource from "@/lessons/lesson-84-ibl-and-image-based-lighting/model.frag.wgsl?raw";
import modelVertexShaderSource from "@/lessons/lesson-84-ibl-and-image-based-lighting/model.vert.wgsl?raw";
import skyboxFragmentShaderSource from "@/lessons/lesson-84-ibl-and-image-based-lighting/skybox.frag.wgsl?raw";
import skyboxVertexShaderSource from "@/lessons/lesson-84-ibl-and-image-based-lighting/skybox.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type IblPanelMode = "direct" | "ibl";

type IblPanelRect = {
  mode: IblPanelMode;
  x: number;
  y: number;
  width: number;
  height: number;
};

type IblSettings = {
  directIntensity: number;
  environmentIntensity: number;
  environmentRotation: number;
};

type IblHudRefs = {
  directRange: HTMLInputElement;
  directValue: HTMLElement;
  environmentRange: HTMLInputElement;
  environmentValue: HTMLElement;
  rotationRange: HTMLInputElement;
  rotationValue: HTMLElement;
  directCard: HTMLElement;
  environmentCard: HTMLElement;
  comparisonCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type PbrRenderablePrimitive = LoadedPbrGlbDrawable["primitives"][number] & {
  materialUniformBuffer: GPUBuffer;
  materialBindGroup: GPUBindGroup;
};

type PbrRenderable = {
  name: string;
  primitives: PbrRenderablePrimitive[];
  baseWorldMatrix: Float32Array;
  nodeUniformBuffer: GPUBuffer;
  nodeBindGroup: GPUBindGroup;
};

const PANEL_MODES: IblPanelMode[] = ["direct", "ibl"];

/**
 * 把当前帧的 VP、天空盒 VP、主光方向、相机位置和 IBL 参数打包成 frame uniform。
 * @param {Float32Array} viewProjectionMatrix 当前面板的 VP 矩阵。
 * @param {Float32Array} skyboxViewProjectionMatrix 当前面板的天空盒 VP 矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @param {Vector3} cameraPosition 当前相机位置。
 * @param {IblSettings} settings 当前 lesson 的灯光与环境参数。
 * @param {number} iblWeight 当前面板是否启用 IBL；直射对照栏传 0，IBL 栏传 1。
 * @returns {Float32Array} 可直接写进 frame uniform buffer 的连续数据。
 */
function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  skyboxViewProjectionMatrix: Float32Array,
  lightDirection: Vector3,
  cameraPosition: Vector3,
  settings: IblSettings,
  iblWeight: number
): Float32Array {
  const uniformData = new Float32Array(44);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set(skyboxViewProjectionMatrix, 16);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    32
  );
  uniformData.set(
    [cameraPosition[0], cameraPosition[1], cameraPosition[2], 0],
    36
  );
  uniformData.set(
    [
      settings.directIntensity,
      settings.environmentIntensity,
      settings.environmentRotation,
      iblWeight,
    ],
    40
  );
  return uniformData;
}

/**
 * 把当前 drawable 的模型矩阵打包成节点 uniform。
 * @param {Float32Array} modelMatrix 当前节点这一帧使用的模型矩阵。
 * @returns {Float32Array} 对应的节点 uniform 数据。
 */
function createNodeUniformData(modelMatrix: Float32Array): Float32Array {
  const uniformData = new Float32Array(16);
  uniformData.set(modelMatrix, 0);
  return uniformData;
}

/**
 * 把 glTF 材质里的 baseColor / metallic / roughness / normalScale 打包成 material uniform。
 * @param {LoadedPbrGlbMaterial} material 当前 primitive 对应的 PBR 材质。
 * @returns {Float32Array} 可直接写进 material uniform buffer 的连续 float 数据。
 */
function createMaterialUniformData(
  material: LoadedPbrGlbMaterial
): Float32Array {
  const uniformData = new Float32Array(8);
  uniformData.set(material.baseColorFactor, 0);
  uniformData.set(
    [
      material.metallicFactor,
      material.roughnessFactor,
      material.normalScale,
      0,
    ],
    4
  );
  return uniformData;
}

/**
 * 把当前画布分成左右两个 panel，左边看直射光，右边看直射光 + IBL。
 * @param {number} width 当前 WebGPU 画布的像素宽度。
 * @param {number} height 当前 WebGPU 画布的像素高度。
 * @returns {IblPanelRect[]} 两个并排面板的布局结果。
 */
function createPanelRects(width: number, height: number): IblPanelRect[] {
  const inset = Math.max(12, Math.floor(Math.min(width, height) * 0.024));
  const gap = Math.max(12, Math.floor(Math.min(width, height) * 0.022));
  const panelWidth = Math.max(64, Math.floor((width - inset * 2 - gap) / 2));
  const panelHeight = Math.max(64, height - inset * 2);

  return PANEL_MODES.map((mode, index) => ({
    mode,
    x: inset + index * (panelWidth + gap),
    y: inset,
    width: panelWidth,
    height: panelHeight,
  }));
}

/**
 * 去掉视图矩阵里的平移，让天空盒只响应相机旋转而不响应位移。
 * @param {Float32Array} viewMatrix 原始视图矩阵。
 * @returns {Float32Array} 去掉平移后的天空盒视图矩阵。
 */
function createSkyboxViewMatrix(viewMatrix: Float32Array): Float32Array {
  const result = new Float32Array(viewMatrix);
  result[12] = 0;
  result[13] = 0;
  result[14] = 0;
  return result;
}

/**
 * 释放当前 lesson 使用的深度纹理。
 * @param {DepthTarget} target 当前维护的深度目标。
 * @returns {void} 只负责销毁纹理并清空引用。
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
        const lit =
          base * (1 - stripe * 0.18) + palette.accent[channel] * stripe * 0.18;
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
 * 创建并上传一张程序生成的 cubemap；后续天空盒和 IBL 都会采样它。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPUQueue} queue 当前 lesson 使用的 GPU 队列。
 * @returns {{ texture: GPUTexture; view: GPUTextureView; sampler: GPUSampler }} 后续天空盒和材质共同使用的环境资源。
 */
function createEnvironmentCubemap(
  device: GPUDevice,
  queue: GPUQueue
): { texture: GPUTexture; view: GPUTextureView; sampler: GPUSampler } {
  const faceSize = 96;
  const texture = device.createTexture({
    size: [faceSize, faceSize, 6],
    format: "rgba8unorm",
    mipLevelCount: 1,
    dimension: "2d",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  for (let faceIndex = 0; faceIndex < 6; faceIndex += 1) {
    const faceData = createCubemapFaceData(faceSize, faceIndex);
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

  const view = texture.createView({ dimension: "cube" });
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  return { texture, view, sampler };
}

/**
 * 同步第 33 课的外置 HUD 文案。
 * @param {IblHudRefs} refs 当前 lesson 用到的 DOM 引用集合。
 * @param {IblSettings} settings 当前灯光与环境参数。
 * @returns {void} 只更新界面文本，不返回额外结果。
 */
function updateHud(refs: IblHudRefs, settings: IblSettings): void {
  const directPercent = Math.round(settings.directIntensity * 100);
  const environmentPercent = Math.round(settings.environmentIntensity * 100);
  const rotationDegrees = Math.round((settings.environmentRotation * 180) / Math.PI);

  refs.directValue.textContent = `${directPercent}%`;
  refs.environmentValue.textContent = `${environmentPercent}%`;
  refs.rotationValue.textContent = `${rotationDegrees}°`;
  refs.directCard.textContent = `主光 ${directPercent}%`;
  refs.environmentCard.textContent =
    `环境漫反射 + 反射 ${environmentPercent}%`;
  refs.comparisonCard.textContent =
    "左栏只保留 Cook-Torrance 直射项，右栏再叠加 cubemap 采样得到的环境项。";
  refs.observationCard.textContent =
    environmentPercent > directPercent
      ? "右栏现在更依赖环境贴图，金属高光会更像“从周围世界反射回来”。"
      : "右栏仍能看到环境反射，但主光方向还是主导高光位置。";
  refs.legend.textContent =
    "当前实验：天空盒在左右两栏都可见，但只有右栏把它继续当作材质的光照来源。" +
    "这就是 image-based lighting 的关键区别：环境图不再只是背景，而会同时提供漫反射环境色和镜面反射颜色。";
}

/**
 * 挂载“IBL 与环境贴图照明”预览。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountIblAndImageBasedLightingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--ibl">
      <div class="ibl-stage">
        <div class="ibl-badges">
          <span class="ibl-badge">沿用第 26 课的 cubemap，当背景也当光源</span>
          <span class="ibl-badge">左栏只看直射光，右栏补上 image-based lighting</span>
          <span class="ibl-badge">PBR 终于不再只靠一盏主光</span>
        </div>

        <div class="ibl-controls">
          <label class="ibl-control">
            <span>主光强度</span>
            <input type="range" min="25" max="150" value="82" data-direct-range />
            <strong data-direct-value>82%</strong>
          </label>
          <label class="ibl-control">
            <span>环境强度</span>
            <input type="range" min="0" max="200" value="110" data-environment-range />
            <strong data-environment-value>110%</strong>
          </label>
          <label class="ibl-control">
            <span>环境旋转</span>
            <input type="range" min="-180" max="180" value="0" data-rotation-range />
            <strong data-rotation-value>0°</strong>
          </label>
        </div>

        <div class="ibl-stage__labels">
          <article class="ibl-label">
            <p class="eyebrow">Direct Only</p>
            <strong>只看主光</strong>
            <span>helmet 仍然是 PBR，但环境图只停留在背景层。</span>
          </article>
          <article class="ibl-label ibl-label--cool">
            <p class="eyebrow">Direct + IBL</p>
            <strong>把环境图接进材质</strong>
            <span>同一张 cubemap 同时提供天空背景、环境漫反射和镜面反射。</span>
          </article>
        </div>

        <div class="ibl-frame">
          <canvas
            class="ibl-canvas"
            aria-label="IBL and image based lighting lesson preview"
          ></canvas>
        </div>

        <div class="ibl-card-grid">
          <article class="ibl-card">
            <p>主光</p>
            <strong data-direct-card>主光 82%</strong>
          </article>
          <article class="ibl-card">
            <p>环境项</p>
            <strong data-environment-card>环境漫反射 + 反射 110%</strong>
          </article>
          <article class="ibl-card">
            <p>对照关系</p>
            <strong data-comparison-card>左栏只保留 Cook-Torrance 直射项，右栏再叠加 cubemap 采样得到的环境项。</strong>
          </article>
          <article class="ibl-card">
            <p>当前观察</p>
            <strong data-observation-card>右栏的金属区域会更像“从环境里借来的颜色”。</strong>
          </article>
        </div>

        <div class="ibl-legend" data-legend></div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>(".ibl-canvas");
  const refs: IblHudRefs = {
    directRange: host.querySelector<HTMLInputElement>("[data-direct-range]")!,
    directValue: host.querySelector<HTMLElement>("[data-direct-value]")!,
    environmentRange: host.querySelector<HTMLInputElement>("[data-environment-range]")!,
    environmentValue: host.querySelector<HTMLElement>("[data-environment-value]")!,
    rotationRange: host.querySelector<HTMLInputElement>("[data-rotation-range]")!,
    rotationValue: host.querySelector<HTMLElement>("[data-rotation-value]")!,
    directCard: host.querySelector<HTMLElement>("[data-direct-card]")!,
    environmentCard: host.querySelector<HTMLElement>("[data-environment-card]")!,
    comparisonCard: host.querySelector<HTMLElement>("[data-comparison-card]")!,
    observationCard: host.querySelector<HTMLElement>("[data-observation-card]")!,
    legend: host.querySelector<HTMLElement>("[data-legend]")!,
  };

  if (!canvas) {
    throw new Error("第 33 课的预览 canvas 没有创建成功。");
  }
  if (Object.values(refs).some((value) => !value)) {
    throw new Error("第 33 课的 HUD DOM 没有创建完整。");
  }

  const depthTarget: DepthTarget = {
    texture: null,
    view: null,
    width: 0,
    height: 0,
  };

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const settings: IblSettings = {
      directIntensity: Number(refs.directRange.value) / 100,
      environmentIntensity: Number(refs.environmentRange.value) / 100,
      environmentRotation:
        (Number(refs.rotationRange.value) * Math.PI) / 180,
    };

    updateHud(refs, settings);

    const helmetScene = await loadPbrGlbScene(damagedHelmetUrl, gpu.device);
    const skyboxGeometry = createCubemapLessonGeometry();

    const skyboxVertexBuffer = gpu.device.createBuffer({
      size: skyboxGeometry.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(skyboxVertexBuffer, 0, skyboxGeometry.vertexData);

    const skyboxIndexBuffer = gpu.device.createBuffer({
      size: skyboxGeometry.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(skyboxIndexBuffer, 0, skyboxGeometry.indexData);

    const frameBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const nodeBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" },
        },
      ],
    });

    const materialBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.FRAGMENT,
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

    const modelPipeline = gpu.device.createRenderPipeline({
      label: "lesson-33-ibl-model",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          frameBindGroupLayout,
          nodeBindGroupLayout,
          materialBindGroupLayout,
          environmentBindGroupLayout,
        ],
      }),
      vertex: {
        module: gpu.device.createShaderModule({
          code: modelVertexShaderSource,
        }),
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: 3 * 4,
            attributes: [
              {
                shaderLocation: 0,
                offset: 0,
                format: "float32x3",
              },
            ],
          },
          {
            arrayStride: 3 * 4,
            attributes: [
              {
                shaderLocation: 1,
                offset: 0,
                format: "float32x3",
              },
            ],
          },
          {
            arrayStride: 2 * 4,
            attributes: [
              {
                shaderLocation: 2,
                offset: 0,
                format: "float32x2",
              },
            ],
          },
        ],
      },
      fragment: {
        module: gpu.device.createShaderModule({
          code: modelFragmentShaderSource,
        }),
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

    const skyboxPipeline = gpu.device.createRenderPipeline({
      label: "lesson-33-ibl-skybox",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, environmentBindGroupLayout],
      }),
      vertex: {
        module: gpu.device.createShaderModule({
          code: skyboxVertexShaderSource,
        }),
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
        module: gpu.device.createShaderModule({
          code: skyboxFragmentShaderSource,
        }),
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

    const frameUniformBuffers = PANEL_MODES.map(() =>
      gpu.device.createBuffer({
        size: 44 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })
    );

    const frameBindGroups = frameUniformBuffers.map((buffer) =>
      gpu.device.createBindGroup({
        layout: frameBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer },
          },
        ],
      })
    );

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

    const renderables: PbrRenderable[] = helmetScene.drawables.map((drawable) => {
      const nodeUniformBuffer = gpu.device.createBuffer({
        size: 16 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const nodeBindGroup = gpu.device.createBindGroup({
        layout: nodeBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: nodeUniformBuffer },
          },
        ],
      });

      const primitives = drawable.primitives.map((primitive) => {
        const materialUniformBuffer = gpu.device.createBuffer({
          size: 8 * 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        gpu.device.queue.writeBuffer(
          materialUniformBuffer,
          0,
          createMaterialUniformData(primitive.material)
        );

        const materialBindGroup = gpu.device.createBindGroup({
          layout: materialBindGroupLayout,
          entries: [
            {
              binding: 0,
              resource: primitive.material.baseColorSampler,
            },
            {
              binding: 1,
              resource: primitive.material.baseColorTextureView,
            },
            {
              binding: 2,
              resource: primitive.material.metallicRoughnessTextureView,
            },
            {
              binding: 3,
              resource: primitive.material.normalTextureView,
            },
            {
              binding: 4,
              resource: { buffer: materialUniformBuffer },
            },
          ],
        });

        return {
          ...primitive,
          materialUniformBuffer,
          materialBindGroup,
        };
      });

      return {
        name: drawable.name,
        primitives,
        baseWorldMatrix: drawable.baseWorldMatrix,
        nodeUniformBuffer,
        nodeBindGroup,
      };
    });

    const sceneMin = helmetScene.bounds.min;
    const sceneMax = helmetScene.bounds.max;
    const extentX = sceneMax[0] - sceneMin[0];
    const extentY = sceneMax[1] - sceneMin[1];
    const extentZ = sceneMax[2] - sceneMin[2];
    const modelRadius = Math.max(extentX, extentY, extentZ) * 0.55;
    const target: Vector3 = [0, -modelRadius * 0.05, 0];
    const eye: Vector3 = [0, modelRadius * 0.34, Math.max(modelRadius * 2.9, 4.2)];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
      minRadius: Math.max(modelRadius * 1.4, 2.8),
      maxRadius: Math.max(modelRadius * 5.4, 8.6),
    });
    const lightDirection = normalizeVector([0.45, 0.82, 0.34]);

    const ensureDepthTarget = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        depthTarget.texture &&
        depthTarget.view &&
        depthTarget.width === width &&
        depthTarget.height === height
      ) {
        return depthTarget.view;
      }

      destroyDepthTarget(depthTarget);
      depthTarget.texture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTarget.view = depthTarget.texture.createView();
      depthTarget.width = width;
      depthTarget.height = height;
      return depthTarget.view;
    };

    const render = (elapsed: number) => {
      gpu.resize();
      const depthView = ensureDepthTarget();
      const panelRects = createPanelRects(canvas.width, canvas.height);
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, target, camera.up);
      const skyboxViewMatrix = createSkyboxViewMatrix(viewMatrix);
      const spinMatrix = multiplyMatrices(
        createRotationYMatrix(elapsed * 0.24),
        createRotationXMatrix(-0.1)
      );

      const commandEncoder = gpu.device.createCommandEncoder();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.038, g: 0.066, b: 0.132, a: 1 },
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

      panelRects.forEach((panelRect, panelIndex) => {
        const aspect = panelRect.width / panelRect.height;
        const projectionMatrix = createPerspectiveMatrix(
          (48 * Math.PI) / 180,
          aspect,
          0.1,
          100
        );
        const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
        const skyboxViewProjectionMatrix = multiplyMatrices(
          projectionMatrix,
          skyboxViewMatrix
        );
        const iblWeight = panelRect.mode === "ibl" ? 1 : 0;

        gpu.device.queue.writeBuffer(
          frameUniformBuffers[panelIndex],
          0,
          createFrameUniformData(
            viewProjectionMatrix,
            skyboxViewProjectionMatrix,
            lightDirection,
            camera.eye,
            settings,
            iblWeight
          )
        );

        pass.setViewport(
          panelRect.x,
          panelRect.y,
          panelRect.width,
          panelRect.height,
          0,
          1
        );
        pass.setScissorRect(
          panelRect.x,
          panelRect.y,
          panelRect.width,
          panelRect.height
        );

        pass.setPipeline(skyboxPipeline);
        pass.setBindGroup(0, frameBindGroups[panelIndex]);
        pass.setBindGroup(1, environmentBindGroup);
        pass.setVertexBuffer(0, skyboxVertexBuffer);
        pass.setIndexBuffer(skyboxIndexBuffer, "uint16");
        pass.drawIndexed(skyboxGeometry.indexCount);

        pass.setPipeline(modelPipeline);
        pass.setBindGroup(0, frameBindGroups[panelIndex]);
        pass.setBindGroup(3, environmentBindGroup);

        renderables.forEach((renderable) => {
          const modelMatrix = multiplyMatrices(
            spinMatrix,
            renderable.baseWorldMatrix
          );
          gpu.device.queue.writeBuffer(
            renderable.nodeUniformBuffer,
            0,
            createNodeUniformData(modelMatrix)
          );
          pass.setBindGroup(1, renderable.nodeBindGroup);

          renderable.primitives.forEach((primitive) => {
            pass.setBindGroup(2, primitive.materialBindGroup);
            pass.setVertexBuffer(0, primitive.positionBuffer);
            pass.setVertexBuffer(1, primitive.normalBuffer);
            pass.setVertexBuffer(2, primitive.uvBuffer);
            if (primitive.indexBuffer && primitive.indexFormat) {
              pass.setIndexBuffer(primitive.indexBuffer, primitive.indexFormat);
              pass.drawIndexed(primitive.indexCount);
            } else {
              pass.draw(primitive.vertexCount);
            }
          });
        });
      });

      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    const onSettingsInput = () => {
      settings.directIntensity = Number(refs.directRange.value) / 100;
      settings.environmentIntensity =
        Number(refs.environmentRange.value) / 100;
      settings.environmentRotation =
        (Number(refs.rotationRange.value) * Math.PI) / 180;
      updateHud(refs, settings);
    };

    refs.directRange.addEventListener("input", onSettingsInput);
    refs.environmentRange.addEventListener("input", onSettingsInput);
    refs.rotationRange.addEventListener("input", onSettingsInput);

    let animationFrameId = 0;
    const startTime = performance.now();

    const frame = (time: number) => {
      render((time - startTime) * 0.001);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      destroyDepthTarget(depthTarget);
    });
    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "IBL 与环境贴图照明已运行",
      detail:
        "左栏只保留直射光，右栏把同一张 cubemap 同时接进环境漫反射和镜面反射，让 PBR 第一次真正开始“吃环境”。",
      tone: "ok",
    });

    return () => {
      refs.directRange.removeEventListener("input", onSettingsInput);
      refs.environmentRange.removeEventListener("input", onSettingsInput);
      refs.rotationRange.removeEventListener("input", onSettingsInput);
      resizeObserver.disconnect();
      orbitCamera.dispose();
      window.cancelAnimationFrame(animationFrameId);
      destroyDepthTarget(depthTarget);
      environment.texture.destroy();
      frameUniformBuffers.forEach((buffer) => buffer.destroy());
      skyboxVertexBuffer.destroy();
      skyboxIndexBuffer.destroy();
      renderables.forEach((renderable) => {
        renderable.nodeUniformBuffer.destroy();
        renderable.primitives.forEach((primitive) => {
          primitive.materialUniformBuffer.destroy();
        });
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

    destroyDepthTarget(depthTarget);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
