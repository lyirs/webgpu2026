import damagedHelmetUrl from "@/assets/damaged-helmet-basic.glb?url";
import { createWebGpuCanvas } from "@/core/webgpu";
import { createOrbitCameraController } from "@/core/orbit-camera";
import {
  loadTexturedGlbScene,
  type LoadedTexturedGlbDrawable,
  type LoadedTexturedGlbScene,
} from "@/lessons/lesson-78-gltf-textures/glb";
import {
  createIdentityMatrix,
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  createRotationYMatrix,
  createScaleMatrix,
  createTranslationMatrix,
  multiplyMatrices,
  normalizeVector,
  type Vector3,
} from "@/lessons/lesson-80-gltf-scene-integration/math";
import fragmentShaderSource from "@/lessons/lesson-80-gltf-scene-integration/model.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-80-gltf-scene-integration/model.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

type ModelAssetPrimitive = LoadedTexturedGlbDrawable["primitives"][number] & {
  materialBindGroup: GPUBindGroup;
};

type ModelAssetDrawable = {
  name: string;
  baseWorldMatrix: Float32Array;
  primitives: ModelAssetPrimitive[];
};

type LoadedModelAsset = {
  drawables: ModelAssetDrawable[];
  bounds: LoadedTexturedGlbScene["bounds"];
};

type GlbRenderable = {
  name: string;
  primitives: ModelAssetPrimitive[];
  baseWorldMatrix: Float32Array;
  nodeUniformBuffer: GPUBuffer;
  nodeBindGroup: GPUBindGroup;
};

type SceneNode = {
  label: string;
  localMatrix: Float32Array;
  worldMatrix: Float32Array;
  children: SceneNode[];
  renderables?: GlbRenderable[];
};

/**
 * 把 viewProjection 矩阵和主光方向打包成一份 frame uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前帧的 VP 矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 可直接写进 uniform buffer 的连续 float 数据。
 */
function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    16
  );
  return uniformData;
}

/**
 * 把单个节点的 model matrix 打包成 uniform 数据。
 * @param {Float32Array} modelMatrix 当前节点这一次 draw 使用的模型矩阵。
 * @returns {Float32Array} 对应的节点 uniform 数据。
 */
function createNodeUniformData(modelMatrix: Float32Array): Float32Array {
  const uniformData = new Float32Array(16);
  uniformData.set(modelMatrix, 0);
  return uniformData;
}

/**
 * 创建一个场景树节点。
 * @param {string} label 节点名，方便区分“这是纯变换节点还是模型实例节点”。
 * @param {GlbRenderable[] | undefined} renderables 如果存在，说明这个节点会真正发出 draw；否则它只是层级里的变换节点。
 * @returns {SceneNode} 带本地矩阵、世界矩阵和子节点列表的场景节点。
 */
