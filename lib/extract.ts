import * as cheerio from "cheerio";

/**
 * Fetches a URL and returns clean article text, stripped of nav/footer/script/ads.
 */
export async function extractFromUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FlashcardBot/1.0)" },
  });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
  const html = await res.text();

  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript, iframe, svg, form, aside").remove();
  $("[class*='ad'], [class*='cookie'], [class*='banner'], [id*='ad']").remove();

  // Prefer <article> or <main> if present, otherwise fall back to body.
  const container = $("article").length
    ? $("article")
    : $("main").length
    ? $("main")
    : $("body");

  const text = container
    .find("p, h1, h2, h3, li")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join("\n");

  return cleanText(text);
}

/**
 * Extracts raw text from an uploaded PDF buffer.
 */
export async function extractFromPdf(buffer: Buffer): Promise<string> {
  // Lazy import: pdf-parse touches the filesystem at module load in some setups.
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return cleanText(data.text);
}

/**
 * Extracts raw text from an uploaded DOCX buffer.
 */
export async function extractFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return cleanText(value);
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Rough token estimate: ~4 chars per token for English text.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
