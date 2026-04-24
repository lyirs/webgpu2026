import { createWebGpuCanvas } from "@/core/webgpu";
import { createOrbitCameraController } from "@/core/orbit-camera";
import fragmentShaderSource from "@/lessons/lesson-16-scene-graph/cube.frag.wgsl?raw";
import { createSceneGraphCubeGeometry } from "@/lessons/lesson-16-scene-graph/cube-data";
import {
  createIdentityMatrix,
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createRotationZMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-16-scene-graph/math";
import vertexShaderSource from "@/lessons/lesson-16-scene-graph/cube.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type DrawableState = {
  color: Vector3;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
};

type SceneNode = {
  label: string;
  localMatrix: Float32Array;
  worldMatrix: Float32Array;
  children: SceneNode[];
  drawable?: DrawableState;
};

/**
 * 安全释放一张 GPUTexture。
 * @param {GPUTexture | null} resource 要释放的 GPU 纹理对象。
 * @returns {void} 只负责销毁纹理，不返回额外结果。
 */
function destroyGpuTexture(resource: GPUTexture | null): void {
  resource?.destroy();
}

/**
 * 把视图投影矩阵、对象世界矩阵、颜色和光线方向打包成一份 uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前相机视角的 VP 矩阵。
 * @param {Float32Array} worldMatrix 当前节点的世界矩阵。
 * @param {Vector3} color 当前节点的基础颜色。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 适合直接写进 uniform buffer 的连续 float 数据。
 */
function createSceneUniformData(
  viewProjectionMatrix: Float32Array,
  worldMatrix: Float32Array,
  color: Vector3,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(40);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set(worldMatrix, 16);
  uniformData.set([color[0], color[1], color[2], 1], 32);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    36
  );
  return uniformData;
}

/**
 * 创建一个场景树节点。
 * @param {string} label 节点名，方便课程里区分“这是 pivot 节点还是 mesh 节点”。
 * @param {DrawableState | undefined} drawable 如果存在，说明这个节点会真正参与 draw；否则它只是层级里的变换节点。
 * @returns {SceneNode} 带本地矩阵、世界矩阵和子节点列表的场景节点。
 */
function createSceneNode(
  label: string,
  drawable?: DrawableState
): SceneNode {
  return {
    label,
    localMatrix: createIdentityMatrix(),
    worldMatrix: createIdentityMatrix(),
    children: [],
    drawable,
  };
}

/**
 * 把子节点挂到父节点下面。
 * @param {SceneNode} parent 父节点。
 * @param {SceneNode} child 子节点。
 * @returns {SceneNode} 方便继续链式挂接的子节点本身。
 */
function appendChild(parent: SceneNode, child: SceneNode): SceneNode {
  parent.children.push(child);
  return child;
}

/**
 * 从根节点开始递归计算整棵树的世界矩阵。
 * @param {SceneNode} node 当前要更新的节点。
 * @param {Float32Array | undefined} parentWorldMatrix 父节点的世界矩阵；根节点调用时不传。
 * @returns {void} 只负责把 `worldMatrix = parentWorldMatrix * localMatrix` 递归算出来。
 */
function updateWorldMatrix(
  node: SceneNode,
  parentWorldMatrix?: Float32Array
): void {
  node.worldMatrix = parentWorldMatrix
    ? multiplyMatrices(parentWorldMatrix, node.localMatrix)
    : node.localMatrix;

  node.children.forEach((child) => {
    updateWorldMatrix(child, node.worldMatrix);
  });
}

/**
 * 递归绘制整棵场景树。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPURenderPassEncoder} pass 当前场景 pass 的编码器。
 * @param {GPUBuffer} vertexBuffer 共享的立方体顶点缓冲。
 * @param {GPUBuffer} indexBuffer 共享的立方体索引缓冲。
 * @param {number} indexCount 共享几何的索引数量。
 * @param {Float32Array} viewProjectionMatrix 当前帧的 VP 矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @param {SceneNode} node 当前要绘制的节点。
 * @returns {void} 只负责递归更新 uniform 并发出 draw 命令，不返回额外结果。
 */
