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
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-83-gltf-pbr-basic/math";
import blurShaderSource from "@/lessons/lesson-117-bloom-and-hdr-post-chain/blur.wgsl?raw";
import brightShaderSource from "@/lessons/lesson-117-bloom-and-hdr-post-chain/bright.wgsl?raw";
import emissiveShaderSource from "@/lessons/lesson-117-bloom-and-hdr-post-chain/emissive.wgsl?raw";
import modelFragmentShaderSource from "@/lessons/lesson-117-bloom-and-hdr-post-chain/model.frag.wgsl?raw";
import modelVertexShaderSource from "@/lessons/lesson-117-bloom-and-hdr-post-chain/model.vert.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-117-bloom-and-hdr-post-chain/present.wgsl?raw";
import skyboxFragmentShaderSource from "@/lessons/lesson-117-bloom-and-hdr-post-chain/skybox.frag.wgsl?raw";
import skyboxVertexShaderSource from "@/lessons/lesson-117-bloom-and-hdr-post-chain/skybox.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type BloomSettings = {
  emitterIntensity: number;
  threshold: number;
  bloomStrength: number;
  exposure: number;
};

type BloomHudRefs = {
  emitterRange: HTMLInputElement;
  emitterValue: HTMLElement;
  thresholdRange: HTMLInputElement;
  thresholdValue: HTMLElement;
  bloomRange: HTMLInputElement;
  bloomValue: HTMLElement;
  exposureRange: HTMLInputElement;
  exposureValue: HTMLElement;
  brightPassCard: HTMLElement;
  blurChainCard: HTMLElement;
  compositeCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type BloomTargets = {
  sceneTexture: GPUTexture | null;
  sceneView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  bloomTextureA: GPUTexture | null;
  bloomViewA: GPUTextureView | null;
  bloomTextureB: GPUTexture | null;
  bloomViewB: GPUTextureView | null;
  extractBindGroup: GPUBindGroup | null;
  blurAHorizontalBindGroup: GPUBindGroup | null;
  blurBVerticalBindGroup: GPUBindGroup | null;
  presentBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
  bloomWidth: number;
  bloomHeight: number;
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

type BloomEmitter = {
  baseMatrix: Float32Array;
  color: Vector3;
  baseIntensity: number;
  pulse: number;
  phase: number;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  skyboxViewProjectionMatrix: Float32Array,
  lightDirection: Vector3,
  cameraPosition: Vector3,
  sunIntensity: number,
  environmentIntensity: number
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
  uniformData.set([sunIntensity, environmentIntensity, 0, 0], 40);
  return uniformData;
}

function createExtractUniformData(threshold: number): Float32Array {
  return new Float32Array([threshold, 0, 0, 0]);
}

function createBlurDirectionData(
  texelOffsetX: number,
  texelOffsetY: number
): Float32Array {
  return new Float32Array([texelOffsetX, texelOffsetY, 0, 0]);
}

function createPresentUniformData(settings: BloomSettings): Float32Array {
  return new Float32Array([
    settings.exposure,
    settings.bloomStrength,
    settings.threshold,
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

function createEmitterUniformData(
  modelMatrix: Float32Array,
  color: Vector3,
  intensity: number
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelMatrix, 0);
  uniformData.set([color[0], color[1], color[2], intensity], 16);
  return uniformData;
}

function createSkyboxViewMatrix(viewMatrix: Float32Array): Float32Array {
  const result = new Float32Array(viewMatrix);
  result[12] = 0;
  result[13] = 0;
  result[14] = 0;
  return result;
}

function composeTransform(
  translation: Vector3,
  scale: Vector3,
  rotationY = 0,
  rotationX = 0
): Float32Array {
  return multiplyMatrices(
    createTranslationMatrix(translation[0], translation[1], translation[2]),
    multiplyMatrices(
      createRotationYMatrix(rotationY),
      multiplyMatrices(
        createRotationXMatrix(rotationX),
        createScaleMatrix(scale[0], scale[1], scale[2])
      )
    )
  );
}

function destroyBloomTargets(targets: BloomTargets): void {
  targets.sceneTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.bloomTextureA?.destroy();
  targets.bloomTextureB?.destroy();
  targets.sceneTexture = null;
  targets.sceneView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.bloomTextureA = null;
  targets.bloomViewA = null;
  targets.bloomTextureB = null;
  targets.bloomViewB = null;
  targets.extractBindGroup = null;
  targets.blurAHorizontalBindGroup = null;
  targets.blurBVerticalBindGroup = null;
  targets.presentBindGroup = null;
  targets.width = 0;
  targets.height = 0;
  targets.bloomWidth = 0;
  targets.bloomHeight = 0;
}

function createCubemapFaceData(size: number, faceIndex: number): Uint8Array {
  const palettes = [
    { top: [71, 40, 62], bottom: [32, 22, 43], accent: [132, 81, 107] },
    { top: [31, 82, 111], bottom: [16, 38, 62], accent: [74, 160, 196] },
    { top: [97, 66, 42], bottom: [42, 28, 21], accent: [181, 116, 70] },
    { top: [54, 49, 110], bottom: [26, 25, 58], accent: [113, 103, 214] },
    { top: [80, 32, 51], bottom: [41, 16, 29], accent: [174, 74, 121] },
    { top: [29, 88, 84], bottom: [14, 42, 43], accent: [85, 173, 165] },
  ] as const;
  const palette = palettes[faceIndex];
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const u = x / Math.max(size - 1, 1);
      const v = y / Math.max(size - 1, 1);
      const horizonMix = Math.pow(v, 1.05);
      const stripe =
        0.5 + 0.5 * Math.sin((u * 1.8 + v * 0.55 + faceIndex * 0.37) * Math.PI * 2);
      const accentMix = Math.max(0, stripe - 0.42) * 0.22;

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

function formatScalar(value: number): string {
  return `${value.toFixed(2)}x`;
}

function currentObservation(settings: BloomSettings): string {
  if (settings.threshold >= 1.9) {
    return "当前阈值偏高，所以只有最亮的发光柱核心会进入 bright pass，右栏的 glow 会明显收紧。";
  }
  if (settings.bloomStrength >= 1.7) {
    return "右栏正在把模糊后的亮部更强地加回 HDR 场景，所以 glow 边缘会更厚、更明显。";
  }
  if (settings.emitterIntensity <= 0.95) {
    return "发光柱已经更接近阈值边缘了，这时右栏仍会发光，但 bloom 外扩会比默认轻一些。";
  }
  return "左栏只有 tone mapping，右栏会把 bright pass 经过 blur 之后重新加回 HDR 主图，所以发光柱周围会出现更柔和的扩散光晕。";
}

function updateHud(refs: BloomHudRefs, settings: BloomSettings): void {
  refs.emitterValue.textContent = formatPercent(settings.emitterIntensity);
  refs.thresholdValue.textContent = formatScalar(settings.threshold);
  refs.bloomValue.textContent = formatPercent(settings.bloomStrength);
  refs.exposureValue.textContent = formatScalar(settings.exposure);

  refs.brightPassCard.textContent =
    `当前只保留超过 ${settings.threshold.toFixed(2)}x white 的亮部进入 bright pass，低于这条线的区域不会参与 bloom。`;
  refs.blurChainCard.textContent =
    "Bloom 在 half-res `rgba16float` buffer 里先提亮，再做一轮 horizontal + vertical blur，让光晕留在亮边周围，而不是把核心整片抹宽。";
  refs.compositeCard.textContent =
    `右栏会把模糊后的 bloom 结果按 ${settings.bloomStrength.toFixed(
      2
    )}x 加回 HDR 场景，然后再统一 tone map。`;
  refs.observationCard.textContent = currentObservation(settings);

  refs.legend.innerHTML = `
    <strong>这一课的主线</strong>
    Bloom 不是在 SDR 结果上“再刷一层光”。这节课会先把场景保留在线性 HDR 纹理里，只把超过 <code>${settings.threshold.toFixed(
      2
    )}x</code> 的亮部送进 <code>bright pass</code>，
    再经过半分辨率的一轮 <code>horizontal + vertical blur</code> 扩散，最后把 bloom 结果按 <code>${settings.bloomStrength.toFixed(
      2
    )}x</code> 加回 HDR 主图，
    让它和原始场景一起进入 tone mapping。
  `;
}

export async function mountBloomAndHdrPostChainLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--hdr-bloom">
      <div class="hdr-bloom-stage">
        <div class="hdr-bloom-badges">
          <span class="hdr-bloom-badge">scene HDR → bright pass → blur → composite → tone map</span>
          <span class="hdr-bloom-badge">左栏只有 tone map，右栏才会把 bloom 加回 HDR</span>
          <span class="hdr-bloom-badge">blur 发生在 half-res <code>rgba16float</code> buffer 里</span>
        </div>

        <div class="hdr-bloom-controls">
          <label class="hdr-bloom-control">
            <span>发光柱强度</span>
            <input type="range" min="60" max="280" value="165" data-emitter-range />
            <strong data-emitter-value>165%</strong>
          </label>

          <label class="hdr-bloom-control">
            <span>Bright Threshold</span>
            <input type="range" min="70" max="240" value="168" data-threshold-range />
            <strong data-threshold-value>1.68x</strong>
          </label>

          <label class="hdr-bloom-control">
            <span>Bloom 强度</span>
            <input type="range" min="60" max="220" value="86" data-bloom-range />
            <strong data-bloom-value>86%</strong>
          </label>

          <label class="hdr-bloom-control">
            <span>曝光</span>
            <input type="range" min="40" max="140" value="68" data-exposure-range />
            <strong data-exposure-value>0.68x</strong>
          </label>
        </div>

        <div class="hdr-bloom-stage__labels">
          <article class="hdr-bloom-label">
            <p class="eyebrow">Tone Map Only</p>
            <strong>只把 HDR 压回显示器</strong>
            <span>左栏保留曝光与 tone mapping，但不会额外把亮部扩散成发光晕，所以发光柱只会停留在原始边界里。</span>
          </article>
          <article class="hdr-bloom-label hdr-bloom-label--cool">
            <p class="eyebrow">Bloom + Tone Mapping</p>
            <strong>先让亮部溢出，再统一显示映射</strong>
            <span>右栏会先提亮超过阈值的部分，再经过 blur 链扩散后加回 HDR 主图，所以高亮边缘会带出更柔和的 halo。</span>
          </article>
        </div>

        <div class="hdr-bloom-frame">
          <canvas
            class="hdr-bloom-canvas"
            aria-label="Bloom and HDR post chain lesson preview"
          ></canvas>
        </div>

        <div class="hdr-bloom-card-grid">
          <article class="hdr-bloom-card">
            <p>Bright Pass</p>
            <strong data-bright-pass-card></strong>
          </article>
          <article class="hdr-bloom-card">
            <p>Blur Chain</p>
            <strong data-blur-chain-card></strong>
          </article>
          <article class="hdr-bloom-card">
            <p>Composite</p>
            <strong data-composite-card></strong>
          </article>
          <article class="hdr-bloom-card">
            <p>当前观察</p>
            <strong data-observation-card></strong>
          </article>
        </div>

        <div class="hdr-bloom-legend" data-legend></div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>(".hdr-bloom-canvas");
  const refs: BloomHudRefs = {
    emitterRange: host.querySelector<HTMLInputElement>("[data-emitter-range]")!,
    emitterValue: host.querySelector<HTMLElement>("[data-emitter-value]")!,
    thresholdRange: host.querySelector<HTMLInputElement>("[data-threshold-range]")!,
    thresholdValue: host.querySelector<HTMLElement>("[data-threshold-value]")!,
    bloomRange: host.querySelector<HTMLInputElement>("[data-bloom-range]")!,
    bloomValue: host.querySelector<HTMLElement>("[data-bloom-value]")!,
    exposureRange: host.querySelector<HTMLInputElement>("[data-exposure-range]")!,
    exposureValue: host.querySelector<HTMLElement>("[data-exposure-value]")!,
    brightPassCard: host.querySelector<HTMLElement>("[data-bright-pass-card]")!,
    blurChainCard: host.querySelector<HTMLElement>("[data-blur-chain-card]")!,
    compositeCard: host.querySelector<HTMLElement>("[data-composite-card]")!,
    observationCard: host.querySelector<HTMLElement>("[data-observation-card]")!,
    legend: host.querySelector<HTMLElement>("[data-legend]")!,
  };

  if (!canvas) {
    throw new Error("第 57 课的预览 canvas 没有创建成功。");
  }
  if (Object.values(refs).some((value) => !value)) {
    throw new Error("第 57 课的 HUD DOM 没有创建完整。");
  }

  const settings: BloomSettings = {
    emitterIntensity: Number(refs.emitterRange.value) / 100,
    threshold: Number(refs.thresholdRange.value) / 100,
    bloomStrength: Number(refs.bloomRange.value) / 100,
    exposure: Number(refs.exposureRange.value) / 100,
  };
  updateHud(refs, settings);

  const targets: BloomTargets = {
    sceneTexture: null,
    sceneView: null,
    depthTexture: null,
    depthView: null,
    bloomTextureA: null,
    bloomViewA: null,
    bloomTextureB: null,
    bloomViewB: null,
    extractBindGroup: null,
    blurAHorizontalBindGroup: null,
    blurBVerticalBindGroup: null,
    presentBindGroup: null,
    width: 0,
    height: 0,
    bloomWidth: 0,
    bloomHeight: 0,
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
          texture: { sampleType: "float", viewDimension: "cube" },
        },
      ],
    });

    const emitterBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const modelPipeline = gpu.device.createRenderPipeline({
      label: "lesson-57-model-pipeline",
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
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    const skyboxPipeline = gpu.device.createRenderPipeline({
      label: "lesson-57-skybox-pipeline",
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
        format: "depth24plus",
        depthWriteEnabled: false,
        depthCompare: "less-equal",
      },
    });

    const emitterPipeline = gpu.device.createRenderPipeline({
      label: "lesson-57-emitter-pipeline",
      layout: gpu.device.createPipelineLayout({
        bindGroupLayouts: [frameBindGroupLayout, emitterBindGroupLayout],
      }),
      vertex: {
        module: gpu.device.createShaderModule({ code: emissiveShaderSource }),
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
        module: gpu.device.createShaderModule({ code: emissiveShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: "rgba16float" }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: true,
        depthCompare: "less",
      },
    });

    const extractPipeline = gpu.device.createRenderPipeline({
      label: "lesson-57-bright-pass-pipeline",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({ code: brightShaderSource }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: brightShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: "rgba16float" }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const blurPipeline = gpu.device.createRenderPipeline({
      label: "lesson-57-bloom-blur-pipeline",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({ code: blurShaderSource }),
        entryPoint: "vsMain",
      },
      fragment: {
        module: gpu.device.createShaderModule({ code: blurShaderSource }),
        entryPoint: "fsMain",
        targets: [{ format: "rgba16float" }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-57-present-pipeline",
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
    const extractUniformBuffer = gpu.device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const horizontalBlurBuffer = gpu.device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const verticalBlurBuffer = gpu.device.createBuffer({
      size: 4 * 4,
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

      const primitives: PbrRenderablePrimitive[] = drawable.primitives.map(
        (primitive) => {
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
        }
      );

      return {
        name: drawable.name,
        primitives,
        baseWorldMatrix: drawable.baseWorldMatrix,
        nodeUniformBuffer,
        nodeBindGroup,
      };
    });

    const cubeGeometry = createCubemapLessonGeometry();
    const cubeVertexBuffer = gpu.device.createBuffer({
      size: cubeGeometry.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(cubeVertexBuffer, 0, cubeGeometry.vertexData);

    const cubeIndexBuffer = gpu.device.createBuffer({
      size: cubeGeometry.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(cubeIndexBuffer, 0, cubeGeometry.indexData);

    const emitterConfigs = [
      {
        translation: [-1.42, 0.42, -1.82] as Vector3,
        scale: [0.08, 0.96, 0.08] as Vector3,
        rotationY: 0.12,
        color: [0.42, 1.08, 1.72] as Vector3,
        intensity: 4.8,
        pulse: 1.2,
        phase: 0.2,
      },
      {
        translation: [1.34, 0.58, -1.68] as Vector3,
        scale: [0.09, 0.86, 0.09] as Vector3,
        rotationY: -0.18,
        color: [1.58, 0.52, 1.18] as Vector3,
        intensity: 4.3,
        pulse: 1.45,
        phase: 1.1,
      },
      {
        translation: [0.0, 1.08, -1.56] as Vector3,
        scale: [1.08, 0.07, 0.07] as Vector3,
        rotationY: 0.0,
        color: [1.75, 1.22, 0.54] as Vector3,
        intensity: 5.0,
        pulse: 1.0,
        phase: 2.2,
      },
      {
        translation: [-0.58, -0.32, -1.18] as Vector3,
        scale: [0.06, 0.56, 0.06] as Vector3,
        rotationY: 0.0,
        color: [0.55, 0.94, 1.82] as Vector3,
        intensity: 3.8,
        pulse: 1.6,
        phase: 3.0,
      },
    ];

    const emitters: BloomEmitter[] = emitterConfigs.map((config) => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 20 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = gpu.device.createBindGroup({
        layout: emitterBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      return {
        baseMatrix: composeTransform(
          config.translation,
          config.scale,
          config.rotationY
        ),
        color: config.color,
        baseIntensity: config.intensity,
        pulse: config.pulse,
        phase: config.phase,
        uniformBuffer,
        bindGroup,
      };
    });

    const postSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    const ensureTargets = () => {
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);
      const bloomWidth = Math.max(1, Math.floor(width / 2));
      const bloomHeight = Math.max(1, Math.floor(height / 2));

      if (
        targets.width === width &&
        targets.height === height &&
        targets.bloomWidth === bloomWidth &&
        targets.bloomHeight === bloomHeight &&
        targets.sceneView &&
        targets.depthView &&
        targets.bloomViewA &&
        targets.bloomViewB &&
        targets.extractBindGroup &&
        targets.blurAHorizontalBindGroup &&
        targets.blurBVerticalBindGroup &&
        targets.presentBindGroup
      ) {
        return;
      }

      destroyBloomTargets(targets);

      targets.sceneTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.sceneView = targets.sceneTexture.createView();

      targets.depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      targets.depthView = targets.depthTexture.createView();

      targets.bloomTextureA = gpu.device.createTexture({
        size: [bloomWidth, bloomHeight],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.bloomViewA = targets.bloomTextureA.createView();

      targets.bloomTextureB = gpu.device.createTexture({
        size: [bloomWidth, bloomHeight],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.bloomViewB = targets.bloomTextureB.createView();

      targets.extractBindGroup = gpu.device.createBindGroup({
        layout: extractPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: postSampler,
          },
          {
            binding: 1,
            resource: targets.sceneView,
          },
          {
            binding: 2,
            resource: { buffer: extractUniformBuffer },
          },
        ],
      });

      targets.blurAHorizontalBindGroup = gpu.device.createBindGroup({
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: postSampler,
          },
          {
            binding: 1,
            resource: targets.bloomViewA,
          },
          {
            binding: 2,
            resource: { buffer: horizontalBlurBuffer },
          },
        ],
      });

      targets.blurBVerticalBindGroup = gpu.device.createBindGroup({
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: postSampler,
          },
          {
            binding: 1,
            resource: targets.bloomViewB,
          },
          {
            binding: 2,
            resource: { buffer: verticalBlurBuffer },
          },
        ],
      });

      targets.presentBindGroup = gpu.device.createBindGroup({
        layout: presentPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: postSampler,
          },
          {
            binding: 1,
            resource: targets.sceneView,
          },
          {
            binding: 2,
            resource: targets.bloomViewA,
          },
          {
            binding: 3,
            resource: { buffer: presentUniformBuffer },
          },
        ],
      });

      targets.width = width;
      targets.height = height;
      targets.bloomWidth = bloomWidth;
      targets.bloomHeight = bloomHeight;
    };

    const sceneMin = helmetScene.bounds.min;
    const sceneMax = helmetScene.bounds.max;
    const extentX = sceneMax[0] - sceneMin[0];
    const extentY = sceneMax[1] - sceneMin[1];
    const extentZ = sceneMax[2] - sceneMin[2];
    const modelRadius = Math.max(extentX, extentY, extentZ) * 0.55;
    const target: Vector3 = [0, -modelRadius * 0.04, 0];
    const eye: Vector3 = [0, modelRadius * 0.32, Math.max(modelRadius * 2.65, 4)];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
      minRadius: Math.max(modelRadius * 1.4, 2.8),
      maxRadius: Math.max(modelRadius * 5.1, 8.2),
    });

    const lightDirection = normalizeVector([0.24, 0.84, 0.48]);
    const sunIntensity = 1.48;
    const environmentIntensity = 0.42;

    const render = (time: number) => {
      ensureTargets();

      if (
        !targets.sceneView ||
        !targets.depthView ||
        !targets.bloomViewA ||
        !targets.bloomViewB ||
        !targets.extractBindGroup ||
        !targets.blurAHorizontalBindGroup ||
        !targets.blurBVerticalBindGroup ||
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
        createRotationYMatrix(0.18 + elapsed * 0.18),
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
          sunIntensity,
          environmentIntensity
        )
      );
      gpu.device.queue.writeBuffer(
        extractUniformBuffer,
        0,
        createExtractUniformData(settings.threshold)
      );
      gpu.device.queue.writeBuffer(
        horizontalBlurBuffer,
        0,
        createBlurDirectionData(0.68 / targets.bloomWidth, 0)
      );
      gpu.device.queue.writeBuffer(
        verticalBlurBuffer,
        0,
        createBlurDirectionData(0, 0.68 / targets.bloomHeight)
      );
      gpu.device.queue.writeBuffer(
        presentUniformBuffer,
        0,
        createPresentUniformData(settings)
      );

      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-57-command-encoder",
      });

      const scenePass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: targets.sceneView,
            clearValue: { r: 0.012, g: 0.01, b: 0.016, a: 1 },
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
      scenePass.setVertexBuffer(0, cubeVertexBuffer);
      scenePass.setIndexBuffer(cubeIndexBuffer, "uint16");
      scenePass.drawIndexed(cubeGeometry.indexCount);

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

      scenePass.setPipeline(emitterPipeline);
      scenePass.setBindGroup(0, frameBindGroup);
      scenePass.setVertexBuffer(0, cubeVertexBuffer);
      scenePass.setIndexBuffer(cubeIndexBuffer, "uint16");

      emitters.forEach((emitter) => {
        const pulse =
          0.92 + 0.08 * Math.sin(elapsed * emitter.pulse * 2.2 + emitter.phase);
        gpu.device.queue.writeBuffer(
          emitter.uniformBuffer,
          0,
          createEmitterUniformData(
            emitter.baseMatrix,
            emitter.color,
            emitter.baseIntensity * settings.emitterIntensity * pulse
          )
        );
        scenePass.setBindGroup(1, emitter.bindGroup);
        scenePass.drawIndexed(cubeGeometry.indexCount);
      });

      scenePass.end();

      const extractPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: targets.bloomViewA,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      extractPass.setPipeline(extractPipeline);
      extractPass.setBindGroup(0, targets.extractBindGroup);
      extractPass.draw(3);
      extractPass.end();

      const blurHorizontalPassOne = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: targets.bloomViewB,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      blurHorizontalPassOne.setPipeline(blurPipeline);
      blurHorizontalPassOne.setBindGroup(0, targets.blurAHorizontalBindGroup);
      blurHorizontalPassOne.draw(3);
      blurHorizontalPassOne.end();

      const blurVerticalPassOne = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: targets.bloomViewA,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      blurVerticalPassOne.setPipeline(blurPipeline);
      blurVerticalPassOne.setBindGroup(0, targets.blurBVerticalBindGroup);
      blurVerticalPassOne.draw(3);
      blurVerticalPassOne.end();

      const presentPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.008, g: 0.008, b: 0.012, a: 1 },
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

    const handleEmitterInput = () => {
      settings.emitterIntensity = Number(refs.emitterRange.value) / 100;
      updateHud(refs, settings);
    };
    const handleThresholdInput = () => {
      settings.threshold = Number(refs.thresholdRange.value) / 100;
      updateHud(refs, settings);
    };
    const handleBloomInput = () => {
      settings.bloomStrength = Number(refs.bloomRange.value) / 100;
      updateHud(refs, settings);
    };
    const handleExposureInput = () => {
      settings.exposure = Number(refs.exposureRange.value) / 100;
      updateHud(refs, settings);
    };

    refs.emitterRange.addEventListener("input", handleEmitterInput);
    refs.thresholdRange.addEventListener("input", handleThresholdInput);
    refs.bloomRange.addEventListener("input", handleBloomInput);
    refs.exposureRange.addEventListener("input", handleExposureInput);

    animationFrameId = requestAnimationFrame(render);

    setStatus({
      title: "Bloom 与 HDR 后处理链已运行",
      detail:
        "场景会先保留在线性 HDR 纹理里，只把超过阈值的亮部送进 bright pass，再经过 half-res ping-pong blur，最后把 bloom 结果加回 HDR 主图后统一 tone map。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      refs.emitterRange.removeEventListener("input", handleEmitterInput);
      refs.thresholdRange.removeEventListener("input", handleThresholdInput);
      refs.bloomRange.removeEventListener("input", handleBloomInput);
      refs.exposureRange.removeEventListener("input", handleExposureInput);
      orbitCamera.dispose();
      destroyBloomTargets(targets);
      environment?.texture.destroy();
    };
  } catch (error) {
    destroyBloomTargets(targets);
    environment?.texture.destroy();
    setStatus({
      title: "Bloom 课初始化失败",
      detail:
        error instanceof Error
          ? error.message
          : "初始化第 57 课时遇到了未知错误。",
      tone: "warn",
    });
    throw error;
  }
}
