import type { AnalysisResult, MoneyLeak, Transaction, CategoryTotal, MonthlyTrend, Personality } from "./types";

export function formatZAR(n: number): string {
  const v = Math.round(Math.abs(n) * 100) / 100;
  const s = v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}R ${s}`;
}

const SALARY_RE = /\b(salary|salaris|payroll|wages|wage|nett?\s?pay|net\s?pay|employer|stipend|sal\s?credit|salary\s?credit|salary\s?ref|emp\s?sal)\b/i;

function normDesc(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/\d+/g, "").trim().slice(0, 40);
}

export function analyze(transactions: Transaction[]): AnalysisResult {
  // Months covered (sorted unique)
  const monthSet = new Set(transactions.map((t) => t.date.slice(0, 7)));
  const monthsCount = Math.max(monthSet.size, 1);

  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((a, b) => a + b.amount, 0);
  const totalSpend = transactions.filter((t) => t.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);

  // Detect recurring salary: an Income transaction appearing in 2+ different months with similar amount
  const salaryByMonth = new Map<string, number[]>();
  for (const t of transactions) {
    if (t.amount <= 0) continue;
    if (!(t.category === "Income" || SALARY_RE.test(t.description))) continue;
    const m = t.date.slice(0, 7);
    if (!salaryByMonth.has(m)) salaryByMonth.set(m, []);
    salaryByMonth.get(m)!.push(t.amount);
  }
  const hasRecurringSalary = salaryByMonth.size >= 2;

  // by category (outflows only)
  const catMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + Math.abs(t.amount));
  }
  const byCategory: CategoryTotal[] = [...catMap.entries()]
    .map(([category, total]) => ({ category: category as any, total, pct: total / Math.max(totalSpend, 1) }))
    .sort((a, b) => b.total - a.total);

  // monthly
  const monthMap = new Map<string, { spend: number; income: number }>();
  for (const t of transactions) {
    const m = t.date.slice(0, 7);
    const cur = monthMap.get(m) ?? { spend: 0, income: 0 };
    if (t.amount < 0) cur.spend += Math.abs(t.amount);
    else cur.income += t.amount;
    monthMap.set(m, cur);
  }
  const monthly: MonthlyTrend[] = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({ month, ...v }));

  // Savings contributed (transfers out to savings)
  const savingsContributed = transactions
    .filter((t) => t.amount < 0 && t.category === "Savings & Transfers")
    .reduce((a, b) => a + Math.abs(b.amount), 0);

  // Real spend excludes savings transfers (those are savings, not consumption)
  const consumptionSpend = totalSpend - savingsContributed;
  const savingsRate = totalIncome > 0
    ? Math.max(0, Math.min(1, (totalIncome - consumptionSpend) / totalIncome))
    : 0;

  // recurring
  const recMap = new Map<string, { description: string; amount: number; count: number; months: Set<string> }>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const k = normDesc(t.description);
    if (!k) continue;
    const cur = recMap.get(k) ?? { description: t.description, amount: 0, count: 0, months: new Set() };
    cur.count += 1;
    cur.amount += Math.abs(t.amount);
    cur.months.add(t.date.slice(0, 7));
    recMap.set(k, cur);
  }
  const recurring = [...recMap.values()]
    .filter((r) => r.months.size >= 2)
    .map((r) => ({ description: r.description, amount: r.amount, count: r.count }))
    .sort((a, b) => b.amount - a.amount);

  // leaks
  const leaks: MoneyLeak[] = [];
  const subs = transactions.filter((t) => t.category === "Subscriptions");
  if (subs.length) {
    const subTotal = subs.reduce((a, b) => a + Math.abs(b.amount), 0);
    const subsPerMonth = subTotal / monthsCount;
    leaks.push({
      label: `${new Set(subs.map((s) => normDesc(s.description))).size} active subscriptions`,
      detail: [...new Set(subs.map((s) => s.description.split(" ").slice(0, 2).join(" ")))].slice(0, 3).join(", "),
      amount: subsPerMonth,
      severity: subsPerMonth > 800 ? "high" : subsPerMonth > 400 ? "medium" : "low",
    });
  }
  const charges = transactions.filter((t) => t.category === "Bank Charges");
  if (charges.length) {
    leaks.push({
      label: "Bank & ATM charges",
      detail: `${charges.length} fees across the period`,
      amount: charges.reduce((a, b) => a + Math.abs(b.amount), 0),
      severity: "medium",
    });
  }
  const small = transactions.filter((t) => t.category === "Dining & Entertainment" && Math.abs(t.amount) < 250);
  if (small.length >= 4) {
    leaks.push({
      label: "Repeated small takeaways",
      detail: `${small.length} micro-purchases under R250`,
      amount: small.reduce((a, b) => a + Math.abs(b.amount), 0),
      severity: small.length >= 8 ? "high" : "low",
    });
  }
  if (monthly.length >= 2) {
    const last = monthly[monthly.length - 1];
    const prevAvg = monthly.slice(0, -1).reduce((a, b) => a + b.spend, 0) / (monthly.length - 1);
    if (last.spend > prevAvg * 1.2) {
      leaks.push({
        label: "Unusual spending spike",
        detail: `${last.month} spend up ${Math.round(((last.spend - prevAvg) / prevAvg) * 100)}% vs your average`,
        amount: last.spend - prevAvg,
        severity: "high",
      });
    }
  }

  const recent = monthly.slice(-3);
  const forecastNextMonth = recent.length
    ? recent.reduce((a, b, i) => a + b.spend * (i + 1), 0) / recent.reduce((a, _b, i) => a + (i + 1), 0)
    : totalSpend / monthsCount;

  const merchMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const key = t.description.split(/\s{2,}|\d/)[0].trim().slice(0, 24);
    merchMap.set(key, (merchMap.get(key) ?? 0) + Math.abs(t.amount));
  }
  const topMerchants = [...merchMap.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return {
    transactions,
    totalSpend,
    totalIncome,
    net: totalIncome - totalSpend,
    monthsCount,
    avgMonthlyIncome: totalIncome / monthsCount,
    avgMonthlySpend: totalSpend / monthsCount,
    savingsRate,
    savingsContributed,
    byCategory,
    monthly,
    recurring,
    leaks,
    forecastNextMonth,
    topMerchants,
    hasRecurringSalary,
  };
}

/**
 * Personality scoring based on multiple weighted signals, not just total spend.
 * Returns a confidence score so the UI can hedge low-signal verdicts.
 */
export function determinePersonality(a: AnalysisResult): Personality {
  const diningPct = a.byCategory.find((c) => c.category === "Dining & Entertainment")?.pct ?? 0;
  const shoppingPct = a.byCategory.find((c) => c.category === "Shopping")?.pct ?? 0;
  const subsPct = a.byCategory.find((c) => c.category === "Subscriptions")?.pct ?? 0;
  const chargesPct = a.byCategory.find((c) => c.category === "Bank Charges")?.pct ?? 0;

  // Volatility of monthly spend (CV) — high CV => impulsive
  let cv = 0;
  if (a.monthly.length >= 2) {
    const spends = a.monthly.map((m) => m.spend);
    const mean = spends.reduce((x, y) => x + y, 0) / spends.length;
    const variance = spends.reduce((x, y) => x + (y - mean) ** 2, 0) / spends.length;
    cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  }

  // Score candidates
  const scores: Record<string, number> = {
    saver: 0,
    steady: 0,
    impulse: 0,
    subscriber: 0,
    livingLarge: 0,
  };

  // Saver signals
  if (a.savingsRate >= 0.2) scores.saver += 3;
  else if (a.savingsRate >= 0.1) scores.saver += 1.5;
  if (a.savingsContributed > 0) scores.saver += 1;
  if (shoppingPct < 0.1 && diningPct < 0.1) scores.saver += 1;
  if (cv < 0.15 && a.monthly.length >= 2) scores.saver += 0.5;

  // Steady signals
  if (a.savingsRate >= 0.05 && a.savingsRate < 0.2) scores.steady += 2;
  if (cv < 0.2) scores.steady += 1;
  if (a.hasRecurringSalary) scores.steady += 0.5;

  // Impulse signals
  if (shoppingPct > 0.2) scores.impulse += 2;
  if (diningPct > 0.18) scores.impulse += 1.5;
  if (cv > 0.3) scores.impulse += 1.5;

  // Subscription collector
  if (subsPct > 0.1) scores.subscriber += 2;
  if (a.byCategory.find((c) => c.category === "Subscriptions") && (a.recurring.filter((r) => /netflix|spotify|showmax|apple|google|adobe|microsoft|disney|prime|dstv/i.test(r.description)).length >= 4)) {
    scores.subscriber += 1.5;
  }

  // Living large — ONLY if outflows consistently exceed income AND no savings
  if (a.totalIncome > 0 && a.totalSpend > a.totalIncome * 1.05 && a.savingsContributed === 0) {
    scores.livingLarge += 3;
  } else if (a.totalIncome === 0 && a.totalSpend > 0) {
    // unknown income — don't accuse, fall back to steady/other
    scores.livingLarge += 0; // suppressed
  }
  if (chargesPct > 0.05) scores.livingLarge += 0.5;

  // Pick top
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topKey, topScore] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  const margin = topScore - second;
  const totalSignal = Object.values(scores).reduce((x, y) => x + y, 0);
  // confidence: needs enough months + clear margin + meaningful signal
  let confidence = 0;
  if (totalSignal > 0) {
    confidence = Math.min(1, (topScore / Math.max(totalSignal, 1)) * 0.6 + (margin / Math.max(topScore, 1)) * 0.3 + Math.min(a.monthsCount / 3, 1) * 0.1);
  }

  // Low-confidence fallback: don't make a strong claim
  if (confidence < 0.35 || topScore < 1.5) {
    return {
      name: "Building Your Profile",
      description: a.monthsCount < 2
        ? "We need at least 2 months of statements to lock in a personality. Upload more to sharpen the read."
        : "Your patterns are mixed. Keep tracking — once habits stabilise we'll give a sharper verdict.",
      confidence,
    };
  }

  const map: Record<string, { name: string; description: string }> = {
    saver: {
      name: "The Protea Saver",
      description: `Disciplined and consistent — you're banking roughly ${Math.round(a.savingsRate * 100)}% of income. Keep automating transfers and your runway will compound.`,
    },
    steady: {
      name: "The Steady Navigator",
      description: "Balanced and predictable. Your habits are stable — pushing your savings rate to 20% would unlock real momentum.",
    },
    impulse: {
      name: "The Impulse Explorer",
      description: "You enjoy the moment — shopping and dining are pulling weight. A 24-hour rule on non-essentials would tighten things up fast.",
    },
    subscriber: {
      name: "The Subscription Collector",
      description: "Convenience-driven, but recurring fees are quietly eating margin. Audit your subscriptions and kill two you haven't used this month.",
    },
    livingLarge: {
      name: "The Living-Large Spender",
      description: "Outflows are beating income with no savings buffer. Time to plug leaks and rebuild a cushion before next month.",
    },
  };

  return { ...map[topKey], confidence };
}
