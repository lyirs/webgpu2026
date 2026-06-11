import { pickCoreSourceSegments } from "@/studio/lesson-segments";
import type { LessonDefinition } from "@/studio/types";
import { mountChrome147148WebGpuUpdateLab } from "@/updates/update-u147-148-chrome-webgpu-update-lab/lesson";

import update147LessonSource from "@/updates/update-u147-148-chrome-webgpu-update-lab/lesson.ts?raw";
import update147LinearShaderSource from "@/updates/update-u147-148-chrome-webgpu-update-lab/linear-indexing.wgsl?raw";
import update147ManualShaderSource from "@/updates/update-u147-148-chrome-webgpu-update-lab/manual-and-present.wgsl?raw";

export const updateLabs: LessonDefinition[] = [
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
        displaySegments: pickCoreSourceSegments(update147LinearShaderSource, [
          [1, 2],
          [22, 34],
        ]),
      },
    ],
  },
];
