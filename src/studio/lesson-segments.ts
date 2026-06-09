import type { LessonSourceSegment } from "@/studio/types";

/**
 * 生成折叠代码段的摘要文案。
 * @param {number} start 起始行号。
 * @param {number} end 结束行号。
 * @returns {string} 适合展示在折叠标题上的中文说明。
 */
function foldSummary(start: number, end: number): string {
  const lineCount = end - start + 1;

  if (start === end) {
    return "省略 1 行辅助代码";
  }

  return `省略 ${lineCount} 行辅助代码`;
}

/**
 * 从真实源码中截取更适合课程讲解的核心片段，并把中间省略的部分转成可折叠代码段。
 * @param {string} content 原始源码全文。
 * @param {Array<[number, number]>} ranges 需要保留的行号区间，按 1-based 传入。
 * @returns {LessonSourceSegment[]} 适合课程源码面板使用的代码段与折叠段集合。
 */
export function pickCoreSourceSegments(
  content: string,
  ranges: Array<[number, number]>
): LessonSourceSegment[] {
  const lines = content.split("\n");
  const segments: LessonSourceSegment[] = [];
  let cursor = 1;

  ranges.forEach(([start, end]) => {
    if (start > cursor) {
      const foldedContent = lines.slice(cursor - 1, start - 1).join("\n").trimEnd();
      if (foldedContent.trim().length > 0) {
        segments.push({
          type: "fold",
          summary: foldSummary(cursor, start - 1),
          content: foldedContent,
          startLine: cursor,
          endLine: start - 1,
        });
      }
    }

    const codeContent = lines.slice(start - 1, end).join("\n").trimEnd();
    if (codeContent.length > 0) {
      segments.push({
        type: "code",
        content: codeContent,
        startLine: start,
        endLine: end,
      });
    }

    cursor = end + 1;
  });

  if (cursor <= lines.length) {
    const foldedContent = lines.slice(cursor - 1).join("\n").trimEnd();
    if (foldedContent.trim().length > 0) {
      segments.push({
        type: "fold",
        summary: foldSummary(cursor, lines.length),
        content: foldedContent,
        startLine: cursor,
        endLine: lines.length,
      });
    }
  }

  return segments;
}

const CORE_LINE_PATTERNS: Array<{ pattern: string; weight: number }> = [
  { pattern: "navigator.gpu", weight: 5 },
  { pattern: "requestAdapter", weight: 6 },
  { pattern: "requestDevice", weight: 6 },
  { pattern: "createWebGpuCanvas", weight: 4 },
  { pattern: "getPreferredCanvasFormat", weight: 5 },
  { pattern: "context.configure", weight: 6 },
  { pattern: "pushErrorScope", weight: 7 },
  { pattern: "popErrorScope", weight: 7 },
  { pattern: "getCompilationInfo", weight: 7 },
  { pattern: "createShaderModule", weight: 6 },
  { pattern: "createBuffer", weight: 5 },
  { pattern: "writeBuffer", weight: 5 },
  { pattern: "mapAsync", weight: 6 },
  { pattern: "copyBufferToBuffer", weight: 6 },
  { pattern: "copyBufferToTexture", weight: 6 },
  { pattern: "copyTextureToBuffer", weight: 6 },
  { pattern: "copyTextureToTexture", weight: 6 },
  { pattern: "copyExternalImageToTexture", weight: 7 },
  { pattern: "importExternalTexture", weight: 7 },
  { pattern: "clearBuffer", weight: 7 },
  { pattern: "createTexture", weight: 5 },
  { pattern: "createView", weight: 5 },
  { pattern: "createSampler", weight: 5 },
  { pattern: "createBindGroupLayout", weight: 7 },
  { pattern: "createPipelineLayout", weight: 7 },
  { pattern: "createBindGroup", weight: 6 },
  { pattern: "getBindGroupLayout", weight: 5 },
  { pattern: "createRenderPipeline", weight: 7 },
  { pattern: "createComputePipeline", weight: 7 },
  { pattern: "createRenderPipelineAsync", weight: 8 },
  { pattern: "createComputePipelineAsync", weight: 8 },
  { pattern: "beginRenderPass", weight: 7 },
  { pattern: "beginComputePass", weight: 7 },
  { pattern: "setPipeline", weight: 4 },
  { pattern: "setBindGroup", weight: 4 },
  { pattern: "setVertexBuffer", weight: 5 },
  { pattern: "setIndexBuffer", weight: 5 },
  { pattern: "setViewport", weight: 6 },
  { pattern: "setScissorRect", weight: 6 },
  { pattern: "drawIndexedIndirect", weight: 8 },
  { pattern: "drawIndirect", weight: 8 },
  { pattern: "drawIndexed", weight: 6 },
  { pattern: ".draw(", weight: 5 },
  { pattern: "dispatchWorkgroupsIndirect", weight: 8 },
  { pattern: "dispatchWorkgroups", weight: 7 },
  { pattern: "beginOcclusionQuery", weight: 7 },
  { pattern: "endOcclusionQuery", weight: 7 },
  { pattern: "writeTimestamp", weight: 7 },
  { pattern: "resolveQuerySet", weight: 7 },
  { pattern: "finish()", weight: 5 },
  { pattern: "queue.submit", weight: 7 },
  { pattern: "onSubmittedWorkDone", weight: 7 },
  { pattern: "GPUBufferUsage", weight: 5 },
  { pattern: "GPUTextureUsage", weight: 5 },
  { pattern: "GPUShaderStage", weight: 4 },
  { pattern: "generateWhiteNoisePoints", weight: 6 },
  { pattern: "generateStratifiedJitterPoints", weight: 6 },
  { pattern: "generateBlueNoiseLikePoints", weight: 7 },
  { pattern: "generateUniformHemisphereSamples", weight: 7 },
  { pattern: "estimateIrradiance", weight: 7 },
  { pattern: "estimateUniform", weight: 7 },
  { pattern: "estimateImportance", weight: 7 },
  { pattern: "sampleGgxReflection", weight: 7 },
  { pattern: "sampleUniformHemisphere", weight: 6 },
  { pattern: "environmentRadiance", weight: 5 },
  { pattern: "runningEstimate", weight: 5 },
  { pattern: "regeneratePatterns", weight: 5 },
];

