import type { Transaction, Category } from "./types";

const CATEGORY_RULES: Array<{ pattern: RegExp; category: Category }> = [
  { pattern: /woolworths|pick.?n.?pay|checkers|spar|food.?lover|shoprite|fruit|butcher/i, category: "Food & Groceries" },
  { pattern: /uber\s?eats|mr\s?d|takealot|food|kfc|nando|mcdonald|steers|debonairs|burger|sushi|cafe|restaurant|coffee|starbucks|vida/i, category: "Dining & Entertainment" },
  { pattern: /uber|bolt|engen|shell|bp|sasol|caltex|total|fuel|petrol|gautrain|metrorail/i, category: "Transport & Fuel" },
  { pattern: /netflix|showmax|spotify|apple\.?com|icloud|youtube|disney|amazon prime|dstv|playstation|xbox|chatgpt|openai|midjourney|notion|figma|adobe|microsoft|google one/i, category: "Subscriptions" },
  { pattern: /vodacom|mtn|telkom|cell\s?c|rain|eskom|city of|municipal|water|electricity|wifi|fibre|afrihost|webafrica|insurance|discovery|momentum|sanlam|outsurance/i, category: "Bills & Utilities" },
  { pattern: /takealot|amazon|mr price|h&m|zara|truworths|edgars|game|makro|incredible|loot|superbalist|game store/i, category: "Shopping" },
  { pattern: /transfer to|savings|tymebank|easy equities|investec|allan gray|coronation|tfsa|crypto|luno|valr/i, category: "Savings & Transfers" },
  { pattern: /salary|payroll|wages|deposit from|refund|interest earned|payment received|income/i, category: "Income" },
  { pattern: /bank charge|service fee|monthly fee|atm fee|cash withdrawal fee|overdraft/i, category: "Bank Charges" },
];

export function categorize(description: string, amount: number): Category {
  if (amount > 0 && /salary|payroll|wages|deposit|refund|interest|received/i.test(description)) return "Income";
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(description)) return rule.category;
  }
  return "Other";
}

function parseAmount(raw: string): number {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/"/g, "");
  if (!s) return NaN;
  const negParen = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, "");
  s = s.replace(/R|ZAR|\s/gi, "");
  // Handle "1,234.56" or "1 234,56"
  if (/,\d{2}$/.test(s) && !/\.\d/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  return negParen ? -Math.abs(n) : n;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/"/g, "");
  // try ISO
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [_, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    const date = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return null;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === "," && !inQ) { result.push(cur); cur = ""; continue; }
    cur += c;
  }
  result.push(cur);
  return result;
}

export function parseCSV(text: string): Transaction[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Find header row
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    if (/date/i.test(lines[i]) && /(amount|debit|credit|value)/i.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  const headers = splitCSVLine(lines[headerIdx]).map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => /date/.test(h));
  const descIdx = headers.findIndex((h) => /desc|narrative|details|reference|memo/.test(h));
  const amtIdx = headers.findIndex((h) => /^amount$|value/.test(h));
  const debitIdx = headers.findIndex((h) => /debit|out|withdraw/.test(h));
  const creditIdx = headers.findIndex((h) => /credit|in|deposit/.test(h));

  const txns: Transaction[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    const date = parseDate(cols[dateIdx >= 0 ? dateIdx : 0]);
    if (!date) continue;
    const description = (cols[descIdx >= 0 ? descIdx : 1] || "").trim();
    if (!description) continue;
    let amount = NaN;
    if (amtIdx >= 0) amount = parseAmount(cols[amtIdx]);
    else if (debitIdx >= 0 || creditIdx >= 0) {
      const d = debitIdx >= 0 ? parseAmount(cols[debitIdx]) : 0;
      const c = creditIdx >= 0 ? parseAmount(cols[creditIdx]) : 0;
      const dn = Number.isNaN(d) ? 0 : d;
      const cn = Number.isNaN(c) ? 0 : c;
      amount = cn - Math.abs(dn);
    }
    if (Number.isNaN(amount) || amount === 0) continue;
    txns.push({ date, description, amount, category: categorize(description, amount) });
  }
  return txns.sort((a, b) => a.date.localeCompare(b.date));
}

