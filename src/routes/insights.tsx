import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/app/DashboardShell";
import { PersonalityCard, MoneyLeaksCard, AdviceCard } from "@/components/app/InsightCards";
import { useFinance } from "@/lib/finance/store";
import { formatZAR } from "@/lib/finance/analyze";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — Zarvest" },
      { name: "description", content: "AI-powered personality verdict, money leaks, and personalised advice." },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const { analysis, personality, coach } = useFinance();
  if (!analysis || !personality) return null;

  return (
    <DashboardShell>
      <header className="mb-10 animate-slide-up">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-ai">Insights</p>
        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Your AI financial profile
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {personality.name} — {personality.description}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-5">
          <PersonalityCard
            name={personality.name}
            description={personality.description}
            confidence={personality.confidence}
          />
          <MoneyLeaksCard analysis={analysis} />
        </div>
        <div className="space-y-6 lg:col-span-7">
          <AdviceCard headline={coach.headline} advice={coach.advice} loading={coach.loading} />
          <div className="rounded-3xl border border-border bg-surface p-6">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-emerald-ai">Period summary</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Avg monthly income</p>
                <p className="mt-1 font-mono text-xl font-bold">{formatZAR(analysis.avgMonthlyIncome)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg monthly spend</p>
                <p className="mt-1 font-mono text-xl font-bold">{formatZAR(analysis.avgMonthlySpend)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Savings rate</p>
                <p className="mt-1 font-mono text-xl font-bold">{Math.round(analysis.savingsRate * 100)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net total</p>
                <p className={`mt-1 font-mono text-xl font-bold ${analysis.net >= 0 ? "text-emerald-ai" : "text-destructive"}`}>
                  {formatZAR(analysis.net)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
