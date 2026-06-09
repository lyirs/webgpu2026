import {
  composeNodeMatrix,
  createIdentityMatrix,
  multiplyMatrices,
  type Quaternion,
  type Vector3,
} from "@/lessons/lesson-78-gltf-textures/math";

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

type GlbTextureInfoJson = {
  index: number;
};

type GlbPrimitiveJson = {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
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

type GlbImageJson = {
  bufferView?: number;
  mimeType?: string;
};

type GlbTextureJson = {
  sampler?: number;
  source?: number;
};

type GlbSamplerJson = {
  magFilter?: number;
  minFilter?: number;
  wrapS?: number;
  wrapT?: number;
};

type GlbMaterialJson = {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorTexture?: GlbTextureInfoJson;
    baseColorFactor?: number[];
  };
};

type GlbJson = {
  scene?: number;
  scenes?: GlbSceneJson[];
  nodes?: GlbNodeJson[];
  meshes?: GlbMeshJson[];
  accessors?: GlbAccessorJson[];
  bufferViews?: GlbBufferViewJson[];
  images?: GlbImageJson[];
  textures?: GlbTextureJson[];
  samplers?: GlbSamplerJson[];
  materials?: GlbMaterialJson[];
};

export type LoadedGlbMaterial = {
  baseColorTexture: GPUTexture;
  baseColorTextureView: GPUTextureView;
  baseColorSampler: GPUSampler;
};

export type LoadedTexturedGlbPrimitive = {
  positionBuffer: GPUBuffer;
  normalBuffer: GPUBuffer;
  uvBuffer: GPUBuffer;
  indexBuffer: GPUBuffer | null;
  indexCount: number;
  indexFormat: GPUIndexFormat | null;
  vertexCount: number;
  material: LoadedGlbMaterial;
};

export type LoadedTexturedGlbDrawable = {
  name: string;
  baseWorldMatrix: Float32Array;
  primitives: LoadedTexturedGlbPrimitive[];
};

