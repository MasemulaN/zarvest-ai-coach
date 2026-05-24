import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useFinance } from "@/lib/finance/store";
import { DashboardShell } from "@/components/app/DashboardShell";
import { SpendingChart, TrendChart } from "@/components/app/Charts";
import { formatZAR } from "@/lib/finance/analyze";
import { generateInsights } from "@/lib/finance/coach.functions";

export function Dashboard() {
  const { analysis, personality, coach, setCoach } = useFinance();
  const getInsights = useServerFn(generateInsights);

  useEffect(() => {
    if (!analysis || coach.headline || coach.loading) return;
    setCoach({ headline: "", advice: [], loading: true });
    const snapshot = [
      `Personality: ${personality?.name} (confidence ${Math.round((personality?.confidence ?? 0) * 100)}%)`,
      `Period: ${analysis.monthsCount} months, ${analysis.transactions.length} txns`,
      `Recurring salary detected: ${analysis.hasRecurringSalary ? "yes" : "no"}`,
      `Avg monthly income: ${formatZAR(analysis.avgMonthlyIncome)}`,
      `Avg monthly spend: ${formatZAR(analysis.avgMonthlySpend)}`,
      `Net total: ${formatZAR(analysis.net)}`,
      `Savings rate: ${Math.round(analysis.savingsRate * 100)}% (transferred ${formatZAR(analysis.savingsContributed)} to savings)`,
      `Forecast next month spend: ${formatZAR(analysis.forecastNextMonth)}`,
      `Top categories: ${analysis.byCategory.slice(0, 5).map((c) => `${c.category} ${formatZAR(c.total)} (${Math.round(c.pct * 100)}%)`).join("; ")}`,
      `Leaks: ${analysis.leaks.map((l) => `${l.label} ${formatZAR(-l.amount)}`).join("; ") || "none"}`,
    ].join("\n");
    getInsights({ data: { snapshot } })
      .then((r) => setCoach({ headline: r.headline, advice: r.advice, loading: false }))
      .catch(() => setCoach({ headline: "Your financial picture is ready.", advice: [], loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  if (!analysis || !personality) return null;
  const avgSpend = analysis.avgMonthlySpend;
  const avgIncome = analysis.avgMonthlyIncome;
  const lastMonth = analysis.monthly[analysis.monthly.length - 1];
  const prevAvg = analysis.monthly.length > 1
    ? analysis.monthly.slice(0, -1).reduce((a, b) => a + b.spend, 0) / (analysis.monthly.length - 1)
    : avgSpend;
  const trendPct = prevAvg > 0 ? ((lastMonth.spend - prevAvg) / prevAvg) * 100 : 0;

  return (
    <DashboardShell>
      <header className="mb-10 animate-slide-up">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-ai">Analysis complete · {analysis.monthsCount} months</p>
        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          {coach.headline || `Your average monthly spend is ${formatZAR(avgSpend)}.`}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {personality.name} — {personality.description}
        </p>
      </header>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <StatCard label="Avg monthly income" value={formatZAR(avgIncome)} accent />
        <StatCard label="Avg monthly spend" value={formatZAR(avgSpend)} sub={`${trendPct >= 1 ? "+" : ""}${Math.round(trendPct)}% vs prior avg`} subTone={trendPct > 0 ? "warn" : "good"} />
        <StatCard label="Next month forecast" value={formatZAR(analysis.forecastNextMonth)} highlight />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <SpendingChart analysis={analysis} />
          <TrendChart analysis={analysis} />
        </div>
        <div className="space-y-6 lg:col-span-4">
          <div className="rounded-3xl border border-border bg-surface p-6">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-emerald-ai">Quick summary</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Savings rate</span>
                <span className="font-mono font-bold">{Math.round(analysis.savingsRate * 100)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Recurring salary</span>
                <span className="font-mono font-bold">{analysis.hasRecurringSalary ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Transactions</span>
                <span className="font-mono font-bold">{analysis.transactions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Net total</span>
                <span className={`font-mono font-bold ${analysis.net >= 0 ? "text-emerald-ai" : "text-destructive"}`}>
                  {formatZAR(analysis.net)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function StatCard({
  label, value, sub, subTone, accent, highlight,
}: { label: string; value: string; sub?: string; subTone?: "good" | "warn"; accent?: boolean; highlight?: boolean }) {
  return (
    <div className={`rounded-3xl border p-6 ${
      highlight ? "border-transparent bg-emerald-ai text-background" : "border-border bg-surface"
    }`}>
      <p className={`text-xs ${highlight ? "text-background/70" : "text-muted-foreground"}`}>{label}</p>
      <p className={`mt-1 font-mono text-3xl font-bold ${accent ? "text-emerald-ai" : ""}`}>{value}</p>
      {sub && (
        <div className={`mt-3 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${
          subTone === "warn" ? "bg-destructive/10 text-destructive" : "bg-emerald-ai/10 text-emerald-ai"
        }`}>
          {sub}
        </div>
      )}
    </div>
  );
}
