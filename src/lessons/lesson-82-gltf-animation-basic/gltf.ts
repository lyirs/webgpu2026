import { type Quaternion, type Vector3 } from "@/lessons/lesson-82-gltf-animation-basic/math";

type GltfBufferJson = {
  uri?: string;
  byteLength: number;
};

type GltfBufferViewJson = {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
};

type GltfAccessorJson = {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  max?: number[];
  min?: number[];
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT4";
};

type GltfPrimitiveJson = {
  attributes: Record<string, number>;
  indices?: number;
  mode?: number;
};

type GltfMeshJson = {
  name?: string;
  primitives: GltfPrimitiveJson[];
};

type GltfNodeJson = {
  name?: string;
  mesh?: number;
  children?: number[];
  matrix?: number[];
  rotation?: number[];
  scale?: number[];
  translation?: number[];
};

type GltfSceneJson = {
  nodes?: number[];
};

type GltfAnimationSamplerJson = {
  input: number;
  output: number;
  interpolation?: "LINEAR" | "STEP" | "CUBICSPLINE";
};

type GltfAnimationChannelJson = {
  sampler: number;
  target: {
    node: number;
    path: "translation" | "rotation" | "scale";
  };
};

type GltfAnimationJson = {
  name?: string;
  samplers: GltfAnimationSamplerJson[];
  channels: GltfAnimationChannelJson[];
};

type GltfJson = {
  scene?: number;
  scenes?: GltfSceneJson[];
  nodes?: GltfNodeJson[];
  meshes?: GltfMeshJson[];
  accessors?: GltfAccessorJson[];
  bufferViews?: GltfBufferViewJson[];
  buffers?: GltfBufferJson[];
  animations?: GltfAnimationJson[];
};

export type AnimationPath = "translation" | "rotation" | "scale";

export type LoadedAnimatedGltfPrimitive = {
  positionBuffer: GPUBuffer;
  normalBuffer: GPUBuffer;
  indexBuffer: GPUBuffer | null;
  indexCount: number;
  indexFormat: GPUIndexFormat | null;
  vertexCount: number;
};

export type LoadedAnimatedGltfNode = {
  name: string;
  meshIndex: number | null;
  children: number[];
  baseTranslation: Vector3;
  baseRotation: Quaternion;
  baseScale: Vector3;
};

export type LoadedGltfAnimationChannel = {
  nodeIndex: number;
  path: AnimationPath;
  inputTimes: Float32Array;
  outputValues: Float32Array;
  interpolation: "LINEAR";
};

export type LoadedGltfAnimationClip = {
  name: string;
  duration: number;
  channels: LoadedGltfAnimationChannel[];
};

export type LoadedAnimatedGltfScene = {
  meshes: LoadedAnimatedGltfPrimitive[][];
  nodes: LoadedAnimatedGltfNode[];
  rootNodeIds: number[];
  animations: LoadedGltfAnimationClip[];
};

/**
 * 通过 data URI 或相对路径读取一个 glTF buffer。
 * @param {GltfBufferJson} buffer glTF 中声明的 buffer。
 * @param {URL} baseUrl 当前 `.gltf` 文件的解析基准 URL。
 * @returns {Promise<Uint8Array>} 对应 buffer 的原始字节数据。
 */
