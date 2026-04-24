import type { LessonDefinition } from "@/studio/types";
import { pickCoreSourceSegments } from "@/studio/lesson-segments";
import pathTracingBvhSource from "@/lessons/path-tracing-common/bvh.ts?raw";
import pathTracingMathSource from "@/lessons/path-tracing-common/math.ts?raw";
import pathTracingReservoirSource from "@/lessons/path-tracing-common/reservoir.ts?raw";
import pathTracingSamplingSource from "@/lessons/path-tracing-common/sampling.ts?raw";
import pathTracingSceneSource from "@/lessons/path-tracing-common/scene.ts?raw";
import bvhAccelerationLessonRuntimeSource from "@/lessons/lesson-80-bvh-and-path-tracing-acceleration-structures/lesson.ts?raw";
import bvhAccelerationVisualizationShaderSource from "@/lessons/lesson-80-bvh-and-path-tracing-acceleration-structures/visualization.wgsl?raw";
import { mountBvhAndPathTracingAccelerationStructuresLesson } from "@/lessons/lesson-80-bvh-and-path-tracing-acceleration-structures/lesson";
import nextEventLessonRuntimeSource from "@/lessons/lesson-81-next-event-estimation-and-explicit-light-sampling/lesson.ts?raw";
import nextEventVisualizationShaderSource from "@/lessons/lesson-81-next-event-estimation-and-explicit-light-sampling/visualization.wgsl?raw";
import { mountNextEventEstimationAndExplicitLightSamplingLesson } from "@/lessons/lesson-81-next-event-estimation-and-explicit-light-sampling/lesson";
import misLessonRuntimeSource from "@/lessons/lesson-82-multiple-importance-sampling/lesson.ts?raw";
import misVisualizationShaderSource from "@/lessons/lesson-82-multiple-importance-sampling/visualization.wgsl?raw";
import { mountMultipleImportanceSamplingLesson } from "@/lessons/lesson-82-multiple-importance-sampling/lesson";
import russianRouletteLessonRuntimeSource from "@/lessons/lesson-83-russian-roulette-and-throughput-management/lesson.ts?raw";
import russianRouletteVisualizationShaderSource from "@/lessons/lesson-83-russian-roulette-and-throughput-management/visualization.wgsl?raw";
import { mountRussianRouletteAndThroughputManagementLesson } from "@/lessons/lesson-83-russian-roulette-and-throughput-management/lesson";
import temporalStabilizationLessonRuntimeSource from "@/lessons/lesson-84-real-time-path-traced-direct-lighting-and-temporal-stabilization/lesson.ts?raw";
import temporalStabilizationAccumulationShaderSource from "@/lessons/lesson-84-real-time-path-traced-direct-lighting-and-temporal-stabilization/accumulate.compute.wgsl?raw";
import temporalStabilizationPresentShaderSource from "@/lessons/lesson-84-real-time-path-traced-direct-lighting-and-temporal-stabilization/present.wgsl?raw";
import { mountRealTimePathTracedDirectLightingAndTemporalStabilizationLesson } from "@/lessons/lesson-84-real-time-path-traced-direct-lighting-and-temporal-stabilization/lesson";
import restirFoundationsLessonRuntimeSource from "@/lessons/lesson-85-reservoir-sampling-and-restir-di-foundations/lesson.ts?raw";
import restirFoundationsVisualizationShaderSource from "@/lessons/lesson-85-reservoir-sampling-and-restir-di-foundations/visualization.wgsl?raw";
import { mountReservoirSamplingAndRestirDiFoundationsLesson } from "@/lessons/lesson-85-reservoir-sampling-and-restir-di-foundations/lesson";
import temporalReservoirLessonRuntimeSource from "@/lessons/lesson-86-temporal-reservoir-reuse-and-history-validation/lesson.ts?raw";
import temporalReservoirVisualizationShaderSource from "@/lessons/lesson-86-temporal-reservoir-reuse-and-history-validation/visualization.wgsl?raw";
import { mountTemporalReservoirReuseAndHistoryValidationLesson } from "@/lessons/lesson-86-temporal-reservoir-reuse-and-history-validation/lesson";
import spatialReservoirLessonRuntimeSource from "@/lessons/lesson-87-spatial-reservoir-reuse-and-neighborhood-resampling/lesson.ts?raw";
import spatialReservoirVisualizationShaderSource from "@/lessons/lesson-87-spatial-reservoir-reuse-and-neighborhood-resampling/visualization.wgsl?raw";
import { mountSpatialReservoirReuseAndNeighborhoodResamplingLesson } from "@/lessons/lesson-87-spatial-reservoir-reuse-and-neighborhood-resampling/lesson";
import restirDiLessonRuntimeSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/lesson.ts?raw";
import restirDiGpuSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/gpu.ts?raw";
import restirDiTypesSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/types.ts?raw";
import restirDiViewSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/view.ts?raw";
import restirDiTemporalComputeShaderSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/temporal.compute.wgsl?raw";
import restirDiSpatialComputeShaderSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/spatial.compute.wgsl?raw";
import restirDiPresentShaderSource from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/present.wgsl?raw";
import { mountRestirDiAndManyLightsDirectLightingLesson } from "@/lessons/lesson-88-restir-di-and-many-lights-direct-lighting/lesson";
import restirStabilizationLessonRuntimeSource from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/lesson.ts?raw";
import restirStabilizationGpuSource from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/gpu.ts?raw";
import restirStabilizationTypesSource from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/types.ts?raw";
import restirStabilizationViewSource from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/view.ts?raw";
import restirStabilizationTemporalComputeShaderSource from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/temporal.compute.wgsl?raw";
import restirStabilizationSpatialComputeShaderSource from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/spatial.compute.wgsl?raw";
import restirStabilizationAccumulationComputeShaderSource from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/accumulate.compute.wgsl?raw";
import restirStabilizationPresentShaderSource from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/present.wgsl?raw";
import { mountRestirDiTemporalStabilizationAndEntryDenoisingLesson } from "@/lessons/lesson-89-restir-di-temporal-stabilization-and-entry-denoising/lesson";

