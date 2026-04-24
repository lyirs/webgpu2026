export type MeshGeometry = {
  vertexData: Float32Array;
  indexData: Uint16Array;
  indexCount: number;
};

export type MeshBuffers = {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
};

const BOX_FACE_VERTICES = [
  [-0.5, 0.5, 0.5, 0, 0, 1],
  [-0.5, -0.5, 0.5, 0, 0, 1],
  [0.5, -0.5, 0.5, 0, 0, 1],
  [0.5, 0.5, 0.5, 0, 0, 1],
  [0.5, 0.5, 0.5, 1, 0, 0],
  [0.5, -0.5, 0.5, 1, 0, 0],
  [0.5, -0.5, -0.5, 1, 0, 0],
  [0.5, 0.5, -0.5, 1, 0, 0],
  [0.5, 0.5, -0.5, 0, 0, -1],
  [0.5, -0.5, -0.5, 0, 0, -1],
  [-0.5, -0.5, -0.5, 0, 0, -1],
  [-0.5, 0.5, -0.5, 0, 0, -1],
  [-0.5, 0.5, -0.5, -1, 0, 0],
  [-0.5, -0.5, -0.5, -1, 0, 0],
  [-0.5, -0.5, 0.5, -1, 0, 0],
  [-0.5, 0.5, 0.5, -1, 0, 0],
  [-0.5, 0.5, -0.5, 0, 1, 0],
  [-0.5, 0.5, 0.5, 0, 1, 0],
  [0.5, 0.5, 0.5, 0, 1, 0],
  [0.5, 0.5, -0.5, 0, 1, 0],
  [-0.5, -0.5, 0.5, 0, -1, 0],
  [-0.5, -0.5, -0.5, 0, -1, 0],
  [0.5, -0.5, -0.5, 0, -1, 0],
  [0.5, -0.5, 0.5, 0, -1, 0],
] as const;

const BOX_INDICES = [
  0, 1, 2, 0, 2, 3,
  4, 5, 6, 4, 6, 7,
  8, 9, 10, 8, 10, 11,
  12, 13, 14, 12, 14, 15,
  16, 17, 18, 16, 18, 19,
  20, 21, 22, 20, 22, 23,
] as const;

/**
 * 创建一个带法线的立方体网格。
 * @returns {MeshGeometry} 对应的顶点和索引数据。
 */
export function createBoxGeometry(): MeshGeometry {
  const vertexData = new Float32Array(BOX_FACE_VERTICES.flat());
  const indexData = new Uint16Array(BOX_INDICES);

  return {
    vertexData,
    indexData,
    indexCount: indexData.length,
  };
}

/**
 * 创建一个位于 xz 平面的矩形平面网格。
 * @returns {MeshGeometry} 对应的顶点和索引数据。
 */
export function createPlaneGeometry(): MeshGeometry {
  const vertexData = new Float32Array([
    -0.5, 0, -0.5, 0, 1, 0,
    -0.5, 0, 0.5, 0, 1, 0,
    0.5, 0, 0.5, 0, 1, 0,
    0.5, 0, -0.5, 0, 1, 0,
  ]);
  const indexData = new Uint16Array([0, 1, 2, 0, 2, 3]);

  return {
    vertexData,
    indexData,
    indexCount: indexData.length,
  };
}

/**
 * 把一份静态 mesh 数据上传成 GPU 顶点 / 索引缓冲。
 * @param {GPUDevice} device 当前 GPUDevice。
 * @param {MeshGeometry} geometry 要上传的几何数据。
 * @returns {MeshBuffers} 对应的 GPU 缓冲对象。
 */
export function createMeshBuffers(
  device: GPUDevice,
  geometry: MeshGeometry
): MeshBuffers {
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

  return {
    vertexBuffer,
    indexBuffer,
    indexCount: geometry.indexCount,
  };
}
