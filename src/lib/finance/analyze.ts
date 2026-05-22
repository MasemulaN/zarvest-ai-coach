import type { AnalysisResult, MoneyLeak, Transaction, CategoryTotal, MonthlyTrend } from "./types";

export function formatZAR(n: number): string {
  const v = Math.round(Math.abs(n) * 100) / 100;
  const s = v.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? "-" : ""}R ${s}`;
}

export function analyze(transactions: Transaction[]): AnalysisResult {
  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((a, b) => a + b.amount, 0);
  const totalSpend = transactions.filter((t) => t.amount < 0).reduce((a, b) => a + Math.abs(b.amount), 0);

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

  // recurring detection: same normalized description, 2+ months
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/\d+/g, "").trim().slice(0, 40);
  const recMap = new Map<string, { description: string; amount: number; count: number; months: Set<string> }>();
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const k = norm(t.description);
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

  // money leaks
  const leaks: MoneyLeak[] = [];
  const subs = transactions.filter((t) => t.category === "Subscriptions");
  if (subs.length) {
    const subTotal = subs.reduce((a, b) => a + Math.abs(b.amount), 0);
    leaks.push({
      label: `${new Set(subs.map((s) => norm(s.description))).size} active subscriptions`,
      detail: subs.map((s) => s.description.split(" ").slice(0, 2).join(" ")).slice(0, 3).join(", "),
      amount: subTotal / Math.max(monthly.length, 1),
      severity: subTotal > 800 * monthly.length ? "high" : "medium",
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
  // small repeated takeaway
  const small = transactions.filter((t) => t.category === "Dining & Entertainment" && Math.abs(t.amount) < 250);
  if (small.length >= 4) {
    leaks.push({
      label: "Repeated small takeaways",
      detail: `${small.length} micro-purchases under R250`,
      amount: small.reduce((a, b) => a + Math.abs(b.amount), 0),
      severity: small.length >= 8 ? "high" : "low",
    });
  }
  // unusual spike vs avg monthly category
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

  // forecast: weighted average of last 3 months spend
  const recent = monthly.slice(-3);
  const forecastNextMonth = recent.length
    ? recent.reduce((a, b, i) => a + b.spend * (i + 1), 0) / recent.reduce((a, _b, i) => a + (i + 1), 0)
    : totalSpend / Math.max(monthly.length, 1);

  // top merchants
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
    byCategory,
    monthly,
    recurring,
    leaks,
    forecastNextMonth,
    topMerchants,
  };
}

export function determinePersonality(a: AnalysisResult): { name: string; description: string } {
  const savingsRate = a.totalIncome > 0 ? (a.totalIncome - a.totalSpend) / a.totalIncome : 0;
  const diningPct = (a.byCategory.find((c) => c.category === "Dining & Entertainment")?.pct ?? 0);
  const shoppingPct = (a.byCategory.find((c) => c.category === "Shopping")?.pct ?? 0);
  const subsPct = (a.byCategory.find((c) => c.category === "Subscriptions")?.pct ?? 0);

  if (savingsRate > 0.2 && shoppingPct < 0.1) return { name: "The Protea Saver", description: "Disciplined and consistent. You prioritize long-term security over impulse treats." };
  if (shoppingPct > 0.2 || diningPct > 0.18) return { name: "The Impulse Explorer", description: "You enjoy the moment. Small treats add up — a little restraint goes a long way." };
  if (subsPct > 0.1) return { name: "The Subscription Collector", description: "Convenience-driven, but recurring fees are quietly eating your margin." };
  if (savingsRate > 0.05) return { name: "The Steady Navigator", description: "Balanced. Your habits are stable but there's runway to grow your savings rate." };
  return { name: "The Living-Large Spender", description: "Outflows are matching or beating income. Time to plug a few leaks and rebuild your cushion." };
}
