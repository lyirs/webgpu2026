import type { LessonDefinition } from "@/studio/types";
import { pickLessonSourceSegments } from "@/studio/lesson-segments";
import { mountDepthOfFieldAndCircleOfConfusionLesson } from "@/lessons/lesson-129-depth-of-field-and-circle-of-confusion/lesson";
import lesson129Source0 from "@/lessons/lesson-129-depth-of-field-and-circle-of-confusion/lesson.ts?raw";
import lesson129Source1 from "@/lessons/lesson-129-depth-of-field-and-circle-of-confusion/coc.wgsl?raw";
import lesson129Source2 from "@/lessons/lesson-129-depth-of-field-and-circle-of-confusion/present.wgsl?raw";
import lesson129Source3 from "@/lessons/lesson-129-depth-of-field-and-circle-of-confusion/scene.frag.wgsl?raw";
import lesson129Source4 from "@/lessons/lesson-129-depth-of-field-and-circle-of-confusion/scene.vert.wgsl?raw";
import { mountBilateralFilteringAndEdgeAwareBlurLesson } from "@/lessons/lesson-130-bilateral-filtering-and-edge-aware-blur/lesson";
import lesson130Source0 from "@/lessons/lesson-130-bilateral-filtering-and-edge-aware-blur/lesson.ts?raw";
import lesson130Source1 from "@/lessons/lesson-130-bilateral-filtering-and-edge-aware-blur/filters.wgsl?raw";
import lesson130Source2 from "@/lessons/lesson-130-bilateral-filtering-and-edge-aware-blur/scene.frag.wgsl?raw";
import lesson130Source3 from "@/lessons/lesson-130-bilateral-filtering-and-edge-aware-blur/scene.vert.wgsl?raw";
import { mountTemporalAccumulationAndDisocclusionLesson } from "@/lessons/lesson-131-temporal-accumulation-and-disocclusion/lesson";
import lesson131Source0 from "@/lessons/lesson-131-temporal-accumulation-and-disocclusion/lesson.ts?raw";
import lesson131Source1 from "@/lessons/lesson-131-temporal-accumulation-and-disocclusion/scene.frag.wgsl?raw";
import lesson131Source2 from "@/lessons/lesson-131-temporal-accumulation-and-disocclusion/scene.vert.wgsl?raw";
import lesson131Source3 from "@/lessons/lesson-131-temporal-accumulation-and-disocclusion/temporal.wgsl?raw";
import { mountSsgiAndScreenSpaceIndirectLightLesson } from "@/lessons/lesson-132-ssgi-and-screen-space-indirect-light/lesson";
import lesson132Source0 from "@/lessons/lesson-132-ssgi-and-screen-space-indirect-light/lesson.ts?raw";
import lesson132Source1 from "@/lessons/lesson-132-ssgi-and-screen-space-indirect-light/scene.frag.wgsl?raw";
import lesson132Source2 from "@/lessons/lesson-132-ssgi-and-screen-space-indirect-light/scene.vert.wgsl?raw";
import lesson132Source3 from "@/lessons/lesson-132-ssgi-and-screen-space-indirect-light/ssgi.wgsl?raw";
import { mountContactShadowsAndScreenSpaceShadowsLesson } from "@/lessons/lesson-133-contact-shadows-and-screen-space-shadows/lesson";
import lesson133Source0 from "@/lessons/lesson-133-contact-shadows-and-screen-space-shadows/lesson.ts?raw";
import lesson133Source1 from "@/lessons/lesson-133-contact-shadows-and-screen-space-shadows/scene.frag.wgsl?raw";
import lesson133Source2 from "@/lessons/lesson-133-contact-shadows-and-screen-space-shadows/scene.vert.wgsl?raw";
import lesson133Source3 from "@/lessons/lesson-133-contact-shadows-and-screen-space-shadows/shadow.wgsl?raw";
import { mountTaauAndDynamicResolutionLesson } from "@/lessons/lesson-134-taau-and-dynamic-resolution/lesson";
import lesson134Source0 from "@/lessons/lesson-134-taau-and-dynamic-resolution/lesson.ts?raw";
import lesson134Source1 from "@/lessons/lesson-134-taau-and-dynamic-resolution/scene.frag.wgsl?raw";
import lesson134Source2 from "@/lessons/lesson-134-taau-and-dynamic-resolution/scene.vert.wgsl?raw";
import lesson134Source3 from "@/lessons/lesson-134-taau-and-dynamic-resolution/taau.wgsl?raw";
import { mountBlueNoiseAndSamplingPatternsLesson } from "@/lessons/lesson-135-blue-noise-and-sampling-patterns/lesson";
import lesson135Source0 from "@/lessons/lesson-135-blue-noise-and-sampling-patterns/lesson.ts?raw";
import { mountMonteCarloIntegrationAndHemisphereSamplingLesson } from "@/lessons/lesson-136-monte-carlo-integration-and-hemisphere-sampling/lesson";
import lesson136Source0 from "@/lessons/lesson-136-monte-carlo-integration-and-hemisphere-sampling/lesson.ts?raw";
import { mountBrdfImportanceSamplingLesson } from "@/lessons/lesson-137-brdf-importance-sampling/lesson";
import lesson137Source0 from "@/lessons/lesson-137-brdf-importance-sampling/lesson.ts?raw";
import { mountComputePathTracingFoundationsLesson } from "@/lessons/lesson-138-compute-path-tracing-foundations/lesson";
import lesson138Source0 from "@/lessons/lesson-138-compute-path-tracing-foundations/lesson.ts?raw";
import lesson138Source1 from "@/lessons/lesson-138-compute-path-tracing-foundations/path-trace.wgsl?raw";
import lesson138Source2 from "@/lessons/lesson-138-compute-path-tracing-foundations/present.wgsl?raw";
import lesson138Source3 from "@/lessons/lesson-138-compute-path-tracing-foundations/scene.frag.wgsl?raw";
import lesson138Source4 from "@/lessons/lesson-138-compute-path-tracing-foundations/scene.vert.wgsl?raw";
import { mountProgressiveAccumulationAndDenoisingEntryLesson } from "@/lessons/lesson-139-progressive-accumulation-and-denoising-entry/lesson";
import lesson139Source0 from "@/lessons/lesson-139-progressive-accumulation-and-denoising-entry/lesson.ts?raw";
import lesson139Source1 from "@/lessons/lesson-139-progressive-accumulation-and-denoising-entry/path-trace.wgsl?raw";
import lesson139Source2 from "@/lessons/lesson-139-progressive-accumulation-and-denoising-entry/present.wgsl?raw";
import lesson139Source3 from "@/lessons/lesson-139-progressive-accumulation-and-denoising-entry/scene.frag.wgsl?raw";
import lesson139Source4 from "@/lessons/lesson-139-progressive-accumulation-and-denoising-entry/scene.vert.wgsl?raw";
import { mountBvhAndPathTracingAccelerationStructuresLesson } from "@/lessons/lesson-140-bvh-and-path-tracing-acceleration-structures/lesson";
import lesson140Source0 from "@/lessons/lesson-140-bvh-and-path-tracing-acceleration-structures/lesson.ts?raw";
import lesson140Source1 from "@/lessons/lesson-140-bvh-and-path-tracing-acceleration-structures/visualization.wgsl?raw";
import { mountNextEventEstimationAndExplicitLightSamplingLesson } from "@/lessons/lesson-141-next-event-estimation-and-explicit-light-sampling/lesson";
import lesson141Source0 from "@/lessons/lesson-141-next-event-estimation-and-explicit-light-sampling/lesson.ts?raw";
import lesson141Source1 from "@/lessons/lesson-141-next-event-estimation-and-explicit-light-sampling/visualization.wgsl?raw";
import { mountMultipleImportanceSamplingLesson } from "@/lessons/lesson-142-multiple-importance-sampling/lesson";
import lesson142Source0 from "@/lessons/lesson-142-multiple-importance-sampling/lesson.ts?raw";
import lesson142Source1 from "@/lessons/lesson-142-multiple-importance-sampling/visualization.wgsl?raw";
import { mountRussianRouletteAndThroughputManagementLesson } from "@/lessons/lesson-143-russian-roulette-and-throughput-management/lesson";
import lesson143Source0 from "@/lessons/lesson-143-russian-roulette-and-throughput-management/lesson.ts?raw";
import lesson143Source1 from "@/lessons/lesson-143-russian-roulette-and-throughput-management/visualization.wgsl?raw";
import { mountRealTimePathTracedDirectLightingAndTemporalStabilizationLesson } from "@/lessons/lesson-144-real-time-path-traced-direct-lighting-and-temporal-stabilization/lesson";
import lesson144Source0 from "@/lessons/lesson-144-real-time-path-traced-direct-lighting-and-temporal-stabilization/lesson.ts?raw";
import lesson144Source1 from "@/lessons/lesson-144-real-time-path-traced-direct-lighting-and-temporal-stabilization/accumulate.compute.wgsl?raw";
import lesson144Source2 from "@/lessons/lesson-144-real-time-path-traced-direct-lighting-and-temporal-stabilization/present.wgsl?raw";
import { mountReservoirSamplingAndRestirDiFoundationsLesson } from "@/lessons/lesson-145-reservoir-sampling-and-restir-di-foundations/lesson";
import lesson145Source0 from "@/lessons/lesson-145-reservoir-sampling-and-restir-di-foundations/lesson.ts?raw";
import lesson145Source1 from "@/lessons/lesson-145-reservoir-sampling-and-restir-di-foundations/visualization.wgsl?raw";
import { mountTemporalReservoirReuseAndHistoryValidationLesson } from "@/lessons/lesson-146-temporal-reservoir-reuse-and-history-validation/lesson";
import lesson146Source0 from "@/lessons/lesson-146-temporal-reservoir-reuse-and-history-validation/lesson.ts?raw";
import lesson146Source1 from "@/lessons/lesson-146-temporal-reservoir-reuse-and-history-validation/visualization.wgsl?raw";
import { mountSpatialReservoirReuseAndNeighborhoodResamplingLesson } from "@/lessons/lesson-147-spatial-reservoir-reuse-and-neighborhood-resampling/lesson";
import lesson147Source0 from "@/lessons/lesson-147-spatial-reservoir-reuse-and-neighborhood-resampling/lesson.ts?raw";
import lesson147Source1 from "@/lessons/lesson-147-spatial-reservoir-reuse-and-neighborhood-resampling/visualization.wgsl?raw";
import { mountRestirDiAndManyLightsDirectLightingLesson } from "@/lessons/lesson-148-restir-di-and-many-lights-direct-lighting/lesson";
import lesson148Source0 from "@/lessons/lesson-148-restir-di-and-many-lights-direct-lighting/lesson.ts?raw";
import lesson148Source1 from "@/lessons/lesson-148-restir-di-and-many-lights-direct-lighting/gpu.ts?raw";
import lesson148Source2 from "@/lessons/lesson-148-restir-di-and-many-lights-direct-lighting/present.wgsl?raw";
import lesson148Source3 from "@/lessons/lesson-148-restir-di-and-many-lights-direct-lighting/spatial.compute.wgsl?raw";
import lesson148Source4 from "@/lessons/lesson-148-restir-di-and-many-lights-direct-lighting/temporal.compute.wgsl?raw";
import lesson148Source5 from "@/lessons/lesson-148-restir-di-and-many-lights-direct-lighting/types.ts?raw";
import lesson148Source6 from "@/lessons/lesson-148-restir-di-and-many-lights-direct-lighting/view.ts?raw";
import { mountRestirDiTemporalStabilizationAndEntryDenoisingLesson } from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/lesson";
import lesson149Source0 from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/lesson.ts?raw";
import lesson149Source1 from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/accumulate.compute.wgsl?raw";
import lesson149Source2 from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/gpu.ts?raw";
import lesson149Source3 from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/present.wgsl?raw";
import lesson149Source4 from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/spatial.compute.wgsl?raw";
import lesson149Source5 from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/temporal.compute.wgsl?raw";
import lesson149Source6 from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/types.ts?raw";
import lesson149Source7 from "@/lessons/lesson-149-restir-di-temporal-stabilization-and-entry-denoising/view.ts?raw";

