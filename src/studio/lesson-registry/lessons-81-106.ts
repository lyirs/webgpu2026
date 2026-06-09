import type { LessonDefinition } from "@/studio/types";
import { pickLessonSourceSegments } from "@/studio/lesson-segments";
import { mountPrimitivePickingLesson } from "@/lessons/lesson-81-primitive-picking/lesson";
import lesson81Source0 from "@/lessons/lesson-81-primitive-picking/lesson.ts?raw";
import lesson81Source1 from "@/lessons/lesson-81-primitive-picking/geometry.ts?raw";
import lesson81Source2 from "@/lessons/lesson-81-primitive-picking/math.ts?raw";
import lesson81Source3 from "@/lessons/lesson-81-primitive-picking/picking.frag.wgsl?raw";
import lesson81Source4 from "@/lessons/lesson-81-primitive-picking/picking.vert.wgsl?raw";
import lesson81Source5 from "@/lessons/lesson-81-primitive-picking/scene.frag.wgsl?raw";
import lesson81Source6 from "@/lessons/lesson-81-primitive-picking/scene.vert.wgsl?raw";
import { mountGltfAnimationBasicLesson } from "@/lessons/lesson-82-gltf-animation-basic/lesson";
import lesson82Source0 from "@/lessons/lesson-82-gltf-animation-basic/lesson.ts?raw";
import lesson82Source1 from "@/lessons/lesson-82-gltf-animation-basic/gltf.ts?raw";
import lesson82Source2 from "@/lessons/lesson-82-gltf-animation-basic/math.ts?raw";
import lesson82Source3 from "@/lessons/lesson-82-gltf-animation-basic/model.frag.wgsl?raw";
import lesson82Source4 from "@/lessons/lesson-82-gltf-animation-basic/model.vert.wgsl?raw";
import { mountGltfPbrBasicLesson } from "@/lessons/lesson-83-gltf-pbr-basic/lesson";
import lesson83Source0 from "@/lessons/lesson-83-gltf-pbr-basic/lesson.ts?raw";
import lesson83Source1 from "@/lessons/lesson-83-gltf-pbr-basic/glb.ts?raw";
import lesson83Source2 from "@/lessons/lesson-83-gltf-pbr-basic/math.ts?raw";
import lesson83Source3 from "@/lessons/lesson-83-gltf-pbr-basic/model.frag.wgsl?raw";
import lesson83Source4 from "@/lessons/lesson-83-gltf-pbr-basic/model.vert.wgsl?raw";
import { mountIblAndImageBasedLightingLesson } from "@/lessons/lesson-84-ibl-and-image-based-lighting/lesson";
import lesson84Source0 from "@/lessons/lesson-84-ibl-and-image-based-lighting/lesson.ts?raw";
import lesson84Source1 from "@/lessons/lesson-84-ibl-and-image-based-lighting/model.frag.wgsl?raw";
import lesson84Source2 from "@/lessons/lesson-84-ibl-and-image-based-lighting/model.vert.wgsl?raw";
import lesson84Source3 from "@/lessons/lesson-84-ibl-and-image-based-lighting/skybox.frag.wgsl?raw";
import lesson84Source4 from "@/lessons/lesson-84-ibl-and-image-based-lighting/skybox.vert.wgsl?raw";
import { mountGltfSkinningBasicLesson } from "@/lessons/lesson-85-gltf-skinning-basic/lesson";
import lesson85Source0 from "@/lessons/lesson-85-gltf-skinning-basic/lesson.ts?raw";
import lesson85Source1 from "@/lessons/lesson-85-gltf-skinning-basic/gltf.ts?raw";
import lesson85Source2 from "@/lessons/lesson-85-gltf-skinning-basic/math.ts?raw";
import lesson85Source3 from "@/lessons/lesson-85-gltf-skinning-basic/model.frag.wgsl?raw";
import lesson85Source4 from "@/lessons/lesson-85-gltf-skinning-basic/model.vert.wgsl?raw";
import { mountGameOfLifeLesson } from "@/lessons/lesson-86-compute-game-of-life/lesson";
import lesson86Source0 from "@/lessons/lesson-86-compute-game-of-life/lesson.ts?raw";
import lesson86Source1 from "@/lessons/lesson-86-compute-game-of-life/game-of-life.compute.wgsl?raw";
import lesson86Source2 from "@/lessons/lesson-86-compute-game-of-life/game-of-life.frag.wgsl?raw";
import lesson86Source3 from "@/lessons/lesson-86-compute-game-of-life/game-of-life.vert.wgsl?raw";
import lesson86Source4 from "@/lessons/lesson-86-compute-game-of-life/seed.ts?raw";
import { mountComputeBoidsLesson } from "@/lessons/lesson-87-compute-boids/lesson";
import lesson87Source0 from "@/lessons/lesson-87-compute-boids/lesson.ts?raw";
import lesson87Source1 from "@/lessons/lesson-87-compute-boids/boid-data.ts?raw";
import lesson87Source2 from "@/lessons/lesson-87-compute-boids/boids.compute.wgsl?raw";
import lesson87Source3 from "@/lessons/lesson-87-compute-boids/boids.frag.wgsl?raw";
import lesson87Source4 from "@/lessons/lesson-87-compute-boids/boids.vert.wgsl?raw";
import { mountBitonicSortLesson } from "@/lessons/lesson-88-compute-bitonic-sort/lesson";
import lesson88Source0 from "@/lessons/lesson-88-compute-bitonic-sort/lesson.ts?raw";
import lesson88Source1 from "@/lessons/lesson-88-compute-bitonic-sort/bitonic-sort.compute.wgsl?raw";
import lesson88Source2 from "@/lessons/lesson-88-compute-bitonic-sort/bitonic-sort.frag.wgsl?raw";
import lesson88Source3 from "@/lessons/lesson-88-compute-bitonic-sort/bitonic-sort.vert.wgsl?raw";
import lesson88Source4 from "@/lessons/lesson-88-compute-bitonic-sort/sort-data.ts?raw";
import { mountReversedZAndDepthPrecisionLesson } from "@/lessons/lesson-89-reversed-z-and-depth-precision/lesson";
import lesson89Source0 from "@/lessons/lesson-89-reversed-z-and-depth-precision/lesson.ts?raw";
import lesson89Source1 from "@/lessons/lesson-89-reversed-z-and-depth-precision/geometry.ts?raw";
import lesson89Source2 from "@/lessons/lesson-89-reversed-z-and-depth-precision/math.ts?raw";
import lesson89Source3 from "@/lessons/lesson-89-reversed-z-and-depth-precision/present.frag.wgsl?raw";
import lesson89Source4 from "@/lessons/lesson-89-reversed-z-and-depth-precision/present.vert.wgsl?raw";
import lesson89Source5 from "@/lessons/lesson-89-reversed-z-and-depth-precision/scene.frag.wgsl?raw";
import lesson89Source6 from "@/lessons/lesson-89-reversed-z-and-depth-precision/scene.vert.wgsl?raw";
import { mountDepthStencilAttachmentStateAndStencilOpsLesson } from "@/lessons/lesson-90-depth-stencil-attachment-state-and-stencil-ops/lesson";
import lesson90Source0 from "@/lessons/lesson-90-depth-stencil-attachment-state-and-stencil-ops/lesson.ts?raw";
import lesson90Source1 from "@/lessons/lesson-90-depth-stencil-attachment-state-and-stencil-ops/stencil-state.wgsl?raw";
import { mountStencilMaskAndOutlineLesson } from "@/lessons/lesson-91-stencil-mask-and-outline/lesson";
import lesson91Source0 from "@/lessons/lesson-91-stencil-mask-and-outline/lesson.ts?raw";
import lesson91Source1 from "@/lessons/lesson-91-stencil-mask-and-outline/geometry.ts?raw";
import lesson91Source2 from "@/lessons/lesson-91-stencil-mask-and-outline/math.ts?raw";
import lesson91Source3 from "@/lessons/lesson-91-stencil-mask-and-outline/outline.frag.wgsl?raw";
import lesson91Source4 from "@/lessons/lesson-91-stencil-mask-and-outline/scene.frag.wgsl?raw";
import lesson91Source5 from "@/lessons/lesson-91-stencil-mask-and-outline/scene.vert.wgsl?raw";
import { mountFrameGraphAndPassResourceLifetimesLesson } from "@/lessons/lesson-92-frame-graph-and-pass-resource-lifetimes/lesson";
import lesson92Source0 from "@/lessons/lesson-92-frame-graph-and-pass-resource-lifetimes/lesson.ts?raw";
import lesson92Source1 from "@/lessons/lesson-92-frame-graph-and-pass-resource-lifetimes/frame-graph.compute.wgsl?raw";
import lesson92Source2 from "@/lessons/lesson-92-frame-graph-and-pass-resource-lifetimes/frame-graph.present.wgsl?raw";
import lesson92Source3 from "@/lessons/lesson-92-frame-graph-and-pass-resource-lifetimes/frame-graph.scene.wgsl?raw";
import { mountDeferredRenderingLesson } from "@/lessons/lesson-93-deferred-rendering/lesson";
import lesson93Source0 from "@/lessons/lesson-93-deferred-rendering/lesson.ts?raw";
import lesson93Source1 from "@/lessons/lesson-93-deferred-rendering/gbuffer.frag.wgsl?raw";
import lesson93Source2 from "@/lessons/lesson-93-deferred-rendering/gbuffer.vert.wgsl?raw";
import lesson93Source3 from "@/lessons/lesson-93-deferred-rendering/geometry.ts?raw";
import lesson93Source4 from "@/lessons/lesson-93-deferred-rendering/lighting.frag.wgsl?raw";
import lesson93Source5 from "@/lessons/lesson-93-deferred-rendering/lighting.vert.wgsl?raw";
import lesson93Source6 from "@/lessons/lesson-93-deferred-rendering/math.ts?raw";
import { mountDeferredTransparentObjectsLesson } from "@/lessons/lesson-94-deferred-transparent-objects/lesson";
import lesson94Source0 from "@/lessons/lesson-94-deferred-transparent-objects/lesson.ts?raw";
import lesson94Source1 from "@/lessons/lesson-94-deferred-transparent-objects/forward.frag.wgsl?raw";
import lesson94Source2 from "@/lessons/lesson-94-deferred-transparent-objects/forward.vert.wgsl?raw";
import lesson94Source3 from "@/lessons/lesson-94-deferred-transparent-objects/gbuffer.frag.wgsl?raw";
import lesson94Source4 from "@/lessons/lesson-94-deferred-transparent-objects/gbuffer.vert.wgsl?raw";
import lesson94Source5 from "@/lessons/lesson-94-deferred-transparent-objects/geometry.ts?raw";
import lesson94Source6 from "@/lessons/lesson-94-deferred-transparent-objects/lighting.frag.wgsl?raw";
import lesson94Source7 from "@/lessons/lesson-94-deferred-transparent-objects/lighting.vert.wgsl?raw";
import lesson94Source8 from "@/lessons/lesson-94-deferred-transparent-objects/math.ts?raw";
import lesson94Source9 from "@/lessons/lesson-94-deferred-transparent-objects/present.frag.wgsl?raw";
import lesson94Source10 from "@/lessons/lesson-94-deferred-transparent-objects/present.vert.wgsl?raw";
import { mountGpuQueriesAndProfilingLesson } from "@/lessons/lesson-95-gpu-queries-and-profiling/lesson";
import lesson95Source0 from "@/lessons/lesson-95-gpu-queries-and-profiling/lesson.ts?raw";
import lesson95Source1 from "@/lessons/lesson-95-gpu-queries-and-profiling/geometry.ts?raw";
import lesson95Source2 from "@/lessons/lesson-95-gpu-queries-and-profiling/math.ts?raw";
import lesson95Source3 from "@/lessons/lesson-95-gpu-queries-and-profiling/scene.frag.wgsl?raw";
import lesson95Source4 from "@/lessons/lesson-95-gpu-queries-and-profiling/scene.vert.wgsl?raw";
import { mountTimestampQuerySetResolveBufferAndGpuTimingLesson } from "@/lessons/lesson-96-timestamp-queryset-resolve-buffer-and-gpu-timing/lesson";
import lesson96Source0 from "@/lessons/lesson-96-timestamp-queryset-resolve-buffer-and-gpu-timing/lesson.ts?raw";
import lesson96Source1 from "@/lessons/lesson-96-timestamp-queryset-resolve-buffer-and-gpu-timing/timestamp-query.wgsl?raw";
import { mountOcclusionQueryAndVisibilityFeedbackLesson } from "@/lessons/lesson-97-occlusion-query-and-visibility-feedback/lesson";
import lesson97Source0 from "@/lessons/lesson-97-occlusion-query-and-visibility-feedback/lesson.ts?raw";
import lesson97Source1 from "@/lessons/lesson-97-occlusion-query-and-visibility-feedback/occlusion-feedback.wgsl?raw";
import { mountQueryResultAvailabilityAndReadbackRingsLesson } from "@/lessons/lesson-98-query-result-availability-and-readback-rings/lesson";
import lesson98Source0 from "@/lessons/lesson-98-query-result-availability-and-readback-rings/lesson.ts?raw";
import lesson98Source1 from "@/lessons/lesson-98-query-result-availability-and-readback-rings/query-ring.wgsl?raw";
import { mountQueueSyncReadbackAndFrameLatencyLesson } from "@/lessons/lesson-99-queue-sync-readback-and-frame-latency/lesson";
import lesson99Source0 from "@/lessons/lesson-99-queue-sync-readback-and-frame-latency/lesson.ts?raw";
import lesson99Source1 from "@/lessons/lesson-99-queue-sync-readback-and-frame-latency/queue-latency.wgsl?raw";
import { mountRenderBundlesLesson } from "@/lessons/lesson-100-render-bundles/lesson";
import lesson100Source0 from "@/lessons/lesson-100-render-bundles/lesson.ts?raw";
import lesson100Source1 from "@/lessons/lesson-100-render-bundles/geometry.ts?raw";
import lesson100Source2 from "@/lessons/lesson-100-render-bundles/math.ts?raw";
import lesson100Source3 from "@/lessons/lesson-100-render-bundles/scene.frag.wgsl?raw";
import lesson100Source4 from "@/lessons/lesson-100-render-bundles/scene.vert.wgsl?raw";
import { mountResizeResourceLifecycleAndTargetRebuildLesson } from "@/lessons/lesson-101-resize-resource-lifecycle-and-target-rebuild/lesson";
import lesson101Source0 from "@/lessons/lesson-101-resize-resource-lifecycle-and-target-rebuild/lesson.ts?raw";
import lesson101Source1 from "@/lessons/lesson-101-resize-resource-lifecycle-and-target-rebuild/resize-targets.wgsl?raw";
import { mountResourcePoolingRingBuffersAndTransientResourcesLesson } from "@/lessons/lesson-102-resource-pooling-ring-buffers-and-transient-resources/lesson";
import lesson102Source0 from "@/lessons/lesson-102-resource-pooling-ring-buffers-and-transient-resources/lesson.ts?raw";
import lesson102Source1 from "@/lessons/lesson-102-resource-pooling-ring-buffers-and-transient-resources/resource-pool.wgsl?raw";
import { mountHiDpiCanvasSizingLesson } from "@/lessons/lesson-103-hidpi-canvas-sizing/lesson";
import lesson103Source0 from "@/lessons/lesson-103-hidpi-canvas-sizing/lesson.ts?raw";
import lesson103Source1 from "@/lessons/lesson-103-hidpi-canvas-sizing/geometry.ts?raw";
import lesson103Source2 from "@/lessons/lesson-103-hidpi-canvas-sizing/math.ts?raw";
import lesson103Source3 from "@/lessons/lesson-103-hidpi-canvas-sizing/present.wgsl?raw";
import lesson103Source4 from "@/lessons/lesson-103-hidpi-canvas-sizing/scene.frag.wgsl?raw";
import lesson103Source5 from "@/lessons/lesson-103-hidpi-canvas-sizing/scene.vert.wgsl?raw";
import { mountHiDpiAndMultipleCanvasesLesson } from "@/lessons/lesson-104-hidpi-and-multiple-canvases/lesson";
import lesson104Source0 from "@/lessons/lesson-104-hidpi-and-multiple-canvases/lesson.ts?raw";
import lesson104Source1 from "@/lessons/lesson-104-hidpi-and-multiple-canvases/geometry.ts?raw";
import lesson104Source2 from "@/lessons/lesson-104-hidpi-and-multiple-canvases/math.ts?raw";
import lesson104Source3 from "@/lessons/lesson-104-hidpi-and-multiple-canvases/scene.frag.wgsl?raw";
import lesson104Source4 from "@/lessons/lesson-104-hidpi-and-multiple-canvases/scene.vert.wgsl?raw";
import { mountWorkerMessagingAndOffscreenCanvasLesson } from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/lesson";
import lesson105Source0 from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/lesson.ts?raw";
import lesson105Source1 from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/geometry.ts?raw";
import lesson105Source2 from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/math.ts?raw";
import lesson105Source3 from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/renderer.ts?raw";
import lesson105Source4 from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/scene.frag.wgsl?raw";
import lesson105Source5 from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/scene.vert.wgsl?raw";
import lesson105Source6 from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/shared.ts?raw";
import lesson105Source7 from "@/lessons/lesson-105-worker-messaging-and-offscreencanvas/worker.ts?raw";
import { mountWorkerAndOffMainThreadLesson } from "@/lessons/lesson-106-worker-and-off-main-thread/lesson";
import lesson106Source0 from "@/lessons/lesson-106-worker-and-off-main-thread/lesson.ts?raw";
import lesson106Source1 from "@/lessons/lesson-106-worker-and-off-main-thread/geometry.ts?raw";
import lesson106Source2 from "@/lessons/lesson-106-worker-and-off-main-thread/math.ts?raw";
import lesson106Source3 from "@/lessons/lesson-106-worker-and-off-main-thread/renderer.ts?raw";
import lesson106Source4 from "@/lessons/lesson-106-worker-and-off-main-thread/scene.frag.wgsl?raw";
import lesson106Source5 from "@/lessons/lesson-106-worker-and-off-main-thread/scene.vert.wgsl?raw";
import lesson106Source6 from "@/lessons/lesson-106-worker-and-off-main-thread/shared.ts?raw";
import lesson106Source7 from "@/lessons/lesson-106-worker-and-off-main-thread/worker.ts?raw";

