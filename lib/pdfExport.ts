export interface PrintableCard {
  front: string;
  back: string;
}

export function exportDeckToPrintablePDF(deckTitle: string, cards: PrintableCard[]) {
  if (typeof window === "undefined") return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${deckTitle} — Printable Cheat Sheet</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 30px;
            color: #111827;
            background: #ffffff;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
            margin: 0 0 5px 0;
            color: #4f46e5;
          }
          .subtitle {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }
          .card {
            border: 1.5px solid #e5e7eb;
            border-radius: 12px;
            padding: 14px;
            background: #f9fafb;
            page-break-inside: avoid;
          }
          .question {
            font-size: 13px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 6px;
          }
          .answer {
            font-size: 12px;
            color: #4f46e5;
            font-weight: 600;
            border-top: 1px dashed #d1d5db;
            padding-top: 6px;
          }
          @media print {
            body { padding: 0; }
            .card { border-color: #d1d5db; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${deckTitle}</div>
          <div class="subtitle">Recall.ai Flashcard Cheat Sheet • ${cards.length} Cards • ${new Date().toLocaleDateString()}</div>
        </div>
        <div class="grid">
          ${cards
            .map(
              (c, i) => `
            <div class="card">
              <div class="question">Q${i + 1}: ${c.front}</div>
              <div class="answer">A: ${c.back}</div>
            </div>
          `
            )
            .join("")}
        </div>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
