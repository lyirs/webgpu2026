import skinnedGltfUrl from "@/assets/gltf-skin-basics.gltf?url";
import { createOrbitCameraController } from "@/core/orbit-camera";
import { createWebGpuCanvas } from "@/core/webgpu";
import {
  loadSkinnedGltfScene,
  type AnimationPath,
  type LoadedGltfAnimationChannel,
  type LoadedGltfAnimationClip,
  type LoadedGltfSkin,
  type LoadedSkinnedGltfNode,
  type LoadedSkinnedGltfPrimitive,
} from "@/lessons/lesson-85-gltf-skinning-basic/gltf";
import {
  composeNodeMatrix,
  createIdentityMatrix,
  createLookAtViewMatrix,
  createPerspectiveMatrix,
  invertMatrix,
  lerpVector3,
  multiplyMatrices,
  normalizeVector,
  slerpQuaternion,
  type Quaternion,
  type Vector3,
} from "@/lessons/lesson-85-gltf-skinning-basic/math";
import fragmentShaderSource from "@/lessons/lesson-85-gltf-skinning-basic/model.frag.wgsl?raw";
import vertexShaderSource from "@/lessons/lesson-85-gltf-skinning-basic/model.vert.wgsl?raw";

const MAX_JOINTS = 16;

type StatusUpdate = {
  title: string;
  detail: string;
  tone: "info" | "ok" | "warn";
};

const skinnedGltfBinDataUriBase =
  "data:application/octet-stream;base64,KVyPvgAAAACuR2G+KVyPPgAAAACuR2G+KVyPPgAAAACuR2E+KVyPvgAAAACuR2E+KVyPvgAAQD+uR2G+KVyPPgAAQD+uR2G+KVyPPgAAQD+uR2E+KVyPvgAAQD+uR2E+KVyPvgAAwD+uR2G+KVyPPgAAwD+uR2G+KVyPPgAAwD+uR2E+KVyPvgAAwD+uR2E+KVyPvgAAEECuR2G+KVyPPgAAEECuR2G+KVyPPgAAEECuR2E+KVyPvgAAEECuR2E+KVyPvgAAQECuR2G+KVyPPgAAQECuR2G+KVyPPgAAQECuR2E+KVyPvgAAQECuR2E+KUxJvwAAAACOKR6/KUxJPwAAAACOKR6/KUxJPwAAAACOKR4/KUxJvwAAAACOKR4/KUxJvwAAAACOKR6/KUxJPwAAAACOKR6/KUxJPwAAAACOKR4/KUxJvwAAAACOKR4/KUxJvwAAAACOKR6/KUxJPwAAAACOKR6/KUxJPwAAAACOKR4/KUxJvwAAAACOKR4/KUxJvwAAAACOKR6/KUxJPwAAAACOKR6/KUxJPwAAAACOKR4/KUxJvwAAAACOKR4/KUxJvwAAAACOKR6/KUxJPwAAAACOKR6/KUxJPwAAAACOKR4/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAEAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAEAAAAAAAAAAQACAAAAAAABAAIAAAAAAAEAAgAAAAAAAQACAAAAAAACAAAAAAAAAAIAAAAAAAAAAgAAAAAAAAACAAAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAAA/AAAAPwAAAAAAAAAAAAAAPwAAAD8AAAAAAAAAAAAAAD8AAAA/AAAAAAAAAAAAAAA/AAAAPwAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAAD8AAAA/AAAAAAAAAAAAAAA/AAAAPwAAAAAAAAAAAAAAPwAAAD8AAAAAAAAAAAAAAD8AAAA/AAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAAABAAQABAABAAUAAQACAAUABQACAAYAAgADAAYABgADAAcAAwAAAAcABwAAAAQABAAFAAgACAAFAAkABQAGAAkACQAGAAoABgAHAAoACgAHAAsABwAEAAsACwAEAAgACAAJAAwADAAJAA0ACQAKAA0ADQAKAA4ACgALAA4ADgALAA8ACwAIAA8ADwAIAAwADAANABAAEAANABEADQAOABEAEQAOABIADgAPABIAEgAPABMADwAMABMAEwAMABAAAAADAAEAAQADAAIAEAARABMAEQASABMAAAAAAAAAgD8AAABAAABAQAAAgEAAAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAzCIs+f2F2PwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAADMIi75/YXY/AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAGdJMr4KF3w/AAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAZ0kyPgoXfD8AAAAAAAAAAAAAAAAAAIA/AACAPwAAAAAAAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAAAAAACAPwAAgD8AAAAAAAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAAAAAAAAAAAAAIA/AAAAAAAAAAAAAMC/AAAAAAAAgD8AAIA/AAAAAAAAAAAAAAAAAAAAAAAAgD8AAAAAAAAAAAAAAAAAAAAAAACAPwAAAAAAAAAAAABAwAAAAAAAAIA/";
