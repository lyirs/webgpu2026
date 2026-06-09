import {
  composeNodeMatrix,
  createIdentityMatrix,
  multiplyMatrices,
  type Quaternion,
  type Vector3,
} from "@/lessons/lesson-77-gltf-basic/math";

type GlbAccessorJson = {
  bufferView: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  max?: number[];
  min?: number[];
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT4";
};

type GlbBufferViewJson = {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
};

type GlbPrimitiveJson = {
  attributes: Record<string, number>;
  indices?: number;
  mode?: number;
};

type GlbMeshJson = {
  name?: string;
  primitives: GlbPrimitiveJson[];
};

type GlbNodeJson = {
  name?: string;
  mesh?: number;
  children?: number[];
  matrix?: number[];
  rotation?: number[];
  scale?: number[];
  translation?: number[];
};

type GlbSceneJson = {
  nodes?: number[];
};

type GlbJson = {
  scene?: number;
  scenes?: GlbSceneJson[];
  nodes?: GlbNodeJson[];
  meshes?: GlbMeshJson[];
  accessors?: GlbAccessorJson[];
  bufferViews?: GlbBufferViewJson[];
};

export type LoadedGlbPrimitive = {
  positionBuffer: GPUBuffer;
  normalBuffer: GPUBuffer;
  indexBuffer: GPUBuffer | null;
  indexCount: number;
  indexFormat: GPUIndexFormat | null;
  vertexCount: number;
};

export type LoadedGlbDrawable = {
  name: string;
  baseWorldMatrix: Float32Array;
  primitives: LoadedGlbPrimitive[];
};

export type LoadedGlbScene = {
  drawables: LoadedGlbDrawable[];
  bounds: {
    min: Vector3;
    max: Vector3;
  };
};

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

/**
 * 从一个 GLB 文件里读取 JSON chunk 和 BIN chunk。
 * @param {ArrayBuffer} fileBuffer 通过 `fetch(...).arrayBuffer()` 拿到的原始 GLB 文件内容。
 * @returns {{ json: GlbJson; binaryChunk: Uint8Array }} 解析后的 glTF JSON 和二进制数据块。
 */
function parseGlbFile(fileBuffer: ArrayBuffer): {
  json: GlbJson;
  binaryChunk: Uint8Array;
} {
  const dataView = new DataView(fileBuffer);

  if (dataView.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error("这不是一个有效的 GLB 文件。");
  }

  if (dataView.getUint32(4, true) !== GLB_VERSION) {
    throw new Error("当前 lesson 只支持 glTF 2.0 的 GLB 文件。");
  }

  const jsonChunkLength = dataView.getUint32(12, true);
  const jsonChunkType = dataView.getUint32(16, true);
  if (jsonChunkType !== JSON_CHUNK_TYPE) {
    throw new Error("GLB 的第一个 chunk 不是 JSON。");
  }

  const jsonOffset = 20;
  const jsonText = new TextDecoder("utf-8").decode(
    new Uint8Array(fileBuffer, jsonOffset, jsonChunkLength)
  );
  const json = JSON.parse(jsonText) as GlbJson;

  const binHeaderOffset = jsonOffset + jsonChunkLength;
  const binaryChunkLength = dataView.getUint32(binHeaderOffset, true);
  const binaryChunkType = dataView.getUint32(binHeaderOffset + 4, true);
  if (binaryChunkType !== BIN_CHUNK_TYPE) {
    throw new Error("GLB 的第二个 chunk 不是二进制数据块。");
  }

  return {
    json,
    binaryChunk: new Uint8Array(fileBuffer, binHeaderOffset + 8, binaryChunkLength),
  };
}

/**
 * 返回一个 accessor type 对应的分量数量。
 * @param {GlbAccessorJson["type"]} type glTF accessor 的类型字符串。
 * @returns {number} 对应的分量数量。
 */
