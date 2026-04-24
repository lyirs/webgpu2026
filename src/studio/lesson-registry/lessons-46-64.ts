import type { LessonDefinition } from "@/studio/types";
import { pickCoreSourceSegments } from "@/studio/lesson-segments";
import cubemapGeometrySource from "@/lessons/lesson-26-cubemap-and-skybox/geometry.ts?raw";
import workerMessagingFragmentShaderSource from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/scene.frag.wgsl?raw";
import workerMessagingGeometrySource from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/geometry.ts?raw";
import workerMessagingLessonRuntimeSource from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/lesson.ts?raw";
import workerMessagingMathSource from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/math.ts?raw";
import workerMessagingRendererSource from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/renderer.ts?raw";
import workerMessagingSharedSource from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/shared.ts?raw";
import workerMessagingVertexShaderSource from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/scene.vert.wgsl?raw";
import workerMessagingWorkerSource from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/worker.ts?raw";
import { mountWorkerMessagingAndOffscreenCanvasLesson } from "@/lessons/lesson-46-worker-messaging-and-offscreencanvas/lesson";
import workerOffMainFragmentShaderSource from "@/lessons/lesson-47-worker-and-off-main-thread/scene.frag.wgsl?raw";
import workerOffMainGeometrySource from "@/lessons/lesson-47-worker-and-off-main-thread/geometry.ts?raw";
import workerOffMainLessonRuntimeSource from "@/lessons/lesson-47-worker-and-off-main-thread/lesson.ts?raw";
import workerOffMainMathSource from "@/lessons/lesson-47-worker-and-off-main-thread/math.ts?raw";
import workerOffMainRendererSource from "@/lessons/lesson-47-worker-and-off-main-thread/renderer.ts?raw";
import workerOffMainSharedSource from "@/lessons/lesson-47-worker-and-off-main-thread/shared.ts?raw";
import workerOffMainVertexShaderSource from "@/lessons/lesson-47-worker-and-off-main-thread/scene.vert.wgsl?raw";
import workerOffMainWorkerSource from "@/lessons/lesson-47-worker-and-off-main-thread/worker.ts?raw";
import { mountWorkerAndOffMainThreadLesson } from "@/lessons/lesson-47-worker-and-off-main-thread/lesson";
import texture3dSlicesDensitySource from "@/lessons/lesson-48-texture3d-and-volume-slices/density.ts?raw";
import texture3dSlicesGeometrySource from "@/lessons/lesson-48-texture3d-and-volume-slices/geometry.ts?raw";
import texture3dSlicesLessonRuntimeSource from "@/lessons/lesson-48-texture3d-and-volume-slices/lesson.ts?raw";
import texture3dSlicesMathSource from "@/lessons/lesson-48-texture3d-and-volume-slices/math.ts?raw";
import texture3dSlicesFragmentShaderSource from "@/lessons/lesson-48-texture3d-and-volume-slices/scene.frag.wgsl?raw";
import texture3dSlicesVertexShaderSource from "@/lessons/lesson-48-texture3d-and-volume-slices/scene.vert.wgsl?raw";
import { mountTexture3dAndVolumeSlicesLesson } from "@/lessons/lesson-48-texture3d-and-volume-slices/lesson";
import implicitFieldFieldSource from "@/lessons/lesson-50-metaballs-and-implicit-fields/field.ts?raw";
import implicitFieldGeometrySource from "@/lessons/lesson-50-metaballs-and-implicit-fields/geometry.ts?raw";
import implicitFieldLessonRuntimeSource from "@/lessons/lesson-50-metaballs-and-implicit-fields/lesson.ts?raw";
import implicitFieldMathSource from "@/lessons/lesson-50-metaballs-and-implicit-fields/math.ts?raw";
import implicitFieldFragmentShaderSource from "@/lessons/lesson-50-metaballs-and-implicit-fields/scene.frag.wgsl?raw";
import implicitFieldVertexShaderSource from "@/lessons/lesson-50-metaballs-and-implicit-fields/scene.vert.wgsl?raw";
import { mountMetaballsAndImplicitFieldsLesson } from "@/lessons/lesson-50-metaballs-and-implicit-fields/lesson";
import clusterCullingComputeShaderSource from "@/lessons/lesson-52-cluster-build-and-light-culling/clusters.compute.wgsl?raw";
import clusterCullingGeometrySource from "@/lessons/lesson-52-cluster-build-and-light-culling/geometry.ts?raw";
import clusterCullingLessonRuntimeSource from "@/lessons/lesson-52-cluster-build-and-light-culling/lesson.ts?raw";
import clusterCullingMathSource from "@/lessons/lesson-52-cluster-build-and-light-culling/math.ts?raw";
import clusterCullingFragmentShaderSource from "@/lessons/lesson-52-cluster-build-and-light-culling/scene.frag.wgsl?raw";
import clusterCullingVertexShaderSource from "@/lessons/lesson-52-cluster-build-and-light-culling/scene.vert.wgsl?raw";
import { mountClusterBuildAndLightCullingLesson } from "@/lessons/lesson-52-cluster-build-and-light-culling/lesson";
import volumeRenderingDensitySource from "@/lessons/lesson-49-volume-rendering-and-texture3d/density.ts?raw";
import volumeRenderingGeometrySource from "@/lessons/lesson-49-volume-rendering-and-texture3d/geometry.ts?raw";
import volumeRenderingLessonRuntimeSource from "@/lessons/lesson-49-volume-rendering-and-texture3d/lesson.ts?raw";
import volumeRenderingMathSource from "@/lessons/lesson-49-volume-rendering-and-texture3d/math.ts?raw";
import volumeRenderingSceneFragmentShaderSource from "@/lessons/lesson-49-volume-rendering-and-texture3d/scene.frag.wgsl?raw";
import volumeRenderingVertexShaderSource from "@/lessons/lesson-49-volume-rendering-and-texture3d/scene.vert.wgsl?raw";
import volumeRenderingVolumeFragmentShaderSource from "@/lessons/lesson-49-volume-rendering-and-texture3d/volume.frag.wgsl?raw";
import { mountVolumeRenderingAndTexture3dLesson } from "@/lessons/lesson-49-volume-rendering-and-texture3d/lesson";
import marchingCubesComputeShaderSource from "@/lessons/lesson-51-marching-cubes-and-metaballs/metaballs.compute.wgsl?raw";
import marchingCubesGeometrySource from "@/lessons/lesson-51-marching-cubes-and-metaballs/geometry.ts?raw";
import marchingCubesLessonRuntimeSource from "@/lessons/lesson-51-marching-cubes-and-metaballs/lesson.ts?raw";
import marchingCubesMathSource from "@/lessons/lesson-51-marching-cubes-and-metaballs/math.ts?raw";
import marchingCubesFragmentShaderSource from "@/lessons/lesson-51-marching-cubes-and-metaballs/scene.frag.wgsl?raw";
import marchingCubesVertexShaderSource from "@/lessons/lesson-51-marching-cubes-and-metaballs/scene.vert.wgsl?raw";
import { mountMarchingCubesAndMetaballsLesson } from "@/lessons/lesson-51-marching-cubes-and-metaballs/lesson";
import clusteredShadingComputeShaderSource from "@/lessons/lesson-53-clustered-shading/clusters.compute.wgsl?raw";
import clusteredShadingGeometrySource from "@/lessons/lesson-53-clustered-shading/geometry.ts?raw";
import clusteredShadingLessonRuntimeSource from "@/lessons/lesson-53-clustered-shading/lesson.ts?raw";
import clusteredShadingMathSource from "@/lessons/lesson-53-clustered-shading/math.ts?raw";
import clusteredShadingFragmentShaderSource from "@/lessons/lesson-53-clustered-shading/scene.frag.wgsl?raw";
import clusteredShadingVertexShaderSource from "@/lessons/lesson-53-clustered-shading/scene.vert.wgsl?raw";
import { mountClusteredShadingLesson } from "@/lessons/lesson-53-clustered-shading/lesson";
import oitMotivationGeometrySource from "@/lessons/lesson-54-oit-motivation/geometry.ts?raw";
import oitMotivationLessonRuntimeSource from "@/lessons/lesson-54-oit-motivation/lesson.ts?raw";
import oitMotivationMathSource from "@/lessons/lesson-54-oit-motivation/math.ts?raw";
import oitMotivationSceneFragmentShaderSource from "@/lessons/lesson-54-oit-motivation/scene.frag.wgsl?raw";
import oitMotivationSceneVertexShaderSource from "@/lessons/lesson-54-oit-motivation/scene.vert.wgsl?raw";
import { mountOitMotivationLesson } from "@/lessons/lesson-54-oit-motivation/lesson";
import abufferFragmentShaderSource from "@/lessons/lesson-55-a-buffer-and-oit/abuffer.frag.wgsl?raw";
import abufferGeometrySource from "@/lessons/lesson-55-a-buffer-and-oit/geometry.ts?raw";
import abufferLessonRuntimeSource from "@/lessons/lesson-55-a-buffer-and-oit/lesson.ts?raw";
import abufferMathSource from "@/lessons/lesson-55-a-buffer-and-oit/math.ts?raw";
import abufferResolveShaderSource from "@/lessons/lesson-55-a-buffer-and-oit/resolve.wgsl?raw";
import abufferSceneFragmentShaderSource from "@/lessons/lesson-55-a-buffer-and-oit/scene.frag.wgsl?raw";
import abufferSceneVertexShaderSource from "@/lessons/lesson-55-a-buffer-and-oit/scene.vert.wgsl?raw";
import { mountABufferAndOitLesson } from "@/lessons/lesson-55-a-buffer-and-oit/lesson";
import hdrToneLessonRuntimeSource from "@/lessons/lesson-56-hdr-exposure-and-tone-mapping/lesson.ts?raw";
import hdrToneModelFragmentShaderSource from "@/lessons/lesson-56-hdr-exposure-and-tone-mapping/model.frag.wgsl?raw";
import hdrToneModelVertexShaderSource from "@/lessons/lesson-56-hdr-exposure-and-tone-mapping/model.vert.wgsl?raw";
import hdrTonePresentShaderSource from "@/lessons/lesson-56-hdr-exposure-and-tone-mapping/present.wgsl?raw";
import hdrToneSkyboxFragmentShaderSource from "@/lessons/lesson-56-hdr-exposure-and-tone-mapping/skybox.frag.wgsl?raw";
import hdrToneSkyboxVertexShaderSource from "@/lessons/lesson-56-hdr-exposure-and-tone-mapping/skybox.vert.wgsl?raw";
import { mountHdrExposureAndToneMappingLesson } from "@/lessons/lesson-56-hdr-exposure-and-tone-mapping/lesson";
import hdrBloomBlurShaderSource from "@/lessons/lesson-57-bloom-and-hdr-post-chain/blur.wgsl?raw";
import hdrBloomBrightShaderSource from "@/lessons/lesson-57-bloom-and-hdr-post-chain/bright.wgsl?raw";
import hdrBloomEmissiveShaderSource from "@/lessons/lesson-57-bloom-and-hdr-post-chain/emissive.wgsl?raw";
import hdrBloomLessonRuntimeSource from "@/lessons/lesson-57-bloom-and-hdr-post-chain/lesson.ts?raw";
import hdrBloomModelFragmentShaderSource from "@/lessons/lesson-57-bloom-and-hdr-post-chain/model.frag.wgsl?raw";
import hdrBloomModelVertexShaderSource from "@/lessons/lesson-57-bloom-and-hdr-post-chain/model.vert.wgsl?raw";
import hdrBloomPresentShaderSource from "@/lessons/lesson-57-bloom-and-hdr-post-chain/present.wgsl?raw";
import hdrBloomSkyboxFragmentShaderSource from "@/lessons/lesson-57-bloom-and-hdr-post-chain/skybox.frag.wgsl?raw";
import hdrBloomSkyboxVertexShaderSource from "@/lessons/lesson-57-bloom-and-hdr-post-chain/skybox.vert.wgsl?raw";
import { mountBloomAndHdrPostChainLesson } from "@/lessons/lesson-57-bloom-and-hdr-post-chain/lesson";
import ssaoBlurShaderSource from "@/lessons/lesson-58-ssao-and-screen-space-occlusion/blur.wgsl?raw";
import ssaoGeometrySource from "@/lessons/lesson-58-ssao-and-screen-space-occlusion/geometry.ts?raw";
import ssaoLessonRuntimeSource from "@/lessons/lesson-58-ssao-and-screen-space-occlusion/lesson.ts?raw";
import ssaoMathSource from "@/lessons/lesson-58-ssao-and-screen-space-occlusion/math.ts?raw";
import ssaoPresentShaderSource from "@/lessons/lesson-58-ssao-and-screen-space-occlusion/present.wgsl?raw";
import ssaoSceneFragmentShaderSource from "@/lessons/lesson-58-ssao-and-screen-space-occlusion/scene.frag.wgsl?raw";
import ssaoSceneVertexShaderSource from "@/lessons/lesson-58-ssao-and-screen-space-occlusion/scene.vert.wgsl?raw";
import ssaoShaderSource from "@/lessons/lesson-58-ssao-and-screen-space-occlusion/ssao.wgsl?raw";
import { mountSsaoAndScreenSpaceOcclusionLesson } from "@/lessons/lesson-58-ssao-and-screen-space-occlusion/lesson";
import prefixSumComputeShaderSource from "@/lessons/lesson-59-prefix-sum-and-stream-compaction/compute.wgsl?raw";
import prefixSumLessonRuntimeSource from "@/lessons/lesson-59-prefix-sum-and-stream-compaction/lesson.ts?raw";
import prefixSumSeedSource from "@/lessons/lesson-59-prefix-sum-and-stream-compaction/seed.ts?raw";
import { mountPrefixSumAndStreamCompactionLesson } from "@/lessons/lesson-59-prefix-sum-and-stream-compaction/lesson";
import gpuDrivenBoundsFragmentShaderSource from "@/lessons/gpu-driven-common/bounds.frag.wgsl?raw";
import gpuDrivenBoundsVertexShaderSource from "@/lessons/gpu-driven-common/bounds.vert.wgsl?raw";
import gpuDrivenGeometrySource from "@/lessons/gpu-driven-common/geometry.ts?raw";
import gpuDrivenMathSource from "@/lessons/gpu-driven-common/math.ts?raw";
import gpuDrivenRenderSource from "@/lessons/gpu-driven-common/render.ts?raw";
import gpuDrivenSceneSource from "@/lessons/gpu-driven-common/scene.ts?raw";
import gpuDrivenSceneFragmentShaderSource from "@/lessons/gpu-driven-common/scene.frag.wgsl?raw";
import gpuDrivenSceneVertexShaderSource from "@/lessons/gpu-driven-common/scene.vert.wgsl?raw";
import gpuDrivenFrustumLessonRuntimeSource from "@/lessons/lesson-60-bounding-volumes-and-frustum-culling/lesson.ts?raw";
import { mountBoundingVolumesAndFrustumCullingLesson } from "@/lessons/lesson-60-bounding-volumes-and-frustum-culling/lesson";
import gpuDrivenFlagsComputeShaderSource from "@/lessons/lesson-61-compute-frustum-culling-and-visibility-flags/compute.wgsl?raw";
import gpuDrivenFlagsLessonRuntimeSource from "@/lessons/lesson-61-compute-frustum-culling-and-visibility-flags/lesson.ts?raw";
import { mountComputeFrustumCullingAndVisibilityFlagsLesson } from "@/lessons/lesson-61-compute-frustum-culling-and-visibility-flags/lesson";
import gpuDrivenVisibleListComputeShaderSource from "@/lessons/lesson-62-visible-list-and-indirect-draw/compute.wgsl?raw";
import gpuDrivenVisibleListLessonRuntimeSource from "@/lessons/lesson-62-visible-list-and-indirect-draw/lesson.ts?raw";
import { mountVisibleListAndIndirectDrawLesson } from "@/lessons/lesson-62-visible-list-and-indirect-draw/lesson";
import gpuDrivenHiZComputeShaderSource from "@/lessons/lesson-63-hiz-and-occlusion-culling/compute.wgsl?raw";
import gpuDrivenHiZDepthCopyShaderSource from "@/lessons/lesson-63-hiz-and-occlusion-culling/depth-copy.wgsl?raw";
import gpuDrivenHiZDepthDownsampleShaderSource from "@/lessons/lesson-63-hiz-and-occlusion-culling/depth-downsample.wgsl?raw";
import gpuDrivenHiZLessonRuntimeSource from "@/lessons/lesson-63-hiz-and-occlusion-culling/lesson.ts?raw";
import { mountHiZAndOcclusionCullingLesson } from "@/lessons/lesson-63-hiz-and-occlusion-culling/lesson";
import gpuDrivenLodComputeShaderSource from "@/lessons/lesson-64-gpu-driven-lod-and-instance-scheduling/compute.wgsl?raw";
import gpuDrivenLodLessonRuntimeSource from "@/lessons/lesson-64-gpu-driven-lod-and-instance-scheduling/lesson.ts?raw";
import { mountGpuDrivenLodAndInstanceSchedulingLesson } from "@/lessons/lesson-64-gpu-driven-lod-and-instance-scheduling/lesson";
import gltfPbrParserSource from "@/lessons/lesson-32-gltf-pbr-basic/glb.ts?raw";
import gltfPbrMathSource from "@/lessons/lesson-32-gltf-pbr-basic/math.ts?raw";

