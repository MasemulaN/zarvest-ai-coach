import type { Transaction, Category } from "./types";

const CATEGORY_RULES: Array<{ pattern: RegExp; category: Category }> = [
  // Income first — needs to win over generic patterns
  { pattern: /\b(salary|salaris|payroll|wages|wage|stipend|nett?\s?pay|net\s?pay|employer|emp\s?sal|sal\s?credit|salary\s?credit|salary\s?ref|inc\s?sal)\b/i, category: "Income" },
  { pattern: /\b(deposit from|payment received|payment from|refund|interest earned|interest credit|dividend|eft\s?credit|credit transfer received)\b/i, category: "Income" },
  // Savings & transfers
  { pattern: /\b(transfer to|tfr to|xfer to|savings|save|tymebank|easy equities|easyequities|investec|allan gray|coronation|tfsa|retirement|ra contribution|crypto|luno|valr|vault)\b/i, category: "Savings & Transfers" },
  // Bank charges
  { pattern: /\b(bank charge|service fee|monthly fee|admin fee|account fee|atm fee|cash withdrawal fee|overdraft|debit order fee|notification fee|sms fee|honour fee|dishonour fee)\b/i, category: "Bank Charges" },
  // Subscriptions
  { pattern: /\b(netflix|showmax|spotify|apple\.?com|apple music|icloud|youtube|disney|amazon prime|prime video|dstv|multichoice|playstation|xbox|chatgpt|openai|midjourney|notion|figma|adobe|microsoft 365|office 365|google one|linkedin premium|audible|kindle|patreon)\b/i, category: "Subscriptions" },
  // Bills & utilities
  { pattern: /\b(vodacom|mtn|telkom|cell\s?c|rain mobile|rain\b|eskom|prepaid electricity|city of (cape town|joburg|johannesburg|tshwane|ekurhuleni|durban)|municipal|water|electricity|rates|levy|wifi|fibre|fiber|afrihost|webafrica|cool ideas|vumatel|openserve|insurance|discovery|momentum|sanlam|outsurance|liberty|miway|king price|naked insurance|hollard|old mutual)\b/i, category: "Bills & Utilities" },
  // Shopping
  { pattern: /\b(takealot|amazon|mr\s?price|h&m|zara|truworths|edgars|game\b|makro|incredible connection|hifi corp|loot|superbalist|sportscene|totalsports|bash|woolworths online|builders warehouse|leroy merlin)\b/i, category: "Shopping" },
  // Transport & Fuel
  { pattern: /\b(uber(?!\s?eats)|bolt(?!\s?food)|engen|shell|bp\b|sasol|caltex|total energies|total\s|fuel|petrol|garage|gautrain|metrorail|prasa|parking|e-?toll|sanral|toll gate)\b/i, category: "Transport & Fuel" },
  // Dining
  { pattern: /\b(uber\s?eats|mr\s?d|mr delivery|bolt\s?food|kfc|nando|mcdonald|steers|debonairs|burger|sushi|cafe|restaurant|coffee|starbucks|vida|seattle coffee|wimpy|spur|ocean basket|col'?cacchio|romans pizza|fishaways|chicken licken)\b/i, category: "Dining & Entertainment" },
  // Groceries (after dining to avoid woolworths-cafe collision)
  { pattern: /\b(woolworths|pick.?n.?pay|pnp\b|checkers|spar\b|food\s?lover|shoprite|usave|boxer|fruit\s?&?\s?veg|butcher|liquor|tops\b)\b/i, category: "Food & Groceries" },
];

const INCOME_HINT = /\b(salary|salaris|payroll|wage|wages|nett?\s?pay|net\s?pay|employer|stipend|sal\s?credit|salary\s?credit|deposit from|payment received|payment from|refund|interest earned|interest credit|dividend|eft\s?credit|credit transfer)\b/i;

export function categorize(description: string, amount: number): Category {
  if (amount > 0 && INCOME_HINT.test(description)) return "Income";
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(description)) return rule.category;
  }
  // Fallback: positive amounts that look like reversals/credits but unmatched
  if (amount > 0) return "Income";
  return "Other";
}

