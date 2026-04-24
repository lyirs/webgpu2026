import type { LessonDefinition } from "@/studio/types";
import { pickCoreSourceSegments } from "@/studio/lesson-segments";
import gameOfLifeComputeShaderSource from "@/lessons/lesson-35-compute-game-of-life/game-of-life.compute.wgsl?raw";
import gameOfLifeFragmentShaderSource from "@/lessons/lesson-35-compute-game-of-life/game-of-life.frag.wgsl?raw";
import gameOfLifeLessonRuntimeSource from "@/lessons/lesson-35-compute-game-of-life/lesson.ts?raw";
import gameOfLifeSeedSource from "@/lessons/lesson-35-compute-game-of-life/seed.ts?raw";
import gameOfLifeVertexShaderSource from "@/lessons/lesson-35-compute-game-of-life/game-of-life.vert.wgsl?raw";
import { mountGameOfLifeLesson } from "@/lessons/lesson-35-compute-game-of-life/lesson";
import boidsComputeShaderSource from "@/lessons/lesson-36-compute-boids/boids.compute.wgsl?raw";
import boidsFragmentShaderSource from "@/lessons/lesson-36-compute-boids/boids.frag.wgsl?raw";
import boidsLessonRuntimeSource from "@/lessons/lesson-36-compute-boids/lesson.ts?raw";
import boidSeedSource from "@/lessons/lesson-36-compute-boids/boid-data.ts?raw";
import boidsVertexShaderSource from "@/lessons/lesson-36-compute-boids/boids.vert.wgsl?raw";
import { mountComputeBoidsLesson } from "@/lessons/lesson-36-compute-boids/lesson";
import bitonicSortComputeShaderSource from "@/lessons/lesson-37-compute-bitonic-sort/bitonic-sort.compute.wgsl?raw";
import bitonicSortFragmentShaderSource from "@/lessons/lesson-37-compute-bitonic-sort/bitonic-sort.frag.wgsl?raw";
import bitonicSortLessonRuntimeSource from "@/lessons/lesson-37-compute-bitonic-sort/lesson.ts?raw";
import sortSeedSource from "@/lessons/lesson-37-compute-bitonic-sort/sort-data.ts?raw";
import bitonicSortVertexShaderSource from "@/lessons/lesson-37-compute-bitonic-sort/bitonic-sort.vert.wgsl?raw";
import { mountBitonicSortLesson } from "@/lessons/lesson-37-compute-bitonic-sort/lesson";
import reversedZGeometrySource from "@/lessons/lesson-38-reversed-z-and-depth-precision/geometry.ts?raw";
import reversedZLessonRuntimeSource from "@/lessons/lesson-38-reversed-z-and-depth-precision/lesson.ts?raw";
import reversedZMathSource from "@/lessons/lesson-38-reversed-z-and-depth-precision/math.ts?raw";
import reversedZPresentFragmentShaderSource from "@/lessons/lesson-38-reversed-z-and-depth-precision/present.frag.wgsl?raw";
import reversedZPresentVertexShaderSource from "@/lessons/lesson-38-reversed-z-and-depth-precision/present.vert.wgsl?raw";
import reversedZSceneFragmentShaderSource from "@/lessons/lesson-38-reversed-z-and-depth-precision/scene.frag.wgsl?raw";
import reversedZSceneVertexShaderSource from "@/lessons/lesson-38-reversed-z-and-depth-precision/scene.vert.wgsl?raw";
import { mountReversedZAndDepthPrecisionLesson } from "@/lessons/lesson-38-reversed-z-and-depth-precision/lesson";
import stencilGeometrySource from "@/lessons/lesson-39-stencil-mask-and-outline/geometry.ts?raw";
import stencilLessonRuntimeSource from "@/lessons/lesson-39-stencil-mask-and-outline/lesson.ts?raw";
import stencilMathSource from "@/lessons/lesson-39-stencil-mask-and-outline/math.ts?raw";
import stencilOutlineFragmentShaderSource from "@/lessons/lesson-39-stencil-mask-and-outline/outline.frag.wgsl?raw";
import stencilSceneFragmentShaderSource from "@/lessons/lesson-39-stencil-mask-and-outline/scene.frag.wgsl?raw";
import stencilSceneVertexShaderSource from "@/lessons/lesson-39-stencil-mask-and-outline/scene.vert.wgsl?raw";
import { mountStencilMaskAndOutlineLesson } from "@/lessons/lesson-39-stencil-mask-and-outline/lesson";
import deferredGeometrySource from "@/lessons/lesson-40-deferred-rendering/geometry.ts?raw";
import deferredGBufferFragmentShaderSource from "@/lessons/lesson-40-deferred-rendering/gbuffer.frag.wgsl?raw";
import deferredGBufferVertexShaderSource from "@/lessons/lesson-40-deferred-rendering/gbuffer.vert.wgsl?raw";
import deferredLessonRuntimeSource from "@/lessons/lesson-40-deferred-rendering/lesson.ts?raw";
import deferredLightingFragmentShaderSource from "@/lessons/lesson-40-deferred-rendering/lighting.frag.wgsl?raw";
import deferredLightingVertexShaderSource from "@/lessons/lesson-40-deferred-rendering/lighting.vert.wgsl?raw";
import deferredMathSource from "@/lessons/lesson-40-deferred-rendering/math.ts?raw";
import { mountDeferredRenderingLesson } from "@/lessons/lesson-40-deferred-rendering/lesson";
import deferredTransparentForwardFragmentShaderSource from "@/lessons/lesson-41-deferred-transparent-objects/forward.frag.wgsl?raw";
import deferredTransparentForwardVertexShaderSource from "@/lessons/lesson-41-deferred-transparent-objects/forward.vert.wgsl?raw";
import deferredTransparentGBufferFragmentShaderSource from "@/lessons/lesson-41-deferred-transparent-objects/gbuffer.frag.wgsl?raw";
import deferredTransparentGBufferVertexShaderSource from "@/lessons/lesson-41-deferred-transparent-objects/gbuffer.vert.wgsl?raw";
import deferredTransparentGeometrySource from "@/lessons/lesson-41-deferred-transparent-objects/geometry.ts?raw";
import deferredTransparentLessonRuntimeSource from "@/lessons/lesson-41-deferred-transparent-objects/lesson.ts?raw";
import deferredTransparentLightingFragmentShaderSource from "@/lessons/lesson-41-deferred-transparent-objects/lighting.frag.wgsl?raw";
import deferredTransparentLightingVertexShaderSource from "@/lessons/lesson-41-deferred-transparent-objects/lighting.vert.wgsl?raw";
import deferredTransparentMathSource from "@/lessons/lesson-41-deferred-transparent-objects/math.ts?raw";
import deferredTransparentPresentFragmentShaderSource from "@/lessons/lesson-41-deferred-transparent-objects/present.frag.wgsl?raw";
import deferredTransparentPresentVertexShaderSource from "@/lessons/lesson-41-deferred-transparent-objects/present.vert.wgsl?raw";
import { mountDeferredTransparentObjectsLesson } from "@/lessons/lesson-41-deferred-transparent-objects/lesson";
import gpuQueriesFragmentShaderSource from "@/lessons/lesson-42-gpu-queries-and-profiling/scene.frag.wgsl?raw";
import gpuQueriesGeometrySource from "@/lessons/lesson-42-gpu-queries-and-profiling/geometry.ts?raw";
import gpuQueriesLessonRuntimeSource from "@/lessons/lesson-42-gpu-queries-and-profiling/lesson.ts?raw";
import gpuQueriesMathSource from "@/lessons/lesson-42-gpu-queries-and-profiling/math.ts?raw";
import gpuQueriesVertexShaderSource from "@/lessons/lesson-42-gpu-queries-and-profiling/scene.vert.wgsl?raw";
import { mountGpuQueriesAndProfilingLesson } from "@/lessons/lesson-42-gpu-queries-and-profiling/lesson";
import renderBundlesFragmentShaderSource from "@/lessons/lesson-43-render-bundles/scene.frag.wgsl?raw";
import renderBundlesGeometrySource from "@/lessons/lesson-43-render-bundles/geometry.ts?raw";
import renderBundlesLessonRuntimeSource from "@/lessons/lesson-43-render-bundles/lesson.ts?raw";
import renderBundlesMathSource from "@/lessons/lesson-43-render-bundles/math.ts?raw";
import renderBundlesVertexShaderSource from "@/lessons/lesson-43-render-bundles/scene.vert.wgsl?raw";
import { mountRenderBundlesLesson } from "@/lessons/lesson-43-render-bundles/lesson";
import hidpiSizingFragmentShaderSource from "@/lessons/lesson-44-hidpi-canvas-sizing/scene.frag.wgsl?raw";
import hidpiSizingGeometrySource from "@/lessons/lesson-44-hidpi-canvas-sizing/geometry.ts?raw";
import hidpiSizingLessonRuntimeSource from "@/lessons/lesson-44-hidpi-canvas-sizing/lesson.ts?raw";
import hidpiSizingMathSource from "@/lessons/lesson-44-hidpi-canvas-sizing/math.ts?raw";
import hidpiSizingPresentShaderSource from "@/lessons/lesson-44-hidpi-canvas-sizing/present.wgsl?raw";
import hidpiSizingVertexShaderSource from "@/lessons/lesson-44-hidpi-canvas-sizing/scene.vert.wgsl?raw";
import { mountHiDpiCanvasSizingLesson } from "@/lessons/lesson-44-hidpi-canvas-sizing/lesson";
import hidpiMultiCanvasFragmentShaderSource from "@/lessons/lesson-45-hidpi-and-multiple-canvases/scene.frag.wgsl?raw";
import hidpiMultiCanvasGeometrySource from "@/lessons/lesson-45-hidpi-and-multiple-canvases/geometry.ts?raw";
import hidpiMultiCanvasLessonRuntimeSource from "@/lessons/lesson-45-hidpi-and-multiple-canvases/lesson.ts?raw";
import hidpiMultiCanvasMathSource from "@/lessons/lesson-45-hidpi-and-multiple-canvases/math.ts?raw";
import hidpiMultiCanvasVertexShaderSource from "@/lessons/lesson-45-hidpi-and-multiple-canvases/scene.vert.wgsl?raw";
import { mountHiDpiAndMultipleCanvasesLesson } from "@/lessons/lesson-45-hidpi-and-multiple-canvases/lesson";
import primitivePickingGeometrySource from "@/lessons/lesson-30-primitive-picking/geometry.ts?raw";
import primitivePickingLessonRuntimeSource from "@/lessons/lesson-30-primitive-picking/lesson.ts?raw";
import primitivePickingMathSource from "@/lessons/lesson-30-primitive-picking/math.ts?raw";
import primitivePickingFragmentShaderSource from "@/lessons/lesson-30-primitive-picking/picking.frag.wgsl?raw";
import primitivePickingVertexShaderSource from "@/lessons/lesson-30-primitive-picking/picking.vert.wgsl?raw";
import primitivePickingSceneFragmentShaderSource from "@/lessons/lesson-30-primitive-picking/scene.frag.wgsl?raw";
import primitivePickingSceneVertexShaderSource from "@/lessons/lesson-30-primitive-picking/scene.vert.wgsl?raw";
import { mountPrimitivePickingLesson } from "@/lessons/lesson-30-primitive-picking/lesson";
import gltfBasicParserSource from "@/lessons/lesson-27-gltf-basic/glb.ts?raw";
import gltfBasicLessonRuntimeSource from "@/lessons/lesson-27-gltf-basic/lesson.ts?raw";
import gltfBasicMathSource from "@/lessons/lesson-27-gltf-basic/math.ts?raw";
import gltfBasicFragmentShaderSource from "@/lessons/lesson-27-gltf-basic/model.frag.wgsl?raw";
import gltfBasicVertexShaderSource from "@/lessons/lesson-27-gltf-basic/model.vert.wgsl?raw";
import { mountGltfBasicLesson } from "@/lessons/lesson-27-gltf-basic/lesson";
import gltfTexturesParserSource from "@/lessons/lesson-28-gltf-textures/glb.ts?raw";
import gltfTexturesLessonRuntimeSource from "@/lessons/lesson-28-gltf-textures/lesson.ts?raw";
import gltfTexturesMathSource from "@/lessons/lesson-28-gltf-textures/math.ts?raw";
import gltfTexturesFragmentShaderSource from "@/lessons/lesson-28-gltf-textures/model.frag.wgsl?raw";
import gltfTexturesVertexShaderSource from "@/lessons/lesson-28-gltf-textures/model.vert.wgsl?raw";
import { mountGltfTexturesLesson } from "@/lessons/lesson-28-gltf-textures/lesson";
import gltfSceneIntegrationLessonRuntimeSource from "@/lessons/lesson-29-gltf-scene-integration/lesson.ts?raw";
import gltfSceneIntegrationMathSource from "@/lessons/lesson-29-gltf-scene-integration/math.ts?raw";
import gltfSceneIntegrationFragmentShaderSource from "@/lessons/lesson-29-gltf-scene-integration/model.frag.wgsl?raw";
import gltfSceneIntegrationVertexShaderSource from "@/lessons/lesson-29-gltf-scene-integration/model.vert.wgsl?raw";
import { mountGltfSceneIntegrationLesson } from "@/lessons/lesson-29-gltf-scene-integration/lesson";
import gltfAnimationParserSource from "@/lessons/lesson-31-gltf-animation-basic/gltf.ts?raw";
import gltfAnimationLessonRuntimeSource from "@/lessons/lesson-31-gltf-animation-basic/lesson.ts?raw";
import gltfAnimationMathSource from "@/lessons/lesson-31-gltf-animation-basic/math.ts?raw";
import gltfAnimationFragmentShaderSource from "@/lessons/lesson-31-gltf-animation-basic/model.frag.wgsl?raw";
import gltfAnimationVertexShaderSource from "@/lessons/lesson-31-gltf-animation-basic/model.vert.wgsl?raw";
import { mountGltfAnimationBasicLesson } from "@/lessons/lesson-31-gltf-animation-basic/lesson";
import gltfPbrParserSource from "@/lessons/lesson-32-gltf-pbr-basic/glb.ts?raw";
import gltfPbrLessonRuntimeSource from "@/lessons/lesson-32-gltf-pbr-basic/lesson.ts?raw";
import gltfPbrMathSource from "@/lessons/lesson-32-gltf-pbr-basic/math.ts?raw";
import gltfPbrFragmentShaderSource from "@/lessons/lesson-32-gltf-pbr-basic/model.frag.wgsl?raw";
import gltfPbrVertexShaderSource from "@/lessons/lesson-32-gltf-pbr-basic/model.vert.wgsl?raw";
import { mountGltfPbrBasicLesson } from "@/lessons/lesson-32-gltf-pbr-basic/lesson";
import iblLessonRuntimeSource from "@/lessons/lesson-33-ibl-and-image-based-lighting/lesson.ts?raw";
import iblModelFragmentShaderSource from "@/lessons/lesson-33-ibl-and-image-based-lighting/model.frag.wgsl?raw";
import iblModelVertexShaderSource from "@/lessons/lesson-33-ibl-and-image-based-lighting/model.vert.wgsl?raw";
import iblSkyboxFragmentShaderSource from "@/lessons/lesson-33-ibl-and-image-based-lighting/skybox.frag.wgsl?raw";
import iblSkyboxVertexShaderSource from "@/lessons/lesson-33-ibl-and-image-based-lighting/skybox.vert.wgsl?raw";
import { mountIblAndImageBasedLightingLesson } from "@/lessons/lesson-33-ibl-and-image-based-lighting/lesson";
import gltfSkinningParserSource from "@/lessons/lesson-34-gltf-skinning-basic/gltf.ts?raw";
import gltfSkinningLessonRuntimeSource from "@/lessons/lesson-34-gltf-skinning-basic/lesson.ts?raw";
import gltfSkinningMathSource from "@/lessons/lesson-34-gltf-skinning-basic/math.ts?raw";
import gltfSkinningFragmentShaderSource from "@/lessons/lesson-34-gltf-skinning-basic/model.frag.wgsl?raw";
import gltfSkinningVertexShaderSource from "@/lessons/lesson-34-gltf-skinning-basic/model.vert.wgsl?raw";
import { mountGltfSkinningBasicLesson } from "@/lessons/lesson-34-gltf-skinning-basic/lesson";

