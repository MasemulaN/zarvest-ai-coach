import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/app/DashboardShell";
import { ForecastSimulator } from "@/components/app/ForecastSimulator";
import { useFinance } from "@/lib/finance/store";
import { formatZAR } from "@/lib/finance/analyze";

export const Route = createFileRoute("/forecasting")({
  head: () => ({
    meta: [
      { title: "Forecasting — Zarvest" },
      { name: "description", content: "Simulate spending changes and see your projected savings." },
    ],
  }),
  component: ForecastingPage,
});

function ForecastingPage() {
  const { analysis } = useFinance();
  if (!analysis) return null;
  const avgSpend = analysis.avgMonthlySpend;

  return (
    <DashboardShell>
      <header className="mb-10 animate-slide-up">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-ai">Forecasting</p>
        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          What if you changed your habits?
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Your average monthly spend is {formatZAR(avgSpend)}. Drag the sliders to see the impact on next month.
        </p>
      </header>
      <ForecastSimulator analysis={analysis} />
    </DashboardShell>
  );
}
