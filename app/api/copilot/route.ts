import { NextRequest } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { question, cardFront, cardBack, history = [] } = await req.json();

    const systemPrompt = `You are Recall Copilot, an AI study assistant. Your goal is to help the user understand the concepts they are studying via flashcards or quizzes.
The user is studying a card or question with the following details:
- Front / Question: "${cardFront}"
- Back / Correct Answer / Explanation: "${cardBack}"

Provide clear, simple, and intuitive explanations. You can use analogies, break down technical jargon, or use formatting to make it easy to read. Keep your response direct and helpful, under 150 words. Do not include introductory filler.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((msg: { role: string; content: string }) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      })),
      { role: "user", content: question },
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      stream: true,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of chatCompletion) {
          const content = chunk.choices[0]?.delta?.content || "";
          controller.enqueue(encoder.encode(content));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate copilot response" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
