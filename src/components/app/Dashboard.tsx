import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useFinance } from "@/lib/finance/store";
import { Sidebar } from "@/components/app/Sidebar";
import { UploadZone } from "@/components/app/UploadZone";
import { SpendingChart, TrendChart } from "@/components/app/Charts";
import { PersonalityCard, MoneyLeaksCard, AdviceCard } from "@/components/app/InsightCards";
import { ForecastSimulator } from "@/components/app/ForecastSimulator";
import { ChatPanel } from "@/components/app/ChatPanel";
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
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:ml-64">
        <div className="mx-auto max-w-7xl px-6 py-10 md:px-10">
          <header className="mb-10 animate-slide-up">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-ai">Analysis complete · {monthsCount} months</p>
            <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
              {coach.headline || `Your average monthly spend is ${formatZAR(avgSpend)}.`}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {personality.name} — {personality.description}
            </p>
          </header>

          {/* Top stats */}
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <StatCard label="Avg monthly income" value={formatZAR(avgIncome)} accent />
            <StatCard label="Avg monthly spend" value={formatZAR(avgSpend)} sub={`${trendPct >= 0 ? "+" : ""}${Math.round(trendPct)}% vs prior avg`} subTone={trendPct > 0 ? "warn" : "good"} />
            <StatCard label="Next month forecast" value={formatZAR(analysis.forecastNextMonth)} highlight />
          </div>

          {/* Grid */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <SpendingChart analysis={analysis} />
              <TrendChart analysis={analysis} />
              <ForecastSimulator analysis={analysis} />
            </div>
            <div className="space-y-6 lg:col-span-4">
              <PersonalityCard name={personality.name} description={personality.description} />
              <AdviceCard headline={coach.headline} advice={coach.advice} loading={coach.loading} />
              <MoneyLeaksCard analysis={analysis} />
              <ChatPanel />
            </div>
          </div>
        </div>
      </main>
    </div>
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
