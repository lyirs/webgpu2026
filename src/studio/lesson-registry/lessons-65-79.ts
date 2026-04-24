import type { LessonDefinition } from "@/studio/types";
import { pickCoreSourceSegments } from "@/studio/lesson-segments";
import motionVectorsLessonRuntimeSource from "@/lessons/lesson-65-motion-vectors-and-velocity-buffer/lesson.ts?raw";
import motionVectorsPresentShaderSource from "@/lessons/lesson-65-motion-vectors-and-velocity-buffer/present.wgsl?raw";
import motionVectorsSceneFragmentShaderSource from "@/lessons/lesson-65-motion-vectors-and-velocity-buffer/scene.frag.wgsl?raw";
import motionVectorsSceneVertexShaderSource from "@/lessons/lesson-65-motion-vectors-and-velocity-buffer/scene.vert.wgsl?raw";
import { mountMotionVectorsAndVelocityBufferLesson } from "@/lessons/lesson-65-motion-vectors-and-velocity-buffer/lesson";
import taaLessonRuntimeSource from "@/lessons/lesson-66-taa-and-history-reprojection/lesson.ts?raw";
import taaPresentShaderSource from "@/lessons/lesson-66-taa-and-history-reprojection/present.wgsl?raw";
import taaSceneFragmentShaderSource from "@/lessons/lesson-66-taa-and-history-reprojection/scene.frag.wgsl?raw";
import taaSceneVertexShaderSource from "@/lessons/lesson-66-taa-and-history-reprojection/scene.vert.wgsl?raw";
import taaShaderSource from "@/lessons/lesson-66-taa-and-history-reprojection/taa.wgsl?raw";
import { mountTaaAndHistoryReprojectionLesson } from "@/lessons/lesson-66-taa-and-history-reprojection/lesson";
import motionBlurLessonRuntimeSource from "@/lessons/lesson-67-motion-blur-and-shutter-integration/lesson.ts?raw";
import motionBlurPresentShaderSource from "@/lessons/lesson-67-motion-blur-and-shutter-integration/present.wgsl?raw";
import motionBlurSceneFragmentShaderSource from "@/lessons/lesson-67-motion-blur-and-shutter-integration/scene.frag.wgsl?raw";
import motionBlurSceneVertexShaderSource from "@/lessons/lesson-67-motion-blur-and-shutter-integration/scene.vert.wgsl?raw";
import { mountMotionBlurAndShutterIntegrationLesson } from "@/lessons/lesson-67-motion-blur-and-shutter-integration/lesson";
import ssrLessonRuntimeSource from "@/lessons/lesson-68-ssr-and-screen-space-reflections/lesson.ts?raw";
import ssrSceneFragmentShaderSource from "@/lessons/lesson-68-ssr-and-screen-space-reflections/scene.frag.wgsl?raw";
import ssrSceneVertexShaderSource from "@/lessons/lesson-68-ssr-and-screen-space-reflections/scene.vert.wgsl?raw";
import ssrShaderSource from "@/lessons/lesson-68-ssr-and-screen-space-reflections/ssr.wgsl?raw";
import { mountSsrAndScreenSpaceReflectionsLesson } from "@/lessons/lesson-68-ssr-and-screen-space-reflections/lesson";
import dofCocShaderSource from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/coc.wgsl?raw";
import dofLessonRuntimeSource from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/lesson.ts?raw";
import dofPresentShaderSource from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/present.wgsl?raw";
import dofSceneFragmentShaderSource from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/scene.frag.wgsl?raw";
import dofSceneVertexShaderSource from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/scene.vert.wgsl?raw";
import { mountDepthOfFieldAndCircleOfConfusionLesson } from "@/lessons/lesson-69-depth-of-field-and-circle-of-confusion/lesson";
import bilateralFiltersShaderSource from "@/lessons/lesson-70-bilateral-filtering-and-edge-aware-blur/filters.wgsl?raw";
import bilateralLessonRuntimeSource from "@/lessons/lesson-70-bilateral-filtering-and-edge-aware-blur/lesson.ts?raw";
import bilateralSceneFragmentShaderSource from "@/lessons/lesson-70-bilateral-filtering-and-edge-aware-blur/scene.frag.wgsl?raw";
import bilateralSceneVertexShaderSource from "@/lessons/lesson-70-bilateral-filtering-and-edge-aware-blur/scene.vert.wgsl?raw";
import { mountBilateralFilteringAndEdgeAwareBlurLesson } from "@/lessons/lesson-70-bilateral-filtering-and-edge-aware-blur/lesson";
import temporalAccumulationLessonRuntimeSource from "@/lessons/lesson-71-temporal-accumulation-and-disocclusion/lesson.ts?raw";
import temporalAccumulationSceneFragmentShaderSource from "@/lessons/lesson-71-temporal-accumulation-and-disocclusion/scene.frag.wgsl?raw";
import temporalAccumulationSceneVertexShaderSource from "@/lessons/lesson-71-temporal-accumulation-and-disocclusion/scene.vert.wgsl?raw";
import temporalAccumulationShaderSource from "@/lessons/lesson-71-temporal-accumulation-and-disocclusion/temporal.wgsl?raw";
import { mountTemporalAccumulationAndDisocclusionLesson } from "@/lessons/lesson-71-temporal-accumulation-and-disocclusion/lesson";
import ssgiLessonRuntimeSource from "@/lessons/lesson-72-ssgi-and-screen-space-indirect-light/lesson.ts?raw";
import ssgiSceneFragmentShaderSource from "@/lessons/lesson-72-ssgi-and-screen-space-indirect-light/scene.frag.wgsl?raw";
import ssgiSceneVertexShaderSource from "@/lessons/lesson-72-ssgi-and-screen-space-indirect-light/scene.vert.wgsl?raw";
import ssgiShaderSource from "@/lessons/lesson-72-ssgi-and-screen-space-indirect-light/ssgi.wgsl?raw";
import { mountSsgiAndScreenSpaceIndirectLightLesson } from "@/lessons/lesson-72-ssgi-and-screen-space-indirect-light/lesson";
import contactShadowLessonRuntimeSource from "@/lessons/lesson-73-contact-shadows-and-screen-space-shadows/lesson.ts?raw";
import contactShadowSceneFragmentShaderSource from "@/lessons/lesson-73-contact-shadows-and-screen-space-shadows/scene.frag.wgsl?raw";
import contactShadowSceneVertexShaderSource from "@/lessons/lesson-73-contact-shadows-and-screen-space-shadows/scene.vert.wgsl?raw";
import contactShadowShaderSource from "@/lessons/lesson-73-contact-shadows-and-screen-space-shadows/shadow.wgsl?raw";
import { mountContactShadowsAndScreenSpaceShadowsLesson } from "@/lessons/lesson-73-contact-shadows-and-screen-space-shadows/lesson";
import taauLessonRuntimeSource from "@/lessons/lesson-74-taau-and-dynamic-resolution/lesson.ts?raw";
import taauSceneFragmentShaderSource from "@/lessons/lesson-74-taau-and-dynamic-resolution/scene.frag.wgsl?raw";
import taauSceneVertexShaderSource from "@/lessons/lesson-74-taau-and-dynamic-resolution/scene.vert.wgsl?raw";
import taauShaderSource from "@/lessons/lesson-74-taau-and-dynamic-resolution/taau.wgsl?raw";
import { mountTaauAndDynamicResolutionLesson } from "@/lessons/lesson-74-taau-and-dynamic-resolution/lesson";
import pathTracingMathSource from "@/lessons/path-tracing-common/math.ts?raw";
import pathTracingSamplingSource from "@/lessons/path-tracing-common/sampling.ts?raw";
import pathTracingSceneSource from "@/lessons/path-tracing-common/scene.ts?raw";
import blueNoiseLessonRuntimeSource from "@/lessons/lesson-75-blue-noise-and-sampling-patterns/lesson.ts?raw";
import { mountBlueNoiseAndSamplingPatternsLesson } from "@/lessons/lesson-75-blue-noise-and-sampling-patterns/lesson";
import monteCarloLessonRuntimeSource from "@/lessons/lesson-76-monte-carlo-integration-and-hemisphere-sampling/lesson.ts?raw";
import { mountMonteCarloIntegrationAndHemisphereSamplingLesson } from "@/lessons/lesson-76-monte-carlo-integration-and-hemisphere-sampling/lesson";
import importanceSamplingLessonRuntimeSource from "@/lessons/lesson-77-brdf-importance-sampling/lesson.ts?raw";
import { mountBrdfImportanceSamplingLesson } from "@/lessons/lesson-77-brdf-importance-sampling/lesson";
import computePathTracingLessonRuntimeSource from "@/lessons/lesson-78-compute-path-tracing-foundations/lesson.ts?raw";
import computePathTracingPathTraceShaderSource from "@/lessons/lesson-78-compute-path-tracing-foundations/path-trace.wgsl?raw";
import computePathTracingPresentShaderSource from "@/lessons/lesson-78-compute-path-tracing-foundations/present.wgsl?raw";
import computePathTracingSceneFragmentShaderSource from "@/lessons/lesson-78-compute-path-tracing-foundations/scene.frag.wgsl?raw";
import computePathTracingSceneVertexShaderSource from "@/lessons/lesson-78-compute-path-tracing-foundations/scene.vert.wgsl?raw";
import { mountComputePathTracingFoundationsLesson } from "@/lessons/lesson-78-compute-path-tracing-foundations/lesson";
import progressiveAccumulationLessonRuntimeSource from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/lesson.ts?raw";
import progressiveAccumulationPathTraceShaderSource from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/path-trace.wgsl?raw";
import progressiveAccumulationPresentShaderSource from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/present.wgsl?raw";
import progressiveAccumulationSceneFragmentShaderSource from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/scene.frag.wgsl?raw";
import progressiveAccumulationSceneVertexShaderSource from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/scene.vert.wgsl?raw";
import { mountProgressiveAccumulationAndDenoisingEntryLesson } from "@/lessons/lesson-79-progressive-accumulation-and-denoising-entry/lesson";

