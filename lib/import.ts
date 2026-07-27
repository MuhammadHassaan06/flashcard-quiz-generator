/**
 * Parses a raw copy-pasted string (CSV or TSV) into a list of front/back cards.
 * Autodetects whether the separator is a tab or a comma.
 */
export function parseImportText(text: string): { front: string; back: string }[] {
  const lines = text.split("\n");
  const cards: { front: string; back: string }[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith("#")) continue; // Skip comments and empty lines

    // Autodetect separator: Tab is preferred (from Anki exports), then comma
    let separator = "\t";
    if (!line.includes("\t") && line.includes(",")) {
      separator = ",";
    }

    const parts = line.split(separator);
    if (parts.length >= 2) {
      const front = parts[0].replace(/^["']|["']$/g, "").trim(); // strip outer quotes
      const back = parts.slice(1).join(separator).replace(/^["']|["']$/g, "").trim();
      
      if (front && back) {
        cards.push({ front, back });
      }
    }
  }
  return cards;
}
