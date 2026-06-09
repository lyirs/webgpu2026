import animatedGltfUrl from "@/assets/gltf-animation-basics.gltf?url";
import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import {
  loadAnimatedGltfScene,
  type AnimationPath,
  type LoadedAnimatedGltfNode,
  type LoadedAnimatedGltfPrimitive,
  type LoadedAnimatedGltfScene,
  type LoadedGltfAnimationChannel,
  type LoadedGltfAnimationClip,
} from "@/lessons/lesson-82-gltf-animation-basic/gltf";
import {
  composeNodeMatrix,
  createIdentityMatrix,
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  lerpVector3,
  multiplyMatrices,
  normalizeVector,
  slerpQuaternion,
  type Quaternion,
  type Vector3,
} from "@/lessons/lesson-82-gltf-animation-basic/math";
import fragmentShaderSource from "@/lessons/lesson-82-gltf-animation-basic/model.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-82-gltf-animation-basic/model.vert.wgsl?raw";

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const animatedGltfBinDataUri =
  "data:application/octet-stream;base64,AACAPwAAgL8AAIC/AACAPwAAgD8AAIC/AACAPwAAgD8AAIA/AACAPwAAgL8AAIA/AACAvwAAgL8AAIA/AACAvwAAgD8AAIA/AACAvwAAgD8AAIC/AACAvwAAgL8AAIC/AACAvwAAgD8AAIC/AACAvwAAgD8AAIA/AACAPwAAgD8AAIA/AACAPwAAgD8AAIC/AACAvwAAgL8AAIA/AACAvwAAgL8AAIC/AACAPwAAgL8AAIC/AACAPwAAgL8AAIA/AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA/AACAPwAAgL8AAIC/AACAvwAAgL8AAIC/AACAvwAAgD8AAIC/AACAPwAAgD8AAIC/AACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAPwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAACAvwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAgL8AAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAAAAAAAAAAAAIC/AAABAAIAAAACAAMABAAFAAYABAAGAAcACAAJAAoACAAKAAsADAANAA4ADAAOAA8AEAARABIAEAASABMAFAAVABYAFAAWABcAAAAAAAAAgD8AAABAAABAQAAAgEDNzAzAMzMzPwAAAADNzAzAZmbGPwAAAADNzAzAMzMzPwAAAADNzAzAmpkZPgAAAADNzAzAMzMzPwAAAAAAAAAAAAAAAAAAAAAAAIA/AAAAAPMENT8AAAAA8wQ1PwAAAAAAAIA/AAAAADIxjSQAAAAA8wQ1PwAAAADzBDW/AAAAADIxDSUAAAAAAACAv83MTD/NzEw/zcxMP83MrD/NzKw/zcysP+xROD/sUTg/7FE4PwAAwD8AAMA/AADAP83MTD/NzEw/zcxMPw==";