async function loadBufferBytes(
  buffer: GltfBufferJson,
  baseUrl: URL,
  bufferUriOverrides: Record<string, string> = {}
): Promise<Uint8Array> {
  if (!buffer.uri) {
    throw new Error("当前 lesson 只支持带 URI 的 glTF buffer。");
  }

  if (buffer.uri.startsWith("data:")) {
    const commaIndex = buffer.uri.indexOf(",");
    if (commaIndex === -1) {
      throw new Error("data URI buffer 格式不正确。");
    }

    const encoded = buffer.uri.slice(commaIndex + 1);
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  const bufferUrl = bufferUriOverrides[buffer.uri] ?? new URL(buffer.uri, baseUrl).toString();
  const response = await fetch(bufferUrl);
  if (!response.ok) {
    throw new Error(`buffer 读取失败：${buffer.uri}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < buffer.byteLength) {
    throw new Error(`buffer 字节数不足：${buffer.uri} 需要 ${buffer.byteLength}，实际 ${bytes.byteLength}。`);
  }
  return bytes;
}

/**
 * 返回一个 accessor type 对应的分量数量。
 * @param {GltfAccessorJson["type"]} type glTF accessor 的类型字符串。
 * @returns {number} 对应的分量数量。
 */
function accessorNumComponents(type: GltfAccessorJson["type"]): number {
  switch (type) {
    case "SCALAR":
      return 1;
    case "VEC2":
      return 2;
    case "VEC3":
      return 3;
    case "VEC4":
      return 4;
    case "MAT4":
      return 16;
    default:
      throw new Error(`当前 lesson 不支持 accessor type: ${type}`);
  }
}

/**
 * 返回一个 componentType 对应的单个分量字节数。
 * @param {number} componentType glTF accessor 的 componentType。
 * @returns {number} 每个标量占用的字节数。
 */
function componentTypeByteSize(componentType: number): number {
  switch (componentType) {
    case 5123:
      return 2;
    case 5125:
      return 4;
    case 5126:
      return 4;
    default:
      throw new Error(`当前 lesson 不支持 componentType: ${componentType}`);
  }
}

/**
 * 从 bufferView 和 accessor 读出一份 float32 数据。
 * @param {Uint8Array[]} buffers 已经加载好的 glTF buffers。
 * @param {GltfBufferViewJson[]} bufferViews glTF 中声明的 bufferView 列表。
 * @param {GltfAccessorJson} accessor 需要读取的 accessor。
 * @returns {Float32Array} 按 accessor 语义展开后的 float 数据。
 */
function readFloat32Accessor(
  buffers: Uint8Array[],
  bufferViews: GltfBufferViewJson[],
  accessor: GltfAccessorJson
): Float32Array {
  if (accessor.componentType !== 5126) {
    throw new Error("当前 lesson 只支持 float32 类型的 accessor。");
  }

  const view = bufferViews[accessor.bufferView];
  const source = buffers[view.buffer];
  const numComponents = accessorNumComponents(accessor.type);
  const scalarByteSize = componentTypeByteSize(accessor.componentType);
  const elementByteSize = numComponents * scalarByteSize;
  const stride = view.byteStride ?? elementByteSize;
  const accessorOffset = accessor.byteOffset ?? 0;
  const dataView = new DataView(
    source.buffer,
    source.byteOffset + (view.byteOffset ?? 0),
    view.byteLength
  );
  const values = new Float32Array(accessor.count * numComponents);

  for (let index = 0; index < accessor.count; index += 1) {
    const baseOffset = accessorOffset + index * stride;
    for (let component = 0; component < numComponents; component += 1) {
      values[index * numComponents + component] = dataView.getFloat32(
        baseOffset + component * scalarByteSize,
        true
      );
    }
  }

  return values;
}

/**
 * 从 bufferView 和 accessor 读出一份索引数据。
 * @param {Uint8Array[]} buffers 已经加载好的 glTF buffers。
 * @param {GltfBufferViewJson[]} bufferViews glTF 中声明的 bufferView 列表。
 * @param {GltfAccessorJson} accessor 需要读取的索引 accessor。
 * @returns {Uint16Array | Uint32Array} 展开的索引数组。
 */
function readIndexAccessor(
  buffers: Uint8Array[],
  bufferViews: GltfBufferViewJson[],
  accessor: GltfAccessorJson
): Uint16Array | Uint32Array {
  const view = bufferViews[accessor.bufferView];
  const source = buffers[view.buffer];
  const scalarByteSize = componentTypeByteSize(accessor.componentType);
  const stride = view.byteStride ?? scalarByteSize;
  const accessorOffset = accessor.byteOffset ?? 0;
  const dataView = new DataView(
    source.buffer,
    source.byteOffset + (view.byteOffset ?? 0),
    view.byteLength
  );

  if (accessor.componentType === 5123) {
    const values = new Uint16Array(accessor.count);
    for (let index = 0; index < accessor.count; index += 1) {
      values[index] = dataView.getUint16(accessorOffset + index * stride, true);
    }
    return values;
  }

  if (accessor.componentType === 5125) {
    const values = new Uint32Array(accessor.count);
    for (let index = 0; index < accessor.count; index += 1) {
      values[index] = dataView.getUint32(accessorOffset + index * stride, true);
    }
    return values;
  }

  throw new Error("当前 lesson 只支持 uint16 / uint32 类型的索引 accessor。");
}

/**
 * 从 TypedArray 创建一块 GPUBuffer。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {Float32Array | Uint16Array | Uint32Array} data 要上传的 CPU 侧数组。
 * @param {GPUBufferUsageFlags} usage 这块 GPUBuffer 的用途。
 * @returns {GPUBuffer} 已经写好数据的 GPUBuffer。
 */
function createGpuBuffer(
  device: GPUDevice,
  data: Float32Array | Uint16Array | Uint32Array,
  usage: GPUBufferUsageFlags
): GPUBuffer {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: usage | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

/**
 * 从 glTF 节点定义里读取基础 TRS。
 * @param {GltfNodeJson} node glTF 节点定义。
 * @returns {{ translation: Vector3; rotation: Quaternion; scale: Vector3 }} 节点的基础 TRS。
 */
function readNodeBaseTransform(node: GltfNodeJson): {
  translation: Vector3;
  rotation: Quaternion;
  scale: Vector3;
} {
  if (node.matrix) {
    throw new Error("当前 lesson 先只支持使用 translation / rotation / scale 的 glTF 节点。");
  }

  return {
    translation: (node.translation ?? [0, 0, 0]) as Vector3,
    rotation: (node.rotation ?? [0, 0, 0, 1]) as Quaternion,
    scale: (node.scale ?? [1, 1, 1]) as Vector3,
  };
}

/**
 * 读取一个最小可用的 glTF 动画场景：POSITION、NORMAL、indices、node TRS 和 animation sampler/channel。
 * @param {string} gltfUrl lesson 中要加载的 glTF 文件 URL。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @returns {Promise<LoadedAnimatedGltfScene>} 已上传到 GPU 的网格、节点和动画数据。
 */
export async function loadAnimatedGltfScene(
  gltfUrl: string,
  device: GPUDevice,
  bufferUriOverrides: Record<string, string> = {}
): Promise<LoadedAnimatedGltfScene> {
  const response = await fetch(gltfUrl);
  if (!response.ok) {
    throw new Error("glTF 文件读取失败。");
  }

  const json = (await response.json()) as GltfJson;
  const baseUrl = new URL(response.url);
  const accessors = json.accessors ?? [];
  const bufferViews = json.bufferViews ?? [];
  const buffers = await Promise.all(
    (json.buffers ?? []).map((buffer) => loadBufferBytes(buffer, baseUrl, bufferUriOverrides))
  );
  const meshes = json.meshes ?? [];
  const nodes = json.nodes ?? [];
  const sceneIndex = json.scene ?? 0;
  const rootNodeIds = json.scenes?.[sceneIndex]?.nodes ?? [0];

  const loadedMeshes = meshes.map((mesh, meshIndex) =>
    mesh.primitives.map((primitive, primitiveIndex) => {
      const positionAccessorIndex = primitive.attributes.POSITION;
      if (positionAccessorIndex === undefined) {
        throw new Error(`mesh ${meshIndex} primitive ${primitiveIndex} 缺少 POSITION accessor。`);
      }

      if (primitive.mode !== undefined && primitive.mode !== 4) {
        throw new Error("当前 lesson 只支持 TRIANGLES 模式的 glTF primitive。");
      }

      const positionAccessor = accessors[positionAccessorIndex];
      const positionData = readFloat32Accessor(
        buffers,
        bufferViews,
        positionAccessor
      );
      const normalAccessorIndex = primitive.attributes.NORMAL;
      const normalData =
        normalAccessorIndex !== undefined
          ? readFloat32Accessor(
              buffers,
              bufferViews,
              accessors[normalAccessorIndex]
            )
          : new Float32Array(positionAccessor.count * 3);

      const indexAccessorIndex = primitive.indices;
      const indexData =
        indexAccessorIndex !== undefined
          ? readIndexAccessor(buffers, bufferViews, accessors[indexAccessorIndex])
          : null;

      return {
        positionBuffer: createGpuBuffer(device, positionData, GPUBufferUsage.VERTEX),
        normalBuffer: createGpuBuffer(device, normalData, GPUBufferUsage.VERTEX),
        indexBuffer: indexData
          ? createGpuBuffer(device, indexData, GPUBufferUsage.INDEX)
          : null,
        indexCount: indexData?.length ?? 0,
        indexFormat:
          indexData instanceof Uint32Array
            ? "uint32"
            : indexData
              ? "uint16"
              : null,
        vertexCount: positionAccessor.count,
      } satisfies LoadedAnimatedGltfPrimitive;
    })
  );

  const loadedNodes = nodes.map((node, nodeIndex) => {
    const transform = readNodeBaseTransform(node);
    return {
      name: node.name ?? `node_${nodeIndex}`,
      meshIndex: node.mesh ?? null,
      children: node.children ?? [],
      baseTranslation: transform.translation,
      baseRotation: transform.rotation,
      baseScale: transform.scale,
    } satisfies LoadedAnimatedGltfNode;
  });

  const loadedAnimations = (json.animations ?? []).map((animation, animationIndex) => {
    const channels = animation.channels.map((channel, channelIndex) => {
      const sampler = animation.samplers[channel.sampler];
      if (!sampler) {
        throw new Error(`animation ${animationIndex} channel ${channelIndex} 引用了不存在的 sampler。`);
      }
      if (sampler.interpolation && sampler.interpolation !== "LINEAR") {
        throw new Error("当前 lesson 先只支持 LINEAR 插值。");
      }

      return {
        nodeIndex: channel.target.node,
        path: channel.target.path,
        inputTimes: readFloat32Accessor(buffers, bufferViews, accessors[sampler.input]),
        outputValues: readFloat32Accessor(buffers, bufferViews, accessors[sampler.output]),
        interpolation: "LINEAR",
      } satisfies LoadedGltfAnimationChannel;
    });

    const duration = channels.reduce((maxDuration, channel) => {
      const lastTime = channel.inputTimes[channel.inputTimes.length - 1] ?? 0;
      return Math.max(maxDuration, lastTime);
    }, 0);

    return {
      name: animation.name ?? `animation_${animationIndex}`,
      duration,
      channels,
    } satisfies LoadedGltfAnimationClip;
  });

  return {
    meshes: loadedMeshes,
    nodes: loadedNodes,
    rootNodeIds,
    animations: loadedAnimations,
  };
}
