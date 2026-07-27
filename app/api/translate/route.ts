import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguage } = await req.json();

    if (!text || !targetLanguage) {
      return NextResponse.json({ error: "Missing text or targetLanguage" }, { status: 400 });
    }

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a professional language translator. Translate the given text accurately into the target language. Keep the original formatting and style. ONLY return the translated text, with no extra explanations or intro text.`,
        },
        {
          role: "user",
          content: `Target Language: ${targetLanguage}\nText to translate: ${text}`,
        },
      ],
      temperature: 0.2,
    });

    const translatedText = response.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ translation: translatedText });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to translate" },
      { status: 500 }
    );
  }
}
