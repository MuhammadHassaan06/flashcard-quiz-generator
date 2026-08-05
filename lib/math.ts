import katex from "katex";

export interface MathSegment {
  type: "text" | "inline-math" | "block-math";
  content: string;
  html?: string;
}

/**
 * Parses a string for LaTeX math delimiters ($...$ for inline, $$...$$ for block)
 * and renders KaTeX HTML safely.
 */
export function parseMathAndText(text: string): MathSegment[] {
  if (!text) return [];

  const segments: MathSegment[] = [];
  // Regex to match block math $$...$$ first, then inline math $...$
  const regex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    const rawMatch = match[0];
    const isBlock = rawMatch.startsWith("$$") && rawMatch.endsWith("$$");
    const formula = isBlock ? rawMatch.slice(2, -2).trim() : rawMatch.slice(1, -1).trim();

    try {
      const html = katex.renderToString(formula, {
        displayMode: isBlock,
        throwOnError: false,
      });
      segments.push({
        type: isBlock ? "block-math" : "inline-math",
        content: formula,
        html,
      });
    } catch {
      segments.push({
        type: "text",
        content: rawMatch,
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