export const SAMPLE_CSV = `Date,Description,Amount
2025-04-01,Salary - Employer Pty Ltd,38500.00
2025-04-02,Woolworths Sandton,-1240.55
2025-04-02,Vodacom Monthly,-899.00
2025-04-03,Uber Trip,-87.50
2025-04-04,Netflix Subscription,-199.00
2025-04-04,Showmax,-99.00
2025-04-05,Engen Garage,-820.00
2025-04-06,Takealot Order,-1450.00
2025-04-07,Pick n Pay,-624.20
2025-04-08,Uber Eats Mr D,-189.00
2025-04-09,Spotify Premium,-69.00
2025-04-10,Transfer to Savings,-3000.00
2025-04-11,FNB Monthly Fee,-115.00
2025-04-12,Checkers,-512.40
2025-04-14,KFC Drive Thru,-145.00
2025-04-15,Eskom Prepaid,-1100.00
2025-04-17,Discovery Health,-2450.00
2025-04-18,Vida e Caffe,-58.00
2025-04-19,Shell Sandton,-790.00
2025-04-20,Takealot Order,-380.00
2025-04-22,Uber Trip,-112.00
2025-04-23,Netflix Subscription,-199.00
2025-04-24,Apple iCloud,-39.00
2025-04-26,Woolworths Rosebank,-980.00
2025-04-28,Mr Price,-560.00
2025-04-30,Bank Charges,-85.00
2025-05-01,Salary - Employer Pty Ltd,38500.00
2025-05-02,Woolworths Sandton,-1320.00
2025-05-02,Vodacom Monthly,-899.00
2025-05-03,Uber Eats,-220.00
2025-05-04,Netflix Subscription,-199.00
2025-05-05,Engen Garage,-880.00
2025-05-06,Takealot Order,-2100.00
2025-05-07,Pick n Pay,-712.00
2025-05-08,Spotify Premium,-69.00
2025-05-10,Transfer to Savings,-3000.00
2025-05-11,FNB Monthly Fee,-115.00
2025-05-13,Checkers,-489.00
2025-05-14,Nandos Melrose,-198.00
2025-05-15,Eskom Prepaid,-1200.00
2025-05-17,Discovery Health,-2450.00
2025-05-19,Shell Sandton,-810.00
2025-05-22,Uber Trip,-95.00
2025-05-23,Netflix Subscription,-199.00
2025-05-24,Apple iCloud,-39.00
2025-05-26,Woolworths,-1100.00
2025-05-28,Mr Price,-340.00
2025-05-30,Bank Charges,-95.00
2025-06-01,Salary - Employer Pty Ltd,38500.00
2025-06-02,Woolworths Sandton,-1580.00
2025-06-02,Vodacom Monthly,-899.00
2025-06-03,Uber Eats Mr D,-285.00
2025-06-04,Netflix Subscription,-199.00
2025-06-04,Showmax,-99.00
2025-06-05,Engen Garage,-940.00
2025-06-06,Takealot Order,-3200.00
2025-06-07,Pick n Pay,-820.00
2025-06-08,Spotify Premium,-69.00
2025-06-09,KFC,-178.00
2025-06-10,Transfer to Savings,-2000.00
2025-06-11,FNB Monthly Fee,-115.00
2025-06-13,Checkers,-612.00
2025-06-15,Eskom Prepaid,-1350.00
2025-06-16,Vida e Caffe,-72.00
2025-06-17,Discovery Health,-2450.00
2025-06-18,Uber Trip,-145.00
2025-06-19,Shell Sandton,-890.00
2025-06-20,Takealot Order,-1280.00
2025-06-22,Burger King,-210.00
2025-06-23,Netflix Subscription,-199.00
2025-06-24,Apple iCloud,-39.00
2025-06-26,Woolworths,-1340.00
2025-06-27,Mr Price,-450.00
2025-06-28,Sushi Mae Sandton,-680.00
2025-06-30,Bank Charges,-85.00
2025-06-30,ATM Withdrawal Fee,-35.00
`;
