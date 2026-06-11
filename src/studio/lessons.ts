import type { LessonDefinition } from "@/studio/types";
import { lessons1To51 } from "@/studio/lesson-registry/lessons-01-51";
import { lessons52To80 } from "@/studio/lesson-registry/lessons-52-80";
import { lessons81To106 } from "@/studio/lesson-registry/lessons-81-106";
import { lessons107To128 } from "@/studio/lesson-registry/lessons-107-128";
import { lessons129To149 } from "@/studio/lesson-registry/lessons-129-149";
import { updateLabs } from "@/studio/update-registry/updates";

// Public lesson registry entrypoint. Keep this file small; per-batch metadata lives in src/studio/lesson-registry/.
export const lessons: LessonDefinition[] = [
  ...lessons1To51,
  ...lessons52To80,
  ...lessons81To106,
  ...lessons107To128,
  ...lessons129To149,
];

export const courseItems: LessonDefinition[] = [...lessons, ...updateLabs];
