import { pickCoreSourceSegments } from "@/studio/lesson-segments";
import type { LessonDefinition } from "@/studio/types";
import { mountChrome146WebGpuUpdateLab } from "@/updates/update-u146-chrome-webgpu-update-lab/lesson";
import { mountChrome147148WebGpuUpdateLab } from "@/updates/update-u147-148-chrome-webgpu-update-lab/lesson";

import update146DirectShaderSource from "@/updates/update-u146-chrome-webgpu-update-lab/direct-and-transient.wgsl?raw";
import update146LessonSource from "@/updates/update-u146-chrome-webgpu-update-lab/lesson.ts?raw";
import update146LetShaderSource from "@/updates/update-u146-chrome-webgpu-update-lab/texture-sampler-let.wgsl?raw";
import update147LessonSource from "@/updates/update-u147-148-chrome-webgpu-update-lab/lesson.ts?raw";
import update147LinearShaderSource from "@/updates/update-u147-148-chrome-webgpu-update-lab/linear-indexing.wgsl?raw";
import update147ManualShaderSource from "@/updates/update-u147-148-chrome-webgpu-update-lab/manual-and-present.wgsl?raw";

export const updateLabs: LessonDefinition[] = [
  {
    id: "u146-chrome-webgpu-update-lab",
    order: 146,
    displayOrder: "U146",
    section: "updates",
    title: "Chrome 146 WebGPU Update Lab",
    tagline: "compatibility mode、transient attachment 与 texture/sampler let",
    goal:
      "把 Chrome 146 WebGPU 更新转成可运行实验：请求 compatibility adapter，创建 transient scratch attachment，并在支持时编译 `texture_and_sampler_let` shader。",
    summary:
      "Chrome 146 更新覆盖三个常用边界：`featureLevel: \"compatibility\"` 用来请求兼容模式 adapter；`GPUTextureUsage.TRANSIENT_ATTACHMENT` 标记只在 render pass 内使用的临时附件；`texture_and_sampler_let` 允许 WGSL 把 texture / sampler 赋给局部 `let` 再采样。",
    notes: [
      "`featureLevel: \"compatibility\"` 面向更保守的硬件/API 路径，重点是扩大 WebGPU 可运行范围。",
      "`TRANSIENT_ATTACHMENT` 搭配 `storeOp: \"discard\"`，表达这个 attachment 只作为 pass 内 scratch target，不需要保留结果。",
      "`texture_and_sampler_let` 是 WGSL language feature；本课先查 `navigator.gpu.wgslLanguageFeatures`，支持时才编译带 `requires texture_and_sampler_let` 的 shader。",
      "参考官方更新：[Chrome 146 WebGPU 更新](https://developer.chrome.google.cn/blog/new-in-webgpu-146?hl=zh-cn)。",
    ],
    status: "ready",
    mount: mountChrome146WebGpuUpdateLab,
    sources: [
      {
        id: "lesson",
        filename: "lesson.ts",
        language: "ts",
        content: update146LessonSource,
        featured: true,
        emphasisMode: "only",
        emphasisPatterns: [
          "featureLevel",
          "TEXTURE_SAMPLER_LET_FEATURE",
          "TRANSIENT_ATTACHMENT_USAGE",
          "textureSamplerLetListed",
          "letPipeline",
          "storeOp: \"discard\"",
        ],
        displaySegments: pickCoreSourceSegments(update146LessonSource, [
          [51, 80],
          [176, 235],
          [237, 332],
          [334, 406],
        ]),
      },
      {
        id: "direct-and-transient",
        filename: "direct-and-transient.wgsl",
        language: "wgsl",
        content: update146DirectShaderSource,
        emphasisMode: "only",
        emphasisPatterns: ["transientDebug", "fsDirect", "fsFallbackRight"],
        displaySegments: pickCoreSourceSegments(update146DirectShaderSource, [
          [1, 18],
          [34, 70],
        ]),
      },
      {
        id: "texture-sampler-let",
        filename: "texture-sampler-let.wgsl",
        language: "wgsl",
        content: update146LetShaderSource,
        emphasisMode: "only",
        emphasisPatterns: [
          "requires texture_and_sampler_let",
          "let localTexture",
          "let localSampler",
          "textureSample\\(localTexture, localSampler",
        ],
        displaySegments: pickCoreSourceSegments(update146LetShaderSource, [
          [1, 2],
          [39, 58],
        ]),
      },
    ],
  },
  {
    id: "u147-148-chrome-webgpu-update-lab",
    order: 147148,
    displayOrder: "U147-148",
    section: "updates",
    title: "Chrome 147-148 WebGPU Update Lab",
    tagline: "linear_indexing、Linux NVIDIA 覆盖与 Dawn 更新",
    goal:
      "把 Chrome 147-148 官方 WebGPU 更新转成可运行实验：检测 `linear_indexing`，支持时使用 builtin linear indices，不支持时安全 fallback。",
    summary:
      "Chrome 147-148 更新加入 WGSL `linear_indexing`：画布左侧用旧的手动 flatten 公式，右侧在浏览器暴露该能力时编译 `requires linear_indexing` shader，并用输出对照验证 builtin index 与手写公式一致。",
    notes: [
      "`linear_indexing` 的核心价值是减少 compute shader 里手写 `globalId.x + globalId.y * width + ...` 这类线性索引公式。",
      "官方更新课要同时讲 feature gate：先查 `navigator.gpu.wgslLanguageFeatures`，再决定是否编译带 `requires` 的 WGSL。",
      "Linux NVIDIA 覆盖扩大影响的是 WebGPU 可用平台；Dawn native 更新影响的是底层实现、测试和工具链稳定性。",
      "参考官方更新：[Chrome 147-148 WebGPU 更新](https://developer.chrome.google.cn/blog/new-in-webgpu-147-148?hl=zh-cn)。",
    ],
    status: "ready",
    mount: mountChrome147148WebGpuUpdateLab,
    sources: [
      {
        id: "lesson",
        filename: "lesson.ts",
        language: "ts",
        content: update147LessonSource,
        featured: true,
        emphasisMode: "only",
        emphasisPatterns: [
          "LINEAR_INDEXING_FEATURE",
          "wgslLanguageFeatures",
          "featureIsListed",
          "linearPipeline",
          "mismatch",
        ],
        displaySegments: pickCoreSourceSegments(update147LessonSource, [
          [14, 34],
          [93, 128],
          [155, 207],
          [263, 323],
        ]),
      },
      {
        id: "manual-and-present",
        filename: "manual-and-present.wgsl",
        language: "wgsl",
        content: update147ManualShaderSource,
        emphasisMode: "only",
        emphasisPatterns: [
          "manualGlobalIndex",
          "manualWorkgroupIndex",
          "outputCells\\[manualGlobalIndex\\]",
        ],
        displaySegments: pickCoreSourceSegments(update147ManualShaderSource, [
          [16, 43],
          [65, 126],
        ]),
      },
      {
        id: "linear-indexing",
        filename: "linear-indexing.wgsl",
        language: "wgsl",
        content: update147LinearShaderSource,
        emphasisMode: "only",
        emphasisPatterns: [
          "requires linear_indexing",
          "global_invocation_index",
          "workgroup_index",
          "outputCells\\[globalIndex\\]",
        ],
        displaySegments: pickCoreSourceSegments(update147LinearShaderSource, [
          [1, 2],
          [22, 34],
        ]),
      },
    ],
  },
];