export const lessons129To149: LessonDefinition[] = [
  {
    id: "129-depth-of-field-and-circle-of-confusion",
    order: 129,
    title: "景深与 Circle of Confusion",
    tagline: "第 129 课：景深与 Circle of Confusion",
    goal: "学习 景深与 Circle of Confusion：depth texture / depth compare / depth attachment state / velocity buffer。",
    summary:
      "本课聚焦 景深与 Circle of Confusion 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：depth texture / depth compare / depth attachment state / velocity buffer。",
    ],
    status: "ready",
    mount: mountDepthOfFieldAndCircleOfConfusionLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson129Source0,
        displaySegments: pickLessonSourceSegments(lesson129Source0),
        featured: true,
      },
      {
        id: "coc-wgsl",
        filename: "coc.wgsl",
        language: "wgsl",
        content: lesson129Source1,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson129Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson129Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson129Source4,
      },
    ],
  },
  {
    id: "130-bilateral-filtering-and-edge-aware-blur",
    order: 130,
    title: "双边滤波与 Edge-aware Blur",
    tagline: "第 130 课：双边滤波与 Edge-aware Blur",
    goal: "学习 双边滤波与 Edge-aware Blur：offscreen render target / fullscreen pass / post-process sampling / edge-aware filter。",
    summary:
      "本课聚焦 双边滤波与 Edge-aware Blur 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：offscreen render target / fullscreen pass / post-process sampling / edge-aware filter。",
    ],
    status: "ready",
    mount: mountBilateralFilteringAndEdgeAwareBlurLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson130Source0,
        displaySegments: pickLessonSourceSegments(lesson130Source0),
        featured: true,
      },
      {
        id: "filters-wgsl",
        filename: "filters.wgsl",
        language: "wgsl",
        content: lesson130Source1,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson130Source2,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson130Source3,
      },
    ],
  },
  {
    id: "131-temporal-accumulation-and-disocclusion",
    order: 131,
    title: "Temporal Accumulation 与 Disocclusion",
    tagline: "第 131 课：Temporal Accumulation 与 Disocclusion",
    goal: "学习 Temporal Accumulation 与 Disocclusion：GPUQuerySet / resolveQuerySet / readback latency / edge-aware filter。",
    summary:
      "本课聚焦 Temporal Accumulation 与 Disocclusion 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：GPUQuerySet / resolveQuerySet / readback latency / edge-aware filter。",
    ],
    status: "ready",
    mount: mountTemporalAccumulationAndDisocclusionLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson131Source0,
        displaySegments: pickLessonSourceSegments(lesson131Source0),
        featured: true,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson131Source1,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson131Source2,
      },
      {
        id: "temporal-wgsl",
        filename: "temporal.wgsl",
        language: "wgsl",
        content: lesson131Source3,
      },
    ],
  },
  {
    id: "132-ssgi-and-screen-space-indirect-light",
    order: 132,
    title: "SSGI 与屏幕空间间接光",
    tagline: "第 132 课：SSGI 与屏幕空间间接光",
    goal: "学习 SSGI 与屏幕空间间接光：screen-space ray march / depth/normal G-buffer / hit/fallback logic。",
    summary:
      "本课聚焦 SSGI 与屏幕空间间接光 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：screen-space ray march / depth/normal G-buffer / hit/fallback logic。",
    ],
    status: "ready",
    mount: mountSsgiAndScreenSpaceIndirectLightLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson132Source0,
        displaySegments: pickLessonSourceSegments(lesson132Source0),
        featured: true,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson132Source1,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson132Source2,
      },
      {
        id: "ssgi-wgsl",
        filename: "ssgi.wgsl",
        language: "wgsl",
        content: lesson132Source3,
      },
    ],
  },
  {
    id: "133-contact-shadows-and-screen-space-shadows",
    order: 133,
    title: "Contact Shadows 与屏幕空间阴影",
    tagline: "第 133 课：Contact Shadows 与屏幕空间阴影",
    goal: "学习 Contact Shadows 与屏幕空间阴影：shadow map pass / comparison sampler / PCF / depth bias / screen-space ray march。",
    summary:
      "本课聚焦 Contact Shadows 与屏幕空间阴影 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：shadow map pass / comparison sampler / PCF / depth bias / screen-space ray march。",
    ],
    status: "ready",
    mount: mountContactShadowsAndScreenSpaceShadowsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson133Source0,
        displaySegments: pickLessonSourceSegments(lesson133Source0),
        featured: true,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson133Source1,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson133Source2,
      },
      {
        id: "shadow-wgsl",
        filename: "shadow.wgsl",
        language: "wgsl",
        content: lesson133Source3,
      },
    ],
  },
  {
    id: "134-taau-and-dynamic-resolution",
    order: 134,
    title: "TAAU 与 Dynamic Resolution",
    tagline: "第 134 课：TAAU 与 Dynamic Resolution",
    goal: "学习 TAAU 与 Dynamic Resolution：velocity buffer / history reprojection / temporal reconstruction / edge-aware filter。",
    summary:
      "本课聚焦 TAAU 与 Dynamic Resolution 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：velocity buffer / history reprojection / temporal reconstruction / edge-aware filter。",
    ],
    status: "ready",
    mount: mountTaauAndDynamicResolutionLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson134Source0,
        displaySegments: pickLessonSourceSegments(lesson134Source0),
        featured: true,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson134Source1,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson134Source2,
      },
      {
        id: "taau-wgsl",
        filename: "taau.wgsl",
        language: "wgsl",
        content: lesson134Source3,
      },
    ],
  },
  {
    id: "135-blue-noise-and-sampling-patterns",
    order: 135,
    title: "Blue Noise 与采样模式",
    tagline: "第 135 课：Blue Noise 与采样模式",
    goal: "学习 Blue Noise 与采样模式：Monte Carlo sampling / path throughput / progressive accumulation。",
    summary:
      "本课聚焦 Blue Noise 与采样模式 的核心链路，重点观察 getContext(\"webgpu\") 与 数据布局 / buffer / texture 资源流 / Monte Carlo sampling 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：getContext(\"webgpu\")。",
      "WGSL / 数据流：数据布局 / buffer / texture 资源流 / Monte Carlo sampling。",
      "核心知识点：Monte Carlo sampling / path throughput / progressive accumulation。",
    ],
    status: "ready",
    mount: mountBlueNoiseAndSamplingPatternsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson135Source0,
        displaySegments: pickLessonSourceSegments(lesson135Source0),
        featured: true,
      },
    ],
  },
  {
    id: "136-monte-carlo-integration-and-hemisphere-sampling",
    order: 136,
    title: "Monte Carlo 积分与半球采样",
    tagline: "第 136 课：Monte Carlo 积分与半球采样",
    goal: "学习 Monte Carlo 积分与半球采样：Monte Carlo sampling / path throughput / progressive accumulation。",
    summary:
      "本课聚焦 Monte Carlo 积分与半球采样 的核心链路，重点观察 getContext(\"webgpu\") 与 数据布局 / buffer / texture 资源流 / Monte Carlo sampling 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：getContext(\"webgpu\")。",
      "WGSL / 数据流：数据布局 / buffer / texture 资源流 / Monte Carlo sampling。",
      "核心知识点：Monte Carlo sampling / path throughput / progressive accumulation。",
    ],
    status: "ready",
    mount: mountMonteCarloIntegrationAndHemisphereSamplingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson136Source0,
        displaySegments: pickLessonSourceSegments(lesson136Source0),
        featured: true,
      },
    ],
  },
  {
    id: "137-brdf-importance-sampling",
    order: 137,
    title: "BRDF Importance Sampling",
    tagline: "第 137 课：BRDF Importance Sampling",
    goal: "学习 BRDF Importance Sampling：Monte Carlo sampling / path throughput / progressive accumulation。",
    summary:
      "本课聚焦 BRDF Importance Sampling 的核心链路，重点观察 getContext(\"webgpu\") 与 数据布局 / buffer / texture 资源流 / Monte Carlo sampling 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：getContext(\"webgpu\")。",
      "WGSL / 数据流：数据布局 / buffer / texture 资源流 / Monte Carlo sampling。",
      "核心知识点：Monte Carlo sampling / path throughput / progressive accumulation。",
    ],
    status: "ready",
    mount: mountBrdfImportanceSamplingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson137Source0,
        displaySegments: pickLessonSourceSegments(lesson137Source0),
        featured: true,
      },
    ],
  },
  {
    id: "138-compute-path-tracing-foundations",
    order: 138,
    title: "Compute Path Tracing 基础",
    tagline: "第 138 课：Compute Path Tracing 基础",
    goal: "学习 Compute Path Tracing 基础：Monte Carlo sampling / path throughput / progressive accumulation。",
    summary:
      "本课聚焦 Compute Path Tracing 基础 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：Monte Carlo sampling / path throughput / progressive accumulation。",
    ],
    status: "ready",
    mount: mountComputePathTracingFoundationsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson138Source0,
        displaySegments: pickLessonSourceSegments(lesson138Source0),
        featured: true,
      },
      {
        id: "path-trace-wgsl",
        filename: "path-trace.wgsl",
        language: "wgsl",
        content: lesson138Source1,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson138Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson138Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson138Source4,
      },
    ],
  },
  {
    id: "139-progressive-accumulation-and-denoising-entry",
    order: 139,
    title: "Progressive Accumulation 与去噪入口",
    tagline: "第 139 课：Progressive Accumulation 与去噪入口",
    goal: "学习 Progressive Accumulation 与去噪入口：Monte Carlo sampling / path throughput / progressive accumulation。",
    summary:
      "本课聚焦 Progressive Accumulation 与去噪入口 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：Monte Carlo sampling / path throughput / progressive accumulation。",
    ],
    status: "ready",
    mount: mountProgressiveAccumulationAndDenoisingEntryLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson139Source0,
        displaySegments: pickLessonSourceSegments(lesson139Source0),
        featured: true,
      },
      {
        id: "path-trace-wgsl",
        filename: "path-trace.wgsl",
        language: "wgsl",
        content: lesson139Source1,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson139Source2,
      },
      {
        id: "scene-frag-wgsl",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: lesson139Source3,
      },
      {
        id: "scene-vert-wgsl",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: lesson139Source4,
      },
    ],
  },
  {
    id: "140-bvh-and-path-tracing-acceleration-structures",
    order: 140,
    title: "BVH 与路径追踪加速结构",
    tagline: "第 140 课：BVH 与路径追踪加速结构",
    goal: "学习 BVH 与路径追踪加速结构：Monte Carlo sampling / path throughput / progressive accumulation。",
    summary:
      "本课聚焦 BVH 与路径追踪加速结构 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：Monte Carlo sampling / path throughput / progressive accumulation。",
    ],
    status: "ready",
    mount: mountBvhAndPathTracingAccelerationStructuresLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson140Source0,
        displaySegments: pickLessonSourceSegments(lesson140Source0),
        featured: true,
      },
      {
        id: "visualization-wgsl",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: lesson140Source1,
      },
    ],
  },
  {
    id: "141-next-event-estimation-and-explicit-light-sampling",
    order: 141,
    title: "Next Event Estimation 与显式采样光源",
    tagline: "第 141 课：Next Event Estimation 与显式采样光源",
    goal: "学习 Next Event Estimation 与显式采样光源：Monte Carlo sampling / path throughput / progressive accumulation。",
    summary:
      "本课聚焦 Next Event Estimation 与显式采样光源 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：Monte Carlo sampling / path throughput / progressive accumulation。",
    ],
    status: "ready",
    mount: mountNextEventEstimationAndExplicitLightSamplingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson141Source0,
        displaySegments: pickLessonSourceSegments(lesson141Source0),
        featured: true,
      },
      {
        id: "visualization-wgsl",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: lesson141Source1,
      },
    ],
  },
  {
    id: "142-multiple-importance-sampling",
    order: 142,
    title: "Multiple Importance Sampling",
    tagline: "第 142 课：Multiple Importance Sampling",
    goal: "学习 Multiple Importance Sampling：light sampling / BRDF sampling / power heuristic 权重。",
    summary:
      "本课聚焦 Multiple Importance Sampling 的核心链路，重点观察 light pdf、BRDF pdf 与 power heuristic 如何把两种 direct-light 采样策略合成更稳定的估计。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：light pdf / BRDF pdf / MIS weight。",
      "核心知识点：light sampling / BRDF importance sampling / power heuristic。",
    ],
    status: "ready",
    mount: mountMultipleImportanceSamplingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson142Source0,
        displaySegments: pickLessonSourceSegments(lesson142Source0),
        featured: true,
      },
      {
        id: "visualization-wgsl",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: lesson142Source1,
      },
    ],
  },
  {
    id: "143-russian-roulette-and-throughput-management",
    order: 143,
    title: "Russian Roulette 与路径吞吐管理",
    tagline: "第 143 课：Russian Roulette 与路径吞吐管理",
    goal: "学习 Russian Roulette 与路径吞吐管理：Monte Carlo sampling / path throughput / progressive accumulation。",
    summary:
      "本课聚焦 Russian Roulette 与路径吞吐管理 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：Monte Carlo sampling / path throughput / progressive accumulation。",
    ],
    status: "ready",
    mount: mountRussianRouletteAndThroughputManagementLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson143Source0,
        displaySegments: pickLessonSourceSegments(lesson143Source0),
        featured: true,
      },
      {
        id: "visualization-wgsl",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: lesson143Source1,
      },
    ],
  },
  {
    id: "144-real-time-path-traced-direct-lighting-and-temporal-stabilization",
    order: 144,
    title: "实时路径追踪直射光与时域稳定化",
    tagline: "第 144 课：实时路径追踪直射光与时域稳定化",
    goal: "学习 实时路径追踪直射光与时域稳定化：1 spp direct lighting / reprojection / history clamp。",
    summary:
      "本课聚焦 实时路径追踪直射光与时域稳定化 的核心链路，重点观察 1 spp direct-light path tracing、velocity reprojection 与 neighborhood clamp 如何稳定当前帧噪声。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@compute / current radiance / velocity / history texture。",
      "核心知识点：1 spp direct lighting / temporal reprojection / history clamp。",
    ],
    status: "ready",
    mount: mountRealTimePathTracedDirectLightingAndTemporalStabilizationLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson144Source0,
        displaySegments: pickLessonSourceSegments(lesson144Source0),
        featured: true,
      },
      {
        id: "accumulate-compute-wgsl",
        filename: "accumulate.compute.wgsl",
        language: "wgsl",
        content: lesson144Source1,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson144Source2,
      },
    ],
  },
  {
    id: "145-reservoir-sampling-and-restir-di-foundations",
    order: 145,
    title: "Reservoir Sampling 与 ReSTIR DI 基础",
    tagline: "第 145 课：Reservoir Sampling 与 ReSTIR DI 基础",
    goal: "学习 Reservoir Sampling 与 ReSTIR DI 基础：reservoir sampling / temporal/spatial reuse / many-light direct illumination。",
    summary:
      "本课聚焦 Reservoir Sampling 与 ReSTIR DI 基础 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：reservoir sampling / temporal/spatial reuse / many-light direct illumination。",
    ],
    status: "ready",
    mount: mountReservoirSamplingAndRestirDiFoundationsLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson145Source0,
        displaySegments: pickLessonSourceSegments(lesson145Source0),
        featured: true,
      },
      {
        id: "visualization-wgsl",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: lesson145Source1,
      },
    ],
  },
  {
    id: "146-temporal-reservoir-reuse-and-history-validation",
    order: 146,
    title: "Temporal Reservoir Reuse 与历史验证",
    tagline: "第 146 课：Temporal Reservoir Reuse 与历史验证",
    goal: "学习 Temporal Reservoir Reuse 与历史验证：validation error scope / GPUValidationError 捕获 / device lost 生命周期 / reservoir sampling。",
    summary:
      "本课聚焦 Temporal Reservoir Reuse 与历史验证 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：validation error scope / GPUValidationError 捕获 / device lost 生命周期 / reservoir sampling。",
    ],
    status: "ready",
    mount: mountTemporalReservoirReuseAndHistoryValidationLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson146Source0,
        displaySegments: pickLessonSourceSegments(lesson146Source0),
        featured: true,
      },
      {
        id: "visualization-wgsl",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: lesson146Source1,
      },
    ],
  },
  {
    id: "147-spatial-reservoir-reuse-and-neighborhood-resampling",
    order: 147,
    title: "Spatial Reservoir Reuse 与邻域重采样",
    tagline: "第 147 课：Spatial Reservoir Reuse 与邻域重采样",
    goal: "学习 Spatial Reservoir Reuse 与邻域重采样：reservoir sampling / temporal/spatial reuse / many-light direct illumination。",
    summary:
      "本课聚焦 Spatial Reservoir Reuse 与邻域重采样 的核心链路，重点观察 createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout 与 @vertex / @fragment / @group / @binding 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createBindGroup / getBindGroupLayout。",
      "WGSL / 数据流：@vertex / @fragment / @group / @binding。",
      "核心知识点：reservoir sampling / temporal/spatial reuse / many-light direct illumination。",
    ],
    status: "ready",
    mount: mountSpatialReservoirReuseAndNeighborhoodResamplingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson147Source0,
        displaySegments: pickLessonSourceSegments(lesson147Source0),
        featured: true,
      },
      {
        id: "visualization-wgsl",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: lesson147Source1,
      },
    ],
  },
  {
    id: "148-restir-di-and-many-lights-direct-lighting",
    order: 148,
    title: "ReSTIR DI 与多光源直射光",
    tagline: "第 148 课：ReSTIR DI 与多光源直射光",
    goal: "学习 ReSTIR DI 与多光源直射光：reservoir sampling / temporal/spatial reuse / many-light direct illumination。",
    summary:
      "本课聚焦 ReSTIR DI 与多光源直射光 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：reservoir sampling / temporal/spatial reuse / many-light direct illumination。",
    ],
    status: "ready",
    mount: mountRestirDiAndManyLightsDirectLightingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson148Source0,
        displaySegments: pickLessonSourceSegments(lesson148Source0),
        featured: true,
      },
      {
        id: "gpu-ts",
        filename: "gpu.ts",
        language: "ts",
        content: lesson148Source1,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson148Source2,
      },
      {
        id: "spatial-compute-wgsl",
        filename: "spatial.compute.wgsl",
        language: "wgsl",
        content: lesson148Source3,
      },
      {
        id: "temporal-compute-wgsl",
        filename: "temporal.compute.wgsl",
        language: "wgsl",
        content: lesson148Source4,
      },
      {
        id: "types-ts",
        filename: "types.ts",
        language: "ts",
        content: lesson148Source5,
      },
      {
        id: "view-ts",
        filename: "view.ts",
        language: "ts",
        content: lesson148Source6,
      },
    ],
  },
  {
    id: "149-restir-di-temporal-stabilization-and-entry-denoising",
    order: 149,
    title: "ReSTIR DI 的时域稳定化与入口级降噪",
    tagline: "第 149 课：ReSTIR DI 的时域稳定化与入口级降噪",
    goal: "学习 ReSTIR DI 的时域稳定化与入口级降噪：reservoir sampling / temporal/spatial reuse / many-light direct illumination。",
    summary:
      "本课聚焦 ReSTIR DI 的时域稳定化与入口级降噪 的核心链路，重点观察 createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup 与 @vertex / @fragment / @compute / @workgroup_size 如何共同驱动画面或 GPU 数据结果。",
    notes: [
      "WebGPU API：createShaderModule / createRenderPipeline / createComputePipeline / createBindGroup。",
      "WGSL / 数据流：@vertex / @fragment / @compute / @workgroup_size。",
      "核心知识点：reservoir sampling / temporal/spatial reuse / many-light direct illumination。",
    ],
    status: "ready",
    mount: mountRestirDiTemporalStabilizationAndEntryDenoisingLesson,
    sources: [
      {
        id: "lesson-ts",
        filename: "lesson.ts",
        language: "ts",
        content: lesson149Source0,
        displaySegments: pickLessonSourceSegments(lesson149Source0),
        featured: true,
      },
      {
        id: "accumulate-compute-wgsl",
        filename: "accumulate.compute.wgsl",
        language: "wgsl",
        content: lesson149Source1,
      },
      {
        id: "gpu-ts",
        filename: "gpu.ts",
        language: "ts",
        content: lesson149Source2,
      },
      {
        id: "present-wgsl",
        filename: "present.wgsl",
        language: "wgsl",
        content: lesson149Source3,
      },
      {
        id: "spatial-compute-wgsl",
        filename: "spatial.compute.wgsl",
        language: "wgsl",
        content: lesson149Source4,
      },
      {
        id: "temporal-compute-wgsl",
        filename: "temporal.compute.wgsl",
        language: "wgsl",
        content: lesson149Source5,
      },
      {
        id: "types-ts",
        filename: "types.ts",
        language: "ts",
        content: lesson149Source6,
      },
      {
        id: "view-ts",
        filename: "view.ts",
        language: "ts",
        content: lesson149Source7,
      },
    ],
  },
];
