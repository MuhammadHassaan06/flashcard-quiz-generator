export interface ExportableCard {
  front: string;
  back: string;
}

/**
 * Builds an Anki-importable file (tab-separated front/back, one card per line)
 * and triggers a browser download. Import in Anki via
 * File -> Import -> select this .txt -> set field separator to Tab.
 */
export function exportDeckToAnki(deckTitle: string, cards: ExportableCard[]) {
  const escapeField = (text: string) => text.replace(/\t/g, " ").replace(/\n/g, "<br>");

  const lines = cards.map((c) => `${escapeField(c.front)}\t${escapeField(c.back)}`);
  const content = lines.join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const safeName = deckTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50) || "deck";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}-anki-export.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}