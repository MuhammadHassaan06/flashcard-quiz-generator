import { NextRequest } from "next/server";
import { extractFromUrl, extractFromPdf, extractFromDocx } from "@/lib/extract";
import { chunkAndGenerate, ProgressStage } from "@/lib/chunkAndGenerate";

// Prevents Vercel serverless function timeout during long generations.
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: { stage: ProgressStage; detail?: string; result?: unknown; error?: string }) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        const formData = await req.formData();
        const inputType = formData.get("inputType") as string; // "text" | "url" | "file"
        const difficulty = (formData.get("difficulty") as string) || "basic";

        send({ stage: "parsing" });

        let text = "";
        if (inputType === "text") {
          text = (formData.get("text") as string) ?? "";
        } else if (inputType === "url") {
          const url = formData.get("url") as string;
          text = await extractFromUrl(url);
        } else if (inputType === "file") {
          const file = formData.get("file") as File;
          const buffer = Buffer.from(await file.arrayBuffer());
          const fileNameLower = file.name.toLowerCase();
          text = fileNameLower.endsWith(".pdf")
            ? await extractFromPdf(buffer)
            : await extractFromDocx(buffer);
        }

        if (!text || text.trim().length < 20) {
          send({ stage: "done", error: "Not enough text extracted to generate cards." });
          controller.close();
          return;
        }

        const result = await chunkAndGenerate(
          text,
          difficulty === "applied" ? "applied" : "basic",
          (stage, detail) => send({ stage, detail })
        );

        send({ stage: "done", result });
      } catch (err) {
        send({ stage: "done", error: err instanceof Error ? err.message : "Generation failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
