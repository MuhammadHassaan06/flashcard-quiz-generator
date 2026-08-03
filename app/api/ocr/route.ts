import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, cardCount = 6 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image payload provided" }, { status: 400 });
    }

    // Use active Groq Vision Model: llama-3.2-90b-vision-preview
    const visionModel = process.env.GROQ_VISION_MODEL || "llama-3.2-90b-vision-preview";

    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const completion = await groq.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this image (textbook page, whiteboard, or handwritten notes) and extract key facts to generate ${cardCount} flashcards. 
              Format list answers with double line breaks (\\n\\n) before each numbered point or bullet point so that Markdown renders them on separate lines.
              Output MUST be valid JSON array of objects without markdown fences:
              [
                { "front": "Question or term", "back": "Clear concise answer" }
              ]`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    });

    const responseText = completion.choices[0]?.message?.content || "[]";
    const cleaned = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();

    const flashcards = JSON.parse(cleaned);

    return NextResponse.json({ flashcards });
  } catch (error: any) {
    console.error("OCR API error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process image OCR" },
      { status: 500 }
    );
  }
}
