import { createBlendingBoxGeometry } from "@/lessons/lesson-70-blending-and-transparency/geometry";
import {
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-70-blending-and-transparency/math";
import fragmentShaderSource from "@/lessons/lesson-70-blending-and-transparency/scene.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-70-blending-and-transparency/scene.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type SceneObjectConfig = {
  label: string;
  translation: Vector3;
  rotationY: number;
  scale: Vector3;
  color: [number, number, number, number];
  transparent: boolean;
  wobblePhase?: number;
};

type RenderObject = {
  config: SceneObjectConfig;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  modelMatrix: Float32Array;
  center: Vector3;
};

type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

type SurfaceMode = "fixed" | "sorted" | "page";

type CanvasSurface = {
  mode: SurfaceMode;
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  alphaMode: GPUCanvasAlphaMode;
  clearValue: GPUColor;
  drawOpaque: boolean;
  depthTarget: DepthTarget;
  opaqueObjects: RenderObject[];
  transparentObjects: RenderObject[];
};

type TransparencyHudRefs = {
  fixedOrder: HTMLElement;
  sortedOrder: HTMLElement;
  pageMode: HTMLElement;
  observation: HTMLElement;
  legend: HTMLElement;
};

const FIXED_ORDER_LABEL = "青 -> 橙 -> 紫";

/**
 * 把当前对象的 MVP、模型矩阵、颜色和主光方向打包成一份 uniform 数据。
 * @param {Float32Array} modelViewProjectionMatrix 当前对象的 MVP 矩阵。
 * @param {Float32Array} modelMatrix 当前对象的模型矩阵。
 * @param {[number, number, number, number]} color 当前对象的 RGBA 颜色。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 可以直接写进 uniform buffer 的连续 float 数据。
 */
function createObjectUniformData(
  modelViewProjectionMatrix: Float32Array,
  modelMatrix: Float32Array,
  color: [number, number, number, number],
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(40);
  uniformData.set(modelViewProjectionMatrix, 0);
  uniformData.set(modelMatrix, 16);
  uniformData.set(color, 32);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    36
  );
  return uniformData;
}

/**
 * 用平移、旋转和缩放组合一份对象的模型矩阵。
 * @param {Vector3} translation 当前对象的世界空间平移。
 * @param {number} rotationY 当前对象绕 Y 轴的旋转角。
 * @param {Vector3} scale 当前对象的缩放。
 * @returns {Float32Array} 对应的 4x4 模型矩阵。
 */
