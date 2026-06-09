import type { LessonDefinition } from "@/studio/types";
import { pickLessonSourceSegments } from "@/studio/lesson-segments";
import { mountInstancingLesson } from "@/lessons/lesson-52-instancing/lesson";
import lesson52Source0 from "@/lessons/lesson-52-instancing/lesson.ts?raw";
import lesson52Source1 from "@/lessons/lesson-52-instancing/cube-data.ts?raw";
import lesson52Source2 from "@/lessons/lesson-52-instancing/cube.frag.wgsl?raw";
import lesson52Source3 from "@/lessons/lesson-52-instancing/cube.vert.wgsl?raw";
import lesson52Source4 from "@/lessons/lesson-52-instancing/math.ts?raw";
import { mountPrimitiveTopologyCullModeAndFrontFaceLesson } from "@/lessons/lesson-53-primitive-topology-cull-mode-and-front-face/lesson";
import lesson53Source0 from "@/lessons/lesson-53-primitive-topology-cull-mode-and-front-face/lesson.ts?raw";
import lesson53Source1 from "@/lessons/lesson-53-primitive-topology-cull-mode-and-front-face/primitive-state.wgsl?raw";
import { mountDrawParametersBaseVertexFirstInstanceAndIndirectBufferLesson } from "@/lessons/lesson-54-draw-parameters-base-vertex-first-instance-and-indirect-buffer/lesson";
import lesson54Source0 from "@/lessons/lesson-54-draw-parameters-base-vertex-first-instance-and-indirect-buffer/lesson.ts?raw";
import lesson54Source1 from "@/lessons/lesson-54-draw-parameters-base-vertex-first-instance-and-indirect-buffer/draw-parameters.wgsl?raw";
import { mountComputeFoundationsLesson } from "@/lessons/lesson-55-compute-foundations/lesson";
import lesson55Source0 from "@/lessons/lesson-55-compute-foundations/lesson.ts?raw";
import lesson55Source1 from "@/lessons/lesson-55-compute-foundations/compute.wgsl?raw";
import lesson55Source2 from "@/lessons/lesson-55-compute-foundations/seed.ts?raw";
import { mountStorageBufferReadWriteAndRuntimeSizedArraysLesson } from "@/lessons/lesson-56-storage-buffer-read-write-and-runtime-sized-arrays/lesson";
import lesson56Source0 from "@/lessons/lesson-56-storage-buffer-read-write-and-runtime-sized-arrays/lesson.ts?raw";
import lesson56Source1 from "@/lessons/lesson-56-storage-buffer-read-write-and-runtime-sized-arrays/storage-buffer.compute.wgsl?raw";
import lesson56Source2 from "@/lessons/lesson-56-storage-buffer-read-write-and-runtime-sized-arrays/storage-buffer.render.wgsl?raw";
import { mountClearBufferCounterResetAndAppendPatternsLesson } from "@/lessons/lesson-57-clear-buffer-counter-reset-and-append-patterns/lesson";
import lesson57Source0 from "@/lessons/lesson-57-clear-buffer-counter-reset-and-append-patterns/lesson.ts?raw";
import lesson57Source1 from "@/lessons/lesson-57-clear-buffer-counter-reset-and-append-patterns/clear-buffer.compute.wgsl?raw";
import lesson57Source2 from "@/lessons/lesson-57-clear-buffer-counter-reset-and-append-patterns/clear-buffer.render.wgsl?raw";
import { mountDispatchWorkgroupsInvocationIdsAndComputeLimitsLesson } from "@/lessons/lesson-58-dispatch-workgroups-invocation-ids-and-compute-limits/lesson";
import lesson58Source0 from "@/lessons/lesson-58-dispatch-workgroups-invocation-ids-and-compute-limits/lesson.ts?raw";
import lesson58Source1 from "@/lessons/lesson-58-dispatch-workgroups-invocation-ids-and-compute-limits/dispatch-ids.compute.wgsl?raw";
import lesson58Source2 from "@/lessons/lesson-58-dispatch-workgroups-invocation-ids-and-compute-limits/dispatch-ids.render.wgsl?raw";
import { mountDispatchWorkgroupsIndirectAndGpuWrittenDispatchArgsLesson } from "@/lessons/lesson-59-dispatch-workgroups-indirect-and-gpu-written-dispatch-args/lesson";
import lesson59Source0 from "@/lessons/lesson-59-dispatch-workgroups-indirect-and-gpu-written-dispatch-args/lesson.ts?raw";
import lesson59Source1 from "@/lessons/lesson-59-dispatch-workgroups-indirect-and-gpu-written-dispatch-args/indirect-dispatch.wgsl?raw";
import { mountComputeToRenderSynchronizationBoundariesLesson } from "@/lessons/lesson-60-compute-to-render-synchronization-boundaries/lesson";
import lesson60Source0 from "@/lessons/lesson-60-compute-to-render-synchronization-boundaries/lesson.ts?raw";
import lesson60Source1 from "@/lessons/lesson-60-compute-to-render-synchronization-boundaries/sync-boundary.compute.wgsl?raw";
import lesson60Source2 from "@/lessons/lesson-60-compute-to-render-synchronization-boundaries/sync-boundary.render.wgsl?raw";
import { mountStorageTexturesAndComputeWritebackLesson } from "@/lessons/lesson-61-storage-textures-and-compute-writeback/lesson";
import lesson61Source0 from "@/lessons/lesson-61-storage-textures-and-compute-writeback/lesson.ts?raw";
import lesson61Source1 from "@/lessons/lesson-61-storage-textures-and-compute-writeback/storage-texture.compute.wgsl?raw";
import lesson61Source2 from "@/lessons/lesson-61-storage-textures-and-compute-writeback/storage-texture.render.wgsl?raw";
import { mountStorageTextureFormatsAccessModesAndReadwriteLesson } from "@/lessons/lesson-62-storage-texture-formats-access-modes-and-readwrite/lesson";
import lesson62Source0 from "@/lessons/lesson-62-storage-texture-formats-access-modes-and-readwrite/lesson.ts?raw";
import lesson62Source1 from "@/lessons/lesson-62-storage-texture-formats-access-modes-and-readwrite/storage-access.readwrite.wgsl?raw";
import lesson62Source2 from "@/lessons/lesson-62-storage-texture-formats-access-modes-and-readwrite/storage-access.render.wgsl?raw";
import lesson62Source3 from "@/lessons/lesson-62-storage-texture-formats-access-modes-and-readwrite/storage-access.write.wgsl?raw";
import { mountWorkgroupMemoryAndBarriersLesson } from "@/lessons/lesson-63-workgroup-memory-and-barriers/lesson";
import lesson63Source0 from "@/lessons/lesson-63-workgroup-memory-and-barriers/lesson.ts?raw";
import lesson63Source1 from "@/lessons/lesson-63-workgroup-memory-and-barriers/workgroup-memory.wgsl?raw";
import { mountAtomicsAndParallelReductionLesson } from "@/lessons/lesson-64-atomics-and-parallel-reduction/lesson";
import lesson64Source0 from "@/lessons/lesson-64-atomics-and-parallel-reduction/lesson.ts?raw";
import lesson64Source1 from "@/lessons/lesson-64-atomics-and-parallel-reduction/atomics-reduction.wgsl?raw";
import { mountComputeParticlesLesson } from "@/lessons/lesson-65-compute-particles/lesson";
import lesson65Source0 from "@/lessons/lesson-65-compute-particles/lesson.ts?raw";
import lesson65Source1 from "@/lessons/lesson-65-compute-particles/particle-data.ts?raw";
import lesson65Source2 from "@/lessons/lesson-65-compute-particles/particles.compute.wgsl?raw";
import lesson65Source3 from "@/lessons/lesson-65-compute-particles/particles.frag.wgsl?raw";
import lesson65Source4 from "@/lessons/lesson-65-compute-particles/particles.vert.wgsl?raw";
import { mountPostProcessingLesson } from "@/lessons/lesson-66-post-processing/lesson";
import lesson66Source0 from "@/lessons/lesson-66-post-processing/lesson.ts?raw";
import lesson66Source1 from "@/lessons/lesson-66-post-processing/cube-data.ts?raw";
import lesson66Source2 from "@/lessons/lesson-66-post-processing/math.ts?raw";
import lesson66Source3 from "@/lessons/lesson-66-post-processing/post.frag.wgsl?raw";
import lesson66Source4 from "@/lessons/lesson-66-post-processing/post.vert.wgsl?raw";
import lesson66Source5 from "@/lessons/lesson-66-post-processing/scene.frag.wgsl?raw";
import lesson66Source6 from "@/lessons/lesson-66-post-processing/scene.vert.wgsl?raw";
import { mountPingPongBlurLesson } from "@/lessons/lesson-67-ping-pong-blur/lesson";
import lesson67Source0 from "@/lessons/lesson-67-ping-pong-blur/lesson.ts?raw";
import lesson67Source1 from "@/lessons/lesson-67-ping-pong-blur/blur.frag.wgsl?raw";
import lesson67Source2 from "@/lessons/lesson-67-ping-pong-blur/cube-data.ts?raw";
import lesson67Source3 from "@/lessons/lesson-67-ping-pong-blur/fullscreen.vert.wgsl?raw";
import lesson67Source4 from "@/lessons/lesson-67-ping-pong-blur/math.ts?raw";
import lesson67Source5 from "@/lessons/lesson-67-ping-pong-blur/present.frag.wgsl?raw";
import lesson67Source6 from "@/lessons/lesson-67-ping-pong-blur/scene.frag.wgsl?raw";
import lesson67Source7 from "@/lessons/lesson-67-ping-pong-blur/scene.vert.wgsl?raw";
import { mountColorTargetStateBlendAndWriteMaskLesson } from "@/lessons/lesson-68-color-target-state-blend-and-write-mask/lesson";
import lesson68Source0 from "@/lessons/lesson-68-color-target-state-blend-and-write-mask/lesson.ts?raw";
import lesson68Source1 from "@/lessons/lesson-68-color-target-state-blend-and-write-mask/color-target-state.wgsl?raw";
import { mountAlphaAndBlendingBasicsLesson } from "@/lessons/lesson-69-alpha-and-blending-basics/lesson";
import lesson69Source0 from "@/lessons/lesson-69-alpha-and-blending-basics/lesson.ts?raw";
import lesson69Source1 from "@/lessons/lesson-69-alpha-and-blending-basics/scene.frag.wgsl?raw";
import lesson69Source2 from "@/lessons/lesson-69-alpha-and-blending-basics/scene.vert.wgsl?raw";
import { mountBlendingAndTransparencyLesson } from "@/lessons/lesson-70-blending-and-transparency/lesson";
import lesson70Source0 from "@/lessons/lesson-70-blending-and-transparency/lesson.ts?raw";
import lesson70Source1 from "@/lessons/lesson-70-blending-and-transparency/geometry.ts?raw";
import lesson70Source2 from "@/lessons/lesson-70-blending-and-transparency/math.ts?raw";
import lesson70Source3 from "@/lessons/lesson-70-blending-and-transparency/scene.frag.wgsl?raw";
import lesson70Source4 from "@/lessons/lesson-70-blending-and-transparency/scene.vert.wgsl?raw";
import { mountSamplerAddressingFilteringLodClampAndAnisotropyLesson } from "@/lessons/lesson-71-sampler-addressing-filtering-lod-clamp-and-anisotropy/lesson";
import lesson71Source0 from "@/lessons/lesson-71-sampler-addressing-filtering-lod-clamp-and-anisotropy/lesson.ts?raw";
import lesson71Source1 from "@/lessons/lesson-71-sampler-addressing-filtering-lod-clamp-and-anisotropy/sampler-state.wgsl?raw";
import { mountMipmapAndSamplerParametersLesson } from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/lesson";
import lesson72Source0 from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/lesson.ts?raw";
import lesson72Source1 from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/geometry.ts?raw";
import lesson72Source2 from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/math.ts?raw";
import lesson72Source3 from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/scene.frag.wgsl?raw";
import lesson72Source4 from "@/lessons/lesson-72-mipmaps-and-sampler-parameters/scene.vert.wgsl?raw";
import { mountMultisampledTextureResolveTargetAndSampleCountLesson } from "@/lessons/lesson-73-multisampled-texture-resolve-target-and-sample-count/lesson";
import lesson73Source0 from "@/lessons/lesson-73-multisampled-texture-resolve-target-and-sample-count/lesson.ts?raw";
import lesson73Source1 from "@/lessons/lesson-73-multisampled-texture-resolve-target-and-sample-count/present.wgsl?raw";
import lesson73Source2 from "@/lessons/lesson-73-multisampled-texture-resolve-target-and-sample-count/scene.wgsl?raw";
import { mountMsaaAndAlphaToCoverageLesson } from "@/lessons/lesson-74-msaa-and-alpha-to-coverage/lesson";
import lesson74Source0 from "@/lessons/lesson-74-msaa-and-alpha-to-coverage/lesson.ts?raw";
import lesson74Source1 from "@/lessons/lesson-74-msaa-and-alpha-to-coverage/geometry.ts?raw";
import lesson74Source2 from "@/lessons/lesson-74-msaa-and-alpha-to-coverage/math.ts?raw";
import lesson74Source3 from "@/lessons/lesson-74-msaa-and-alpha-to-coverage/present.frag.wgsl?raw";
import lesson74Source4 from "@/lessons/lesson-74-msaa-and-alpha-to-coverage/present.vert.wgsl?raw";
import lesson74Source5 from "@/lessons/lesson-74-msaa-and-alpha-to-coverage/scene.frag.wgsl?raw";
import lesson74Source6 from "@/lessons/lesson-74-msaa-and-alpha-to-coverage/scene.vert.wgsl?raw";
import { mountTextureArrayLayerViewAndCubeViewLesson } from "@/lessons/lesson-75-texture-array-layer-view-and-cube-view/lesson";
import lesson75Source0 from "@/lessons/lesson-75-texture-array-layer-view-and-cube-view/lesson.ts?raw";
import lesson75Source1 from "@/lessons/lesson-75-texture-array-layer-view-and-cube-view/texture-views.wgsl?raw";
import { mountCubemapAndSkyboxLesson } from "@/lessons/lesson-76-cubemap-and-skybox/lesson";
import lesson76Source0 from "@/lessons/lesson-76-cubemap-and-skybox/lesson.ts?raw";
import lesson76Source1 from "@/lessons/lesson-76-cubemap-and-skybox/geometry.ts?raw";
import lesson76Source2 from "@/lessons/lesson-76-cubemap-and-skybox/math.ts?raw";
import lesson76Source3 from "@/lessons/lesson-76-cubemap-and-skybox/reflective.frag.wgsl?raw";
import lesson76Source4 from "@/lessons/lesson-76-cubemap-and-skybox/reflective.vert.wgsl?raw";
import lesson76Source5 from "@/lessons/lesson-76-cubemap-and-skybox/skybox.frag.wgsl?raw";
import lesson76Source6 from "@/lessons/lesson-76-cubemap-and-skybox/skybox.vert.wgsl?raw";
import { mountGltfBasicLesson } from "@/lessons/lesson-77-gltf-basic/lesson";
import lesson77Source0 from "@/lessons/lesson-77-gltf-basic/lesson.ts?raw";
import lesson77Source1 from "@/lessons/lesson-77-gltf-basic/glb.ts?raw";
import lesson77Source2 from "@/lessons/lesson-77-gltf-basic/math.ts?raw";
import lesson77Source3 from "@/lessons/lesson-77-gltf-basic/model.frag.wgsl?raw";
import lesson77Source4 from "@/lessons/lesson-77-gltf-basic/model.vert.wgsl?raw";
import { mountGltfTexturesLesson } from "@/lessons/lesson-78-gltf-textures/lesson";
import lesson78Source0 from "@/lessons/lesson-78-gltf-textures/lesson.ts?raw";
import lesson78Source1 from "@/lessons/lesson-78-gltf-textures/glb.ts?raw";
import lesson78Source2 from "@/lessons/lesson-78-gltf-textures/math.ts?raw";
import lesson78Source3 from "@/lessons/lesson-78-gltf-textures/model.frag.wgsl?raw";
import lesson78Source4 from "@/lessons/lesson-78-gltf-textures/model.vert.wgsl?raw";
import { mountTextureCompressionAndFormatFeatureGatingLesson } from "@/lessons/lesson-79-texture-compression-and-format-feature-gating/lesson";
import lesson79Source0 from "@/lessons/lesson-79-texture-compression-and-format-feature-gating/lesson.ts?raw";
import lesson79Source1 from "@/lessons/lesson-79-texture-compression-and-format-feature-gating/compressed-format.wgsl?raw";
import { mountGltfSceneIntegrationLesson } from "@/lessons/lesson-80-gltf-scene-integration/lesson";
import lesson80Source0 from "@/lessons/lesson-80-gltf-scene-integration/lesson.ts?raw";
import lesson80Source1 from "@/lessons/lesson-80-gltf-scene-integration/math.ts?raw";
import lesson80Source2 from "@/lessons/lesson-80-gltf-scene-integration/model.frag.wgsl?raw";
import lesson80Source3 from "@/lessons/lesson-80-gltf-scene-integration/model.vert.wgsl?raw";