export type LoadedTexturedGlbScene = {
  drawables: LoadedTexturedGlbDrawable[];
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
    throw new Error("当前 lesson 只支持 float32 类型的 POSITION / NORMAL / TEXCOORD_0 accessor。");
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
 * 从 GLB 的某个 bufferView 里切出原始字节数据。
 * @param {Uint8Array} binaryChunk GLB 的 BIN chunk 数据。
 * @param {GlbBufferViewJson[]} bufferViews glTF 中声明的 bufferView 列表。
 * @param {number} bufferViewIndex 当前要读取的 bufferView 索引。
 * @returns {Uint8Array} 对应 bufferView 的原始字节内容。
 */
function readBufferViewBytes(
  binaryChunk: Uint8Array,
  bufferViews: GlbBufferViewJson[],
  bufferViewIndex: number
): Uint8Array {
  const view = bufferViews[bufferViewIndex];
  return new Uint8Array(
    binaryChunk.buffer,
    binaryChunk.byteOffset + (view.byteOffset ?? 0),
    view.byteLength
  );
}

/**
 * 把 glTF sampler 的 filter 常量映射成 WebGPU 的采样过滤模式。
 * @param {number | undefined} filter glTF sampler 上的过滤常量。
 * @returns {GPUFilterMode} 对应的 WebGPU 过滤模式。
 */
function samplerFilterMode(filter: number | undefined): GPUFilterMode {
  if (filter === 9728 || filter === 9984 || filter === 9986) {
    return "nearest";
  }

  return "linear";
}

/**
 * 把 glTF sampler 的 minFilter 映射成 WebGPU 的 mipmap 过滤模式。
 * @param {number | undefined} filter glTF sampler 上的 minFilter。
 * @returns {GPUMipmapFilterMode} 对应的 mipmap 过滤模式。
 */
function samplerMipmapFilterMode(
  filter: number | undefined
): GPUMipmapFilterMode {
  if (filter === 9984 || filter === 9985) {
    return "nearest";
  }

  return "linear";
}

/**
 * 把 glTF 的 wrap 常量映射成 WebGPU 的地址模式。
 * @param {number | undefined} wrap glTF sampler 上的 wrapS / wrapT。
 * @returns {GPUAddressMode} 对应的地址模式。
 */
function samplerAddressMode(wrap: number | undefined): GPUAddressMode {
  if (wrap === 33071) {
    return "clamp-to-edge";
  }

  if (wrap === 33648) {
    return "mirror-repeat";
  }

  return "repeat";
}

/**
 * 把 glTF sampler 定义转换成一只 WebGPU sampler。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {GlbSamplerJson | undefined} sampler glTF sampler 定义。
 * @returns {GPUSampler} 对应的采样器对象。
 */
function createSamplerFromGlb(
  device: GPUDevice,
  sampler: GlbSamplerJson | undefined
): GPUSampler {
  return device.createSampler({
    magFilter: samplerFilterMode(sampler?.magFilter),
    minFilter: samplerFilterMode(sampler?.minFilter),
    mipmapFilter: samplerMipmapFilterMode(sampler?.minFilter),
    addressModeU: samplerAddressMode(sampler?.wrapS),
    addressModeV: samplerAddressMode(sampler?.wrapT),
  });
}

/**
 * 创建一张 1x1 的白色纹理，给没有贴图的 primitive 当默认材质使用。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @returns {{ texture: GPUTexture; view: GPUTextureView }} 默认白纹理及其视图。
 */
function createDefaultWhiteTexture(
  device: GPUDevice
): { texture: GPUTexture; view: GPUTextureView } {
  const texture = device.createTexture({
    size: [1, 1],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  /**
   * queue.writeTexture
   * 直接把一小段 CPU 侧 RGBA 像素写进 GPUTexture。
   * @param {GPUTexelCopyTextureInfo} destination 目标纹理描述，这里就是 1x1 白纹理。
   * @param {AllowSharedBufferSource} data 要写进去的像素数据。
   * @param {GPUTexelCopyBufferLayout} dataLayout 像素布局描述，这里一行只有 4 个字节。
   * @param {GPUExtent3DStrict} size 要写入的纹理范围。
   * @returns {void} 只负责把像素写进纹理，不返回额外结果。
   */
  device.queue.writeTexture(
    { texture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1, depthOrArrayLayers: 1 }
  );

  return {
    texture,
    view: texture.createView(),
  };
}

/**
 * 把 GLB 中嵌入的一张图片解码并上传成 GPUTexture。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @param {Uint8Array} binaryChunk GLB 的 BIN chunk 数据。
 * @param {GlbBufferViewJson[]} bufferViews glTF 中声明的 bufferView 列表。
 * @param {GlbImageJson} image glTF image 定义。
 * @returns {Promise<{ texture: GPUTexture; view: GPUTextureView }>} 已上传完成的 GPUTexture 及其视图。
 */
async function createTextureFromGlbImage(
  device: GPUDevice,
  binaryChunk: Uint8Array,
  bufferViews: GlbBufferViewJson[],
  image: GlbImageJson
): Promise<{ texture: GPUTexture; view: GPUTextureView }> {
  if (image.bufferView === undefined || !image.mimeType) {
    throw new Error("当前 lesson 只支持把嵌在 GLB 里的图片作为纹理来源。");
  }

  const imageBytes = readBufferViewBytes(binaryChunk, bufferViews, image.bufferView);
  const imageCopy = new Uint8Array(imageBytes.byteLength);
  imageCopy.set(imageBytes);
  const imageBlob = new Blob([imageCopy], { type: image.mimeType });

  /**
   * createImageBitmap
   * 把 GLB 里取出的图片字节解码成浏览器可直接上传的 ImageBitmap。
   * @param {ImageBitmapSource} image 当前 lesson 里就是一个图片 Blob。
   * @returns {Promise<ImageBitmap>} 解码后的位图对象。
   */
  const bitmap = await createImageBitmap(imageBlob);
  const texture = device.createTexture({
    size: [bitmap.width, bitmap.height],
    format: "rgba8unorm",
    usage:
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  /**
   * queue.copyExternalImageToTexture
   * 把解码后的外部图片像素真正复制到 GPUTexture 里，让 shader 后面可以按 UV 采样。
   * @param {GPUCopyExternalImageSourceInfo} source 外部图片源；这里就是解码后的 ImageBitmap。
   * @param {GPUCopyExternalImageDestInfo} destination 目标纹理描述；这里把图片复制到新建的 GPUTexture。
   * @param {GPUExtent3DStrict} copySize 要复制的宽高尺寸；这里等于图片本身的像素尺寸。
   * @returns {void} 只负责把图片像素写进 GPUTexture，不返回额外结果。
   */
  device.queue.copyExternalImageToTexture(
    { source: bitmap },
    { texture },
    [bitmap.width, bitmap.height]
  );
  bitmap.close();

  return {
    texture,
    view: texture.createView(),
  };
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
 * @param {LoadedTexturedGlbPrimitive[][]} meshPrimitives 已经上传到 GPU 的 mesh / primitive 数据。
 * @returns {LoadedTexturedGlbDrawable[]} 展开的可绘制对象列表。
 */
function flattenSceneDrawables(
  nodes: GlbNodeJson[],
  rootNodeIds: number[],
  meshPrimitives: LoadedTexturedGlbPrimitive[][]
): LoadedTexturedGlbDrawable[] {
  const drawables: LoadedTexturedGlbDrawable[] = [];

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
 * 读取一个最小可用的带贴图 GLB 场景：在 lesson 17 的基础上继续解析 TEXCOORD_0、images、textures、samplers 和 baseColorTexture。
 * @param {string} glbUrl lesson 中要加载的 GLB 文件 URL。
 * @param {GPUDevice} device 当前 lesson 使用的 GPUDevice。
 * @returns {Promise<LoadedTexturedGlbScene>} 已上传到 GPU 的可绘制场景数据。
 */
export async function loadTexturedGlbScene(
  glbUrl: string,
  device: GPUDevice
): Promise<LoadedTexturedGlbScene> {
  const response = await fetch(glbUrl);
  if (!response.ok) {
    throw new Error("GLB 文件读取失败。");
  }

  const glbBuffer = await response.arrayBuffer();
  const { json, binaryChunk } = parseGlbFile(glbBuffer);

  const accessors = json.accessors ?? [];
  const bufferViews = json.bufferViews ?? [];
  const meshes = json.meshes ?? [];
  const nodes = json.nodes ?? [];
  const sceneIndex = json.scene ?? 0;
  const rootNodeIds = json.scenes?.[sceneIndex]?.nodes ?? [0];
  const samplers = json.samplers ?? [];
  const textures = json.textures ?? [];
  const images = json.images ?? [];
  const materials = json.materials ?? [];

  let globalMin: Vector3 = [Infinity, Infinity, Infinity];
  let globalMax: Vector3 = [-Infinity, -Infinity, -Infinity];

  const defaultSampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
  const defaultWhite = createDefaultWhiteTexture(device);
  const loadedSamplers = samplers.map((sampler) =>
    createSamplerFromGlb(device, sampler)
  );
  const loadedImages = await Promise.all(
    images.map((image) =>
      createTextureFromGlbImage(device, binaryChunk, bufferViews, image)
    )
  );

  const defaultMaterial: LoadedGlbMaterial = {
    baseColorTexture: defaultWhite.texture,
    baseColorTextureView: defaultWhite.view,
    baseColorSampler: defaultSampler,
  };

  const loadedMaterials = materials.map((material) => {
    const baseColorTextureIndex =
      material.pbrMetallicRoughness?.baseColorTexture?.index;
    const glbTexture =
      baseColorTextureIndex !== undefined
        ? textures[baseColorTextureIndex]
        : undefined;
    const imageSourceIndex = glbTexture?.source;
    const samplerIndex = glbTexture?.sampler;
    const imageTexture =
      imageSourceIndex !== undefined ? loadedImages[imageSourceIndex] : undefined;

    return {
      baseColorTexture: imageTexture?.texture ?? defaultWhite.texture,
      baseColorTextureView: imageTexture?.view ?? defaultWhite.view,
      baseColorSampler:
        samplerIndex !== undefined
          ? (loadedSamplers[samplerIndex] ?? defaultSampler)
          : defaultSampler,
    } satisfies LoadedGlbMaterial;
  });

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

      const uvAccessorIndex = primitive.attributes.TEXCOORD_0;
      const uvData =
        uvAccessorIndex !== undefined
          ? readFloat32Accessor(binaryChunk, bufferViews, accessors[uvAccessorIndex])
          : new Float32Array(positionAccessor.count * 2);

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
        uvBuffer: createGpuBuffer(device, uvData, GPUBufferUsage.VERTEX),
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
        material:
          primitive.material !== undefined
            ? (loadedMaterials[primitive.material] ?? defaultMaterial)
            : defaultMaterial,
      } satisfies LoadedTexturedGlbPrimitive;
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