function drawSceneNode(
  device: GPUDevice,
  pass: GPURenderPassEncoder,
  vertexBuffer: GPUBuffer,
  indexBuffer: GPUBuffer,
  indexCount: number,
  viewProjectionMatrix: Float32Array,
  lightDirection: Vector3,
  node: SceneNode
): void {
  if (node.drawable) {
    const uniformData = createSceneUniformData(
      viewProjectionMatrix,
      node.worldMatrix,
      node.drawable.color,
      lightDirection
    );

    device.queue.writeBuffer(node.drawable.uniformBuffer, 0, uniformData);
    pass.setBindGroup(0, node.drawable.bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, "uint16");
    pass.drawIndexed(indexCount);
  }

  node.children.forEach((child) => {
    drawSceneNode(
      device,
      pass,
      vertexBuffer,
      indexBuffer,
      indexCount,
      viewProjectionMatrix,
      lightDirection,
      child
    );
  });
}

/**
 * 挂载第 12 课“多物体与场景树”预览，并演示 local/world matrix 的层级继承。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountSceneGraphLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="Scene graph lesson preview"></canvas>
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

  let depthTexture: GPUTexture | null = null;
  let depthTextureWidth = 0;
  let depthTextureHeight = 0;

  try {
    const gpu = await createWebGpuCanvas(canvas);

    /**
     * 根据宿主容器尺寸同步中间预览区的 16:9 画幅。
     * @returns {void} 只更新预览视口的宽高样式，不返回额外结果。
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

    const cube = createSceneGraphCubeGeometry();
    const vertexBuffer = gpu.device.createBuffer({
      size: cube.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(vertexBuffer, 0, cube.vertexData);

    const indexBuffer = gpu.device.createBuffer({
      size: cube.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    gpu.device.queue.writeBuffer(indexBuffer, 0, cube.indexData);

    const uniformBufferSize = 16 * 4 * 2 + 4 * 4 * 2;
    const vertexShaderModule = gpu.device.createShaderModule({
      code: vertexShaderSource,
    });
    const fragmentShaderModule = gpu.device.createShaderModule({
      code: fragmentShaderSource,
    });
    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-16-scene-graph",
      layout: "auto",
      vertex: {
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
      },
      fragment: {
        module: fragmentShaderModule,
        entryPoint: "fsMain",
        targets: [{ format: gpu.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    /**
     * 给一个可绘制节点创建自己的 uniform buffer 和 bind group。
     * @param {Vector3} color 这个节点的基础颜色。
     * @returns {DrawableState} 已经和当前 pipeline 对齐好的可绘制资源。
     */
    const createDrawableState = (color: Vector3): DrawableState => {
      const uniformBuffer = gpu.device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = gpu.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
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
        color,
        uniformBuffer,
        bindGroup,
      };
    };

    const sceneRoot = createSceneNode("scene-root");
    const stage = appendChild(
      sceneRoot,
      createSceneNode("stage-mesh", createDrawableState([0.72, 0.75, 0.82]))
    );
    const robotPivot = appendChild(sceneRoot, createSceneNode("robot-pivot"));
    const body = appendChild(
      robotPivot,
      createSceneNode("body-mesh", createDrawableState([0.94, 0.52, 0.38]))
    );
    const headPivot = appendChild(robotPivot, createSceneNode("head-pivot"));
    const head = appendChild(
      headPivot,
      createSceneNode("head-mesh", createDrawableState([0.98, 0.86, 0.42]))
    );
    const leftShoulderPivot = appendChild(
      robotPivot,
      createSceneNode("left-shoulder-pivot")
    );
    const leftArm = appendChild(
      leftShoulderPivot,
      createSceneNode("left-arm-mesh", createDrawableState([0.42, 0.74, 0.98]))
    );
    const rightShoulderPivot = appendChild(
      robotPivot,
      createSceneNode("right-shoulder-pivot")
    );
    const rightArm = appendChild(
      rightShoulderPivot,
      createSceneNode("right-arm-mesh", createDrawableState([0.48, 0.9, 0.73]))
    );
    const satellitePivot = appendChild(headPivot, createSceneNode("satellite-pivot"));
    const satellite = appendChild(
      satellitePivot,
      createSceneNode("satellite-mesh", createDrawableState([0.42, 0.9, 0.95]))
    );

    const ensureDepthTexture = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        depthTexture &&
        depthTextureWidth === width &&
        depthTextureHeight === height
      ) {
        return depthTexture;
      }

      depthTexture?.destroy();
      depthTextureWidth = width;
      depthTextureHeight = height;

      depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

      return depthTexture;
    };

    const eye: Vector3 = [8.6, 6.2, 11.8];
    const target: Vector3 = [0, 1.9, 0];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
    });

    const render = (elapsed: number) => {
      syncViewport();
      gpu.resize();

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        (60 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewProjectionMatrix = multiplyMatrices(
        projectionMatrix,
        viewMatrix
      );
      const lightDirection = normalizeVector([
        Math.sin(elapsed * 0.8) * 0.6,
        1,
        Math.cos(elapsed * 0.8) * 0.85,
      ]);

      stage.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, -0.18, 0),
        createScaleMatrix(6.4, 0.18, 6.4)
      );
      robotPivot.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, 0, 0),
        createRotationYMatrix(elapsed * 0.55)
      );
      body.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, 1.7, 0),
        createScaleMatrix(1.15, 1.7, 0.88)
      );
      headPivot.localMatrix = createTranslationMatrix(0, 4.05, 0);
      head.localMatrix = createScaleMatrix(0.82, 0.82, 0.82);
      leftShoulderPivot.localMatrix = multiplyMatrices(
        createTranslationMatrix(-1.45, 2.9, 0),
        createRotationZMatrix(Math.sin(elapsed * 2.1) * 0.55)
      );
      leftArm.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, -0.95, 0),
        createScaleMatrix(0.3, 0.95, 0.3)
      );
      rightShoulderPivot.localMatrix = multiplyMatrices(
        createTranslationMatrix(1.45, 2.9, 0),
        createRotationZMatrix(-Math.sin(elapsed * 2.1) * 0.55)
      );
      rightArm.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, -0.95, 0),
        createScaleMatrix(0.3, 0.95, 0.3)
      );
      satellitePivot.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, 0.15, 0),
        createRotationYMatrix(elapsed * 1.8)
      );
      satellite.localMatrix = multiplyMatrices(
        createTranslationMatrix(1.9, 0.28, 0),
        createScaleMatrix(0.34, 0.34, 0.34)
      );

      updateWorldMatrix(sceneRoot);

      const currentDepthTexture = ensureDepthTexture();
      const commandEncoder = gpu.device.createCommandEncoder();
      const pass = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: gpu.context.getCurrentTexture().createView(),
            clearValue: { r: 0.043, g: 0.074, b: 0.141, a: 1 },
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: currentDepthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      pass.setPipeline(pipeline);
      drawSceneNode(
        gpu.device,
        pass,
        vertexBuffer,
        indexBuffer,
        cube.indexCount,
        viewProjectionMatrix,
        lightDirection,
        sceneRoot
      );
      pass.end();

      gpu.device.queue.submit([commandEncoder.finish()]);
    };

    let animationFrameId = 0;
    const startTime = performance.now();

    const frame = (time: number) => {
      const elapsed = (time - startTime) * 0.001;
      render(elapsed);
      animationFrameId = window.requestAnimationFrame(frame);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncViewport();
    });

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "场景树已运行",
      detail:
        "现在整棵小场景会一起转，但头部卫星和左右手臂还有自己的局部动画，这一课重点就是 localMatrix、worldMatrix 和 updateWorldMatrix。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      window.cancelAnimationFrame(animationFrameId);
      destroyGpuTexture(depthTexture);
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

    destroyGpuTexture(depthTexture);

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