const GLUE_LINE_PATTERNS = [
  "host.innerHTML",
  "querySelector",
  "addEventListener",
  "removeEventListener",
  "setStatus",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "return ()",
];

const COMMENT_PREFIXES = ["//", "*", "/*", "/**"];

type WeightedRange = {
  start: number;
  end: number;
  score: number;
};

function containsAny(line: string, patterns: string[]): boolean {
  return patterns.some((pattern) => line.includes(pattern));
}

function clampLine(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

function isCommentOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  return COMMENT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function createGlueLineMask(lines: string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false);
  let insideInnerHtmlTemplate = false;

  lines.forEach((line, index) => {
    if (line.includes("host.innerHTML") && line.includes("`")) {
      insideInnerHtmlTemplate = true;
    }

    if (insideInnerHtmlTemplate) {
      mask[index] = true;
    }

    if (containsAny(line, GLUE_LINE_PATTERNS)) {
      mask[index] = true;
    }

    if (insideInnerHtmlTemplate && line.trim().endsWith("`;")) {
      insideInnerHtmlTemplate = false;
    }
  });

  return mask;
}

function trimGlueBoundary(
  glueMask: boolean[],
  anchorLine: number,
  start: number,
  end: number
): [number, number] {
  let trimmedStart = start;
  let trimmedEnd = end;

  for (let line = anchorLine - 1; line >= start; line -= 1) {
    if (glueMask[line - 1]) {
      trimmedStart = line + 1;
      break;
    }
  }

  for (let line = anchorLine + 1; line <= end; line += 1) {
    if (glueMask[line - 1]) {
      trimmedEnd = line - 1;
      break;
    }
  }

  return [trimmedStart, trimmedEnd];
}

function expandToTeachingBlock(
  lines: string[],
  glueMask: boolean[],
  anchorLine: number,
  rawStart: number,
  rawEnd: number
): [number, number] {
  const maxSpan = 64;
  let start = rawStart;
  let end = rawEnd;

  for (let line = anchorLine - 1; line >= 1; line -= 1) {
    if (glueMask[line - 1]) {
      break;
    }

    start = line;

    if (isBlankLine(lines[line - 1] ?? "") && anchorLine - line > 1) {
      start = line + 1;
      break;
    }

    if (anchorLine - line >= maxSpan / 2) {
      break;
    }
  }

  for (let line = anchorLine + 1; line <= lines.length; line += 1) {
    if (glueMask[line - 1]) {
      break;
    }

    end = line;

    if (isBlankLine(lines[line - 1] ?? "") && line - anchorLine > 1) {
      end = line - 1;
      break;
    }

    if (line - start >= maxSpan) {
      break;
    }
  }

  return trimGlueBoundary(glueMask, anchorLine, start, end);
}

function mergeRanges(ranges: WeightedRange[]): WeightedRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged: WeightedRange[] = [];

  sorted.forEach((range) => {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end + 3) {
      merged.push({ ...range });
      return;
    }

    previous.end = Math.max(previous.end, range.end);
    previous.score += range.score;
  });

  return merged;
}

function pickTeachingRanges(content: string): Array<[number, number]> {
  const lines = content.split("\n");
  const glueMask = createGlueLineMask(lines);
  const candidates: WeightedRange[] = [];

  lines.forEach((line, index) => {
    if (glueMask[index] || isCommentOnlyLine(line)) {
      return;
    }

    const score = CORE_LINE_PATTERNS.reduce((total, item) => {
      return line.includes(item.pattern) ? total + item.weight : total;
    }, 0);

    if (score === 0) {
      return;
    }

    const anchorLine = index + 1;
    const rawStart = clampLine(anchorLine - 7, 1, lines.length);
    const rawEnd = clampLine(anchorLine + 11, 1, lines.length);
    const [start, end] = expandToTeachingBlock(lines, glueMask, anchorLine, rawStart, rawEnd);

    if (start <= end) {
      candidates.push({ start, end, score });
    }
  });

  if (candidates.length === 0) {
    const firstEnd = Math.min(lines.length, 80);
    const tailStart = Math.max(firstEnd + 1, lines.length - 34);
    return tailStart <= firstEnd
      ? [[1, firstEnd]]
      : [
          [1, firstEnd],
          [tailStart, lines.length],
        ];
  }

  const merged = mergeRanges(candidates);
  const selected = merged
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, 4)
    .sort((a, b) => a.start - b.start);

  return selected.map((range) => [range.start, range.end]);
}

/**
 * 自动从 lesson runtime 源码里挑出更像“教学核心”的片段。
 * 这个策略优先围绕 WebGPU API / pass / pipeline / dispatch / submit 等锚点，
 * 并尽量避开 DOM、HUD 与 cleanup 胶水，让源码面板默认折得更干净。
 * @param {string} content 原始源码全文。
 * @returns {LessonSourceSegment[]} 折叠后的教学片段。
 */
export function pickLessonSourceSegments(content: string): LessonSourceSegment[] {
  return pickCoreSourceSegments(content, pickTeachingRanges(content));
}

// 注册表是 lesson 元信息、运行入口和源码展示之间的唯一连接点。
// UI 统一从这里读取，避免把 lesson 配置分散到多个地方。