export const lessons81To106: LessonDefinition[] = [
  {
    id: "81-primitive-picking",
    order: 81,
    title: "Picking 与对象选择",
    tagline: "第 81 课：Picking 与对象选择",
    goal: "学习 Picking 与对象选择：object id render target / readback picking / mouse coordinate mapping。",
    summary:
      "本课聚焦 Picking 与对象选择 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：object id render target / readback picking / mouse coordinate mapping。",
    ],
    status: "ready",
    mount: mountPrimitivePickingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson81Source0,
        displaySegments: pickLessonSourceSegments(lesson81Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson81Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson81Source2,
      },
      {
        id: "picking-frag-wgsl",
        filename: "picking.frag.wgsl",
        language: "wgsl",
        content: lesson81Source3,
      },
      {
        id: "picking-vert-wgsl",
        filename: "picking.vert.wgsl",
        language: "wgsl",
        content: lesson81Source4,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson81Source5,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson81Source6,
      },
    ],
  },
  {
    id: "82-gltf-animation-basic",
    order: 82,
    title: "glTF 动画基础",
    tagline: "第 82 课：glTF 动画基础",
    goal: "学习 glTF 动画基础：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding。",
    summary:
      "本课聚焦 glTF 动画基础 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding。",
    ],
    status: "ready",
    mount: mountGltfAnimationBasicLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson82Source0,
        displaySegments: pickLessonSourceSegments(lesson82Source0),
        featured: true,
      },
      {
        id: "gltf-ts",
        filename: "gltf.ts",
        language: "ts",
        content: lesson82Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson82Source2,
      },
      {
        id: "model-frag-wgsl",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: lesson82Source3,
      },
      {
        id: "model-vert-wgsl",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: lesson82Source4,
      },
    ],
  },
  {
    id: "83-gltf-pbr-basic",
    order: 83,
    title: "PBR 基础",
    tagline: "第 83 课：PBR 基础",
    goal: "学习 PBR 基础：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding / metallic-roughness BRDF。",
    summary:
      "本课聚焦 PBR 基础 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding / metallic-roughness BRDF。",
    ],
    status: "ready",
    mount: mountGltfPbrBasicLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson83Source0,
        displaySegments: pickLessonSourceSegments(lesson83Source0),
        featured: true,
      },
      {
        id: "glb-ts",
        filename: "glb.ts",
        language: "ts",
        content: lesson83Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson83Source2,
      },
      {
        id: "model-frag-wgsl",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: lesson83Source3,
      },
      {
        id: "model-vert-wgsl",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: lesson83Source4,
      },
    ],
  },
  {
    id: "84-ibl-and-image-based-lighting",
    order: 84,
    title: "IBL 与环境贴图照明",
    tagline: "第 84 课：IBL 与环境贴图照明",
    goal: "学习 IBL 与环境贴图照明：environment map sampling / diffuse/specular IBL / skybox lighting。",
    summary:
      "本课聚焦 IBL 与环境贴图照明 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：environment map sampling / diffuse/specular IBL / skybox lighting。",
    ],
    status: "ready",
    mount: mountIblAndImageBasedLightingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson84Source0,
        displaySegments: pickLessonSourceSegments(lesson84Source0),
        featured: true,
      },
      {
        id: "model-frag-wgsl",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: lesson84Source1,
      },
      {
        id: "model-vert-wgsl",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: lesson84Source2,
      },
      {
        id: "skybox-frag-wgsl",
        filename: "skybox.frag.wgsl",
        language: "wgsl",
        content: lesson84Source3,
      },
      {
        id: "skybox-vert-wgsl",
        filename: "skybox.vert.wgsl",
        language: "wgsl",
        content: lesson84Source4,
      },
    ],
  },
  {
    id: "85-gltf-skinning-basic",
    order: 85,
    title: "glTF 骨骼动画基础",
    tagline: "第 85 课：glTF 骨骼动画基础",
    goal: "学习 glTF 骨骼动画基础：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding。",
    summary:
      "本课聚焦 glTF 骨骼动画基础 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding。",
    ],
    status: "ready",
    mount: mountGltfSkinningBasicLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson85Source0,
        displaySegments: pickLessonSourceSegments(lesson85Source0),
        featured: true,
      },
      {
        id: "gltf-ts",
        filename: "gltf.ts",
        language: "ts",
        content: lesson85Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson85Source2,
      },
      {
        id: "model-frag-wgsl",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: lesson85Source3,
      },
      {
        id: "model-vert-wgsl",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: lesson85Source4,
      },
    ],
  },
  {
    id: "86-compute-game-of-life",
    order: 86,
    title: "Compute：Game of Life",
    tagline: "第 86 课：Compute：Game of Life",
    goal: "学习 Compute：Game of Life：cellular automata / ping-pong storage buffer / compute update。",
    summary:
      "本课聚焦 Compute：Game of Life 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：cellular automata / ping-pong storage buffer / compute update。",
    ],
    status: "ready",
    mount: mountGameOfLifeLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson86Source0,
        displaySegments: pickLessonSourceSegments(lesson86Source0),
        featured: true,
      },
      {
        id: "game-of-life-compute-wgsl",
        filename: "game-of-life.compute.wgsl",
        language: "wgsl",
        content: lesson86Source1,
      },
      {
        id: "game-of-life-frag-wgsl",
        filename: "game-of-life.frag.wgsl",
        language: "wgsl",
        content: lesson86Source2,
      },
      {
        id: "game-of-life-vert-wgsl",
        filename: "game-of-life.vert.wgsl",
        language: "wgsl",
        content: lesson86Source3,
      },
      {
        id: "seed-ts",
        filename: "seed.ts",
        language: "ts",
        content: lesson86Source4,
      },
    ],
  },
  {
    id: "87-compute-boids",
    order: 87,
    title: "Compute：Boids 群集",
    tagline: "第 87 课：Compute：Boids 群集",
    goal: "学习 Compute：Boids 群集：neighbor force / compute simulation / GPU particle steering。",
    summary:
      "本课聚焦 Compute：Boids 群集 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：neighbor force / compute simulation / GPU particle steering。",
    ],
    status: "ready",
    mount: mountComputeBoidsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson87Source0,
        displaySegments: pickLessonSourceSegments(lesson87Source0),
        featured: true,
      },
      {
        id: "boid-data-ts",
        filename: "boid-data.ts",
        language: "ts",
        content: lesson87Source1,
      },
      {
        id: "boids-compute-wgsl",
        filename: "boids.compute.wgsl",
        language: "wgsl",
        content: lesson87Source2,
      },
      {
        id: "boids-frag-wgsl",
        filename: "boids.frag.wgsl",
        language: "wgsl",
        content: lesson87Source3,
      },
      {
        id: "boids-vert-wgsl",
        filename: "boids.vert.wgsl",
        language: "wgsl",
        content: lesson87Source4,
      },
    ],
  },
  {
    id: "88-compute-bitonic-sort",
    order: 88,
    title: "Compute：Bitonic Sort",
    tagline: "第 88 课：Compute：Bitonic Sort",
    goal: "学习 Compute：Bitonic Sort：bitonic sort network / compute compare-swap / parallel ordering。",
    summary:
      "本课聚焦 Compute：Bitonic Sort 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：bitonic sort network / compute compare-swap / parallel ordering。",
    ],
    status: "ready",
    mount: mountBitonicSortLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson88Source0,
        displaySegments: pickLessonSourceSegments(lesson88Source0),
        featured: true,
      },
      {
        id: "bitonic-sort-compute-wgsl",
        filename: "bitonic-sort.compute.wgsl",
        language: "wgsl",
        content: lesson88Source1,
      },
      {
        id: "bitonic-sort-frag-wgsl",
        filename: "bitonic-sort.frag.wgsl",
        language: "wgsl",
        content: lesson88Source2,
      },
      {
        id: "bitonic-sort-vert-wgsl",
        filename: "bitonic-sort.vert.wgsl",
        language: "wgsl",
        content: lesson88Source3,
      },
      {
        id: "sort-data-ts",
        filename: "sort-data.ts",
        language: "ts",
        content: lesson88Source4,
      },
    ],
  },
  {
    id: "89-reversed-z-and-depth-precision",
    order: 89,
    title: "Reversed-Z 与深度精度",
    tagline: "第 89 课：Reversed-Z 与深度精度",
    goal: "学习 Reversed-Z 与深度精度：depth texture / depth compare / depth attachment state / reversed-Z projection。",
    summary:
      "本课聚焦 Reversed-Z 与深度精度 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：depth texture / depth compare / depth attachment state / reversed-Z projection。",
    ],
    status: "ready",
    mount: mountReversedZAndDepthPrecisionLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson89Source0,
        displaySegments: pickLessonSourceSegments(lesson89Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson89Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson89Source2,
      },
      {
        id: "present-frag-wgsl",
        filename: "present.frag.wgsl",
        language: "wgsl",
        content: lesson89Source3,
      },
      {
        id: "present-vert-wgsl",
        filename: "present.vert.wgsl",
        language: "wgsl",
        content: lesson89Source4,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson89Source5,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson89Source6,
      },
    ],
  },
  {
    id: "90-depth-stencil-attachment-state-and-stencil-ops",
    order: 90,
    title: "Depth/Stencil Attachment State 与 Stencil Ops",
    tagline: "第 90 课：Depth/Stencil Attachment State 与 Stencil Ops",
    goal: "学习 Depth/Stencil Attachment State 与 Stencil Ops：depth texture / depth compare / depth attachment state / stencil read/write mask。",
    summary:
      "本课聚焦 Depth/Stencil Attachment State 与 Stencil Ops 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：depth texture / depth compare / depth attachment state / stencil read/write mask。",
    ],
    status: "ready",
    mount: mountDepthStencilAttachmentStateAndStencilOpsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson90Source0,
        displaySegments: pickLessonSourceSegments(lesson90Source0),
        featured: true,
      },
      {
        id: "stencil-state-wgsl",
        filename: "stencil-state.wgsl",
        language: "wgsl",
        content: lesson90Source1,
      },
    ],
  },
  {
    id: "91-stencil-mask-and-outline",
    order: 91,
    title: "Stencil 蒙版与描边",
    tagline: "第 91 课：Stencil 蒙版与描边",
    goal: "学习 Stencil 蒙版与描边：stencil read/write mask / stencil compare op / outline / mask pass。",
    summary:
      "本课聚焦 Stencil 蒙版与描边 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：stencil read/write mask / stencil compare op / outline / mask pass。",
    ],
    status: "ready",
    mount: mountStencilMaskAndOutlineLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson91Source0,
        displaySegments: pickLessonSourceSegments(lesson91Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson91Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson91Source2,
      },
      {
        id: "outline-frag-wgsl",
        filename: "outline.frag.wgsl",
        language: "wgsl",
        content: lesson91Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson91Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson91Source5,
      },
    ],
  },
  {
    id: "92-frame-graph-and-pass-resource-lifetimes",
    order: 92,
    title: "Frame Graph 与 Pass 资源生命周期",
    tagline: "第 92 课：Frame Graph 与 Pass 资源生命周期",
    goal: "学习 Frame Graph 与 Pass 资源生命周期：pass dependency graph / resource lifetime / read/write transition planning / target rebuild。",
    summary:
      "本课聚焦 Frame Graph 与 Pass 资源生命周期 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：pass dependency graph / resource lifetime / read/write transition planning / target rebuild。",
    ],
    status: "ready",
    mount: mountFrameGraphAndPassResourceLifetimesLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson92Source0,
        displaySegments: pickLessonSourceSegments(lesson92Source0),
        featured: true,
      },
      {
        id: "frame-graph-compute-wgsl",
        filename: "frame-graph.compute.wgsl",
        language: "wgsl",
        content: lesson92Source1,
      },
      {
        id: "frame-graph-present-wgsl",
        filename: "frame-graph.present.wgsl",
        language: "wgsl",
        content: lesson92Source2,
      },
      {
        id: "frame-graph-scene-wgsl",
        filename: "frame-graph.scene.wgsl",
        language: "wgsl",
        content: lesson92Source3,
      },
    ],
  },
  {
    id: "93-deferred-rendering",
    order: 93,
    title: "Deferred Rendering 基础",
    tagline: "第 93 课：Deferred Rendering 基础",
    goal: "学习 Deferred Rendering 基础：G-buffer / deferred lighting pass / forward transparent pass。",
    summary:
      "本课聚焦 Deferred Rendering 基础 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：G-buffer / deferred lighting pass / forward transparent pass。",
    ],
    status: "ready",
    mount: mountDeferredRenderingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson93Source0,
        displaySegments: pickLessonSourceSegments(lesson93Source0),
        featured: true,
      },
      {
        id: "gbuffer-frag-wgsl",
        filename: "gbuffer.frag.wgsl",
        language: "wgsl",
        content: lesson93Source1,
      },
      {
        id: "gbuffer-vert-wgsl",
        filename: "gbuffer.vert.wgsl",
        language: "wgsl",
        content: lesson93Source2,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson93Source3,
      },
      {
        id: "lighting-frag-wgsl",
        filename: "lighting.frag.wgsl",
        language: "wgsl",
        content: lesson93Source4,
      },
      {
        id: "lighting-vert-wgsl",
        filename: "lighting.vert.wgsl",
        language: "wgsl",
        content: lesson93Source5,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson93Source6,
      },
    ],
  },
  {
    id: "94-deferred-transparent-objects",
    order: 94,
    title: "Deferred 与透明物体",
    tagline: "第 94 课：Deferred 与透明物体",
    goal: "学习 Deferred 与透明物体：color target blend state / alpha compositing / 透明排序 / G-buffer。",
    summary:
      "本课聚焦 Deferred 与透明物体 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：color target blend state / alpha compositing / 透明排序 / G-buffer。",
    ],
    status: "ready",
    mount: mountDeferredTransparentObjectsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson94Source0,
        displaySegments: pickLessonSourceSegments(lesson94Source0),
        featured: true,
      },
      {
        id: "forward-frag-wgsl",
        filename: "forward.frag.wgsl",
        language: "wgsl",
        content: lesson94Source1,
      },
      {
        id: "forward-vert-wgsl",
        filename: "forward.vert.wgsl",
        language: "wgsl",
        content: lesson94Source2,
      },
      {
        id: "gbuffer-frag-wgsl",
        filename: "gbuffer.frag.wgsl",
        language: "wgsl",
        content: lesson94Source3,
      },
      {
        id: "gbuffer-vert-wgsl",
        filename: "gbuffer.vert.wgsl",
        language: "wgsl",
        content: lesson94Source4,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson94Source5,
      },
      {
        id: "lighting-frag-wgsl",
        filename: "lighting.frag.wgsl",
        language: "wgsl",
        content: lesson94Source6,
      },
      {
        id: "lighting-vert-wgsl",
        filename: "lighting.vert.wgsl",
        language: "wgsl",
        content: lesson94Source7,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson94Source8,
      },
      {
        id: "present-frag-wgsl",
        filename: "present.frag.wgsl",
        language: "wgsl",
        content: lesson94Source9,
      },
      {
        id: "present-vert-wgsl",
        filename: "present.vert.wgsl",
        language: "wgsl",
        content: lesson94Source10,
      },
    ],
  },
  {
    id: "95-gpu-queries-and-profiling",
    order: 95,
    title: "GPU Query 与性能测量",
    tagline: "第 95 课：GPU Query 与性能测量",
    goal: "学习 GPU Query 与性能测量：GPUQuerySet / resolveQuerySet / readback latency。",
    summary:
      "本课聚焦 GPU Query 与性能测量 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：GPUQuerySet / resolveQuerySet / readback latency。",
    ],
    status: "ready",
    mount: mountGpuQueriesAndProfilingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson95Source0,
        displaySegments: pickLessonSourceSegments(lesson95Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson95Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson95Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson95Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson95Source4,
      },
    ],
  },
  {
    id: "96-timestamp-queryset-resolve-buffer-and-gpu-timing",
    order: 96,
    title: "Timestamp QuerySet、Resolve Buffer 与 GPU Timing",
    tagline: "第 96 课：Timestamp QuerySet、Resolve Buffer 与 GPU Timing",
    goal: "学习 Timestamp QuerySet、Resolve Buffer 与 GPU Timing：GPUQuerySet / resolveQuerySet / readback latency。",
    summary:
      "本课聚焦 Timestamp QuerySet、Resolve Buffer 与 GPU Timing 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：GPUQuerySet / resolveQuerySet / readback latency。",
    ],
    status: "ready",
    mount: mountTimestampQuerySetResolveBufferAndGpuTimingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson96Source0,
        displaySegments: pickLessonSourceSegments(lesson96Source0),
        featured: true,
      },
      {
        id: "timestamp-query-wgsl",
        filename: "timestamp-query.wgsl",
        language: "wgsl",
        content: lesson96Source1,
      },
    ],
  },
  {
    id: "97-occlusion-query-and-visibility-feedback",
    order: 97,
    title: "Occlusion Query 与 Visibility Feedback",
    tagline: "第 97 课：Occlusion Query 与 Visibility Feedback",
    goal: "学习 Occlusion Query 与 Visibility Feedback：GPUQuerySet / resolveQuerySet / readback latency。",
    summary:
      "本课聚焦 Occlusion Query 与 Visibility Feedback 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：GPUQuerySet / resolveQuerySet / readback latency。",
    ],
    status: "ready",
    mount: mountOcclusionQueryAndVisibilityFeedbackLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson97Source0,
        displaySegments: pickLessonSourceSegments(lesson97Source0),
        featured: true,
      },
      {
        id: "occlusion-feedback-wgsl",
        filename: "occlusion-feedback.wgsl",
        language: "wgsl",
        content: lesson97Source1,
      },
    ],
  },
  {
    id: "98-query-result-availability-and-readback-rings",
    order: 98,
    title: "Query Result Availability 与 Readback Ring",
    tagline: "第 98 课：Query Result Availability 与 Readback Ring",
    goal: "学习 Query Result Availability 与 Readback Ring：copyTextureToTexture / copyTextureToBuffer / padded readback 校验 / GPUQuerySet。",
    summary:
      "本课聚焦 Query Result Availability 与 Readback Ring 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBuffer / mapAsync 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBuffer / mapAsync。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：copyTextureToTexture / copyTextureToBuffer / padded readback 校验 / GPUQuerySet。",
    ],
    status: "ready",
    mount: mountQueryResultAvailabilityAndReadbackRingsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson98Source0,
        displaySegments: pickLessonSourceSegments(lesson98Source0),
        featured: true,
      },
      {
        id: "query-ring-wgsl",
        filename: "query-ring.wgsl",
        language: "wgsl",
        content: lesson98Source1,
      },
    ],
  },
  {
    id: "99-queue-sync-readback-and-frame-latency",
    order: 99,
    title: "Queue 同步、Readback 与帧延迟",
    tagline: "第 99 课：Queue 同步、Readback 与帧延迟",
    goal: "学习 Queue 同步、Readback 与帧延迟：copyTextureToTexture / copyTextureToBuffer / padded readback 校验 / queue.onSubmittedWorkDone。",
    summary:
      "本课聚焦 Queue 同步、Readback 与帧延迟 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：copyTextureToTexture / copyTextureToBuffer / padded readback 校验 / queue.onSubmittedWorkDone。",
    ],
    status: "ready",
    mount: mountQueueSyncReadbackAndFrameLatencyLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson99Source0,
        displaySegments: pickLessonSourceSegments(lesson99Source0),
        featured: true,
      },
      {
        id: "queue-latency-wgsl",
        filename: "queue-latency.wgsl",
        language: "wgsl",
        content: lesson99Source1,
      },
    ],
  },
  {
    id: "100-render-bundles",
    order: 100,
    title: "Render Bundles",
    tagline: "第 100 课：Render Bundles",
    goal: "学习 Render Bundles：render bundle encoder / pre-recorded draw calls / executeBundles。",
    summary:
      "本课聚焦 Render Bundles 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：render bundle encoder / pre-recorded draw calls / executeBundles。",
    ],
    status: "ready",
    mount: mountRenderBundlesLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson100Source0,
        displaySegments: pickLessonSourceSegments(lesson100Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson100Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson100Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson100Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson100Source4,
      },
    ],
  },
  {
    id: "101-resize-resource-lifecycle-and-target-rebuild",
    order: 101,
    title: "Resize、资源生命周期与 Target 重建",
    tagline: "第 101 课：Resize、资源生命周期与 Target 重建",
    goal: "学习 Resize、资源生命周期与 Target 重建：target rebuild / DPR / render scale / texture destroy。",
    summary:
      "本课聚焦 Resize、资源生命周期与 Target 重建 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：target rebuild / DPR / render scale / texture destroy。",
    ],
    status: "ready",
    mount: mountResizeResourceLifecycleAndTargetRebuildLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson101Source0,
        displaySegments: pickLessonSourceSegments(lesson101Source0),
        featured: true,
      },
      {
        id: "resize-targets-wgsl",
        filename: "resize-targets.wgsl",
        language: "wgsl",
        content: lesson101Source1,
      },
    ],
  },
  {
    id: "102-resource-pooling-ring-buffers-and-transient-resources",
    order: 102,
    title: "资源池、Ring Buffer 与临时资源",
    tagline: "第 102 课：资源池、Ring Buffer 与临时资源",
    goal: "学习 资源池、Ring Buffer 与临时资源：frames in flight / ring buffer slot / transient resource pool。",
    summary:
      "本课聚焦 资源池、Ring Buffer 与临时资源 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：frames in flight / ring buffer slot / transient resource pool。",
    ],
    status: "ready",
    mount: mountResourcePoolingRingBuffersAndTransientResourcesLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson102Source0,
        displaySegments: pickLessonSourceSegments(lesson102Source0),
        featured: true,
      },
      {
        id: "resource-pool-wgsl",
        filename: "resource-pool.wgsl",
        language: "wgsl",
        content: lesson102Source1,
      },
    ],
  },
  {
    id: "103-hidpi-canvas-sizing",
    order: 103,
    title: "高 DPI 画布与像素尺寸",
    tagline: "第 103 课：高 DPI 画布与像素尺寸",
    goal: "学习 高 DPI 画布与像素尺寸：canvas sizing / DPR / shared device / worker message / OffscreenCanvas 渲染。",
    summary:
      "本课聚焦 高 DPI 画布与像素尺寸 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：canvas sizing / DPR / shared device / worker message / OffscreenCanvas 渲染。",
    ],
    status: "ready",
    mount: mountHiDpiCanvasSizingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson103Source0,
        displaySegments: pickLessonSourceSegments(lesson103Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson103Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson103Source2,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson103Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson103Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson103Source5,
      },
    ],
  },
  {
    id: "104-hidpi-and-multiple-canvases",
    order: 104,
    title: "多画布与共享 Device",
    tagline: "第 104 课：多画布与共享 Device",
    goal: "学习 多画布与共享 Device：shared GPUDevice / multiple canvas contexts / DPR 同步。",
    summary:
      "本课聚焦 多画布与共享 Device 的核心链路，重点观察一个 GPUDevice 如何驱动多个 canvas context，并保持 canvas size、DPR 与 uniform 数据同步。",
    notes: [
      "WebGPU API：getContext(\"webgpu\") / configure / queue.writeBuffer / queue.submit。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：shared GPUDevice / multiple canvas contexts / canvas sizing / DPR。",
    ],
    status: "ready",
    mount: mountHiDpiAndMultipleCanvasesLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson104Source0,
        displaySegments: pickLessonSourceSegments(lesson104Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson104Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson104Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson104Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson104Source4,
      },
    ],
  },
  {
    id: "105-worker-messaging-and-offscreencanvas",
    order: 105,
    title: "Worker、消息传递与 OffscreenCanvas",
    tagline: "第 105 课：Worker、消息传递与 OffscreenCanvas",
    goal: "学习 Worker、消息传递与 OffscreenCanvas：canvas sizing / DPR / shared device / worker message / OffscreenCanvas 渲染。",
    summary:
      "本课聚焦 Worker、消息传递与 OffscreenCanvas 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：canvas sizing / DPR / shared device / worker message / OffscreenCanvas 渲染。",
    ],
    status: "ready",
    mount: mountWorkerMessagingAndOffscreenCanvasLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson105Source0,
        displaySegments: pickLessonSourceSegments(lesson105Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson105Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson105Source2,
      },
      {
        id: "renderer-ts",
        filename: "renderer.ts",
        language: "ts",
        content: lesson105Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson105Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson105Source5,
      },
      {
        id: "shared-ts",
        filename: "shared.ts",
        language: "ts",
        content: lesson105Source6,
      },
      {
        id: "worker-ts",
        filename: "worker.ts",
        language: "ts",
        content: lesson105Source7,
      },
    ],
  },
  {
    id: "106-worker-and-off-main-thread",
    order: 106,
    title: "离主线程渲染与状态同步",
    tagline: "第 106 课：离主线程渲染与状态同步",
    goal: "学习 离主线程渲染与状态同步：canvas sizing / DPR / shared device / worker message / OffscreenCanvas 渲染。",
    summary:
      "本课聚焦 离主线程渲染与状态同步 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：canvas sizing / DPR / shared device / worker message / OffscreenCanvas 渲染。",
    ],
    status: "ready",
    mount: mountWorkerAndOffMainThreadLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson106Source0,
        displaySegments: pickLessonSourceSegments(lesson106Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson106Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson106Source2,
      },
      {
        id: "renderer-ts",
        filename: "renderer.ts",
        language: "ts",
        content: lesson106Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson106Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson106Source5,
      },
      {
        id: "shared-ts",
        filename: "shared.ts",
        language: "ts",
        content: lesson106Source6,
      },
      {
        id: "worker-ts",
        filename: "worker.ts",
        language: "ts",
        content: lesson106Source7,
      },
    ],
  },
];
