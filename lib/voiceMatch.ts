/**
 * Normalizes a string by converting to lowercase, removing punctuation, and trimming extra spaces.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculates a basic word-level match percentage between the spoken transcription and the correct answer.
 */
export function calculateMatchScore(transcript: string, correctAnswer: string): number {
  const normUser = normalizeText(transcript);
  const normCorrect = normalizeText(correctAnswer);

  if (!normUser || !normCorrect) return 0;

  const userWords = new Set(normUser.split(" "));
  const correctWords = normCorrect.split(" ");

  let matches = 0;
  for (const word of correctWords) {
    if (userWords.has(word)) {
      matches++;
    }
  }

  // Calculate percentage of correct words found in user speech
  return Math.round((matches / correctWords.length) * 100);
}
