import type { LessonDefinition } from "@/studio/types";
import { lessons01To26 } from "@/studio/lesson-registry/lessons-01-26";
import { lessons27To45 } from "@/studio/lesson-registry/lessons-27-45";
import { lessons46To64 } from "@/studio/lesson-registry/lessons-46-64";
import { lessons65To79 } from "@/studio/lesson-registry/lessons-65-79";
import { lessons80To89 } from "@/studio/lesson-registry/lessons-80-89";

// Public lesson registry entrypoint. Keep this file small; per-batch metadata lives in src/studio/lesson-registry/.
export const lessons: LessonDefinition[] = [
  ...lessons01To26,
  ...lessons27To45,
  ...lessons46To64,
  ...lessons65To79,
  ...lessons80To89,
];