export const lessons46To64: LessonDefinition[] = [
{
    id: "43-worker-messaging-and-offscreencanvas",
    order: 46,
    title: "Worker、消息传递与 OffscreenCanvas",
    tagline: "先建立分线程渲染的最小平台模型",
    goal: "先把 `worker`、消息传递和 `OffscreenCanvas` 的平台模型拆开讲清楚，再进入真正的离主线程渲染。",
    summary:
      "这一课先不急着做完整对照实验，而是只建立三件事的最小模型：为什么要分线程、主线程和 worker 怎么传消息、以及 canvas 是怎样被转交出去的。",
    notes: [
      "`worker`：主线程之外的执行环境，适合承接独立循环或重计算。",
      "`postMessage()`：线程一旦分开，状态同步就必须通过消息完成。",
      "`transferControlToOffscreen()`：这一步才是真正把画布控制权从页面线程转出去。",
      "`这是离主线程渲染的前置课`：重点是平台语义，不是最终渲染架构。",
    ],
    status: "ready",
    mount: mountWorkerMessagingAndOffscreenCanvasLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: workerMessagingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(workerMessagingLessonRuntimeSource, [
          [1, 289],
          [297, 300],
          [511, 591],
          [593, 789],
        ]),
        featured: true,
      },
      {
        id: "worker-runtime",
        filename: "worker.ts",
        language: "ts",
        content: workerMessagingWorkerSource,
      },
      {
        id: "shared-helper",
        filename: "shared.ts",
        language: "ts",
        content: workerMessagingSharedSource,
      },
      {
        id: "renderer-helper",
        filename: "renderer.ts",
        language: "ts",
        content: workerMessagingRendererSource,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: workerMessagingGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: workerMessagingMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: workerMessagingVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: workerMessagingFragmentShaderSource,
      },
    ],
  },
{
    id: "38-worker-and-off-main-thread",
    order: 47,
    title: "离主线程渲染与状态同步",
    tagline: "把一块 canvas 真正交给 worker 持续驱动",
    goal: "在先理解 worker / OffscreenCanvas 平台模型之后，继续讲把 render loop 挪到 worker 后的状态同步、输入传播和延迟观测。",
    summary:
      "这一课会把“worker 能不能用”推进到“worker 里怎么长期稳定地跑渲染”。我们会对照主线程与 worker 两条 render loop，看共享控制项、版本同步和主线程负载怎样影响最终画面与帧间隔。",
    notes: [
      "`render loop in worker`：真正被搬走的是持续提交 GPU 命令的那条循环。",
      "`状态同步`：主线程 UI、共享控制项和 worker 渲染状态之间需要版本化消息协调。",
      "`同步延迟`：线程分开以后，新的自由来自解耦，但代价是额外的同步成本。",
      "`这是第二课`：重点已经不再是“worker 是什么”，而是“分线程之后系统怎么稳定运转”。",
    ],
    status: "ready",
    mount: mountWorkerAndOffMainThreadLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: workerOffMainLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(workerOffMainLessonRuntimeSource, [
          [137, 188],
          [306, 316],
          [511, 628],
          [636, 642],
          [652, 676],
          [731, 763],
          [776, 836],
        ]),
        featured: true,
      },
      {
        id: "worker-runtime",
        filename: "worker.ts",
        language: "ts",
        content: workerOffMainWorkerSource,
      },
      {
        id: "shared-helper",
        filename: "shared.ts",
        language: "ts",
        content: workerOffMainSharedSource,
      },
      {
        id: "renderer-helper",
        filename: "renderer.ts",
        language: "ts",
        content: workerOffMainRendererSource,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: workerOffMainGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: workerOffMainMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: workerOffMainVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: workerOffMainFragmentShaderSource,
      },
    ],
  },
{
    id: "45-texture3d-and-volume-slices",
    order: 48,
    title: "3D Texture 与体数据切片",
    tagline: "先把体数据当成可采样纹理看懂",
    goal: "先单独建立 `texture3D` 的数据表示与采样心智模型，用切片和正交观察把“体数据”从抽象概念变成直观对象。",
    summary:
      "这一课先不做完整体渲染，而是只看三维纹理本身：体数据怎样生成、怎样上传、以及固定某个深度切片时 shader 看到的到底是什么。",
    notes: [
      "`texture3D`：采样坐标从二维 `uv` 升级成完整三维位置。",
      "`volume slice`：固定一个深度平面时，体数据会退回成一张可理解的截面图。",
      "`density field`：体渲染前，最重要的是先理解体素里到底存了什么。",
      "`这是 ray marching 前置课`：先把数据看懂，再谈沿射线累计。",
    ],
    status: "ready",
    mount: mountTexture3dAndVolumeSlicesLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: texture3dSlicesLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(texture3dSlicesLessonRuntimeSource, [
          [19, 569],
          [578, 581],
          [729, 761],
          [777, 1068],
          [1070, 1152],
          [1161, 1289],
        ]),
        featured: true,
      },
      {
        id: "density-helper",
        filename: "density.ts",
        language: "ts",
        content: texture3dSlicesDensitySource,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: texture3dSlicesGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: texture3dSlicesMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: texture3dSlicesVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: texture3dSlicesFragmentShaderSource,
      },
    ],
  },
{
    id: "42-volume-rendering-and-texture3d",
    order: 49,
    title: "体渲染与 Ray Marching",
    tagline: "沿射线积累密度，真正看到体积",
    goal: "在已经理解 3D texture 如何承载体数据之后，用 ray marching 把体素密度真正累积成体渲染结果。",
    summary:
      "这一课会把 3D texture 从“数据容器”推进成“真正能渲染的体积”。当前实现左边保留切片 pane 作为诊断，右边则沿射线持续采样并累计颜色/透明度，让体积第一次以自身厚度出现在画面里。",
    notes: [
      "`ray marching`：体渲染通常不是一次命中，而是沿着一条射线不断采样。",
      "`density -> color -> opacity`：每一步采样都要决定自己贡献多少颜色、还剩多少透过去的能量。",
      "`切片 pane`：当前实现保留切片视角，帮助把数据理解和最终体渲染联系起来。",
      "`这是第二课`：重点已经从“3D texture 是什么”转向“体数据如何沿视线被积分”。",
    ],
    status: "ready",
    mount: mountVolumeRenderingAndTexture3dLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: volumeRenderingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(volumeRenderingLessonRuntimeSource, [
          [17, 298],
          [383, 485],
          [494, 497],
          [659, 693],
          [695, 1101],
          [1103, 1275],
        ]),
        featured: true,
      },
      {
        id: "density-helper",
        filename: "density.ts",
        language: "ts",
        content: volumeRenderingDensitySource,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: volumeRenderingGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: volumeRenderingMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: volumeRenderingVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: volumeRenderingSceneFragmentShaderSource,
      },
      {
        id: "volume-fragment-shader",
        filename: "volume.frag.wgsl",
        language: "wgsl",
        content: volumeRenderingVolumeFragmentShaderSource,
      },
    ],
  },
{
      id: "47-metaballs-and-implicit-fields",
      order: 50,
      title: "Metaballs 与隐式场",
    tagline: "先把连续密度场本身看懂",
    goal: "先把 `metaballs` 和隐式场的数据模型单独讲清楚，再进入表面提取和 GPU 生成 mesh。",
    summary:
      "这一课先不急着提取三角形，而是只观察多个势场怎样叠加成一团连续密度，以及等值面这个概念到底在说什么。",
    notes: [
      "`implicit field`：表面不是先给三角形，而是先给“空间里每个位置的标量值”。",
        "`metaballs`：多个球形势场叠加后，自然会形成融合、分裂的液态外观。",
        "`iso value`：真正的表面来自某个阈值，而不是某个固定 mesh。",
        "`这是 marching cubes 前置课`：先理解场，再理解提取算法。",
      ],
      status: "ready",
      mount: mountMetaballsAndImplicitFieldsLesson,
      sources: [
        {
          id: "lesson-runtime",
          filename: "lesson.ts",
          language: "ts",
          content: implicitFieldLessonRuntimeSource,
          displaySegments: pickCoreSourceSegments(implicitFieldLessonRuntimeSource, [
            [28, 378],
            [399, 580],
            [590, 593],
            [839, 888],
            [904, 1072],
            [1085, 1405],
          ]),
          featured: true,
        },
        {
          id: "field-helper",
          filename: "field.ts",
          language: "ts",
          content: implicitFieldFieldSource,
        },
        {
          id: "geometry-helper",
          filename: "geometry.ts",
          language: "ts",
          content: implicitFieldGeometrySource,
        },
        {
          id: "math-helper",
          filename: "math.ts",
          language: "ts",
          content: implicitFieldMathSource,
        },
        {
          id: "scene-vertex-shader",
          filename: "scene.vert.wgsl",
          language: "wgsl",
          content: implicitFieldVertexShaderSource,
        },
        {
          id: "scene-fragment-shader",
          filename: "scene.frag.wgsl",
          language: "wgsl",
          content: implicitFieldFragmentShaderSource,
        },
      ],
    },
{
    id: "43-marching-cubes-and-metaballs",
    order: 51,
    title: "Marching Cubes 与 GPU 网格提取",
    tagline: "把隐式场真正提成可渲染三角网格",
    goal: "在已经理解 metaballs 和隐式场之后，继续讲 `marching cubes` 怎样把等值面提取成 GPU 可直接渲染的三角网格。",
    summary:
      "这一课会把“连续密度”推进到真正可渲染的 mesh。当前实现用运动中的 metaballs 作为输入场，在 compute pass 里生成顶点，再通过 indirect draw 直接把这张临时网格送进后续渲染。",
    notes: [
      "`marching cubes`：怎样从体素密度里把等值面提取成三角形。",
      "`geometry generation`：真正新增的是“GPU 上生成 mesh”而不是“只在 shader 里改颜色”。",
      "`metaballs 现在只是输入场`：它们负责提供密度，提取算法负责把表面离散成三角形。",
      "`这是第二课`：重点已经从隐式场概念转向网格提取和 GPU 生成管线。",
    ],
    status: "ready",
    mount: mountMarchingCubesAndMetaballsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: marchingCubesLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(marchingCubesLessonRuntimeSource, [
          [16, 291],
          [298, 334],
          [341, 404],
          [412, 415],
          [559, 597],
          [614, 777],
          [801, 976],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: marchingCubesGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: marchingCubesMathSource,
      },
      {
        id: "vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: marchingCubesVertexShaderSource,
      },
      {
        id: "fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: marchingCubesFragmentShaderSource,
      },
      {
        id: "compute-shader",
        filename: "metaballs.compute.wgsl",
        language: "wgsl",
        content: marchingCubesComputeShaderSource,
      },
    ],
  },
{
    id: "49-cluster-build-and-light-culling",
    order: 52,
    title: "Cluster 构建与 Light Culling",
    tagline: "先把“先筛灯再着色”讲透",
    goal: "先把 `cluster` 划分和 `light culling` 这两件事单独讲清楚，再进入完整的 clustered shading。",
    summary:
      "这一课先只关注预处理阶段：视锥为什么要被拆成小块、每块怎样建立 light list，以及为什么这一步值得单独花一节课。",
    notes: [
      "`cluster`：把空间拆成许多小区域，是为了先缩小“可能相关的灯”范围。",
      "`light list`：每个 cluster 都会维护一份自己的候选灯列表。",
      "`culling before shading`：真正的优化点来自“先排除大多数无关光源”。",
      "`这是 clustered shading 前置课`：先把筛灯讲清楚，再谈最终着色消费。",
    ],
    status: "ready",
    mount: mountClusterBuildAndLightCullingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: clusterCullingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(clusterCullingLessonRuntimeSource, [
          [15, 316],
          [319, 509],
          [517, 520],
          [671, 722],
          [756, 989],
          [991, 1291],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: clusterCullingGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: clusterCullingMathSource,
      },
      {
        id: "vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: clusterCullingVertexShaderSource,
      },
      {
        id: "fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: clusterCullingFragmentShaderSource,
      },
      {
        id: "compute-shader",
        filename: "clusters.compute.wgsl",
        language: "wgsl",
        content: clusterCullingComputeShaderSource,
      },
    ],
  },
{
    id: "44-clustered-shading",
    order: 53,
    title: "Clustered Shading",
    tagline: "让多光源真正扩展到更大的数量级",
    goal: "在已经理解 cluster 划分和 light culling 之后，再看这些 light lists 怎样被最终着色阶段真正消费。",
    summary:
      "这一课会把“先筛灯”推进到“真正用这些结果着色”。当前实现左边仍遍历全部 lights，右边则从 cluster light lists 里只读取当前片元真正相关的那批灯，直接展示 clustered shading 的最终收益。",
    notes: [
      "`cluster light lists`：真正进入 fragment shading 的，已经不是全局灯数组，而是局部列表。",
      "`compute + lighting`：预处理和最终光照终于在这一课重新接起来。",
      "`左右对照`：左侧保留最朴素的全局遍历，右侧只消费命中的 cluster lights。",
      "`这是第二课`：重点已经从“怎么筛灯”转向“这些筛选结果怎样改变最终着色成本”。",
    ],
    status: "ready",
    mount: mountClusteredShadingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: clusteredShadingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(clusteredShadingLessonRuntimeSource, [
          [16, 473],
          [481, 484],
          [646, 683],
          [688, 958],
          [982, 1257],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: clusteredShadingGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: clusteredShadingMathSource,
      },
      {
        id: "vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: clusteredShadingVertexShaderSource,
      },
      {
        id: "fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: clusteredShadingFragmentShaderSource,
      },
      {
        id: "compute-shader",
        filename: "clusters.compute.wgsl",
        language: "wgsl",
        content: clusteredShadingComputeShaderSource,
      },
    ],
  },
{
    id: "51-oit-motivation",
    order: 54,
    title: "透明顺序问题与 OIT 动机",
    tagline: "先把“为什么排序不够”讲透",
    goal: "在正式进入 A-buffer 之前，先把透明排序的局限、复杂交叠场景的痛点和 OIT 的出发点单独讲清楚。",
    summary:
      "这一课会先从问题出发：为什么半透明物体常常要排序、为什么排序到某个复杂度就开始失灵，以及为什么人们会继续寻找顺序无关透明方案。",
    notes: [
      "`fixed-order alpha blend`：提交顺序一旦固定，交叠关系复杂时就很容易出错。",
      "`back-to-front sorting`：排序能解决一部分问题，但并不能覆盖所有真实场景。",
      "`复杂透明`：多层玻璃、交叉薄片和粒子云都会把排序问题放大。",
      "`这是 A-buffer 前置课`：先理解动机，再看一种具体实现。",
    ],
    status: "ready",
    mount: mountOitMotivationLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: oitMotivationLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(oitMotivationLessonRuntimeSource, [
          [17, 430],
          [452, 455],
          [615, 623],
          [625, 822],
          [824, 935],
          [965, 988],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: oitMotivationGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: oitMotivationMathSource,
      },
      {
        id: "vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: oitMotivationSceneVertexShaderSource,
      },
      {
        id: "fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: oitMotivationSceneFragmentShaderSource,
      },
    ],
  },
{
    id: "45-a-buffer-and-oit",
    order: 55,
    title: "A-Buffer 与顺序无关透明",
    tagline: "把 OIT 落实成每像素片元列表",
    goal: "在已经理解透明排序为什么不够之后，用一个简化 A-buffer 展示 OIT 的典型实现路径，以及它带来的容量与存储代价。",
    summary:
      "这一课会把 OIT 从动机推进到实现：右侧不再直接按提交顺序 blend，而是先把每像素透明片元记进列表，再在 resolve 阶段统一组合；同时也会把容量上限和 overflow 这种真实代价一起暴露出来。",
    notes: [
      "`OIT`：顺序无关透明的重点是尽量摆脱对象提交顺序。",
      "`a-buffer`：每像素片元列表是最直观的一类 OIT 实现路径。",
      "`capacity / overflow`：当前实现会把容量上限和丢片元风险一起暴露出来，而不是假装它没有代价。",
      "`这是第二课`：重点已经从“为什么要 OIT”转向“一个 OIT 方案具体怎么落地”。",
    ],
    status: "ready",
    mount: mountABufferAndOitLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: abufferLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(abufferLessonRuntimeSource, [
          [19, 86],
          [203, 488],
          [580, 583],
          [764, 1138],
          [1149, 1374],
          [1405, 1441],
        ]),
        featured: true,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: abufferGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: abufferMathSource,
      },
      {
        id: "vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: abufferSceneVertexShaderSource,
      },
      {
        id: "fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: abufferSceneFragmentShaderSource,
      },
      {
        id: "gather-shader",
        filename: "abuffer.frag.wgsl",
        language: "wgsl",
        content: abufferFragmentShaderSource,
      },
      {
        id: "resolve-shader",
        filename: "resolve.wgsl",
        language: "wgsl",
        content: abufferResolveShaderSource,
      },
    ],
  },
{
    id: "56-hdr-exposure-and-tone-mapping",
    order: 56,
    title: "HDR、曝光与 Tone Mapping",
    tagline: "把 scene-linear HDR 压回显示器的那一步单独讲透",
    goal: "在已经拥有 PBR 与 IBL 之后，把“场景里的线性 HDR 亮度如何真正落到 SDR 显示器上”拆成一节独立课，单独讲清楚曝光与 tone mapping 的职责。",
    summary:
      "这一课会先把同一张场景渲到 `rgba16float` HDR 纹理，再在 present pass 里做左右对照：左边只把结果 clamp 回 0-1，右边则先乘 exposure，再经过 tone mapper 压缩亮部肩部。核心不是“让画面更漂亮”，而是明确 scene-linear HDR 和 display-referred 输出之间必须有一次显示映射。",
    notes: [
      "`HDR render target`：先把光照结果保留在 `rgba16float` 这类更宽的范围里，而不是一开始就塞回 SDR。",
      "`clamp != tone mapping`：直接截到 1.0 只会把最亮的太阳和高光烧成一片白，它不是完整的显示映射。",
      "`exposure`：它负责把整个亮度区间整体推近或拉远显示器可承受的范围。",
      "`tone mapper`：Reinhard / ACES-like 这类曲线决定亮部肩部怎样滚降，而不是怎样继续线性放大。",
      "`这是后处理桥梁课`：它把 PBR / IBL 的 HDR 光照结果和最终送去显示的 SDR 画面真正连起来。",
    ],
    status: "ready",
    mount: mountHdrExposureAndToneMappingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: hdrToneLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(hdrToneLessonRuntimeSource, [
          [1, 159],
          [161, 291],
          [293, 429],
          [433, 795],
          [797, 968],
        ]),
        featured: true,
      },
      {
        id: "glb-loader",
        filename: "glb.ts",
        language: "ts",
        content: gltfPbrParserSource,
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
        content: hdrToneModelVertexShaderSource,
      },
      {
        id: "model-fragment-shader",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: hdrToneModelFragmentShaderSource,
      },
      {
        id: "skybox-vertex-shader",
        filename: "skybox.vert.wgsl",
        language: "wgsl",
        content: hdrToneSkyboxVertexShaderSource,
      },
      {
        id: "skybox-fragment-shader",
        filename: "skybox.frag.wgsl",
        language: "wgsl",
        content: hdrToneSkyboxFragmentShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: hdrTonePresentShaderSource,
      },
    ],
  },
{
    id: "57-bloom-and-hdr-post-chain",
    order: 57,
    title: "Bloom 与 HDR 后处理链",
    tagline: "让 HDR 亮部真正溢出成发光，而不是直接糊白",
    goal: "在已经理解曝光与 tone mapping 之后，把 HDR 后处理链继续推进到 bloom，单独讲清楚亮部提取、模糊扩散和最后合成为什么必须发生在 tone mapping 之前。",
    summary:
      "这一课会把 bloom 放回正确的 HDR 上下文里：先从线性 HDR 场景中提取超过阈值的亮部，再经过多级模糊扩散，最后和原始 HDR 结果合成后一起进入 tone mapping，而不是在 SDR 结果上事后“刷一层发光”。",
    notes: [
      "`bright pass`：先从 HDR 纹理里只挑出真正足够亮的区域，而不是把整张图一起拿去模糊。",
      "`blur chain`：bloom 的主体不是一个开关，而是一段不断扩散亮部能量的多 pass 模糊链。",
      "`HDR first`：先 bloom 再 tone map，和先 tone map 再发光，结果不是一回事。",
      "`这是 56 的自然续课`：曝光和 tone mapping 讲完以后，再把 HDR 后处理链补完整。",
    ],
    status: "ready",
    mount: mountBloomAndHdrPostChainLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: hdrBloomLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(hdrBloomLessonRuntimeSource, [
          [1, 231],
          [233, 351],
          [353, 567],
          [569, 1115],
          [1117, 1394],
        ]),
        featured: true,
      },
      {
        id: "glb-loader",
        filename: "glb.ts",
        language: "ts",
        content: gltfPbrParserSource,
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
        content: gltfPbrMathSource,
      },
      {
        id: "model-vertex-shader",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: hdrBloomModelVertexShaderSource,
      },
      {
        id: "model-fragment-shader",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: hdrBloomModelFragmentShaderSource,
      },
      {
        id: "skybox-vertex-shader",
        filename: "skybox.vert.wgsl",
        language: "wgsl",
        content: hdrBloomSkyboxVertexShaderSource,
      },
      {
        id: "skybox-fragment-shader",
        filename: "skybox.frag.wgsl",
        language: "wgsl",
        content: hdrBloomSkyboxFragmentShaderSource,
      },
      {
        id: "emissive-shader",
        filename: "emissive.wgsl",
        language: "wgsl",
        content: hdrBloomEmissiveShaderSource,
      },
      {
        id: "bright-shader",
        filename: "bright.wgsl",
        language: "wgsl",
        content: hdrBloomBrightShaderSource,
      },
      {
        id: "blur-shader",
        filename: "blur.wgsl",
        language: "wgsl",
        content: hdrBloomBlurShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: hdrBloomPresentShaderSource,
      },
    ],
  },
{
    id: "58-ssao-and-screen-space-occlusion",
    order: 58,
    title: "SSAO 与屏幕空间环境光遮蔽",
    tagline: "让接触阴影先在 screen space 里长出来",
    goal: "补上一节典型的 screen-space shading 课，把深度/法线重建、采样核和遮蔽累积单独讲透，也顺手兑现 deferred / G-buffer 的工程价值。",
    summary:
      "这一课会从屏幕空间信息出发，估计局部环境遮蔽，让物体接触处和缝隙先获得更可信的暗化；重点不是做一个“变黑滤镜”，而是理解深度、法线、采样半径和降噪在 SSAO 里的职责。",
    notes: [
      "`screen-space`：SSAO 只看当前屏幕已经拥有的深度与法线，所以它快，但也天然不完整。",
      "`sample kernel`：真正决定观感的不是一个固定常数，而是一组围绕表面法线采样的局部探针。",
      "`occlusion accumulate`：多次采样后的遮蔽因子，会再进入 blur / edge-aware filtering 才能变得稳定。",
      "`这是 deferred 线的回响课`：它会让前面 G-buffer 的价值再次变得具体。",
    ],
    status: "ready",
    mount: mountSsaoAndScreenSpaceOcclusionLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: ssaoLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(ssaoLessonRuntimeSource, [
          [1, 239],
          [246, 299],
          [307, 310],
          [429, 472],
          [477, 866],
          [904, 1085],
        ]),
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: ssaoGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: ssaoMathSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: ssaoSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: ssaoSceneFragmentShaderSource,
      },
      {
        id: "ssao-shader",
        filename: "ssao.wgsl",
        language: "wgsl",
        content: ssaoShaderSource,
      },
      {
        id: "blur-shader",
        filename: "blur.wgsl",
        language: "wgsl",
        content: ssaoBlurShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: ssaoPresentShaderSource,
      },
    ],
  },
{
    id: "59-prefix-sum-and-stream-compaction",
    order: 59,
    title: "Compute：Prefix Sum 与 Stream Compaction",
    tagline: "把 GPU 上的大批量筛选与重排能力单独讲清楚",
    goal: "补上一节真正偏“GPU 数据操作”而不是“视觉效果”的 compute 工具课，把 prefix sum / scan 和 stream compaction 作为后续 GPU-driven 算法的基础设施单独讲透。",
    summary:
      "这一课会先从 prefix sum 讲起，再把它推进到 stream compaction：哪些元素要保留、保留后的新位置是多少、为什么这类操作会反复出现在粒子、剔除、可见性和更复杂的 GPU 数据管线里。",
    notes: [
      "`prefix sum / scan`：它不是终点，而是很多 GPU 数据重排算法的核心基础件。",
      "`stream compaction`：先判断保留谁，再把保留下来的元素压紧到连续缓冲里。",
      "`这是 compute 工具课`：重点放在数据流和 buffer 结构，不是场景观感本身。",
      "`它会给后续 GPU-driven 管线铺路`：很多看起来很高级的算法，底层都离不开这一步。",
    ],
    status: "ready",
    mount: mountPrefixSumAndStreamCompactionLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: prefixSumLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(prefixSumLessonRuntimeSource, [
          [1, 121],
          [123, 292],
          [294, 510],
          [512, 578],
          [580, 1114],
        ]),
        featured: true,
      },
      {
        id: "seed-helper",
        filename: "seed.ts",
        language: "ts",
        content: prefixSumSeedSource,
      },
      {
        id: "compute-shader",
        filename: "compute.wgsl",
        language: "wgsl",
        content: prefixSumComputeShaderSource,
      },
    ],
  },
{
    id: "60-bounding-volumes-and-frustum-culling",
    order: 60,
    title: "包围体与视锥裁剪",
    tagline: "先讲懂为什么实例会进入视野，再谈后面的 GPU-driven 剔除链",
    goal: "先把包围球、视锥 6 个平面和“实例到底算不算进入相机可见范围”这件事单独讲透，为后面的 compute 可见性与 GPU-driven 调度搭桥。",
    summary:
      "这一课会把 draw all 和 CPU frustum culling 并排展示，让学习者先看清楚包围球与视锥的关系：只要球还没离开视锥，就先把它保留下来；真正更激进的优化，再留给下一课继续推进。",
    notes: [
      "`bounding sphere`：先用足够便宜、足够稳定的包围球做可见性判断，而不是一上来就引入更复杂的包围体相交算法。",
      "`frustum planes`：实例是否进入视野，本质上就是包围球与 6 个视锥平面的关系判断。",
      "`draw all vs culled`：左侧故意保留完整阵列，右侧只画通过 CPU frustum test 的实例。",
      "`这是 GPU-driven 主线的桥接课`：先把几何意义讲清楚，再把同一件事搬进 compute。",
    ],
    status: "ready",
    mount: mountBoundingVolumesAndFrustumCullingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gpuDrivenFrustumLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gpuDrivenFrustumLessonRuntimeSource, [
          [1, 149],
          [150, 244],
          [246, 283],
          [285, 563],
          [564, 656],
        ]),
      },
      {
        id: "scene-helper",
        filename: "scene.ts",
        language: "ts",
        content: gpuDrivenSceneSource,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: gpuDrivenGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gpuDrivenMathSource,
      },
      {
        id: "render-helper",
        filename: "render.ts",
        language: "ts",
        content: gpuDrivenRenderSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneFragmentShaderSource,
      },
      {
        id: "bounds-vertex-shader",
        filename: "bounds.vert.wgsl",
        language: "wgsl",
        content: gpuDrivenBoundsVertexShaderSource,
      },
      {
        id: "bounds-fragment-shader",
        filename: "bounds.frag.wgsl",
        language: "wgsl",
        content: gpuDrivenBoundsFragmentShaderSource,
      },
    ],
  },
{
    id: "61-compute-frustum-culling-and-visibility-flags",
    order: 61,
    title: "Compute：Frustum Culling 与可见性标记",
    tagline: "把 CPU 版包围球测试原样搬进 compute，只先做到 visibility flags",
    goal: "把上一课已经讲清楚的 frustum test 搬进 compute，让 GPU 自己给每个实例写可见性标记，同时保留 CPU 参考路径做结果对照。",
    summary:
      "这一课不急着做 compaction 或 indirect draw，而是先把“GPU 生成 visibility flags”单独讲透：compute 负责写一整列 flags，render pass 直接消费这些 flags，CPU 只留下参考诊断和一致性校验。",
    notes: [
      "`GPU visibility flags`：右侧的 render pass 不需要 CPU 先压一份 visible list，直接读取 GPU 写好的 flags 就能工作。",
      "`CPU reference`：左侧继续保留 CPU 参考路径，方便检查 frustum planes 上传和 shader 判定是否一致。",
      "`mismatch`：只要 mismatch 不是 0，就说明 planes 或 compute 判定逻辑还没有对齐。",
      "`这节先停在 flags`：真正把 flags 压成连续 visible list，留到下一课继续推进。",
    ],
    status: "ready",
    mount: mountComputeFrustumCullingAndVisibilityFlagsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gpuDrivenFlagsLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gpuDrivenFlagsLessonRuntimeSource, [
          [1, 128],
          [129, 191],
          [193, 495],
          [496, 612],
        ]),
      },
      {
        id: "scene-helper",
        filename: "scene.ts",
        language: "ts",
        content: gpuDrivenSceneSource,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: gpuDrivenGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gpuDrivenMathSource,
      },
      {
        id: "render-helper",
        filename: "render.ts",
        language: "ts",
        content: gpuDrivenRenderSource,
      },
      {
        id: "compute-shader",
        filename: "compute.wgsl",
        language: "wgsl",
        content: gpuDrivenFlagsComputeShaderSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneFragmentShaderSource,
      },
    ],
  },
{
    id: "62-visible-list-and-indirect-draw",
    order: 62,
    title: "Visible List、Stream Compaction 与 Indirect Draw",
    tagline: "正式把 flags 推进成 compacted visible list，再交给 indirect draw",
    goal: "兑现第 59 课的 prefix sum / compaction，让 visibility flags 真正变成一份连续的 visible list，并直接驱动 drawIndexedIndirect。",
    summary:
      "这一课会把 flags-only 路径和真正的 GPU-driven visible list 并排展示：左栏仍然遍历完整实例数组，右栏则先做 prefix sum、再做 stream compaction，最后把 indirect args 也交给 GPU 写出来。",
    notes: [
      "`flags-only`：左栏虽然已经知道谁可见，但 draw 侧仍然在遍历完整实例数组。",
      "`scan + compaction`：右栏会把可见实例压成连续列表，让后续 draw 真正只消费保留下来的那一段数据。",
      "`indirect draw`：instanceCount 不再由 CPU 决定，而是直接从 GPU 写好的 args buffer 里读取。",
      "`这是 GPU-driven 主线的闭环课`：它让第 59 课的 scan / compaction 真正变成可视化的渲染输入。",
    ],
    status: "ready",
    mount: mountVisibleListAndIndirectDrawLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gpuDrivenVisibleListLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gpuDrivenVisibleListLessonRuntimeSource, [
          [1, 139],
          [140, 218],
          [220, 509],
          [510, 646],
          [647, 779],
        ]),
      },
      {
        id: "scene-helper",
        filename: "scene.ts",
        language: "ts",
        content: gpuDrivenSceneSource,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: gpuDrivenGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gpuDrivenMathSource,
      },
      {
        id: "render-helper",
        filename: "render.ts",
        language: "ts",
        content: gpuDrivenRenderSource,
      },
      {
        id: "compute-shader",
        filename: "compute.wgsl",
        language: "wgsl",
        content: gpuDrivenVisibleListComputeShaderSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneFragmentShaderSource,
      },
    ],
  },
{
    id: "63-hiz-and-occlusion-culling",
    order: 63,
    title: "Hi-Z 与 Occlusion Culling",
    tagline: "继续回答“虽然在视锥里，但它其实是不是已经被挡住了”",
    goal: "在 frustum culling 之后继续推进到遮挡裁剪，让学习者看清 depth pyramid / Hi-Z 为什么能把“已经被墙挡住”的实例从 draw 输入里继续剔掉。",
    summary:
      "这一课会先为右栏的大遮挡墙生成一份 depth pyramid，再对实例包围球做 conservative occlusion test；左栏继续只做 frustum culling，右栏则真正把墙后的实例批量从 indirect draw 输入里剔掉。",
    notes: [
      "`depth pyramid / Hi-Z`：先把 occluder 深度压成多层 min-depth 纹理，后面的遮挡判断才有稳定又便宜的查询基础。",
      "`frustum-only vs frustum + occlusion`：左栏故意不看遮挡，右栏则继续把“已经被挡住”的实例剔掉。",
      "`conservative test`：这里只做教学版遮挡裁剪，重点是稳定理解，不追求引擎级极限优化。",
      "`这是 visibility 线的下一台阶`：先进入视锥，再继续判断它其实该不该被提交。",
    ],
    status: "ready",
    mount: mountHiZAndOcclusionCullingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gpuDrivenHiZLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gpuDrivenHiZLessonRuntimeSource, [
          [1, 173],
          [174, 372],
          [374, 698],
          [699, 831],
          [832, 1057],
        ]),
      },
      {
        id: "scene-helper",
        filename: "scene.ts",
        language: "ts",
        content: gpuDrivenSceneSource,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: gpuDrivenGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gpuDrivenMathSource,
      },
      {
        id: "render-helper",
        filename: "render.ts",
        language: "ts",
        content: gpuDrivenRenderSource,
      },
      {
        id: "compute-shader",
        filename: "compute.wgsl",
        language: "wgsl",
        content: gpuDrivenHiZComputeShaderSource,
      },
      {
        id: "depth-copy-shader",
        filename: "depth-copy.wgsl",
        language: "wgsl",
        content: gpuDrivenHiZDepthCopyShaderSource,
      },
      {
        id: "depth-downsample-shader",
        filename: "depth-downsample.wgsl",
        language: "wgsl",
        content: gpuDrivenHiZDepthDownsampleShaderSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneFragmentShaderSource,
      },
    ],
  },
{
    id: "64-gpu-driven-lod-and-instance-scheduling",
    order: 64,
    title: "GPU-driven LOD 与实例调度",
    tagline: "把可见性链继续推进到多档 LOD 和多路 indirect scheduling",
    goal: "用已经建立好的 visibility + compaction 数据链，再往前推进到按距离选 LOD、分组 compact 和多路 indirect draw，让 GPU-driven 调度链在这一课闭环。",
    summary:
      "这一课会把实例按距离分成 3 档 LOD：左栏继续全部固定成 LOD0，右栏则先做可见性判断、再做 LOD 分类、再分别 compact 成 3 组 visible list，最后通过多次 indirect draw 完成真正的 GPU-driven scheduling。",
    notes: [
      "`LOD0 / LOD1 / LOD2`：距离越远，几何越简化，让 draw 负担和感知质量一起被调度。",
      "`classify -> compact -> indirect`：右栏不只是“知道该用哪档”，而是会把三档实例分别压成独立的 draw 输入。",
      "`freeze camera`：冻结相机以后，再拉 LOD 距离比例，会更容易看清三档实例是怎么重新分布的。",
      "`这是这批课的收束`：右栏现在已经是一条完整的 GPU-driven visibility + scheduling 链。",
    ],
    status: "ready",
    mount: mountGpuDrivenLodAndInstanceSchedulingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: gpuDrivenLodLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(gpuDrivenLodLessonRuntimeSource, [
          [1, 185],
          [186, 288],
          [290, 532],
          [533, 781],
          [782, 922],
        ]),
      },
      {
        id: "scene-helper",
        filename: "scene.ts",
        language: "ts",
        content: gpuDrivenSceneSource,
      },
      {
        id: "geometry-helper",
        filename: "geometry.ts",
        language: "ts",
        content: gpuDrivenGeometrySource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: gpuDrivenMathSource,
      },
      {
        id: "render-helper",
        filename: "render.ts",
        language: "ts",
        content: gpuDrivenRenderSource,
      },
      {
        id: "compute-shader",
        filename: "compute.wgsl",
        language: "wgsl",
        content: gpuDrivenLodComputeShaderSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: gpuDrivenSceneFragmentShaderSource,
      },
    ],
  }
];
