import * as pdfjsLib from "pdfjs-dist";
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
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as any[]) {
      if (!item.str) continue;
      // Round y to nearest 2 to merge near-aligned glyphs
      const y = Math.round(item.transform[5] / 2) * 2;
      const x = item.transform[4];
      const arr = rows.get(y) ?? [];
      arr.push({ x, str: item.str });
      rows.set(y, arr);
    }
    const ys = [...rows.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      const joined = row.map((r) => r.str).join(" ").replace(/\s+/g, " ").trim();
      if (joined) lines.push(joined);
    }
    lines.push("");
  }
  return lines.join("\n");
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
};

const DATE_RE = new RegExp(
  [
    "\\b(\\d{4}-\\d{2}-\\d{2})\\b",                                // 2025-04-01
    "\\b(\\d{1,2}[\\/\\-.]\\d{1,2}[\\/\\-.]\\d{2,4})\\b",        // 01/04/2025
    "\\b(\\d{1,2}[\\s\\-\\/]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[\\s\\-\\/]+\\d{2,4})\\b", // 1 Apr 2025
    "\\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\s+\\d{1,2},?\\s+\\d{2,4})\\b",               // Apr 1, 2025
  ].join("|"),
  "i",
);

function normalizeDate(raw: string): string | null {
  const s = raw.trim();
  // ISO
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // d Mon yyyy
  m = s.match(/^(\d{1,2})[\s\-\/]+([A-Za-z]{3,9})[\s\-\/]+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${mo}-${m[1].padStart(2, "0")}`;
  }
  // Mon d, yyyy
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (!mo) return null;
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${mo}-${m[2].padStart(2, "0")}`;
  }
  // dd/mm/yyyy
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

// Match amounts with comma/space thousand separators and . or , decimal. Accept Cr/Dr/parens/trailing minus.
const AMOUNT_RE = /(-?\(?\s*(?:R|ZAR)?\s*\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})\s*\)?(?:\s*(?:Cr|CR|Dr|DR|-))?)/g;

function parseAmountToken(raw: string): { value: number; signed: boolean } {
  const s = raw.trim();
  const isCr = /\b(Cr|CR)\b/.test(s);
  const isDr = /\b(Dr|DR)\b/.test(s);
  const negParen = /^\(.*\)$/.test(s);
  const leadingNeg = /^-/.test(s);
  const trailingNeg = /-\s*$/.test(s);
  let cleaned = s.replace(/[()RZARcCrRdDr\s\-]/g, (m) => (m === "." || m === "," ? m : ""));
  if (/,\d{2}$/.test(cleaned) && !/\.\d/.test(cleaned)) cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  else cleaned = cleaned.replace(/,/g, "");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return { value: NaN, signed: false };
  const signed = isCr || isDr || negParen || leadingNeg || trailingNeg;
  let v = Math.abs(n);
  if (negParen || trailingNeg || isDr || leadingNeg) v = -v;
  else if (isCr) v = v;
  return { value: v, signed };
}

const SKIP_RE = /^(opening|closing|balance|brought forward|carried forward|statement|page\s+\d|total|sub\s?total|account\s+(no|number)|period)/i;

export function parseStatementText(text: string): Transaction[] {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const txns: Transaction[] = [];

  for (const line of lines) {
    if (SKIP_RE.test(line)) continue;
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) continue;
    const dateStr = dateMatch[0];
    const date = normalizeDate(dateStr);
    if (!date) continue;

    const amounts = [...line.matchAll(AMOUNT_RE)].map((m) => ({ raw: m[0], idx: m.index ?? 0 }));
    if (amounts.length === 0) continue;

    // Heuristic: last amount is usually running balance. Use second-to-last as txn amount.
    // If only one amount, that IS the transaction.
    const amtRaw = amounts.length >= 2 ? amounts[amounts.length - 2].raw : amounts[0].raw;
    const { value, signed } = parseAmountToken(amtRaw);
    if (!Number.isFinite(value) || value === 0) continue;
    // If no explicit sign annotation, default to outflow (most line items on statements are debits)
    let amount = signed ? value : -Math.abs(value);

    // Description = text between date and first amount
    const dateEnd = (dateMatch.index ?? 0) + dateStr.length;
    const firstAmtIdx = amounts[0].idx;
    let description = line.slice(dateEnd, firstAmtIdx).trim();
    description = description.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "").replace(/\s+/g, " ");
    if (!description || description.length < 2) continue;
    if (SKIP_RE.test(description)) continue;

    // Re-categorize; if categorize says Income but amount was outflow-defaulted, flip
    const guessedCat = categorize(description, Math.abs(amount));
    if (guessedCat === "Income" && amount < 0 && !signed) amount = Math.abs(amount);

    txns.push({ date, description, amount, category: categorize(description, amount) });
  }

  // De-duplicate
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