export const lessons80To89: LessonDefinition[] = [
{
    id: "80-bvh-and-path-tracing-acceleration-structures",
    order: 80,
    title: "BVH 与路径追踪加速结构",
    tagline: "画面不该变，真正变的是每条 ray 到底白跑了多少测试",
    goal: "先把 acceleration structure 的价值单独讲清楚：同一间房、同一批 primitive、同样的可见结果，为什么 brute-force 和 BVH 的 traversal 成本会完全不是一个量级。",
    summary:
      "这一课会把同一间 dense Cornell-room 风格房间放成左右对照：左栏保持 brute-force 遍历，右栏改成 BVH traversal，并把 tests per ray、node visits 和 leaf depth tint 直接显示出来。",
    notes: [
      "`same image, different cost`：这节课不追求更花的画面，而是刻意让左右图像一致，差别只留在 traversal 成本上。",
      "`BVH`：先过 bounds，再决定有没有必要进叶子；它的价值本质上就是减少“明知不可能命中还要试”的次数。",
      "`primitive count`：数量越多，brute-force 增长越直接；BVH 不是免费，但能让增长速度变慢很多。",
      "`这是 NEE / MIS / RR 之前的前置课`：先把“怎么更快找到 hit”解决，再谈“找到 hit 以后怎样更聪明地采样”。",
    ],
    status: "ready",
    mount: mountBvhAndPathTracingAccelerationStructuresLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: bvhAccelerationLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(bvhAccelerationLessonRuntimeSource, [
          [1, 130],
          [131, 260],
          [261, 367],
        ]),
      },
      {
        id: "visualization-shader",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: bvhAccelerationVisualizationShaderSource,
      },
      {
        id: "bvh-helper",
        filename: "bvh.ts",
        language: "ts",
        content: pathTracingBvhSource,
      },
      {
        id: "common-scene",
        filename: "scene.ts",
        language: "ts",
        content: pathTracingSceneSource,
      },
    ],
  },
{
    id: "81-next-event-estimation-and-explicit-light-sampling",
    order: 81,
    title: "Next Event Estimation 与显式采样光源",
    tagline: "别等随机路径自己撞灯，直接去采那盏灯",
    goal: "把“只有打到发光体才亮”推进到显式采样光源：让学习者直接看到，同样 sample budget 下 direct light 噪声为什么会因为主动 sample 光源而大幅下降。",
    summary:
      "这一课会用一条 receiver strip 做左右对照：左栏仍然等随机路径自己撞上小光源，右栏则对同一条 strip 显式 sample 光源并发 shadow ray，所以 direct-light 结果会稳定很多。",
    notes: [
      "`emissive hit only`：左栏不是错，只是把大量样本浪费在“根本碰不到小光源”的方向上。",
      "`shadow ray`：右栏的关键不是更亮，而是每次都主动问一次“这盏灯现在看得见吗”。",
      "`小光源越小，NEE 越值钱`：因为随机路径自己撞上它的概率会掉得更快。",
      "`这节课只讲 NEE`：MIS 还没进来，所以这里故意不把 BRDF sampling 和 light sampling 混在一起。",
    ],
    status: "ready",
    mount: mountNextEventEstimationAndExplicitLightSamplingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: nextEventLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(nextEventLessonRuntimeSource, [
          [1, 130],
          [131, 260],
          [261, 371],
        ]),
      },
      {
        id: "visualization-shader",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: nextEventVisualizationShaderSource,
      },
      {
        id: "sampling-helper",
        filename: "sampling.ts",
        language: "ts",
        content: pathTracingSamplingSource,
      },
      {
        id: "common-scene",
        filename: "scene.ts",
        language: "ts",
        content: pathTracingSceneSource,
      },
    ],
  },
{
    id: "82-multiple-importance-sampling",
    order: 82,
    title: "Multiple Importance Sampling",
    tagline: "不是选边站，而是让 light sampling 和 BRDF sampling 都在该赢的时候赢",
    goal: "把显式采样光源和 BRDF importance sampling 正式合并成 direct-light MIS，对比 light-only、BRDF-only 和 MIS 三种策略在同样预算下的方差表现。",
    summary:
      "这一课会把 glossy direct lighting 拆成三栏：左栏只做 light sampling，中栏只做 BRDF sampling，右栏则用 power heuristic 合并两者，让你直接看到为什么 MIS 不容易偏科。",
    notes: [
      "`power heuristic`：MIS 不是平均混合，而是按 pdf 给更合理的权重。",
      "`low roughness`：高光越尖，单一策略就越容易在某个参数区间里彻底吃亏。",
      "`MIS`：它最有价值的地方不是“永远最好看”，而是避免 light-only 和 BRDF-only 在不同参数区间里轮流翻车。",
      "`这还是 direct lighting`：这里只讲最常见的一步 MIS，不扩展到更复杂的路径策略。",
    ],
    status: "ready",
    mount: mountMultipleImportanceSamplingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: misLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(misLessonRuntimeSource, [
          [1, 150],
          [151, 300],
          [301, 449],
        ]),
      },
      {
        id: "visualization-shader",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: misVisualizationShaderSource,
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
    id: "83-russian-roulette-and-throughput-management",
    order: 83,
    title: "Russian Roulette 与路径吞吐管理",
    tagline: "路径不能只会越走越深，还得会在不值钱的时候体面地停下来",
    goal: "讲清楚 Russian roulette 的核心：什么时候让低 throughput 的路径随机终止、为什么幸存路径必须做概率补偿，以及这和固定深度硬截断在成本和偏差上有什么区别。",
    summary:
      "这一课会把固定深度截断和 Russian roulette 放成左右对照：同样的随机路径预算下，左栏是简单粗暴的 max bounce 截断，右栏则从指定深度后按 throughput 决定谁继续走，并把平均路径长度与吞吐统计直接画出来。",
    notes: [
      "`throughput`：它代表这条路径继续走下去还值不值得。值越低，越适合把继续采样的预算留给别的路径。",
      "`Russian roulette`：不是为了偷懒，而是为了在保持无偏的同时把尾部长路径砍短。",
      "`1 / p compensation`：如果幸存路径不按概率补回来，画面就会系统性变暗。",
      "`这节课关注的是 cost vs bias`：不是追求更戏剧化的画面，而是看路径统计怎样变化。",
    ],
    status: "ready",
    mount: mountRussianRouletteAndThroughputManagementLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: russianRouletteLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(russianRouletteLessonRuntimeSource, [
          [1, 140],
          [141, 280],
          [281, 374],
        ]),
      },
      {
        id: "visualization-shader",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: russianRouletteVisualizationShaderSource,
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
    id: "84-real-time-path-traced-direct-lighting-and-temporal-stabilization",
    order: 84,
    title: "实时路径追踪直射光与时域稳定化",
    tagline: "1 spp noisy current frame 不够用，真正让它可看的还是时域链路",
    goal: "用一份教学版 1 spp direct-light signal 把 temporal stabilization 收回来：左栏保留 current frame，中栏只做 naive accumulation，右栏再加 reprojection 与 history clamp，让运动时的差异直接显出来。",
    summary:
      "这一课会把同一份 noisy direct-light 信号拆成三栏：左栏始终只看当前帧，中栏只做简单累积，右栏则把 history 先重投影回当前像素附近，再用 neighborhood clamp 控住错误 history，让“时域稳定化为什么重要”落到画面里。",
    notes: [
      "`1 spp current`：左栏故意一直 noisy，因为它代表 stochastic rendering 每一帧真正交出来的原始输入。",
      "`naive accumulation`：静止时它会收敛，但一旦运动，旧 history 会继续赖在错误位置不走。",
      "`reprojection + clamp`：右栏不是神奇去噪，而是先把 history 带回来，再决定它值不值得继续信。",
      "`这是这批课的收束`：前面讲过的 BVH、采样策略和路径成本，最终都要和 temporal stabilization 一起工作，才能更接近实时系统。",
    ],
    status: "ready",
    mount: mountRealTimePathTracedDirectLightingAndTemporalStabilizationLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: temporalStabilizationLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(temporalStabilizationLessonRuntimeSource, [
          [1, 150],
          [151, 300],
          [301, 397],
        ]),
      },
      {
        id: "accumulation-compute-shader",
        filename: "accumulate.compute.wgsl",
        language: "wgsl",
        content: temporalStabilizationAccumulationShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: temporalStabilizationPresentShaderSource,
      },
    ],
  },
{
    id: "85-reservoir-sampling-and-restir-di-foundations",
    order: 85,
    title: "Reservoir Sampling 与 ReSTIR DI 基础",
    tagline: "很多候选只留一个代表样本，重点不在“留多少”，而在“留下谁”",
    goal: "先把 reservoir sampling 的核心直觉讲清楚：为什么只保留 1 个代表样本，也能比 uniform one-light pick 更稳定地抓住高贡献光源。",
    summary:
      "这一课用单 receiver + many tiny lights 的教学房间做三栏对照：左栏保持 uniform one-light pick，中栏用 weighted reservoir update，右栏则把 target distribution 直接摊开，让 reservoir 为什么更容易抓到高贡献样本一眼可见。",
    notes: [
      "`uniform one-light pick`：左栏不是错，它只是把很多样本浪费在“挑到的灯其实几乎没贡献”的情况上。",
      "`reservoir`：它不保存所有候选，只保存一个代表样本和这一路上累积下来的权重信息。",
      "`reference / distribution`：右栏把真正高贡献的灯全摊开以后，你会更容易理解为什么 reservoir 不会继续均匀地看待所有灯。",
      "`这是 ReSTIR DI 的前提课`：先把 reservoir 自己讲明白，再谈 temporal reuse 和 spatial reuse。",
    ],
    status: "ready",
    mount: mountReservoirSamplingAndRestirDiFoundationsLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: restirFoundationsLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(restirFoundationsLessonRuntimeSource, [
          [1, 170],
          [171, 360],
          [361, 577],
        ]),
      },
      {
        id: "visualization-shader",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: restirFoundationsVisualizationShaderSource,
      },
      {
        id: "reservoir-helper",
        filename: "reservoir.ts",
        language: "ts",
        content: pathTracingReservoirSource,
      },
      {
        id: "sampling-helper",
        filename: "sampling.ts",
        language: "ts",
        content: pathTracingSamplingSource,
      },
      {
        id: "common-scene",
        filename: "scene.ts",
        language: "ts",
        content: pathTracingSceneSource,
      },
    ],
  },
{
    id: "86-temporal-reservoir-reuse-and-history-validation",
    order: 86,
    title: "Temporal Reservoir Reuse 与历史验证",
    tagline: "不是所有旧 reservoir 都还有效，disocclusion 会把坏 history 直接暴露出来",
    goal: "把 reservoir 从“当前帧候选”推进到“当前帧 + 上一帧”：让用户直接看到 naive temporal reuse 为什么会残留错误 history，以及为什么必须做 history validation。",
    summary:
      "这一课把同一块 noisy direct-light field 拆成三栏：左栏只保留 current-frame reservoir，中栏直接合并重投影回来的旧 reservoir，右栏则先过 depth / owner 验证，再决定要不要继续相信历史。",
    notes: [
      "`naive temporal reuse`：中栏的问题不是“用了历史”，而是“把不该信的历史也一起带回来了”。",
      "`validation`：右栏不是神奇滤波，而是先判断当前像素和历史像素到底是不是同一个东西。",
      "`disocclusion`：前景遮挡体移开时，中栏最容易留下旧 history；右栏会更快把这些失效样本拒掉。",
      "`这是 spatial reuse 之前的前置课`：先搞清 temporal reuse 里“历史怎么失效”，再讲邻居怎么失效。",
    ],
    status: "ready",
    mount: mountTemporalReservoirReuseAndHistoryValidationLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: temporalReservoirLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(temporalReservoirLessonRuntimeSource, [
          [1, 140],
          [141, 260],
          [261, 363],
        ]),
      },
      {
        id: "visualization-shader",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: temporalReservoirVisualizationShaderSource,
      },
      {
        id: "reservoir-helper",
        filename: "reservoir.ts",
        language: "ts",
        content: pathTracingReservoirSource,
      },
      {
        id: "common-scene",
        filename: "scene.ts",
        language: "ts",
        content: pathTracingSceneSource,
      },
    ],
  },
{
    id: "87-spatial-reservoir-reuse-and-neighborhood-resampling",
    order: 87,
    title: "Spatial Reservoir Reuse 与邻域重采样",
    tagline: "邻居不是天然可靠的样本来源，真正关键的是哪些邻居可以借",
    goal: "把 temporal reservoir reuse 再推进到邻域重采样：对比 naive spatial reuse 和经过兼容性筛选的 validated spatial reuse，讲清楚为什么空间复用会糊边，也为什么它仍然值得做。",
    summary:
      "这一课把同一份 temporal reservoir 输入拆成三栏：左栏只保留 temporal-only，中栏粗暴吸收邻域 reservoir，右栏则只接受深度和 roughness 足够接近的邻居。结果会直接体现在边界附近的污染程度上。",
    notes: [
      "`spatial reuse`：它真正提供的是更多“可能代表你”的样本，而不是任何邻居都该被抄过来。",
      "`naive`：中栏会更平，但它会最先把不兼容边界糊穿。",
      "`validated`：右栏宁可少复用，也不愿意把错误亮度从另一侧硬抹过来。",
      "`这是图像级 ReSTIR DI 之前的桥接课`：先看懂邻域筛选，再进入 many-lights 图像实验。",
    ],
    status: "ready",
    mount: mountSpatialReservoirReuseAndNeighborhoodResamplingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: spatialReservoirLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(spatialReservoirLessonRuntimeSource, [
          [1, 150],
          [151, 280],
          [281, 368],
        ]),
      },
      {
        id: "visualization-shader",
        filename: "visualization.wgsl",
        language: "wgsl",
        content: spatialReservoirVisualizationShaderSource,
      },
      {
        id: "reservoir-helper",
        filename: "reservoir.ts",
        language: "ts",
        content: pathTracingReservoirSource,
      },
      {
        id: "common-scene",
        filename: "scene.ts",
        language: "ts",
        content: pathTracingSceneSource,
      },
    ],
  },
{
    id: "88-restir-di-and-many-lights-direct-lighting",
    order: 88,
    title: "ReSTIR DI 与多光源直射光",
    tagline: "many-lights 下真正吃亏的不是“灯太多”，而是每像素预算太少",
    goal: "把前面三节的 reservoir / temporal reuse / spatial reuse 收成第一堂图像级 ReSTIR DI 课：同样的 low-budget direct lighting 下，对比 naive 1-sample 和教学版 ReSTIR DI 的稳定性差异。",
    summary:
      "这一课用 many-lights 房间做左右对照：左栏保持 naive 1 light sample / pixel，右栏则走 current candidates → temporal reuse → spatial reuse 的教学版 ReSTIR DI 链路，让多光源、小光源条件下的稳定性差异直接落到画面里。",
    notes: [
      "`many-lights`：灯一多，小灯一密，naive 1-sample 的退化会立刻暴露出来。",
      "`ReSTIR DI`：右栏并不是“多算了很多灯”，而是更聪明地决定“当前帧和周围帧/周围像素里，哪几个样本最值得留下”。",
      "`temporal + spatial`：这节课第一次把前面几堂课的原理组合起来，看完整图像级 direct lighting 的收益。",
      "`还是教学版`：重点是把为什么有效讲清楚，而不是复刻完整工业级管线。",
    ],
    status: "ready",
    mount: mountRestirDiAndManyLightsDirectLightingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: restirDiLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(restirDiLessonRuntimeSource, [
          [1, 62],
          [96, 178],
          [180, 243],
        ]),
      },
      {
        id: "gpu-helpers",
        filename: "gpu.ts",
        language: "ts",
        content: restirDiGpuSource,
        displaySegments: pickCoreSourceSegments(restirDiGpuSource, [
          [18, 75],
          [82, 123],
          [131, 204],
        ]),
      },
      {
        id: "view",
        filename: "view.ts",
        language: "ts",
        content: restirDiViewSource,
      },
      {
        id: "types",
        filename: "types.ts",
        language: "ts",
        content: restirDiTypesSource,
      },
      {
        id: "temporal-compute-shader",
        filename: "temporal.compute.wgsl",
        language: "wgsl",
        content: restirDiTemporalComputeShaderSource,
      },
      {
        id: "spatial-compute-shader",
        filename: "spatial.compute.wgsl",
        language: "wgsl",
        content: restirDiSpatialComputeShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: restirDiPresentShaderSource,
      },
      {
        id: "reservoir-helper",
        filename: "reservoir.ts",
        language: "ts",
        content: pathTracingReservoirSource,
      },
      {
        id: "common-scene",
        filename: "scene.ts",
        language: "ts",
        content: pathTracingSceneSource,
      },
    ],
  },
{
    id: "89-restir-di-temporal-stabilization-and-entry-denoising",
    order: 89,
    title: "ReSTIR DI 的时域稳定化与入口级降噪",
    tagline: "current-frame reservoir 再聪明，也不等于 history 就会自己变干净",
    goal: "用 ReSTIR DI 当前帧结果收束这一批：左栏保留 current ReSTIR DI，中栏只做 naive accumulation，右栏再加 reprojection + history clamp 与极轻量 clean-up，让用户看到 ReSTIR 输出也仍然需要 temporal stabilization。",
    summary:
      "这一课把同一份 ReSTIR DI 当前帧信号拆成三栏：左栏始终只看 current frame，中栏只做简单 accumulation，右栏则先做 reprojection 和 history clamp，再叠一层极轻的 edge-aware clean-up，让运动时 history 污染和稳定化收益都能直接观察到。",
    notes: [
      "`current ReSTIR DI`：左栏仍然 noisy，因为 reservoir 解决的是“样本更代表”，不是“历史自动稳定”。",
      "`naive accumulation`：静止时它会收敛，但一动起来，错误 history 还是会继续留在原位置。",
      "`reprojected + clamped`：右栏不是另一个主题，而是把这批课重新接回实时显示链路，说明 reservoir 结果为什么仍然需要时域处理。",
      "`这是这批课的收束`：下一批如果继续扩展，就可以自然进入 ReSTIR GI 或更完整的时空降噪体系。",
    ],
    status: "ready",
    mount: mountRestirDiTemporalStabilizationAndEntryDenoisingLesson,
    sources: [
      {
        id: "lesson-runtime",
        filename: "lesson.ts",
        language: "ts",
        content: restirStabilizationLessonRuntimeSource,
        displaySegments: pickCoreSourceSegments(restirStabilizationLessonRuntimeSource, [
          [1, 70],
          [90, 162],
          [164, 239],
        ]),
      },
      {
        id: "gpu-helpers",
        filename: "gpu.ts",
        language: "ts",
        content: restirStabilizationGpuSource,
        displaySegments: pickCoreSourceSegments(restirStabilizationGpuSource, [
          [25, 83],
          [90, 142],
          [150, 290],
        ]),
      },
      {
        id: "view",
        filename: "view.ts",
        language: "ts",
        content: restirStabilizationViewSource,
      },
      {
        id: "types",
        filename: "types.ts",
        language: "ts",
        content: restirStabilizationTypesSource,
      },
      {
        id: "temporal-compute-shader",
        filename: "temporal.compute.wgsl",
        language: "wgsl",
        content: restirStabilizationTemporalComputeShaderSource,
      },
      {
        id: "spatial-compute-shader",
        filename: "spatial.compute.wgsl",
        language: "wgsl",
        content: restirStabilizationSpatialComputeShaderSource,
      },
      {
        id: "accumulation-compute-shader",
        filename: "accumulate.compute.wgsl",
        language: "wgsl",
        content: restirStabilizationAccumulationComputeShaderSource,
      },
      {
        id: "present-shader",
        filename: "present.wgsl",
        language: "wgsl",
        content: restirStabilizationPresentShaderSource,
      },
      {
        id: "reservoir-helper",
        filename: "reservoir.ts",
        language: "ts",
        content: pathTracingReservoirSource,
      },
    ],
  }
];
