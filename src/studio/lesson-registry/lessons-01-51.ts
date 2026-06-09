import type { LessonDefinition } from "@/studio/types";
import { pickLessonSourceSegments } from "@/studio/lesson-segments";
import { mountTriangleLesson } from "@/lessons/lesson-01-triangle/lesson";
import lesson1Source0 from "@/lessons/lesson-01-triangle/lesson.ts?raw";
import lesson1Source1 from "@/lessons/lesson-01-triangle/triangle.wgsl?raw";
import { mountAdapterDeviceFeaturesAndLimitsLesson } from "@/lessons/lesson-02-adapter-device-features-and-limits/lesson";
import lesson2Source0 from "@/lessons/lesson-02-adapter-device-features-and-limits/lesson.ts?raw";
import lesson2Source1 from "@/lessons/lesson-02-adapter-device-features-and-limits/device-bars.wgsl?raw";
import { mountCanvasContextConfigureAndAlphaModeLesson } from "@/lessons/lesson-03-canvas-context-configure-and-alpha-mode/lesson";
import lesson3Source0 from "@/lessons/lesson-03-canvas-context-configure-and-alpha-mode/lesson.ts?raw";
import lesson3Source1 from "@/lessons/lesson-03-canvas-context-configure-and-alpha-mode/canvas-config.wgsl?raw";
import { mountErrorScopesValidationAndDeviceLostLesson } from "@/lessons/lesson-04-error-scopes-validation-and-device-lost/lesson";
import lesson4Source0 from "@/lessons/lesson-04-error-scopes-validation-and-device-lost/lesson.ts?raw";
import lesson4Source1 from "@/lessons/lesson-04-error-scopes-validation-and-device-lost/safe-triangle.wgsl?raw";
import { mountLabelsDebugGroupsAndErrorDiagnosticsLesson } from "@/lessons/lesson-05-labels-debug-groups-and-error-diagnostics/lesson";
import lesson5Source0 from "@/lessons/lesson-05-labels-debug-groups-and-error-diagnostics/lesson.ts?raw";
import lesson5Source1 from "@/lessons/lesson-05-labels-debug-groups-and-error-diagnostics/debug-groups.wgsl?raw";
import { mountShaderCompilationInfoAndWgslDiagnosticsLesson } from "@/lessons/lesson-06-shader-compilation-info-and-wgsl-diagnostics/lesson";
import lesson6Source0 from "@/lessons/lesson-06-shader-compilation-info-and-wgsl-diagnostics/lesson.ts?raw";
import lesson6Source1 from "@/lessons/lesson-06-shader-compilation-info-and-wgsl-diagnostics/diagnostics.invalid.wgsl?raw";
import lesson6Source2 from "@/lessons/lesson-06-shader-compilation-info-and-wgsl-diagnostics/diagnostics.valid.wgsl?raw";
import { mountVertexBufferLesson } from "@/lessons/lesson-07-vertex-buffers/lesson";
import lesson7Source0 from "@/lessons/lesson-07-vertex-buffers/lesson.ts?raw";
import lesson7Source1 from "@/lessons/lesson-07-vertex-buffers/triangle.wgsl?raw";
import { mountBufferUsageMappingAndCopyLesson } from "@/lessons/lesson-08-buffer-usage-mapping-and-copy/lesson";
import lesson8Source0 from "@/lessons/lesson-08-buffer-usage-mapping-and-copy/lesson.ts?raw";
import lesson8Source1 from "@/lessons/lesson-08-buffer-usage-mapping-and-copy/buffer-bars.wgsl?raw";
import { mountIndexBufferDrawIndexedAndIndexFormatLesson } from "@/lessons/lesson-09-index-buffer-drawindexed-and-index-format/lesson";
import lesson9Source0 from "@/lessons/lesson-09-index-buffer-drawindexed-and-index-format/lesson.ts?raw";
import lesson9Source1 from "@/lessons/lesson-09-index-buffer-drawindexed-and-index-format/index-buffer.wgsl?raw";
import { mountVertexBufferLayoutAttributesAndStepModeLesson } from "@/lessons/lesson-10-vertex-buffer-layout-attributes-and-step-mode/lesson";
import lesson10Source0 from "@/lessons/lesson-10-vertex-buffer-layout-attributes-and-step-mode/lesson.ts?raw";
import lesson10Source1 from "@/lessons/lesson-10-vertex-buffer-layout-attributes-and-step-mode/vertex-layout.wgsl?raw";
import { mountPackedVertexFormatsNormalizedAttributesAndStrideLesson } from "@/lessons/lesson-11-packed-vertex-formats-normalized-attributes-and-stride/lesson";
import lesson11Source0 from "@/lessons/lesson-11-packed-vertex-formats-normalized-attributes-and-stride/lesson.ts?raw";
import lesson11Source1 from "@/lessons/lesson-11-packed-vertex-formats-normalized-attributes-and-stride/packed-vertex.wgsl?raw";
import { mountUniformLesson } from "@/lessons/lesson-12-uniforms/lesson";
import lesson12Source0 from "@/lessons/lesson-12-uniforms/lesson.ts?raw";
import lesson12Source1 from "@/lessons/lesson-12-uniforms/triangle.wgsl?raw";
import { mountCubeDepthLesson } from "@/lessons/lesson-13-cube-depth/lesson";
import lesson13Source0 from "@/lessons/lesson-13-cube-depth/lesson.ts?raw";
import lesson13Source1 from "@/lessons/lesson-13-cube-depth/cube-data.ts?raw";
import lesson13Source2 from "@/lessons/lesson-13-cube-depth/cube.wgsl?raw";
import lesson13Source3 from "@/lessons/lesson-13-cube-depth/math.ts?raw";
import { mountTextureLesson } from "@/lessons/lesson-14-textures/lesson";
import lesson14Source0 from "@/lessons/lesson-14-textures/lesson.ts?raw";
import lesson14Source1 from "@/lessons/lesson-14-textures/texture.wgsl?raw";
import { mountTextureFormatsViewsAndCopyLesson } from "@/lessons/lesson-15-texture-formats-views-and-copy/lesson";
import lesson15Source0 from "@/lessons/lesson-15-texture-formats-views-and-copy/lesson.ts?raw";
import lesson15Source1 from "@/lessons/lesson-15-texture-formats-views-and-copy/texture-panels.wgsl?raw";
import { mountExternalImageVideoTextureAndCopyLesson } from "@/lessons/lesson-16-external-image-video-texture-and-copy/lesson";
import lesson16Source0 from "@/lessons/lesson-16-external-image-video-texture-and-copy/lesson.ts?raw";
import lesson16Source1 from "@/lessons/lesson-16-external-image-video-texture-and-copy/external-copy-fallback.wgsl?raw";
import lesson16Source2 from "@/lessons/lesson-16-external-image-video-texture-and-copy/external-copy.wgsl?raw";
import { mountTextureCopyLayoutBytesPerRowAndRowsPerImageLesson } from "@/lessons/lesson-17-texture-copy-layout-bytes-per-row-and-rows-per-image/lesson";
import lesson17Source0 from "@/lessons/lesson-17-texture-copy-layout-bytes-per-row-and-rows-per-image/lesson.ts?raw";
import lesson17Source1 from "@/lessons/lesson-17-texture-copy-layout-bytes-per-row-and-rows-per-image/texture-copy-layout.wgsl?raw";
import { mountTextureToTextureBufferCopyAndReadbackLesson } from "@/lessons/lesson-18-texture-to-texture-buffer-copy-and-readback/lesson";
import lesson18Source0 from "@/lessons/lesson-18-texture-to-texture-buffer-copy-and-readback/lesson.ts?raw";
import lesson18Source1 from "@/lessons/lesson-18-texture-to-texture-buffer-copy-and-readback/texture-copy-readback.wgsl?raw";
import { mountTextureViewAspectAndDepthStencilViewsLesson } from "@/lessons/lesson-19-texture-view-aspect-and-depth-stencil-views/lesson";
import lesson19Source0 from "@/lessons/lesson-19-texture-view-aspect-and-depth-stencil-views/lesson.ts?raw";
import lesson19Source1 from "@/lessons/lesson-19-texture-view-aspect-and-depth-stencil-views/aspect-views.wgsl?raw";
import { mountTextureViewMipLevelArrayLayerRangeLesson } from "@/lessons/lesson-20-texture-view-mip-level-array-layer-range/lesson";
import lesson20Source0 from "@/lessons/lesson-20-texture-view-mip-level-array-layer-range/lesson.ts?raw";
import lesson20Source1 from "@/lessons/lesson-20-texture-view-mip-level-array-layer-range/texture-view-range.wgsl?raw";
import { mountTextureViewDimensionAndSampleTypeCompatibilityLesson } from "@/lessons/lesson-21-texture-view-dimension-and-sample-type-compatibility/lesson";
import lesson21Source0 from "@/lessons/lesson-21-texture-view-dimension-and-sample-type-compatibility/lesson.ts?raw";
import lesson21Source1 from "@/lessons/lesson-21-texture-view-dimension-and-sample-type-compatibility/sample-type-compatibility.wgsl?raw";
import { mountTexturedCubeLesson } from "@/lessons/lesson-22-textured-cube/lesson";
import lesson22Source0 from "@/lessons/lesson-22-textured-cube/lesson.ts?raw";
import lesson22Source1 from "@/lessons/lesson-22-textured-cube/cube-data.ts?raw";
import lesson22Source2 from "@/lessons/lesson-22-textured-cube/cube.frag.wgsl?raw";
import lesson22Source3 from "@/lessons/lesson-22-textured-cube/cube.vert.wgsl?raw";
import { mountBindGroupLayoutsAndPipelineLayoutsLesson } from "@/lessons/lesson-23-bind-group-layouts-and-pipeline-layouts/lesson";
import lesson23Source0 from "@/lessons/lesson-23-bind-group-layouts-and-pipeline-layouts/lesson.ts?raw";
import lesson23Source1 from "@/lessons/lesson-23-bind-group-layouts-and-pipeline-layouts/layouts.wgsl?raw";
import { mountBindGroupEntryTypesMinBindingSizeAndCompatibilityLesson } from "@/lessons/lesson-24-bind-group-entry-types-minbindingsize-and-compatibility/lesson";
import lesson24Source0 from "@/lessons/lesson-24-bind-group-entry-types-minbindingsize-and-compatibility/lesson.ts?raw";
import lesson24Source1 from "@/lessons/lesson-24-bind-group-entry-types-minbindingsize-and-compatibility/bind-compatibility.wgsl?raw";
import { mountBindGroupReuseResourceLifetimeAndRebindingLesson } from "@/lessons/lesson-25-bind-group-reuse-resource-lifetime-and-rebinding/lesson";
import lesson25Source0 from "@/lessons/lesson-25-bind-group-reuse-resource-lifetime-and-rebinding/lesson.ts?raw";
import lesson25Source1 from "@/lessons/lesson-25-bind-group-reuse-resource-lifetime-and-rebinding/bind-reuse.wgsl?raw";
import { mountBufferBindingOffsetSizeAndRangeLesson } from "@/lessons/lesson-26-buffer-binding-offset-size-and-range/lesson";
import lesson26Source0 from "@/lessons/lesson-26-buffer-binding-offset-size-and-range/lesson.ts?raw";
import lesson26Source1 from "@/lessons/lesson-26-buffer-binding-offset-size-and-range/buffer-range.wgsl?raw";
import { mountBufferMapLifecycleAndStagingPatternsLesson } from "@/lessons/lesson-27-buffer-map-lifecycle-and-staging-patterns/lesson";
import lesson27Source0 from "@/lessons/lesson-27-buffer-map-lifecycle-and-staging-patterns/lesson.ts?raw";
import lesson27Source1 from "@/lessons/lesson-27-buffer-map-lifecycle-and-staging-patterns/staging-patterns.wgsl?raw";
import { mountCommandEncodersPassesAndQueueSubmitLesson } from "@/lessons/lesson-28-command-encoders-passes-and-queue-submit/lesson";
import lesson28Source0 from "@/lessons/lesson-28-command-encoders-passes-and-queue-submit/lesson.ts?raw";
import lesson28Source1 from "@/lessons/lesson-28-command-encoders-passes-and-queue-submit/timeline.compute.wgsl?raw";
import lesson28Source2 from "@/lessons/lesson-28-command-encoders-passes-and-queue-submit/timeline.render.wgsl?raw";
import { mountCommandBufferLifecycleAndOneShotSubmitLesson } from "@/lessons/lesson-29-command-buffer-lifecycle-and-one-shot-submit/lesson";
import lesson29Source0 from "@/lessons/lesson-29-command-buffer-lifecycle-and-one-shot-submit/lesson.ts?raw";
import lesson29Source1 from "@/lessons/lesson-29-command-buffer-lifecycle-and-one-shot-submit/command-buffer.wgsl?raw";
import { mountRenderPassLoadStoreOpsAndAttachmentLifecycleLesson } from "@/lessons/lesson-30-render-pass-load-store-ops-and-attachment-lifecycle/lesson";
import lesson30Source0 from "@/lessons/lesson-30-render-pass-load-store-ops-and-attachment-lifecycle/lesson.ts?raw";
import lesson30Source1 from "@/lessons/lesson-30-render-pass-load-store-ops-and-attachment-lifecycle/attachment-present.wgsl?raw";
import lesson30Source2 from "@/lessons/lesson-30-render-pass-load-store-ops-and-attachment-lifecycle/attachment-scene.wgsl?raw";
import { mountRenderPassClearLoadDebuggingAndAttachmentStateLesson } from "@/lessons/lesson-31-render-pass-clear-load-debugging-and-attachment-state/lesson";
import lesson31Source0 from "@/lessons/lesson-31-render-pass-clear-load-debugging-and-attachment-state/lesson.ts?raw";
import lesson31Source1 from "@/lessons/lesson-31-render-pass-clear-load-debugging-and-attachment-state/attachment-debug-present.wgsl?raw";
import lesson31Source2 from "@/lessons/lesson-31-render-pass-clear-load-debugging-and-attachment-state/attachment-debug-scene.wgsl?raw";
import { mountViewportScissorAndRenderPassDynamicStateLesson } from "@/lessons/lesson-32-viewport-scissor-and-render-pass-dynamic-state/lesson";
import lesson32Source0 from "@/lessons/lesson-32-viewport-scissor-and-render-pass-dynamic-state/lesson.ts?raw";
import lesson32Source1 from "@/lessons/lesson-32-viewport-scissor-and-render-pass-dynamic-state/viewport-scissor.wgsl?raw";
import { mountDynamicOffsetsAndBufferAlignmentLesson } from "@/lessons/lesson-33-dynamic-offsets-and-buffer-alignment/lesson";
import lesson33Source0 from "@/lessons/lesson-33-dynamic-offsets-and-buffer-alignment/lesson.ts?raw";
import lesson33Source1 from "@/lessons/lesson-33-dynamic-offsets-and-buffer-alignment/dynamic-offsets.wgsl?raw";
import { mountAsyncPipelinesAndPipelineLayoutReuseLesson } from "@/lessons/lesson-34-async-pipelines-and-pipeline-layout-reuse/lesson";
import lesson34Source0 from "@/lessons/lesson-34-async-pipelines-and-pipeline-layout-reuse/lesson.ts?raw";
import lesson34Source1 from "@/lessons/lesson-34-async-pipelines-and-pipeline-layout-reuse/async-pipelines.compute.wgsl?raw";
import lesson34Source2 from "@/lessons/lesson-34-async-pipelines-and-pipeline-layout-reuse/async-pipelines.wgsl?raw";
import { mountShaderModuleReuseAndPipelineCacheMindsetLesson } from "@/lessons/lesson-35-shader-module-reuse-and-pipeline-cache-mindset/lesson";
import lesson35Source0 from "@/lessons/lesson-35-shader-module-reuse-and-pipeline-cache-mindset/lesson.ts?raw";
import lesson35Source1 from "@/lessons/lesson-35-shader-module-reuse-and-pipeline-cache-mindset/module-reuse.wgsl?raw";
import { mountPipelineLayoutAutoVsExplicitCompatibilityLesson } from "@/lessons/lesson-36-pipeline-layout-auto-vs-explicit-compatibility/lesson";
import lesson36Source0 from "@/lessons/lesson-36-pipeline-layout-auto-vs-explicit-compatibility/lesson.ts?raw";
import lesson36Source1 from "@/lessons/lesson-36-pipeline-layout-auto-vs-explicit-compatibility/layout-compatibility.wgsl?raw";
import { mountWgslMemoryLayoutPaddingAndStructAlignmentLesson } from "@/lessons/lesson-37-wgsl-memory-layout-padding-and-struct-alignment/lesson";
import lesson37Source0 from "@/lessons/lesson-37-wgsl-memory-layout-padding-and-struct-alignment/lesson.ts?raw";
import lesson37Source1 from "@/lessons/lesson-37-wgsl-memory-layout-padding-and-struct-alignment/layout-probe.wgsl?raw";
import { mountShaderF16OptionalFeaturesAndPrecisionTradeoffLesson } from "@/lessons/lesson-38-shader-f16-optional-features-and-precision-tradeoff/lesson";
import lesson38Source0 from "@/lessons/lesson-38-shader-f16-optional-features-and-precision-tradeoff/lesson.ts?raw";
import lesson38Source1 from "@/lessons/lesson-38-shader-f16-optional-features-and-precision-tradeoff/precision-f16.wgsl?raw";
import lesson38Source2 from "@/lessons/lesson-38-shader-f16-optional-features-and-precision-tradeoff/precision-f32.wgsl?raw";
import { mountShaderOverrideConstantsAndPipelineSpecializationLesson } from "@/lessons/lesson-39-shader-override-constants-and-pipeline-specialization/lesson";
import lesson39Source0 from "@/lessons/lesson-39-shader-override-constants-and-pipeline-specialization/lesson.ts?raw";
import lesson39Source1 from "@/lessons/lesson-39-shader-override-constants-and-pipeline-specialization/specialization.wgsl?raw";
import { mountLightingLesson } from "@/lessons/lesson-40-lighting/lesson";
import lesson40Source0 from "@/lessons/lesson-40-lighting/lesson.ts?raw";
import lesson40Source1 from "@/lessons/lesson-40-lighting/cube-data.ts?raw";
import lesson40Source2 from "@/lessons/lesson-40-lighting/cube.frag.wgsl?raw";
import lesson40Source3 from "@/lessons/lesson-40-lighting/cube.vert.wgsl?raw";
import { mountPointLightsLesson } from "@/lessons/lesson-41-point-lights/lesson";
import lesson41Source0 from "@/lessons/lesson-41-point-lights/lesson.ts?raw";
import lesson41Source1 from "@/lessons/lesson-41-point-lights/cube-data.ts?raw";
import lesson41Source2 from "@/lessons/lesson-41-point-lights/math.ts?raw";
import lesson41Source3 from "@/lessons/lesson-41-point-lights/point-light.frag.wgsl?raw";
import lesson41Source4 from "@/lessons/lesson-41-point-lights/point-light.vert.wgsl?raw";
import { mountSpotLightLesson } from "@/lessons/lesson-42-spot-light/lesson";
import lesson42Source0 from "@/lessons/lesson-42-spot-light/lesson.ts?raw";
import lesson42Source1 from "@/lessons/lesson-42-spot-light/cube-data.ts?raw";
import lesson42Source2 from "@/lessons/lesson-42-spot-light/math.ts?raw";
import lesson42Source3 from "@/lessons/lesson-42-spot-light/spot-light.frag.wgsl?raw";
import lesson42Source4 from "@/lessons/lesson-42-spot-light/spot-light.vert.wgsl?raw";
import { mountCameraControlsLesson } from "@/lessons/lesson-43-camera-controls/lesson";
import lesson43Source0 from "@/lessons/lesson-43-camera-controls/lesson.ts?raw";
import lesson43Source1 from "@/lessons/lesson-43-camera-controls/cube-data.ts?raw";
import lesson43Source2 from "@/lessons/lesson-43-camera-controls/cube.frag.wgsl?raw";
import lesson43Source3 from "@/lessons/lesson-43-camera-controls/cube.vert.wgsl?raw";
import lesson43Source4 from "@/lessons/lesson-43-camera-controls/math.ts?raw";
import { mountFreeOrbitCameraLesson } from "@/lessons/lesson-44-free-orbit-camera/lesson";
import lesson44Source0 from "@/lessons/lesson-44-free-orbit-camera/lesson.ts?raw";
import lesson44Source1 from "@/lessons/lesson-44-free-orbit-camera/cube-data.ts?raw";
import lesson44Source2 from "@/lessons/lesson-44-free-orbit-camera/cube.frag.wgsl?raw";
import lesson44Source3 from "@/lessons/lesson-44-free-orbit-camera/cube.vert.wgsl?raw";
import lesson44Source4 from "@/lessons/lesson-44-free-orbit-camera/math.ts?raw";
import { mountSpecularMaterialsLesson } from "@/lessons/lesson-45-specular-materials/lesson";
import lesson45Source0 from "@/lessons/lesson-45-specular-materials/lesson.ts?raw";
import lesson45Source1 from "@/lessons/lesson-45-specular-materials/cube-data.ts?raw";
import lesson45Source2 from "@/lessons/lesson-45-specular-materials/cube.frag.wgsl?raw";
import lesson45Source3 from "@/lessons/lesson-45-specular-materials/cube.vert.wgsl?raw";
import lesson45Source4 from "@/lessons/lesson-45-specular-materials/math.ts?raw";
import { mountComparisonSamplersAndDepthTextureSamplingLesson } from "@/lessons/lesson-46-comparison-samplers-and-depth-texture-sampling/lesson";
import lesson46Source0 from "@/lessons/lesson-46-comparison-samplers-and-depth-texture-sampling/lesson.ts?raw";
import lesson46Source1 from "@/lessons/lesson-46-comparison-samplers-and-depth-texture-sampling/depth-compare.wgsl?raw";
import lesson46Source2 from "@/lessons/lesson-46-comparison-samplers-and-depth-texture-sampling/depth-pass.wgsl?raw";
import { mountDepthBiasSlopeScaleAndShadowAcneLesson } from "@/lessons/lesson-47-depth-bias-slope-scale-and-shadow-acne/lesson";
import lesson47Source0 from "@/lessons/lesson-47-depth-bias-slope-scale-and-shadow-acne/lesson.ts?raw";
import lesson47Source1 from "@/lessons/lesson-47-depth-bias-slope-scale-and-shadow-acne/bias-present.wgsl?raw";
import lesson47Source2 from "@/lessons/lesson-47-depth-bias-slope-scale-and-shadow-acne/shadow-depth.wgsl?raw";
import { mountShadowMappingLesson } from "@/lessons/lesson-48-shadow-mapping/lesson";
import lesson48Source0 from "@/lessons/lesson-48-shadow-mapping/lesson.ts?raw";
import lesson48Source1 from "@/lessons/lesson-48-shadow-mapping/cube-data.ts?raw";
import lesson48Source2 from "@/lessons/lesson-48-shadow-mapping/math.ts?raw";
import lesson48Source3 from "@/lessons/lesson-48-shadow-mapping/scene.frag.wgsl?raw";
import lesson48Source4 from "@/lessons/lesson-48-shadow-mapping/scene.vert.wgsl?raw";
import lesson48Source5 from "@/lessons/lesson-48-shadow-mapping/shadow.vert.wgsl?raw";
import { mountMultiObjectShadowsLesson } from "@/lessons/lesson-49-multi-object-shadows/lesson";
import lesson49Source0 from "@/lessons/lesson-49-multi-object-shadows/lesson.ts?raw";
import { mountMultiLightShadowsLesson } from "@/lessons/lesson-50-multi-light-shadows/lesson";
import lesson50Source0 from "@/lessons/lesson-50-multi-light-shadows/lesson.ts?raw";
import lesson50Source1 from "@/lessons/lesson-50-multi-light-shadows/light-marker-sphere.ts?raw";
import lesson50Source2 from "@/lessons/lesson-50-multi-light-shadows/light-marker.frag.wgsl?raw";
import lesson50Source3 from "@/lessons/lesson-50-multi-light-shadows/light-marker.vert.wgsl?raw";
import lesson50Source4 from "@/lessons/lesson-50-multi-light-shadows/scene.frag.wgsl?raw";
import lesson50Source5 from "@/lessons/lesson-50-multi-light-shadows/scene.vert.wgsl?raw";
import lesson50Source6 from "@/lessons/lesson-50-multi-light-shadows/shadow.vert.wgsl?raw";
import { mountSceneGraphLesson } from "@/lessons/lesson-51-scene-graph/lesson";
import lesson51Source0 from "@/lessons/lesson-51-scene-graph/lesson.ts?raw";
import lesson51Source1 from "@/lessons/lesson-51-scene-graph/cube-data.ts?raw";
import lesson51Source2 from "@/lessons/lesson-51-scene-graph/cube.frag.wgsl?raw";
import lesson51Source3 from "@/lessons/lesson-51-scene-graph/cube.vert.wgsl?raw";
import lesson51Source4 from "@/lessons/lesson-51-scene-graph/math.ts?raw";