function createSceneNode(
  label: string,
  renderables?: GlbRenderable[]
): SceneNode {
  return {
    label,
    localMatrix: createIdentityMatrix(),
    worldMatrix: createIdentityMatrix(),
    children: [],
    renderables,
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
 * 把上一课解析好的 glTF 场景包装成一个可复用模型资产。
 * @param {LoadedTexturedGlbScene} glbScene 已经上传到 GPU 的带贴图 glTF 场景。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPURenderPipeline} pipeline 当前 lesson 使用的渲染管线。
 * @returns {LoadedModelAsset} 可被多个场景节点重复实例化的模型资产。
 */
function createModelAsset(
  glbScene: LoadedTexturedGlbScene,
  device: GPUDevice,
  pipeline: GPURenderPipeline
): LoadedModelAsset {
  return {
    bounds: glbScene.bounds,
    drawables: glbScene.drawables.map((drawable) => ({
      name: drawable.name,
      baseWorldMatrix: drawable.baseWorldMatrix,
      primitives: drawable.primitives.map((primitive) => ({
        ...primitive,
        materialBindGroup: device.createBindGroup({
          layout: pipeline.getBindGroupLayout(2),
          entries: [
            {
              binding: 0,
              resource: primitive.material.baseColorSampler,
            },
            {
              binding: 1,
              resource: primitive.material.baseColorTextureView,
            },
          ],
        }),
      })),
    })),
  };
}

/**
 * 把一个已经加载好的 glTF 资产实例化成场景树节点。
 * @param {string} label 节点名。
 * @param {LoadedModelAsset} asset 已经准备好的共享模型资产。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPURenderPipeline} pipeline 当前 lesson 使用的渲染管线。
 * @returns {SceneNode} 持有独立 uniform、但共享 mesh / texture / sampler 的模型实例节点。
 */
function createModelSceneNode(
  label: string,
  asset: LoadedModelAsset,
  device: GPUDevice,
  pipeline: GPURenderPipeline
): SceneNode {
  const renderables = asset.drawables.map((drawable) => {
    const nodeUniformBuffer = device.createBuffer({
      size: 16 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const nodeBindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: nodeUniformBuffer,
          },
        },
      ],
    });

    return {
      name: drawable.name,
      primitives: drawable.primitives,
      baseWorldMatrix: drawable.baseWorldMatrix,
      nodeUniformBuffer,
      nodeBindGroup,
    };
  });

  return createSceneNode(label, renderables);
}

/**
 * 递归绘制整棵 glTF 场景树。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPURenderPassEncoder} pass 当前场景 pass 的编码器。
 * @param {SceneNode} node 当前要绘制的节点。
 * @returns {void} 只负责递归更新 uniform 并发出 draw 命令，不返回额外结果。
 */