function parseAmount(raw: string): number {
  if (raw == null) return NaN;
  let s = String(raw).trim().replace(/^"|"$/g, "");
  if (!s) return NaN;
  const isCr = /\b(cr)\b/i.test(s);
  const isDr = /\b(dr)\b/i.test(s);
  const negParen = /^\(.*\)$/.test(s);
  const trailingNeg = /-\s*$/.test(s);
  s = s.replace(/[()]/g, "");
  s = s.replace(/\b(cr|dr)\b/gi, "");
  s = s.replace(/[Rr]\s|ZAR|\s/g, "");
  // Decimal sep detection
  if (/,\d{1,2}$/.test(s) && !/\.\d/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  if (Number.isNaN(n)) return NaN;
  let v = n;
  if (negParen || trailingNeg || isDr) v = -Math.abs(n);
  else if (isCr) v = Math.abs(n);
  return v;
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^"|"$/g, "");
  if (!s) return null;
  // ISO yyyy-mm-dd
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // dd Mon yyyy
  const MONTHS: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12" };
  m = s.match(/^(\d{1,2})[\s\-\/.]+([A-Za-z]{3,4})[\s\-\/.]+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase().slice(0, 3)];
    if (mo) {
      const y = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${y}-${mo}-${m[1].padStart(2, "0")}`;
    }
  }
  // dd/mm/yyyy or dd-mm-yy
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [_, d, mo, y] = m;
    const yy = y.length === 2 ? "20" + y : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Fallback: Date.parse
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function detectDelimiter(sample: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestScore = -1;
  for (const d of candidates) {
    const lines = sample.split(/\r?\n/).slice(0, 20).filter((l) => l.trim());
    if (lines.length < 2) continue;
    const counts = lines.map((l) => splitLine(l, d).length);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + (b - avg) ** 2, 0) / counts.length;
    const score = avg - variance; // prefer many consistent columns
    if (avg >= 2 && score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

function splitLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; continue; }
      inQ = !inQ;
      continue;
    }
    if (c === delim && !inQ) { result.push(cur); cur = ""; continue; }
    cur += c;
  }
  result.push(cur);
  return result.map((s) => s.trim());
}

function stripBOM(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

export function parseCSV(text: string): Transaction[] {
  text = stripBOM(text);
  const allLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (allLines.length === 0) return [];

  const delim = detectDelimiter(text);

  // Find header row by scanning first 25 rows for date + amount-ish header
  let headerIdx = -1;
  for (let i = 0; i < Math.min(allLines.length, 25); i++) {
    const lower = allLines[i].toLowerCase();
    if (/date|datum|transaction date|posting date|trans date/.test(lower) &&
        /(amount|bedrag|debit|credit|value|money in|money out|withdrawal|deposit)/.test(lower)) {
      headerIdx = i;
      break;
    }
  }
  // If no header detected, attempt heuristic: first row whose columns look textual
  if (headerIdx < 0) headerIdx = 0;

  const headers = splitLine(allLines[headerIdx], delim).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const findIdx = (re: RegExp) => headers.findIndex((h) => re.test(h));

  const dateIdx = findIdx(/^(date|datum|transaction date|posting date|trans date|value date|effective date)$/) >= 0
    ? findIdx(/^(date|datum|transaction date|posting date|trans date|value date|effective date)$/)
    : findIdx(/date|datum/);
  const descIdx = findIdx(/^(description|desc|narrative|details|reference|memo|particulars|transaction|narration|payee)/);
  const amtIdx = findIdx(/^(amount|bedrag|value|trans amount|transaction amount)$/);
  const debitIdx = findIdx(/debit|out|withdraw|money out|debet/);
  const creditIdx = findIdx(/credit|in\b|deposit|money in|kredit/);
  const typeIdx = findIdx(/^(type|dr\/cr|d\/c|sign)$/);

  const txns: Transaction[] = [];
  for (let i = headerIdx + 1; i < allLines.length; i++) {
    const cols = splitLine(allLines[i], delim);
    if (cols.length < 2) continue;
    const date = parseDate(cols[dateIdx >= 0 ? dateIdx : 0]);
    if (!date) continue;
    const description = (cols[descIdx >= 0 ? descIdx : 1] || "").trim();
    if (!description || /^(opening|closing|balance|total|brought forward|carried forward)/i.test(description)) continue;

    let amount = NaN;
    if (amtIdx >= 0) {
      amount = parseAmount(cols[amtIdx]);
      if (typeIdx >= 0 && !Number.isNaN(amount)) {
        const t = (cols[typeIdx] || "").toLowerCase();
        if (/^(d|dr|debit|out)/.test(t)) amount = -Math.abs(amount);
        else if (/^(c|cr|credit|in)/.test(t)) amount = Math.abs(amount);
      }
    } else if (debitIdx >= 0 || creditIdx >= 0) {
      const d = debitIdx >= 0 ? parseAmount(cols[debitIdx]) : 0;
      const c = creditIdx >= 0 ? parseAmount(cols[creditIdx]) : 0;
      const dn = Number.isNaN(d) ? 0 : Math.abs(d);
      const cn = Number.isNaN(c) ? 0 : Math.abs(c);
      amount = cn - dn;
    } else {
      // Try last numeric column as amount
      for (let k = cols.length - 1; k >= 0; k--) {
        const v = parseAmount(cols[k]);
        if (!Number.isNaN(v) && v !== 0) { amount = v; break; }
      }
    }
    if (!Number.isFinite(amount) || amount === 0) continue;
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
