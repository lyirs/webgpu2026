import { createWebGpuCanvas } from "@/core/webgpu";

import directAndTransientShaderSource from "./direct-and-transient.wgsl?raw";
import textureSamplerLetShaderSource from "./texture-sampler-let.wgsl?raw";

type GpuWithLanguageFeatures = GPU & {
  wgslLanguageFeatures?: Set<string>;
};

type AdapterInfoLike = {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
};

type CompatibilityAdapterResult = {
  supported: boolean;
  detail: string;
};

const TEXTURE_SIZE = 64;
const TEXTURE_SAMPLER_LET_FEATURE = "texture_and_sampler_let";
const TRANSIENT_ATTACHMENT_USAGE =
  (GPUTextureUsage as unknown as { TRANSIENT_ATTACHMENT?: number })
    .TRANSIENT_ATTACHMENT ?? 0;

function syncUpdateViewport(host: HTMLElement, canvas: HTMLCanvasElement): void {
  const bounds = host.getBoundingClientRect();
  const cssWidth = Math.max(720, Math.min(1280, Math.floor(bounds.width - 28)));
  const cssHeight = Math.max(360, Math.round(cssWidth * 0.5));
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
}

function getLanguageFeatureSet(): Set<string> | null {
  if (!("gpu" in navigator)) {
    return null;
  }

  return (navigator.gpu as GpuWithLanguageFeatures).wgslLanguageFeatures ?? null;
}