export const lessons65To79: LessonDefinition[] = [
{
    id: "65-motion-vectors-and-velocity-buffer",
    order: 65,
    title: "Motion Vectors 与 Velocity Buffer",
    tagline: "把物体运动与相机运动编码成可重投影的屏幕空间速度",
    goal: "先单独讲清楚 motion vectors 从哪里来、为什么需要同时考虑当前帧与上一帧的 clip-space 位置，以及 velocity buffer 会被后续哪些时间域与屏幕空间效果复用。",
    summary:
      "这一课会把场景颜色和 velocity buffer 并排可视化：左侧看正常场景，右侧直接显示屏幕空间速度方向与强度，让学习者先建立“像素从哪里移动到哪里”的概念，再为 TAA、motion blur 和 reprojection 打基础。",
    notes: [
      "`当前帧 vs 上一帧`：motion vector 不是只看物体位移，而是要比较同一个点在两帧里的投影结果。",
      "`物体运动 + 相机运动`：就算模型不动，只要相机动了，velocity buffer 里同样会出现速度。",
      "`velocity buffer`：它本身不是最终效果，而是后续 TAA、motion blur、reprojection 的基础输入。",
      "`先做可视化`：这一课先把速度看清楚，不急着立刻做时间域混合。",
    ],
    status: "ready",
    mount: mountMotionVectorsAndVelocityBufferLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: motionVectorsLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(motionVectorsLessonRuntimeSource, [
          [1, 174],
          [175, 338],
          [339, 608],
          [609, 784],
          [785, 923],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: motionVectorsSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: motionVectorsSceneFragmentShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: motionVectorsPresentShaderSource,
      },
    ],
  },
{
    id: "66-taa-and-history-reprojection",
    order: 66,
    title: "TAA 与历史重投影",
    tagline: "把上一帧颜色重投影回来，建立时间域抗锯齿的最小闭环",
    goal: "在已经有 velocity buffer 的前提下，讲清楚 history buffer、reprojection、jitter 和 neighborhood clamp 的关系，让学习者知道 TAA 为什么既能变稳也会拖影。",
    summary:
      "这一课会把“当前帧原始结果”和“带历史重投影的 TAA 结果”放在左右对照里，同时开放 jitter、history blend 和 clamp 强度，让时间域抗锯齿的收益与副作用都能被直接观察到。",
    notes: [
      "`history buffer`：TAA 的关键不是简单 blur，而是把上一帧的颜色重投影回当前帧继续利用。",
      "`jitter`：没有亚像素抖动，就没有足够的新采样信息去让时间域真的补细节。",
      "`reprojection`：velocity buffer 会告诉我们该去历史帧的哪里取样。",
      "`稳定与拖影的平衡`：history blend 太强会拖影，太弱又看不出时间域收益。",
    ],
    status: "ready",
    mount: mountTaaAndHistoryReprojectionLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: taaLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(taaLessonRuntimeSource, [
          [1, 155],
          [156, 330],
          [331, 566],
          [567, 797],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: taaSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: taaSceneFragmentShaderSource,
      },
      {
        id: "taa-shader",
        filename: "taa.wgsl",
        language: "wgsl",
        content: taaShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: taaPresentShaderSource,
      },
    ],
  },
{
    id: "67-motion-blur-and-shutter-integration",
    order: 67,
    title: "Motion Blur 与快门积分",
    tagline: "沿 velocity 方向积累采样，把时间运动转成可控的拖影",
    goal: "基于前两课的 velocity buffer，单独讲清楚 motion blur 的采样方向、快门长度、前景背景分离问题，以及为什么它和单纯的方向 blur 不是一回事。",
    summary:
      "这一课会直接复用 velocity buffer：左侧保持锐利原图，右侧沿速度方向做快门积分式的 motion blur，并用不同速度强度与样本数展示“拖影来自时间，而不是来自一层普通模糊”。",
    notes: [
      "`快门长度`：blur 的长度本质上代表曝光期间物体在屏幕上移动了多少。",
      "`沿 velocity 采样`：motion blur 的方向由速度决定，而不是固定的水平或垂直卷积。",
      "`前景/背景穿插`：速度不连续的边界最容易出错，这也是 motion blur 难点之一。",
      "`和 TAA 复用输入`：这节课会直接继续吃上一课的 velocity buffer。",
    ],
    status: "ready",
    mount: mountMotionBlurAndShutterIntegrationLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: motionBlurLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(motionBlurLessonRuntimeSource, [
          [1, 149],
          [150, 320],
          [321, 548],
          [549, 758],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: motionBlurSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: motionBlurSceneFragmentShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: motionBlurPresentShaderSource,
      },
    ],
  },
{
    id: "68-ssr-and-screen-space-reflections",
    order: 68,
    title: "SSR 与屏幕空间反射",
    tagline: "从 G-buffer 与屏幕深度出发，做一条可视化的反射射线",
    goal: "把 screen-space reflections 的最小可行链路讲清楚：反射方向、屏幕空间步进、深度命中、厚度容差，以及为什么 SSR 天生只能看到屏幕内已有的信息。",
    summary:
      "这一课会在已有的 deferred / G-buffer 基础上增加 SSR 对照：左侧只看基础环境反射，右侧沿屏幕空间射线做命中测试并把命中结果混回材质，让 SSR 的优势和屏幕空间局限一起被看清楚。",
    notes: [
      "`screen-space`：SSR 不是全局反射，它只能利用当前屏幕里已经渲出来的东西。",
      "`ray march`：会沿反射方向在屏幕空间里逐步前进，并用深度去判断是否命中。",
      "`厚度与步长`：命中判断太松会漏光，太紧又容易错过反射面。",
      "`边界与缺失`：一旦反射目标跑出屏幕，SSR 就会天然失去信息。",
    ],
    status: "ready",
    mount: mountSsrAndScreenSpaceReflectionsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: ssrLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(ssrLessonRuntimeSource, [
          [1, 148],
          [149, 305],
          [306, 521],
          [522, 696],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: ssrSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: ssrSceneFragmentShaderSource,
      },
      {
        id: "ssr-shader",
        filename: "ssr.wgsl",
        language: "wgsl",
        content: ssrShaderSource,
      },
    ],
  },
{
    id: "69-depth-of-field-and-circle-of-confusion",
    order: 69,
    title: "景深与 Circle of Confusion",
    tagline: "把焦点、前后景模糊半径和 CoC 可视化讲透",
    goal: "收束这一批屏幕空间与时间重建线：先把 Circle of Confusion 的几何意义讲清楚，再把远景和近景模糊与焦平面联系起来，让景深不只是“再做一次 blur”。",
    summary:
      "这一课会把焦平面、CoC 可视化和最终景深结果并列展示：左侧看原图，中间看 CoC 分布，右侧看合成后的景深效果，让学习者看懂为什么焦点附近清晰、前景和背景会以不同方式虚化。",
    notes: [
      "`Circle of Confusion`：景深不是统一模糊，而是每个像素都先有自己的模糊半径。",
      "`焦平面`：只有接近焦点的区域 CoC 才会收缩到接近零。",
      "`前景 vs 背景`：前景散焦和背景散焦在遮挡关系上会表现得不一样。",
      "`这一批的收束`：从 velocity、TAA、motion blur、SSR 到 DoF，这条线完整覆盖了常见的现代屏幕空间与时间域后效。",
    ],
    status: "ready",
    mount: mountDepthOfFieldAndCircleOfConfusionLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: dofLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(dofLessonRuntimeSource, [
          [1, 158],
          [159, 318],
          [319, 558],
          [559, 789],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: dofSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: dofSceneFragmentShaderSource,
      },
      {
        id: "coc-shader",
        filename: "coc.wgsl",
        language: "wgsl",
        content: dofCocShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: dofPresentShaderSource,
      },
    ],
  },
{
    id: "70-bilateral-filtering-and-edge-aware-blur",
    order: 70,
    title: "双边滤波与 Edge-aware Blur",
    tagline: "先看清普通 blur 为什么会糊边，再理解 depth / normal aware 的保边逻辑",
    goal: "把 noisy scalar field、普通 blur 和 edge-aware blur 放在同一块画布里直接对照，让学习者先建立“降噪”和“保边”不是一回事的直觉，再为后面的 screen-space denoise 线打底。",
    summary:
      "这一课会先在角落与台阶场景里生成一张 noisy scalar field：左栏直接看 raw noisy input，中栏只做 plain blur，右栏再加上 depth 和 normal aware 权重，让“为什么普通 blur 会糊穿边界、而 edge-aware blur 会保边”被一眼看出来。",
    notes: [
      "`raw noisy input`：先把目标信号做出来，再故意暴露噪声，才能看清后面的 filter 在解决什么问题。",
      "`plain blur`：它能降噪，但不会理解几何边界，所以最容易把角落和台阶一起抹宽。",
      "`edge-aware`：混合时额外参考 depth 与 normal，只让同表面内的噪声更愿意彼此平均。",
      "`这是后面所有 denoise 课的基础`：不先看清保边 blur，后面的 temporal 和 screen-space 重建很容易只剩“效果调参”。",
    ],
    status: "ready",
    mount: mountBilateralFilteringAndEdgeAwareBlurLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: bilateralLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(bilateralLessonRuntimeSource, [
          [1, 180],
          [181, 360],
          [361, 570],
          [571, 857],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: bilateralSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: bilateralSceneFragmentShaderSource,
      },
      {
        id: "filters-shader",
        filename: "filters.wgsl",
        language: "wgsl",
        content: bilateralFiltersShaderSource,
      },
    ],
  },
{
    id: "71-temporal-accumulation-and-disocclusion",
    order: 71,
    title: "Temporal Accumulation 与 Disocclusion",
    tagline: "让 history 参与稳定之前，先看清什么时候它已经失效了",
    goal: "把 current frame、naive temporal accumulation 和 disocclusion-aware accumulation 并列起来，先建立“history 不是越多越好，关键是何时该扔”的基本判断。",
    summary:
      "这一课会用前景遮挡板横穿高频背景的场景来放大 temporal accumulation 的问题：左栏永远看当前帧，中栏继续盲目累积 history，右栏再用最小 rejection / disocclusion 规则把刚暴露出来的区域更快拉回当前帧。",
    notes: [
      "`naive accumulation`：只要 history blend 够高，遮挡刚移开的背景就会被上一帧的旧颜色继续拖脏。",
      "`disocclusion`：真正难的不是“有没有 history”，而是判断当前这个历史样本是不是还值得信。",
      "`rejection threshold`：当前帧和 history 差得太大时，右栏会更主动地丢掉旧信息。",
      "`这是 TAA / TAAU 的前置心理模型`：后面所有时间重建都绕不开 history lifecycle。",
    ],
    status: "ready",
    mount: mountTemporalAccumulationAndDisocclusionLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: temporalAccumulationLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(temporalAccumulationLessonRuntimeSource, [
          [1, 150],
          [151, 310],
          [311, 530],
          [531, 714],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: temporalAccumulationSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: temporalAccumulationSceneFragmentShaderSource,
      },
      {
        id: "temporal-shader",
        filename: "temporal.wgsl",
        language: "wgsl",
        content: temporalAccumulationShaderSource,
      },
    ],
  },
{
    id: "72-ssgi-and-screen-space-indirect-light",
    order: 72,
    title: "SSGI 与屏幕空间间接光",
    tagline: "把当前帧已有颜色当成 bounce 来源，做一版可观察的屏幕空间间接光",
    goal: "在已经理解 SSR 与 SSAO 的基础上，再把 ray march 推进到“屏幕空间间接漫反射”这个方向，让学习者看到 SSGI 的收益和屏幕信息边界同时存在。",
    summary:
      "这一课会用 emissive panel + 彩色墙面的室内场景做左右对照：左栏只保留基础环境光，右栏再沿屏幕空间射线寻找当前帧颜色命中，把近似 bounce 混回场景，让彩色墙与发光面附近出现可见间接染色。",
    notes: [
      "`screen-space indirect light`：SSGI 不是完整 GI，而是把当前屏幕里已经渲出来的颜色再拿来做一次近似 bounce。",
      "`ray march / hit / fallback`：命中就拿当前帧颜色做间接光，没命中或越界就只能退回到更保守的环境项。",
      "`彩色染色`：最容易观察的位置通常不是正对光源的地方，而是靠近彩色墙面和发光面的邻近区域。",
      "`边界问题依旧存在`：和 SSR 一样，一旦信息不在屏幕里，SSGI 也没法凭空补出来。",
    ],
    status: "ready",
    mount: mountSsgiAndScreenSpaceIndirectLightLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: ssgiLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(ssgiLessonRuntimeSource, [
          [1, 140],
          [141, 300],
          [301, 440],
          [441, 588],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: ssgiSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: ssgiSceneFragmentShaderSource,
      },
      {
        id: "ssgi-shader",
        filename: "ssgi.wgsl",
        language: "wgsl",
        content: ssgiShaderSource,
      },
    ],
  },
{
    id: "73-contact-shadows-and-screen-space-shadows",
    order: 73,
    title: "Contact Shadows 与屏幕空间阴影",
    tagline: "不改主阴影链，只把最贴近接触点的那一圈暗部补回来",
    goal: "把接触阴影单独拆出来讲：为什么它只应该增强近距离遮挡、为什么不能把它拉成整片大阴影，以及 screen-space ray march 在这里到底补了什么。",
    summary:
      "这一课会用悬浮物体、地面与掠射光做左右对照：左栏只有基础光照，右栏则沿主光方向在屏幕空间里估计近距离遮挡，把最贴近接触处的小尺度阴影补出来。",
    notes: [
      "`contact shadows`：它的任务不是替代主阴影，而是专门补“非常近但主阴影分辨率不够”的那一圈暗部。",
      "`screen-space ray`：从当前像素沿光方向往外探，只要很快撞上周围深度，就说明这里该更暗一点。",
      "`ray length / thickness`：拉太长会从接触阴影变成整片脏影，阈值太松又会开始误判。",
      "`只补局部，不重做整套阴影`：这是它在工程上最有价值的地方。",
    ],
    status: "ready",
    mount: mountContactShadowsAndScreenSpaceShadowsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: contactShadowLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(contactShadowLessonRuntimeSource, [
          [1, 140],
          [141, 300],
          [301, 450],
          [451, 590],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: contactShadowSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: contactShadowSceneFragmentShaderSource,
      },
      {
        id: "shadow-shader",
        filename: "shadow.wgsl",
        language: "wgsl",
        content: contactShadowShaderSource,
      },
    ],
  },
{
    id: "74-taau-and-dynamic-resolution",
    order: 74,
    title: "TAAU 与 Dynamic Resolution",
    tagline: "把低分辨率渲染和历史重建真正接成一条现代上采样链",
    goal: "在已经理解 TAA 和 temporal accumulation 的前提下，再把“低分辨率当前帧 + 高分辨率 history”这条现代上采样思路讲清楚，让 render scale、history reuse 和 upscale quality 的关系都落到画面里。",
    summary:
      "这一课会把高频细节场景先降到低分辨率渲染：左栏只做 naive upscale，右栏则用 velocity 和 history 继续做 TAAU，让“低分辨率当前帧如何借时间重建高分辨率结果”被直接观察到。",
    notes: [
      "`render scale`：真正下降的是内部渲染分辨率，不是显示分辨率；这也是 dynamic resolution 的核心自由度。",
      "`naive upscale vs TAAU`：左栏只能把低分辨率当前帧放大，右栏则会继续把历史高分辨率结果重投影回来。",
      "`freeze camera`：冻结相机以后，右栏会继续时间收敛，而左栏只会停留在单帧放大的状态。",
      "`这是这批课的收束`：它把 velocity、history、reprojection 和 upscale 真正接成了一条现代 reconstruction 链。",
    ],
    status: "ready",
    mount: mountTaauAndDynamicResolutionLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: taauLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(taauLessonRuntimeSource, [
          [1, 160],
          [161, 330],
          [331, 520],
          [521, 713],
        ]),
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: taauSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: taauSceneFragmentShaderSource,
      },
      {
        id: "taau-shader",
        filename: "taau.wgsl",
        language: "wgsl",
        content: taauShaderSource,
      },
    ],
  },
{
    id: "75-blue-noise-and-sampling-patterns",
    order: 75,
    title: "Blue Noise 与采样模式",
    tagline: "先看清采样分布本身，再看它怎样决定后面的 stochastic noise 长什么样",
    goal: "用 white noise、stratified jitter 和 blue-noise-like 三栏对照，把“同样的样本预算，分布方式就会决定你看到的噪声类型”这件事先讲清楚。",
    summary:
      "这一课把采样点分布和由同一组样本驱动的软阴影估计放在一起看：左栏是最容易聚团的 white noise，中栏是先铺格再抖动的 stratified jitter，右栏则用 best-candidate 近似 blue-noise-like pattern。",
    notes: [
      "`white noise`：完全独立随机，最容易留下聚团和空洞，所以面积平均结果也最像“颗粒化的偶然命中”。",
      "`stratified jitter`：先把区域切格再抖动，均匀性会立刻改善，但规则结构也会一起留下来。",
      "`blue-noise-like pattern`：重点不是绝对平均，而是尽量避免样本彼此挤太近，所以聚团最少。",
      "`先理解分布，再理解渲染噪声`：后面的 Monte Carlo、importance sampling 和 path tracing 都会回到这里。",
    ],
    status: "ready",
    mount: mountBlueNoiseAndSamplingPatternsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: blueNoiseLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(blueNoiseLessonRuntimeSource, [
          [1, 120],
          [121, 240],
          [241, 520],
        ]),
      },
      {
        id: "sampling-helper",
        filename: "sampling.ts",
        language: "ts",
        content: pathTracingSamplingSource,
      },
    ],
  },
{
    id: "76-monte-carlo-integration-and-hemisphere-sampling",
    order: 76,
    title: "Monte Carlo 积分与半球采样",
    tagline: "单帧 noisy estimate 会抖，但 running average 会真的向积分值收敛",
    goal: "先建立 Monte Carlo 积分最基础的心理模型：当前帧只是 noisy estimate，真正有意义的是在足够多帧之后它会不会朝 reference 靠近。",
    summary:
      "这一课把半球采样方向、当前帧估计和 running average 并排画出来：左栏看这一帧究竟抽到了哪些方向，中栏只显示当前帧 Monte Carlo 估计，右栏则继续累积历史并与高样本 reference 对照。",
    notes: [
      "`estimator / variance / convergence`：这节课只谈这三件事，不急着把 BRDF 和 path tracer 一次性都塞进来。",
      "`uniform hemisphere sampling`：每个方向被抽到的概率一致，所以简单，但会把大量预算花在低贡献方向上。",
      "`running average`：单帧 noisy 很正常，只要估计无偏，长时间平均才是它真正的答案。",
      "`这是 importance sampling 之前的前置课`：先知道随机积分为什么会收敛，再谈如何让它更快收敛。",
    ],
    status: "ready",
    mount: mountMonteCarloIntegrationAndHemisphereSamplingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: monteCarloLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(monteCarloLessonRuntimeSource, [
          [1, 120],
          [121, 250],
          [251, 560],
        ]),
      },
      {
        id: "sampling-helper",
        filename: "sampling.ts",
        language: "ts",
        content: pathTracingSamplingSource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: pathTracingMathSource,
      },
    ],
  },
{
    id: "77-brdf-importance-sampling",
    order: 77,
    title: "BRDF Importance Sampling",
    tagline: "采样不是越随机越好，而是越贴近高贡献方向越值钱",
    goal: "把 76 课的积分模型推进到“采样应该匹配被积函数”这一层，用 uniform hemisphere 与 GGX importance sampling 对照解释为什么同样预算下方差会差很多。",
    summary:
      "这一课会把同一份 glossy 环境积分拆成左右两栏：左栏仍然 uniform hemisphere，右栏改成 GGX importance sample，并把 sample lobe、roughness 和当前亮度估计直接画出来。",
    notes: [
      "`importance sampling`：不是魔法，而是把样本分布往真正高贡献的方向推过去。",
      "`GGX lobe`：roughness 越低，高光越尖，uniform 采样浪费在无效方向上的样本也就越多。",
      "`同样 sample budget 下看方差`：右栏更稳，不是因为它“更高分辨率”，而是因为它更少把样本浪费掉。",
      "`这是 path tracing 之前最后一课`：接下来就会把 sampling 真正塞进路径追踪主循环里。",
    ],
    status: "ready",
    mount: mountBrdfImportanceSamplingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: importanceSamplingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(importanceSamplingLessonRuntimeSource, [
          [1, 140],
          [141, 280],
          [281, 560],
        ]),
      },
      {
        id: "sampling-helper",
        filename: "sampling.ts",
        language: "ts",
        content: pathTracingSamplingSource,
      },
      {
        id: "math-helper",
        filename: "math.ts",
        language: "ts",
        content: pathTracingMathSource,
      },
    ],
  },
{
    id: "78-compute-path-tracing-foundations",
    order: 78,
    title: "Compute Path Tracing 基础",
    tagline: "第一次把随机采样真正塞进路径主循环，让间接光开始出现在画面里",
    goal: "讲清楚最小 compute path tracing 闭环：ray generation、analytic hit、diffuse bounce、emissive contribution 和 noisy 单帧输出，而不是一上来就堆 BVH 和复杂加速结构。",
    summary:
      "这一课会在简化 Cornell room 里做左右对照：左栏保留 raster direct-light reference，右栏则只用 1 spp compute path tracing 去画同一场景，让 bounce light 和 color bleeding 第一次以 noisy 的形式出现在画面里。",
    notes: [
      "`1 spp`：这节课故意不做 accumulation，就是为了让 stochastic 输入本身暴露出来。",
      "`analytic Cornell room`：全部用解析 AABB 场景求交，不引入 BVH、MIS 或 Russian roulette。",
      "`diffuse bounce`：真正让右栏开始和左栏分开的，不是 emissive 本身，而是 bounce 以后出现的间接染色倾向。",
      "`下一课会继续接 accumulation`：因为路径追踪真正可用，离不开把 noisy current sample 慢慢积起来。",
    ],
    status: "ready",
    mount: mountComputePathTracingFoundationsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: computePathTracingLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(computePathTracingLessonRuntimeSource, [
          [1, 170],
          [171, 360],
          [361, 760],
        ]),
      },
      {
        id: "common-scene",
        filename: "scene.ts",
        language: "ts",
        content: pathTracingSceneSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: computePathTracingSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: computePathTracingSceneFragmentShaderSource,
      },
      {
        id: "path-trace-shader",
        filename: "path-trace.wgsl",
        language: "wgsl",
        content: computePathTracingPathTraceShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: computePathTracingPresentShaderSource,
      },
    ],
  },
{
    id: "79-progressive-accumulation-and-denoising-entry",
    order: 79,
    title: "Progressive Accumulation 与去噪入口",
    tagline: "让 noisy 路径追踪开始变得可用：先积，再用 normal/depth 做入口级 denoise",
    goal: "用 78 课的同一套 compute path tracer 收束这一批：左栏保留 current sample，中栏只做 progressive accumulation，右栏再叠一层 cross-bilateral denoise，让“可用性为什么离不开 accumulation”这件事落到画面里。",
    summary:
      "这一课复用同一间简化 Cornell room，但不再停留在 noisy 单帧：左栏看当前 sample，中栏继续积累历史，右栏再在 accumulation 基础上参考 normal/depth 做入口级 denoise，直接把“路径追踪为什么要继续接 reconstruction”讲清楚。",
    notes: [
      "`current sample`：左栏始终是路径追踪这一帧真正交出来的原始 noisy 输入。",
      "`progressive accumulation`：中栏先把方差用时间平均掉，这一步本身就比“直接上去噪”更关键。",
      "`cross-bilateral denoise`：右栏不是跳过 accumulation，而是在 accumulation 已经开始收敛之后再做保边清理。",
      "`这批课在这里收束`：前面讲过的 temporal accumulation 与 edge-aware filtering，现在第一次真正开始服务 stochastic rendering。",
    ],
    status: "ready",
    mount: mountProgressiveAccumulationAndDenoisingEntryLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: progressiveAccumulationLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(progressiveAccumulationLessonRuntimeSource, [
          [1, 180],
          [181, 380],
          [381, 860],
        ]),
      },
      {
        id: "common-scene",
        filename: "scene.ts",
        language: "ts",
        content: pathTracingSceneSource,
      },
      {
        id: "scene-vertex-shader",
        filename: "scene.vert.wgsl",
        language: "wgsl",
        content: progressiveAccumulationSceneVertexShaderSource,
      },
      {
        id: "scene-fragment-shader",
        filename: "scene.frag.wgsl",
        language: "wgsl",
        content: progressiveAccumulationSceneFragmentShaderSource,
      },
      {
        id: "path-trace-shader",
        filename: "path-trace.wgsl",
        language: "wgsl",
        content: progressiveAccumulationPathTraceShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: progressiveAccumulationPresentShaderSource,
      },
    ],
  }
];
