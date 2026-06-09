import { createWebGpuCanvas } from "@/core/webgpu";
import shaderSource from "@/lessons/lesson-98-query-result-availability-and-readback-rings/query-ring.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const ringSize = 3;
const queryResultSize = 8;
const queryResolveStride = 256;
const floatsPerVertex = 6;
const vertexCountPerQuad = 6;
const totalVertexCount = vertexCountPerQuad * 2;
const vertexBufferSize = totalVertexCount * floatsPerVertex * Float32Array.BYTES_PER_ELEMENT;
const wallBounds = { minX: -0.32, maxX: 0.32 };

type DepthTarget = {
  texture: GPUTexture;
  width: number;
  height: number;
};

function syncApiViewport(host: HTMLElement, viewport: HTMLElement) {
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
}

function writeQuad(
  target: Float32Array,
  offset: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  depth: number,
  colorA: [number, number, number],
  colorB: [number, number, number]
) {
  const vertices = [
    [minX, minY, depth, ...colorA],
    [maxX, minY, depth, ...colorA],
    [minX, maxY, depth, ...colorB],
    [minX, maxY, depth, ...colorB],
    [maxX, minY, depth, ...colorA],
    [maxX, maxY, depth, ...colorB],
  ];
  for (const vertex of vertices) {
    target.set(vertex, offset);
    offset += floatsPerVertex;
  }
  return offset;
}

function createSceneVertices(frame: number) {
  const phase = (Math.sin(frame * 0.012 - Math.PI / 2) + 1) * 0.5;
  const centerX = -0.62 + phase * 1.24;
  const targetHalfWidth = 0.13;
  const targetMinX = centerX - targetHalfWidth;
  const targetMaxX = centerX + targetHalfWidth;
  const targetFullyBehindWall = targetMinX >= wallBounds.minX && targetMaxX <= wallBounds.maxX;
  const vertices = new Float32Array(totalVertexCount * floatsPerVertex);
  let offset = 0;
  offset = writeQuad(
    vertices,
    offset,
    wallBounds.minX,
    -0.58,
    wallBounds.maxX,
    0.55,
    0.25,
    [0.09, 0.13, 0.19],
    [0.23, 0.29, 0.39]
  );
  writeQuad(vertices, offset, targetMinX, -0.2, targetMaxX, 0.2, 0.55, [0.2, 0.78, 1.0], [0.95, 0.72, 1.0]);
  return {
    vertices,
    targetFullyBehindWall,
    centerX,
  };
}