const skinnedGltfBinDataUri = skinnedGltfBinDataUriBase.replace(
  "KUxJPwAAAACOKR4/AAAAAAAA",
  "KUxJPwAAAACOKR4/KUxJvwAAAACOKR4/AAAAAAAA",
);

type RuntimeSkinnedNode = LoadedSkinnedGltfNode & {
  localMatrix: Float32Array;
  worldMatrix: Float32Array;
  translation: Vector3;
  rotation: Quaternion;
  scale: Vector3;
};

type RuntimeSkin = LoadedGltfSkin & {
  skinUniformBuffer: GPUBuffer;
  skinBindGroup: GPUBindGroup;
};

type RuntimeRenderable = {
  nodeIndex: number;
  skinIndex: number | null;
  primitives: LoadedSkinnedGltfPrimitive[];
  nodeUniformBuffer: GPUBuffer;
  nodeBindGroup: GPUBindGroup;
  baseColor: Vector3;
};

/**
 * 把 VP 矩阵和主光方向打包成 frame uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前帧的 VP 矩阵。
 * @param {Vector3} lightDirection 世界空间里的主光方向。
 * @returns {Float32Array} 可直接写进 frame uniform buffer 的连续数据。
 */
function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  lightDirection: Vector3
): Float32Array {
  const uniformData = new Float32Array(20);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set([lightDirection[0], lightDirection[1], lightDirection[2], 0], 16);
  return uniformData;
}

/**
 * 把节点的世界矩阵和基础颜色打包成 node uniform 数据。
 * @param {Float32Array} modelMatrix 当前节点的世界矩阵。
 * @param {Vector3} baseColor 当前节点对应的基础颜色。
 * @returns {Float32Array} 可直接写进 node uniform buffer 的连续数据。
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
 * 复制一份 4x4 矩阵到目标 uniform 数据里。
 * @param {Float32Array} target 目标 uniform 数组。
 * @param {number} matrixIndex 当前矩阵在 joint array 中的索引。
 * @param {Float32Array} source 要复制进去的 4x4 矩阵。
 * @returns {void} 只负责把矩阵写进连续 float 数组。
 */
function writeMatrixIntoArray(
  target: Float32Array,
  matrixIndex: number,
  source: Float32Array
): void {
  target.set(source, matrixIndex * 16);
}

/**
 * 根据 mesh 节点和当前 joint 世界矩阵生成一份可直接上传的 skin uniform 数据。
 * @param {Float32Array} meshWorldMatrix 当前 skinned mesh 节点的世界矩阵。
 * @param {RuntimeSkinnedNode[]} nodes 当前帧所有运行时节点。
 * @param {LoadedGltfSkin} skin 当前 mesh 使用的 glTF skin。
 * @returns {Float32Array} 按 `jointMatrices[16]` 布局展开的连续数据。
 */
