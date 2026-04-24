import { createWebGpuCanvas } from "@/core/webgpu";
import fragmentShaderSource from "@/lessons/lesson-22-alpha-and-blending-basics/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-22-alpha-and-blending-basics/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type AlphaBlendPanelMode = "straight" | "premultiplied" | "mismatch";

type AlphaBlendPanelRect = {
  mode: AlphaBlendPanelMode;
  x: number;
  y: number;
  width: number;
  height: number;
};

type AlphaBlendMetrics = {
  alpha: number;
  edgeSoftness: number;
};

type AlphaBlendHudRefs = {
  alphaRange: HTMLInputElement;
  alphaValue: HTMLElement;
  softnessRange: HTMLInputElement;
  softnessValue: HTMLElement;
  sourceAlphaValue: HTMLElement;
  straightColorValue: HTMLElement;
  premulColorValue: HTMLElement;
  alphaEquationValue: HTMLElement;
  legend: HTMLElement;
};

type SpriteConfig = {
  center: [number, number];
  scale: [number, number];
  rotation: number;
  color: [number, number, number, number];
};

type SpriteRenderObject = {
  mode: AlphaBlendPanelMode;
  config: SpriteConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

const PANEL_MODES: AlphaBlendPanelMode[] = [
  "straight",
  "premultiplied",
  "mismatch",
];

const SPRITE_CONFIGS: SpriteConfig[] = [
  {
    center: [-0.2, 0.08],
    scale: [0.74, 0.52],
    rotation: -0.52,
    color: [1.0, 0.58, 0.22, 0.88],
  },
  {
    center: [0.18, -0.06],
    scale: [0.68, 0.48],
    rotation: 0.36,
    color: [0.12, 0.78, 1.0, 0.82],
  },
];

/**
 * 为当前 draw 打包一份 sprite uniform。
 * @param {SpriteConfig} config 当前要绘制的软边面片配置。
 * @param {AlphaBlendMetrics} metrics 当前 lesson 的 alpha 与软边控制值。
 * @returns {Float32Array} 依次写入位移、尺寸、颜色、旋转和软边参数的 uniform 数据。
 */
function createSpriteUniformData(
  config: SpriteConfig,
  metrics: AlphaBlendMetrics
): Float32Array {
  return new Float32Array([
    config.center[0],
    config.center[1],
    config.scale[0],
    config.scale[1],
    config.color[0],
    config.color[1],
    config.color[2],
    config.color[3] * metrics.alpha,
    config.rotation,
    metrics.edgeSoftness,
    0,
    0,
  ]);
}

/**
 * 把当前画布分成三个并排 panel，分别用于 straight、premultiplied 和错误示例。
 * @param {number} width 当前 WebGPU 画布的像素宽度。
 * @param {number} height 当前 WebGPU 画布的像素高度。
 * @returns {AlphaBlendPanelRect[]} 三个 viewport/scissor 面板的布局结果。
 */
function createPanelRects(
  width: number,
  height: number
): AlphaBlendPanelRect[] {
  const inset = Math.max(12, Math.floor(Math.min(width, height) * 0.022));
  const gap = Math.max(12, Math.floor(Math.min(width, height) * 0.02));
  const panelWidth = Math.max(
    32,
    Math.floor((width - inset * 2 - gap * 2) / PANEL_MODES.length)
  );
  const panelHeight = Math.max(32, height - inset * 2);

  return PANEL_MODES.map((mode, index) => ({
    mode,
    x: inset + index * (panelWidth + gap),
    y: inset,
    width: panelWidth,
    height: panelHeight,
  }));
}

/**
 * 同步第 22 课的外置 HUD 文案。
 * @param {AlphaBlendHudRefs} refs 当前 lesson 用到的 DOM 引用集合。
 * @param {AlphaBlendMetrics} metrics 当前 alpha 与软边参数。
 * @returns {void} 只更新界面文本，不返回额外结果。
 */
function updateHud(refs: AlphaBlendHudRefs, metrics: AlphaBlendMetrics): void {
  const alphaPercent = Math.round(metrics.alpha * 100);
  const dstPercent = Math.max(0, 100 - alphaPercent);

  refs.alphaValue.textContent = `${alphaPercent}%`;
  refs.softnessValue.textContent = metrics.edgeSoftness.toFixed(2);
  refs.sourceAlphaValue.textContent = `${alphaPercent}%`;
  refs.straightColorValue.textContent =
    `src.rgb × ${alphaPercent}% · dst.rgb × ${dstPercent}%`;
  refs.premulColorValue.textContent =
    `src.rgb(pre) × 100% · dst.rgb × ${dstPercent}%`;
  refs.alphaEquationValue.textContent = `src.a + dst.a × ${dstPercent}%`;
  refs.legend.textContent =
    `当前实验：左栏输出 straight alpha，blend 用 src-alpha / one-minus-src-alpha；` +
    `中栏输出 premultiplied alpha，blend 改成 one / one-minus-src-alpha。` +
    `它们在正确配对时会几乎一样；右栏故意把 straight 数据送进 premultiplied blend，所以软边会发亮。`;
}

/**
 * 挂载第 22 课“颜色混合与 Alpha 表示”预览。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听与 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountAlphaAndBlendingBasicsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--alpha-blend-basics">
      <div class="alpha-blend-basics-stage">
        <div class="alpha-blend-basics-badges">
          <span class="alpha-blend-basics-badge">blend · src / dst 系数各自可控</span>
          <span class="alpha-blend-basics-badge">straight alpha · RGB 不预乘</span>
          <span class="alpha-blend-basics-badge">premultiplied alpha · RGB 先乘 alpha</span>
        </div>

        <div class="alpha-blend-basics-controls">
          <label class="alpha-blend-basics-control">
            <span>源 alpha</span>
            <input type="range" min="20" max="95" value="58" data-alpha-range />
            <strong data-alpha-value>58%</strong>
          </label>
          <label class="alpha-blend-basics-control">
            <span>软边宽度</span>
            <input type="range" min="8" max="70" value="28" data-softness-range />
            <strong data-softness-value>0.28</strong>
          </label>
        </div>

        <div class="alpha-blend-basics-stage__labels">
          <article class="alpha-blend-basics-label">
            <p class="eyebrow">Straight Alpha</p>
            <strong>RGB 保持原色</strong>
            <span>color 用 <code>src-alpha</code>，alpha 仍可单独累加。</span>
          </article>
          <article class="alpha-blend-basics-label alpha-blend-basics-label--cool">
            <p class="eyebrow">Premultiplied Alpha</p>
            <strong>RGB 先乘 alpha</strong>
            <span>color 直接用 <code>one</code>，页面合成链路更常见。</span>
          </article>
          <article class="alpha-blend-basics-label alpha-blend-basics-label--warn">
            <p class="eyebrow">Mismatch</p>
            <strong>数据和 blend 没对上</strong>
            <span>这才是亮边 / 暗边伪影真正出现的位置。</span>
          </article>
        </div>

        <div class="alpha-blend-basics-frame">
          <canvas
            class="alpha-blend-basics-canvas"
            aria-label="Alpha and blending basics lesson preview"
          ></canvas>
        </div>

        <div class="alpha-blend-basics-card-grid">
          <article class="alpha-blend-basics-card">
            <p>源 alpha</p>
            <strong data-source-alpha>58%</strong>
          </article>
          <article class="alpha-blend-basics-card">
            <p>Straight RGB</p>
            <strong data-straight-color>src.rgb × 58% · dst.rgb × 42%</strong>
          </article>
          <article class="alpha-blend-basics-card">
            <p>Premul RGB</p>
            <strong data-premul-color>src.rgb(pre) × 100% · dst.rgb × 42%</strong>
          </article>
          <article class="alpha-blend-basics-card">
            <p>Alpha 通道</p>
            <strong data-alpha-equation>src.a + dst.a × 42%</strong>
          </article>
        </div>

        <div class="alpha-blend-basics-legend" data-legend></div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>(".alpha-blend-basics-canvas");
  const refs: AlphaBlendHudRefs = {
    alphaRange: host.querySelector<HTMLInputElement>("[data-alpha-range]")!,
    alphaValue: host.querySelector<HTMLElement>("[data-alpha-value]")!,
    softnessRange: host.querySelector<HTMLInputElement>("[data-softness-range]")!,
    softnessValue: host.querySelector<HTMLElement>("[data-softness-value]")!,
    sourceAlphaValue: host.querySelector<HTMLElement>("[data-source-alpha]")!,
    straightColorValue: host.querySelector<HTMLElement>("[data-straight-color]")!,
    premulColorValue: host.querySelector<HTMLElement>("[data-premul-color]")!,
    alphaEquationValue: host.querySelector<HTMLElement>("[data-alpha-equation]")!,
    legend: host.querySelector<HTMLElement>("[data-legend]")!,
  };

  if (!canvas) {
    throw new Error("第 22 课的预览 canvas 没有创建成功。");
  }
  if (Object.values(refs).some((value) => !value)) {
    throw new Error("第 22 课的 HUD DOM 没有创建完整。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const metrics: AlphaBlendMetrics = {
      alpha: Number(refs.alphaRange.value) / 100,
      edgeSoftness: Number(refs.softnessRange.value) / 100,
    };

    const vertexData = new Float32Array([
      -1, -1, 0, 1,
      1, -1, 1, 1,
      1, 1, 1, 0,
      -1, -1, 0, 1,
      1, 1, 1, 0,
      -1, 1, 0, 0,
    ]);

    const vertexBuffer = gpu.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const vertexShaderModule = gpu.device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });

    const vertexBuffers: GPUVertexBufferLayout[] = [
      {
        arrayStride: 4 * 4,
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: "float32x2",
          },
          {
            shaderLocation: 1,
            offset: 2 * 4,
            format: "float32x2",
          },
        ],
      },
    ];

    const backgroundPipeline = gpu.device.createRenderPipeline({
      label: "lesson-22-alpha-background",
      layout: "auto",
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsBackdrop",
        buffers: vertexBuffers,
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "fsBackdrop",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });

    const spriteBindGroupLayout = gpu.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const spritePipelineLayout = gpu.device.createPipelineLayout({
      bindGroupLayouts: [spriteBindGroupLayout],
    });

    const baseSpritePipeline: Omit<GPURenderPipelineDescriptor, "fragment" | "label"> = {
      layout: spritePipelineLayout,
      vertex: {
        module: vertexShaderModule,
        entryPoint: "vsSprite",
        buffers: vertexBuffers,
      },
      primitive: {
        topology: "triangle-list",
      },
    };

    const straightPipeline = gpu.device.createRenderPipeline({
      label: "lesson-22-alpha-straight",
      ...baseSpritePipeline,
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "fsStraight",
        targets: [
          {
            format: gpu.format,
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
    });

    const premultipliedPipeline = gpu.device.createRenderPipeline({
      label: "lesson-22-alpha-premultiplied",
      ...baseSpritePipeline,
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "fsPremultiplied",
        targets: [
          {
            format: gpu.format,
            blend: {
              color: {
                srcFactor: "one",
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
    });

    const mismatchPipeline = gpu.device.createRenderPipeline({
      label: "lesson-22-alpha-mismatch",
      ...baseSpritePipeline,
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "fsStraight",
        targets: [
          {
            format: gpu.format,
            blend: {
              color: {
                srcFactor: "one",
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
    });

    const createSpriteRenderObject = (
      mode: AlphaBlendPanelMode,
      config: SpriteConfig
    ): SpriteRenderObject => {
      const uniformBuffer = gpu.device.createBuffer({
        size: 12 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const bindGroup = gpu.device.createBindGroup({
        layout: spriteBindGroupLayout,
        entries: [
          {
            binding: 0,
            resource: { buffer: uniformBuffer },
          },
        ],
      });

      return {
        mode,
        config,
        uniformBuffer,
        bindGroup,
      };
    };

    const spriteObjects = PANEL_MODES.flatMap((mode) =>
      SPRITE_CONFIGS.map((config) => createSpriteRenderObject(mode, config))
    );

    const render = () => {
      gpu.resize();
      metrics.alpha = Number(refs.alphaRange.value) / 100;
      metrics.edgeSoftness = Number(refs.softnessRange.value) / 100;
      updateHud(refs, metrics);

      spriteObjects.forEach((object) => {
        gpu.device.queue.writeBuffer(
          object.uniformBuffer,
          0,
          createSpriteUniformData(object.config, metrics)
        );
      });

      const panelRects = createPanelRects(canvas.width, canvas.height);
      const commandEncoder = gpu.device.createCommandEncoder({
        label: "lesson-22-command-encoder",
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.029, g: 0.043, b: 0.08, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      pass.setVertexBuffer(0, vertexBuffer);

      panelRects.forEach((rect) => {
        const pipeline =
          rect.mode === "straight"
            ? straightPipeline
            : rect.mode === "premultiplied"
              ? premultipliedPipeline
              : mismatchPipeline;

        pass.setViewport(rect.x, rect.y, rect.width, rect.height, 0, 1);
        pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);

        pass.setPipeline(backgroundPipeline);
        pass.draw(6);

        pass.setPipeline(pipeline);
        spriteObjects
          .filter((object) => object.mode === rect.mode)
          .forEach((object) => {
            pass.setBindGroup(0, object.bindGroup);
            pass.draw(6);
          });
      });

      pass.end();
      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    const resizeObserver = new ResizeObserver(() => {
      render();
    });
    resizeObserver.observe(host);

    const handleAlphaInput = () => {
      render();
    };
    const handleSoftnessInput = () => {
      render();
    };

    refs.alphaRange.addEventListener("input", handleAlphaInput);
    refs.softnessRange.addEventListener("input", handleSoftnessInput);

    render();

    setStatus({
      title: "颜色混合与 Alpha 表示已运行",
      detail:
        "左边是 straight alpha，右边中栏是 premultiplied alpha；两者配对正确时几乎一样，右栏则故意演示“数据表示和 blend 规则不匹配”带来的软边伪影。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      refs.alphaRange.removeEventListener("input", handleAlphaInput);
      refs.softnessRange.removeEventListener("input", handleSoftnessInput);
      vertexBuffer.destroy();
      spriteObjects.forEach((object) => object.uniformBuffer.destroy());
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

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