function createModelMatrix(
  translation: Vector3,
  rotationY: number,
  scale: Vector3
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
 * 计算相机到对象中心点的平方距离，用来做透明对象的后画排序。
 * @param {Vector3} eye 当前相机位置。
 * @param {Vector3} center 当前透明对象的中心点。
 * @returns {number} 相机到对象中心的平方距离。
 */
function distanceSquared(eye: Vector3, center: Vector3): number {
  const dx = eye[0] - center[0];
  const dy = eye[1] - center[1];
  const dz = eye[2] - center[2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * 把一个点绕世界 Y 轴旋转，方便让透明板围着中心慢慢转，从而暴露排序问题。
 * @param {Vector3} point 当前点的原始位置。
 * @param {number} angle 当前绕 Y 轴的旋转角。
 * @returns {Vector3} 旋转后的世界空间位置。
 */
function rotatePointY(point: Vector3, angle: number): Vector3 {
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  return [
    point[0] * cosAngle + point[2] * sinAngle,
    point[1],
    -point[0] * sinAngle + point[2] * cosAngle,
  ];
}

/**
 * 安全释放深度纹理。
 * @param {DepthTarget} target 当前 surface 用到的深度目标信息。
 * @returns {void} 只负责销毁纹理并清空引用，不返回额外结果。
 */
function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
}

/**
 * 初始化一块 surface 的 GPUCanvasContext。
 * @param {HTMLCanvasElement} canvas 当前要绑定的画布。
 * @returns {GPUCanvasContext} 当前画布对应的 WebGPU context。
 */
function createCanvasContext(canvas: HTMLCanvasElement): GPUCanvasContext {
  const context = canvas.getContext("webgpu");
  if (!context) {
    throw new Error("没有拿到 WebGPUCanvasContext。");
  }
  return context;
}

/**
 * 创建一个对象实例，并给它单独分配 uniform buffer。
 * @param {GPUDevice} device 当前 lesson 共用的 GPUDevice。
 * @param {GPUBindGroupLayout} bindGroupLayout 对象 uniform 对应的 bind group layout。
 * @param {SceneObjectConfig} config 当前对象的静态配置。
 * @returns {RenderObject} 后续可直接参与 draw 的运行时对象。
 */
function createRenderObject(
  device: GPUDevice,
  bindGroupLayout: GPUBindGroupLayout,
  config: SceneObjectConfig
): RenderObject {
  const uniformBuffer = device.createBuffer({
    size: 40 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  return {
    config,
    uniformBuffer,
    bindGroup,
    modelMatrix: createModelMatrix(config.translation, config.rotationY, config.scale),
    center: [...config.translation],
  };
}

/**
 * 同步第 23 课的 HUD 文案。
 * @param {TransparencyHudRefs} refs 当前 lesson 用到的 DOM 引用集合。
 * @param {RenderObject[]} sortedObjects 当前帧真正的远到近排序结果。
 * @returns {void} 只更新文案，不返回额外结果。
 */
function updateHud(
  refs: TransparencyHudRefs,
  sortedObjects: RenderObject[]
): void {
  const sortedOrder = sortedObjects.map((object) => object.config.label).join(" -> ");
  const differs = sortedOrder !== FIXED_ORDER_LABEL;

  refs.fixedOrder.textContent = FIXED_ORDER_LABEL;
  refs.sortedOrder.textContent = sortedOrder;
  refs.pageMode.textContent = "alphaMode premultiplied · clear a = 0";
  refs.observation.textContent = differs
    ? "这一刻左栏仍按固定顺序提交，交叠区已经开始和中栏分叉。"
    : "这一刻固定顺序刚好接近正确，但场景继续转动后它会再次偏掉。";
  refs.legend.textContent =
    "当前实验：左栏故意把透明板按作者写死的顺序提交；中栏每帧都会按相机到对象中心的距离，" +
    "从更远到更近重新排序。下栏则把 clear alpha 设成 0，并把 canvas 配成 transparent output，" +
    "所以页面底纹会穿过空白像素，说明透明不只发生在物体之间，也会继续流入最终页面合成。";
}

/**
 * 按当前时间更新对象姿态，并把 uniform 写到当前 surface 的对象缓冲里。
 * @param {CanvasSurface} surface 当前要更新的画布 surface。
 * @param {GPUDevice} device 当前 lesson 共用的 GPUDevice。
 * @param {Float32Array} viewProjectionMatrix 当前 surface 的 VP 矩阵。
 * @param {Vector3} lightDirection 当前场景的主光方向。
 * @param {number} timeSeconds 当前动画时间。
 * @returns {void} 只更新模型矩阵、中心点和 uniform，不返回额外结果。
 */
function updateSurfaceObjects(
  surface: CanvasSurface,
  device: GPUDevice,
  viewProjectionMatrix: Float32Array,
  lightDirection: Vector3,
  timeSeconds: number
): void {
  const groupRotation = 0.95 + timeSeconds * 0.42;

  const updateObject = (object: RenderObject) => {
    let translation = object.config.translation;
    let rotationY = object.config.rotationY;

    if (object.config.transparent) {
      const rotated = rotatePointY(object.config.translation, groupRotation);
      const wobble = Math.sin(timeSeconds * 1.45 + (object.config.wobblePhase ?? 0));
      translation = [rotated[0], rotated[1] + wobble * 0.12, rotated[2]];
      rotationY += groupRotation;
    }

    object.center = translation;
    object.modelMatrix = createModelMatrix(translation, rotationY, object.config.scale);

    const modelViewProjectionMatrix = multiplyMatrices(
      viewProjectionMatrix,
      object.modelMatrix
    );
    const uniformData = createObjectUniformData(
      modelViewProjectionMatrix,
      object.modelMatrix,
      object.config.color,
      lightDirection
    );
    device.queue.writeBuffer(object.uniformBuffer, 0, uniformData);
  };

  surface.opaqueObjects.forEach(updateObject);
  surface.transparentObjects.forEach(updateObject);
}

/**
 * 确保当前 surface 的像素尺寸、context 配置和深度纹理处于最新状态。
 * @param {CanvasSurface} surface 当前要同步的画布 surface。
 * @param {GPUDevice} device lesson 共用的 GPUDevice。
 * @param {GPUTextureFormat} format 当前浏览器推荐的画布颜色格式。
 * @returns {GPUTextureView | null} 当前 surface 可用的深度纹理视图；如果画布还没有有效尺寸，则返回空。
 */
function ensureSurfaceReady(
  surface: CanvasSurface,
  device: GPUDevice,
  format: GPUTextureFormat
): GPUTextureView | null {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(surface.canvas.clientWidth * pixelRatio));
  const height = Math.max(1, Math.floor(surface.canvas.clientHeight * pixelRatio));

  if (width === 0 || height === 0) {
    return null;
  }

  if (surface.canvas.width !== width || surface.canvas.height !== height) {
    surface.canvas.width = width;
    surface.canvas.height = height;
  }

  if (
    surface.depthTarget.width !== width ||
    surface.depthTarget.height !== height ||
    !surface.depthTarget.view
  ) {
    destroyDepthTarget(surface.depthTarget);
    surface.depthTarget.width = width;
    surface.depthTarget.height = height;
    surface.depthTarget.texture = device.createTexture({
      size: [width, height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    surface.depthTarget.view = surface.depthTarget.texture.createView();
  }

  surface.context.configure({
    device,
    format,
    alphaMode: surface.alphaMode,
  });

  return surface.depthTarget.view;
}

/**
 * 挂载第 23 课“透明排序与透明画布”预览。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放动画帧与 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountBlendingAndTransparencyLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport preview-viewport--blending-transparency">
      <div class="transparency-stage">
        <div class="transparency-badges">
          <span class="transparency-badge">22 课已经讲完 blend 和 alpha 表示</span>
          <span class="transparency-badge">这一课只看透明提交顺序</span>
          <span class="transparency-badge">transparent canvas 继续把 alpha 交给页面</span>
        </div>

        <div class="transparency-grid">
          <article class="transparency-panel">
            <header class="transparency-panel__header">
              <div>
                <p class="eyebrow">Fixed Order</p>
                <strong>不排序直接提交</strong>
                <span>三块透明板始终按作者写死的顺序绘制。</span>
              </div>
              <span class="transparency-chip transparency-chip--warn">容易翻车</span>
            </header>
            <div class="transparency-canvas-shell">
              <canvas
                class="transparency-canvas"
                data-canvas="fixed"
                aria-label="Fixed transparent order preview"
              ></canvas>
            </div>
          </article>

          <article class="transparency-panel">
            <header class="transparency-panel__header">
              <div>
                <p class="eyebrow">Sorted</p>
                <strong>每帧按距离重排</strong>
                <span>透明板从更远到更近提交，交叠关系会稳定得多。</span>
              </div>
              <span class="transparency-chip transparency-chip--cool">back to front</span>
            </header>
            <div class="transparency-canvas-shell">
              <canvas
                class="transparency-canvas"
                data-canvas="sorted"
                aria-label="Sorted transparent order preview"
              ></canvas>
            </div>
          </article>

          <article class="transparency-panel transparency-panel--page">
            <header class="transparency-panel__header">
              <div>
                <p class="eyebrow">Transparent Canvas</p>
                <strong>最终输出也带 alpha</strong>
                <span>这块 canvas 不清背景，页面底纹会直接穿过空白像素。</span>
              </div>
              <span class="transparency-chip">clear a = 0</span>
            </header>
            <div class="transparency-canvas-shell transparency-canvas-shell--page">
              <canvas
                class="transparency-canvas transparency-canvas--page"
                data-canvas="page"
                aria-label="Transparent canvas preview"
              ></canvas>
            </div>
          </article>
        </div>

        <div class="transparency-card-grid">
          <article class="transparency-card">
            <p>固定顺序</p>
            <strong data-fixed-order>青 -> 橙 -> 紫</strong>
          </article>
          <article class="transparency-card">
            <p>当前排序</p>
            <strong data-sorted-order>紫 -> 青 -> 橙</strong>
          </article>
          <article class="transparency-card">
            <p>页面输出</p>
            <strong data-page-mode>alphaMode premultiplied · clear a = 0</strong>
          </article>
          <article class="transparency-card">
            <p>当前观察</p>
            <strong data-observation>左栏会比中栏更早出现交叠错误。</strong>
          </article>
        </div>

        <div class="transparency-legend" data-legend></div>
      </div>
    </div>
  `;

  const fixedCanvas = host.querySelector<HTMLCanvasElement>('[data-canvas="fixed"]');
  const sortedCanvas = host.querySelector<HTMLCanvasElement>('[data-canvas="sorted"]');
  const pageCanvas = host.querySelector<HTMLCanvasElement>('[data-canvas="page"]');
  const refs: TransparencyHudRefs = {
    fixedOrder: host.querySelector<HTMLElement>("[data-fixed-order]")!,
    sortedOrder: host.querySelector<HTMLElement>("[data-sorted-order]")!,
    pageMode: host.querySelector<HTMLElement>("[data-page-mode]")!,
    observation: host.querySelector<HTMLElement>("[data-observation]")!,
    legend: host.querySelector<HTMLElement>("[data-legend]")!,
  };

  if (!fixedCanvas || !sortedCanvas || !pageCanvas) {
    throw new Error("第 23 课的预览画布没有创建完整。");
  }
  if (Object.values(refs).some((value) => !value)) {
    throw new Error("第 23 课的 HUD DOM 没有创建完整。");
  }

  const opaqueObjects = [
    {
      label: "floor",
      translation: [0, -0.18, 0],
      rotationY: 0,
      scale: [6.8, 0.18, 6.8],
      color: [0.1, 0.17, 0.28, 1],
      transparent: false,
    },
    {
      label: "pillar",
      translation: [0, 1.06, 0],
      rotationY: 0.2,
      scale: [0.88, 2.05, 0.88],
      color: [0.92, 0.9, 0.82, 1],
      transparent: false,
    },
  ] satisfies SceneObjectConfig[];

  const transparentObjects = [
    {
      label: "青",
      translation: [-1.45, 1.08, -0.42],
      rotationY: 0.58,
      scale: [1.26, 2.3, 0.08],
      color: [0.16, 0.76, 1.0, 0.42],
      transparent: true,
      wobblePhase: 0,
    },
    {
      label: "橙",
      translation: [1.35, 0.92, 0.28],
      rotationY: -0.82,
      scale: [1.44, 1.88, 0.08],
      color: [1.0, 0.5, 0.34, 0.42],
      transparent: true,
      wobblePhase: 1.4,
    },
    {
      label: "紫",
      translation: [0.12, 1.38, 1.28],
      rotationY: 1.16,
      scale: [1.1, 2.68, 0.08],
      color: [0.82, 0.44, 1.0, 0.34],
      transparent: true,
      wobblePhase: 2.8,
    },
  ] satisfies SceneObjectConfig[];

  try {
    if (!("gpu" in navigator)) {
      throw new Error("当前浏览器没有提供 WebGPU。");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("没有拿到可用的 GPUAdapter。");
    }

    const device = await adapter.requestDevice();
    const format = navigator.gpu.getPreferredCanvasFormat();

    const vertexShaderModule = device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = device.createShaderModule({
      code: fragmentShaderSource,
    });

    const geometry = createBlendingBoxGeometry();
    const vertexBuffer = device.createBuffer({
      size: geometry.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, geometry.vertexData);

    const indexBuffer = device.createBuffer({
      size: geometry.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, geometry.indexData);

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" },
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    });

    const baseVertexState: GPUVertexState = {
      module: vertexShaderModule,
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
    };

    const opaquePipeline = device.createRenderPipeline({
      label: "lesson-23-opaque",
      layout: pipelineLayout,
      vertex: baseVertexState,
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format }],
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

    const transparentPipeline = device.createRenderPipeline({
      label: "lesson-23-transparent",
      layout: pipelineLayout,
      vertex: baseVertexState,
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "fsMain",
        targets: [
          {
            format,
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

    const createSurface = (
      mode: SurfaceMode,
      canvas: HTMLCanvasElement,
      alphaMode: GPUCanvasAlphaMode,
      clearValue: GPUColor,
      drawOpaque: boolean
    ): CanvasSurface => ({
      mode,
      canvas,
      context: createCanvasContext(canvas),
      alphaMode,
      clearValue,
      drawOpaque,
      depthTarget: {
        texture: null,
        view: null,
        width: 0,
        height: 0,
      },
      opaqueObjects: opaqueObjects.map((config) =>
        createRenderObject(device, bindGroupLayout, config)
      ),
      transparentObjects: transparentObjects.map((config) =>
        createRenderObject(device, bindGroupLayout, config)
      ),
    });

    const surfaces: CanvasSurface[] = [
      createSurface(
        "fixed",
        fixedCanvas,
        "opaque",
        { r: 0.039, g: 0.066, b: 0.128, a: 1 },
        true
      ),
      createSurface(
        "sorted",
        sortedCanvas,
        "opaque",
        { r: 0.039, g: 0.066, b: 0.128, a: 1 },
        true
      ),
      createSurface(
        "page",
        pageCanvas,
        "premultiplied",
        { r: 0, g: 0, b: 0, a: 0 },
        false
      ),
    ];

    const cameraEye: Vector3 = [5.6, 3.6, 6.4];
    const cameraTarget: Vector3 = [0, 0.9, 0];
    const cameraUp: Vector3 = [0, 1, 0];
    const lightDirection = normalizeVector([0.42, 0.92, 0.38]);
    const startTime = performance.now();
    let animationFrameId = 0;

    const renderSurface = (surface: CanvasSurface, timeSeconds: number) => {
      const depthView = ensureSurfaceReady(surface, device, format);
      if (!depthView) {
        return;
      }

      const aspect = surface.canvas.width / surface.canvas.height;
      const viewMatrix = createLookAtViewMatrix(cameraEye, cameraTarget, cameraUp);
      const projectionMatrix = createPerspectiveMatrix(
        (55 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);

      updateSurfaceObjects(
        surface,
        device,
        viewProjectionMatrix,
        lightDirection,
        timeSeconds
      );

      const sortedTransparentObjects = [...surface.transparentObjects].sort(
        (left, right) =>
          distanceSquared(cameraEye, right.center) -
          distanceSquared(cameraEye, left.center)
      );

      if (surface.mode === "sorted") {
        updateHud(refs, sortedTransparentObjects);
      }

      const drawTransparentObjects =
        surface.mode === "fixed"
          ? surface.transparentObjects
          : sortedTransparentObjects;

      const commandEncoder = device.createCommandEncoder({
        label: `lesson-23-${surface.mode}-encoder`,
      });
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: surface.context.getCurrentTexture().createView(),
            clearValue: surface.clearValue,
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

      pass.setVertexBuffer(0, vertexBuffer);
      pass.setIndexBuffer(indexBuffer, "uint16");

      if (surface.drawOpaque) {
        pass.setPipeline(opaquePipeline);
        surface.opaqueObjects.forEach((object) => {
          pass.setBindGroup(0, object.bindGroup);
          pass.drawIndexed(geometry.indexCount);
        });
      }

      pass.setPipeline(transparentPipeline);
      drawTransparentObjects.forEach((object) => {
        pass.setBindGroup(0, object.bindGroup);
        pass.drawIndexed(geometry.indexCount);
      });

      pass.end();
      device.queue.submit([commandEncoder.finish()]);
    };

    const frame = (timestamp: number) => {
      const timeSeconds = (timestamp - startTime) * 0.001;
      surfaces.forEach((surface) => renderSurface(surface, timeSeconds));
      animationFrameId = requestAnimationFrame(frame);
    };

    animationFrameId = requestAnimationFrame(frame);

    setStatus({
      title: "透明排序与透明画布已运行",
      detail:
        "左栏故意保留固定提交顺序，中栏每帧按距离做 back-to-front 排序，下栏则把 canvas 本身配成透明输出，让页面底纹继续参与最终合成。",
      tone: "ok",
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      destroyDepthTarget(surfaces[0].depthTarget);
      destroyDepthTarget(surfaces[1].depthTarget);
      destroyDepthTarget(surfaces[2].depthTarget);
      surfaces.forEach((surface) => {
        surface.opaqueObjects.forEach((object) => object.uniformBuffer.destroy());
        surface.transparentObjects.forEach((object) =>
          object.uniformBuffer.destroy()
        );
      });
      vertexBuffer.destroy();
      indexBuffer.destroy();
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
