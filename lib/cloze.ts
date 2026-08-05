export interface ClozeSegment {
  text: string;
  isCloze: boolean;
  hint?: string;
}

/**
 * Checks if a string contains Anki-style Cloze deletion syntax {{c1::answer}} or {{c1::answer::hint}}.
 */
export function hasCloze(text: string): boolean {
  return /\{\{(?:c\d+::)?([^}]+)\}\}/.test(text);
}

/**
 * Parses text into structured segments for Cloze rendering.
 * @param text Raw card content
 * @param isFlipped If true (Back of card), reveals the answer. If false (Front of card), shows hint or [...]
 */
export function parseCloze(text: string, isFlipped: boolean): ClozeSegment[] {
  const regex = /\{\{(?:c\d+::)?([^}]+)\}\}/g;
  const segments: ClozeSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        isCloze: false,
      });
    }

    const rawContent = match[1];
    const parts = rawContent.split("::");
    const answer = parts[0];
    const hint = parts[1] || undefined;

    if (isFlipped) {
      // Reveal the hidden answer on the back
      segments.push({
        text: answer,
        isCloze: true,
        hint,
      });
    } else {
      // Hide the answer with [...] or [hint] on the front
      segments.push({
        text: hint ? `[${hint}]` : "[...]",
        isCloze: true,
        hint,
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining trailing text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      isCloze: false,
    });
  }

  return segments;
}