function describeAdapter(adapter: GPUAdapter): string {
  const info = (adapter as GPUAdapter & { info?: AdapterInfoLike }).info;
  const parts = [
    info?.vendor,
    info?.architecture,
    info?.device,
    info?.description,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "adapter info unavailable";
}

async function requestCompatibilityAdapter(): Promise<CompatibilityAdapterResult> {
  if (!("gpu" in navigator)) {
    return { supported: false, detail: "navigator.gpu 不可用" };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      featureLevel: "compatibility",
    } as GPURequestAdapterOptions & { featureLevel: "compatibility" });

    if (!adapter) {
      return {
        supported: false,
        detail: "featureLevel: compatibility 没有返回 adapter",
      };
    }

    return {
      supported: true,
      detail: `compatibility adapter: ${describeAdapter(adapter)}`,
    };
  } catch (error) {
    return {
      supported: false,
      detail: `compatibility request rejected: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    };
  }
}

function createPatternTextureData(): Uint8Array {
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);

  for (let y = 0; y < TEXTURE_SIZE; y += 1) {
    for (let x = 0; x < TEXTURE_SIZE; x += 1) {
      const index = (x + y * TEXTURE_SIZE) * 4;
      const checker = ((x >> 3) + (y >> 3)) & 1;
      const stripe = Math.floor((Math.sin((x + y) * 0.22) * 0.5 + 0.5) * 255);
      data[index + 0] = checker ? 48 : 230;
      data[index + 1] = 80 + Math.floor((x / TEXTURE_SIZE) * 150);
      data[index + 2] = 110 + Math.floor((y / TEXTURE_SIZE) * 120);
      data[index + 3] = 255 - Math.floor(stripe * 0.18);
    }
  }

  return data;
}

export async function mountChrome146WebGpuUpdateLab(
  host: HTMLElement,
  setStatus: (status: { title: string; detail: string; tone: "info" | "ok" | "warn" }) => void
): Promise<() => void> {
  host.innerHTML = `
    <div class="update-lab-shell">
      <div class="update-lab-stage">
        <div class="update-lab-canvas-card">
          <canvas class="update-lab-canvas" aria-label="Chrome 146 WebGPU update lab"></canvas>
          <div class="update-lab-overlay">
            <strong>Chrome 146: compatibility + transient + WGSL let</strong>
            <span>左侧是稳定 WebGPU 路径；右侧在支持时使用 <code>texture_and_sampler_let</code> shader。</span>
          </div>
          <div class="update-lab-panel-label update-lab-panel-label--left">direct texture sample</div>
          <div class="update-lab-panel-label update-lab-panel-label--right">texture/sampler let 或 fallback</div>
        </div>
      </div>

      <div class="update-lab-sidecar">
        <div class="update-lab-badges">
          <span>Chrome 146</span>
          <span>compatibility mode</span>
          <span>transient attachment</span>
          <span>WGSL extension</span>
        </div>

        <div class="update-lab-metrics">
          <article>
            <span>compatibility adapter</span>
            <strong data-compatibility>checking...</strong>
          </article>
          <article>
            <span>transient usage</span>
            <strong data-transient>checking...</strong>
          </article>
          <article>
            <span>WGSL feature</span>
            <strong data-feature>checking...</strong>
          </article>
          <article>
            <span>右侧 shader</span>
            <strong data-mode>fallback</strong>
          </article>
        </div>

        <div class="update-lab-cards">
          <article>
            <h3>featureLevel: compatibility</h3>
            <p data-compatibility-detail>requesting adapter...</p>
          </article>
          <article>
            <h3>TRANSIENT_ATTACHMENT</h3>
            <p>第二个 color attachment 只作为 scratch target 写入，使用 <code>storeOp: "discard"</code>；支持时附加 <code>GPUTextureUsage.TRANSIENT_ATTACHMENT</code>。</p>
          </article>
          <article>
            <h3>texture_and_sampler_let</h3>
            <p>支持时 shader 里把 texture 和 sampler 赋给局部 <code>let</code>，再调用 <code>textureSample(localTexture, localSampler, uv)</code>。</p>
          </article>
        </div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>(".update-lab-canvas")!;
  const compatibilityValue = host.querySelector<HTMLElement>("[data-compatibility]")!;
  const compatibilityDetail = host.querySelector<HTMLElement>(
    "[data-compatibility-detail]"
  )!;
  const transientValue = host.querySelector<HTMLElement>("[data-transient]")!;
  const featureValue = host.querySelector<HTMLElement>("[data-feature]")!;
  const modeValue = host.querySelector<HTMLElement>("[data-mode]")!;

  syncUpdateViewport(host, canvas);
  const resizeObserver = new ResizeObserver(() => syncUpdateViewport(host, canvas));
  resizeObserver.observe(host);

  const compatibility = await requestCompatibilityAdapter();
  compatibilityValue.textContent = compatibility.supported ? "available" : "fallback";
  compatibilityDetail.textContent = compatibility.detail;

  const languageFeatures = getLanguageFeatureSet();
  const textureSamplerLetListed =
    languageFeatures?.has(TEXTURE_SAMPLER_LET_FEATURE) ?? false;
  featureValue.textContent = textureSamplerLetListed
    ? "texture_and_sampler_let listed"
    : "not exposed";

  const { device, context, format, resize } = await createWebGpuCanvas(canvas);
  const transientSupported = TRANSIENT_ATTACHMENT_USAGE !== 0;
  transientValue.textContent = transientSupported
    ? "TRANSIENT_ATTACHMENT"
    : "regular scratch target";

  const sourceTexture = device.createTexture({
    label: "update-u146-pattern-texture",
    size: [TEXTURE_SIZE, TEXTURE_SIZE],
    format: "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture: sourceTexture },
    createPatternTextureData(),
    { bytesPerRow: TEXTURE_SIZE * 4, rowsPerImage: TEXTURE_SIZE },
    [TEXTURE_SIZE, TEXTURE_SIZE]
  );

  const sampler = device.createSampler({
    label: "update-u146-pattern-sampler",
    addressModeU: "repeat",
    addressModeV: "repeat",
    magFilter: "linear",
    minFilter: "linear",
  });

  const paramsBuffer = device.createBuffer({
    label: "update-u146-params-buffer",
    size: 4 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    label: "update-u146-bind-group-layout",
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "float", viewDimension: "2d" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "filtering" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  });
  const pipelineLayout = device.createPipelineLayout({
    label: "update-u146-pipeline-layout",
    bindGroupLayouts: [bindGroupLayout],
  });

  const bindGroup = device.createBindGroup({
    label: "update-u146-bind-group",
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: sourceTexture.createView() },
      { binding: 1, resource: sampler },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });

  const directModule = device.createShaderModule({
    label: "update-u146-direct-module",
    code: directAndTransientShaderSource,
  });

  const colorTargets: GPUColorTargetState[] = [{ format }, { format }];

  const directPipeline = device.createRenderPipeline({
    label: "update-u146-direct-pipeline",
    layout: pipelineLayout,
    vertex: { module: directModule, entryPoint: "vsFullscreen" },
    fragment: {
      module: directModule,
      entryPoint: "fsDirect",
      targets: colorTargets,
    },
    primitive: { topology: "triangle-list" },
  });

  const fallbackPipeline = device.createRenderPipeline({
    label: "update-u146-fallback-pipeline",
    layout: pipelineLayout,
    vertex: { module: directModule, entryPoint: "vsFullscreen" },
    fragment: {
      module: directModule,
      entryPoint: "fsFallbackRight",
      targets: colorTargets,
    },
    primitive: { topology: "triangle-list" },
  });

  let letPipeline: GPURenderPipeline | null = null;
  if (textureSamplerLetListed) {
    device.pushErrorScope("validation");
    try {
      const letModule = device.createShaderModule({
        label: "update-u146-texture-sampler-let-module",
        code: textureSamplerLetShaderSource,
      });
      letPipeline = device.createRenderPipeline({
        label: "update-u146-texture-sampler-let-pipeline",
        layout: pipelineLayout,
        vertex: { module: letModule, entryPoint: "vsFullscreen" },
        fragment: {
          module: letModule,
          entryPoint: "fsTextureSamplerLet",
          targets: colorTargets,
        },
        primitive: { topology: "triangle-list" },
      });
    } catch {
      letPipeline = null;
    }

    const validationError = await device.popErrorScope();
    if (validationError) {
      letPipeline = null;
      modeValue.textContent = "fallback: compile rejected";
    } else {
      modeValue.textContent = "texture/sampler let";
    }
  } else {
    modeValue.textContent = "fallback: direct sample";
  }

  let scratchTexture: GPUTexture | null = null;
  let scratchWidth = 0;
  let scratchHeight = 0;

  const ensureScratchTexture = () => {
    const width = canvas.width;
    const height = canvas.height;
    if (scratchTexture && scratchWidth === width && scratchHeight === height) {
      return scratchTexture;
    }

    scratchTexture?.destroy();
    scratchWidth = width;
    scratchHeight = height;
    scratchTexture = device.createTexture({
      label: transientSupported
        ? "update-u146-transient-scratch-target"
        : "update-u146-regular-scratch-target",
      size: [width, height],
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | TRANSIENT_ATTACHMENT_USAGE,
    });
    return scratchTexture;
  };

  let animationFrame = 0;
  let disposed = false;
  const params = new Float32Array([
    0,
    letPipeline === null ? 0 : 1,
    transientSupported ? 1 : 0,
    compatibility.supported ? 1 : 0,
  ]);

  const render = (time: number) => {
    if (disposed) {
      return;
    }

    resize();
    params[0] = time * 0.001;
    device.queue.writeBuffer(paramsBuffer, 0, params);

    const scratch = ensureScratchTexture();
    const encoder = device.createCommandEncoder({
      label: "update-u146-command-encoder",
    });
    const pass = encoder.beginRenderPass({
      label: "update-u146-render-pass",
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 0.008, g: 0.014, b: 0.025, a: 1 },
        },
        {
          view: scratch.createView(),
          loadOp: "clear",
          storeOp: "discard",
          clearValue: { r: 0.03, g: 0.08, b: 0.14, a: 1 },
        },
      ],
    });

    pass.setBindGroup(0, bindGroup);
    pass.setPipeline(directPipeline);
    pass.draw(3);
    pass.setPipeline(letPipeline ?? fallbackPipeline);
    pass.draw(3);
    pass.end();

    device.queue.submit([encoder.finish()]);
    animationFrame = window.requestAnimationFrame(render);
  };

  setStatus({
    title: "Chrome 146 WebGPU update",
    detail: letPipeline
      ? "正在使用 texture_and_sampler_let shader，并写入 transient scratch attachment。"
      : "当前环境使用 direct-sample fallback，同时展示 compatibility / transient 检测结果。",
    tone: letPipeline ? "ok" : "info",
  });

  animationFrame = window.requestAnimationFrame(render);

  return () => {
    disposed = true;
    if (animationFrame !== 0) {
      window.cancelAnimationFrame(animationFrame);
    }
    resizeObserver.disconnect();
    scratchTexture?.destroy();
    sourceTexture.destroy();
    paramsBuffer.destroy();
  };
}