export const lessons52To80: LessonDefinition[] = [
  {
    id: "52-instancing",
    order: 52,
    title: "实例化与批量绘制",
    tagline: "第 52 课：实例化与批量绘制",
    goal: "学习 实例化与批量绘制：instance buffer / per-instance attribute / batch draw。",
    summary:
      "本课聚焦 实例化与批量绘制 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：instance buffer / per-instance attribute / batch draw。",
    ],
    status: "ready",
    mount: mountInstancingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson52Source0,
        displaySegments: pickLessonSourceSegments(lesson52Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson52Source1,
      },
      {
        id: "cube-frag-wgsl",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: lesson52Source2,
      },
      {
        id: "cube-vert-wgsl",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: lesson52Source3,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson52Source4,
      },
    ],
  },
  {
    id: "53-primitive-topology-cull-mode-and-front-face",
    order: 53,
    title: "Primitive Topology、Cull Mode 与 Front Face",
    tagline: "第 53 课：Primitive Topology、Cull Mode 与 Front Face",
    goal: "学习 Primitive Topology、Cull Mode 与 Front Face：primitive topology / frontFace / cullMode / 正反面可视化。",
    summary:
      "本课聚焦 Primitive Topology、Cull Mode 与 Front Face 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBuffer / queue.writeBuffer 与 @vertex / @fragment / select 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBuffer / queue.writeBuffer。",
      "WGSL / 数据流：@vertex / @fragment / select。",
      "核心知识点：primitive topology / frontFace / cullMode / 正反面可视化。",
    ],
    status: "ready",
    mount: mountPrimitiveTopologyCullModeAndFrontFaceLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson53Source0,
        displaySegments: pickLessonSourceSegments(lesson53Source0),
        featured: true,
      },
      {
        id: "primitive-state-wgsl",
        filename: "primitive-state.wgsl",
        language: "wgsl",
        content: lesson53Source1,
      },
    ],
  },
  {
    id: "54-draw-parameters-base-vertex-first-instance-and-indirect-buffer",
    order: 54,
    title: "Draw 参数、Base Vertex、First Instance 与 Indirect Buffer",
    tagline: "第 54 课：Draw 参数、Base Vertex、First Instance 与 Indirect Buffer",
    goal: "学习 Draw 参数、Base Vertex、First Instance 与 Indirect Buffer：firstVertex / firstInstance / baseVertex / indirect args buffer。",
    summary:
      "本课聚焦 Draw 参数、Base Vertex、First Instance 与 Indirect Buffer 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：firstVertex / firstInstance / baseVertex / indirect args buffer。",
    ],
    status: "ready",
    mount: mountDrawParametersBaseVertexFirstInstanceAndIndirectBufferLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson54Source0,
        displaySegments: pickLessonSourceSegments(lesson54Source0),
        featured: true,
      },
      {
        id: "draw-parameters-wgsl",
        filename: "draw-parameters.wgsl",
        language: "wgsl",
        content: lesson54Source1,
      },
    ],
  },
  {
    id: "55-compute-foundations",
    order: 55,
    title: "Compute 基础与 Storage Buffer",
    tagline: "第 55 课：Compute 基础与 Storage Buffer",
    goal: "学习 Compute 基础与 Storage Buffer：compute pipeline / storage buffer / dispatchWorkgroups。",
    summary:
      "本课聚焦 Compute 基础与 Storage Buffer 的核心链路，重点观察 requestAdapter / requestDevice / getContext(\"webgpu\") / createShaderModule 与 @compute / @workgroup_size / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getContext(\"webgpu\") / createShaderModule。",
      "WGSL / 数据流：@compute / @workgroup_size / @group / @binding。",
      "核心知识点：compute pipeline / storage buffer / dispatchWorkgroups。",
    ],
    status: "ready",
    mount: mountComputeFoundationsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson55Source0,
        displaySegments: pickLessonSourceSegments(lesson55Source0),
        featured: true,
      },
      {
        id: "compute-wgsl",
        filename: "compute.wgsl",
        language: "wgsl",
        content: lesson55Source1,
      },
      {
        id: "seed-ts",
        filename: "seed.ts",
        language: "ts",
        content: lesson55Source2,
      },
    ],
  },
  {
    id: "56-storage-buffer-read-write-and-runtime-sized-arrays",
    order: 56,
    title: "Storage Buffer 读写与 Runtime-sized Array",
    tagline: "第 56 课：Storage Buffer 读写与 Runtime-sized Array",
    goal: "学习 Storage Buffer 读写与 Runtime-sized Array：compute pipeline / storage buffer / dispatchWorkgroups。",
    summary:
      "本课聚焦 Storage Buffer 读写与 Runtime-sized Array 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：compute pipeline / storage buffer / dispatchWorkgroups。",
    ],
    status: "ready",
    mount: mountStorageBufferReadWriteAndRuntimeSizedArraysLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson56Source0,
        displaySegments: pickLessonSourceSegments(lesson56Source0),
        featured: true,
      },
      {
        id: "storage-buffer-compute-wgsl",
        filename: "storage-buffer.compute.wgsl",
        language: "wgsl",
        content: lesson56Source1,
      },
      {
        id: "storage-buffer-render-wgsl",
        filename: "storage-buffer.render.wgsl",
        language: "wgsl",
        content: lesson56Source2,
      },
    ],
  },
  {
    id: "57-clear-buffer-counter-reset-and-append-patterns",
    order: 57,
    title: "clearBuffer、Counter Reset 与 Append Patterns",
    tagline: "第 57 课：clearBuffer、Counter Reset 与 Append Patterns",
    goal: "学习 clearBuffer、Counter Reset 与 Append Patterns：clearBuffer / append counter reset / storage buffer readback。",
    summary:
      "本课聚焦 clearBuffer、Counter Reset 与 Append Patterns 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：clearBuffer / append counter reset / storage buffer readback。",
    ],
    status: "ready",
    mount: mountClearBufferCounterResetAndAppendPatternsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson57Source0,
        displaySegments: pickLessonSourceSegments(lesson57Source0),
        featured: true,
      },
      {
        id: "clear-buffer-compute-wgsl",
        filename: "clear-buffer.compute.wgsl",
        language: "wgsl",
        content: lesson57Source1,
      },
      {
        id: "clear-buffer-render-wgsl",
        filename: "clear-buffer.render.wgsl",
        language: "wgsl",
        content: lesson57Source2,
      },
    ],
  },
  {
    id: "58-dispatch-workgroups-invocation-ids-and-compute-limits",
    order: 58,
    title: "dispatchWorkgroups、Invocation IDs 与 Compute Limits",
    tagline: "第 58 课：dispatchWorkgroups、Invocation IDs 与 Compute Limits",
    goal: "学习 dispatchWorkgroups、Invocation IDs 与 Compute Limits：workgroup size / invocation id / compute limits。",
    summary:
      "本课聚焦 dispatchWorkgroups、Invocation IDs 与 Compute Limits 的核心链路，重点观察 dispatch grid、global/local invocation id 与设备 compute limits 如何决定实际执行范围。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：dispatchWorkgroups / invocation id / maxComputeWorkgroupSizeX。",
    ],
    status: "ready",
    mount: mountDispatchWorkgroupsInvocationIdsAndComputeLimitsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson58Source0,
        displaySegments: pickLessonSourceSegments(lesson58Source0),
        featured: true,
      },
      {
        id: "dispatch-ids-compute-wgsl",
        filename: "dispatch-ids.compute.wgsl",
        language: "wgsl",
        content: lesson58Source1,
      },
      {
        id: "dispatch-ids-render-wgsl",
        filename: "dispatch-ids.render.wgsl",
        language: "wgsl",
        content: lesson58Source2,
      },
    ],
  },
  {
    id: "59-dispatch-workgroups-indirect-and-gpu-written-dispatch-args",
    order: 59,
    title: "dispatchWorkgroupsIndirect 与 GPU 写入 Dispatch Args",
    tagline: "第 59 课：dispatchWorkgroupsIndirect 与 GPU 写入 Dispatch Args",
    goal: "学习 dispatchWorkgroupsIndirect 与 GPU 写入 Dispatch Args：GPU-written dispatch args / dispatchWorkgroupsIndirect / indirect compute scheduling。",
    summary:
      "本课聚焦 dispatchWorkgroupsIndirect 与 GPU 写入 Dispatch Args 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：GPU-written dispatch args / dispatchWorkgroupsIndirect / indirect compute scheduling。",
    ],
    status: "ready",
    mount: mountDispatchWorkgroupsIndirectAndGpuWrittenDispatchArgsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson59Source0,
        displaySegments: pickLessonSourceSegments(lesson59Source0),
        featured: true,
      },
      {
        id: "indirect-dispatch-wgsl",
        filename: "indirect-dispatch.wgsl",
        language: "wgsl",
        content: lesson59Source1,
      },
    ],
  },
  {
    id: "60-compute-to-render-synchronization-boundaries",
    order: 60,
    title: "Compute-to-Render 同步边界",
    tagline: "第 60 课：Compute-to-Render 同步边界",
    goal: "学习 Compute-to-Render 同步边界：pass boundary sync / compute writes render reads / submit boundary readback。",
    summary:
      "本课聚焦 Compute-to-Render 同步边界 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：pass boundary sync / compute writes render reads / submit boundary readback。",
    ],
    status: "ready",
    mount: mountComputeToRenderSynchronizationBoundariesLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson60Source0,
        displaySegments: pickLessonSourceSegments(lesson60Source0),
        featured: true,
      },
      {
        id: "sync-boundary-compute-wgsl",
        filename: "sync-boundary.compute.wgsl",
        language: "wgsl",
        content: lesson60Source1,
      },
      {
        id: "sync-boundary-render-wgsl",
        filename: "sync-boundary.render.wgsl",
        language: "wgsl",
        content: lesson60Source2,
      },
    ],
  },
  {
    id: "61-storage-textures-and-compute-writeback",
    order: 61,
    title: "Storage Texture 与 Compute 写纹理",
    tagline: "第 61 课：Storage Texture 与 Compute 写纹理",
    goal: "学习 Storage Texture 与 Compute 写纹理：texture format / usage / texture view / sampler / WGSL texture sampling / storage texture access mode。",
    summary:
      "本课聚焦 Storage Texture 与 Compute 写纹理 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / storage texture access mode。",
    ],
    status: "ready",
    mount: mountStorageTexturesAndComputeWritebackLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson61Source0,
        displaySegments: pickLessonSourceSegments(lesson61Source0),
        featured: true,
      },
      {
        id: "storage-texture-compute-wgsl",
        filename: "storage-texture.compute.wgsl",
        language: "wgsl",
        content: lesson61Source1,
      },
      {
        id: "storage-texture-render-wgsl",
        filename: "storage-texture.render.wgsl",
        language: "wgsl",
        content: lesson61Source2,
      },
    ],
  },
  {
    id: "62-storage-texture-formats-access-modes-and-readwrite",
    order: 62,
    title: "Storage Texture Format、Access Mode 与 Read/Write",
    tagline: "第 62 课：Storage Texture Format、Access Mode 与 Read/Write",
    goal: "学习 Storage Texture Format、Access Mode 与 Read/Write：texture format / usage / texture view / sampler / WGSL texture sampling / storage texture access mode。",
    summary:
      "本课聚焦 Storage Texture Format、Access Mode 与 Read/Write 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / storage texture access mode。",
    ],
    status: "ready",
    mount: mountStorageTextureFormatsAccessModesAndReadwriteLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson62Source0,
        displaySegments: pickLessonSourceSegments(lesson62Source0),
        featured: true,
      },
      {
        id: "storage-access-readwrite-wgsl",
        filename: "storage-access.readwrite.wgsl",
        language: "wgsl",
        content: lesson62Source1,
      },
      {
        id: "storage-access-render-wgsl",
        filename: "storage-access.render.wgsl",
        language: "wgsl",
        content: lesson62Source2,
      },
      {
        id: "storage-access-write-wgsl",
        filename: "storage-access.write.wgsl",
        language: "wgsl",
        content: lesson62Source3,
      },
    ],
  },
  {
    id: "63-workgroup-memory-and-barriers",
    order: 63,
    title: "Workgroup Memory 与 Barrier",
    tagline: "第 63 课：Workgroup Memory 与 Barrier",
    goal: "学习 Workgroup Memory 与 Barrier：var<workgroup> / workgroupBarrier / tile memory reuse。",
    summary:
      "本课聚焦 Workgroup Memory 与 Barrier 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：var<workgroup> / workgroupBarrier / tile memory reuse。",
    ],
    status: "ready",
    mount: mountWorkgroupMemoryAndBarriersLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson63Source0,
        displaySegments: pickLessonSourceSegments(lesson63Source0),
        featured: true,
      },
      {
        id: "workgroup-memory-wgsl",
        filename: "workgroup-memory.wgsl",
        language: "wgsl",
        content: lesson63Source1,
      },
    ],
  },
  {
    id: "64-atomics-and-parallel-reduction",
    order: 64,
    title: "Atomics 与 Parallel Reduction",
    tagline: "第 64 课：Atomics 与 Parallel Reduction",
    goal: "学习 Atomics 与 Parallel Reduction：atomicAdd / atomicMax / parallel reduction / histogram / counter。",
    summary:
      "本课聚焦 Atomics 与 Parallel Reduction 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：atomicAdd / atomicMax / parallel reduction / histogram / counter。",
    ],
    status: "ready",
    mount: mountAtomicsAndParallelReductionLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson64Source0,
        displaySegments: pickLessonSourceSegments(lesson64Source0),
        featured: true,
      },
      {
        id: "atomics-reduction-wgsl",
        filename: "atomics-reduction.wgsl",
        language: "wgsl",
        content: lesson64Source1,
      },
    ],
  },
  {
    id: "65-compute-particles",
    order: 65,
    title: "Compute 粒子与 Render Interop",
    tagline: "第 65 课：Compute 粒子与 Render Interop",
    goal: "学习 Compute 粒子与 Render Interop：compute simulation / storage buffer interop / render pass 读取粒子。",
    summary:
      "本课聚焦 Compute 粒子与 Render Interop 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：compute simulation / storage buffer interop / render pass 读取粒子。",
    ],
    status: "ready",
    mount: mountComputeParticlesLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson65Source0,
        displaySegments: pickLessonSourceSegments(lesson65Source0),
        featured: true,
      },
      {
        id: "particle-data-ts",
        filename: "particle-data.ts",
        language: "ts",
        content: lesson65Source1,
      },
      {
        id: "particles-compute-wgsl",
        filename: "particles.compute.wgsl",
        language: "wgsl",
        content: lesson65Source2,
      },
      {
        id: "particles-frag-wgsl",
        filename: "particles.frag.wgsl",
        language: "wgsl",
        content: lesson65Source3,
      },
      {
        id: "particles-vert-wgsl",
        filename: "particles.vert.wgsl",
        language: "wgsl",
        content: lesson65Source4,
      },
    ],
  },
  {
    id: "66-post-processing",
    order: 66,
    title: "后处理与全屏 Pass",
    tagline: "第 66 课：后处理与全屏 Pass",
    goal: "学习 后处理与全屏 Pass：offscreen render target / fullscreen pass / post-process sampling。",
    summary:
      "本课聚焦 后处理与全屏 Pass 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：offscreen render target / fullscreen pass / post-process sampling。",
    ],
    status: "ready",
    mount: mountPostProcessingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson66Source0,
        displaySegments: pickLessonSourceSegments(lesson66Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson66Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson66Source2,
      },
      {
        id: "post-frag-wgsl",
        filename: "post.frag.wgsl",
        language: "wgsl",
        content: lesson66Source3,
      },
      {
        id: "post-vert-wgsl",
        filename: "post.vert.wgsl",
        language: "wgsl",
        content: lesson66Source4,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson66Source5,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson66Source6,
      },
    ],
  },
  {
    id: "67-ping-pong-blur",
    order: 67,
    title: "多 Pass Blur",
    tagline: "第 67 课：多 Pass Blur",
    goal: "学习 多 Pass Blur：offscreen render target / fullscreen pass / post-process sampling。",
    summary:
      "本课聚焦 多 Pass Blur 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：offscreen render target / fullscreen pass / post-process sampling。",
    ],
    status: "ready",
    mount: mountPingPongBlurLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson67Source0,
        displaySegments: pickLessonSourceSegments(lesson67Source0),
        featured: true,
      },
      {
        id: "blur-frag-wgsl",
        filename: "blur.frag.wgsl",
        language: "wgsl",
        content: lesson67Source1,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson67Source2,
      },
      {
        id: "fullscreen-vert-wgsl",
        filename: "fullscreen.vert.wgsl",
        language: "wgsl",
        content: lesson67Source3,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson67Source4,
      },
      {
        id: "present-frag-wgsl",
        filename: "present.frag.wgsl",
        language: "wgsl",
        content: lesson67Source5,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson67Source6,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson67Source7,
      },
    ],
  },
  {
    id: "68-color-target-state-blend-and-write-mask",
    order: 68,
    title: "Color Target State、Blend 与 Write Mask",
    tagline: "第 68 课：Color Target State、Blend 与 Write Mask",
    goal: "学习 Color Target State、Blend 与 Write Mask：color target blend state / alpha compositing / 透明排序。",
    summary:
      "本课聚焦 Color Target State、Blend 与 Write Mask 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：color target blend state / alpha compositing / 透明排序。",
    ],
    status: "ready",
    mount: mountColorTargetStateBlendAndWriteMaskLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson68Source0,
        displaySegments: pickLessonSourceSegments(lesson68Source0),
        featured: true,
      },
      {
        id: "color-target-state-wgsl",
        filename: "color-target-state.wgsl",
        language: "wgsl",
        content: lesson68Source1,
      },
    ],
  },
  {
    id: "69-alpha-and-blending-basics",
    order: 69,
    title: "颜色混合与 Alpha 表示",
    tagline: "第 69 课：颜色混合与 Alpha 表示",
    goal: "学习 颜色混合与 Alpha 表示：color target blend state / alpha compositing / 透明排序。",
    summary:
      "本课聚焦 颜色混合与 Alpha 表示 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：color target blend state / alpha compositing / 透明排序。",
    ],
    status: "ready",
    mount: mountAlphaAndBlendingBasicsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson69Source0,
        displaySegments: pickLessonSourceSegments(lesson69Source0),
        featured: true,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson69Source1,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson69Source2,
      },
    ],
  },
  {
    id: "70-blending-and-transparency",
    order: 70,
    title: "透明排序与透明画布",
    tagline: "第 70 课：透明排序与透明画布",
    goal: "学习 透明排序与透明画布：color target blend state / alpha compositing / 透明排序。",
    summary:
      "本课聚焦 透明排序与透明画布 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：color target blend state / alpha compositing / 透明排序。",
    ],
    status: "ready",
    mount: mountBlendingAndTransparencyLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson70Source0,
        displaySegments: pickLessonSourceSegments(lesson70Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson70Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson70Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson70Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson70Source4,
      },
    ],
  },
  {
    id: "71-sampler-addressing-filtering-lod-clamp-and-anisotropy",
    order: 71,
    title: "Sampler Addressing、Filtering、LOD Clamp 与 Anisotropy",
    tagline: "第 71 课：Sampler Addressing、Filtering、LOD Clamp 与 Anisotropy",
    goal: "学习 Sampler Addressing、Filtering、LOD Clamp 与 Anisotropy：texture format / usage / texture view / sampler / WGSL texture sampling。",
    summary:
      "本课聚焦 Sampler Addressing、Filtering、LOD Clamp 与 Anisotropy 的核心链路，重点观察 pushErrorScope / popErrorScope / createShaderModule / createRenderPipeline 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：pushErrorScope / popErrorScope / createShaderModule / createRenderPipeline。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling。",
    ],
    status: "ready",
    mount: mountSamplerAddressingFilteringLodClampAndAnisotropyLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson71Source0,
        displaySegments: pickLessonSourceSegments(lesson71Source0),
        featured: true,
      },
      {
        id: "sampler-state-wgsl",
        filename: "sampler-state.wgsl",
        language: "wgsl",
        content: lesson71Source1,
      },
    ],
  },
  {
    id: "72-mipmaps-and-sampler-parameters",
    order: 72,
    title: "Mipmap 与采样参数",
    tagline: "第 72 课：Mipmap 与采样参数",
    goal: "学习 Mipmap 与采样参数：texture format / usage / texture view / sampler / WGSL texture sampling。",
    summary:
      "本课聚焦 Mipmap 与采样参数 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling。",
    ],
    status: "ready",
    mount: mountMipmapAndSamplerParametersLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson72Source0,
        displaySegments: pickLessonSourceSegments(lesson72Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson72Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson72Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson72Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson72Source4,
      },
    ],
  },
  {
    id: "73-multisampled-texture-resolve-target-and-sample-count",
    order: 73,
    title: "Multisampled Texture、Resolve Target 与 Sample Count",
    tagline: "第 73 课：Multisampled Texture、Resolve Target 与 Sample Count",
    goal: "学习 Multisampled Texture、Resolve Target 与 Sample Count：texture format / usage / texture view / sampler / WGSL texture sampling / sampleCount 一致性。",
    summary:
      "本课聚焦 Multisampled Texture、Resolve Target 与 Sample Count 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / sampleCount 一致性。",
    ],
    status: "ready",
    mount: mountMultisampledTextureResolveTargetAndSampleCountLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson73Source0,
        displaySegments: pickLessonSourceSegments(lesson73Source0),
        featured: true,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson73Source1,
      },
      {
        id: "scene-wgsl",
        filename: "scene.wgsl",
        language: "wgsl",
        content: lesson73Source2,
      },
    ],
  },
  {
    id: "74-msaa-and-alpha-to-coverage",
    order: 74,
    title: "MSAA 与 Alpha-to-Coverage",
    tagline: "第 74 课：MSAA 与 Alpha-to-Coverage",
    goal: "学习 MSAA 与 Alpha-to-Coverage：color target blend state / alpha compositing / 透明排序 / sampleCount 一致性。",
    summary:
      "本课聚焦 MSAA 与 Alpha-to-Coverage 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：color target blend state / alpha compositing / 透明排序 / sampleCount 一致性。",
    ],
    status: "ready",
    mount: mountMsaaAndAlphaToCoverageLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson74Source0,
        displaySegments: pickLessonSourceSegments(lesson74Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson74Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson74Source2,
      },
      {
        id: "present-frag-wgsl",
        filename: "present.frag.wgsl",
        language: "wgsl",
        content: lesson74Source3,
      },
      {
        id: "present-vert-wgsl",
        filename: "present.vert.wgsl",
        language: "wgsl",
        content: lesson74Source4,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson74Source5,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson74Source6,
      },
    ],
  },
  {
    id: "75-texture-array-layer-view-and-cube-view",
    order: 75,
    title: "Texture Array、Array Layer View 与 Cube View",
    tagline: "第 75 课：Texture Array、Array Layer View 与 Cube View",
    goal: "学习 Texture Array、Array Layer View 与 Cube View：texture format / usage / texture view / sampler / WGSL texture sampling。",
    summary:
      "本课聚焦 Texture Array、Array Layer View 与 Cube View 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling。",
    ],
    status: "ready",
    mount: mountTextureArrayLayerViewAndCubeViewLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson75Source0,
        displaySegments: pickLessonSourceSegments(lesson75Source0),
        featured: true,
      },
      {
        id: "texture-views-wgsl",
        filename: "texture-views.wgsl",
        language: "wgsl",
        content: lesson75Source1,
      },
    ],
  },
  {
    id: "76-cubemap-and-skybox",
    order: 76,
    title: "Cubemap 与天空盒",
    tagline: "第 76 课：Cubemap 与天空盒",
    goal: "学习 Cubemap 与天空盒：texture format / usage / texture view / sampler / WGSL texture sampling。",
    summary:
      "本课聚焦 Cubemap 与天空盒 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling。",
    ],
    status: "ready",
    mount: mountCubemapAndSkyboxLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson76Source0,
        displaySegments: pickLessonSourceSegments(lesson76Source0),
        featured: true,
      },
      {
        id: "geometry-ts",
        filename: "geometry.ts",
        language: "ts",
        content: lesson76Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson76Source2,
      },
      {
        id: "reflective-frag-wgsl",
        filename: "reflective.frag.wgsl",
        language: "wgsl",
        content: lesson76Source3,
      },
      {
        id: "reflective-vert-wgsl",
        filename: "reflective.vert.wgsl",
        language: "wgsl",
        content: lesson76Source4,
      },
      {
        id: "skybox-frag-wgsl",
        filename: "skybox.frag.wgsl",
        language: "wgsl",
        content: lesson76Source5,
      },
      {
        id: "skybox-vert-wgsl",
        filename: "skybox.vert.wgsl",
        language: "wgsl",
        content: lesson76Source6,
      },
    ],
  },
  {
    id: "77-gltf-basic",
    order: 77,
    title: "glTF 基础加载",
    tagline: "第 77 课：glTF 基础加载",
    goal: "学习 glTF 基础加载：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding。",
    summary:
      "本课聚焦 glTF 基础加载 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding。",
    ],
    status: "ready",
    mount: mountGltfBasicLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson77Source0,
        displaySegments: pickLessonSourceSegments(lesson77Source0),
        featured: true,
      },
      {
        id: "glb-ts",
        filename: "glb.ts",
        language: "ts",
        content: lesson77Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson77Source2,
      },
      {
        id: "model-frag-wgsl",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: lesson77Source3,
      },
      {
        id: "model-vert-wgsl",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: lesson77Source4,
      },
    ],
  },
  {
    id: "78-gltf-textures",
    order: 78,
    title: "glTF 材质与贴图",
    tagline: "第 78 课：glTF 材质与贴图",
    goal: "学习 glTF 材质与贴图：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照 / texture format / usage。",
    summary:
      "本课聚焦 glTF 材质与贴图 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照 / texture format / usage。",
    ],
    status: "ready",
    mount: mountGltfTexturesLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson78Source0,
        displaySegments: pickLessonSourceSegments(lesson78Source0),
        featured: true,
      },
      {
        id: "glb-ts",
        filename: "glb.ts",
        language: "ts",
        content: lesson78Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson78Source2,
      },
      {
        id: "model-frag-wgsl",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: lesson78Source3,
      },
      {
        id: "model-vert-wgsl",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: lesson78Source4,
      },
    ],
  },
  {
    id: "79-texture-compression-and-format-feature-gating",
    order: 79,
    title: "Texture Compression 与 Format Feature Gating",
    tagline: "第 79 课：Texture Compression 与 Format Feature Gating",
    goal: "学习 Texture Compression 与 Format Feature Gating：texture format / usage / texture view / sampler / WGSL texture sampling。",
    summary:
      "本课聚焦 Texture Compression 与 Format Feature Gating 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling。",
    ],
    status: "ready",
    mount: mountTextureCompressionAndFormatFeatureGatingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson79Source0,
        displaySegments: pickLessonSourceSegments(lesson79Source0),
        featured: true,
      },
      {
        id: "compressed-format-wgsl",
        filename: "compressed-format.wgsl",
        language: "wgsl",
        content: lesson79Source1,
      },
    ],
  },
  {
    id: "80-gltf-scene-integration",
    order: 80,
    title: "glTF 场景整合",
    tagline: "第 80 课：glTF 场景整合",
    goal: "学习 glTF 场景整合：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding。",
    summary:
      "本课聚焦 glTF 场景整合 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：glTF buffer/accessor 解析 / 材质 / 节点数据 / WebGPU vertex binding。",
    ],
    status: "ready",
    mount: mountGltfSceneIntegrationLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson80Source0,
        displaySegments: pickLessonSourceSegments(lesson80Source0),
        featured: true,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson80Source1,
      },
      {
        id: "model-frag-wgsl",
        filename: "model.frag.wgsl",
        language: "wgsl",
        content: lesson80Source2,
      },
      {
        id: "model-vert-wgsl",
        filename: "model.vert.wgsl",
        language: "wgsl",
        content: lesson80Source3,
      },
    ],
  },
];