function accessorNumComponents(type: GlbAccessorJson["type"]): number {
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
 * 把一个 float accessor 读成紧凑的 Float32Array。
 * @param {Uint8Array} binaryChunk GLB 的 BIN chunk 数据。
 * @param {GlbBufferViewJson[]} bufferViews glTF 中声明的 bufferView 列表。
 * @param {GlbAccessorJson} accessor 需要读取的 accessor。
 * @returns {Float32Array} 已按 accessor 语义展开好的 float 数据。
 */
function readFloat32Accessor(
  binaryChunk: Uint8Array,
  bufferViews: GlbBufferViewJson[],
  accessor: GlbAccessorJson
): Float32Array {
  if (accessor.componentType !== 5126) {
    throw new Error("当前 lesson 只支持 float32 类型的 POSITION / NORMAL accessor。");
  }

  const view = bufferViews[accessor.bufferView];
  const numComponents = accessorNumComponents(accessor.type);
  const scalarByteSize = componentTypeByteSize(accessor.componentType);
  const elementByteSize = numComponents * scalarByteSize;
  const stride = view.byteStride ?? elementByteSize;
  const accessorOffset = accessor.byteOffset ?? 0;
  const dataView = new DataView(
    binaryChunk.buffer,
    binaryChunk.byteOffset + (view.byteOffset ?? 0),
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
 * 把一个索引 accessor 读成 GPU 能直接使用的 Uint16Array / Uint32Array。
 * @param {Uint8Array} binaryChunk GLB 的 BIN chunk 数据。
 * @param {GlbBufferViewJson[]} bufferViews glTF 中声明的 bufferView 列表。
 * @param {GlbAccessorJson} accessor 需要读取的索引 accessor。
 * @returns {Uint16Array | Uint32Array} 展开的索引数组。
 */
function readIndexAccessor(
  binaryChunk: Uint8Array,
  bufferViews: GlbBufferViewJson[],
  accessor: GlbAccessorJson
): Uint16Array | Uint32Array {
  const view = bufferViews[accessor.bufferView];
  const scalarByteSize = componentTypeByteSize(accessor.componentType);
  const stride = view.byteStride ?? scalarByteSize;
  const accessorOffset = accessor.byteOffset ?? 0;
  const dataView = new DataView(
    binaryChunk.buffer,
    binaryChunk.byteOffset + (view.byteOffset ?? 0),
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
 * 从一个 glTF 节点定义里读取本地矩阵。
 * @param {GlbNodeJson} node glTF 节点定义。
 * @returns {Float32Array} 对应的本地变换矩阵。
 */
function readNodeLocalMatrix(node: GlbNodeJson): Float32Array {
  if (node.matrix) {
    return new Float32Array(node.matrix);
  }

  const translation = (node.translation ?? [0, 0, 0]) as Vector3;
  const rotation = (node.rotation ?? [0, 0, 0, 1]) as Quaternion;
  const scale = (node.scale ?? [1, 1, 1]) as Vector3;
  return composeNodeMatrix(translation, rotation, scale);
}

/**
 * 深度优先遍历 glTF 节点树，并把真正可绘制的 mesh 节点展开成 drawable 列表。
 * @param {GlbNodeJson[]} nodes glTF 里的节点列表。
 * @param {number[]} rootNodeIds 当前场景的根节点索引。
 * @param {LoadedGlbPrimitive[][]} meshPrimitives 已经上传到 GPU 的 mesh / primitive 数据。
 * @returns {LoadedGlbDrawable[]} 展开的可绘制对象列表。
 */
function flattenSceneDrawables(
  nodes: GlbNodeJson[],
  rootNodeIds: number[],
  meshPrimitives: LoadedGlbPrimitive[][]
): LoadedGlbDrawable[] {
  const drawables: LoadedGlbDrawable[] = [];

  const visit = (nodeId: number, parentWorldMatrix: Float32Array) => {
    const node = nodes[nodeId];
    const localMatrix = readNodeLocalMatrix(node);
    const worldMatrix = multiplyMatrices(parentWorldMatrix, localMatrix);

    if (node.mesh !== undefined) {
      drawables.push({
        name: node.name ?? `node_${nodeId}`,
        baseWorldMatrix: worldMatrix,
        primitives: meshPrimitives[node.mesh],
      });
    }

    (node.children ?? []).forEach((childId) => {
      visit(childId, worldMatrix);
    });
  };

  rootNodeIds.forEach((rootNodeId) => {
    visit(rootNodeId, createIdentityMatrix());
  });

  return drawables;
}

/**
 * 读取一个最小可用的 GLB 场景：只解析 POSITION、NORMAL、indices 和 node transform。
 * @param {string} glbUrl lesson 中要加载的 GLB 文件 URL。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @returns {Promise<LoadedGlbScene>} 已上传到 GPU 的可绘制场景数据。
 */
export async function loadGlbScene(
  glbUrl: string,
  device: GPUDevice
): Promise<LoadedGlbScene> {
  /**
   * fetch
   * 通过 URL 读取外部 GLB 文件的原始字节内容。
   * @param {RequestInfo | URL} input 当前 lesson 里就是 GLB 资源 URL。
   * @returns {Promise<Response>} 对应的网络响应对象。
   */
  const response = await fetch(glbUrl);
  if (!response.ok) {
    throw new Error("GLB 文件读取失败。");
  }

  /**
   * response.arrayBuffer
   * 把二进制响应体读成可继续解析的 ArrayBuffer。
   * @returns {Promise<ArrayBuffer>} GLB 文件完整的字节数据。
   */
  const glbBuffer = await response.arrayBuffer();
  const { json, binaryChunk } = parseGlbFile(glbBuffer);

  const accessors = json.accessors ?? [];
  const bufferViews = json.bufferViews ?? [];
  const meshes = json.meshes ?? [];
  const nodes = json.nodes ?? [];
  const sceneIndex = json.scene ?? 0;
  const rootNodeIds = json.scenes?.[sceneIndex]?.nodes ?? [0];

  let globalMin: Vector3 = [Infinity, Infinity, Infinity];
  let globalMax: Vector3 = [-Infinity, -Infinity, -Infinity];

  const meshPrimitives = meshes.map((mesh, meshIndex) =>
    mesh.primitives.map((primitive, primitiveIndex) => {
      const positionAccessorIndex = primitive.attributes.POSITION;
      if (positionAccessorIndex === undefined) {
        throw new Error(`mesh ${meshIndex} primitive ${primitiveIndex} 缺少 POSITION accessor。`);
      }

      const positionAccessor = accessors[positionAccessorIndex];
      const positionData = readFloat32Accessor(
        binaryChunk,
        bufferViews,
        positionAccessor
      );

      if (positionAccessor.min && positionAccessor.max) {
        globalMin = [
          Math.min(globalMin[0], positionAccessor.min[0]),
          Math.min(globalMin[1], positionAccessor.min[1]),
          Math.min(globalMin[2], positionAccessor.min[2]),
        ];
        globalMax = [
          Math.max(globalMax[0], positionAccessor.max[0]),
          Math.max(globalMax[1], positionAccessor.max[1]),
          Math.max(globalMax[2], positionAccessor.max[2]),
        ];
      }

      const normalAccessorIndex = primitive.attributes.NORMAL;
      const normalData =
        normalAccessorIndex !== undefined
          ? readFloat32Accessor(
              binaryChunk,
              bufferViews,
              accessors[normalAccessorIndex]
            )
          : new Float32Array(positionAccessor.count * 3);

      const indexAccessorIndex = primitive.indices;
      const indexData =
        indexAccessorIndex !== undefined
          ? readIndexAccessor(binaryChunk, bufferViews, accessors[indexAccessorIndex])
          : null;

      if (primitive.mode !== undefined && primitive.mode !== 4) {
        throw new Error("当前 lesson 只支持 TRIANGLES 模式的 glTF primitive。");
      }

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
      } satisfies LoadedGlbPrimitive;
    })
  );

  return {
    drawables: flattenSceneDrawables(nodes, rootNodeIds, meshPrimitives),
    bounds: {
      min: globalMin,
      max: globalMax,
    },
  };
}
