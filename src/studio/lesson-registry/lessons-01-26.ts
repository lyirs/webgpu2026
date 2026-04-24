import type { LessonDefinition } from "@/studio/types";
import { pickCoreSourceSegments } from "@/studio/lesson-segments";
import lessonRuntimeSource from "@/lessons/lesson-01-triangle/lesson.ts?raw";
import webgpuSource from "@/core/webgpu.ts?raw";
import shaderSource from "@/lessons/lesson-01-triangle/triangle.wgsl?raw";
import { mountTriangleLesson } from "@/lessons/lesson-01-triangle/lesson";
import vertexBufferLessonRuntimeSource from "@/lessons/lesson-02-vertex-buffers/lesson.ts?raw";
import vertexBufferShaderSource from "@/lessons/lesson-02-vertex-buffers/triangle.wgsl?raw";
import { mountVertexBufferLesson } from "@/lessons/lesson-02-vertex-buffers/lesson";
import uniformLessonRuntimeSource from "@/lessons/lesson-03-uniforms/lesson.ts?raw";
import uniformShaderSource from "@/lessons/lesson-03-uniforms/triangle.wgsl?raw";
import { mountUniformLesson } from "@/lessons/lesson-03-uniforms/lesson";
import cubeDepthLessonRuntimeSource from "@/lessons/lesson-04-cube-depth/lesson.ts?raw";
import cubeDepthMathSource from "@/lessons/lesson-04-cube-depth/math.ts?raw";
import cubeDepthDataSource from "@/lessons/lesson-04-cube-depth/cube-data.ts?raw";
import cubeDepthShaderSource from "@/lessons/lesson-04-cube-depth/cube.wgsl?raw";
import { mountCubeDepthLesson } from "@/lessons/lesson-04-cube-depth/lesson";
import textureLessonRuntimeSource from "@/lessons/lesson-05-textures/lesson.ts?raw";
import textureShaderSource from "@/lessons/lesson-05-textures/texture.wgsl?raw";
import { mountTextureLesson } from "@/lessons/lesson-05-textures/lesson";
import texturedCubeDataSource from "@/lessons/lesson-06-textured-cube/cube-data.ts?raw";
import texturedCubeFragmentShaderSource from "@/lessons/lesson-06-textured-cube/cube.frag.wgsl?raw";
import texturedCubeLessonRuntimeSource from "@/lessons/lesson-06-textured-cube/lesson.ts?raw";
import texturedCubeVertexShaderSource from "@/lessons/lesson-06-textured-cube/cube.vert.wgsl?raw";
import { mountTexturedCubeLesson } from "@/lessons/lesson-06-textured-cube/lesson";
import lightingCubeDataSource from "@/lessons/lesson-07-lighting/cube-data.ts?raw";
import lightingCubeFragmentShaderSource from "@/lessons/lesson-07-lighting/cube.frag.wgsl?raw";
import lightingLessonRuntimeSource from "@/lessons/lesson-07-lighting/lesson.ts?raw";
import lightingCubeVertexShaderSource from "@/lessons/lesson-07-lighting/cube.vert.wgsl?raw";
import { mountLightingLesson } from "@/lessons/lesson-07-lighting/lesson";
import pointLightsCubeDataSource from "@/lessons/lesson-08-point-lights/cube-data.ts?raw";
import pointLightsFragmentShaderSource from "@/lessons/lesson-08-point-lights/point-light.frag.wgsl?raw";
import pointLightsLessonRuntimeSource from "@/lessons/lesson-08-point-lights/lesson.ts?raw";
import pointLightsMathSource from "@/lessons/lesson-08-point-lights/math.ts?raw";
import pointLightsVertexShaderSource from "@/lessons/lesson-08-point-lights/point-light.vert.wgsl?raw";
import { mountPointLightsLesson } from "@/lessons/lesson-08-point-lights/lesson";
import spotLightCubeDataSource from "@/lessons/lesson-09-spot-light/cube-data.ts?raw";
import spotLightFragmentShaderSource from "@/lessons/lesson-09-spot-light/spot-light.frag.wgsl?raw";
import spotLightLessonRuntimeSource from "@/lessons/lesson-09-spot-light/lesson.ts?raw";
import spotLightMathSource from "@/lessons/lesson-09-spot-light/math.ts?raw";
import spotLightVertexShaderSource from "@/lessons/lesson-09-spot-light/spot-light.vert.wgsl?raw";
import { mountSpotLightLesson } from "@/lessons/lesson-09-spot-light/lesson";
import cameraCubeDataSource from "@/lessons/lesson-10-camera-controls/cube-data.ts?raw";
import cameraCubeFragmentShaderSource from "@/lessons/lesson-10-camera-controls/cube.frag.wgsl?raw";
import cameraLessonRuntimeSource from "@/lessons/lesson-10-camera-controls/lesson.ts?raw";
import cameraMathSource from "@/lessons/lesson-10-camera-controls/math.ts?raw";
import cameraCubeVertexShaderSource from "@/lessons/lesson-10-camera-controls/cube.vert.wgsl?raw";
import { mountCameraControlsLesson } from "@/lessons/lesson-10-camera-controls/lesson";
import freeOrbitCubeDataSource from "@/lessons/lesson-11-free-orbit-camera/cube-data.ts?raw";
import freeOrbitCubeFragmentShaderSource from "@/lessons/lesson-11-free-orbit-camera/cube.frag.wgsl?raw";
import freeOrbitLessonRuntimeSource from "@/lessons/lesson-11-free-orbit-camera/lesson.ts?raw";
import freeOrbitMathSource from "@/lessons/lesson-11-free-orbit-camera/math.ts?raw";
import freeOrbitCubeVertexShaderSource from "@/lessons/lesson-11-free-orbit-camera/cube.vert.wgsl?raw";
import { mountFreeOrbitCameraLesson } from "@/lessons/lesson-11-free-orbit-camera/lesson";
import specularCubeDataSource from "@/lessons/lesson-12-specular-materials/cube-data.ts?raw";
import specularCubeFragmentShaderSource from "@/lessons/lesson-12-specular-materials/cube.frag.wgsl?raw";
import specularLessonRuntimeSource from "@/lessons/lesson-12-specular-materials/lesson.ts?raw";
import specularMathSource from "@/lessons/lesson-12-specular-materials/math.ts?raw";
import specularCubeVertexShaderSource from "@/lessons/lesson-12-specular-materials/cube.vert.wgsl?raw";
import { mountSpecularMaterialsLesson } from "@/lessons/lesson-12-specular-materials/lesson";
import shadowSceneDataSource from "@/lessons/lesson-13-shadow-mapping/cube-data.ts?raw";
import shadowSceneFragmentShaderSource from "@/lessons/lesson-13-shadow-mapping/scene.frag.wgsl?raw";
import shadowSceneLessonRuntimeSource from "@/lessons/lesson-13-shadow-mapping/lesson.ts?raw";
import shadowSceneMathSource from "@/lessons/lesson-13-shadow-mapping/math.ts?raw";
import shadowSceneVertexShaderSource from "@/lessons/lesson-13-shadow-mapping/scene.vert.wgsl?raw";
import shadowPassVertexShaderSource from "@/lessons/lesson-13-shadow-mapping/shadow.vert.wgsl?raw";
import { mountShadowMappingLesson } from "@/lessons/lesson-13-shadow-mapping/lesson";
import multiObjectShadowsLessonRuntimeSource from "@/lessons/lesson-14-multi-object-shadows/lesson.ts?raw";
import { mountMultiObjectShadowsLesson } from "@/lessons/lesson-14-multi-object-shadows/lesson";
import multiLightShadowsLessonRuntimeSource from "@/lessons/lesson-15-multi-light-shadows/lesson.ts?raw";
import multiLightShadowsSceneFragmentShaderSource from "@/lessons/lesson-15-multi-light-shadows/scene.frag.wgsl?raw";
import multiLightShadowsSceneVertexShaderSource from "@/lessons/lesson-15-multi-light-shadows/scene.vert.wgsl?raw";
import multiLightShadowsShadowVertexShaderSource from "@/lessons/lesson-15-multi-light-shadows/shadow.vert.wgsl?raw";
import { mountMultiLightShadowsLesson } from "@/lessons/lesson-15-multi-light-shadows/lesson";
import sceneGraphCubeDataSource from "@/lessons/lesson-16-scene-graph/cube-data.ts?raw";
import sceneGraphFragmentShaderSource from "@/lessons/lesson-16-scene-graph/cube.frag.wgsl?raw";
import sceneGraphLessonRuntimeSource from "@/lessons/lesson-16-scene-graph/lesson.ts?raw";
import sceneGraphMathSource from "@/lessons/lesson-16-scene-graph/math.ts?raw";
import sceneGraphVertexShaderSource from "@/lessons/lesson-16-scene-graph/cube.vert.wgsl?raw";
import { mountSceneGraphLesson } from "@/lessons/lesson-16-scene-graph/lesson";
import instancingCubeDataSource from "@/lessons/lesson-17-instancing/cube-data.ts?raw";
import instancingFragmentShaderSource from "@/lessons/lesson-17-instancing/cube.frag.wgsl?raw";
import instancingLessonRuntimeSource from "@/lessons/lesson-17-instancing/lesson.ts?raw";
import instancingMathSource from "@/lessons/lesson-17-instancing/math.ts?raw";
import instancingVertexShaderSource from "@/lessons/lesson-17-instancing/cube.vert.wgsl?raw";
import { mountInstancingLesson } from "@/lessons/lesson-17-instancing/lesson";
import computeFoundationsLessonRuntimeSource from "@/lessons/lesson-18-compute-foundations/lesson.ts?raw";
import computeFoundationsSeedSource from "@/lessons/lesson-18-compute-foundations/seed.ts?raw";
import computeFoundationsShaderSource from "@/lessons/lesson-18-compute-foundations/compute.wgsl?raw";
import { mountComputeFoundationsLesson } from "@/lessons/lesson-18-compute-foundations/lesson";
import computeParticlesDataSource from "@/lessons/lesson-19-compute-particles/particle-data.ts?raw";
import computeParticlesComputeShaderSource from "@/lessons/lesson-19-compute-particles/particles.compute.wgsl?raw";
import computeParticlesFragmentShaderSource from "@/lessons/lesson-19-compute-particles/particles.frag.wgsl?raw";
import computeParticlesLessonRuntimeSource from "@/lessons/lesson-19-compute-particles/lesson.ts?raw";
import computeParticlesVertexShaderSource from "@/lessons/lesson-19-compute-particles/particles.vert.wgsl?raw";
import { mountComputeParticlesLesson } from "@/lessons/lesson-19-compute-particles/lesson";
import postProcessingCubeDataSource from "@/lessons/lesson-20-post-processing/cube-data.ts?raw";
import postProcessingLessonRuntimeSource from "@/lessons/lesson-20-post-processing/lesson.ts?raw";
import postProcessingMathSource from "@/lessons/lesson-20-post-processing/math.ts?raw";
import postProcessingFragmentShaderSource from "@/lessons/lesson-20-post-processing/post.frag.wgsl?raw";
import postProcessingVertexShaderSource from "@/lessons/lesson-20-post-processing/post.vert.wgsl?raw";
import postProcessingSceneFragmentShaderSource from "@/lessons/lesson-20-post-processing/scene.frag.wgsl?raw";
import postProcessingSceneVertexShaderSource from "@/lessons/lesson-20-post-processing/scene.vert.wgsl?raw";
import { mountPostProcessingLesson } from "@/lessons/lesson-20-post-processing/lesson";
import pingPongBlurFragmentShaderSource from "@/lessons/lesson-21-ping-pong-blur/blur.frag.wgsl?raw";
import pingPongCubeDataSource from "@/lessons/lesson-21-ping-pong-blur/cube-data.ts?raw";
import pingPongFullscreenVertexShaderSource from "@/lessons/lesson-21-ping-pong-blur/fullscreen.vert.wgsl?raw";
import pingPongLessonRuntimeSource from "@/lessons/lesson-21-ping-pong-blur/lesson.ts?raw";
import pingPongMathSource from "@/lessons/lesson-21-ping-pong-blur/math.ts?raw";
import pingPongPresentFragmentShaderSource from "@/lessons/lesson-21-ping-pong-blur/present.frag.wgsl?raw";
import pingPongSceneFragmentShaderSource from "@/lessons/lesson-21-ping-pong-blur/scene.frag.wgsl?raw";
import pingPongSceneVertexShaderSource from "@/lessons/lesson-21-ping-pong-blur/scene.vert.wgsl?raw";
import { mountPingPongBlurLesson } from "@/lessons/lesson-21-ping-pong-blur/lesson";
import alphaBlendBasicsFragmentShaderSource from "@/lessons/lesson-22-alpha-and-blending-basics/scene.frag.wgsl?raw";
import alphaBlendBasicsLessonRuntimeSource from "@/lessons/lesson-22-alpha-and-blending-basics/lesson.ts?raw";
import alphaBlendBasicsVertexShaderSource from "@/lessons/lesson-22-alpha-and-blending-basics/scene.vert.wgsl?raw";
import { mountAlphaAndBlendingBasicsLesson } from "@/lessons/lesson-22-alpha-and-blending-basics/lesson";
import blendingGeometrySource from "@/lessons/lesson-23-blending-and-transparency/geometry.ts?raw";
import blendingLessonRuntimeSource from "@/lessons/lesson-23-blending-and-transparency/lesson.ts?raw";
import blendingMathSource from "@/lessons/lesson-23-blending-and-transparency/math.ts?raw";
import blendingFragmentShaderSource from "@/lessons/lesson-23-blending-and-transparency/scene.frag.wgsl?raw";
import blendingVertexShaderSource from "@/lessons/lesson-23-blending-and-transparency/scene.vert.wgsl?raw";
import { mountBlendingAndTransparencyLesson } from "@/lessons/lesson-23-blending-and-transparency/lesson";
import mipmapGeometrySource from "@/lessons/lesson-24-mipmaps-and-sampler-parameters/geometry.ts?raw";
import mipmapLessonRuntimeSource from "@/lessons/lesson-24-mipmaps-and-sampler-parameters/lesson.ts?raw";
import mipmapMathSource from "@/lessons/lesson-24-mipmaps-and-sampler-parameters/math.ts?raw";
import mipmapFragmentShaderSource from "@/lessons/lesson-24-mipmaps-and-sampler-parameters/scene.frag.wgsl?raw";
import mipmapVertexShaderSource from "@/lessons/lesson-24-mipmaps-and-sampler-parameters/scene.vert.wgsl?raw";
import { mountMipmapAndSamplerParametersLesson } from "@/lessons/lesson-24-mipmaps-and-sampler-parameters/lesson";
import msaaGeometrySource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/geometry.ts?raw";
import msaaLessonRuntimeSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/lesson.ts?raw";
import msaaMathSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/math.ts?raw";
import msaaPresentFragmentShaderSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/present.frag.wgsl?raw";
import msaaPresentVertexShaderSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/present.vert.wgsl?raw";
import msaaSceneFragmentShaderSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/scene.frag.wgsl?raw";
import msaaSceneVertexShaderSource from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/scene.vert.wgsl?raw";
import { mountMsaaAndAlphaToCoverageLesson } from "@/lessons/lesson-25-msaa-and-alpha-to-coverage/lesson";
import cubemapGeometrySource from "@/lessons/lesson-26-cubemap-and-skybox/geometry.ts?raw";
import cubemapLessonRuntimeSource from "@/lessons/lesson-26-cubemap-and-skybox/lesson.ts?raw";
import cubemapMathSource from "@/lessons/lesson-26-cubemap-and-skybox/math.ts?raw";
import cubemapReflectiveFragmentShaderSource from "@/lessons/lesson-26-cubemap-and-skybox/reflective.frag.wgsl?raw";
import cubemapReflectiveVertexShaderSource from "@/lessons/lesson-26-cubemap-and-skybox/reflective.vert.wgsl?raw";
import cubemapSkyboxFragmentShaderSource from "@/lessons/lesson-26-cubemap-and-skybox/skybox.frag.wgsl?raw";
import cubemapSkyboxVertexShaderSource from "@/lessons/lesson-26-cubemap-and-skybox/skybox.vert.wgsl?raw";
import { mountCubemapAndSkyboxLesson } from "@/lessons/lesson-26-cubemap-and-skybox/lesson";

