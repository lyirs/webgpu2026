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

// 注册表是 lesson 元信息、运行入口和源码展示之间的唯一连接点。
// UI 统一从这里读取，避免把 lesson 配置分散到多个地方。