export async function mountQueryResultAvailabilityAndReadbackRingsLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="webgpu-api-shell webgpu-api-shell--query-ring">
      <div class="webgpu-api-stage">
        <div class="webgpu-api-canvas-card">
          <canvas class="webgpu-api-canvas" aria-label="Query availability readback ring preview"></canvas>
          <div class="webgpu-api-overlay webgpu-api-overlay--wide">
            <strong>query result availability is delayed</strong>
            <span>可用 ring slot 才提交 query；HUD 只消费已经 map 完成的旧结果。</span>
          </div>
        </div>
      </div>
      <div class="webgpu-api-panel">
        <div class="webgpu-api-metrics">
          <article class="webgpu-api-metric"><span>ring slot</span><strong data-slot>0</strong></article>
          <article class="webgpu-api-metric"><span>current target</span><strong data-current>moving</strong></article>
          <article class="webgpu-api-metric"><span>frame age</span><strong data-age>pending</strong></article>
          <article class="webgpu-api-metric"><span>last resolved samples</span><strong data-result>pending</strong></article>
          <article class="webgpu-api-metric"><span>delayed feedback</span><strong data-feedback>waiting</strong></article>
          <article class="webgpu-api-metric"><span>query availability</span><strong>async readback ring</strong></article>
        </div>
        <div class="webgpu-api-note">resolveQuerySet 只把 query 写进 buffer；CPU 读取必须通过 MAP_READ ring 延迟消费，不能同步控制当前 pass。</div>
      </div>
    </div>
  `;

  const canvas = host.querySelector<HTMLCanvasElement>("canvas");
  const stage = host.querySelector<HTMLElement>(".webgpu-api-stage");
  const slotLabel = host.querySelector<HTMLElement>("[data-slot]");
  const currentLabel = host.querySelector<HTMLElement>("[data-current]");
  const ageLabel = host.querySelector<HTMLElement>("[data-age]");
  const resultLabel = host.querySelector<HTMLElement>("[data-result]");
  const feedbackLabel = host.querySelector<HTMLElement>("[data-feedback]");
  if (!canvas || !stage || !slotLabel || !currentLabel || !ageLabel || !resultLabel || !feedbackLabel) {
    throw new Error("Query readback ring lesson DOM 初始化失败。");
  }

  try {
    const gpu = await createWebGpuCanvas(canvas);
    const module = gpu.device.createShaderModule({ label: "lesson-98-query-ring-shader", code: shaderSource });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-98-query-ring-pipeline",
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vsMain",
        buffers: [
          {
            arrayStride: floatsPerVertex * Float32Array.BYTES_PER_ELEMENT,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x3" },
              { shaderLocation: 1, offset: 3 * Float32Array.BYTES_PER_ELEMENT, format: "float32x3" },
            ],
          },
        ],
      },
      fragment: { module, entryPoint: "fsMain", targets: [{ format: gpu.format }] },
      depthStencil: {
        format: "depth24plus",
        depthCompare: "less",
        depthWriteEnabled: true,
      },
    });
    const vertexBuffer = gpu.device.createBuffer({
      label: "lesson-98-query-scene-vertices",
      size: vertexBufferSize,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    const querySet = gpu.device.createQuerySet({ label: "lesson-98-occlusion-query-ring", type: "occlusion", count: ringSize });
    const resolveBuffer = gpu.device.createBuffer({
      label: "lesson-98-query-resolve-buffer",
      size: ringSize * queryResolveStride,
      usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    });
    const readbackBuffers = Array.from({ length: ringSize }, (_, index) =>
      gpu.device.createBuffer({
        label: `lesson-98-readback-ring-${index}`,
        size: queryResultSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      })
    );
    const pending = new Array<boolean>(ringSize).fill(false);
    const destroyRequested = new Array<boolean>(ringSize).fill(false);
    const destroyed = new Array<boolean>(ringSize).fill(false);
    const submittedFrame = new Array<number>(ringSize).fill(0);
    let depthTarget: DepthTarget | null = null;
    let frame = 0;
    let frameId = 0;
    let disposed = false;
    const destroyReadbackBuffer = (slot: number) => {
      destroyRequested[slot] = true;
      if (!pending[slot] && !destroyed[slot]) {
        readbackBuffers[slot].destroy();
        destroyed[slot] = true;
      }
    };
    const ensureDepthTarget = () => {
      if (depthTarget && depthTarget.width === canvas.width && depthTarget.height === canvas.height) {
        return depthTarget.texture.createView();
      }
      depthTarget?.texture.destroy();
      depthTarget = {
        texture: gpu.device.createTexture({
          label: "lesson-98-query-depth-target",
          size: [Math.max(1, canvas.width), Math.max(1, canvas.height)],
          format: "depth24plus",
          usage: GPUTextureUsage.RENDER_ATTACHMENT,
        }),
        width: canvas.width,
        height: canvas.height,
      };
      return depthTarget.texture.createView();
    };

    const consumeSlot = async (slot: number, submittedAt: number) => {
      let mapped = false;
      try {
        await readbackBuffers[slot].mapAsync(GPUMapMode.READ);
        mapped = true;
        if (disposed) {
          readbackBuffers[slot].unmap();
          mapped = false;
          return;
        }
        const value = new BigUint64Array(readbackBuffers[slot].getMappedRange().slice(0))[0] ?? 0n;
        readbackBuffers[slot].unmap();
        mapped = false;
        resultLabel.textContent = value.toString();
        feedbackLabel.textContent = value > 0n ? "visible (old)" : "occluded (old)";
        ageLabel.textContent = `${frame - submittedAt} frames`;
      } catch {
        // Navigating away may destroy the ring buffer while mapAsync is pending.
      } finally {
        if (mapped) {
          readbackBuffers[slot].unmap();
        }
        pending[slot] = false;
        if (destroyRequested[slot]) {
          destroyReadbackBuffer(slot);
        }
      }
    };

    const render = () => {
      if (disposed) {
        return;
      }
      syncApiViewport(host, stage);
      gpu.resize();
      const slot = frame % ringSize;
      const scene = createSceneVertices(frame);
      gpu.device.queue.writeBuffer(vertexBuffer, 0, scene.vertices);
      slotLabel.textContent = String(slot);
      currentLabel.textContent = scene.targetFullyBehindWall ? "occluded now" : "visible now";
      const canSubmitQuery = !pending[slot];
      const encoder = gpu.device.createCommandEncoder({ label: "lesson-98-query-ring-encoder" });
      const passDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0.02, g: 0.04, b: 0.08, a: 1 },
          },
        ],
        depthStencilAttachment: {
          view: ensureDepthTarget(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "discard",
        },
      };
      if (canSubmitQuery) {
        passDescriptor.occlusionQuerySet = querySet;
      }
      const pass = encoder.beginRenderPass(passDescriptor);
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, vertexBuffer);
      pass.draw(vertexCountPerQuad, 1, 0, 0);
      if (canSubmitQuery) {
        pass.beginOcclusionQuery(slot);
      }
      pass.draw(vertexCountPerQuad, 1, vertexCountPerQuad, 0);
      if (canSubmitQuery) {
        pass.endOcclusionQuery();
      }
      pass.end();
      if (canSubmitQuery) {
        encoder.resolveQuerySet(querySet, slot, 1, resolveBuffer, slot * queryResolveStride);
        encoder.copyBufferToBuffer(resolveBuffer, slot * queryResolveStride, readbackBuffers[slot], 0, queryResultSize);
      }
      gpu.device.queue.submit([encoder.finish()]);
      if (canSubmitQuery) {
        pending[slot] = true;
        submittedFrame[slot] = frame;
        void consumeSlot(slot, submittedFrame[slot]);
      }
      frame += 1;
      frameId = requestAnimationFrame(render);
    };
    render();
    setStatus({ title: "Query readback ring", detail: "occlusion query resolve + MAP_READ ring 正在延迟消费结果。", tone: "ok" });
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      querySet.destroy();
      resolveBuffer.destroy();
      vertexBuffer.destroy();
      depthTarget?.texture.destroy();
      readbackBuffers.forEach((_, slot) => destroyReadbackBuffer(slot));
    };
  } catch (error) {
    setStatus({ title: "WebGPU 初始化失败", detail: error instanceof Error ? error.message : String(error), tone: "warn" });
  }
}