export const lessons01To26: LessonDefinition[] = [
{
    id: "01-hello-triangle",
    order: 1,
    title: "你好，三角形",
    tagline: "旧版 vol0_triangle 的新起点",
    goal: "走通 WebGPU 最小可运行的渲染链路，认识 adapter、device、canvas、shader、pipeline 和 draw 这些核心对象。",
    summary:
      "这一课完成了最基础的一次绘制：申请 adapter 和 device、配置 canvas、编译 WGSL、创建 render pipeline，然后绘制三个顶点。",
    notes: [
      "`navigator.gpu.requestAdapter()`：向浏览器申请可用的 GPU 适配器，这是进入 WebGPU 的第一步。",
      "`adapter.requestDevice()`：从适配器拿到真正干活的 `GPUDevice`，后续资源创建和命令提交都从这里出发。",
      "`canvas.getContext(\"webgpu\")`、`getPreferredCanvasFormat()`、`context.configure()`：把 canvas 配置成当前设备可用的渲染目标。",
      "`device.createShaderModule()`：把 WGSL 源码编译成顶点阶段和片元阶段可复用的 shader 模块。",
      "`device.createRenderPipeline()`：把 shader、图元拓扑和目标格式组合成一条完整渲染管线。",
      "`pass.draw(3)` + `@builtin(vertex_index)`：先不引入 vertex buffer，也能直接生成 3 个顶点并画出三角形。",
    ],
    status: "ready",
    mount: mountTriangleLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: lessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(lessonRuntimeSource, [
          [1, 2],
          [38, 38],
          [75, 104],
          [110, 162],
        ]),
        featured: true,
      },
      {
        id: "webgpu-runtime",
        filename: "webgpu.ts",
        language: "ts",
        content: webgpuSource,
      },
      {
        id: "triangle-shader",
        filename: "triangle.wgsl",
        language: "wgsl",
        content: shaderSource,
      },
    ],
  },
{
    id: "02-vertex-buffers",
    order: 2,
    title: "顶点缓冲",
    tagline: "把几何数据从 builtin 挪进 GPU buffer",
    goal: "把顶点位置和颜色真正写进 GPUBuffer，理解 CPU 侧数组、vertex layout 和 shader 输入之间是怎么一一对上的。",
    summary:
      "这一课不再依赖 `@builtin(vertex_index)` 生成顶点，而是先创建 `vertex buffer`，再通过 `setVertexBuffer()` 和 `@location` 输入把数据送进顶点着色器。",
    notes: [
      "`device.createBuffer()`：创建一个真正存放顶点数据的 `GPUBuffer`，并用 `GPUBufferUsage.VERTEX` 声明它会被当成顶点缓冲读取。",
      "`queue.writeBuffer()`：把 CPU 侧 `Float32Array` 里的数据上传到 GPUBuffer。",
      "`arrayStride`、`offset`、`format`：告诉 GPU 每个顶点占多少字节，以及 position / color 分别从哪里开始读。",
      "`shaderLocation` + WGSL `@location`：把 vertex buffer 中的每个属性绑定到顶点着色器对应的输入槽位。",
      "`pass.setVertexBuffer(0, vertexBuffer)`：把第 0 号顶点缓冲槽和这块 GPUBuffer 绑定起来。",
      "`pass.draw(3)` + `topology: \"triangle-list\"`：依次读取 3 个顶点，并把它们组装成 1 个独立三角形。",
    ],
    status: "ready",
    mount: mountVertexBufferLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: vertexBufferLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(vertexBufferLessonRuntimeSource, [
          [1, 2],
          [38, 38],
          [75, 161],
          [167, 221],
        ]),
        featured: true,
      },
      {
        id: "webgpu-runtime",
        filename: "webgpu.ts",
        language: "ts",
        content: webgpuSource,
      },
      {
        id: "triangle-shader",
        filename: "triangle.wgsl",
        language: "wgsl",
        content: vertexBufferShaderSource,
      },
    ],
  },
{
    id: "03-uniforms",
    order: 3,
    title: "Uniform 与时间",
    tagline: "把动态数据送进 shader",
    goal: "把每一帧变化的时间数据送进 shader，理解 uniform buffer、bind group 和动画循环是怎么连起来工作的。",
    summary:
      "这一课在 vertex buffer 的基础上加入了 uniform buffer。JavaScript 每帧更新 `time` 和 `pulse`，再通过 `bind group` 绑定给 shader，让三角形持续旋转并轻微呼吸。",
    notes: [
      "`GPUBufferUsage.UNIFORM`：声明这块 `GPUBuffer` 会被 shader 当成 uniform 数据来只读访问。",
      "`device.createBindGroup()` + `pipeline.getBindGroupLayout(0)`：把 uniform buffer 按照 shader 需要的布局打包成可绑定资源组。",
      "`@group(0) @binding(0)` + `var<uniform>`：在 WGSL 里声明这块 uniform 数据应该从哪一组、哪一个 binding 读取。",
      "`queue.writeBuffer(uniformBuffer, 0, uniformData)`：每一帧把最新的 `time` 和 `pulse` 上传到 GPU。",
      "`pass.setBindGroup(0, bindGroup)`：在 draw 之前把第 0 组资源绑定给当前渲染 pass。",
      "`requestAnimationFrame()`：让浏览器在每一帧到来前更新 uniform，再重新触发绘制。",
      "`Float32Array(4)`：当前这块 uniform 数据一共占 16 字节，既能放下 `time`、`pulse`，也顺手满足最基础的对齐要求。",
    ],
    status: "ready",
    mount: mountUniformLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: uniformLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(uniformLessonRuntimeSource, [
          [1, 2],
          [38, 38],
          [74, 192],
          [198, 290],
        ]),
        featured: true,
      },
      {
        id: "webgpu-runtime",
        filename: "webgpu.ts",
        language: "ts",
        content: webgpuSource,
      },
      {
        id: "triangle-shader",
        filename: "triangle.wgsl",
        language: "wgsl",
        content: uniformShaderSource,
      },
    ],
  },
{
    id: "04-cube-depth",
    order: 4,
    title: "立方体与深度",
    tagline: "从 2D 三角形走到真正的 3D 物体",
    goal: "把 `index buffer`、`model / view / projection` 矩阵和深度测试串起来，理解为什么 3D 场景不能只靠顶点缓冲和普通 `draw()`。",
    summary:
      "这一课把图形升级成了旋转立方体。我们会先用 `index buffer` 复用顶点，再把 `MVP` 矩阵写进 uniform buffer，并通过 `depth texture` + 深度测试正确遮挡前后表面。",
    notes: [
      "`GPUBufferUsage.INDEX` + `pass.setIndexBuffer()`：告诉 GPU 这块 buffer 存放的是索引，而不是直接展开的顶点序列。",
      "`pass.drawIndexed(36)`：按索引顺序复用顶点，画出 12 个三角形组成的立方体。",
      "`mat4x4f` + `projection * view * model`：先把模型放进世界，再经过相机视图和透视投影，最后得到裁剪空间坐标。",
      "`为什么这里是 4x4 而不是 3x3`：`3x3` 适合纯旋转和缩放，但位置还需要平移，透视投影也要一起编码，所以顶点会先扩成 `vec4(position, 1.0)`，再交给 `4x4` 矩阵处理。",
      "`device.createTexture()` + `format: \"depth24plus\"`：创建一张专门存放深度值的纹理，作为深度附件使用。",
      "`depthWriteEnabled: true` + `depthCompare: \"less\"`：让更靠近相机的片元通过深度测试，并把自己的 z 值写回深度缓冲。",
      "`depthStencilAttachment` + `depthClearValue: 1`：每一帧先把深度附件清成最远值，再开始新的深度比较。",
    ],
    status: "ready",
    mount: mountCubeDepthLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: cubeDepthLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(cubeDepthLessonRuntimeSource, [
          [1, 4],
          [40, 40],
          [76, 210],
          [212, 350],
        ]),
        featured: true,
      },
      {
        id: "webgpu-runtime",
        filename: "webgpu.ts",
        language: "ts",
        content: webgpuSource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: cubeDepthMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: cubeDepthDataSource,
      },
      {
        id: "cube-shader",
        filename: "cube.wgsl",
        language: "wgsl",
        content: cubeDepthShaderSource,
      },
    ],
  },
{
    id: "05-textures",
    order: 5,
    title: "纹理与采样器",
    tagline: "把 Capoo 贴图送进 shader",
    goal: "把一张静态图片上传进 GPUTexture，并通过 sampler、texture view 和 `textureSample()` 正确画到一个带 UV 的 quad 上。",
    summary:
      "这一课会把一张 Capoo 图片当作静态贴图上传到 GPU。我们会创建 texture、sampler 和 bind group，再让片元着色器按照 UV 坐标完成真正的纹理采样。",
    notes: [
      "`device.createTexture()`：先在 GPU 上创建一块真正存放贴图像素的 `GPUTexture`。",
      "`queue.copyExternalImageToTexture()`：把浏览器里的静态图片像素复制进 GPUTexture，这一步才算真正上传到 GPU。",
      "`device.createSampler()`：定义纹理被放大、缩小时应该怎么采样，这一课先使用 `linear` 过滤。",
      "`texture.createView()`：把 GPUTexture 包装成 shader 能绑定和读取的 `GPUTextureView`。",
      "`@group(0) @binding(0)` + `sampler`、`@group(0) @binding(1)` + `texture_2d<f32>`：在 WGSL 中声明采样器和纹理各自占用的绑定槽位。",
      "`uv` + `textureSample()`：片元着色器会根据每个片元插值得到的 UV 坐标，从贴图中读取对应颜色。",
      "虽然素材文件是 `.gif`，但这一课只把它当成一次性上传的静态贴图使用，不涉及动态帧更新。",
    ],
    status: "ready",
    mount: mountTextureLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: textureLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(textureLessonRuntimeSource, [
          [1, 3],
          [17, 30],
          [99, 248],
          [250, 376],
        ]),
        featured: true,
      },
      {
        id: "webgpu-runtime",
        filename: "webgpu.ts",
        language: "ts",
        content: webgpuSource,
      },
      {
        id: "texture-shader",
        filename: "texture.wgsl",
        language: "wgsl",
        content: textureShaderSource,
      },
    ],
  },
{
    id: "06-textured-cube",
    order: 6,
    title: "贴图立方体",
    tagline: "把贴图贴到带颜色的 3D 立方体上",
    goal: "把第 4 课的 3D 立方体和第 5 课的纹理采样合起来，并把 vertex / fragment shader 拆成两个独立文件。",
    summary:
      "这一课会把 Capoo 贴图贴到一个带顶点颜色的旋转立方体上。顶点阶段负责 MVP 变换和插值数据输出，片元阶段负责采样贴图，并利用贴图 alpha 把图片颜色和立方体本身的面颜色混在一起。",
    notes: [
      "`position + color + uv`：顶点缓冲现在同时存三类数据，分别喂给空间位置、面颜色和贴图坐标。",
      "`device.createShaderModule()` 可以各自读取不同源码：这次 `vertex.module` 和 `fragment.module` 不再共用一个 WGSL 文件。",
      "`@location(2)` + `uv`：在顶点阶段把 UV 继续传给片元阶段，供每个片元做纹理采样。",
      "`textureSample()` + `sampled.a`：这次不是直接输出纹理颜色，而是用贴图 alpha 把 Capoo 图案混到立方体面颜色上。",
      "`pass.drawIndexed(36)` + `depthStencil`：即使换成贴图立方体，3D 遮挡关系仍然要靠索引绘制和深度测试来保证。",
      "`texture.createView()`、`sampler`、`uniform buffer`：这三类资源可以一起打包进同一个 bind group，统一在 draw 前绑定。",
    ],
    status: "ready",
    mount: mountTexturedCubeLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: texturedCubeLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(texturedCubeLessonRuntimeSource, [
          [1, 6],
          [20, 33],
          [88, 333],
        ]),
        featured: true,
      },
      {
        id: "webgpu-runtime",
        filename: "webgpu.ts",
        language: "ts",
        content: webgpuSource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: cubeDepthMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: texturedCubeDataSource,
      },
      {
        id: "cube-vertex-shader",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: texturedCubeVertexShaderSource,
      },
      {
        id: "cube-fragment-shader",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: texturedCubeFragmentShaderSource,
      },
    ],
  },
{
    id: "07-lighting",
    order: 7,
    title: "方向光与法线",
    tagline: "先把最基础的 Lambert 光照吃透",
    goal: "在纯色立方体的基础上加入法线和最基础的方向光，让“朝向”第一次变成看得见的亮暗差。",
    summary:
      "这一课会给每个顶点补上 normal，并在 shader 里计算最基础的 Lambert 漫反射。顶点阶段负责把法线跟着模型旋转，片元阶段只用顶点颜色和方向光强度得到最终颜色。",
    notes: [
      "`normal`：这节每个顶点除了 position、color 之外，还会多一组法线方向。",
      "`@location(2)`：法线会通过新的输入槽位送进顶点着色器。",
      "`modelMatrix`：除了 MVP 之外，这节还要把模型矩阵单独送进 shader，用来正确旋转法线。",
      "`normalize()` + `dot()` + `max()`：Lambert 光照最核心的三步就是单位化、点乘和把负值截成 0。",
      "`ambient + diffuse`：完全背光的面也保留一点基础亮度，这样立方体不会整个黑掉。",
      "`color * diffuse`：这次最终颜色只由顶点颜色和光照强度共同决定，不再混入纹理采样。",
    ],
    status: "ready",
    mount: mountLightingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: lightingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(lightingLessonRuntimeSource, [
          [1, 10],
          [25, 38],
          [46, 193],
          [195, 288],
        ]),
        featured: true,
      },
      {
        id: "webgpu-runtime",
        filename: "webgpu.ts",
        language: "ts",
        content: webgpuSource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: cubeDepthMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: lightingCubeDataSource,
      },
      {
        id: "cube-vertex-shader",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: lightingCubeVertexShaderSource,
      },
      {
        id: "cube-fragment-shader",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: lightingCubeFragmentShaderSource,
      },
    ],
  },
{
    id: "08-point-lights",
    order: 8,
    title: "环境光与点光源",
    tagline: "让光从一个具体位置照向场景",
    goal: "在方向光基础上继续理解环境光、点光源位置和距离衰减，看看“从某个地方发出来的光”会怎样影响物体表面。",
    summary:
      "这一课把“平行打过来的方向光”换成了“从一个具体位置发出来的点光源”。环境光先负责保底亮度，点光源再随着位置变化，让柱体和平台出现更局部的明暗变化。",
    notes: [
      "`lightPosition`：点光源不再只给一个方向，而是要明确告诉 shader 这盏灯在世界空间里的位置。",
      "`lightPosition - worldPosition`：从片元位置指向光源位置的向量，会同时决定照射方向和距离。",
      "`attenuation`：光离得越远，贡献越小，所以点光源不会像方向光那样整块场景亮度都差不多。",
      "`ambient + diffuse`：环境光负责保底亮度，点光源负责局部照亮，这两个分量会一起决定最终颜色。",
      "`点光源和方向光的最大区别`：方向光默认整片场景都像被同一方向照着，点光源则会强调“离灯近的地方更亮”。",
    ],
    status: "ready",
    mount: mountPointLightsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: pointLightsLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(pointLightsLessonRuntimeSource, [
          [1, 23],
          [41, 56],
          [75, 110],
          [119, 246],
          [248, 260],
          [287, 369],
        ]),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: pointLightsMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: pointLightsCubeDataSource,
      },
      {
        id: "vertex-shader",
        filename: "point-light.vert.wgsl",
        language: "wgsl",
        content: pointLightsVertexShaderSource,
      },
      {
        id: "fragment-shader",
        filename: "point-light.frag.wgsl",
        language: "wgsl",
        content: pointLightsFragmentShaderSource,
      },
    ],
  },
{
    id: "09-spot-light",
    order: 9,
    title: "聚光灯",
    tagline: "给点光源再加一层方向与光锥限制",
    goal: "在点光源基础上加入光源方向、内外锥角和锥形范围，让亮度真正集中在一个可控制的照射区域里。",
    summary:
      "这一课把点光源再推进一步：光不只是从一个位置发出来，还会被限制在一个锥形范围内。这样同样的场景会出现更集中的照明区域，也更容易看懂 `cutoff` 和 `smoothstep` 的意义。",
    notes: [
      "`lightDirection`：聚光灯除了位置，还要知道自己朝哪里照。",
      "`spotCos`：把“从灯指向片元”的方向和“聚光灯朝向”做点乘，就能知道这个片元是否在光锥里。",
      "`inner cone / outer cone`：聚光灯通常不是硬边切断，而是会给一个内锥和外锥，让边缘过渡更自然。",
      "`smoothstep()`：把聚光灯边缘从突然全亮/全灭改成柔和过渡，这会比直接 if 判断顺眼很多。",
      "`聚光灯其实是带方向限制的点光源`：它依然会受距离衰减影响，只是又多了一层“角度是否命中”的判断。",
    ],
    status: "ready",
    mount: mountSpotLightLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: spotLightLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(spotLightLessonRuntimeSource, [
          [1, 26],
          [44, 61],
          [80, 115],
          [124, 251],
          [253, 265],
          [292, 387],
        ]),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: spotLightMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: spotLightCubeDataSource,
      },
      {
        id: "vertex-shader",
        filename: "spot-light.vert.wgsl",
        language: "wgsl",
        content: spotLightVertexShaderSource,
      },
      {
        id: "fragment-shader",
        filename: "spot-light.frag.wgsl",
        language: "wgsl",
        content: spotLightFragmentShaderSource,
      },
    ],
  },
{
    id: "08-camera-controls",
    order: 10,
    title: "受限轨道相机",
    tagline: "用安全角限制保证视角稳定",
    goal: "把 view matrix 从“隐形步骤”单独拉出来，并用 `yaw / pitch / radius + clamp` 做出一个稳定的受限轨道相机。",
    summary:
      "这一课会把静态观察点升级成真正可控制的轨道相机。我们会根据 `yaw / pitch / radius` 算出相机位置，再用 `lookAt` 风格的 view matrix 去观察同一个立方体；为了稳定，这里会主动限制 pitch，不让视角翻过去。",
    notes: [
      "`eye / target / up`：相机位置、观察目标和头顶方向，决定了一张 view matrix 最基本的三组输入。",
      "`createLookAtViewMatrix()`：把相机坐标系转换成真正参与 `projection * view * model` 的 view 矩阵。",
      "`yaw / pitch / radius`：轨道相机会用三个量描述视角，分别控制水平旋转、上下抬头和离目标点的距离。",
      "`canvas.addEventListener(\"pointerdown\", ...)` + `pointermove`：按下并拖拽鼠标时，持续更新 yaw 和 pitch。",
      "`canvas.addEventListener(\"wheel\", ...)`：滚轮不再改物体，而是直接推近或拉远相机半径。",
      "`clamp()`：pitch 和 radius 都需要限制范围，避免相机翻转到奇怪角度，或者直接穿进模型内部。",
    ],
    status: "ready",
    mount: mountCameraControlsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: cameraLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(cameraLessonRuntimeSource, [
          [1, 12],
          [26, 59],
          [68, 185],
          [212, 343],
        ]),
        featured: true,
      },
      {
        id: "webgpu-runtime",
        filename: "webgpu.ts",
        language: "ts",
        content: webgpuSource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: cameraMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: cameraCubeDataSource,
      },
      {
        id: "cube-vertex-shader",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: cameraCubeVertexShaderSource,
      },
      {
        id: "cube-fragment-shader",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: cameraCubeFragmentShaderSource,
      },
    ],
  },
{
    id: "09-free-orbit-camera",
    order: 11,
    title: "自由轨道相机",
    tagline: "不再依赖安全角限制",
    goal: "不再用 `yaw / pitch + clamp` 管视角，而是维护相机自己的 `right / up / back` 局部坐标系，实现真正可越过顶部的自由轨道相机。",
    summary:
      "这一课会把受限轨道相机升级成自由轨道相机。拖拽时不再直接改 pitch，而是让相机围绕当前 `up` 和 `right` 旋转自己的局部坐标轴，这样就能越过顶部继续转。",
    notes: [
      "`right / up / back`：这一课不再把相机写成两个角度，而是直接维护相机自己的三个局部方向轴。",
      "`rotateVectorAroundAxis()`：拖拽鼠标时，要把 `back`、`right`、`up` 绕当前局部轴做真正的轴角旋转。",
      "`orthonormalizeBasis()`：每次旋转后都要重新单位化并正交化这组三轴，避免长时间拖拽后数值慢慢漂掉。",
      "`basis.up`：水平旋转不再围着世界 y 轴，而是围着“当前相机自己的 up”继续转。",
      "`deltaY` 不再走 `pitch clamp`：垂直拖拽会直接绕当前 `right` 旋转，所以视角可以越过顶部继续运动。",
      "`lookAt(eye, target, basis.up)`：虽然相机自由了，但最终仍然会回到一张标准的 view matrix 参与渲染。",
      "`为什么很多人会在极点附近卡住`：如果还在用 `yaw / pitch` 去补极点，越接近顶部，角度和世界 `up` 就越容易变得不稳定；这一课改成直接维护 `right / up / back`，就是为了解开这个坑。",
    ],
    status: "ready",
    mount: mountFreeOrbitCameraLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: freeOrbitLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(freeOrbitLessonRuntimeSource, [
          [1, 15],
          [24, 29],
          [57, 64],
          [72, 83],
          [91, 101],
          [117, 208],
          [235, 385],
        ]),
        featured: true,
      },
      {
        id: "webgpu-runtime",
        filename: "webgpu.ts",
        language: "ts",
        content: webgpuSource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: freeOrbitMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: freeOrbitCubeDataSource,
      },
      {
        id: "cube-vertex-shader",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: freeOrbitCubeVertexShaderSource,
      },
      {
        id: "cube-fragment-shader",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: freeOrbitCubeFragmentShaderSource,
      },
    ],
  },
{
    id: "10-specular-materials",
    order: 12,
    title: "高光与材质",
    tagline: "从漫反射继续走到高光反射",
    goal: "在现有方向光的基础上加入视线方向、反射方向和材质参数，理解为什么高光会随着观察角度移动。",
    summary:
      "这一课会在 Lambert 漫反射之上继续补出最基础的高光反射。我们会开始区分材质参数和光照参数，并看到镜面高光为什么和相机位置直接相关。",
    notes: [
      "`viewDirection`：高光不只和光线方向有关，也和相机从哪里看这个表面有关。",
      "`reflect()`：镜面高光会先根据法线把入射光反射成一条新的方向，再和当前视线方向比较接近程度。",
      "`shininess` + `specularStrength`：一个控制高光有多尖，一个控制高光有多亮，它们都更像材质参数而不是几何参数。",
      "`eyePosition`：片元着色器要知道相机在世界空间里的位置，才能算出每个片元的视线方向。",
      "`ambient + diffuse + specular`：到这一步，最基础的一套实时光照分量才算凑齐。",
      "`为什么这一课继续保留可拖拽相机`：高光会随着观察角度移动，所以鼠标拖拽比静态截图更容易把现象看清楚。",
    ],
    status: "ready",
    mount: mountSpecularMaterialsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: specularLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(specularLessonRuntimeSource, [
          [1, 17],
          [59, 71],
          [79, 89],
          [147, 214],
          [241, 303],
          [315, 396],
        ]),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: specularMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: specularCubeDataSource,
      },
      {
        id: "cube-vertex-shader",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: specularCubeVertexShaderSource,
      },
      {
        id: "cube-fragment-shader",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: specularCubeFragmentShaderSource,
      },
    ],
  },
{
    id: "11-shadow-mapping",
    order: 13,
    title: "阴影基础",
    tagline: "先把最小 shadow map 流程跑通",
    goal: "理解 shadow map 的两遍渲染流程：先从光源视角写深度，再从相机视角判断当前片元是否被挡住。",
    summary:
      "这一课会把“有亮暗变化”升级成“有遮挡阴影”。重点不再是表面本身怎么变亮，而是别的物体会不会挡住这束光。",
    notes: [
      "`轨道相机 + 旋转光源`：这一课可以拖拽换角度观察平台、方块和阴影的关系，再观察光源转动时阴影怎样跟着移动。",
      "`light view projection`：阴影贴图本质上也要先有一套“光源自己的相机”。",
      "`depth texture` + 第一遍渲染：这一课会先从光源视角把场景深度写进一张 shadow map，不输出真正颜色。",
      "`texture_depth_2d` + `sampler_comparison`：第二遍不是普通贴图采样，而是直接做“当前深度和 shadow map 深度谁更近”的比较采样。",
      "`shadow coordinate`：第二遍要把当前片元重新投到光源空间里，才能知道自己落在 shadow map 的哪个位置。",
      "`textureSampleCompare()`：如果当前片元比 shadow map 里记录的深度更远，它就更可能处在阴影里。",
      "`bias`：阴影里最经典的坑之一就是自阴影伪影，所以比较深度前通常会先减一点很小的偏移量。",
    ],
    status: "ready",
    mount: mountShadowMappingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: shadowSceneLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(shadowSceneLessonRuntimeSource, [
          [1, 36],
          [47, 83],
          [247, 360],
          [387, 535],
        ]),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: shadowSceneMathSource,
      },
      {
        id: "scene-data",
        filename: "cube-data.ts",
        language: "ts",
        content: shadowSceneDataSource,
      },
      {
        id: "shadow-pass-shader",
        filename: "shadow.vert.wgsl",
        language: "wgsl",
        content: shadowPassVertexShaderSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: shadowSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: shadowSceneFragmentShaderSource,
      },
    ],
  },
{
    id: "14-multi-object-shadows",
    order: 14,
    title: "单光源下的多物体阴影",
    tagline: "让同一张 shadow map 同时服务多个物体",
    goal: "理解一个光源并不是只给一个物体投影，而是会先统一看完整个场景，再让多个物体一起参与阴影遮挡关系。",
    summary:
      "这一课不增加新的阴影技术名词，而是把上一课的单物体场景扩成真正的多物体场景。重点会从“shadow map 怎么生成”推进到“同一个光源视角下，多个 caster 和 receiver 怎样共享一张 shadow map”。",
    notes: [
      "`同一个 light view projection`：单光源场景里，不是每个物体各做一张阴影图，而是先用光源自己的视角统一观察整个场景。",
      "`多个 caster`：平台、柱体、横梁和前景小方块都会一起进入 shadow pass，把谁挡住了光一次性写进同一张 depth texture。 ",
      "`多个 receiver`：第二遍每个物体都要重新投到光源空间里，再判断自己当前这个片元是不是被别的物体挡住了。",
      "`同一张 shadow map 服务多个对象`：这一课最重要的理解点，就是 shadow map 描述的是“光源眼中的可见性”，不是“某一个物体自己的阴影缓存”。",
      "`shadow pass / scene pass` 结构没变：变复杂的是场景组织，而不是阴影技术突然换了一套。 ",
    ],
    status: "ready",
    mount: mountMultiObjectShadowsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: multiObjectShadowsLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(
          multiObjectShadowsLessonRuntimeSource,
          [
            [1, 36],
            [47, 83],
            [223, 407],
            [439, 585],
          ]
        ),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: shadowSceneMathSource,
      },
      {
        id: "scene-data",
        filename: "cube-data.ts",
        language: "ts",
        content: shadowSceneDataSource,
      },
      {
        id: "shadow-pass-shader",
        filename: "shadow.vert.wgsl",
        language: "wgsl",
        content: shadowPassVertexShaderSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: shadowSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: shadowSceneFragmentShaderSource,
      },
    ],
  },
{
    id: "15-multi-light-shadows",
    order: 15,
    title: "多光源阴影",
    tagline: "让两盏灯各自生成自己的 shadow map",
    goal: "理解多光源阴影不是把一张 shadow map 用两遍，而是每盏灯都要有自己的光源视角、自己的深度贴图，以及最终在主场景里的单独贡献。",
    summary:
      "这一课继续沿用上一课的多物体场景，但把光源数量升级成两盏。重点会从“一个光源怎么看场景”推进到“多个光源各自生成 shadow map，再一起参与最终光照计算”。",
    notes: [
      "`每盏灯一张 shadow map`：多个光源不会共享同一张阴影图，因为每盏灯看场景的方向和可见性都不一样。",
      "`两次 shadow pass`：第一盏灯先写自己的 depth texture，第二盏灯再写自己的 depth texture，主场景 pass 最后才统一读取它们。",
      "`lightOneViewProjectionMatrix` 与 `lightTwoViewProjectionMatrix`：多光源阴影最重要的新增对象，就是每一盏灯都要维护自己的一套光源相机。",
      "`scene shader 同时采样两张 shadowTexture`：主场景片元阶段不再只判断一次可见性，而是要分别算出两盏灯下的阴影结果。",
      "`光照累加`：最终亮度不是谁覆盖谁，而是环境光加上每盏灯自己的颜色、方向和阴影贡献一起合成。 ",
    ],
    status: "ready",
    mount: mountMultiLightShadowsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: multiLightShadowsLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(
          multiLightShadowsLessonRuntimeSource,
          [
            [1, 52],
            [60, 138],
            [140, 234],
            [243, 429],
            [431, 727],
          ]
        ),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: shadowSceneMathSource,
      },
      {
        id: "scene-data",
        filename: "cube-data.ts",
        language: "ts",
        content: shadowSceneDataSource,
      },
      {
        id: "shadow-pass-shader",
        filename: "shadow.vert.wgsl",
        language: "wgsl",
        content: multiLightShadowsShadowVertexShaderSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: multiLightShadowsSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: multiLightShadowsSceneFragmentShaderSource,
      },
    ],
  },
{
    id: "12-scene-graph",
    order: 16,
    title: "多物体与场景树",
    tagline: "让场景不再只靠一个立方体撑着",
    goal: "把单物体示例升级成多物体场景，理解局部变换、父子层级和每个对象自己的 model matrix。",
    summary:
      "这一课会开始把“一个 demo”推进成“一个场景”。重点会转到对象组织方式，而不只是单次 draw 的 API 顺序。",
    notes: [
      "`local matrix` 与 `world matrix`：父节点一动，子节点会跟着一起动。",
      "`scene graph`：层级关系能把复杂场景拆成更容易管理的变换链。",
      "`createSceneNode()` + `appendChild()`：先把“节点关系”搭起来，再决定哪些节点是真正可绘制的 mesh。",
      "`updateWorldMatrix(node, parentWorldMatrix)`：这一课最核心的一步，就是递归计算 `worldMatrix = parentWorldMatrix * localMatrix`。",
      "`pivot 节点` 与 `mesh 节点`：很多层级动画并不直接画在 pivot 上，而是让 pivot 负责旋转/位移，mesh 负责缩放和真正显示。",
      "`共享一套 cube 几何`：虽然画面里有很多物体，但它们都复用同一套顶点和索引数据，只是 world matrix 和颜色不同。",
      "`drawSceneNode()`：真正渲染时，通常也是沿着整棵树递归往下走，而不是手写一长串互不相关的 draw。",
    ],
    status: "ready",
    mount: mountSceneGraphLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: sceneGraphLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(sceneGraphLessonRuntimeSource, [
          [1, 36],
          [47, 119],
          [133, 170],
          [227, 284],
          [315, 350],
          [381, 476],
        ]),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: sceneGraphMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: sceneGraphCubeDataSource,
      },
      {
        id: "cube-vertex-shader",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: sceneGraphVertexShaderSource,
      },
      {
        id: "cube-fragment-shader",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: sceneGraphFragmentShaderSource,
      },
    ],
  },
{
    id: "13-instancing",
    order: 17,
    title: "实例化与批量绘制",
    tagline: "一次 draw 画出很多个物体",
    goal: "理解什么时候应该复用同一套几何与材质，并通过实例数据把大量相似物体一起交给 GPU。",
    summary:
      "这一课会把“一个立方体”扩展成“一批立方体”。重点会转向数据组织和绘制批次，而不是单个物体的效果细节。",
    notes: [
      "`instance buffer`：每个实例只补自己独有的位置、旋转或颜色，而不是复制整份顶点数据。",
      "`stepMode: \"instance\"`：GPU 会按实例而不是按顶点去读取这组属性。",
      "`shaderLocation 2 / 3`：这一课把每个实例自己的偏移量和颜色放进第二个 vertex buffer。",
      "`共享一套 cube 几何`：25 个立方体共用同一份顶点和索引数据，只额外补一块 instance buffer。",
      "`pass.setVertexBuffer(1, instanceBuffer)`：除了第 0 号几何缓冲，这一课还会额外挂上第 1 号实例缓冲。",
      "`drawIndexed(indexCount, instanceCount)`：第一个参数还是几何索引数量，第二个参数开始才是“要画多少个实例”。",
      "`instanceOffset` + `instanceColor`：顶点着色器会把每个实例自己的偏移和颜色和共享几何拼到一起。",
    ],
    status: "ready",
    mount: mountInstancingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: instancingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(instancingLessonRuntimeSource, [
          [1, 13],
          [21, 24],
          [35, 85],
          [143, 244],
          [271, 331],
        ]),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: instancingMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: instancingCubeDataSource,
      },
      {
        id: "cube-vertex-shader",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: instancingVertexShaderSource,
      },
      {
        id: "cube-fragment-shader",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: instancingFragmentShaderSource,
      },
    ],
  },
{
    id: "18-compute-foundations",
    order: 18,
    title: "Compute 基础与 Storage Buffer",
    tagline: "先让 GPU 学会成批处理数据",
    goal: "先单独建立 `compute pass`、`storage buffer`、`dispatchWorkgroups()` 和 `global_invocation_id` 这条最小心智模型，再进入真正的 compute-render 联动案例。",
    summary:
      "这一课会把 WebGPU 的“另一半能力”先拆出来讲清楚：它不负责直接出颜色，而是负责并行改写一批数据。先把 compute 自己的执行方式吃透，后面的粒子、排序和 culling 才不会一下跨太大台阶。",
    notes: [
      "`device.createComputePipeline()`：compute pipeline 不是拿来画顶点，而是拿来并行处理数据。",
      "`GPUBufferUsage.STORAGE`：这类 buffer 会第一次真正变成“shader 可读写的数据区”。",
      "`beginComputePass()`：compute 和 render 是两段不同的命令编码阶段，职责也不同。",
      "`dispatchWorkgroups()`：compute 不是按顶点发射，而是按工作组批量启动线程。",
      "`@builtin(global_invocation_id)`：每个 compute 线程都要先知道“我负责哪一个元素”。",
      "`这是粒子课前置课`：先理解 compute 自己怎么工作，再看它怎样把结果交给 render。",
    ],
    status: "ready",
    mount: mountComputeFoundationsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: computeFoundationsLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(
          computeFoundationsLessonRuntimeSource,
          [
            [1, 49],
            [59, 118],
            [128, 255],
            [264, 305],
            [313, 614],
          ]
        ),
        featured: true,
      },
      {
        id: "seed-helper",
        filename: "seed.ts",
        language: "ts",
        content: computeFoundationsSeedSource,
      },
      {
        id: "compute-shader",
        filename: "compute.wgsl",
        language: "wgsl",
        content: computeFoundationsShaderSource,
      },
    ],
  },
{
    id: "14-compute-particles",
    order: 19,
    title: "Compute 粒子与 Render Interop",
    tagline: "先算状态，再把结果直接拿来画",
    goal: "在已经理解 compute pass 与 storage buffer 基础之后，专门看 compute 输出怎样直接成为 render 阶段输入，形成最小的 compute-render interop。",
    summary:
      "这一课不再把重点放在“compute 是什么”，而是放在“compute 结果怎样立刻变成可渲染数据”。我们会先更新整批粒子的状态，再让 render pass 直接从同一块 storage buffer 读出当前位置和颜色，把两种管线真正接起来。",
    notes: [
      "`shared storage buffer`：同一批粒子状态会先被 compute 写，再被 vertex shader 读。",
      "`compute -> render`：这节的主线是两段 pass 如何围绕同一块 GPU 数据接力。",
      "`@builtin(instance_index)`：render 阶段不会复制粒子顶点数据，而是让每个实例自己去 storage buffer 里找自己的状态。",
      "`draw(6, particleCount)`：每个粒子仍然只是一块小四边形，数量感来自实例化和共享状态读取。",
      "`这是第二课`：重点已经从“compute 如何启动”转向“compute 结果如何进入渲染”。",
    ],
    status: "ready",
    mount: mountComputeParticlesLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: computeParticlesLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(computeParticlesLessonRuntimeSource, [
          [1, 8],
          [16, 32],
          [85, 194],
          [199, 252],
        ]),
        featured: true,
      },
      {
        id: "particle-data",
        filename: "particle-data.ts",
        language: "ts",
        content: computeParticlesDataSource,
      },
      {
        id: "compute-shader",
        filename: "particles.compute.wgsl",
        language: "wgsl",
        content: computeParticlesComputeShaderSource,
      },
      {
        id: "vertex-shader",
        filename: "particles.vert.wgsl",
        language: "wgsl",
        content: computeParticlesVertexShaderSource,
      },
      {
        id: "fragment-shader",
        filename: "particles.frag.wgsl",
        language: "wgsl",
        content: computeParticlesFragmentShaderSource,
      },
    ],
  },
{
    id: "15-post-processing",
    order: 20,
    title: "后处理与全屏 Pass",
    tagline: "把场景先渲染出来，再做屏幕空间处理",
    goal: "理解离屏渲染、全屏 pass 和两段 render pass 的基本分工，为描边、颜色校正、模糊等效果打基础。",
    summary:
      "这一课会把“直接画到屏幕”升级成“先画到纹理，再做第二遍处理”。我们会先把旋转立方体画进一张离屏纹理，再用全屏 pass 读取它，并在右半边做一次明显的后处理效果。",
    notes: [
      "`offscreen texture`：第一遍不再直接输出到屏幕，而是输出到一张中间纹理。",
      "`device.createTexture()` + `GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING`：这张纹理既要承接第一遍场景输出，也要给第二遍 shader 采样。",
      "`fullscreen pass`：第二遍通常只画一个 full-screen triangle，再按屏幕坐标采样上一遍结果。",
      "`scene pass` 与 `post pass`：第一遍负责真正的 3D 场景，第二遍负责屏幕空间处理，这就是最基本的多 pass 流程。",
      "`textureSample(sampledSceneTexture, sceneTextureSampler, uv)`：后处理 shader 不再看立方体顶点，而是直接按屏幕 UV 读取第一遍颜色。",
    ],
    status: "ready",
    mount: mountPostProcessingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: postProcessingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(postProcessingLessonRuntimeSource, [
          [1, 15],
          [42, 62],
          [125, 226],
          [228, 299],
          [302, 393],
        ]),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: postProcessingMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: postProcessingCubeDataSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: postProcessingSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: postProcessingSceneFragmentShaderSource,
      },
      {
        id: "post-vertex-shader",
        filename: "post.vert.wgsl",
        language: "wgsl",
        content: postProcessingVertexShaderSource,
      },
      {
        id: "post-fragment-shader",
        filename: "post.frag.wgsl",
        language: "wgsl",
        content: postProcessingFragmentShaderSource,
      },
    ],
  },
{
    id: "16-ping-pong-blur",
    order: 21,
    title: "多 Pass Blur",
    tagline: "让两张中间纹理来回接力做模糊",
    goal: "理解 ping-pong render target、横向/纵向分离 blur，以及为什么复杂后处理往往需要一串连续的 pass。",
    summary:
      "这一课把上一课的单次后处理升级成真正的多 pass 流程：先把立方体渲染进 scene texture，再让两张 blur texture 水平、垂直地来回接力，最后把原图和 blur 结果一起展示到屏幕上。",
    notes: [
      "`ping-pong texture`：两张中间纹理交替担任“当前 pass 的输出”和“下一 pass 的输入”。",
      "`separable blur`：把二维模糊拆成横向和纵向两次采样，既更高效，也更容易理解多 pass 链路。",
      "`为什么这里至少要两张 blur 纹理`：同一个 pass 里不能一边从某张纹理采样，一边又把结果写回它自己，所以必须轮流接力。",
      "`scene -> blur A -> blur B -> present`：这就是比上一课更完整的后处理链；前面的 pass 负责准备中间结果，最后一个 pass 才真正输出到屏幕。",
      "`blurParams.direction`：每次 blur pass 只改一个方向，水平 pass 用 `(1 / width, 0)`，垂直 pass 用 `(0, 1 / height)`。",
    ],
    status: "ready",
    mount: mountPingPongBlurLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: pingPongLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(pingPongLessonRuntimeSource, [
          [1, 16],
          [24, 39],
          [50, 83],
          [167, 290],
          [292, 441],
          [472, 563],
        ]),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: pingPongMathSource,
      },
      {
        id: "cube-data",
        filename: "cube-data.ts",
        language: "ts",
        content: pingPongCubeDataSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: pingPongSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: pingPongSceneFragmentShaderSource,
      },
      {
        id: "fullscreen-vertex-shader",
        filename: "fullscreen.vert.wgsl",
        language: "wgsl",
        content: pingPongFullscreenVertexShaderSource,
      },
      {
        id: "blur-fragment-shader",
        filename: "blur.frag.wgsl",
        language: "wgsl",
        content: pingPongBlurFragmentShaderSource,
      },
      {
        id: "present-fragment-shader",
        filename: "present.frag.wgsl",
        language: "wgsl",
        content: pingPongPresentFragmentShaderSource,
      },
    ],
  },
{
    id: "22-alpha-and-blending-basics",
    order: 22,
    title: "颜色混合与 Alpha 表示",
    tagline: "先把 blend 和 alpha 的基本语义讲清楚",
    goal: "先把 `blend` 方程、`src/dst` 系数，以及 `straight alpha` / `premultiplied alpha` 这组最容易混淆的基础概念单独讲透，再进入透明排序和透明画布。",
    summary:
      "这一课会先停在最基础的一层：颜色为什么能叠在一起、alpha 到底在表达什么、以及为什么同样叫“透明”，资源表示方式不同会让混合结果和使用习惯都发生变化。",
    notes: [
      "`blend`：源颜色和目标颜色会按一组明确的 `src` / `dst` 系数组合起来。",
      "`color` 与 `alpha`：它们可以分别使用不同的混合系数，不一定总是同一套规则。",
      "`straight alpha`：RGB 保持原色，透明度只单独存在于 alpha 通道里。",
      "`premultiplied alpha`：RGB 先乘过 alpha，再进入混合；很多真实页面合成链路会偏好这种形式。",
      "`这是透明主线前置课`：先把混合本身讲清楚，后面再看排序和最终输出。",
    ],
    status: "ready",
    mount: mountAlphaAndBlendingBasicsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: alphaBlendBasicsLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(alphaBlendBasicsLessonRuntimeSource, [
          [1, 50],
          [79, 148],
          [156, 180],
          [231, 314],
          [342, 418],
          [451, 539],
        ]),
        featured: true,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: alphaBlendBasicsVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: alphaBlendBasicsFragmentShaderSource,
      },
    ],
  },
{
    id: "27-blending-and-transparency",
    order: 23,
    title: "透明排序与透明画布",
    tagline: "透明不只会混色，还要考虑顺序和最终输出",
    goal: "在已经理解 `blend` 和 alpha 表示之后，继续讲透明物体为什么需要排序，以及 `transparent canvas` 怎样影响最终页面合成。",
    summary:
      "这一课会把透明真正推进到渲染组织层面：为什么半透明物体通常不能像不透明物体那样随便提交、为什么排序仍然是绕不开的话题，以及最终输出到页面时画布本身的 alpha 又会怎么参与合成。",
    notes: [
      "`透明排序`：为什么半透明物体通常要后画，而且常常需要按距离排序。",
      "`固定顺序 vs 动态排序`：同一组透明板只要换一下提交顺序，交叠结果就会明显不同。",
      "`transparent canvas`：clear alpha 设成 0 以后，页面底纹会直接穿过 canvas 的空白像素。",
      "`这是第二课`：22 课已经把颜色混合讲清楚，这一课专门讨论透明内容怎样被正确组织与输出。",
    ],
    status: "ready",
    mount: mountBlendingAndTransparencyLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: blendingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(blendingLessonRuntimeSource, [
          [1, 68],
          [78, 223],
          [234, 321],
          [330, 421],
          [490, 799],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: blendingGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: blendingMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: blendingVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: blendingFragmentShaderSource,
      },
    ],
  },
{
    id: "29-mipmaps-and-sampler-parameters",
    order: 24,
    title: "Mipmap 与采样参数",
    tagline: "把纹理缩小、过滤和采样规则讲完整",
    goal: "补上 `mipmap`、min/mag/mipmap filter、address mode 和 LOD 这条纹理采样基础线，让纹理课从“会显示图片”升级成“真正理解采样行为”。",
    summary:
      "前面的纹理课已经能把图片贴上模型，但真正的纹理质量很多时候由采样规则决定。这一课会把 `mipmap`、过滤模式和寻址模式拆开讲，帮助大家理解“为什么有些贴图远看会闪、近看会糊”。",
    notes: [
      "`mipmap`：为什么纹理缩小时不能还拿原图硬采样，必须准备更小的层级。",
      "`magFilter / minFilter / mipmapFilter`：这三个采样参数分别在控制哪一步。",
      "`addressMode`：超出 `[0, 1]` 的 UV 为什么会 repeat、mirror 还是 clamp。",
      "`四块面板`：左上 `nearest + repeat + 固定 base level`，右上 `linear + repeat + 固定 base level`，左下 `trilinear mip + repeat`，右下 `trilinear mip + clamp-to-edge`。",
      "`采样质量与性能`：更平滑的采样结果通常意味着更多纹理读取和更大的资源成本。",
    ],
    status: "ready",
    mount: mountMipmapAndSamplerParametersLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: mipmapLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(mipmapLessonRuntimeSource, [
          [1, 53],
          [55, 225],
          [266, 454],
          [456, 626],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: mipmapGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: mipmapMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: mipmapVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: mipmapFragmentShaderSource,
      },
    ],
  },
{
    id: "28-msaa-and-alpha-to-coverage",
    order: 25,
    title: "MSAA 与 Alpha-to-Coverage",
    tagline: "把边缘抗锯齿单独讲透",
    goal: "在已经有透明和混合基础的前提下，补上 `MSAA`、sample count 和 `alpha-to-coverage` 这一组官方样例里很典型、但当前课程还没单独展开的知识点。",
    summary:
      "这一课专门讨论“边缘为什么锯齿”和“WebGPU 里常见的抗锯齿方案到底在做什么”。我们会先把传统 `MSAA` 跑通，再讲为什么带 alpha 的叶片、草、贴纸有时候会用 `alpha-to-coverage`。",
    notes: [
      "`MSAA`：覆盖率和颜色采样为什么能减少几何边缘锯齿。",
      "`sample count`：同一个 render target 开了几倍采样，后面的 resolve 和内存开销会怎么变。",
      "`alpha-to-coverage`：为什么它常被拿来处理 cutout 植被、铁丝网、毛边贴图。",
      "`左右对比`：左边是单采样硬裁切，右边是 4x MSAA + alpha-to-coverage，更容易直接看出边缘差异。",
      "`抗锯齿不是只有一种`：这一课会把 `MSAA` 和后处理抗锯齿的角色区分开。",
    ],
    status: "ready",
    mount: mountMsaaAndAlphaToCoverageLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: msaaLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(msaaLessonRuntimeSource, [
          [1, 129],
          [131, 177],
          [179, 405],
          [407, 638],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: msaaGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: msaaMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: msaaSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: msaaSceneFragmentShaderSource,
      },
      {
        id: "present-vertex-shader",
        filename: "present.vert.wgsl",
        language: "wgsl",
        content: msaaPresentVertexShaderSource,
      },
      {
        id: "present-fragment-shader",
        filename: "present.frag.wgsl",
        language: "wgsl",
        content: msaaPresentFragmentShaderSource,
      },
    ],
  },
{
    id: "30-cubemap-and-skybox",
    order: 26,
    title: "Cubemap 与天空盒",
    tagline: "让场景第一次拥有环境背景",
    goal: "补上 `cubemap`、天空盒和环境采样，让课程从“只有物体”进入“物体存在于一个环境中”。",
    summary:
      "这一课会把六张方向纹理组成一张 `cubemap`，再分别用它做天空盒和最小环境反射。这样后面的环境光照、反射和 IBL 就会有一个更自然的入口。",
    notes: [
      "`cubemap`：一张环境纹理为什么会由六个方向面组成。",
      "`skybox`：为什么天空盒看起来很远，但本质上只是一个总在相机周围的背景。",
      "`方向采样`：采样 cubemap 时输入的不再是 `uv`，而是一个方向向量。",
      "`环境贴图`：这节会把“背景图”和“反射来源”联系起来。",
    ],
    status: "ready",
    mount: mountCubemapAndSkyboxLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: cubemapLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(cubemapLessonRuntimeSource, [
          [1, 117],
          [120, 232],
          [241, 371],
          [376, 559],
          [563, 729],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: cubemapGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: cubemapMathSource,
      },
      {
        id: "reflective-vertex-shader",
        filename: "reflective.vert.wgsl",
        language: "wgsl",
        content: cubemapReflectiveVertexShaderSource,
      },
      {
        id: "reflective-fragment-shader",
        filename: "reflective.frag.wgsl",
        language: "wgsl",
        content: cubemapReflectiveFragmentShaderSource,
      },
      {
        id: "skybox-vertex-shader",
        filename: "skybox.vert.wgsl",
        language: "wgsl",
        content: cubemapSkyboxVertexShaderSource,
      },
      {
        id: "skybox-fragment-shader",
        filename: "skybox.frag.wgsl",
        language: "wgsl",
        content: cubemapSkyboxFragmentShaderSource,
      },
    ],
  }
];
