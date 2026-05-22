import * as pdfjsLib from "pdfjs-dist";
// Use the bundled worker via Vite ?url import
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { Transaction } from "./types";
import { categorize } from "./csv";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/** Extract raw text from a PDF, line-by-line, preserving reading order. */
export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Group items by y-coordinate (rounded) to reconstruct lines
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as any[]) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      const arr = rows.get(y) ?? [];
      arr.push({ x, str: item.str });
      rows.set(y, arr);
    }
    const ys = [...rows.keys()].sort((a, b) => b - a); // top to bottom
    for (const y of ys) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      lines.push(row.map((r) => r.str).join(" ").replace(/\s+/g, " ").trim());
    }
    lines.push(""); // page break
  }
  return lines.filter(Boolean).join("\n");
}

const DATE_RE =
  /\b(\d{1,2}[\/\-.](?:\d{1,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4})\b/i;

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // dd Mon yyyy
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) return null;
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${mo}-${m[1].padStart(2, "0")}`;
  }
  // dd/mm/yyyy or dd-Mon-yy
  m = s.match(/^(\d{1,2})[\/\-.]([A-Za-z]{3}|\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const moRaw = m[2];
    const mo = /^\d+$/.test(moRaw) ? moRaw.padStart(2, "0") : MONTHS[moRaw.toLowerCase()];
    if (!mo) return null;
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${mo}-${m[1].padStart(2, "0")}`;
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

const AMOUNT_RE = /-?\(?\s*(?:R|ZAR)?\s*-?\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})\s*\)?(?:\s*(?:Cr|CR|DR|Dr|-))?/g;

function parseAmount(raw: string): number {
  let s = raw.trim();
  const isCr = /\b(Cr|CR)\b/.test(s);
  const isDr = /\b(Dr|DR)\b/.test(s);
  const negParen = /^\(.*\)$/.test(s);
  const trailingNeg = /-\s*$/.test(s);
  s = s.replace(/[()RZARcrCrDrDR\-\s]/g, (m) => (m === "." || m === "," ? m : ""));
  // Decide decimal separator
  if (/,\d{2}$/.test(s) && !/\.\d/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  let v = Math.abs(n);
  if (negParen || trailingNeg || isDr) v = -v;
  else if (isCr) v = v;
  else v = -v; // default: bank statements list debits as positive — treat unannotated as outflow? safer: use sign as given
  // Override: if original had explicit minus, respect it
  if (/^-/.test(raw.trim())) v = -Math.abs(n);
  return v;
}

/** Heuristic: parse transactions out of a flat statement text. */
export function parseStatementText(text: string): Transaction[] {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const txns: Transaction[] = [];

  for (const line of lines) {
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;
    const date = normalizeDate(dateMatch[0]);
    if (!date) continue;

    const amounts = [...line.matchAll(AMOUNT_RE)].map((m) => ({
      raw: m[0],
      idx: m.index ?? 0,
    }));
    if (amounts.length === 0) continue;

    // Prefer the LAST amount on the line (typically the transaction amount or balance).
    // If two+ amounts, use the second-to-last (amount), last is balance.
    const amtRaw = amounts.length >= 2 ? amounts[amounts.length - 2].raw : amounts[amounts.length - 1].raw;
    const amount = parseAmount(amtRaw);
    if (!Number.isFinite(amount) || amount === 0) continue;

    // Description = text between date and first amount
    const dateEnd = (dateMatch.index ?? 0) + dateMatch[0].length;
    const firstAmtIdx = amounts[0].idx;
    let description = line.slice(dateEnd, firstAmtIdx).trim();
    description = description.replace(/^\W+|\W+$/g, "").replace(/\s+/g, " ");
    if (!description || description.length < 2) continue;
    if (/^(balance|opening|closing|total|brought forward|carried forward)/i.test(description)) continue;

    txns.push({ date, description, amount, category: categorize(description, amount) });
  }

  // De-duplicate exact rows
  const seen = new Set<string>();
  return txns
    .filter((t) => {
      const k = `${t.date}|${t.description}|${t.amount}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function parsePDF(file: File): Promise<Transaction[]> {
  const text = await extractPdfText(file);
  return parseStatementText(text);
}
