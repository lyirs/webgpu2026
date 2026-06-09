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
import modelFragmentShaderSource from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/model.frag.wgsl?raw";
import modelVertexShaderSource from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/model.vert.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/present.wgsl?raw";
import skyboxFragmentShaderSource from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/skybox.frag.wgsl?raw";
import skyboxVertexShaderSource from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/skybox.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type HdrToneMapper = "reinhard" | "aces";

type HdrSettings = {
  sunIntensity: number;
  exposure: number;
  toneMapper: HdrToneMapper;
  environmentIntensity: number;
};

type HdrHudRefs = {
  sunRange: HTMLInputElement;
  sunValue: HTMLElement;
  exposureRange: HTMLInputElement;
  exposureValue: HTMLElement;
  reinhardButton: HTMLButtonElement;
  acesButton: HTMLButtonElement;
  toneMapperValue: HTMLElement;
  dynamicRangeCard: HTMLElement;
  exposureCard: HTMLElement;
  toneMapperCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneTargets = {
  colorTexture: GPUTexture | null;
  colorView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  presentBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

type EnvironmentCubemap = {
  texture: GPUTexture;
  view: GPUTextureView;
  sampler: GPUSampler;
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

function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  skyboxViewProjectionMatrix: Float32Array,
  lightDirection: Vector3,
  cameraPosition: Vector3,
  settings: HdrSettings
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
    [settings.sunIntensity, settings.environmentIntensity, 0, 0],
    40
  );
  return uniformData;
}

function createPresentUniformData(settings: HdrSettings): Float32Array {
  return new Float32Array([
    settings.exposure,
    settings.toneMapper === "aces" ? 1 : 0,
    0,
    0,
  ]);
}

function createNodeUniformData(modelMatrix: Float32Array): Float32Array {
  const uniformData = new Float32Array(16);
  uniformData.set(modelMatrix, 0);
  return uniformData;
}

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

function createSkyboxViewMatrix(viewMatrix: Float32Array): Float32Array {
  const result = new Float32Array(viewMatrix);
  result[12] = 0;
  result[13] = 0;
  result[14] = 0;
  return result;
}

function destroySceneTargets(targets: SceneTargets): void {
  targets.colorTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.colorTexture = null;
  targets.colorView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.presentBindGroup = null;
  targets.width = 0;
  targets.height = 0;
}

function createCubemapFaceData(size: number, faceIndex: number): Uint8Array {
  const palettes = [
    { top: [255, 168, 102], bottom: [188, 93, 38], accent: [255, 236, 190] },
    { top: [116, 224, 247], bottom: [32, 122, 158], accent: [204, 249, 255] },
    { top: [255, 238, 184], bottom: [214, 165, 68], accent: [255, 252, 226] },
    { top: [123, 111, 228], bottom: [44, 54, 130], accent: [210, 201, 255] },
    { top: [255, 152, 188], bottom: [161, 70, 107], accent: [255, 220, 232] },
    { top: [138, 241, 202], bottom: [42, 129, 101], accent: [227, 255, 240] },
  ] as const;
  const palette = palettes[faceIndex];
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const u = x / Math.max(size - 1, 1);
      const v = y / Math.max(size - 1, 1);
      const horizonMix = Math.pow(v, 0.8);
      const stripe = Math.max(
        0,
        1 - Math.abs(Math.sin((u * 2.2 + v * 0.35 + faceIndex) * Math.PI * 2)) * 0.8
      );
      const accentMix = stripe * 0.28;

      for (let channel = 0; channel < 3; channel += 1) {
        const base =
          palette.top[channel] * (1 - horizonMix) +
          palette.bottom[channel] * horizonMix;
        const accented = base * (1 - accentMix) + palette.accent[channel] * accentMix;
        pixels[offset + channel] = Math.max(0, Math.min(255, Math.round(accented)));
      }

      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

function createEnvironmentCubemap(
  device: GPUDevice,
  queue: GPUQueue
): EnvironmentCubemap {
  const size = 96;
  const texture = device.createTexture({
    size: [size, size, 6],
    dimension: "2d",
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  for (let face = 0; face < 6; face += 1) {
    queue.writeTexture(
      { texture, origin: { x: 0, y: 0, z: face } },
      createCubemapFaceData(size, face),
      { bytesPerRow: size * 4, rowsPerImage: size },
      { width: size, height: size, depthOrArrayLayers: 1 }
    );
  }

  return {
    texture,
    view: texture.createView({ dimension: "cube" }),
    sampler: device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    }),
  };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function toneMapperLabel(toneMapper: HdrToneMapper): string {
  return toneMapper === "aces" ? "ACES-like" : "Reinhard";
}

function estimateHdrPeak(settings: HdrSettings): number {
  return settings.sunIntensity * 10.5 + settings.environmentIntensity * 1.8;
}

function currentObservation(settings: HdrSettings): string {
  if (settings.sunIntensity >= 3.6 && settings.exposure >= 1.1) {
    return "左栏会很快把太阳和高光压成一片白，右栏仍然能看到较完整的亮部滚降。";
  }
  if (settings.exposure <= 0.65) {
    return "右栏正在用较低曝光保住亮部；左栏虽然看起来更亮，但细节会先一步被裁掉。";
  }
  if (settings.toneMapper === "reinhard") {
    return "Reinhard 的肩部更直接，亮部压缩明显；它能先把 HDR 信号带回显示器可承受的范围。";
  }
  return "ACES-like 会让太阳和金属高光的肩部更柔顺，所以右栏通常比左栏更像“亮而不炸”。";
}

function updateHud(refs: HdrHudRefs, settings: HdrSettings): void {
  const peakEstimate = estimateHdrPeak(settings);

  refs.sunValue.textContent = formatPercent(settings.sunIntensity);
  refs.exposureValue.textContent = `${settings.exposure.toFixed(2)}x`;
  refs.toneMapperValue.textContent = toneMapperLabel(settings.toneMapper);

  refs.reinhardButton.classList.toggle(
    "hdr-tone-toggle__button--active",
    settings.toneMapper === "reinhard"
  );
  refs.acesButton.classList.toggle(
    "hdr-tone-toggle__button--active",
    settings.toneMapper === "aces"
  );

  refs.dynamicRangeCard.textContent =
    `场景峰值大约来到 ${peakEstimate.toFixed(1)}x white，左栏会直接把这部分裁到 1.0。`;
  refs.exposureCard.textContent =
    `右栏先乘 ${settings.exposure.toFixed(2)}x exposure，再进入 ${toneMapperLabel(
      settings.toneMapper
    )}。`;
  refs.toneMapperCard.textContent =
    `${toneMapperLabel(settings.toneMapper)} 正在把 scene-linear HDR 压回显示器能承受的 SDR 区间。`;
  refs.observationCard.textContent = currentObservation(settings);

  refs.legend.innerHTML = `
    <strong>这一课的主线</strong>
    同一张场景先渲到 <code>rgba16float</code> HDR 纹理。左栏只做 <code>clamp</code>，所以超过 1.0 的亮部会直接烧白；
    右栏会先乘 <code>exposure</code>，再经过 <code>${toneMapperLabel(settings.toneMapper)}</code>，
    所以它展示的是“怎么把 scene-linear 的光照结果压回显示器”的那一步。顶部那条 HDR 参考亮度条故意放了从
    <code>0.18x</code> 到 <code>16x white</code> 的亮度块，左栏会更早并成白块，右栏还能保住更多层级。
  `;
}

export async function mountHdrExposureAndToneMappingLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--hdr-tone-mapping">
      <div class="hdr-tone-stage">
        <div class="hdr-tone-badges">
          <span class="hdr-tone-badge">先渲到 <code>rgba16float</code>，再做显示映射</span>
          <span class="hdr-tone-badge">左栏只会 clamp，右栏才会乘曝光并 tone map</span>
          <span class="hdr-tone-badge">这一步决定 HDR 光照结果怎样落到显示器上</span>
        </div>

        <div class="hdr-tone-controls">
          <label class="hdr-tone-control">
            <span>太阳强度</span>
            <input type="range" min="120" max="650" value="430" data-sun-range />
            <strong data-sun-value>430%</strong>
          </label>

          <label class="hdr-tone-control">
            <span>曝光</span>
            <input type="range" min="35" max="180" value="72" data-exposure-range />
            <strong data-exposure-value>0.72x</strong>
          </label>

          <div class="hdr-tone-control hdr-tone-control--toggle">
            <span>Tone Mapper</span>
            <div class="hdr-tone-toggle" role="group" aria-label="Tone mapper">
              <button
                type="button"
                class="hdr-tone-toggle__button hdr-tone-toggle__button--active"
                data-tone-button="reinhard"
              >
                Reinhard
              </button>
              <button
                type="button"
                class="hdr-tone-toggle__button"
                data-tone-button="aces"
              >
                ACES-like
              </button>
            </div>
            <strong data-tone-mapper-value>Reinhard</strong>
          </div>
        </div>

        <div class="hdr-tone-stage__labels">
          <article class="hdr-tone-label">
            <p class="eyebrow">Raw Clamp</p>
            <strong>直接塞回 SDR</strong>
            <span>超过 1.0 的 HDR 亮部会在显示前被硬裁掉，所以最亮的太阳和高光会先糊成白块。</span>
          </article>
          <article class="hdr-tone-label hdr-tone-label--cool">
            <p class="eyebrow">Exposure + Tone Mapping</p>
            <strong>先曝光，再压回显示器</strong>
            <span>同一张 HDR 纹理先乘曝光，再用 tone mapper 做肩部压缩，亮部滚降会更自然。</span>
          </article>
        </div>

        <div class="hdr-tone-frame">
          <canvas
            class="hdr-tone-canvas"
            aria-label="HDR exposure and tone mapping lesson preview"
          ></canvas>
        </div>

        <div class="hdr-tone-card-grid">
          <article class="hdr-tone-card">
            <p>动态范围</p>
            <strong data-dynamic-range-card></strong>
          </article>
          <article class="hdr-tone-card">
            <p>曝光</p>
            <strong data-exposure-card></strong>
          </article>
          <article class="hdr-tone-card">
            <p>Tone Mapper</p>
            <strong data-tone-mapper-card></strong>
          </article>
          <article class="hdr-tone-card">
            <p>当前观察</p>
            <strong data-observation-card></strong>
          </article>
        </div>

        <div class="hdr-tone-legend" data-legend></div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>(".hdr-tone-canvas");
  const refs: HdrHudRefs = {
    sunRange: host.querySelector<HTMLInputElement>("[data-sun-range]")!,
    sunValue: host.querySelector<HTMLElement>("[data-sun-value]")!,
    exposureRange: host.querySelector<HTMLInputElement>("[data-exposure-range]")!,
    exposureValue: host.querySelector<HTMLElement>("[data-exposure-value]")!,
    reinhardButton: host.querySelector<HTMLButtonElement>(
      '[data-tone-button="reinhard"]'
    )!,
    acesButton: host.querySelector<HTMLButtonElement>(
      '[data-tone-button="aces"]'
    )!,
    toneMapperValue: host.querySelector<HTMLElement>("[data-tone-mapper-value]")!,
    dynamicRangeCard: host.querySelector<HTMLElement>("[data-dynamic-range-card]")!,
    exposureCard: host.querySelector<HTMLElement>("[data-exposure-card]")!,
    toneMapperCard: host.querySelector<HTMLElement>("[data-tone-mapper-card]")!,
    observationCard: host.querySelector<HTMLElement>("[data-observation-card]")!,
    legend: host.querySelector<HTMLElement>("[data-legend]")!,
  };

  if (!canvas) {
    throw new Error("第 56 课的预览 canvas 没有创建成功。");
  }
  if (Object.values(refs).some((value) => !value)) {
    throw new Error("第 56 课的 HUD DOM 没有创建完整。");
  }

  const settings: HdrSettings = {
    sunIntensity: Number(refs.sunRange.value) / 100,
    exposure: Number(refs.exposureRange.value) / 100,
    toneMapper: "reinhard",
    environmentIntensity: 0.72,
  };
  updateHud(refs, settings);

  const targets: SceneTargets = {
    colorTexture: null,
    colorView: null,
    depthTexture: null,
    depthView: null,
    presentBindGroup: null,
    width: 0,
    height: 0,
  };

  let animationFrameId = 0;
  let environment: EnvironmentCubemap | null = null;

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const helmetScene = await loadPbrGlbScene(damagedHelmetUrl, gpu.device);

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
      label: "lesson-56-hdr-scene-model",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [
          frameBindGroupLayout,
          nodeBindGroupLayout,
          materialBindGroupLayout,
          environmentBindGroupLayout,
        ],
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: modelVertexShaderSource }),
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
        module: gpu.device.createShaderModule({ code: modelFragmentShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: "rgba16float" }],
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
      label: "lesson-56-hdr-scene-skybox",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, environmentBindGroupLayout],
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: skyboxVertexShaderSource }),
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
        module: gpu.device.createShaderModule({ code: skyboxFragmentShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: "rgba16float" }],
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

    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-56-hdr-present",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({ code: presentShaderSource }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: presentShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const frameUniformBuffer = gpu.device.createBuffer({
      size: 44 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const presentUniformBuffer = gpu.device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const frameBindGroup = gpu.device.createBindGroup({
      layout: frameBindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: frameUniformBuffer },
        },
      ],
    });

    environment = createEnvironmentCubemap(gpu.device, gpu.device.queue);

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

    const presentSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
    });
    const presentBindGroupLayout = presentPipeline.getBindGroupLayout(0);

    const ensureSceneTargets = () => {
      gpu.resize();
      const width = canvas.width;
      const height = canvas.height;

      if (
        targets.colorView &&
        targets.depthView &&
        targets.presentBindGroup &&
        targets.width === width &&
        targets.height === height
      ) {
        return;
      }

      destroySceneTargets(targets);

      targets.colorTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.colorView = targets.colorTexture.createView();

      targets.depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      targets.depthView = targets.depthTexture.createView();

      targets.presentBindGroup = gpu.device.createBindGroup({
        layout: presentBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: presentSampler,
          },
          {
            binding: 1,
            resource: targets.colorView,
          },
          {
            binding: 2,
            resource: { buffer: presentUniformBuffer },
          },
        ],
      });

      targets.width = width;
      targets.height = height;
    };

    const sceneMin = helmetScene.bounds.min;
    const sceneMax = helmetScene.bounds.max;
    const extentX = sceneMax[0] - sceneMin[0];
    const extentY = sceneMax[1] - sceneMin[1];
    const extentZ = sceneMax[2] - sceneMin[2];
    const modelRadius = Math.max(extentX, extentY, extentZ) * 0.55;
    const target: Vector3 = [0, -modelRadius * 0.04, 0];
    const eye: Vector3 = [0, modelRadius * 0.34, Math.max(modelRadius * 2.9, 4.2)];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
      minRadius: Math.max(modelRadius * 1.45, 2.9),
      maxRadius: Math.max(modelRadius * 5.2, 8.4),
    });
    const lightDirection = normalizeVector([0.18, 0.74, 0.64]);

    const render = (time: number) => {
      ensureSceneTargets();

      if (
        !targets.colorView ||
        !targets.depthView ||
        !targets.presentBindGroup
      ) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const elapsed = time * 0.001;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, target, camera.up);
      const skyboxViewMatrix = createSkyboxViewMatrix(viewMatrix);
      const projectionMatrix = createPerspectiveMatrix(
        (48 * Math.PI) / 180,
        canvas.width / canvas.height,
        0.1,
        100
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const skyboxViewProjectionMatrix = multiplyMatrices(
        projectionMatrix,
        skyboxViewMatrix
      );
      const spinMatrix = multiplyMatrices(
        createRotationYMatrix(0.52 + elapsed * 0.22),
        createRotationXMatrix(-0.08)
      );

      gpu.device.queue.writeBuffer(
        frameUniformBuffer,
        0,
        createFrameUniformData(
          viewProjectionMatrix,
          skyboxViewProjectionMatrix,
          lightDirection,
          camera.eye,
          settings
        )
      );
      gpu.device.queue.writeBuffer(
        presentUniformBuffer,
        0,
        createPresentUniformData(settings)
      );

      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-56-command-encoder",
      });

      const scenePass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: targets.colorView,
            clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: targets.depthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      scenePass.setPipeline(skyboxPipeline);
      scenePass.setBindGroup(0, frameBindGroup);
      scenePass.setBindGroup(1, environmentBindGroup);
      scenePass.setVertexBuffer(0, skyboxVertexBuffer);
      scenePass.setIndexBuffer(skyboxIndexBuffer, "uint16");
      scenePass.drawIndexed(skyboxGeometry.indexCount);

      scenePass.setPipeline(modelPipeline);
      scenePass.setBindGroup(0, frameBindGroup);
      scenePass.setBindGroup(3, environmentBindGroup);

      renderables.forEach((renderable) => {
        const modelMatrix = multiplyMatrices(spinMatrix, renderable.baseWorldMatrix);
        gpu.device.queue.writeBuffer(
          renderable.nodeUniformBuffer,
          0,
          createNodeUniformData(modelMatrix)
        );
        scenePass.setBindGroup(1, renderable.nodeBindGroup);

        renderable.primitives.forEach((primitive) => {
          scenePass.setBindGroup(2, primitive.materialBindGroup);
          scenePass.setVertexBuffer(0, primitive.positionBuffer);
          scenePass.setVertexBuffer(1, primitive.normalBuffer);
          scenePass.setVertexBuffer(2, primitive.uvBuffer);

          if (primitive.indexBuffer && primitive.indexFormat) {
            scenePass.setIndexBuffer(primitive.indexBuffer, primitive.indexFormat);
            scenePass.drawIndexed(primitive.indexCount);
          } else {
            scenePass.draw(primitive.vertexCount);
          }
        });
      });

      scenePass.end();

      const presentPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.012, g: 0.018, b: 0.028, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      presentPass.setPipeline(presentPipeline);
      presentPass.setBindGroup(0, targets.presentBindGroup);
      presentPass.draw(3);
      presentPass.end();

      gpu.device.queue.submit([encoder.finish()]);
      animationFrameId = requestAnimationFrame(render);
    };

    const handleSunInput = () => {
      settings.sunIntensity = Number(refs.sunRange.value) / 100;
      updateHud(refs, settings);
    };
    const handleExposureInput = () => {
      settings.exposure = Number(refs.exposureRange.value) / 100;
      updateHud(refs, settings);
    };
    const setToneMapper = (toneMapper: HdrToneMapper) => {
      settings.toneMapper = toneMapper;
      updateHud(refs, settings);
    };

    refs.sunRange.addEventListener("input", handleSunInput);
    refs.exposureRange.addEventListener("input", handleExposureInput);
    refs.reinhardButton.addEventListener("click", () => {
      setToneMapper("reinhard");
    });
    refs.acesButton.addEventListener("click", () => {
      setToneMapper("aces");
    });

    animationFrameId = requestAnimationFrame(render);

    setStatus({
      title: "HDR、曝光与 Tone Mapping 已运行",
      detail:
        "场景会先渲到 `rgba16float` HDR 纹理，再由 present pass 把同一张纹理分别按“直接 clamp”和“曝光 + tone mapping”两种方式送回显示器。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      refs.sunRange.removeEventListener("input", handleSunInput);
      refs.exposureRange.removeEventListener("input", handleExposureInput);
      orbitCamera.dispose();
      destroySceneTargets(targets);
      environment?.texture.destroy();
    };
  } catch (error) {
    destroySceneTargets(targets);
    environment?.texture.destroy();
    setStatus({
      title: "HDR 课初始化失败",
      detail:
        error instanceof Error
          ? error.message
          : "初始化第 56 课时遇到了未知错误。",
      tone: "warn",
    });
    throw error;
  }
}