export const lessons27To45: LessonDefinition[] = [
{
    id: "17-gltf-basic",
    order: 27,
    title: "glTF 基础加载",
    tagline: "先把外部模型正确显示出来",
    goal: "理解 GLB header、JSON chunk、BIN chunk、bufferView、accessor 和 node transform，先走通“把外部模型画出来”的最小链路。",
    summary:
      "这一课会第一次接入真正的外部 3D 资源。我们不会一口气把 glTF 全部吃完，而是只抓最小主线：解析 GLB 的二进制结构，读出 POSITION / NORMAL / indices，再把 node transform 接进 WebGPU，把模型正确显示出来。",
    notes: [
      "`GLB header + JSON chunk + BIN chunk`：`.glb` 不是神秘黑盒，它本质上就是文件头、场景描述 JSON 和真正几何字节数据的组合。",
      "`bufferView` 与 `accessor`：`bufferView` 先圈出一段原始字节区间，`accessor` 再告诉我们这段字节应该按什么类型、多少个元素去解释。",
      "`POSITION`、`NORMAL`、`indices`：这一课先只接最关键的三类数据，让模型先被正确画出来，贴图和材质留到后面继续接。",
      "`node transform`：glTF 节点既可能直接给 `matrix`，也可能拆成 `translation / rotation / scale`，最后都要还原成同一种 `model matrix`。",
      "`glTF loader` 不是一开始就要做成完整引擎：先把最小加载链路吃透，后面再逐步加材质、纹理和更复杂的场景结构。",
    ],
    status: "ready",
    mount: mountGltfBasicLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gltfBasicLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gltfBasicLessonRuntimeSource, [
          [1, 14],
          [22, 57],
          [114, 228],
          [230, 335],
        ]),
        featured: true,
      },
      {
        id: "glb-parser",
        filename: "glb.ts",
        language: "ts",
        content: gltfBasicParserSource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gltfBasicMathSource,
      },
      {
        id: "model-vertex-shader",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: gltfBasicVertexShaderSource,
      },
      {
        id: "model-fragment-shader",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: gltfBasicFragmentShaderSource,
      },
    ],
  },
{
    id: "18-gltf-textures",
    order: 28,
    title: "glTF 材质与贴图",
    tagline: "把 baseColorTexture 接进 shader",
    goal: "在基础加载上继续接入 `TEXCOORD_0`、images、textures、samplers 和 `baseColorTexture`，把模型真正贴上颜色与细节。",
    summary:
      "这一课继续沿用上一课的 GLB 解析链路，但只再往前走一小步：把嵌在 GLB 里的图片解码成纹理，把 glTF 的 `texture + sampler` 对应到 WebGPU 资源，然后在 fragment shader 里按 UV 采样 `baseColorTexture`。",
    notes: [
      "`TEXCOORD_0`：光有 POSITION 和 NORMAL 还不够，贴图真正落到模型表面还需要每个顶点自己的 UV 坐标。",
      "`images` + `bufferView`：在 `.glb` 里，贴图图片本身也可能直接嵌在 BIN chunk 里，这一课会把那段字节重新解码出来。",
      "`textures` 与 `samplers`：glTF 里的 texture 负责把图片 source 和采样规则绑定在一起，WebGPU 里则要分别创建 `GPUTexture` 和 `GPUSampler`。",
      "`createImageBitmap()` + `queue.copyExternalImageToTexture()`：先把 GLB 内嵌图片解码成浏览器位图，再真正上传到 GPUTexture。",
      "`material.pbrMetallicRoughness.baseColorTexture`：这一课先只接 glTF 里最基础的底色贴图链路，先不展开完整 PBR。",
      "`textureSample(baseColorTexture, baseColorSampler, uv)`：fragment shader 终于不再只看法线和常量颜色，而是开始按模型自己的 UV 读取外部材质。",
    ],
    status: "ready",
    mount: mountGltfTexturesLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gltfTexturesLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gltfTexturesLessonRuntimeSource, [
          [1, 17],
          [25, 64],
          [134, 265],
          [267, 374],
        ]),
        featured: true,
      },
      {
        id: "glb-parser",
        filename: "glb.ts",
        language: "ts",
        content: gltfTexturesParserSource,
        displaySegments: pickCoreSourceSegments(gltfTexturesParserSource, [
          [1, 169],
          [172, 315],
          [317, 498],
          [500, 711],
        ]),
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gltfTexturesMathSource,
      },
      {
        id: "model-vertex-shader",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: gltfTexturesVertexShaderSource,
      },
      {
        id: "model-fragment-shader",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: gltfTexturesFragmentShaderSource,
      },
    ],
  },
{
    id: "19-gltf-scene-integration",
    order: 29,
    title: "glTF 场景整合",
    tagline: "把外部模型真正接进场景树",
    goal: "把上一课里已经加载好的 glTF 资产真正当成场景对象来组织，理解“资产只加载一次、节点可以多次实例化”的整合方式。",
    summary:
      "这一课不再继续展开 glTF 新格式点，而是把已经拿到的外部模型接进“场景树”这条主线：先把 glTF 视为一份可复用模型资产，再用多个节点反复实例化它，让 `local matrix / world matrix` 真正作用到外部资源上。",
    notes: [
      "`LoadedModelAsset`：glTF 被加载完成后，不必每次都重新解析；它更像一份可以被场景系统重复引用的共享模型资产。",
      "`createModelSceneNode()`：每个实例节点都会各自持有自己的 node uniform，但共享同一份 mesh / texture / sampler。",
      "`appendChild()` + `updateWorldMatrix()`：一旦外部模型被接进场景树，它和之前多物体场景课里的立方体节点就没有本质区别了。",
      "`instance` 和 `scene node` 不一样：这一课不是让 GPU 自动复制，而是让 CPU 侧场景系统把同一份 glTF 资产放进多个节点里。",
      "`drawSceneNode()`：真正发出 draw 时，外层场景节点的世界矩阵还会再乘上 glTF 内部 drawable 自己的 baseWorldMatrix。",
    ],
    status: "ready",
    mount: mountGltfSceneIntegrationLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gltfSceneIntegrationLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(
          gltfSceneIntegrationLessonRuntimeSource,
          [
            [1, 87],
            [89, 256],
            [264, 462],
            [464, 547],
          ]
        ),
        featured: true,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gltfSceneIntegrationMathSource,
      },
      {
        id: "model-vertex-shader",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: gltfSceneIntegrationVertexShaderSource,
      },
      {
        id: "model-fragment-shader",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: gltfSceneIntegrationFragmentShaderSource,
      },
    ],
  },
{
    id: "31-primitive-picking",
    order: 30,
    title: "Picking 与对象选择",
    tagline: "让鼠标真的能点中场景里的东西",
    goal: "补上场景交互里最常见的 GPU picking 主线，理解为什么要先画一张对象 ID 颜色图，再通过读回像素确定用户点中了谁。",
    summary:
      "这一课会让 WebGPU 场景第一次真正响应鼠标点击。我们不会一开始就上复杂射线求交，而是先走最稳的 GPU 路线：用一遍离屏 render pass 给每个对象写入唯一 ID 颜色，再把点击像素读回 CPU，反查用户到底点中了哪个对象。",
    notes: [
      "`ID buffer`：每个可选对象在离屏纹理里都用唯一颜色编号表示，这样点击时只要读回一个像素就能知道是谁。",
      "`copyTextureToBuffer()`：GPU 里那张 picking 纹理不会自动回到 CPU，这一步负责把点击像素复制到可读缓冲区。",
      "`mapAsync()` 与 `getMappedRange()`：只有等 GPU 写完，再把缓冲区映射给 CPU，才能安全读到对象编号。",
      "`主场景 pass` 与 `picking pass`：用户看到的是正常颜色场景，但背后其实还维护着一张专门用于交互的离屏结果。",
      "`选中高亮`：读回的对象 ID 最终会回到主场景里，变成一层明确可见的高亮反馈。",
    ],
    status: "ready",
    mount: mountPrimitivePickingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: primitivePickingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(primitivePickingLessonRuntimeSource, [
          [1, 132],
          [140, 152],
          [160, 432],
          [443, 632],
          [639, 732],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: primitivePickingGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: primitivePickingMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: primitivePickingSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: primitivePickingSceneFragmentShaderSource,
      },
      {
        id: "picking-vertex-shader",
        filename: "picking.vert.wgsl",
        language: "wgsl",
        content: primitivePickingVertexShaderSource,
      },
      {
        id: "picking-fragment-shader",
        filename: "picking.frag.wgsl",
        language: "wgsl",
        content: primitivePickingFragmentShaderSource,
      },
    ],
  },
{
    id: "24-gltf-animation-basic",
    order: 31,
    title: "glTF 动画基础",
    tagline: "让节点自己的 TRS 按关键帧动起来",
    goal: "理解 glTF 里的 animation sampler、channel 和 target path，先走通 `translation / rotation / scale` 关键帧动画的最小链路。",
    summary:
      "这一课继续沿用外部模型资产，但重点从“把模型显示出来”转到“让 glTF 节点自己按动画数据动起来”。我们先不碰骨骼和 morph target，只抓最基础、也最容易看懂的 TRS 关键帧动画。",
    notes: [
      "`animations`：glTF 会把动画独立存成 animation clip，里面再拆成 sampler 和 channel，而不是把“怎么动”直接写死在节点里。",
      "`sampler.input` + `sampler.output`：一条动画曲线至少要知道“关键帧时间”以及“每个关键帧对应的值”。",
      "`channel.target.path`：这一课先只接最基础的三种路径，也就是 `translation`、`rotation` 和 `scale`。",
      "`LINEAR`：平移和缩放可以直接做线性插值，旋转则要把四元数按最短路径插值，才能保持姿态变化自然。",
      "`节点动画`：真正动起来的不是 mesh buffer，而是节点自己的 TRS，所以动画更新后还要重新组合 `local matrix`，再递归算整棵树的 `world matrix`。",
      "`先不碰骨骼`：这一课的目标只是把 glTF 动画系统的最小概念吃透，skin 和更复杂的角色动画留到后面再展开。",
    ],
    status: "ready",
    mount: mountGltfAnimationBasicLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gltfAnimationLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gltfAnimationLessonRuntimeSource, [
          [1, 142],
          [144, 354],
          [356, 397],
          [399, 600],
        ]),
        featured: true,
      },
      {
        id: "gltf-parser",
        filename: "gltf.ts",
        language: "ts",
        content: gltfAnimationParserSource,
        displaySegments: pickCoreSourceSegments(gltfAnimationParserSource, [
          [1, 120],
          [122, 323],
          [325, 452],
        ]),
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gltfAnimationMathSource,
      },
      {
        id: "model-vertex-shader",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: gltfAnimationVertexShaderSource,
      },
      {
        id: "model-fragment-shader",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: gltfAnimationFragmentShaderSource,
      },
    ],
  },
{
    id: "25-gltf-pbr-basic",
    order: 32,
    title: "PBR 基础",
    tagline: "把 metallic / roughness / normal 接进 glTF",
    goal: "在 glTF 贴图模型的基础上继续接入 metallic-roughness 和 normal map，理解更完整的材质光照是怎么从几张纹理共同决定的。",
    summary:
      "这一课继续使用外部 glTF 头盔模型，但重点从“把贴图显示出来”升级成“让材质真正影响光照”。我们会接入 `baseColorTexture`、`metallicRoughnessTexture` 和 `normalTexture`，并用一套最小 Cook-Torrance PBR 把它们串起来。",
    notes: [
      "`baseColor`、`metallic`、`roughness`：PBR 不再只靠一张颜色贴图决定外观，而是把“是什么材质、表面多粗糙”拆成不同参数共同参与计算。",
      "`metallicRoughnessTexture`：glTF 里通常把 roughness 放在 G 通道、metallic 放在 B 通道，所以 shader 读取后还要按通道拆开。",
      "`normalTexture`：normal map 不是直接替代模型法线，而是提供切线空间里的细节扰动，最后还要变换回世界空间。",
      "`Cook-Torrance`：这一课先用最小版的 `distribution + geometry + fresnel`，让大家看懂 PBR 不是魔法，而是把漫反射和镜面反射拆开算。",
      "`PBR 不是完整引擎终点`：这一课先只接最核心的 `baseColor / metallic / roughness / normal`，occlusion、emissive 和 IBL 留到后面再展开。",
    ],
    status: "ready",
    mount: mountGltfPbrBasicLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gltfPbrLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gltfPbrLessonRuntimeSource, [
          [1, 90],
          [92, 133],
          [135, 307],
          [309, 446],
        ]),
        featured: true,
      },
      {
        id: "glb-parser",
        filename: "glb.ts",
        language: "ts",
        content: gltfPbrParserSource,
        displaySegments: pickCoreSourceSegments(gltfPbrParserSource, [
          [1, 140],
          [147, 454],
          [456, 767],
        ]),
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gltfPbrMathSource,
      },
      {
        id: "model-vertex-shader",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: gltfPbrVertexShaderSource,
      },
      {
        id: "model-fragment-shader",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: gltfPbrFragmentShaderSource,
      },
    ],
  },
{
    id: "25-ibl-and-image-based-lighting",
    order: 33,
    title: "IBL 与环境贴图照明",
    tagline: "让环境第一次真正进入 PBR 光照",
    goal: "在已有 `cubemap` 和 `PBR` 基础之后，继续把环境贴图从“背景”升级成真正的光照来源，理解 image-based lighting 为什么能让材质开始真正“吃环境”。",
    summary:
      "这一课会继续沿用头盔模型和环境 cubemap，但重点不再是把天空画出来，而是把同一张环境图同时接进漫反射环境色和镜面反射。这样 `PBR 基础` 里那种只靠一盏主光的材质，会第一次真正拥有“周围世界正在发光给我看”的感觉。",
    notes: [
      "`IBL`：环境图不再只是背景，它也会成为材质采样到的光照来源。",
      "`diffuse / specular environment`：粗糙表面更像在吃环境漫反射，光滑金属更像在读环境反射。",
      "`同一张 cubemap`：天空盒看到的内容和材质反射回来的内容来自同一套方向采样。",
      "`PBR 继续往前走`：这节课会把上一课的 Cook-Torrance 直射项保留下来，再叠加环境项。",
      "`这不是完整工业 IBL 终点`：我们先用教学版环境漫反射和反射近似，把核心关系讲透，BRDF LUT 和预过滤贴图可以留到更后面。",
    ],
    status: "ready",
    mount: mountIblAndImageBasedLightingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: iblLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(iblLessonRuntimeSource, [
          [1, 80],
          [92, 322],
          [330, 443],
          [460, 736],
          [738, 966],
        ]),
        featured: true,
      },
      {
        id: "glb-parser",
        filename: "glb.ts",
        language: "ts",
        content: gltfPbrParserSource,
        displaySegments: pickCoreSourceSegments(gltfPbrParserSource, [
          [1, 140],
          [147, 454],
          [456, 767],
        ]),
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gltfPbrMathSource,
      },
      {
        id: "model-vertex-shader",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: iblModelVertexShaderSource,
      },
      {
        id: "model-fragment-shader",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: iblModelFragmentShaderSource,
      },
      {
        id: "skybox-vertex-shader",
        filename: "skybox.vert.wgsl",
        language: "wgsl",
        content: iblSkyboxVertexShaderSource,
      },
      {
        id: "skybox-fragment-shader",
        filename: "skybox.frag.wgsl",
        language: "wgsl",
        content: iblSkyboxFragmentShaderSource,
      },
    ],
  },
{
    id: "26-gltf-skinning-basic",
    order: 34,
    title: "glTF 骨骼动画基础",
    tagline: "让顶点第一次真正跟着关节一起弯起来",
    goal: "在 glTF 节点动画之后继续接入 `skin`、`JOINTS_0`、`WEIGHTS_0` 和 `inverseBindMatrices`，理解顶点为什么会被一组 joint matrix 一起驱动。",
    summary:
      "这一课不再只是让节点自己做 `translation / rotation / scale`，而是第一次进入真正的角色动画主线：mesh 顶点各自带着 joints 和 weights，运行时再把当前关节姿态组合成 joint matrices，最后由 vertex shader 完成 skinning。",
    notes: [
      "`skin`：glTF 会把“这张网格受哪些 joint 控制、它们的绑定姿态是什么”单独存成 skin，而不是塞进 mesh 本身。",
      "`JOINTS_0` + `WEIGHTS_0`：每个顶点都会记住“我受哪几根骨骼影响、每根骨骼影响多少”，这样 shader 才知道该怎么混合 joint matrix。",
      "`inverseBindMatrices`：绑定姿态下每根骨骼都要有一张逆矩阵，这样当前关节姿态才能和 mesh 当初绑定时的坐标系对齐。",
      "`joint matrix`：真正送进 shader 的不是节点 TRS 本身，而是 `meshInverse * jointWorld * inverseBindMatrix` 组合出来的结果。",
      "`skinning`：这一课先用最小版线性蒙皮，把顶点按 weights 混合多根 joint matrix，先吃透“骨骼怎么带着顶点动”。",
    ],
    status: "ready",
    mount: mountGltfSkinningBasicLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gltfSkinningLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gltfSkinningLessonRuntimeSource, [
          [1, 147],
          [149, 335],
          [337, 378],
          [380, 718],
        ]),
        featured: true,
      },
      {
        id: "gltf-parser",
        filename: "gltf.ts",
        language: "ts",
        content: gltfSkinningParserSource,
        displaySegments: pickCoreSourceSegments(gltfSkinningParserSource, [
          [1, 128],
          [130, 335],
          [337, 519],
        ]),
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gltfSkinningMathSource,
      },
      {
        id: "model-vertex-shader",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: gltfSkinningVertexShaderSource,
      },
      {
        id: "model-fragment-shader",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: gltfSkinningFragmentShaderSource,
      },
    ],
  },
{
      id: "39-compute-game-of-life",
      order: 35,
      title: "Compute：Game of Life",
      tagline: "用最经典的二维网格模拟理解 compute",
    goal: "在已有粒子 compute 之后，再补一个更规则、也更经典的 compute 例子，让 storage buffer / ping-pong state 的思路更稳固。",
    summary:
      "这一课会用生命游戏做一个更容易观察的 compute 案例。相比粒子，这种规则网格模拟更适合帮助学习者看清楚“上一状态 -> 下一状态”的数据流，以及 compute 为什么特别适合做这类更新。",
    notes: [
        "`cellular automata`：每个格子的下一状态都来自附近邻居，非常适合讲 compute 的并行性。",
        "`ping-pong state`：模拟类 compute 常常需要两份状态轮流读写。",
        "`compute 不只做粒子`：这节会让人看到它也很擅长规则网格更新。",
        "`结果可视化`：compute 最好配一个简单直接的可视化输出，这样更容易调试。",
      ],
      status: "ready",
      mount: mountGameOfLifeLesson,
      sources: [
        {
          id: "lesson-runtime",
          filename: "lesson.ts",
          language: "ts",
          content: gameOfLifeLessonRuntimeSource,
          displaySegments: pickCoreSourceSegments(gameOfLifeLessonRuntimeSource, [
            [1, 23],
            [31, 154],
            [156, 220],
            [228, 301],
          ]),
          featured: true,
        },
        {
          id: "seed-helper",
          filename: "seed.ts",
          language: "ts",
          content: gameOfLifeSeedSource,
        },
        {
          id: "compute-shader",
          filename: "game-of-life.compute.wgsl",
          language: "wgsl",
          content: gameOfLifeComputeShaderSource,
        },
        {
          id: "vertex-shader",
          filename: "game-of-life.vert.wgsl",
          language: "wgsl",
          content: gameOfLifeVertexShaderSource,
        },
        {
          id: "fragment-shader",
          filename: "game-of-life.frag.wgsl",
          language: "wgsl",
          content: gameOfLifeFragmentShaderSource,
        },
      ],
    },
{
      id: "40-compute-boids",
      order: 36,
      title: "Compute：Boids 群集",
      tagline: "把粒子推进成真正的群体行为",
    goal: "补上官方 sample 里很经典的 `computeBoids`，让 compute 从“单体更新”走到“粒子彼此影响”的阶段。",
    summary:
      "这一课会在已有 compute 和粒子基础上，进一步进入群体行为模拟。相比生命游戏，它更接近动态系统；相比之前的粒子课，它又真正引入了粒子之间的交互规则。",
    notes: [
        "`alignment / cohesion / separation`：Boids 最经典的三条群体规则。",
        "`粒子互相影响`：这会把 compute 的数据依赖和性能压力都往前推进一步。",
        "`模拟与渲染分层`：更新规则在 compute 里，真正画出来还是 render pass 的职责。",
        "`这是从 demo 到系统的过渡`：很适合作为更复杂 GPU 模拟的踏板。",
      ],
      status: "ready",
      mount: mountComputeBoidsLesson,
      sources: [
        {
          id: "lesson-runtime",
          filename: "lesson.ts",
          language: "ts",
          content: boidsLessonRuntimeSource,
          displaySegments: pickCoreSourceSegments(boidsLessonRuntimeSource, [
            [1, 36],
            [44, 208],
            [214, 279],
          ]),
          featured: true,
        },
        {
          id: "seed-helper",
          filename: "boid-data.ts",
          language: "ts",
          content: boidSeedSource,
        },
        {
          id: "compute-shader",
          filename: "boids.compute.wgsl",
          language: "wgsl",
          content: boidsComputeShaderSource,
        },
        {
          id: "vertex-shader",
          filename: "boids.vert.wgsl",
          language: "wgsl",
          content: boidsVertexShaderSource,
        },
        {
          id: "fragment-shader",
          filename: "boids.frag.wgsl",
          language: "wgsl",
          content: boidsFragmentShaderSource,
        },
      ],
    },
{
    id: "41-compute-bitonic-sort",
    order: 37,
    title: "Compute：Bitonic Sort",
    tagline: "第一次在 GPU 上系统讲排序",
    goal: "补上 `bitonic sort` 这一类官方 compute 样例，建立“GPU 不只是画图，也能做并行数据整理”的认识。",
    summary:
      "这一课会从最经典的并行排序算法入手，让 compute 首次进入更偏通用 GPGPU 的方向。它会帮助大家理解 workgroup、阶段迭代和全局缓冲重排这些概念。",
    notes: [
      "`bitonic sort`：一种很适合并行执行、也很适合教学的 GPU 排序算法。",
      "`排序不是图形专属`：但它会反过来服务很多图形问题，比如透明排序、粒子排序等。",
      "`阶段式 dispatch`：这一课会让 compute 的多轮调度更有存在感。",
      "`这是 GPGPU 入门课`：比起视觉效果，它更偏数据处理能力。",
    ],
    status: "ready",
    mount: mountBitonicSortLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
          content: bitonicSortLessonRuntimeSource,
          displaySegments: pickCoreSourceSegments(bitonicSortLessonRuntimeSource, [
            [1, 83],
            [91, 295],
            [297, 385],
          ]),
          featured: true,
        },
      {
        id: "seed-helper",
        filename: "sort-data.ts",
        language: "ts",
        content: sortSeedSource,
      },
      {
        id: "compute-shader",
        filename: "bitonic-sort.compute.wgsl",
        language: "wgsl",
        content: bitonicSortComputeShaderSource,
      },
      {
        id: "vertex-shader",
        filename: "bitonic-sort.vert.wgsl",
        language: "wgsl",
        content: bitonicSortVertexShaderSource,
      },
      {
        id: "fragment-shader",
        filename: "bitonic-sort.frag.wgsl",
        language: "wgsl",
        content: bitonicSortFragmentShaderSource,
      },
    ],
  },
{
    id: "33-reversed-z-and-depth-precision",
    order: 38,
    title: "Reversed-Z 与深度精度",
    tagline: "把深度缓冲为什么会抖讲清楚",
    goal: "补上 `reversed-Z` 和深度精度问题，让大家真正理解大场景里 z-fighting、远近裁剪和平面抖动是怎么来的。",
    summary:
      "这一课会把“深度看起来只是一个数字”背后的精度问题拆开。画面里会放上中下三组前后几乎重合的测试卡片：上面近、中间中、下面远；左边用普通深度，右边用 `reversed-Z`，这样更容易直接看到“越远越难保住前景”的差别。",
    notes: [
      "`深度不是线性的`：透视投影下深度精度会更偏向近处。",
      "`z-fighting`：两个面明明几乎重合，为什么会在远处疯狂抖。",
      "`reversed-Z`：把深度方向反过来以后，为什么远处精度反而能显著改善。",
      "`近裁剪面很重要`：很多深度问题不是 far 太远，而是 near 设得太小。",
      "`左右对照`：左边维持普通 `less + clear 1`，右边改成 `greater + clear 0`，上中下三组会分别对应近 / 中 / 远距离。",
    ],
    status: "ready",
    mount: mountReversedZAndDepthPrecisionLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: reversedZLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(reversedZLessonRuntimeSource, [
          [1, 93],
          [101, 352],
          [358, 608],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: reversedZGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: reversedZMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: reversedZSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: reversedZSceneFragmentShaderSource,
      },
      {
        id: "present-vertex-shader",
        filename: "present.vert.wgsl",
        language: "wgsl",
        content: reversedZPresentVertexShaderSource,
      },
      {
        id: "present-fragment-shader",
        filename: "present.frag.wgsl",
        language: "wgsl",
        content: reversedZPresentFragmentShaderSource,
      },
    ],
  },
{
    id: "34-stencil-mask-and-outline",
    order: 39,
    title: "Stencil 蒙版与描边",
    tagline: "把模板缓冲第一次真正用起来",
    goal: "补上 `stencil` 这一组 WebGPU 基础能力，用一个最小描边或遮罩案例讲清楚它和颜色/深度缓冲的不同角色。",
    summary:
      "这一课会让模板缓冲从“API 里见过，但一直没用过”变成真正可理解的工具。我们会用一个最小描边案例，把 stencil 的写入、测试和遮罩规则拆成两遍来讲。",
    notes: [
      "`stencil`：它不是拿来存颜色，也不是拿来存深度，而是存一份很轻的“标记信息”。",
      "`第一遍写模板`：本体立方体会把自己覆盖到的像素写成 stencil = 1。",
      "`第二遍按模板差值画描边`：放大的外壳只有在 stencil != 1 的地方才会留下来。",
      "`mask`：描边只是 stencil 的一个入口，同样的写入 / 测试规则也能做局部渲染和裁剪。",
      "`depth24plus-stencil8`：这一课会第一次把深度和模板缓冲绑在同一张附件上。 ",
    ],
    status: "ready",
    mount: mountStencilMaskAndOutlineLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: stencilLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(stencilLessonRuntimeSource, [
          [1, 107],
          [115, 229],
          [231, 334],
          [342, 540],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: stencilGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: stencilMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: stencilSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: stencilSceneFragmentShaderSource,
      },
      {
        id: "outline-fragment-shader",
        filename: "outline.frag.wgsl",
        language: "wgsl",
        content: stencilOutlineFragmentShaderSource,
      },
    ],
  },
{
    id: "32-deferred-rendering",
    order: 40,
    title: "Deferred Rendering 基础",
    tagline: "把几何阶段和光照阶段真正拆开",
    goal: "补上 `G-buffer` 和 deferred rendering，真正把“先写几何信息，再统一做光照”这条渲染组织方式跑通。",
    summary:
      "这一课会第一次正式进入“渲染架构”层面的专题：先用几何 pass 把 `albedo / normal / world position` 写进 `G-buffer`，再用全屏光照 pass 统一累加多盏点光源。",
    notes: [
      "`G-buffer`：先把颜色、法线、世界位置这些几何信息存下来，再统一做光照。",
      "`forward vs deferred`：为什么光源一多，很多引擎会转向 deferred。",
      "`延迟渲染不是白送的`：它也会带来带宽、内存和透明物体处理上的代价。",
      "`这一课的重点不是新光照公式`：真正新增的是把几何 pass 和光照 pass 彻底拆开的渲染组织方式。",
    ],
    status: "ready",
    mount: mountDeferredRenderingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: deferredLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(deferredLessonRuntimeSource, [
          [1, 122],
          [130, 332],
          [334, 412],
          [420, 565],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: deferredGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: deferredMathSource,
      },
      {
        id: "gbuffer-vertex-shader",
        filename: "gbuffer.vert.wgsl",
        language: "wgsl",
        content: deferredGBufferVertexShaderSource,
      },
      {
        id: "gbuffer-fragment-shader",
        filename: "gbuffer.frag.wgsl",
        language: "wgsl",
        content: deferredGBufferFragmentShaderSource,
      },
      {
        id: "lighting-vertex-shader",
        filename: "lighting.vert.wgsl",
        language: "wgsl",
        content: deferredLightingVertexShaderSource,
      },
      {
        id: "lighting-fragment-shader",
        filename: "lighting.frag.wgsl",
        language: "wgsl",
        content: deferredLightingFragmentShaderSource,
      },
    ],
  },
{
    id: "38-deferred-transparent-objects",
    order: 41,
    title: "Deferred 与透明物体",
    tagline: "为什么透明通常要回到 forward",
    goal: "紧接在 deferred rendering 之后，补上一个最关键的现实问题：为什么 `G-buffer` 很适合不透明物体，却天然不擅长表达多层透明混合。",
    summary:
      "这一课会把 deferred rendering 最常见的限制单独拆出来讲清楚：一个像素在 `G-buffer` 里往往只留得下一层几何信息，但透明物体却经常需要按前后顺序一层层混合。所以很多真实引擎最后都会走“`deferred opaque + forward transparent`”的混合路线。",
    notes: [
      "`G-buffer` 更像“这个像素最终属于哪个表面”而不是“这个像素前后叠了几层表面”。",
      "`透明需要顺序`：半透明物体通常要 back-to-front 混合，这和 deferred 的两遍结构天然不太合拍。",
      "`hybrid pipeline`：真实项目里常见的做法是，不透明走 deferred，透明单独回到 forward。",
      "`这节的重点不是新公式`：它是在解释一种渲染架构为什么到这里要分流。",
    ],
    status: "ready",
    mount: mountDeferredTransparentObjectsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: deferredTransparentLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(deferredTransparentLessonRuntimeSource, [
          [1, 142],
          [144, 456],
          [458, 541],
          [545, 871],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: deferredTransparentGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: deferredTransparentMathSource,
      },
      {
        id: "gbuffer-vertex-shader",
        filename: "gbuffer.vert.wgsl",
        language: "wgsl",
        content: deferredTransparentGBufferVertexShaderSource,
      },
      {
        id: "gbuffer-fragment-shader",
        filename: "gbuffer.frag.wgsl",
        language: "wgsl",
        content: deferredTransparentGBufferFragmentShaderSource,
      },
      {
        id: "lighting-vertex-shader",
        filename: "lighting.vert.wgsl",
        language: "wgsl",
        content: deferredTransparentLightingVertexShaderSource,
      },
      {
        id: "lighting-fragment-shader",
        filename: "lighting.frag.wgsl",
        language: "wgsl",
        content: deferredTransparentLightingFragmentShaderSource,
      },
      {
        id: "forward-vertex-shader",
        filename: "forward.vert.wgsl",
        language: "wgsl",
        content: deferredTransparentForwardVertexShaderSource,
      },
      {
        id: "forward-fragment-shader",
        filename: "forward.frag.wgsl",
        language: "wgsl",
        content: deferredTransparentForwardFragmentShaderSource,
      },
      {
        id: "present-vertex-shader",
        filename: "present.vert.wgsl",
        language: "wgsl",
        content: deferredTransparentPresentVertexShaderSource,
      },
      {
        id: "present-fragment-shader",
        filename: "present.frag.wgsl",
        language: "wgsl",
        content: deferredTransparentPresentFragmentShaderSource,
      },
    ],
  },
{
    id: "39-gpu-queries-and-profiling",
    order: 42,
    title: "GPU Query 与性能测量",
    tagline: "第一次正式测 GPU 到底在忙什么",
    goal: "补上 `timestamp query`、`occlusion query` 和 GPU profiling 入口，让课程里第一次出现“如何度量 GPU 工作量”这条线。",
    summary:
      "这一课不再只看画面对不对，而是开始看 GPU 到底花了多少时间、哪些物体其实根本没被看到。它会把 WebGPU 里和调优强相关的 query 能力做一次最小展开。",
    notes: [
      "`timestamp query`：怎样在 GPU 自己的时间线上测一个 pass 花了多久。",
      "`occlusion query`：怎样判断一个物体到底有没有真正对最终画面做出贡献。",
      "`性能测量要分 CPU 和 GPU`：两边时间不一样，不能混为一谈。",
      "`调优需要证据`：这一课是后面讲性能和渲染架构取舍的基础。",
    ],
    status: "ready",
    mount: mountGpuQueriesAndProfilingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gpuQueriesLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gpuQueriesLessonRuntimeSource, [
          [1, 249],
          [258, 316],
          [324, 415],
          [417, 953],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: gpuQueriesGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gpuQueriesMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: gpuQueriesVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: gpuQueriesFragmentShaderSource,
      },
    ],
  },
{
    id: "40-render-bundles",
    order: 43,
    title: "Render Bundles",
    tagline: "把重复 draw 命令录成可复用片段",
    goal: "补上 `render bundle` 这一项官方 sample 里很工程化、但当前课程还没涉及的能力，说明它适合解决什么问题。",
    summary:
      "这一课会把“每一帧都重复录同一批 draw 命令”这个痛点拿出来看。我们会用一个静态环带场景，左右对比逐帧重录与 `executeBundles`，把 render bundle 真正能节省的 CPU 录制成本讲清楚。",
    notes: [
      "`render bundle`：把稳定的一批 draw 命令提前录好，后面在 render pass 里直接复用。",
      "`适用前提`：真正适合 bundle 的，是“命令结构稳定、变化只落在 uniform 或 attachment”这类场景。",
      "`复用边界`：把相机 uniform、viewport 这类会变的状态留在 bundle 外，能让 bundle 活得更久。",
      "`这是工程优化课`：重点是 CPU 命令组织方式，不是新增画面特效。",
    ],
    status: "ready",
    mount: mountRenderBundlesLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: renderBundlesLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(renderBundlesLessonRuntimeSource, [
          [1, 243],
          [252, 480],
          [488, 627],
          [628, 999],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: renderBundlesGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: renderBundlesMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: renderBundlesVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: renderBundlesFragmentShaderSource,
      },
    ],
  },
{
    id: "41-hidpi-canvas-sizing",
    order: 44,
    title: "高 DPI 画布与像素尺寸",
    tagline: "先把 CSS 尺寸和 backing store 分清楚",
    goal: "先把 `devicePixelRatio`、CSS 尺寸和真实像素尺寸这条最基础的平台线单独讲清楚，为后面的多画布和离主线程渲染打底。",
    summary:
      "这一课会先只盯住一个问题：同样的 CSS 大小，为什么高分屏上的 canvas 有时会糊、有时又很锐。重点不是多画布，而是先建立“CSS 尺寸 != GPU 真正渲染像素尺寸”的心智模型。",
    notes: [
      "`devicePixelRatio`：高分屏下 1 个 CSS 像素往往对应多个真实像素。",
      "`canvas.width / height` 与 `clientWidth / clientHeight`：这两组尺寸各自服务不同层级，不能混着用。",
      "`正确 resize`：backing store 需要按 DPR 扩容，但布局尺寸仍然保持 CSS 语义。",
      "`这是多画布前置课`：先把单 canvas 的像素边界讲稳，后面的共享 device 才不会混乱。",
    ],
    status: "ready",
    mount: mountHiDpiCanvasSizingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: hidpiSizingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(hidpiSizingLessonRuntimeSource, [
          [19, 146],
          [155, 341],
          [348, 400],
          [444, 487],
          [495, 498],
          [571, 676],
          [699, 876],
          [878, 955],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: hidpiSizingGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: hidpiSizingMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: hidpiSizingVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: hidpiSizingFragmentShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: hidpiSizingPresentShaderSource,
      },
    ],
  },
{
    id: "37-hidpi-and-multiple-canvases",
    order: 45,
    title: "多画布与共享 Device",
    tagline: "让一台 device 驱动多块 canvas",
    goal: "在已经理解像素尺寸之后，继续补上同页多 canvas 的资源边界：哪些资源可以共享，哪些状态必须按 canvas 单独维护。",
    summary:
      "这一课会把单 canvas demo 推到真实页面环境：多块 canvas 可以共享同一台 `GPUDevice`、同一套 geometry 和 pipeline，但每块画布仍要自己维护 `GPUCanvasContext`、depth texture 和 frame uniform。当前实现里顺手保留了一块 HiDPI 对照 pane，帮助观察共享资源和 per-canvas state 同时存在时的边界。",
    notes: [
      "`shared device`：多画布不等于多台 `GPUDevice`。",
      "`per-canvas context / depth / frame uniform`：真正跟画布尺寸和当前帧绑定的状态仍然必须分开维护。",
      "`共享几何与管线`：稳定不变的 GPU 资源最适合跨 canvas 复用。",
      "`当前实现会顺手保留一块像素密度对照 pane`：它服务的是资源边界观察，而不再是本课的唯一主题。",
    ],
    status: "ready",
    mount: mountHiDpiAndMultipleCanvasesLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: hidpiMultiCanvasLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(hidpiMultiCanvasLessonRuntimeSource, [
          [1, 196],
          [202, 315],
          [332, 540],
          [548, 551],
          [664, 997],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: hidpiMultiCanvasGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: hidpiMultiCanvasMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: hidpiMultiCanvasVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: hidpiMultiCanvasFragmentShaderSource,
      },
    ],
  }
];
