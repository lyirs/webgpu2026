import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createSsaoLessonGeometry } from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/math";
import blurShaderSource from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/blur.wgsl?raw";
import presentShaderSource from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/present.wgsl?raw";
import sceneFragmentShaderSource from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/scene.frag.wgsl?raw";
import sceneVertexShaderSource from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/scene.vert.wgsl?raw";
import ssaoShaderSource from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/ssao.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type SsaoSettings = {
  radius: number;
  bias: number;
  intensity: number;
  blurMix: number;
};

type SsaoHudRefs = {
  radiusRange: HTMLInputElement;
  radiusValue: HTMLElement;
  biasRange: HTMLInputElement;
  biasValue: HTMLElement;
  intensityRange: HTMLInputElement;
  intensityValue: HTMLElement;
  blurRange: HTMLInputElement;
  blurValue: HTMLElement;
  kernelCard: HTMLElement;
  biasCard: HTMLElement;
  blurCard: HTMLElement;
  observationCard: HTMLElement;
  legend: HTMLElement;
};

type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  rotationY: number;
  scale: Vector3;
  color: [number, number, number, number];
};

type SsaoRenderObject = {
  config: SceneObjectConfig;
  modelMatrix: Float32Array;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type SsaoTargets = {
  albedoTexture: GPUTexture | null;
  albedoView: GPUTextureView | null;
  normalTexture: GPUTexture | null;
  normalView: GPUTextureView | null;
  viewPositionTexture: GPUTexture | null;
  viewPositionView: GPUTextureView | null;
  depthTexture: GPUTexture | null;
  depthView: GPUTextureView | null;
  rawAoTexture: GPUTexture | null;
  rawAoView: GPUTextureView | null;
  blurredAoTexture: GPUTexture | null;
  blurredAoView: GPUTextureView | null;
  ssaoBindGroup: GPUBindGroup | null;
  blurBindGroup: GPUBindGroup | null;
  presentBindGroup: GPUBindGroup | null;
  width: number;
  height: number;
};

function formatScalar(value: number): string {
  return `${value.toFixed(2)}x`;
}

function formatBias(value: number): string {
  return `${value.toFixed(3)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * 把对象的 MVP、model-view 和基色打包成一份 uniform 数据。
 * @param {Float32Array} modelViewProjectionMatrix 当前对象的 MVP。
 * @param {Float32Array} modelViewMatrix 当前对象的 model-view 矩阵。
 * @param {[number, number, number, number]} color 当前对象的基色。
 * @returns {Float32Array} 适合直接写进 uniform buffer 的连续 float 数据。
 */
function createObjectUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelViewMatrix: Float32Array,
  color: [number, number, number, number]
): Float32Array {
  const uniformData = new Float32Array(36);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelViewMatrix, 16);
  uniformData.set(color, 32);
  return uniformData;
}

/**
 * 把 SSAO 所需的投影矩阵、采样半径和偏移值打包成一份 uniform 数据。
 * @param {Float32Array} projectionMatrix 当前相机投影矩阵。
 * @param {number} radius SSAO 采样半径。
 * @param {number} bias SSAO 遮蔽偏移。
 * @returns {Float32Array} 可直接写入 uniform buffer 的 SSAO 参数。
 */
function createSsaoUniformData(
  projectionMatrix: Float32Array,
  radius: number,
  bias: number
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(projectionMatrix, 0);
  uniformData.set([radius, bias, 0, 0], 16);
  return uniformData;
}

/**
 * 创建一份 blur pass 的 texel size uniform 数据。
 * @param {number} texelOffsetX x 方向单像素步进。
 * @param {number} texelOffsetY y 方向单像素步进。
 * @returns {Float32Array} 对应的 blur uniform 数据。
 */
function createSsaoBlurUniformData(
  texelOffsetX: number,
  texelOffsetY: number
): Float32Array {
  return new Float32Array([texelOffsetX, texelOffsetY, 0, 0]);
}

/**
 * 打包最终合成 pass 的光照方向、环境光和 lesson 控制参数。
 * @param {Vector3} lightDirectionView 视空间里的主光方向。
 * @param {number} intensity AO 暗化强度。
 * @param {number} blurMix raw AO 与 blurred AO 的混合系数。
 * @returns {Float32Array} 对应的 present uniform 数据。
 */
function createSsaoPresentUniformData(
  lightDirectionView: Vector3,
  intensity: number,
  blurMix: number
): Float32Array {
  const uniformData = new Float32Array(12);
  uniformData.set(
    [lightDirectionView[0], lightDirectionView[1], lightDirectionView[2], 0],
    0
  );
  uniformData.set([0.44, 0.46, 0.52, 0], 4);
  uniformData.set([intensity, blurMix, 0, 0], 8);
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
 * 把世界空间方向向量变换到当前相机视空间。
 * @param {Float32Array} viewMatrix 当前视图矩阵。
 * @param {Vector3} direction 世界空间里的方向。
 * @returns {Vector3} 视空间里的单位方向。
 */
function transformDirectionToView(
  viewMatrix: Float32Array,
  direction: Vector3
): Vector3 {
  return normalizeVector([
    viewMatrix[0] * direction[0] +
      viewMatrix[4] * direction[1] +
      viewMatrix[8] * direction[2],
    viewMatrix[1] * direction[0] +
      viewMatrix[5] * direction[1] +
      viewMatrix[9] * direction[2],
    viewMatrix[2] * direction[0] +
      viewMatrix[6] * direction[1] +
      viewMatrix[10] * direction[2],
  ]);
}

/**
 * 释放当前 lesson 使用的全部 G-buffer / AO 纹理。
 * @param {SsaoTargets} targets 当前 lesson 管理的离屏目标。
 * @returns {void} 只负责销毁纹理并清空引用。
 */
function destroySsaoTargets(targets: SsaoTargets): void {
  targets.albedoTexture?.destroy();
  targets.normalTexture?.destroy();
  targets.viewPositionTexture?.destroy();
  targets.depthTexture?.destroy();
  targets.rawAoTexture?.destroy();
  targets.blurredAoTexture?.destroy();
  targets.albedoTexture = null;
  targets.albedoView = null;
  targets.normalTexture = null;
  targets.normalView = null;
  targets.viewPositionTexture = null;
  targets.viewPositionView = null;
  targets.depthTexture = null;
  targets.depthView = null;
  targets.rawAoTexture = null;
  targets.rawAoView = null;
  targets.blurredAoTexture = null;
  targets.blurredAoView = null;
  targets.ssaoBindGroup = null;
  targets.blurBindGroup = null;
  targets.presentBindGroup = null;
  targets.width = 0;
  targets.height = 0;
}

/**
 * 根据当前设置生成更贴近 lesson 状态的观察说明。
 * @param {SsaoSettings} settings 当前 lesson 控制参数。
 * @returns {string} 对应的观察结论文本。
 */
function currentObservation(settings: SsaoSettings): string {
  if (settings.blurMix < 0.25) {
    return "右栏现在更接近 raw SSAO，接触处会先变暗，但也更容易把屏幕采样噪声直接暴露出来。";
  }

  if (settings.radius > 0.86) {
    return "当前半径已经偏大，遮蔽会从“接触阴影”往更宽的环境暗化扩散；这能强化缝隙，但也更容易让角落显得过黑。";
  }

  if (settings.bias < 0.028) {
    return "当前偏移比较小，SSAO 更容易把自己的表面也算进遮蔽里，所以轮廓附近可能会开始出现自遮蔽感。";
  }

  if (settings.intensity > 1.55) {
    return "当前暗化强度偏高，右栏会更强调“贴地、贴墙、贴角”的接触阴影，但如果继续拉高就会像统一压了一层脏色。";
  }

  return "这版设置更接近“接触阴影补足”：右栏主要在箱体落地、靠墙和缝隙交界处长出更可信的暗化，同时 blur 会把 raw SSAO 的颗粒感收掉。";
}

/**
 * 根据当前设置刷新课内 HUD 与解释文案。
 * @param {SsaoHudRefs} refs 当前 lesson HUD 的 DOM 引用。
 * @param {SsaoSettings} settings 当前 lesson 控制参数。
 * @returns {void} 只更新界面文字，不返回额外结果。
 */
function updateHud(refs: SsaoHudRefs, settings: SsaoSettings): void {
  refs.radiusValue.textContent = formatScalar(settings.radius);
  refs.biasValue.textContent = formatBias(settings.bias);
  refs.intensityValue.textContent = formatScalar(settings.intensity);
  refs.blurValue.textContent = formatPercent(settings.blurMix);

  refs.kernelCard.textContent =
    `当前会在每个像素周围按 ${settings.radius.toFixed(
      2
    )}x 半径探测一圈局部样本；半径越大，暗化会越宽，但也越容易从接触阴影变成整片环境压暗。`;
  refs.biasCard.textContent =
    `偏移值现在是 ${settings.bias.toFixed(
      3
    )}，它决定 sample kernel 离开表面的第一步有多远；太小会自遮蔽，太大又会把真实接触阴影漏掉。`;
  refs.blurCard.textContent =
    `右栏会把 raw AO 和 edge-aware blur 后的 AO 按 ${Math.round(
      settings.blurMix * 100
    )}% 混合，所以 blur 既要收掉颗粒感，也不能跨过深度边缘把物体边界抹脏。`;
  refs.observationCard.textContent = currentObservation(settings);

  refs.legend.innerHTML = `
    <strong>这一课的主线</strong>
    SSAO 不是一个“把画面变黑”的滤镜，而是：先从 <code>G-buffer</code> 里拿到当前像素的法线和视空间位置，
    再围绕表面法线打出一圈 <code>sample kernel</code>，
    估计附近几何有没有挡住环境光。raw occlusion 往往会带颗粒感，所以右栏还会把它送进一层
    <code>edge-aware blur</code>，只在深度和法线相近的邻域内做平滑。
  `;
}

/**
 * 挂载第 58 课“SSAO 与屏幕空间环境光遮蔽”。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于同步 lesson 当前状态。
 * @returns {Promise<(() => void) | void>} 返回清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源。
 */
export async function mountSsaoAndScreenSpaceOcclusionLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--ssao">
      <div class="ssao-stage">
        <div class="ssao-badges">
          <span class="ssao-badge">G-buffer → raw occlusion → edge-aware blur → composite</span>
          <span class="ssao-badge">left：ambient only · right：ambient × SSAO</span>
          <span class="ssao-badge">screen-space：只看当前屏幕的法线和位置</span>
        </div>

        <div class="ssao-controls">
          <label class="ssao-control">
            <span>采样半径</span>
            <input type="range" min="22" max="110" value="62" data-radius-range />
            <strong data-radius-value>0.62x</strong>
          </label>

          <label class="ssao-control">
            <span>遮蔽偏移</span>
            <input type="range" min="12" max="70" value="36" data-bias-range />
            <strong data-bias-value>0.036</strong>
          </label>

          <label class="ssao-control">
            <span>AO 强度</span>
            <input type="range" min="60" max="180" value="128" data-intensity-range />
            <strong data-intensity-value>1.28x</strong>
          </label>

          <label class="ssao-control">
            <span>Blur 混合</span>
            <input type="range" min="0" max="100" value="84" data-blur-range />
            <strong data-blur-value>84%</strong>
          </label>
        </div>

        <div class="ssao-stage__labels">
          <div class="ssao-label">
            <span class="eyebrow">without SSAO</span>
            <strong>只看基础环境光</strong>
          </div>
          <div class="ssao-label ssao-label--cool">
            <span class="eyebrow">with SSAO</span>
            <strong>接触阴影由 screen-space 长出来</strong>
          </div>
        </div>

        <div class="ssao-frame">
          <canvas class="ssao-canvas" aria-label="SSAO lesson preview"></canvas>
        </div>

        <div class="ssao-card-grid">
          <article class="ssao-card">
            <span class="eyebrow">sample kernel</span>
            <strong>采样半径</strong>
            <p data-kernel-card></p>
          </article>
          <article class="ssao-card">
            <span class="eyebrow">occlusion bias</span>
            <strong>遮蔽偏移</strong>
            <p data-bias-card></p>
          </article>
          <article class="ssao-card">
            <span class="eyebrow">edge-aware blur</span>
            <strong>降噪与保边</strong>
            <p data-blur-card></p>
          </article>
          <article class="ssao-card">
            <span class="eyebrow">当前实验</span>
            <strong>现在该观察哪里</strong>
            <p data-observation-card></p>
          </article>
        </div>

        <div class="ssao-legend" data-legend></div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>(".ssao-canvas");
  const radiusRange = host.querySelector<HTMLInputElement>("[data-radius-range]");
  const radiusValue = host.querySelector<HTMLElement>("[data-radius-value]");
  const biasRange = host.querySelector<HTMLInputElement>("[data-bias-range]");
  const biasValue = host.querySelector<HTMLElement>("[data-bias-value]");
  const intensityRange = host.querySelector<HTMLInputElement>(
    "[data-intensity-range]"
  );
  const intensityValue = host.querySelector<HTMLElement>(
    "[data-intensity-value]"
  );
  const blurRange = host.querySelector<HTMLInputElement>("[data-blur-range]");
  const blurValue = host.querySelector<HTMLElement>("[data-blur-value]");
  const kernelCard = host.querySelector<HTMLElement>("[data-kernel-card]");
  const biasCard = host.querySelector<HTMLElement>("[data-bias-card]");
  const blurCard = host.querySelector<HTMLElement>("[data-blur-card]");
  const observationCard = host.querySelector<HTMLElement>(
    "[data-observation-card]"
  );
  const legend = host.querySelector<HTMLElement>("[data-legend]");

  if (
    !canvas ||
    !radiusRange ||
    !radiusValue ||
    !biasRange ||
    !biasValue ||
    !intensityRange ||
    !intensityValue ||
    !blurRange ||
    !blurValue ||
    !kernelCard ||
    !biasCard ||
    !blurCard ||
    !observationCard ||
    !legend
  ) {
    throw new Error("SSAO 课的 DOM 没有创建完整。");
  }

  const refs: SsaoHudRefs = {
    radiusRange,
    radiusValue,
    biasRange,
    biasValue,
    intensityRange,
    intensityValue,
    blurRange,
    blurValue,
    kernelCard,
    biasCard,
    blurCard,
    observationCard,
    legend,
  };

  const settings: SsaoSettings = {
    radius: Number(radiusRange.value) / 100,
    bias: Number(biasRange.value) / 1000,
    intensity: Number(intensityRange.value) / 100,
    blurMix: Number(blurRange.value) / 100,
  };

  updateHud(refs, settings);

  const targets: SsaoTargets = {
    albedoTexture: null,
    albedoView: null,
    normalTexture: null,
    normalView: null,
    viewPositionTexture: null,
    viewPositionView: null,
    depthTexture: null,
    depthView: null,
    rawAoTexture: null,
    rawAoView: null,
    blurredAoTexture: null,
    blurredAoView: null,
    ssaoBindGroup: null,
    blurBindGroup: null,
    presentBindGroup: null,
    width: 0,
    height: 0,
  };

  let animationFrameId = 0;
  let cleanupOrbit: (() => void) | null = null;

  try {
    const gpu = await createWebGpuCanvas(canvas);

    const geometry = createSsaoLessonGeometry();

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
    const ssaoShaderModule = gpu.device.createShaderModule({
      code: ssaoShaderSource,
    });
    const blurShaderModule = gpu.device.createShaderModule({
      code: blurShaderSource,
    });
    const presentShaderModule = gpu.device.createShaderModule({
      code: presentShaderSource,
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

    const scenePipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [objectBindGroupLayout],
    });

    const scenePipeline = gpu.device.createRenderPipeline({
      label: "lesson-58-scene-pipeline",
      layout: scenePipelineLayout,
      vertex: {
        module: sceneVertexShaderModule,
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
              {
                shaderLocation: 1,
                offset: 3 * 4,
                format: "float32x3",
              },
            ],
          },
        ],
      },
      fragment: {
        module: sceneFragmentShaderModule,
        entryPoint: "fsMain",
        targets: [
          { format: "rgba16float" },
          { format: "rgba16float" },
          { format: "rgba16float" },
        ],
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

    const ssaoUniformBuffer = gpu.device.createBuffer({
      size: 20 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const blurUniformBuffer = gpu.device.createBuffer({
      size: 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const presentUniformBuffer = gpu.device.createBuffer({
      size: 12 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const postSampler = gpu.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      mipmapFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    });

    const ssaoPipeline = gpu.device.createRenderPipeline({
      label: "lesson-58-ssao-pipeline",
      layout: "auto",
      vertex: {
        module: ssaoShaderModule,
        entryPoint: "vsMain",
      },
      fragment: {
        module: ssaoShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: "rgba16float" }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const blurPipeline = gpu.device.createRenderPipeline({
      label: "lesson-58-ssao-blur-pipeline",
      layout: "auto",
      vertex: {
        module: blurShaderModule,
        entryPoint: "vsMain",
      },
      fragment: {
        module: blurShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: "rgba16float" }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const presentPipeline = gpu.device.createRenderPipeline({
      label: "lesson-58-present-pipeline",
      layout: "auto",
      vertex: {
        module: presentShaderModule,
        entryPoint: "vsMain",
      },
      fragment: {
        module: presentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const objectConfigs: SceneObjectConfig[] = [
      {
        label: "floor",
        translation: [0, -1.22, 0],
        rotationY: 0,
        scale: [4.6, 0.12, 4.6],
        color: [0.24, 0.26, 0.31, 1],
      },
      {
        label: "back-wall",
        translation: [0, 1.08, -3.18],
        rotationY: 0,
        scale: [4.6, 2.9, 0.12],
        color: [0.31, 0.18, 0.22, 1],
      },
      {
        label: "left-wall",
        translation: [-3.14, 0.64, -0.24],
        rotationY: 0,
        scale: [0.12, 1.84, 2.54],
        color: [0.12, 0.19, 0.24, 1],
      },
      {
        label: "center-box",
        translation: [0.26, -0.53, -1.34],
        rotationY: 0.56,
        scale: [0.72, 0.72, 0.72],
        color: [0.84, 0.48, 0.31, 1],
      },
      {
        label: "right-pillar",
        translation: [1.82, -0.14, -0.98],
        rotationY: 0.14,
        scale: [0.46, 1.16, 0.46],
        color: [0.7, 0.64, 0.82, 1],
      },
      {
        label: "left-box",
        translation: [-1.38, -0.78, 0.38],
        rotationY: -0.34,
        scale: [0.56, 0.52, 0.56],
        color: [0.37, 0.72, 0.95, 1],
      },
      {
        label: "small-cube",
        translation: [0.92, -0.96, 0.96],
        rotationY: 0.0,
        scale: [0.3, 0.18, 0.3],
        color: [0.94, 0.84, 0.6, 1],
      },
    ];

    const renderObjects: SsaoRenderObject[] = objectConfigs.map((config) => {
      const modelMatrix = createModelMatrix(config);
      const uniformBuffer = gpu.device.createBuffer({
        size: 36 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = gpu.device.createBindGroup({
        layout: objectBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      return {
        config,
        modelMatrix,
        uniformBuffer,
        bindGroup,
      };
    });

    const ensureTargets = () => {
      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);

      if (
        targets.width === width &&
        targets.height === height &&
        targets.albedoView &&
        targets.normalView &&
        targets.viewPositionView &&
        targets.depthView &&
        targets.rawAoView &&
        targets.blurredAoView &&
        targets.ssaoBindGroup &&
        targets.blurBindGroup &&
        targets.presentBindGroup
      ) {
        return;
      }

      destroySsaoTargets(targets);

      targets.albedoTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.albedoView = targets.albedoTexture.createView();

      targets.normalTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.normalView = targets.normalTexture.createView();

      targets.viewPositionTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.viewPositionView = targets.viewPositionTexture.createView();

      targets.depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      targets.depthView = targets.depthTexture.createView();

      targets.rawAoTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.rawAoView = targets.rawAoTexture.createView();

      targets.blurredAoTexture = gpu.device.createTexture({
        size: [width, height],
        format: "rgba16float",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      targets.blurredAoView = targets.blurredAoTexture.createView();

      targets.ssaoBindGroup = gpu.device.createBindGroup({
        layout: ssaoPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: postSampler,
          },
          {
            binding: 1,
            resource: targets.normalView,
          },
          {
            binding: 2,
            resource: targets.viewPositionView,
          },
          {
            binding: 3,
            resource: { buffer: ssaoUniformBuffer },
          },
        ],
      });

      targets.blurBindGroup = gpu.device.createBindGroup({
        layout: blurPipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: postSampler,
          },
          {
            binding: 1,
            resource: targets.rawAoView,
          },
          {
            binding: 2,
            resource: targets.normalView,
          },
          {
            binding: 3,
            resource: targets.viewPositionView,
          },
          {
            binding: 4,
            resource: { buffer: blurUniformBuffer },
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
            resource: targets.albedoView,
          },
          {
            binding: 2,
            resource: targets.normalView,
          },
          {
            binding: 3,
            resource: targets.viewPositionView,
          },
          {
            binding: 4,
            resource: targets.rawAoView,
          },
          {
            binding: 5,
            resource: targets.blurredAoView,
          },
          {
            binding: 6,
            resource: { buffer: presentUniformBuffer },
          },
        ],
      });

      targets.width = width;
      targets.height = height;
    };

    const orbitCamera = createOrbitCameraController(canvas, {
      target: [0, -0.32, -0.78],
      eye: [3.35, 1.94, 5.18],
      minRadius: 3.8,
      maxRadius: 9.6,
    });
    cleanupOrbit = orbitCamera.dispose;

    const lightDirectionWorld = normalizeVector([0.38, 0.84, 0.34]);

    const syncSettingsFromUi = () => {
      settings.radius = Number(radiusRange.value) / 100;
      settings.bias = Number(biasRange.value) / 1000;
      settings.intensity = Number(intensityRange.value) / 100;
      settings.blurMix = Number(blurRange.value) / 100;
      updateHud(refs, settings);
    };

    const handleRangeInput = () => {
      syncSettingsFromUi();
    };

    radiusRange.addEventListener("input", handleRangeInput);
    biasRange.addEventListener("input", handleRangeInput);
    intensityRange.addEventListener("input", handleRangeInput);
    blurRange.addEventListener("input", handleRangeInput);

    syncSettingsFromUi();

    setStatus({
      title: "SSAO 与屏幕空间环境光遮蔽已运行",
      detail:
        "左栏只看基础环境光，右栏会先估计 screen-space occlusion，再做一层 edge-aware blur，让接触处和缝隙先长出更可信的暗化。",
      tone: "ok",
    });

    const render = () => {
      gpu.resize();
      ensureTargets();

      if (
        !targets.albedoView ||
        !targets.normalView ||
        !targets.viewPositionView ||
        !targets.depthView ||
        !targets.rawAoView ||
        !targets.blurredAoView ||
        !targets.ssaoBindGroup ||
        !targets.blurBindGroup ||
        !targets.presentBindGroup
      ) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(
        camera.eye,
        camera.target,
        camera.up
      );
      const projectionMatrix = createPerspectiveMatrix(
        (48 * Math.PI) / 180,
        canvas.width / canvas.height,
        0.1,
        40
      );
      const lightDirectionView = transformDirectionToView(
        viewMatrix,
        lightDirectionWorld
      );

      gpu.device.queue.writeBuffer(
        ssaoUniformBuffer,
        0,
        createSsaoUniformData(projectionMatrix, settings.radius, settings.bias)
      );
      gpu.device.queue.writeBuffer(
        blurUniformBuffer,
        0,
        createSsaoBlurUniformData(1 / targets.width, 1 / targets.height)
      );
      gpu.device.queue.writeBuffer(
        presentUniformBuffer,
        0,
        createSsaoPresentUniformData(
          lightDirectionView,
          settings.intensity,
          settings.blurMix
        )
      );

      renderObjects.forEach((object) => {
        const modelViewMatrix = multiplyMatrices(viewMatrix, object.modelMatrix);
        const modelViewProjectionMatrix = multiplyMatrices(
          projectionMatrix,
          modelViewMatrix
        );

        gpu.device.queue.writeBuffer(
          object.uniformBuffer,
          0,
          createObjectUniformData(
            modelViewProjectionMatrix,
            modelViewMatrix,
            object.config.color
          )
        );
      });

      const encoder = gpu.device.createCommandEncoder({
        label: "lesson-58-command-encoder",
      });

      const scenePass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: targets.albedoView,
            clearValue: { r: 0.06, g: 0.05, b: 0.08, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
          {
            view: targets.normalView,
            clearValue: { r: 0.5, g: 0.5, b: 1, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
          {
            view: targets.viewPositionView,
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
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
      scenePass.setPipeline(scenePipeline);
      scenePass.setVertexBuffer(0, vertexBuffer);
      scenePass.setIndexBuffer(indexBuffer, "uint16");

      renderObjects.forEach((object) => {
        scenePass.setBindGroup(0, object.bindGroup);
        scenePass.drawIndexed(geometry.indexCount);
      });

      scenePass.end();

      const ssaoPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: targets.rawAoView,
            clearValue: { r: 1, g: 1, b: 1, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      ssaoPass.setPipeline(ssaoPipeline);
      ssaoPass.setBindGroup(0, targets.ssaoBindGroup);
      ssaoPass.draw(3);
      ssaoPass.end();

      const blurPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: targets.blurredAoView,
            clearValue: { r: 1, g: 1, b: 1, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });
      blurPass.setPipeline(blurPipeline);
      blurPass.setBindGroup(0, targets.blurBindGroup);
      blurPass.draw(3);
      blurPass.end();

      const presentPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.02, g: 0.025, b: 0.04, a: 1 },
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

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      radiusRange.removeEventListener("input", handleRangeInput);
      biasRange.removeEventListener("input", handleRangeInput);
      intensityRange.removeEventListener("input", handleRangeInput);
      blurRange.removeEventListener("input", handleRangeInput);
      cleanupOrbit?.();
      destroySsaoTargets(targets);
      renderObjects.forEach((object) => object.uniformBuffer.destroy());
      vertexBuffer.destroy();
      indexBuffer.destroy();
      ssaoUniformBuffer.destroy();
      blurUniformBuffer.destroy();
      presentUniformBuffer.destroy();
    };
  } catch (error) {
    console.error(error);
    setStatus({
      title: "SSAO lesson 启动失败",
      detail:
        error instanceof Error
          ? error.message
          : "未知错误阻止了 SSAO lesson 初始化。",
      tone: "warn",
    });
    throw error;
  }
}