type RuntimeAnimatedNode = LoadedAnimatedGltfNode & {
  localMatrix: Float32Array;
  worldMatrix: Float32Array;
  translation: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  baseColor: Vector3;
  nodeUniformBuffer: GPUBuffer;
  nodeBindGroup: GPUBindGroup;
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
 * 把单个节点的 model matrix 和底色打包成 uniform 数据。
 * @param {Float32Array} modelMatrix 当前节点这一次 draw 使用的模型矩阵。
 * @param {Vector3} baseColor 当前节点对应的基础颜色。
 * @returns {Float32Array} 对应的节点 uniform 数据。
 */
function createNodeUniformData(
  modelMatrix: Float32Array,
  baseColor: Vector3
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(modelMatrix, 0);
  uniformData.set([baseColor[0], baseColor[1], baseColor[2], 0], 16);
  return uniformData;
}

/**
 * 给不同的 glTF 节点分配一套稳定的演示颜色。
 * @param {string} nodeName 当前 glTF 节点名。
 * @returns {Vector3} 对应节点的基础颜色。
 */
function nodeColor(nodeName: string): Vector3 {
  switch (nodeName) {
    case "Platform":
      return [0.71, 0.75, 0.86];
    case "Bob":
      return [0.94, 0.54, 0.35];
    case "SpinPivot":
    case "Spinner":
      return [0.34, 0.77, 0.75];
    case "Pulse":
      return [0.92, 0.79, 0.36];
    default:
      return [0.78, 0.74, 0.86];
  }
}

/**
 * 根据加载好的 glTF 节点数据创建运行时节点对象。
 * @param {LoadedAnimatedGltfScene} gltfScene 已经解析并上传完成的 glTF 场景数据。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPURenderPipeline} pipeline 当前 lesson 使用的渲染管线。
 * @returns {RuntimeAnimatedNode[]} 带独立 uniform 和动画状态的运行时节点列表。
 */
function createRuntimeNodes(
  gltfScene: LoadedAnimatedGltfScene,
  device: GPUDevice,
  pipeline: GPURenderPipeline
): RuntimeAnimatedNode[] {
  return gltfScene.nodes.map((node) => {
    const nodeUniformBuffer = device.createBuffer({
      size: 20 * 4,
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
      ...node,
      localMatrix: createIdentityMatrix(),
      worldMatrix: createIdentityMatrix(),
      translation: [...node.baseTranslation],
      rotation: [...node.baseRotation],
      scale: [...node.baseScale],
      baseColor: nodeColor(node.name),
      nodeUniformBuffer,
      nodeBindGroup,
    };
  });
}

/**
 * 找到某条动画曲线在当前时间所处的关键帧区间。
 * @param {Float32Array} times 关键帧时间数组。
 * @param {number} time 当前采样时间。
 * @returns {{ startIndex: number; endIndex: number; alpha: number }} 插值区间及插值系数。
 */
function findKeyframeInterval(
  times: Float32Array,
  time: number
): { startIndex: number; endIndex: number; alpha: number } {
  if (times.length === 0) {
    return { startIndex: 0, endIndex: 0, alpha: 0 };
  }

  if (time <= times[0]) {
    return { startIndex: 0, endIndex: 0, alpha: 0 };
  }

  for (let index = 0; index < times.length - 1; index += 1) {
    const startTime = times[index];
    const endTime = times[index + 1];
    if (time <= endTime) {
      const duration = Math.max(endTime - startTime, 1e-6);
      return {
        startIndex: index,
        endIndex: index + 1,
        alpha: (time - startTime) / duration,
      };
    }
  }

  const lastIndex = times.length - 1;
  return { startIndex: lastIndex, endIndex: lastIndex, alpha: 0 };
}

/**
 * 从紧凑的 Float32Array 中按索引读出一个 vec3。
 * @param {Float32Array} values 连续存放的向量数据。
 * @param {number} index 要读取的向量索引。
 * @returns {Vector3} 对应的三维向量。
 */
function readVector3Value(values: Float32Array, index: number): Vector3 {
  const offset = index * 3;
  return [values[offset], values[offset + 1], values[offset + 2]];
}

/**
 * 从紧凑的 Float32Array 中按索引读出一个 quaternion。
 * @param {Float32Array} values 连续存放的四元数数据。
 * @param {number} index 要读取的四元数索引。
 * @returns {Quaternion} 对应的四元数。
 */
function readQuaternionValue(values: Float32Array, index: number): Quaternion {
  const offset = index * 4;
  return [
    values[offset],
    values[offset + 1],
    values[offset + 2],
    values[offset + 3],
  ];
}

/**
 * 对单条动画曲线做采样，得到当前时间下的 TRS 结果。
 * @param {LoadedGltfAnimationChannel} channel 当前动画通道。
 * @param {number} time 当前采样时间。
 * @returns {Vector3 | Quaternion} 当前时间对应的插值结果。
 */
function sampleAnimationChannel(
  channel: LoadedGltfAnimationChannel,
  time: number
): Vector3 | Quaternion {
  const interval = findKeyframeInterval(channel.inputTimes, time);

  if (channel.path === "rotation") {
    const startValue = readQuaternionValue(
      channel.outputValues,
      interval.startIndex
    );
    const endValue = readQuaternionValue(channel.outputValues, interval.endIndex);
    return slerpQuaternion(startValue, endValue, interval.alpha);
  }

  const startValue = readVector3Value(channel.outputValues, interval.startIndex);
  const endValue = readVector3Value(channel.outputValues, interval.endIndex);
  return lerpVector3(startValue, endValue, interval.alpha);
}

/**
 * 把一条动画通道写回到对应节点的当前 TRS。
 * @param {RuntimeAnimatedNode[]} nodes 运行时节点列表。
 * @param {LoadedGltfAnimationChannel} channel 当前动画通道。
 * @param {Vector3 | Quaternion} sampledValue 当前时间采样出来的结果。
 * @returns {void} 只负责更新目标节点当前帧的 TRS 状态。
 */
function applyAnimationValue(
  nodes: RuntimeAnimatedNode[],
  channel: LoadedGltfAnimationChannel,
  sampledValue: Vector3 | Quaternion
): void {
  const node = nodes[channel.nodeIndex];
  if (!node) {
    return;
  }

  switch (channel.path as AnimationPath) {
    case "translation":
      node.translation = sampledValue as Vector3;
      break;
    case "rotation":
      node.rotation = sampledValue as Quaternion;
      break;
    case "scale":
      node.scale = sampledValue as Vector3;
      break;
  }
}

/**
 * 根据动画 clip 更新整份 glTF 节点当前帧的 TRS 和 local matrix。
 * @param {RuntimeAnimatedNode[]} nodes 运行时节点列表。
 * @param {LoadedGltfAnimationClip} clip 当前要播放的动画片段。
 * @param {number} elapsed 当前已经过去的秒数。
 * @returns {void} 只负责更新节点动画状态，不返回额外结果。
 */
function updateAnimationState(
  nodes: RuntimeAnimatedNode[],
  clip: LoadedGltfAnimationClip,
  elapsed: number
): void {
  nodes.forEach((node) => {
    node.translation = [...node.baseTranslation];
    node.rotation = [...node.baseRotation];
    node.scale = [...node.baseScale];
  });

  const localTime = clip.duration > 0 ? elapsed % clip.duration : 0;
  clip.channels.forEach((channel) => {
    const sampledValue = sampleAnimationChannel(channel, localTime);
    applyAnimationValue(nodes, channel, sampledValue);
  });

  nodes.forEach((node) => {
    node.localMatrix = composeNodeMatrix(
      node.translation,
      node.rotation,
      node.scale
    );
  });
}

/**
 * 从根节点开始递归计算整棵 glTF 节点树的世界矩阵。
 * @param {RuntimeAnimatedNode[]} nodes 运行时节点列表。
 * @param {number} nodeIndex 当前节点索引。
 * @param {Float32Array} parentWorldMatrix 父节点世界矩阵。
 * @returns {void} 只负责递归更新 world matrix。
 */
function updateAnimatedWorldMatrix(
  nodes: RuntimeAnimatedNode[],
  nodeIndex: number,
  parentWorldMatrix: Float32Array
): void {
  const node = nodes[nodeIndex];
  node.worldMatrix = multiplyMatrices(parentWorldMatrix, node.localMatrix);
  node.children.forEach((childIndex) => {
    updateAnimatedWorldMatrix(nodes, childIndex, node.worldMatrix);
  });
}

/**
 * 递归绘制整个 glTF 动画场景。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GPURenderPassEncoder} pass 当前场景 pass 的编码器。
 * @param {LoadedAnimatedGltfPrimitive[][]} meshes 已上传到 GPU 的 mesh 列表。
 * @param {RuntimeAnimatedNode[]} nodes 运行时节点列表。
 * @param {number} nodeIndex 当前要绘制的节点索引。
 * @returns {void} 只负责写入节点 uniform 并发出 draw 命令。
 */
function drawAnimatedNode(
  device: GPUDevice,
  pass: GPURenderPassEncoder,
  meshes: LoadedAnimatedGltfPrimitive[][],
  nodes: RuntimeAnimatedNode[],
  nodeIndex: number
): void {
  const node = nodes[nodeIndex];
  if (node.meshIndex !== null) {
    device.queue.writeBuffer(
      node.nodeUniformBuffer,
      0,
      createNodeUniformData(node.worldMatrix, node.baseColor)
    );
    pass.setBindGroup(1, node.nodeBindGroup);

    meshes[node.meshIndex].forEach((primitive) => {
      pass.setVertexBuffer(0, primitive.positionBuffer);
      pass.setVertexBuffer(1, primitive.normalBuffer);
      if (primitive.indexBuffer && primitive.indexFormat) {
        pass.setIndexBuffer(primitive.indexBuffer, primitive.indexFormat);
        pass.drawIndexed(primitive.indexCount);
      } else {
        pass.draw(primitive.vertexCount);
      }
    });
  }

  node.children.forEach((childIndex) => {
    drawAnimatedNode(device, pass, meshes, nodes, childIndex);
  });
}

/**
 * 挂载第 24 课“glTF 动画基础”预览，并播放一个最小 TRS 动画 clip。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountGltfAnimationBasicLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="glTF animation basics lesson preview"></canvas>
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

    const gltfScene = await loadAnimatedGltfScene(animatedGltfUrl, gpu.device, {
      "gltf-animation-basics.bin": animatedGltfBinDataUri,
    });
    const clip = gltfScene.animations[0];
    if (!clip) {
      throw new Error("这个 lesson 需要至少一条 glTF 动画片段。");
    }

    const frameUniformBuffer = gpu.device.createBuffer({
      size: 20 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-82-gltf-animation-basic",
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

    const runtimeNodes = createRuntimeNodes(gltfScene, gpu.device, pipeline);

    const eye: Vector3 = [0, 4.5, 9.8];
    const target: Vector3 = [0, 0.95, 0];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
      minRadius: 5,
      maxRadius: 15,
    });
    const lightDirection = normalizeVector([0.48, 0.9, 0.36]);

    const ensureDepthTexture = () => {
      const width = canvas.width;
      const height = canvas.height;

      if (depthTexture && depthTextureView && width > 0 && height > 0) {
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
      const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        (50 * Math.PI) / 180,
        aspect,
        0.1,
        100
      );
      const viewProjectionMatrix = multiplyMatrices(projectionMatrix, viewMatrix);
      gpu.device.queue.writeBuffer(
        frameUniformBuffer,
        0,
        createFrameUniformData(viewProjectionMatrix, lightDirection)
      );

      updateAnimationState(runtimeNodes, clip, elapsed);
      gltfScene.rootNodeIds.forEach((rootNodeId) => {
        updateAnimatedWorldMatrix(runtimeNodes, rootNodeId, createIdentityMatrix());
      });

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
      gltfScene.rootNodeIds.forEach((rootNodeId) => {
        drawAnimatedNode(
          gpu.device,
          pass,
          gltfScene.meshes,
          runtimeNodes,
          rootNodeId
        );
      });
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
      title: "glTF 动画已运行",
      detail:
        "这一课开始真正读取 glTF 里的 animation sampler 和 channel，让节点自己的 translation、rotation、scale 按关键帧动起来。",
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
