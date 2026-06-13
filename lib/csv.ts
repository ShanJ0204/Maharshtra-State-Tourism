import type { PromptRow } from "./types";

/** Quote a value for CSV output when it contains commas, quotes or newlines. */
export function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialize prompt rows back into CSV text (used by the prompt generator). */
export function promptsToCSV(rows: { prompt: string; category?: string }[]): string {
  const lines = ["prompt,category"];
  for (const r of rows) {
    lines.push(`${csvEscape(r.prompt)},${csvEscape(r.category ?? "")}`);
  }
  return lines.join("\n");
}

/**
 * Minimal, dependency-free CSV parser that handles quoted fields, escaped
 * quotes ("") and embedded commas/newlines.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      // handle \r\n as a single break
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  // flush last field/row
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

/**
 * Turn CSV text into prompt rows. Flexible about headers:
 *  - If a header row contains a "prompt"/"query"/"question" column, that column
 *    is used (plus optional "category" and "id").
 *  - Otherwise the first column of every row is treated as the prompt.
 */
export function parsePrompts(text: string): PromptRow[] {
  const grid = parseCSV(text.trim());
  if (grid.length === 0) return [];

  const header = grid[0].map((h) => h.trim().toLowerCase());
  const promptIdx = header.findIndex((h) =>
    ["prompt", "query", "question", "prompts"].includes(h),
  );

  let dataRows = grid;
  let pIdx = 0;
  let catIdx = -1;
  let idIdx = -1;

  if (promptIdx !== -1) {
    pIdx = promptIdx;
    catIdx = header.findIndex((h) => ["category", "topic", "tag"].includes(h));
    idIdx = header.findIndex((h) => ["id", "#"].includes(h));
    dataRows = grid.slice(1);
  }

  const out: PromptRow[] = [];
  dataRows.forEach((cols, i) => {
    const prompt = (cols[pIdx] ?? "").trim();
    if (!prompt) return;
    out.push({
      id: idIdx !== -1 && cols[idIdx] ? cols[idIdx].trim() : `p${i + 1}`,
      prompt,
      category: catIdx !== -1 && cols[catIdx] ? cols[catIdx].trim() : undefined,
    });
  });
  return out;
}