function createSkinUniformData(
  meshWorldMatrix: Float32Array,
  nodes: RuntimeSkinnedNode[],
  skin: LoadedGltfSkin
): Float32Array {
  const uniformData = new Float32Array(MAX_JOINTS * 16);
  const meshInverse = invertMatrix(meshWorldMatrix);

  for (let index = 0; index < MAX_JOINTS; index += 1) {
    writeMatrixIntoArray(uniformData, index, createIdentityMatrix());
  }

  skin.joints.forEach((jointNodeIndex, jointIndex) => {
    if (jointIndex >= MAX_JOINTS) {
      return;
    }

    const jointNode = nodes[jointNodeIndex];
    if (!jointNode) {
      return;
    }

    const inverseBindMatrix = skin.inverseBindMatrices.slice(
      jointIndex * 16,
      jointIndex * 16 + 16
    );
    const jointMatrix = multiplyMatrices(
      multiplyMatrices(meshInverse, jointNode.worldMatrix),
      inverseBindMatrix
    );
    writeMatrixIntoArray(uniformData, jointIndex, jointMatrix);
  });

  return uniformData;
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
 * @param {RuntimeSkinnedNode[]} nodes 运行时节点列表。
 * @param {LoadedGltfAnimationChannel} channel 当前动画通道。
 * @param {Vector3 | Quaternion} sampledValue 当前时间采样出来的结果。
 * @returns {void} 只负责更新目标节点当前帧的 TRS 状态。
 */
function applyAnimationValue(
  nodes: RuntimeSkinnedNode[],
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
 * 根据 clip 和当前时间更新所有运行时节点的动画状态。
 * @param {RuntimeSkinnedNode[]} nodes 运行时节点列表。
 * @param {LoadedGltfAnimationClip} clip 当前 lesson 使用的 glTF 动画片段。
 * @param {number} elapsed 已经过去的秒数。
 * @returns {void} 只负责更新节点当前帧的 TRS。
 */
function updateAnimationState(
  nodes: RuntimeSkinnedNode[],
  clip: LoadedGltfAnimationClip,
  elapsed: number
): void {
  nodes.forEach((node) => {
    node.translation = [...node.baseTranslation];
    node.rotation = [...node.baseRotation];
    node.scale = [...node.baseScale];
  });

  const animationTime =
    clip.duration > 0 ? elapsed % clip.duration : 0;

  clip.channels.forEach((channel) => {
    const sampledValue = sampleAnimationChannel(channel, animationTime);
    applyAnimationValue(nodes, channel, sampledValue);
  });
}

/**
 * 递归计算一棵 glTF 节点树的 world matrix。
 * @param {RuntimeSkinnedNode[]} nodes 当前运行时节点列表。
 * @param {number} nodeIndex 当前要更新的节点索引。
 * @param {Float32Array} parentWorldMatrix 父节点的世界矩阵。
 * @returns {void} 只负责把本节点及其子节点的世界矩阵更新到位。
 */
function updateWorldMatrix(
  nodes: RuntimeSkinnedNode[],
  nodeIndex: number,
  parentWorldMatrix: Float32Array
): void {
  const node = nodes[nodeIndex];
  if (!node) {
    return;
  }

  node.localMatrix = composeNodeMatrix(
    node.translation,
    node.rotation,
    node.scale
  );
  node.worldMatrix = multiplyMatrices(parentWorldMatrix, node.localMatrix);

  node.children.forEach((childNodeIndex) => {
    updateWorldMatrix(nodes, childNodeIndex, node.worldMatrix);
  });
}

/**
 * 让 lesson 26 的 skinned mesh 节点使用一套稳定的演示颜色。
 * @param {string} nodeName 当前 mesh 节点名称。
 * @returns {Vector3} 对应节点的基础颜色。
 */
function nodeColor(nodeName: string): Vector3 {
  switch (nodeName) {
    case "SkinnedArm":
      return [0.95, 0.63, 0.36];
    default:
      return [0.82, 0.74, 0.9];
  }
}

/**
 * 挂载第 26 课“glTF 骨骼动画基础”预览。
 * @param {HTMLElement} host 承载 lesson 预览的 DOM 容器。
 * @param {(status: StatusUpdate) => void} setStatus 用于把当前 lesson 的状态同步到工作台右上角。
 * @returns {Promise<(() => void) | void>} 返回一个清理函数，在切换 lesson 时释放监听、动画帧和 GPU 资源；如果挂载失败，则返回空结果。
 */
export async function mountGltfSkinningBasicLesson(
  host: HTMLElement,
  setStatus: (status: StatusUpdate) => void
) {
  host.innerHTML = `
    <div class="preview-viewport">
      <div class="preview-frame">
        <canvas class="preview-canvas" aria-label="glTF skinning basics lesson preview"></canvas>
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

    const gltfScene = await loadSkinnedGltfScene(skinnedGltfUrl, gpu.device, {
      "gltf-skin-basics.bin": skinnedGltfBinDataUri,
    });
    const clip = gltfScene.animations[0];
    if (!clip) {
      throw new Error("这一课需要至少一条 glTF 关节动画片段。");
    }

    const frameUniformBuffer = gpu.device.createBuffer({
      size: 20 * 4,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const pipeline = gpu.device.createRenderPipeline({
      label: "lesson-85-gltf-skinning-basic",
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
            arrayStride: 4 * 2,
            attributes: [
              {
                shaderLocation: 2,
                offset: 0,
                format: "uint16x4",
              },
            ],
          },
          {
            arrayStride: 4 * 4,
            attributes: [
              {
                shaderLocation: 3,
                offset: 0,
                format: "float32x4",
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

    const runtimeNodes: RuntimeSkinnedNode[] = gltfScene.nodes.map((node) => ({
      ...node,
      localMatrix: createIdentityMatrix(),
      worldMatrix: createIdentityMatrix(),
      translation: [...node.baseTranslation],
      rotation: [...node.baseRotation],
      scale: [...node.baseScale],
    }));

    const runtimeSkins: RuntimeSkin[] = gltfScene.skins.map((skin) => {
      const skinUniformBuffer = gpu.device.createBuffer({
        size: MAX_JOINTS * 16 * 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const skinBindGroup = gpu.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(2),
        entries: [
          {
            binding: 0,
            resource: {
              buffer: skinUniformBuffer,
            },
          },
        ],
      });

      return {
        ...skin,
        skinUniformBuffer,
        skinBindGroup,
      };
    });

    const renderables: RuntimeRenderable[] = runtimeNodes
      .map((node, nodeIndex) => {
        if (node.meshIndex === null) {
          return null;
        }

        const nodeUniformBuffer = gpu.device.createBuffer({
          size: 20 * 4,
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        const nodeBindGroup = gpu.device.createBindGroup({
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
          nodeIndex,
          skinIndex: node.skinIndex,
          primitives: gltfScene.meshes[node.meshIndex],
          nodeUniformBuffer,
          nodeBindGroup,
          baseColor: nodeColor(node.name),
        } satisfies RuntimeRenderable;
      })
      .filter((renderable): renderable is RuntimeRenderable => renderable !== null);

    const eye: Vector3 = [4.6, 3.4, 8.2];
    const target: Vector3 = [0, 1.35, 0];
    const orbitCamera = createOrbitCameraController(canvas, {
      target,
      eye,
      minRadius: 4.5,
      maxRadius: 14,
    });
    const lightDirection = normalizeVector([0.45, 0.95, 0.3]);

    /**
     * 确保当前画布尺寸对应的一张深度纹理已经存在。
     * @returns {GPUTextureView} 当前可直接挂到 render pass 上的深度纹理视图。
     */
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

    /**
     * 把当前帧的动画状态、joint matrices 和 draw 提交到 GPU。
     * @param {number} elapsed 从 lesson 开始到现在已经过去的秒数。
     * @returns {void} 只负责录制并提交这一帧的绘制命令。
     */
    const render = (elapsed: number) => {
      syncViewport();
      gpu.resize();
      const currentDepthView = ensureDepthTexture();

      const aspect = canvas.width / canvas.height;
      const camera = orbitCamera.getSnapshot();
      const viewMatrix = createLookAtViewMatrix(camera.eye, camera.target, camera.up);
      const projectionMatrix = createPerspectiveMatrix(
        (48 * Math.PI) / 180,
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
        updateWorldMatrix(runtimeNodes, rootNodeId, createIdentityMatrix());
      });

      renderables.forEach((renderable) => {
        const node = runtimeNodes[renderable.nodeIndex];
        gpu.device.queue.writeBuffer(
          renderable.nodeUniformBuffer,
          0,
          createNodeUniformData(node.worldMatrix, renderable.baseColor)
        );

        if (renderable.skinIndex !== null) {
          const skin = runtimeSkins[renderable.skinIndex];
          gpu.device.queue.writeBuffer(
            skin.skinUniformBuffer,
            0,
            createSkinUniformData(node.worldMatrix, runtimeNodes, skin)
          );
        }
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

      renderables.forEach((renderable) => {
        pass.setBindGroup(1, renderable.nodeBindGroup);
        if (renderable.skinIndex !== null) {
          pass.setBindGroup(2, runtimeSkins[renderable.skinIndex].skinBindGroup);
        }

        renderable.primitives.forEach((primitive) => {
          pass.setVertexBuffer(0, primitive.positionBuffer);
          pass.setVertexBuffer(1, primitive.normalBuffer);
          pass.setVertexBuffer(2, primitive.jointsBuffer);
          pass.setVertexBuffer(3, primitive.weightsBuffer);

          if (primitive.indexBuffer && primitive.indexFormat) {
            pass.setIndexBuffer(primitive.indexBuffer, primitive.indexFormat);
            pass.drawIndexed(primitive.indexCount);
          } else {
            pass.draw(primitive.vertexCount);
          }
        });
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
      title: "glTF 骨骼动画已运行",
      detail:
        "这一课开始真正接入 `skin`、`JOINTS_0`、`WEIGHTS_0` 和 `inverseBindMatrices`，让顶点跟着关节矩阵一起弯起来。",
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
