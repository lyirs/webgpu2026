export type PreviewTone = "info" | "ok" | "warn";

export type PreviewStatus = {
  title: string;
  detail: string;
  tone: PreviewTone;
};

export type LessonSource = {
  id: string;
  filename: string;
  language: "ts" | "wgsl" | "md";
  content: string;
  displaySegments?: LessonSourceSegment[];
  featured?: boolean;
};

export type LessonSourceSegment = {
  type: "code" | "fold";
  content: string;
  startLine: number;
  endLine: number;
  summary?: string;
};

export type LessonDefinition = {
  id: string;
  order: number;
  title: string;
  tagline: string;
  goal: string;
  summary: string;
  notes: string[];
  status: "ready" | "planned";
  sources: LessonSource[];
  mount?: (
    host: HTMLElement,
    setStatus: (status: PreviewStatus) => void
  ) => Promise<(() => void) | void> | (() => void) | void;
};
