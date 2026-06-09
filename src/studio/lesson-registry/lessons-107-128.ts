import type { LessonDefinition } from "@/studio/types";
import { pickLessonSourceSegments } from "@/studio/lesson-segments";
import { mountTexture3dAndVolumeSlicesLesson } from "@/lessons/lesson-107-texture3d-and-volume-slices/lesson";
import lesson107Source0 from "@/lessons/lesson-107-texture3d-and-volume-slices/lesson.ts?raw";
import lesson107Source1 from "@/lessons/lesson-107-texture3d-and-volume-slices/density.ts?raw";
import lesson107Source2 from "@/lessons/lesson-107-texture3d-and-volume-slices/geometry.ts?raw";
import lesson107Source3 from "@/lessons/lesson-107-texture3d-and-volume-slices/math.ts?raw";
import lesson107Source4 from "@/lessons/lesson-107-texture3d-and-volume-slices/scene.frag.wgsl?raw";
import lesson107Source5 from "@/lessons/lesson-107-texture3d-and-volume-slices/scene.vert.wgsl?raw";
import { mountVolumeRenderingAndTexture3dLesson } from "@/lessons/lesson-108-volume-rendering-and-texture3d/lesson";
import lesson108Source0 from "@/lessons/lesson-108-volume-rendering-and-texture3d/lesson.ts?raw";
import lesson108Source1 from "@/lessons/lesson-108-volume-rendering-and-texture3d/density.ts?raw";
import lesson108Source2 from "@/lessons/lesson-108-volume-rendering-and-texture3d/geometry.ts?raw";
import lesson108Source3 from "@/lessons/lesson-108-volume-rendering-and-texture3d/math.ts?raw";
import lesson108Source4 from "@/lessons/lesson-108-volume-rendering-and-texture3d/scene.frag.wgsl?raw";
import lesson108Source5 from "@/lessons/lesson-108-volume-rendering-and-texture3d/scene.vert.wgsl?raw";
import lesson108Source6 from "@/lessons/lesson-108-volume-rendering-and-texture3d/volume.frag.wgsl?raw";
import { mountMetaballsAndImplicitFieldsLesson } from "@/lessons/lesson-109-metaballs-and-implicit-fields/lesson";
import lesson109Source0 from "@/lessons/lesson-109-metaballs-and-implicit-fields/lesson.ts?raw";
import lesson109Source1 from "@/lessons/lesson-109-metaballs-and-implicit-fields/field.ts?raw";
import lesson109Source2 from "@/lessons/lesson-109-metaballs-and-implicit-fields/geometry.ts?raw";
import lesson109Source3 from "@/lessons/lesson-109-metaballs-and-implicit-fields/math.ts?raw";
import lesson109Source4 from "@/lessons/lesson-109-metaballs-and-implicit-fields/scene.frag.wgsl?raw";
import lesson109Source5 from "@/lessons/lesson-109-metaballs-and-implicit-fields/scene.vert.wgsl?raw";
import { mountMarchingCubesAndMetaballsLesson } from "@/lessons/lesson-110-marching-cubes-and-metaballs/lesson";
import lesson110Source0 from "@/lessons/lesson-110-marching-cubes-and-metaballs/lesson.ts?raw";
import lesson110Source1 from "@/lessons/lesson-110-marching-cubes-and-metaballs/geometry.ts?raw";
import lesson110Source2 from "@/lessons/lesson-110-marching-cubes-and-metaballs/math.ts?raw";
import lesson110Source3 from "@/lessons/lesson-110-marching-cubes-and-metaballs/metaballs.compute.wgsl?raw";
import lesson110Source4 from "@/lessons/lesson-110-marching-cubes-and-metaballs/scene.frag.wgsl?raw";
import lesson110Source5 from "@/lessons/lesson-110-marching-cubes-and-metaballs/scene.vert.wgsl?raw";
import { mountClusterBuildAndLightCullingLesson } from "@/lessons/lesson-111-cluster-build-and-light-culling/lesson";
import lesson111Source0 from "@/lessons/lesson-111-cluster-build-and-light-culling/lesson.ts?raw";
import lesson111Source1 from "@/lessons/lesson-111-cluster-build-and-light-culling/clusters.compute.wgsl?raw";
import lesson111Source2 from "@/lessons/lesson-111-cluster-build-and-light-culling/geometry.ts?raw";
import lesson111Source3 from "@/lessons/lesson-111-cluster-build-and-light-culling/math.ts?raw";
import lesson111Source4 from "@/lessons/lesson-111-cluster-build-and-light-culling/scene.frag.wgsl?raw";
import lesson111Source5 from "@/lessons/lesson-111-cluster-build-and-light-culling/scene.vert.wgsl?raw";
import { mountClusteredShadingLesson } from "@/lessons/lesson-112-clustered-shading/lesson";
import lesson112Source0 from "@/lessons/lesson-112-clustered-shading/lesson.ts?raw";
import lesson112Source1 from "@/lessons/lesson-112-clustered-shading/clusters.compute.wgsl?raw";
import lesson112Source2 from "@/lessons/lesson-112-clustered-shading/geometry.ts?raw";
import lesson112Source3 from "@/lessons/lesson-112-clustered-shading/math.ts?raw";
import lesson112Source4 from "@/lessons/lesson-112-clustered-shading/scene.frag.wgsl?raw";
import lesson112Source5 from "@/lessons/lesson-112-clustered-shading/scene.vert.wgsl?raw";
import { mountOitMotivationLesson } from "@/lessons/lesson-113-oit-motivation/lesson";
import lesson113Source0 from "@/lessons/lesson-113-oit-motivation/lesson.ts?raw";
import lesson113Source1 from "@/lessons/lesson-113-oit-motivation/geometry.ts?raw";
import lesson113Source2 from "@/lessons/lesson-113-oit-motivation/math.ts?raw";
import lesson113Source3 from "@/lessons/lesson-113-oit-motivation/scene.frag.wgsl?raw";
import lesson113Source4 from "@/lessons/lesson-113-oit-motivation/scene.vert.wgsl?raw";
import { mountABufferAndOitLesson } from "@/lessons/lesson-114-a-buffer-and-oit/lesson";
import lesson114Source0 from "@/lessons/lesson-114-a-buffer-and-oit/lesson.ts?raw";
import lesson114Source1 from "@/lessons/lesson-114-a-buffer-and-oit/abuffer.frag.wgsl?raw";
import lesson114Source2 from "@/lessons/lesson-114-a-buffer-and-oit/geometry.ts?raw";
import lesson114Source3 from "@/lessons/lesson-114-a-buffer-and-oit/math.ts?raw";
import lesson114Source4 from "@/lessons/lesson-114-a-buffer-and-oit/resolve.wgsl?raw";
import lesson114Source5 from "@/lessons/lesson-114-a-buffer-and-oit/scene.frag.wgsl?raw";
import lesson114Source6 from "@/lessons/lesson-114-a-buffer-and-oit/scene.vert.wgsl?raw";
import { mountCanvasFormatColorSpaceAndPresentationToneMappingLesson } from "@/lessons/lesson-115-canvas-format-color-space-and-presentation-tone-mapping/lesson";
import lesson115Source0 from "@/lessons/lesson-115-canvas-format-color-space-and-presentation-tone-mapping/lesson.ts?raw";
import lesson115Source1 from "@/lessons/lesson-115-canvas-format-color-space-and-presentation-tone-mapping/presentation-tone.wgsl?raw";
import { mountHdrExposureAndToneMappingLesson } from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/lesson";
import lesson116Source0 from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/lesson.ts?raw";
import lesson116Source1 from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/model.frag.wgsl?raw";
import lesson116Source2 from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/model.vert.wgsl?raw";
import lesson116Source3 from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/present.wgsl?raw";
import lesson116Source4 from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/skybox.frag.wgsl?raw";
import lesson116Source5 from "@/lessons/lesson-116-hdr-exposure-and-tone-mapping/skybox.vert.wgsl?raw";
import { mountBloomAndHdrPostChainLesson } from "@/lessons/lesson-117-bloom-and-hdr-post-chain/lesson";
import lesson117Source0 from "@/lessons/lesson-117-bloom-and-hdr-post-chain/lesson.ts?raw";
import lesson117Source1 from "@/lessons/lesson-117-bloom-and-hdr-post-chain/blur.wgsl?raw";
import lesson117Source2 from "@/lessons/lesson-117-bloom-and-hdr-post-chain/bright.wgsl?raw";
import lesson117Source3 from "@/lessons/lesson-117-bloom-and-hdr-post-chain/emissive.wgsl?raw";
import lesson117Source4 from "@/lessons/lesson-117-bloom-and-hdr-post-chain/model.frag.wgsl?raw";
import lesson117Source5 from "@/lessons/lesson-117-bloom-and-hdr-post-chain/model.vert.wgsl?raw";
import lesson117Source6 from "@/lessons/lesson-117-bloom-and-hdr-post-chain/present.wgsl?raw";
import lesson117Source7 from "@/lessons/lesson-117-bloom-and-hdr-post-chain/skybox.frag.wgsl?raw";
import lesson117Source8 from "@/lessons/lesson-117-bloom-and-hdr-post-chain/skybox.vert.wgsl?raw";
import { mountSsaoAndScreenSpaceOcclusionLesson } from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/lesson";
import lesson118Source0 from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/lesson.ts?raw";
import lesson118Source1 from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/blur.wgsl?raw";
import lesson118Source2 from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/geometry.ts?raw";
import lesson118Source3 from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/math.ts?raw";
import lesson118Source4 from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/present.wgsl?raw";
import lesson118Source5 from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/scene.frag.wgsl?raw";
import lesson118Source6 from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/scene.vert.wgsl?raw";
import lesson118Source7 from "@/lessons/lesson-118-ssao-and-screen-space-occlusion/ssao.wgsl?raw";
import { mountPrefixSumAndStreamCompactionLesson } from "@/lessons/lesson-119-prefix-sum-and-stream-compaction/lesson";
import lesson119Source0 from "@/lessons/lesson-119-prefix-sum-and-stream-compaction/lesson.ts?raw";
import lesson119Source1 from "@/lessons/lesson-119-prefix-sum-and-stream-compaction/compute.wgsl?raw";
import lesson119Source2 from "@/lessons/lesson-119-prefix-sum-and-stream-compaction/seed.ts?raw";
import { mountBoundingVolumesAndFrustumCullingLesson } from "@/lessons/lesson-120-bounding-volumes-and-frustum-culling/lesson";
import lesson120Source0 from "@/lessons/lesson-120-bounding-volumes-and-frustum-culling/lesson.ts?raw";
import { mountComputeFrustumCullingAndVisibilityFlagsLesson } from "@/lessons/lesson-121-compute-frustum-culling-and-visibility-flags/lesson";
import lesson121Source0 from "@/lessons/lesson-121-compute-frustum-culling-and-visibility-flags/lesson.ts?raw";
import lesson121Source1 from "@/lessons/lesson-121-compute-frustum-culling-and-visibility-flags/compute.wgsl?raw";
import { mountVisibleListAndIndirectDrawLesson } from "@/lessons/lesson-122-visible-list-and-indirect-draw/lesson";
import lesson122Source0 from "@/lessons/lesson-122-visible-list-and-indirect-draw/lesson.ts?raw";
import lesson122Source1 from "@/lessons/lesson-122-visible-list-and-indirect-draw/compute.wgsl?raw";
import { mountHiZAndOcclusionCullingLesson } from "@/lessons/lesson-123-hiz-and-occlusion-culling/lesson";
import lesson123Source0 from "@/lessons/lesson-123-hiz-and-occlusion-culling/lesson.ts?raw";
import lesson123Source1 from "@/lessons/lesson-123-hiz-and-occlusion-culling/compute.wgsl?raw";
import lesson123Source2 from "@/lessons/lesson-123-hiz-and-occlusion-culling/depth-copy.wgsl?raw";
import lesson123Source3 from "@/lessons/lesson-123-hiz-and-occlusion-culling/depth-downsample.wgsl?raw";
import { mountGpuDrivenLodAndInstanceSchedulingLesson } from "@/lessons/lesson-124-gpu-driven-lod-and-instance-scheduling/lesson";
import lesson124Source0 from "@/lessons/lesson-124-gpu-driven-lod-and-instance-scheduling/lesson.ts?raw";
import lesson124Source1 from "@/lessons/lesson-124-gpu-driven-lod-and-instance-scheduling/compute.wgsl?raw";
import { mountMotionVectorsAndVelocityBufferLesson } from "@/lessons/lesson-125-motion-vectors-and-velocity-buffer/lesson";
import lesson125Source0 from "@/lessons/lesson-125-motion-vectors-and-velocity-buffer/lesson.ts?raw";
import lesson125Source1 from "@/lessons/lesson-125-motion-vectors-and-velocity-buffer/present.wgsl?raw";
import lesson125Source2 from "@/lessons/lesson-125-motion-vectors-and-velocity-buffer/scene.frag.wgsl?raw";
import lesson125Source3 from "@/lessons/lesson-125-motion-vectors-and-velocity-buffer/scene.vert.wgsl?raw";
import { mountTaaAndHistoryReprojectionLesson } from "@/lessons/lesson-126-taa-and-history-reprojection/lesson";
import lesson126Source0 from "@/lessons/lesson-126-taa-and-history-reprojection/lesson.ts?raw";
import lesson126Source1 from "@/lessons/lesson-126-taa-and-history-reprojection/present.wgsl?raw";
import lesson126Source2 from "@/lessons/lesson-126-taa-and-history-reprojection/scene.frag.wgsl?raw";
import lesson126Source3 from "@/lessons/lesson-126-taa-and-history-reprojection/scene.vert.wgsl?raw";
import lesson126Source4 from "@/lessons/lesson-126-taa-and-history-reprojection/taa.wgsl?raw";
import { mountMotionBlurAndShutterIntegrationLesson } from "@/lessons/lesson-127-motion-blur-and-shutter-integration/lesson";
import lesson127Source0 from "@/lessons/lesson-127-motion-blur-and-shutter-integration/lesson.ts?raw";
import lesson127Source1 from "@/lessons/lesson-127-motion-blur-and-shutter-integration/present.wgsl?raw";
import lesson127Source2 from "@/lessons/lesson-127-motion-blur-and-shutter-integration/scene.frag.wgsl?raw";
import lesson127Source3 from "@/lessons/lesson-127-motion-blur-and-shutter-integration/scene.vert.wgsl?raw";
import { mountSsrAndScreenSpaceReflectionsLesson } from "@/lessons/lesson-128-ssr-and-screen-space-reflections/lesson";
import lesson128Source0 from "@/lessons/lesson-128-ssr-and-screen-space-reflections/lesson.ts?raw";
import lesson128Source1 from "@/lessons/lesson-128-ssr-and-screen-space-reflections/scene.frag.wgsl?raw";
import lesson128Source2 from "@/lessons/lesson-128-ssr-and-screen-space-reflections/scene.vert.wgsl?raw";
import lesson128Source3 from "@/lessons/lesson-128-ssr-and-screen-space-reflections/ssr.wgsl?raw";