function drawSceneNode(
  device: GPUDevice,
  pass: GPURenderPassEncoder,
  node: SceneNode
): void {
  node.renderables?.forEach((renderable) => {
    const modelMatrix = multiplyMatrices(node.worldMatrix, renderable.baseWorldMatrix);
    device.queue.writeBuffer(
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

  node.children.forEach((child) => {
    drawSceneNode(device, pass, child);
  });
}

/**
 * 挂载第 19 课“glTF 场景整合”预览，并把外部模型真正接进场景树。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountGltfSceneIntegrationLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="glTF scene integration lesson preview"></canvas>
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
  let depthTextureView: GPUTextureView | null = null;

  /**
   * 释放当前 lesson 持有的深度纹理及其视图。
   * @returns {void} 只负责销毁当前深度资源，不返回额外结果。
   */
  const destroyDepthTexture = () => {
    const currentDepthTexture = depthTexture;
    if (currentDepthTexture) {
      currentDepthTexture.destroy();
    }
    depthTexture = null;
    depthTextureView = null;
  };

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

    const glbScene = await loadTexturedGlbScene(damagedHelmetUrl, gpu.device);
    const frameUniformBuffer = gpu.device.createBuffer({
      size: 16 * 4 + 4 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-80-gltf-scene-integration",
      layout: "auto",
      vertex: {
        module: gpu.device.createShaderModule({
          code: vertexShaderSource,
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
          code: fragmentShaderSource,
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

    const frameBindGroup = gpu.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: frameUniformBuffer,
          },
        },
      ],
    });

    const asset = createModelAsset(glbScene, gpu.device, pipeline);

    const sceneMin = asset.bounds.min;
    const sceneMax = asset.bounds.max;
    const extentX = sceneMax[0] - sceneMin[0];
    const extentY = sceneMax[1] - sceneMin[1];
    const extentZ = sceneMax[2] - sceneMin[2];
    const modelRadius = Math.max(extentX, extentY, extentZ) * 0.55;
    const orbitRadius = modelRadius * 3.15;
    const sceneRadius = orbitRadius + modelRadius * 1.6;

    const root = createSceneNode("root");
    const showcaseRoot = appendChild(root, createSceneNode("showcase-root"));
    const centerHelmet = appendChild(
      showcaseRoot,
      createModelSceneNode("center-helmet", asset, gpu.device, pipeline)
    );
    const satelliteOrbit = appendChild(
      showcaseRoot,
      createSceneNode("satellite-orbit")
    );
    const leftHelmet = appendChild(
      satelliteOrbit,
      createModelSceneNode("left-helmet", asset, gpu.device, pipeline)
    );
    const rightHelmet = appendChild(
      satelliteOrbit,
      createModelSceneNode("right-helmet", asset, gpu.device, pipeline)
    );
    const backHelmet = appendChild(
      satelliteOrbit,
      createModelSceneNode("back-helmet", asset, gpu.device, pipeline)
    );

    const eye: Vector3 = [0, sceneRadius * 0.7, sceneRadius * 2.15];
    const target: Vector3 = [0, modelRadius * 0.75, 0];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
      minRadius: Math.max(sceneRadius * 1.1, 3.5),
      maxRadius: Math.max(sceneRadius * 4.8, 9),
    });
    const lightDirection = normalizeVector([0.42, 0.95, 0.58]);

    const ensureDepthTexture = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (
        depthTexture &&
        depthTextureView &&
        width > 0 &&
        height > 0
      ) {
        return depthTextureView;
      }

      destroyDepthTexture();
      depthTexture = gpu.device.createTexture({
        size: [width, height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
      depthTextureView = depthTexture.createView();
      return depthTextureView;
    };

    const render = (elapsed: number) => {
      syncViewport();
      gpu.resize();
      const currentDepthView = ensureDepthTexture();

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        (48 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      const frameUniformData = createFrameUniformData(
        viewProjectionMatrix,
        lightDirection
      );
      gpu.device.queue.writeBuffer(frameUniformBuffer, 0, frameUniformData);

      showcaseRoot.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, -sceneMin[1], 0),
        createRotationYMatrix(elapsed * 0.18)
      );

      centerHelmet.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, Math.sin(elapsed * 1.6) * 0.12, 0),
        createScaleMatrix(1.02, 1.02, 1.02)
      );

      satelliteOrbit.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, modelRadius * 0.18, 0),
        createRotationYMatrix(elapsed * 0.62)
      );

      leftHelmet.localMatrix = multiplyMatrices(
        createTranslationMatrix(-orbitRadius, 0, 0),
        multiplyMatrices(
          createRotationYMatrix(Math.PI * 0.5),
          createScaleMatrix(0.72, 0.72, 0.72)
        )
      );

      rightHelmet.localMatrix = multiplyMatrices(
        createTranslationMatrix(orbitRadius, 0, 0),
        multiplyMatrices(
          createRotationYMatrix(-Math.PI * 0.5),
          createScaleMatrix(0.72, 0.72, 0.72)
        )
      );

      backHelmet.localMatrix = multiplyMatrices(
        createTranslationMatrix(0, 0.08, -orbitRadius * 1.08),
        multiplyMatrices(
          createRotationYMatrix(Math.PI),
          createScaleMatrix(0.64, 0.64, 0.64)
        )
      );

      updateWorldMatrix(root);

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
          view: currentDepthView,
          depthClearValue: 1,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, frameBindGroup);
      drawSceneNode(gpu.device, pass, root);
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
      destroyDepthTexture();
      syncViewport();
    });

    resizeObserver.observe(host);
    animationFrameId = window.requestAnimationFrame(frame);

    setStatus({
      title: "glTF 场景整合已运行",
      detail:
        "这一课把上一课里加载好的外部模型真正接进场景树，同一份 glTF 资产现在可以被多个节点重复实例化。",
      tone: "ok",
    });

    return () => {
      resizeObserver.disconnect();
      orbitCamera.dispose();
      window.cancelAnimationFrame(animationFrameId);
      destroyDepthTexture();
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

    destroyDepthTexture();

    setStatus({
      title: "预览不可用",
      detail: message,
      tone: "warn",
    });
  }
}
