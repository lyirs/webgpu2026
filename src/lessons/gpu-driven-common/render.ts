import type {
  Color4,
} from "@/lessons/gpu-driven-common/scene";
import type { GpuDrivenMeshGeometry } from "@/lessons/gpu-driven-common/geometry";
import type { Vector3 } from "@/lessons/gpu-driven-common/math";

export type DepthTarget = {
  texture: GPUTexture | null;
  view: GPUTextureView | null;
  width: number;
  height: number;
};

export type GpuDrivenMeshBuffers = {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
};

/**
 * 把 viewProjection、主光方向和相机位置打包成统一的帧级 uniform 数据。
 * @param {Float32Array} viewProjectionMatrix 当前相机的 VP 矩阵。
 * @param {Vector3} lightDirection 世界空间主光方向。
 * @param {Vector3} eyePosition 当前相机位置。
 * @returns {Float32Array} 对应的 frame uniform。
 */
export function createFrameUniformData(
  viewProjectionMatrix: Float32Array,
  lightDirection: Vector3,
  eyePosition: Vector3
): Float32Array {
  const uniformData = new Float32Array(24);
  uniformData.set(viewProjectionMatrix, 0);
  uniformData.set(
    [lightDirection[0], lightDirection[1], lightDirection[2], 0],
    16
  );
  uniformData.set([eyePosition[0], eyePosition[1], eyePosition[2], 1], 20);
  return uniformData;
}

/**
 * 打包场景 draw 的统一颜色 tint、透明度和 flags 开关。
 * @param {Color4} tintColor 当前 draw 叠加的教学色。
 * @param {number} tintMix tint 与实例原色的混合系数。
 * @param {number} alpha 最终 alpha。
 * @param {number} useVisibility 1 表示读取 visibility flags，0 表示忽略 flags。
 * @returns {Float32Array} 对应的 draw uniform。
 */
export function createDrawUniformData(
  tintColor: Color4,
  tintMix: number,
  alpha: number,
  useVisibility: number
): Float32Array {
  return new Float32Array([
    tintColor[0],
    tintColor[1],
    tintColor[2],
    tintColor[3],
    tintMix,
    alpha,
    useVisibility,
    0,
  ]);
}

/**
 * 把一个通用 mesh 上传到 GPU，并返回对应的顶点/索引缓冲。
 * @param {GPUDevice} device 当前 lesson 的 GPUDevice。
 * @param {GpuDrivenMeshGeometry} geometry 要上传的几何。
 * @returns {GpuDrivenMeshBuffers} 对应的 GPU buffer 与 index 数量。
 */
export function createGpuDrivenMeshBuffers(
  device: GPUDevice,
  geometry: GpuDrivenMeshGeometry
): GpuDrivenMeshBuffers {
  const vertexBuffer = device.createBuffer({
    size: geometry.vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(geometry.vertexData);
  vertexBuffer.unmap();

  const indexBuffer = device.createBuffer({
    size: geometry.indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint16Array(indexBuffer.getMappedRange()).set(geometry.indexData);
  indexBuffer.unmap();

  return {
    vertexBuffer,
    indexBuffer,
    indexCount: geometry.indexCount,
  };
}

/**
 * 销毁旧的 depth target，并把引用清空。
 * @param {DepthTarget} target 当前维护的 depth target。
 * @returns {void} 只负责销毁旧纹理。
 */
export function destroyDepthTarget(target: DepthTarget): void {
  target.texture?.destroy();
  target.texture = null;
  target.view = null;
  target.width = 0;
  target.height = 0;
}

/**
 * 确保当前 lesson 拥有与 canvas 尺寸一致的 depth texture。
 * @param {GPUDevice} device 当前 GPUDevice。
 * @param {DepthTarget} target 当前维护的 depth target。
 * @param {number} width 当前画布像素宽度。
 * @param {number} height 当前画布像素高度。
 * @returns {void} 只在尺寸变化时重建 depth texture。
 */
export function ensureDepthTarget(
  device: GPUDevice,
  target: DepthTarget,
  width: number,
  height: number
): void {
  if (
    target.texture &&
    target.view &&
    target.width === width &&
    target.height === height
  ) {
    return;
  }

  destroyDepthTarget(target);

  target.texture = device.createTexture({
    size: [width, height, 1],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
  target.view = target.texture.createView();
  target.width = width;
  target.height = height;
}
