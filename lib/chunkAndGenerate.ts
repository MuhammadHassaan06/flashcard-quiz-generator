import Groq from "groq-sdk";
import { estimateTokens } from "./extract";

// Anthropic ki jagah Groq initialize kar rahe hain
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface Flashcard {
  front: string;
  back: string;
}

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation: string;
}

export interface GenerationResult {
  title?: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}

export type ProgressStage =
  | "parsing"
  | "chunking"
  | "generating"
  | "merging"
  | "done";

export type ProgressCallback = (stage: ProgressStage, detail?: string) => void;

const MAX_CHUNK_TOKENS = 4000;
const CHUNK_OVERLAP_CHARS = 300;

const SYSTEM_PROMPT = `You are an expert instructional designer. Given a passage of study
material, generate flashcards and a multiple-choice quiz that test genuine understanding,
not just word-matching.

Rules:
- Return STRICT JSON only. No prose, no markdown code fences, no commentary.
- Schema:
{
  "title": "suggested short title (3-5 words describing the overall topic)",
  "flashcards": [{"front": "string", "back": "string"}],
  "quiz": [{
    "question": "string",
    "options": ["string","string","string","string"],
    "correct_index": 0,
    "explanation": "string"
  }]
}
- Generate 5-10 flashcards and 3-6 quiz questions per passage, scaled to how much
  distinct content the passage actually contains.
- Flashcards: front is a question or term, back is a concise, accurate answer.
- Quiz: exactly 4 options per question, exactly one correct_index (0-3), and a short
  explanation of why the correct answer is right.
- Do not invent facts that are not supported by the passage.`;

/**
 * Splits text into overlapping chunks so no single AI call exceeds the safe
 * context size, while preserving continuity across chunk boundaries.
 */
function chunkText(text: string, maxTokens = MAX_CHUNK_TOKENS): string[] {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    // Try to break on a paragraph boundary near the end of the window.
    let breakPoint = text.lastIndexOf("\n\n", end);
    if (breakPoint <= start) breakPoint = end;
    chunks.push(text.slice(start, breakPoint));
    start = breakPoint - CHUNK_OVERLAP_CHARS;
    if (start < 0) start = breakPoint;
  }
  return chunks;
}

async function generateForChunk(chunk: string, difficulty: string): Promise<GenerationResult> {
  // Groq chat completion configuration
  const response = await groq.chat.completions.create({
    // llama-3.3-70b-versatile structured JSON aur fast responses ke liye best hai
    model: "llama-3.3-70b-versatile", 
    max_tokens: 4000,
    temperature: 0.3,
    // Groq ko batana ke humein response strict JSON format mein chahiye
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `Difficulty level: ${difficulty}\n\nPassage:\n${chunk}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || "{}";

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as GenerationResult;
  } catch {
    // If the model slips and wraps output, fail soft with empty arrays
    // rather than crashing the whole merge.
    return { flashcards: [], quiz: [] };
  }
}

/**
 * Chunks long input, generates flashcards/quiz per chunk, and merges the
 * results into one deduplicated payload. Reports progress via onProgress
 * so the frontend can drive a real multi-step status indicator.
 */
export async function chunkAndGenerate(
  text: string,
  difficulty: "basic" | "applied",
  onProgress?: ProgressCallback
): Promise<GenerationResult> {
  onProgress?.("chunking");
  const totalTokens = estimateTokens(text);
  const chunks = totalTokens > MAX_CHUNK_TOKENS ? chunkText(text) : [text];

  onProgress?.("generating", `0/${chunks.length} chunks`);
  const results: GenerationResult[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const result = await generateForChunk(chunks[i], difficulty);
    results.push(result);
    onProgress?.("generating", `${i + 1}/${chunks.length} chunks`);
  }

  onProgress?.("merging");
  const merged = mergeResults(results);
  onProgress?.("done");
  return merged;
}

function mergeResults(results: GenerationResult[]): GenerationResult {
  const seenFronts = new Set<string>();
  const seenQuestions = new Set<string>();
  const flashcards: Flashcard[] = [];
  const quiz: QuizQuestion[] = [];
  const title = results[0]?.title ?? "Untitled Deck";

  for (const r of results) {
    for (const card of r.flashcards ?? []) {
      const key = card.front.trim().toLowerCase();
      if (!seenFronts.has(key)) {
        seenFronts.add(key);
        flashcards.push(card);
      }
    }
    for (const q of r.quiz ?? []) {
      const key = q.question.trim().toLowerCase();
      if (!seenQuestions.has(key)) {
        seenQuestions.add(key);
        quiz.push(q);
      }
    }
  }

  return { title, flashcards, quiz };
}