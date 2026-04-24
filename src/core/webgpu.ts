export type WebGpuCanvas = {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  resize: () => void;
};

/**
 * 创建并初始化一个可用于 WebGPU 渲染的画布运行时对象。
 * @param {HTMLCanvasElement} canvas 要绑定 WebGPU 上下文的画布元素。
 * @returns {Promise<WebGpuCanvas>} 包含 device、context、format 与 resize 方法的运行时对象。
 * @throws {Error} 当浏览器不支持 WebGPU，或无法获取 adapter、device、context 时抛出异常。
 */
export async function createWebGpuCanvas(
  canvas: HTMLCanvasElement
): Promise<WebGpuCanvas> {
  if (!("gpu" in navigator)) {
    throw new Error("当前浏览器没有提供 WebGPU。");
  }

  /**
   * requestAdapter
   * @returns {Promise<GPUAdapter | null>} 当前浏览器可提供的 GPU 适配器；如果浏览器没有找到可用适配器，则返回 null。
   */
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("没有拿到可用的 GPUAdapter。");
  }

  /**
   * requestDevice
   * @param {GPUDeviceDescriptor | undefined} [descriptor] 可选的 device 描述对象；这一课直接使用默认配置，不额外传入参数。
   * @returns {Promise<GPUDevice>} 后续真正负责创建资源、编码命令与提交队列的 GPUDevice。
   */
  const device = await adapter.requestDevice();
  /**
   * getContext("webgpu")
   * @param {"webgpu"} contextId 要申请的上下文类型；WebGPU 固定传入 "webgpu"。
   * @returns {GPUCanvasContext | null} 绑定到当前 canvas 的 WebGPU 绘图上下文；如果当前环境不支持，则返回 null。
   */
  const context = canvas.getContext("webgpu");

  if (!context) {
    throw new Error("没有拿到 WebGPUCanvasContext。");
  }

  /**
   * getPreferredCanvasFormat
   * @returns {GPUTextureFormat} 当前浏览器推荐的画布颜色格式，通常会被作为渲染目标纹理的格式。
   */
  const format = navigator.gpu.getPreferredCanvasFormat();

  /**
   * 让 canvas 的像素尺寸和实际显示尺寸保持一致，并重新配置上下文。
   * @returns {void} 只负责同步像素尺寸与 context 配置，不返回额外结果。
   */
  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    /**
     * configure
     * @param {GPUCanvasConfiguration} configuration 画布上下文配置对象；这里会把 device、format 与 alphaMode 绑定到当前 context。
     * @returns {void} 只更新 context 配置，不返回额外结果。
     */
    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
  };

  resize();

  return {
    device,
    context,
    format,
    resize,
  };
}