export const lessons107To128: LessonDefinition[] = [
  {
    id: "107-texture3d-and-volume-slices",
    order: 107,
    title: "3D Texture 与体数据切片",
    tagline: "第 107 课：3D Texture 与体数据切片",
    goal: "学习 3D Texture 与体数据切片：texture format / usage / texture view / sampler / WGSL texture sampling / 3D texture sampling。",
    summary:
      "本课聚焦 3D Texture 与体数据切片 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / 3D texture sampling。",
    ],
    status: "ready",
    mount: mountTexture3dAndVolumeSlicesLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson107Source0,
        displaySegments: pickLessonSourceSegments(lesson107Source0),
        featured: true,
      },
      {
        id: "density-ts",
        filename: "density.ts",
        language: "ts",
        content: lesson107Source1,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson107Source2,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson107Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson107Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson107Source5,
      },
    ],
  },
  {
    id: "108-volume-rendering-and-texture3d",
    order: 108,
    title: "体渲染与 Ray Marching",
    tagline: "第 108 课：体渲染与 Ray Marching",
    goal: "学习 体渲染与 Ray Marching：texture format / usage / texture view / sampler / WGSL texture sampling / 3D texture sampling。",
    summary:
      "本课聚焦 体渲染与 Ray Marching 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / 3D texture sampling。",
    ],
    status: "ready",
    mount: mountVolumeRenderingAndTexture3dLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson108Source0,
        displaySegments: pickLessonSourceSegments(lesson108Source0),
        featured: true,
      },
      {
        id: "density-ts",
        filename: "density.ts",
        language: "ts",
        content: lesson108Source1,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson108Source2,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson108Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson108Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson108Source5,
      },
      {
        id: "volume-frag-wgsl",
        filename: "volume.frag.wgsl",
        language: "wgsl",
        content: lesson108Source6,
      },
    ],
  },
  {
    id: "109-metaballs-and-implicit-fields",
    order: 109,
    title: "Metaballs 与隐式场",
    tagline: "第 109 课：Metaballs 与隐式场",
    goal: "学习 Metaballs 与隐式场：implicit field / surface extraction / GPU-generated mesh。",
    summary:
      "本课聚焦 Metaballs 与隐式场 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：implicit field / surface extraction / GPU-generated mesh。",
    ],
    status: "ready",
    mount: mountMetaballsAndImplicitFieldsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson109Source0,
        displaySegments: pickLessonSourceSegments(lesson109Source0),
        featured: true,
      },
      {
        id: "field-ts",
        filename: "field.ts",
        language: "ts",
        content: lesson109Source1,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson109Source2,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson109Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson109Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson109Source5,
      },
    ],
  },
  {
    id: "110-marching-cubes-and-metaballs",
    order: 110,
    title: "Marching Cubes 与 GPU 网格提取",
    tagline: "第 110 课：Marching Cubes 与 GPU 网格提取",
    goal: "学习 Marching Cubes 与 GPU 网格提取：implicit field / surface extraction / GPU-generated mesh。",
    summary:
      "本课聚焦 Marching Cubes 与 GPU 网格提取 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：implicit field / surface extraction / GPU-generated mesh。",
    ],
    status: "ready",
    mount: mountMarchingCubesAndMetaballsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson110Source0,
        displaySegments: pickLessonSourceSegments(lesson110Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson110Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson110Source2,
      },
      {
        id: "metaballs-compute-wgsl",
        filename: "metaballs.compute.wgsl",
        language: "wgsl",
        content: lesson110Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson110Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson110Source5,
      },
    ],
  },
  {
    id: "111-cluster-build-and-light-culling",
    order: 111,
    title: "Cluster 构建与 Light Culling",
    tagline: "第 111 课：Cluster 构建与 Light Culling",
    goal: "学习 Cluster 构建与 Light Culling：cluster grid / light list culling / clustered shading。",
    summary:
      "本课聚焦 Cluster 构建与 Light Culling 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：cluster grid / light list culling / clustered shading。",
    ],
    status: "ready",
    mount: mountClusterBuildAndLightCullingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson111Source0,
        displaySegments: pickLessonSourceSegments(lesson111Source0),
        featured: true,
      },
      {
        id: "clusters-compute-wgsl",
        filename: "clusters.compute.wgsl",
        language: "wgsl",
        content: lesson111Source1,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson111Source2,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson111Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson111Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson111Source5,
      },
    ],
  },
  {
    id: "112-clustered-shading",
    order: 112,
    title: "Clustered Shading",
    tagline: "第 112 课：Clustered Shading",
    goal: "学习 Clustered Shading：cluster grid / light list culling / clustered shading。",
    summary:
      "本课聚焦 Clustered Shading 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：cluster grid / light list culling / clustered shading。",
    ],
    status: "ready",
    mount: mountClusteredShadingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson112Source0,
        displaySegments: pickLessonSourceSegments(lesson112Source0),
        featured: true,
      },
      {
        id: "clusters-compute-wgsl",
        filename: "clusters.compute.wgsl",
        language: "wgsl",
        content: lesson112Source1,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson112Source2,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson112Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson112Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson112Source5,
      },
    ],
  },
  {
    id: "113-oit-motivation",
    order: 113,
    title: "透明顺序问题与 OIT 动机",
    tagline: "第 113 课：透明顺序问题与 OIT 动机",
    goal: "学习 透明顺序问题与 OIT 动机：color target blend state / alpha compositing / 透明排序 / per-pixel fragment list。",
    summary:
      "本课聚焦 透明顺序问题与 OIT 动机 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：color target blend state / alpha compositing / 透明排序 / per-pixel fragment list。",
    ],
    status: "ready",
    mount: mountOitMotivationLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson113Source0,
        displaySegments: pickLessonSourceSegments(lesson113Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson113Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson113Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson113Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson113Source4,
      },
    ],
  },
  {
    id: "114-a-buffer-and-oit",
    order: 114,
    title: "A-Buffer 与顺序无关透明",
    tagline: "第 114 课：A-Buffer 与顺序无关透明",
    goal: "学习 A-Buffer 与顺序无关透明：color target blend state / alpha compositing / 透明排序 / per-pixel fragment list。",
    summary:
      "本课聚焦 A-Buffer 与顺序无关透明 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：color target blend state / alpha compositing / 透明排序 / per-pixel fragment list。",
    ],
    status: "ready",
    mount: mountABufferAndOitLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson114Source0,
        displaySegments: pickLessonSourceSegments(lesson114Source0),
        featured: true,
      },
      {
        id: "abuffer-frag-wgsl",
        filename: "abuffer.frag.wgsl",
        language: "wgsl",
        content: lesson114Source1,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson114Source2,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson114Source3,
      },
      {
        id: "resolve-wgsl",
        filename: "resolve.wgsl",
        language: "wgsl",
        content: lesson114Source4,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson114Source5,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson114Source6,
      },
    ],
  },
  {
    id: "115-canvas-format-color-space-and-presentation-tone-mapping",
    order: 115,
    title: "Canvas Format、Color Space 与 Presentation Tone Mapping",
    tagline: "第 115 课：Canvas Format、Color Space 与 Presentation Tone Mapping",
    goal: "学习 Canvas Format、Color Space 与 Presentation Tone Mapping：offscreen render target / fullscreen pass / post-process sampling。",
    summary:
      "本课聚焦 Canvas Format、Color Space 与 Presentation Tone Mapping 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：offscreen render target / fullscreen pass / post-process sampling。",
    ],
    status: "ready",
    mount: mountCanvasFormatColorSpaceAndPresentationToneMappingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson115Source0,
        displaySegments: pickLessonSourceSegments(lesson115Source0),
        featured: true,
      },
      {
        id: "presentation-tone-wgsl",
        filename: "presentation-tone.wgsl",
        language: "wgsl",
        content: lesson115Source1,
      },
    ],
  },
  {
    id: "116-hdr-exposure-and-tone-mapping",
    order: 116,
    title: "HDR、曝光与 Tone Mapping",
    tagline: "第 116 课：HDR、曝光与 Tone Mapping",
    goal: "学习 HDR、曝光与 Tone Mapping：offscreen render target / fullscreen pass / post-process sampling。",
    summary:
      "本课聚焦 HDR、曝光与 Tone Mapping 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：offscreen render target / fullscreen pass / post-process sampling。",
    ],
    status: "ready",
    mount: mountHdrExposureAndToneMappingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson116Source0,
        displaySegments: pickLessonSourceSegments(lesson116Source0),
        featured: true,
      },
      {
        id: "model-frag-wgsl",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: lesson116Source1,
      },
      {
        id: "model-vert-wgsl",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: lesson116Source2,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson116Source3,
      },
      {
        id: "skybox-frag-wgsl",
        filename: "skybox.frag.wgsl",
        language: "wgsl",
        content: lesson116Source4,
      },
      {
        id: "skybox-vert-wgsl",
        filename: "skybox.vert.wgsl",
        language: "wgsl",
        content: lesson116Source5,
      },
    ],
  },
  {
    id: "117-bloom-and-hdr-post-chain",
    order: 117,
    title: "Bloom 与 HDR 后处理链",
    tagline: "第 117 课：Bloom 与 HDR 后处理链",
    goal: "学习 Bloom 与 HDR 后处理链：offscreen render target / fullscreen pass / post-process sampling。",
    summary:
      "本课聚焦 Bloom 与 HDR 后处理链 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：offscreen render target / fullscreen pass / post-process sampling。",
    ],
    status: "ready",
    mount: mountBloomAndHdrPostChainLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson117Source0,
        displaySegments: pickLessonSourceSegments(lesson117Source0),
        featured: true,
      },
      {
        id: "blur-wgsl",
        filename: "blur.wgsl",
        language: "wgsl",
        content: lesson117Source1,
      },
      {
        id: "bright-wgsl",
        filename: "bright.wgsl",
        language: "wgsl",
        content: lesson117Source2,
      },
      {
        id: "emissive-wgsl",
        filename: "emissive.wgsl",
        language: "wgsl",
        content: lesson117Source3,
      },
      {
        id: "model-frag-wgsl",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: lesson117Source4,
      },
      {
        id: "model-vert-wgsl",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: lesson117Source5,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson117Source6,
      },
      {
        id: "skybox-frag-wgsl",
        filename: "skybox.frag.wgsl",
        language: "wgsl",
        content: lesson117Source7,
      },
      {
        id: "skybox-vert-wgsl",
        filename: "skybox.vert.wgsl",
        language: "wgsl",
        content: lesson117Source8,
      },
    ],
  },
  {
    id: "118-ssao-and-screen-space-occlusion",
    order: 118,
    title: "SSAO 与屏幕空间环境光遮蔽",
    tagline: "第 118 课：SSAO 与屏幕空间环境光遮蔽",
    goal: "学习 SSAO 与屏幕空间环境光遮蔽：GPUQuerySet / resolveQuerySet / readback latency / screen-space ray march。",
    summary:
      "本课聚焦 SSAO 与屏幕空间环境光遮蔽 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：GPUQuerySet / resolveQuerySet / readback latency / screen-space ray march。",
    ],
    status: "ready",
    mount: mountSsaoAndScreenSpaceOcclusionLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson118Source0,
        displaySegments: pickLessonSourceSegments(lesson118Source0),
        featured: true,
      },
      {
        id: "blur-wgsl",
        filename: "blur.wgsl",
        language: "wgsl",
        content: lesson118Source1,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson118Source2,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson118Source3,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson118Source4,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson118Source5,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson118Source6,
      },
      {
        id: "ssao-wgsl",
        filename: "ssao.wgsl",
        language: "wgsl",
        content: lesson118Source7,
      },
    ],
  },
  {
    id: "119-prefix-sum-and-stream-compaction",
    order: 119,
    title: "Compute：Prefix Sum 与 Stream Compaction",
    tagline: "第 119 课：Compute：Prefix Sum 与 Stream Compaction",
    goal: "学习 Compute：Prefix Sum 与 Stream Compaction：parallel scan / compaction / visible list。",
    summary:
      "本课聚焦 Compute：Prefix Sum 与 Stream Compaction 的核心链路，重点观察 requestAdapter / requestDevice / getContext(\"webgpu\") / createShaderModule 与 @compute / @workgroup_size / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getContext(\"webgpu\") / createShaderModule。",
      "WGSL / 数据流：@compute / @workgroup_size / @group / @binding。",
      "核心知识点：parallel scan / compaction / visible list。",
    ],
    status: "ready",
    mount: mountPrefixSumAndStreamCompactionLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson119Source0,
        displaySegments: pickLessonSourceSegments(lesson119Source0),
        featured: true,
      },
      {
        id: "compute-wgsl",
        filename: "compute.wgsl",
        language: "wgsl",
        content: lesson119Source1,
      },
      {
        id: "seed-ts",
        filename: "seed.ts",
        language: "ts",
        content: lesson119Source2,
      },
    ],
  },
  {
    id: "120-bounding-volumes-and-frustum-culling",
    order: 120,
    title: "包围体与视锥裁剪",
    tagline: "第 120 课：包围体与视锥裁剪",
    goal: "学习 包围体与视锥裁剪：frustum planes / GPU culling / compaction / indirect draw / LOD scheduling。",
    summary:
      "本课聚焦 包围体与视锥裁剪 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 数据布局 / buffer / texture 资源流 / frustum planes 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：数据布局 / buffer / texture 资源流 / frustum planes。",
      "核心知识点：frustum planes / GPU culling / compaction / indirect draw / LOD scheduling。",
    ],
    status: "ready",
    mount: mountBoundingVolumesAndFrustumCullingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson120Source0,
        displaySegments: pickLessonSourceSegments(lesson120Source0),
        featured: true,
      },
    ],
  },
  {
    id: "121-compute-frustum-culling-and-visibility-flags",
    order: 121,
    title: "Compute：Frustum Culling 与可见性标记",
    tagline: "第 121 课：Compute：Frustum Culling 与可见性标记",
    goal: "学习 Compute：Frustum Culling 与可见性标记：frustum planes / GPU culling / compaction / indirect draw / LOD scheduling。",
    summary:
      "本课聚焦 Compute：Frustum Culling 与可见性标记 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @compute / @workgroup_size / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@compute / @workgroup_size / @group / @binding。",
      "核心知识点：frustum planes / GPU culling / compaction / indirect draw / LOD scheduling。",
    ],
    status: "ready",
    mount: mountComputeFrustumCullingAndVisibilityFlagsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson121Source0,
        displaySegments: pickLessonSourceSegments(lesson121Source0),
        featured: true,
      },
      {
        id: "compute-wgsl",
        filename: "compute.wgsl",
        language: "wgsl",
        content: lesson121Source1,
      },
    ],
  },
  {
    id: "122-visible-list-and-indirect-draw",
    order: 122,
    title: "Visible List、Stream Compaction 与 Indirect Draw",
    tagline: "第 122 课：Visible List、Stream Compaction 与 Indirect Draw",
    goal: "学习 Visible List、Stream Compaction 与 Indirect Draw：environment map sampling / diffuse/specular IBL / skybox lighting / parallel scan。",
    summary:
      "本课聚焦 Visible List、Stream Compaction 与 Indirect Draw 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @compute / @workgroup_size / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@compute / @workgroup_size / @group / @binding。",
      "核心知识点：environment map sampling / diffuse/specular IBL / skybox lighting / parallel scan。",
    ],
    status: "ready",
    mount: mountVisibleListAndIndirectDrawLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson122Source0,
        displaySegments: pickLessonSourceSegments(lesson122Source0),
        featured: true,
      },
      {
        id: "compute-wgsl",
        filename: "compute.wgsl",
        language: "wgsl",
        content: lesson122Source1,
      },
    ],
  },
  {
    id: "123-hiz-and-occlusion-culling",
    order: 123,
    title: "Hi-Z 与 Occlusion Culling",
    tagline: "第 123 课：Hi-Z 与 Occlusion Culling",
    goal: "学习 Hi-Z 与 Occlusion Culling：GPUQuerySet / resolveQuerySet / readback latency / frustum planes。",
    summary:
      "本课聚焦 Hi-Z 与 Occlusion Culling 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：GPUQuerySet / resolveQuerySet / readback latency / frustum planes。",
    ],
    status: "ready",
    mount: mountHiZAndOcclusionCullingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson123Source0,
        displaySegments: pickLessonSourceSegments(lesson123Source0),
        featured: true,
      },
      {
        id: "compute-wgsl",
        filename: "compute.wgsl",
        language: "wgsl",
        content: lesson123Source1,
      },
      {
        id: "depth-copy-wgsl",
        filename: "depth-copy.wgsl",
        language: "wgsl",
        content: lesson123Source2,
      },
      {
        id: "depth-downsample-wgsl",
        filename: "depth-downsample.wgsl",
        language: "wgsl",
        content: lesson123Source3,
      },
    ],
  },
  {
    id: "124-gpu-driven-lod-and-instance-scheduling",
    order: 124,
    title: "GPU-driven LOD 与实例调度",
    tagline: "第 124 课：GPU-driven LOD 与实例调度",
    goal: "学习 GPU-driven LOD 与实例调度：frustum planes / GPU culling / compaction / indirect draw / LOD scheduling。",
    summary:
      "本课聚焦 GPU-driven LOD 与实例调度 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @compute / @workgroup_size / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@compute / @workgroup_size / @group / @binding。",
      "核心知识点：frustum planes / GPU culling / compaction / indirect draw / LOD scheduling。",
    ],
    status: "ready",
    mount: mountGpuDrivenLodAndInstanceSchedulingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson124Source0,
        displaySegments: pickLessonSourceSegments(lesson124Source0),
        featured: true,
      },
      {
        id: "compute-wgsl",
        filename: "compute.wgsl",
        language: "wgsl",
        content: lesson124Source1,
      },
    ],
  },
  {
    id: "125-motion-vectors-and-velocity-buffer",
    order: 125,
    title: "Motion Vectors 与 Velocity Buffer",
    tagline: "第 125 课：Motion Vectors 与 Velocity Buffer",
    goal: "学习 Motion Vectors 与 Velocity Buffer：velocity buffer / history reprojection / temporal reconstruction。",
    summary:
      "本课聚焦 Motion Vectors 与 Velocity Buffer 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：velocity buffer / history reprojection / temporal reconstruction。",
    ],
    status: "ready",
    mount: mountMotionVectorsAndVelocityBufferLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson125Source0,
        displaySegments: pickLessonSourceSegments(lesson125Source0),
        featured: true,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson125Source1,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson125Source2,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson125Source3,
      },
    ],
  },
  {
    id: "126-taa-and-history-reprojection",
    order: 126,
    title: "TAA 与历史重投影",
    tagline: "第 126 课：TAA 与历史重投影",
    goal: "学习 TAA 与历史重投影：velocity buffer / history reprojection / temporal reconstruction。",
    summary:
      "本课聚焦 TAA 与历史重投影 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：velocity buffer / history reprojection / temporal reconstruction。",
    ],
    status: "ready",
    mount: mountTaaAndHistoryReprojectionLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson126Source0,
        displaySegments: pickLessonSourceSegments(lesson126Source0),
        featured: true,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson126Source1,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson126Source2,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson126Source3,
      },
      {
        id: "taa-wgsl",
        filename: "taa.wgsl",
        language: "wgsl",
        content: lesson126Source4,
      },
    ],
  },
  {
    id: "127-motion-blur-and-shutter-integration",
    order: 127,
    title: "Motion Blur 与快门积分",
    tagline: "第 127 课：Motion Blur 与快门积分",
    goal: "学习 Motion Blur 与快门积分：offscreen render target / fullscreen pass / post-process sampling / velocity buffer。",
    summary:
      "本课聚焦 Motion Blur 与快门积分 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：offscreen render target / fullscreen pass / post-process sampling / velocity buffer。",
    ],
    status: "ready",
    mount: mountMotionBlurAndShutterIntegrationLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson127Source0,
        displaySegments: pickLessonSourceSegments(lesson127Source0),
        featured: true,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson127Source1,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson127Source2,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson127Source3,
      },
    ],
  },
  {
    id: "128-ssr-and-screen-space-reflections",
    order: 128,
    title: "SSR 与屏幕空间反射",
    tagline: "第 128 课：SSR 与屏幕空间反射",
    goal: "学习 SSR 与屏幕空间反射：screen-space ray march / depth/normal G-buffer / hit/fallback logic。",
    summary:
      "本课聚焦 SSR 与屏幕空间反射 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：screen-space ray march / depth/normal G-buffer / hit/fallback logic。",
    ],
    status: "ready",
    mount: mountSsrAndScreenSpaceReflectionsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson128Source0,
        displaySegments: pickLessonSourceSegments(lesson128Source0),
        featured: true,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson128Source1,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson128Source2,
      },
      {
        id: "ssr-wgsl",
        filename: "ssr.wgsl",
        language: "wgsl",
        content: lesson128Source3,
      },
    ],
  },
];