export const lessons1To51: LessonDefinition[] = [
  {
    id: "01-triangle",
    order: 1,
    title: "你好，三角形",
    tagline: "第 1 课：你好，三角形",
    goal: "学习 你好，三角形：render pipeline / clip-space 顶点 / vertex-fragment shader。",
    summary:
      "本课聚焦 你好，三角形 的核心链路，重点观察 createShaderModule / createRenderPipeline / beginRenderPass / draw 与 @vertex / @fragment 如何共同生成第一张 WebGPU 画面。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / beginRenderPass / draw。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：clip-space 顶点 / render pipeline / vertex-fragment shader。",
    ],
    status: "ready",
    mount: mountTriangleLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson1Source0,
        displaySegments: pickLessonSourceSegments(lesson1Source0),
        featured: true,
      },
      {
        id: "triangle-wgsl",
        filename: "triangle.wgsl",
        language: "wgsl",
        content: lesson1Source1,
      },
    ],
  },
  {
    id: "02-adapter-device-features-and-limits",
    order: 2,
    title: "Adapter、Device、Features 与 Limits",
    tagline: "第 2 课：Adapter、Device、Features 与 Limits",
    goal: "学习 Adapter、Device、Features 与 Limits：adapter/device 获取 / features 与 limits 查询 / requiredFeatures / requiredLimits。",
    summary:
      "本课聚焦 Adapter、Device、Features 与 Limits 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：adapter/device 获取 / features 与 limits 查询 / requiredFeatures / requiredLimits。",
    ],
    status: "ready",
    mount: mountAdapterDeviceFeaturesAndLimitsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson2Source0,
        displaySegments: pickLessonSourceSegments(lesson2Source0),
        featured: true,
      },
      {
        id: "device-bars-wgsl",
        filename: "device-bars.wgsl",
        language: "wgsl",
        content: lesson2Source1,
      },
    ],
  },
  {
    id: "03-canvas-context-configure-and-alpha-mode",
    order: 3,
    title: "Canvas Context、configure 与 Alpha Mode",
    tagline: "第 3 课：Canvas Context、configure 与 Alpha Mode",
    goal: "学习 Canvas Context、configure 与 Alpha Mode：canvas WebGPU context / presentation format / alphaMode 合成 / color target blend state。",
    summary:
      "本课聚焦 Canvas Context、configure 与 Alpha Mode 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment / smoothstep 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment / smoothstep。",
      "核心知识点：canvas WebGPU context / presentation format / alphaMode 合成 / color target blend state。",
    ],
    status: "ready",
    mount: mountCanvasContextConfigureAndAlphaModeLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson3Source0,
        displaySegments: pickLessonSourceSegments(lesson3Source0),
        featured: true,
      },
      {
        id: "canvas-config-wgsl",
        filename: "canvas-config.wgsl",
        language: "wgsl",
        content: lesson3Source1,
      },
    ],
  },
  {
    id: "04-error-scopes-validation-and-device-lost",
    order: 4,
    title: "Error Scope、Validation 与 Device Lost",
    tagline: "第 4 课：Error Scope、Validation 与 Device Lost",
    goal: "学习 Error Scope、Validation 与 Device Lost：validation error scope / uncaptured error / device lost 生命周期。",
    summary:
      "本课聚焦 Error Scope、Validation 与 Device Lost 的核心链路，重点观察 pushErrorScope / popErrorScope / uncapturederror / device.lost 如何把 WebGPU 错误纳入可控诊断。",
    notes: [
      "WebGPU API：pushErrorScope / popErrorScope / uncapturederror / device.lost。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：validation error scope / GPUValidationError / device lost 生命周期。",
    ],
    status: "ready",
    mount: mountErrorScopesValidationAndDeviceLostLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson4Source0,
        displaySegments: pickLessonSourceSegments(lesson4Source0),
        featured: true,
      },
      {
        id: "safe-triangle-wgsl",
        filename: "safe-triangle.wgsl",
        language: "wgsl",
        content: lesson4Source1,
      },
    ],
  },
  {
    id: "05-labels-debug-groups-and-error-diagnostics",
    order: 5,
    title: "Labels、Debug Groups 与错误诊断",
    tagline: "第 5 课：Labels、Debug Groups 与错误诊断",
    goal: "学习 Labels、Debug Groups 与错误诊断：resource label / debug group marker / 带标签的错误定位。",
    summary:
      "本课聚焦 Labels、Debug Groups 与错误诊断 的核心链路，重点观察 pushErrorScope / popErrorScope / uncapturederror / pushDebugGroup 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：pushErrorScope / popErrorScope / uncapturederror / pushDebugGroup。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：resource label / debug group marker / 带标签的错误定位。",
    ],
    status: "ready",
    mount: mountLabelsDebugGroupsAndErrorDiagnosticsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson5Source0,
        displaySegments: pickLessonSourceSegments(lesson5Source0),
        featured: true,
      },
      {
        id: "debug-groups-wgsl",
        filename: "debug-groups.wgsl",
        language: "wgsl",
        content: lesson5Source1,
      },
    ],
  },
  {
    id: "06-shader-compilation-info-and-wgsl-diagnostics",
    order: 6,
    title: "Shader Compilation Info 与 WGSL Diagnostics",
    tagline: "第 6 课：Shader Compilation Info 与 WGSL Diagnostics",
    goal: "学习 Shader Compilation Info 与 WGSL Diagnostics：shader compilation info / WGSL 行列诊断 / 受控 shader validation。",
    summary:
      "本课聚焦 Shader Compilation Info 与 WGSL Diagnostics 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment / mix 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment / mix。",
      "核心知识点：shader compilation info / WGSL 行列诊断 / 受控 shader validation。",
    ],
    status: "ready",
    mount: mountShaderCompilationInfoAndWgslDiagnosticsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson6Source0,
        displaySegments: pickLessonSourceSegments(lesson6Source0),
        featured: true,
      },
      {
        id: "diagnostics-invalid-wgsl",
        filename: "diagnostics.invalid.wgsl",
        language: "wgsl",
        content: lesson6Source1,
      },
      {
        id: "diagnostics-valid-wgsl",
        filename: "diagnostics.valid.wgsl",
        language: "wgsl",
        content: lesson6Source2,
      },
    ],
  },
  {
    id: "07-vertex-buffers",
    order: 7,
    title: "顶点缓冲",
    tagline: "第 7 课：顶点缓冲",
    goal: "学习 顶点缓冲：vertex buffer layout / attribute location / GPUBufferUsage.VERTEX。",
    summary:
      "本课聚焦 顶点缓冲 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBuffer / queue.writeBuffer 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBuffer / queue.writeBuffer。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：vertex buffer layout / attribute location / GPUBufferUsage.VERTEX。",
    ],
    status: "ready",
    mount: mountVertexBufferLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson7Source0,
        displaySegments: pickLessonSourceSegments(lesson7Source0),
        featured: true,
      },
      {
        id: "triangle-wgsl",
        filename: "triangle.wgsl",
        language: "wgsl",
        content: lesson7Source1,
      },
    ],
  },
  {
    id: "08-buffer-usage-mapping-and-copy",
    order: 8,
    title: "Buffer Usage、Mapping 与 Copy",
    tagline: "第 8 课：Buffer Usage、Mapping 与 Copy",
    goal: "学习 Buffer Usage、Mapping 与 Copy：buffer usage flags / mapAsync staging / GPU copy 与 readback。",
    summary:
      "本课聚焦 Buffer Usage、Mapping 与 Copy 的核心链路，重点观察 createBuffer / mappedAtCreation / mapAsync / copyBufferToBuffer 如何完成上传、复制与回读校验。",
    notes: [
      "WebGPU API：createBuffer / mappedAtCreation / mapAsync / copyBufferToBuffer。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：usage flags / staging buffer / readback validation。",
    ],
    status: "ready",
    mount: mountBufferUsageMappingAndCopyLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson8Source0,
        displaySegments: pickLessonSourceSegments(lesson8Source0),
        featured: true,
      },
      {
        id: "buffer-bars-wgsl",
        filename: "buffer-bars.wgsl",
        language: "wgsl",
        content: lesson8Source1,
      },
    ],
  },
  {
    id: "09-index-buffer-drawindexed-and-index-format",
    order: 9,
    title: "Index Buffer、drawIndexed 与 Index Format",
    tagline: "第 9 课：Index Buffer、drawIndexed 与 Index Format",
    goal: "学习 Index Buffer、drawIndexed 与 Index Format：index buffer / uint16 / uint32 index format / 共享顶点与 drawIndexed。",
    summary:
      "本课聚焦 Index Buffer、drawIndexed 与 Index Format 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation 与 @vertex / @fragment / smoothstep 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation。",
      "WGSL / 数据流：@vertex / @fragment / smoothstep。",
      "核心知识点：index buffer / uint16 / uint32 index format / 共享顶点与 drawIndexed。",
    ],
    status: "ready",
    mount: mountIndexBufferDrawIndexedAndIndexFormatLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson9Source0,
        displaySegments: pickLessonSourceSegments(lesson9Source0),
        featured: true,
      },
      {
        id: "index-buffer-wgsl",
        filename: "index-buffer.wgsl",
        language: "wgsl",
        content: lesson9Source1,
      },
    ],
  },
  {
    id: "10-vertex-buffer-layout-attributes-and-step-mode",
    order: 10,
    title: "Vertex Buffer Layout、Attributes 与 Step Mode",
    tagline: "第 10 课：Vertex Buffer Layout、Attributes 与 Step Mode",
    goal: "学习 Vertex Buffer Layout、Attributes 与 Step Mode：vertex buffer layout / attribute location / GPUBufferUsage.VERTEX。",
    summary:
      "本课聚焦 Vertex Buffer Layout、Attributes 与 Step Mode 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：vertex buffer layout / attribute location / GPUBufferUsage.VERTEX。",
    ],
    status: "ready",
    mount: mountVertexBufferLayoutAttributesAndStepModeLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson10Source0,
        displaySegments: pickLessonSourceSegments(lesson10Source0),
        featured: true,
      },
      {
        id: "vertex-layout-wgsl",
        filename: "vertex-layout.wgsl",
        language: "wgsl",
        content: lesson10Source1,
      },
    ],
  },
  {
    id: "11-packed-vertex-formats-normalized-attributes-and-stride",
    order: 11,
    title: "Packed Vertex Format、Normalized Attribute 与 Stride",
    tagline: "第 11 课：Packed Vertex Format、Normalized Attribute 与 Stride",
    goal: "学习 Packed Vertex Format、Normalized Attribute 与 Stride：unorm / snorm packed attribute / arrayStride / offset / buffer footprint。",
    summary:
      "本课聚焦 Packed Vertex Format、Normalized Attribute 与 Stride 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation 与 @vertex / @fragment / dot / normalize 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBuffer / mappedAtCreation。",
      "WGSL / 数据流：@vertex / @fragment / dot / normalize。",
      "核心知识点：unorm / snorm packed attribute / arrayStride / offset / buffer footprint。",
    ],
    status: "ready",
    mount: mountPackedVertexFormatsNormalizedAttributesAndStrideLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson11Source0,
        displaySegments: pickLessonSourceSegments(lesson11Source0),
        featured: true,
      },
      {
        id: "packed-vertex-wgsl",
        filename: "packed-vertex.wgsl",
        language: "wgsl",
        content: lesson11Source1,
      },
    ],
  },
  {
    id: "12-uniforms",
    order: 12,
    title: "Uniform 与时间",
    tagline: "第 12 课：Uniform 与时间",
    goal: "学习 Uniform 与时间：uniform buffer / 时间参数上传 / WGSL uniform 读取。",
    summary:
      "本课聚焦 Uniform 与时间 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：uniform buffer / 时间参数上传 / WGSL uniform 读取。",
    ],
    status: "ready",
    mount: mountUniformLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson12Source0,
        displaySegments: pickLessonSourceSegments(lesson12Source0),
        featured: true,
      },
      {
        id: "triangle-wgsl",
        filename: "triangle.wgsl",
        language: "wgsl",
        content: lesson12Source1,
      },
    ],
  },
  {
    id: "13-cube-depth",
    order: 13,
    title: "立方体与深度",
    tagline: "第 13 课：立方体与深度",
    goal: "学习 立方体与深度：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照 / depth texture。",
    summary:
      "本课聚焦 立方体与深度 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照 / depth texture。",
    ],
    status: "ready",
    mount: mountCubeDepthLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson13Source0,
        displaySegments: pickLessonSourceSegments(lesson13Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson13Source1,
      },
      {
        id: "cube-wgsl",
        filename: "cube.wgsl",
        language: "wgsl",
        content: lesson13Source2,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson13Source3,
      },
    ],
  },
  {
    id: "14-textures",
    order: 14,
    title: "纹理与采样器",
    tagline: "第 14 课：纹理与采样器",
    goal: "学习 纹理与采样器：texture format / usage / texture view / sampler / WGSL texture sampling。",
    summary:
      "本课聚焦 纹理与采样器 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling。",
    ],
    status: "ready",
    mount: mountTextureLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson14Source0,
        displaySegments: pickLessonSourceSegments(lesson14Source0),
        featured: true,
      },
      {
        id: "texture-wgsl",
        filename: "texture.wgsl",
        language: "wgsl",
        content: lesson14Source1,
      },
    ],
  },
  {
    id: "15-texture-formats-views-and-copy",
    order: 15,
    title: "Texture Format、View 与 Copy",
    tagline: "第 15 课：Texture Format、View 与 Copy",
    goal: "学习 Texture Format、View 与 Copy：texture format / usage / texture view / sampler / WGSL texture sampling。",
    summary:
      "本课聚焦 Texture Format、View 与 Copy 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling。",
    ],
    status: "ready",
    mount: mountTextureFormatsViewsAndCopyLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson15Source0,
        displaySegments: pickLessonSourceSegments(lesson15Source0),
        featured: true,
      },
      {
        id: "texture-panels-wgsl",
        filename: "texture-panels.wgsl",
        language: "wgsl",
        content: lesson15Source1,
      },
    ],
  },
  {
    id: "16-external-image-video-texture-and-copy",
    order: 16,
    title: "External Image、Video Texture 与 Copy",
    tagline: "第 16 课：External Image、Video Texture 与 Copy",
    goal: "学习 External Image、Video Texture 与 Copy：texture format / usage / texture view / sampler / WGSL texture sampling / external image upload。",
    summary:
      "本课聚焦 External Image、Video Texture 与 Copy 的核心链路，重点观察 getContext(\"webgpu\") / createShaderModule / createRenderPipeline / createBindGroup 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：getContext(\"webgpu\") / createShaderModule / createRenderPipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / external image upload。",
    ],
    status: "ready",
    mount: mountExternalImageVideoTextureAndCopyLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson16Source0,
        displaySegments: pickLessonSourceSegments(lesson16Source0),
        featured: true,
      },
      {
        id: "external-copy-fallback-wgsl",
        filename: "external-copy-fallback.wgsl",
        language: "wgsl",
        content: lesson16Source1,
      },
      {
        id: "external-copy-wgsl",
        filename: "external-copy.wgsl",
        language: "wgsl",
        content: lesson16Source2,
      },
    ],
  },
  {
    id: "17-texture-copy-layout-bytes-per-row-and-rows-per-image",
    order: 17,
    title: "Texture Copy Layout、bytesPerRow 与 rowsPerImage",
    tagline: "第 17 课：Texture Copy Layout、bytesPerRow 与 rowsPerImage",
    goal: "学习 Texture Copy Layout、bytesPerRow 与 rowsPerImage：texture format / usage / texture view / sampler / WGSL texture sampling / bytesPerRow 256 对齐。",
    summary:
      "本课聚焦 Texture Copy Layout、bytesPerRow 与 rowsPerImage 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / bytesPerRow 256 对齐。",
    ],
    status: "ready",
    mount: mountTextureCopyLayoutBytesPerRowAndRowsPerImageLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson17Source0,
        displaySegments: pickLessonSourceSegments(lesson17Source0),
        featured: true,
      },
      {
        id: "texture-copy-layout-wgsl",
        filename: "texture-copy-layout.wgsl",
        language: "wgsl",
        content: lesson17Source1,
      },
    ],
  },
  {
    id: "18-texture-to-texture-buffer-copy-and-readback",
    order: 18,
    title: "Texture Copy、Texture Readback 与截图路径",
    tagline: "第 18 课：Texture Copy、Texture Readback 与截图路径",
    goal: "学习 Texture Copy、Texture Readback 与截图路径：texture format / usage / texture view / sampler / WGSL texture sampling / copyTextureToTexture。",
    summary:
      "本课聚焦 Texture Copy、Texture Readback 与截图路径 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / copyTextureToTexture。",
    ],
    status: "ready",
    mount: mountTextureToTextureBufferCopyAndReadbackLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson18Source0,
        displaySegments: pickLessonSourceSegments(lesson18Source0),
        featured: true,
      },
      {
        id: "texture-copy-readback-wgsl",
        filename: "texture-copy-readback.wgsl",
        language: "wgsl",
        content: lesson18Source1,
      },
    ],
  },
  {
    id: "19-texture-view-aspect-and-depth-stencil-views",
    order: 19,
    title: "Texture View Aspect 与 Depth/Stencil View",
    tagline: "第 19 课：Texture View Aspect 与 Depth/Stencil View",
    goal: "学习 Texture View Aspect 与 Depth/Stencil View：depth texture / depth compare / depth attachment state / texture format / usage。",
    summary:
      "本课聚焦 Texture View Aspect 与 Depth/Stencil View 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：depth texture / depth compare / depth attachment state / texture format / usage。",
    ],
    status: "ready",
    mount: mountTextureViewAspectAndDepthStencilViewsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson19Source0,
        displaySegments: pickLessonSourceSegments(lesson19Source0),
        featured: true,
      },
      {
        id: "aspect-views-wgsl",
        filename: "aspect-views.wgsl",
        language: "wgsl",
        content: lesson19Source1,
      },
    ],
  },
  {
    id: "20-texture-view-mip-level-array-layer-range",
    order: 20,
    title: "Texture View Mip Level 与 Array Layer Range",
    tagline: "第 20 课：Texture View Mip Level 与 Array Layer Range",
    goal: "学习 Texture View Mip Level 与 Array Layer Range：texture format / usage / texture view / sampler / WGSL texture sampling / baseMipLevel / mipLevelCount。",
    summary:
      "本课聚焦 Texture View Mip Level 与 Array Layer Range 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / baseMipLevel / mipLevelCount。",
    ],
    status: "ready",
    mount: mountTextureViewMipLevelArrayLayerRangeLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson20Source0,
        displaySegments: pickLessonSourceSegments(lesson20Source0),
        featured: true,
      },
      {
        id: "texture-view-range-wgsl",
        filename: "texture-view-range.wgsl",
        language: "wgsl",
        content: lesson20Source1,
      },
    ],
  },
  {
    id: "21-texture-view-dimension-and-sample-type-compatibility",
    order: 21,
    title: "Texture View Dimension 与 Sample Type 兼容性",
    tagline: "第 21 课：Texture View Dimension 与 Sample Type 兼容性",
    goal: "学习 Texture View Dimension 与 Sample Type 兼容性：texture format / usage / texture view / sampler / WGSL texture sampling / filterable / unfilterable sampleType。",
    summary:
      "本课聚焦 Texture View Dimension 与 Sample Type 兼容性 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：texture format / usage / texture view / sampler / WGSL texture sampling / filterable / unfilterable sampleType。",
    ],
    status: "ready",
    mount: mountTextureViewDimensionAndSampleTypeCompatibilityLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson21Source0,
        displaySegments: pickLessonSourceSegments(lesson21Source0),
        featured: true,
      },
      {
        id: "sample-type-compatibility-wgsl",
        filename: "sample-type-compatibility.wgsl",
        language: "wgsl",
        content: lesson21Source1,
      },
    ],
  },
  {
    id: "22-textured-cube",
    order: 22,
    title: "贴图立方体",
    tagline: "第 22 课：贴图立方体",
    goal: "学习 贴图立方体：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照 / texture format / usage。",
    summary:
      "本课聚焦 贴图立方体 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照 / texture format / usage。",
    ],
    status: "ready",
    mount: mountTexturedCubeLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson22Source0,
        displaySegments: pickLessonSourceSegments(lesson22Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson22Source1,
      },
      {
        id: "cube-frag-wgsl",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: lesson22Source2,
      },
      {
        id: "cube-vert-wgsl",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: lesson22Source3,
      },
    ],
  },
  {
    id: "23-bind-group-layouts-and-pipeline-layouts",
    order: 23,
    title: "Bind Group Layout 与 Pipeline Layout",
    tagline: "第 23 课：Bind Group Layout 与 Pipeline Layout",
    goal: "学习 Bind Group Layout 与 Pipeline Layout：explicit bind group layout / pipeline layout / WGSL binding 对齐。",
    summary:
      "本课聚焦 Bind Group Layout 与 Pipeline Layout 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：explicit bind group layout / pipeline layout / WGSL binding 对齐。",
    ],
    status: "ready",
    mount: mountBindGroupLayoutsAndPipelineLayoutsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson23Source0,
        displaySegments: pickLessonSourceSegments(lesson23Source0),
        featured: true,
      },
      {
        id: "layouts-wgsl",
        filename: "layouts.wgsl",
        language: "wgsl",
        content: lesson23Source1,
      },
    ],
  },
  {
    id: "24-bind-group-entry-types-minbindingsize-and-compatibility",
    order: 24,
    title: "Bind Group Entry Types、minBindingSize 与兼容性",
    tagline: "第 24 课：Bind Group Entry Types、minBindingSize 与兼容性",
    goal: "学习 Bind Group Entry Types、minBindingSize 与兼容性：filterable / unfilterable sampleType / viewDimension / bind group layout compatibility / GPUBindGroupLayoutEntry。",
    summary:
      "本课聚焦 Bind Group Entry Types、minBindingSize 与兼容性 的核心链路，重点观察 pushErrorScope / popErrorScope / createShaderModule / createRenderPipeline 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：pushErrorScope / popErrorScope / createShaderModule / createRenderPipeline。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：filterable / unfilterable sampleType / viewDimension / bind group layout compatibility / GPUBindGroupLayoutEntry。",
    ],
    status: "ready",
    mount: mountBindGroupEntryTypesMinBindingSizeAndCompatibilityLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson24Source0,
        displaySegments: pickLessonSourceSegments(lesson24Source0),
        featured: true,
      },
      {
        id: "bind-compatibility-wgsl",
        filename: "bind-compatibility.wgsl",
        language: "wgsl",
        content: lesson24Source1,
      },
    ],
  },
  {
    id: "25-bind-group-reuse-resource-lifetime-and-rebinding",
    order: 25,
    title: "Bind Group 复用、资源生命周期与 Rebinding",
    tagline: "第 25 课：Bind Group 复用、资源生命周期与 Rebinding",
    goal: "学习 Bind Group 复用、资源生命周期与 Rebinding：bind group immutable resource binding / buffer 内容更新 / texture view rebind / target rebuild。",
    summary:
      "本课聚焦 Bind Group 复用、资源生命周期与 Rebinding 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：bind group immutable resource binding / buffer 内容更新 / texture view rebind / target rebuild。",
    ],
    status: "ready",
    mount: mountBindGroupReuseResourceLifetimeAndRebindingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson25Source0,
        displaySegments: pickLessonSourceSegments(lesson25Source0),
        featured: true,
      },
      {
        id: "bind-reuse-wgsl",
        filename: "bind-reuse.wgsl",
        language: "wgsl",
        content: lesson25Source1,
      },
    ],
  },
  {
    id: "26-buffer-binding-offset-size-and-range",
    order: 26,
    title: "Buffer Binding Offset、Size 与 Range",
    tagline: "第 26 课：Buffer Binding Offset、Size 与 Range",
    goal: "学习 Buffer Binding Offset、Size 与 Range：buffer binding offset / binding size range / alignment 限制。",
    summary:
      "本课聚焦 Buffer Binding Offset、Size 与 Range 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：buffer binding offset / binding size range / alignment 限制。",
    ],
    status: "ready",
    mount: mountBufferBindingOffsetSizeAndRangeLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson26Source0,
        displaySegments: pickLessonSourceSegments(lesson26Source0),
        featured: true,
      },
      {
        id: "buffer-range-wgsl",
        filename: "buffer-range.wgsl",
        language: "wgsl",
        content: lesson26Source1,
      },
    ],
  },
  {
    id: "27-buffer-map-lifecycle-and-staging-patterns",
    order: 27,
    title: "Buffer Map 生命周期与 Staging Patterns",
    tagline: "第 27 课：Buffer Map 生命周期与 Staging Patterns",
    goal: "学习 Buffer Map 生命周期与 Staging Patterns：mappedAtCreation / mapAsync / MAP_WRITE staging upload / MAP_READ readback。",
    summary:
      "本课聚焦 Buffer Map 生命周期与 Staging Patterns 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：mappedAtCreation / mapAsync / MAP_WRITE staging upload / MAP_READ readback。",
    ],
    status: "ready",
    mount: mountBufferMapLifecycleAndStagingPatternsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson27Source0,
        displaySegments: pickLessonSourceSegments(lesson27Source0),
        featured: true,
      },
      {
        id: "staging-patterns-wgsl",
        filename: "staging-patterns.wgsl",
        language: "wgsl",
        content: lesson27Source1,
      },
    ],
  },
  {
    id: "28-command-encoders-passes-and-queue-submit",
    order: 28,
    title: "Command Encoder、Pass 与 Queue Submit",
    tagline: "第 28 课：Command Encoder、Pass 与 Queue Submit",
    goal: "学习 Command Encoder、Pass 与 Queue Submit：command encoder / compute / render pass 顺序 / queue.submit。",
    summary:
      "本课聚焦 Command Encoder、Pass 与 Queue Submit 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：command encoder / compute / render pass 顺序 / queue.submit。",
    ],
    status: "ready",
    mount: mountCommandEncodersPassesAndQueueSubmitLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson28Source0,
        displaySegments: pickLessonSourceSegments(lesson28Source0),
        featured: true,
      },
      {
        id: "timeline-compute-wgsl",
        filename: "timeline.compute.wgsl",
        language: "wgsl",
        content: lesson28Source1,
      },
      {
        id: "timeline-render-wgsl",
        filename: "timeline.render.wgsl",
        language: "wgsl",
        content: lesson28Source2,
      },
    ],
  },
  {
    id: "29-command-buffer-lifecycle-and-one-shot-submit",
    order: 29,
    title: "Command Buffer 生命周期与一次性提交",
    tagline: "第 29 课：Command Buffer 生命周期与一次性提交",
    goal: "学习 Command Buffer 生命周期与一次性提交：GPUCommandBuffer 一次性提交 / finish() / 重复 submit validation。",
    summary:
      "本课聚焦 Command Buffer 生命周期与一次性提交 的核心链路，重点观察 requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\") 与 @vertex / @fragment 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：requestAdapter / requestDevice / getPreferredCanvasFormat / getContext(\"webgpu\")。",
      "WGSL / 数据流：@vertex / @fragment。",
      "核心知识点：GPUCommandBuffer 一次性提交 / finish() / 重复 submit validation。",
    ],
    status: "ready",
    mount: mountCommandBufferLifecycleAndOneShotSubmitLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson29Source0,
        displaySegments: pickLessonSourceSegments(lesson29Source0),
        featured: true,
      },
      {
        id: "command-buffer-wgsl",
        filename: "command-buffer.wgsl",
        language: "wgsl",
        content: lesson29Source1,
      },
    ],
  },
  {
    id: "30-render-pass-load-store-ops-and-attachment-lifecycle",
    order: 30,
    title: "Render Pass LoadOp、StoreOp 与 Attachment Lifecycle",
    tagline: "第 30 课：Render Pass LoadOp、StoreOp 与 Attachment Lifecycle",
    goal: "学习 Render Pass LoadOp、StoreOp 与 Attachment Lifecycle：loadOp / storeOp / render attachment 生命周期 / 临时 target 语义。",
    summary:
      "本课聚焦 Render Pass LoadOp、StoreOp 与 Attachment Lifecycle 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：loadOp / storeOp / render attachment 生命周期 / 临时 target 语义。",
    ],
    status: "ready",
    mount: mountRenderPassLoadStoreOpsAndAttachmentLifecycleLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson30Source0,
        displaySegments: pickLessonSourceSegments(lesson30Source0),
        featured: true,
      },
      {
        id: "attachment-present-wgsl",
        filename: "attachment-present.wgsl",
        language: "wgsl",
        content: lesson30Source1,
      },
      {
        id: "attachment-scene-wgsl",
        filename: "attachment-scene.wgsl",
        language: "wgsl",
        content: lesson30Source2,
      },
    ],
  },
  {
    id: "31-render-pass-clear-load-debugging-and-attachment-state",
    order: 31,
    title: "Render Pass Clear/Load 调试与 Attachment 状态",
    tagline: "第 31 课：Render Pass Clear/Load 调试与 Attachment 状态",
    goal: "学习 Render Pass Clear/Load 调试与 Attachment 状态：clearValue 调试色 / loadOp 保留上一 pass / attachment 状态读图。",
    summary:
      "本课聚焦 Render Pass Clear/Load 调试与 Attachment 状态 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：clearValue 调试色 / loadOp 保留上一 pass / attachment 状态读图。",
    ],
    status: "ready",
    mount: mountRenderPassClearLoadDebuggingAndAttachmentStateLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson31Source0,
        displaySegments: pickLessonSourceSegments(lesson31Source0),
        featured: true,
      },
      {
        id: "attachment-debug-present-wgsl",
        filename: "attachment-debug-present.wgsl",
        language: "wgsl",
        content: lesson31Source1,
      },
      {
        id: "attachment-debug-scene-wgsl",
        filename: "attachment-debug-scene.wgsl",
        language: "wgsl",
        content: lesson31Source2,
      },
    ],
  },
  {
    id: "32-viewport-scissor-and-render-pass-dynamic-state",
    order: 32,
    title: "Viewport、Scissor 与 Render Pass 动态状态",
    tagline: "第 32 课：Viewport、Scissor 与 Render Pass 动态状态",
    goal: "学习 Viewport、Scissor 与 Render Pass 动态状态：setViewport / setScissorRect / render pass dynamic state。",
    summary:
      "本课聚焦 Viewport、Scissor 与 Render Pass 动态状态 的核心链路，重点观察 createShaderModule / createRenderPipeline / texture.createView / createCommandEncoder 与 @vertex / @fragment / mix 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / texture.createView / createCommandEncoder。",
      "WGSL / 数据流：@vertex / @fragment / mix。",
      "核心知识点：setViewport / setScissorRect / render pass dynamic state。",
    ],
    status: "ready",
    mount: mountViewportScissorAndRenderPassDynamicStateLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson32Source0,
        displaySegments: pickLessonSourceSegments(lesson32Source0),
        featured: true,
      },
      {
        id: "viewport-scissor-wgsl",
        filename: "viewport-scissor.wgsl",
        language: "wgsl",
        content: lesson32Source1,
      },
    ],
  },
  {
    id: "33-dynamic-offsets-and-buffer-alignment",
    order: 33,
    title: "Dynamic Offsets 与 Buffer 对齐",
    tagline: "第 33 课：Dynamic Offsets 与 Buffer 对齐",
    goal: "学习 Dynamic Offsets 与 Buffer 对齐：hasDynamicOffset / minUniformBufferOffsetAlignment / setBindGroup dynamic offset。",
    summary:
      "本课聚焦 Dynamic Offsets 与 Buffer 对齐 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：hasDynamicOffset / minUniformBufferOffsetAlignment / setBindGroup dynamic offset。",
    ],
    status: "ready",
    mount: mountDynamicOffsetsAndBufferAlignmentLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson33Source0,
        displaySegments: pickLessonSourceSegments(lesson33Source0),
        featured: true,
      },
      {
        id: "dynamic-offsets-wgsl",
        filename: "dynamic-offsets.wgsl",
        language: "wgsl",
        content: lesson33Source1,
      },
    ],
  },
  {
    id: "34-async-pipelines-and-pipeline-layout-reuse",
    order: 34,
    title: "Async Pipeline 与 Pipeline Layout 复用",
    tagline: "第 34 课：Async Pipeline 与 Pipeline Layout 复用",
    goal: "学习 Async Pipeline 与 Pipeline Layout 复用：explicit bind group layout / pipeline layout / WGSL binding 对齐 / async pipeline creation。",
    summary:
      "本课聚焦 Async Pipeline 与 Pipeline Layout 复用 的核心链路，重点观察 createShaderModule / createRenderPipelineAsync / createComputePipelineAsync / createRenderPipeline 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipelineAsync / createComputePipelineAsync / createRenderPipeline。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：explicit bind group layout / pipeline layout / WGSL binding 对齐 / async pipeline creation。",
    ],
    status: "ready",
    mount: mountAsyncPipelinesAndPipelineLayoutReuseLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson34Source0,
        displaySegments: pickLessonSourceSegments(lesson34Source0),
        featured: true,
      },
      {
        id: "async-pipelines-compute-wgsl",
        filename: "async-pipelines.compute.wgsl",
        language: "wgsl",
        content: lesson34Source1,
      },
      {
        id: "async-pipelines-wgsl",
        filename: "async-pipelines.wgsl",
        language: "wgsl",
        content: lesson34Source2,
      },
    ],
  },
  {
    id: "35-shader-module-reuse-and-pipeline-cache-mindset",
    order: 35,
    title: "Shader Module 复用与 Pipeline Cache 思维",
    tagline: "第 35 课：Shader Module 复用与 Pipeline Cache 思维",
    goal: "学习 Shader Module 复用与 Pipeline Cache 思维：GPUShaderModule 复用 / pipeline cache mindset / render/compute pipeline 边界。",
    summary:
      "本课聚焦 Shader Module 复用与 Pipeline Cache 思维 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createPipelineLayout。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：GPUShaderModule 复用 / pipeline cache mindset / render/compute pipeline 边界。",
    ],
    status: "ready",
    mount: mountShaderModuleReuseAndPipelineCacheMindsetLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson35Source0,
        displaySegments: pickLessonSourceSegments(lesson35Source0),
        featured: true,
      },
      {
        id: "module-reuse-wgsl",
        filename: "module-reuse.wgsl",
        language: "wgsl",
        content: lesson35Source1,
      },
    ],
  },
  {
    id: "36-pipeline-layout-auto-vs-explicit-compatibility",
    order: 36,
    title: "Pipeline Layout: Auto vs Explicit 兼容性",
    tagline: "第 36 课：Pipeline Layout: Auto vs Explicit 兼容性",
    goal: "学习 Pipeline Layout: Auto vs Explicit 兼容性：filterable / unfilterable sampleType / viewDimension / bind group layout compatibility / explicit bind group layout。",
    summary:
      "本课聚焦 Pipeline Layout: Auto vs Explicit 兼容性 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：filterable / unfilterable sampleType / viewDimension / bind group layout compatibility / explicit bind group layout。",
    ],
    status: "ready",
    mount: mountPipelineLayoutAutoVsExplicitCompatibilityLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson36Source0,
        displaySegments: pickLessonSourceSegments(lesson36Source0),
        featured: true,
      },
      {
        id: "layout-compatibility-wgsl",
        filename: "layout-compatibility.wgsl",
        language: "wgsl",
        content: lesson36Source1,
      },
    ],
  },
  {
    id: "37-wgsl-memory-layout-padding-and-struct-alignment",
    order: 37,
    title: "WGSL Memory Layout、Padding 与 Struct 对齐",
    tagline: "第 37 课：WGSL Memory Layout、Padding 与 Struct 对齐",
    goal: "学习 WGSL Memory Layout、Padding 与 Struct 对齐：WGSL alignment / padding / stride / struct buffer packing。",
    summary:
      "本课聚焦 WGSL Memory Layout、Padding 与 Struct 对齐 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：WGSL alignment / padding / stride / struct buffer packing。",
    ],
    status: "ready",
    mount: mountWgslMemoryLayoutPaddingAndStructAlignmentLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson37Source0,
        displaySegments: pickLessonSourceSegments(lesson37Source0),
        featured: true,
      },
      {
        id: "layout-probe-wgsl",
        filename: "layout-probe.wgsl",
        language: "wgsl",
        content: lesson37Source1,
      },
    ],
  },
  {
    id: "38-shader-f16-optional-features-and-precision-tradeoff",
    order: 38,
    title: "shader-f16、Optional Features 与 Precision Tradeoff",
    tagline: "第 38 课：shader-f16、Optional Features 与 Precision Tradeoff",
    goal: "学习 shader-f16、Optional Features 与 Precision Tradeoff：shader-f16 optional feature / f16-f32 fallback / precision tradeoff。",
    summary:
      "本课聚焦 shader-f16、Optional Features 与 Precision Tradeoff 的核心链路，重点观察 requiredFeatures、f16 shader 与 f32 fallback 如何构成可移植精度路径。",
    notes: [
      "WebGPU API：requestDevice / requiredFeatures / adapter.features。",
      "WGSL / 数据流：f16 / f32 / @vertex / @fragment。",
      "核心知识点：shader-f16 optional feature / precision fallback / feature gate。",
    ],
    status: "ready",
    mount: mountShaderF16OptionalFeaturesAndPrecisionTradeoffLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson38Source0,
        displaySegments: pickLessonSourceSegments(lesson38Source0),
        featured: true,
      },
      {
        id: "precision-f16-wgsl",
        filename: "precision-f16.wgsl",
        language: "wgsl",
        content: lesson38Source1,
      },
      {
        id: "precision-f32-wgsl",
        filename: "precision-f32.wgsl",
        language: "wgsl",
        content: lesson38Source2,
      },
    ],
  },
  {
    id: "39-shader-override-constants-and-pipeline-specialization",
    order: 39,
    title: "Shader Override Constants 与 Pipeline Specialization",
    tagline: "第 39 课：Shader Override Constants 与 Pipeline Specialization",
    goal: "学习 Shader Override Constants 与 Pipeline Specialization：WGSL override constants / pipeline specialization / constants descriptor。",
    summary:
      "本课聚焦 Shader Override Constants 与 Pipeline Specialization 的核心链路，重点观察 createShaderModule / createRenderPipeline / texture.createView / createCommandEncoder 与 @vertex / @fragment / override constants / mix 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / texture.createView / createCommandEncoder。",
      "WGSL / 数据流：@vertex / @fragment / override constants / mix。",
      "核心知识点：WGSL override constants / pipeline specialization / constants descriptor。",
    ],
    status: "ready",
    mount: mountShaderOverrideConstantsAndPipelineSpecializationLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson39Source0,
        displaySegments: pickLessonSourceSegments(lesson39Source0),
        featured: true,
      },
      {
        id: "specialization-wgsl",
        filename: "specialization.wgsl",
        language: "wgsl",
        content: lesson39Source1,
      },
    ],
  },
  {
    id: "40-lighting",
    order: 40,
    title: "方向光与法线",
    tagline: "第 40 课：方向光与法线",
    goal: "学习 方向光与法线：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照。",
    summary:
      "本课聚焦 方向光与法线 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照。",
    ],
    status: "ready",
    mount: mountLightingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson40Source0,
        displaySegments: pickLessonSourceSegments(lesson40Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson40Source1,
      },
      {
        id: "cube-frag-wgsl",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: lesson40Source2,
      },
      {
        id: "cube-vert-wgsl",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: lesson40Source3,
      },
    ],
  },
  {
    id: "41-point-lights",
    order: 41,
    title: "环境光与点光源",
    tagline: "第 41 课：环境光与点光源",
    goal: "学习 环境光与点光源：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照。",
    summary:
      "本课聚焦 环境光与点光源 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照。",
    ],
    status: "ready",
    mount: mountPointLightsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson41Source0,
        displaySegments: pickLessonSourceSegments(lesson41Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson41Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson41Source2,
      },
      {
        id: "point-light-frag-wgsl",
        filename: "point-light.frag.wgsl",
        language: "wgsl",
        content: lesson41Source3,
      },
      {
        id: "point-light-vert-wgsl",
        filename: "point-light.vert.wgsl",
        language: "wgsl",
        content: lesson41Source4,
      },
    ],
  },
  {
    id: "42-spot-light",
    order: 42,
    title: "聚光灯",
    tagline: "第 42 课：聚光灯",
    goal: "学习 聚光灯：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照。",
    summary:
      "本课聚焦 聚光灯 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照。",
    ],
    status: "ready",
    mount: mountSpotLightLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson42Source0,
        displaySegments: pickLessonSourceSegments(lesson42Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson42Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson42Source2,
      },
      {
        id: "spot-light-frag-wgsl",
        filename: "spot-light.frag.wgsl",
        language: "wgsl",
        content: lesson42Source3,
      },
      {
        id: "spot-light-vert-wgsl",
        filename: "spot-light.vert.wgsl",
        language: "wgsl",
        content: lesson42Source4,
      },
    ],
  },
  {
    id: "43-camera-controls",
    order: 43,
    title: "受限轨道相机",
    tagline: "第 43 课：受限轨道相机",
    goal: "学习 受限轨道相机：view / projection matrix / orbit camera controller / 鼠标交互更新 uniform。",
    summary:
      "本课聚焦 受限轨道相机 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：view / projection matrix / orbit camera controller / 鼠标交互更新 uniform。",
    ],
    status: "ready",
    mount: mountCameraControlsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson43Source0,
        displaySegments: pickLessonSourceSegments(lesson43Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson43Source1,
      },
      {
        id: "cube-frag-wgsl",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: lesson43Source2,
      },
      {
        id: "cube-vert-wgsl",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: lesson43Source3,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson43Source4,
      },
    ],
  },
  {
    id: "44-free-orbit-camera",
    order: 44,
    title: "自由轨道相机",
    tagline: "第 44 课：自由轨道相机",
    goal: "学习 自由轨道相机：view / projection matrix / orbit camera controller / 鼠标交互更新 uniform。",
    summary:
      "本课聚焦 自由轨道相机 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：view / projection matrix / orbit camera controller / 鼠标交互更新 uniform。",
    ],
    status: "ready",
    mount: mountFreeOrbitCameraLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson44Source0,
        displaySegments: pickLessonSourceSegments(lesson44Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson44Source1,
      },
      {
        id: "cube-frag-wgsl",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: lesson44Source2,
      },
      {
        id: "cube-vert-wgsl",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: lesson44Source3,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson44Source4,
      },
    ],
  },
  {
    id: "45-specular-materials",
    order: 45,
    title: "高光与材质",
    tagline: "第 45 课：高光与材质",
    goal: "学习 高光与材质：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照。",
    summary:
      "本课聚焦 高光与材质 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：MVP 矩阵 / normal transform / Lambert / Blinn-Phong 光照。",
    ],
    status: "ready",
    mount: mountSpecularMaterialsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson45Source0,
        displaySegments: pickLessonSourceSegments(lesson45Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson45Source1,
      },
      {
        id: "cube-frag-wgsl",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: lesson45Source2,
      },
      {
        id: "cube-vert-wgsl",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: lesson45Source3,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson45Source4,
      },
    ],
  },
  {
    id: "46-comparison-samplers-and-depth-texture-sampling",
    order: 46,
    title: "Comparison Sampler 与 Depth Texture Sampling",
    tagline: "第 46 课：Comparison Sampler 与 Depth Texture Sampling",
    goal: "学习 Comparison Sampler 与 Depth Texture Sampling：depth texture / depth compare / depth attachment state / texture format / usage。",
    summary:
      "本课聚焦 Comparison Sampler 与 Depth Texture Sampling 的核心链路，重点观察 createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createPipelineLayout / createBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：depth texture / depth compare / depth attachment state / texture format / usage。",
    ],
    status: "ready",
    mount: mountComparisonSamplersAndDepthTextureSamplingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson46Source0,
        displaySegments: pickLessonSourceSegments(lesson46Source0),
        featured: true,
      },
      {
        id: "depth-compare-wgsl",
        filename: "depth-compare.wgsl",
        language: "wgsl",
        content: lesson46Source1,
      },
      {
        id: "depth-pass-wgsl",
        filename: "depth-pass.wgsl",
        language: "wgsl",
        content: lesson46Source2,
      },
    ],
  },
  {
    id: "47-depth-bias-slope-scale-and-shadow-acne",
    order: 47,
    title: "Depth Bias、Slope Scale 与 Shadow Acne",
    tagline: "第 47 课：Depth Bias、Slope Scale 与 Shadow Acne",
    goal: "学习 Depth Bias、Slope Scale 与 Shadow Acne：depth texture / depth compare / depth attachment state / shadow map pass。",
    summary:
      "本课聚焦 Depth Bias、Slope Scale 与 Shadow Acne 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：depth texture / depth compare / depth attachment state / shadow map pass。",
    ],
    status: "ready",
    mount: mountDepthBiasSlopeScaleAndShadowAcneLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson47Source0,
        displaySegments: pickLessonSourceSegments(lesson47Source0),
        featured: true,
      },
      {
        id: "bias-present-wgsl",
        filename: "bias-present.wgsl",
        language: "wgsl",
        content: lesson47Source1,
      },
      {
        id: "shadow-depth-wgsl",
        filename: "shadow-depth.wgsl",
        language: "wgsl",
        content: lesson47Source2,
      },
    ],
  },
  {
    id: "48-shadow-mapping",
    order: 48,
    title: "阴影基础",
    tagline: "第 48 课：阴影基础",
    goal: "学习 阴影基础：shadow map pass / comparison sampler / PCF / depth bias。",
    summary:
      "本课聚焦 阴影基础 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：shadow map pass / comparison sampler / PCF / depth bias。",
    ],
    status: "ready",
    mount: mountShadowMappingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson48Source0,
        displaySegments: pickLessonSourceSegments(lesson48Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson48Source1,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson48Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson48Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson48Source4,
      },
      {
        id: "shadow-vert-wgsl",
        filename: "shadow.vert.wgsl",
        language: "wgsl",
        content: lesson48Source5,
      },
    ],
  },
  {
    id: "49-multi-object-shadows",
    order: 49,
    title: "单光源下的多物体阴影",
    tagline: "第 49 课：单光源下的多物体阴影",
    goal: "学习 单光源下的多物体阴影：shadow map pass / comparison sampler / PCF / depth bias。",
    summary:
      "本课聚焦 单光源下的多物体阴影 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 数据布局 / buffer / texture 资源流 / shadow map pass 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：数据布局 / buffer / texture 资源流 / shadow map pass。",
      "核心知识点：shadow map pass / comparison sampler / PCF / depth bias。",
    ],
    status: "ready",
    mount: mountMultiObjectShadowsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson49Source0,
        displaySegments: pickLessonSourceSegments(lesson49Source0),
        featured: true,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson48Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson48Source4,
      },
      {
        id: "shadow-vert-wgsl",
        filename: "shadow.vert.wgsl",
        language: "wgsl",
        content: lesson48Source5,
      },
    ],
  },
  {
    id: "50-multi-light-shadows",
    order: 50,
    title: "多光源阴影",
    tagline: "第 50 课：多光源阴影",
    goal: "学习 多光源阴影：shadow map pass / comparison sampler / PCF / depth bias。",
    summary:
      "本课聚焦 多光源阴影 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：shadow map pass / comparison sampler / PCF / depth bias。",
    ],
    status: "ready",
    mount: mountMultiLightShadowsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson50Source0,
        displaySegments: pickLessonSourceSegments(lesson50Source0),
        featured: true,
      },
      {
        id: "light-marker-sphere-ts",
        filename: "light-marker-sphere.ts",
        language: "ts",
        content: lesson50Source1,
      },
      {
        id: "light-marker-frag-wgsl",
        filename: "light-marker.frag.wgsl",
        language: "wgsl",
        content: lesson50Source2,
      },
      {
        id: "light-marker-vert-wgsl",
        filename: "light-marker.vert.wgsl",
        language: "wgsl",
        content: lesson50Source3,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson50Source4,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson50Source5,
      },
      {
        id: "shadow-vert-wgsl",
        filename: "shadow.vert.wgsl",
        language: "wgsl",
        content: lesson50Source6,
      },
    ],
  },
  {
    id: "51-scene-graph",
    order: 51,
    title: "多物体与场景树",
    tagline: "第 51 课：多物体与场景树",
    goal: "学习 多物体与场景树：node transform hierarchy / matrix composition / multi-object draw。",
    summary:
      "本课聚焦 多物体与场景树 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：node transform hierarchy / matrix composition / multi-object draw。",
    ],
    status: "ready",
    mount: mountSceneGraphLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson51Source0,
        displaySegments: pickLessonSourceSegments(lesson51Source0),
        featured: true,
      },
      {
        id: "cube-data-ts",
        filename: "cube-data.ts",
        language: "ts",
        content: lesson51Source1,
      },
      {
        id: "cube-frag-wgsl",
        filename: "cube.frag.wgsl",
        language: "wgsl",
        content: lesson51Source2,
      },
      {
        id: "cube-vert-wgsl",
        filename: "cube.vert.wgsl",
        language: "wgsl",
        content: lesson51Source3,
      },
      {
        id: "math-ts",
        filename: "math.ts",
        language: "ts",
        content: lesson51Source4,
      },
    ],
  },
];
