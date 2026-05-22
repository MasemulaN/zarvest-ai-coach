import { useState } from "react";
import type { AnalysisResult } from "@/lib/finance/types";
import { formatZAR } from "@/lib/finance/analyze";
import { TrendingDown, TrendingUp } from "lucide-react";

export function ForecastSimulator({ analysis }: { analysis: AnalysisResult }) {
  const baseForecast = analysis.forecastNextMonth;
  const [diningCut, setDiningCut] = useState(0);
  const [shoppingCut, setShoppingCut] = useState(0);
  const [extraSave, setExtraSave] = useState(0);

  const diningTotal = analysis.byCategory.find((c) => c.category === "Dining & Entertainment")?.total ?? 0;
  const shoppingTotal = analysis.byCategory.find((c) => c.category === "Shopping")?.total ?? 0;
  const monthsCount = Math.max(analysis.monthly.length, 1);
  const diningPerMonth = diningTotal / monthsCount;
  const shoppingPerMonth = shoppingTotal / monthsCount;

  const projected = baseForecast - (diningPerMonth * diningCut / 100) - (shoppingPerMonth * shoppingCut / 100);
  const avgIncome = analysis.totalIncome / monthsCount;
  const projectedSavings = avgIncome - projected + extraSave * 0;
  const delta = baseForecast - projected;

  return (
    <div className="rounded-3xl border border-border bg-gradient-to-br from-surface to-background p-6 md:p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold">What-if simulator</h2>
          <p className="text-xs text-muted-foreground">Drag to see next month's impact</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Forecast</p>
          <p className="font-mono text-2xl font-bold">{formatZAR(projected)}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Slider label="Cut dining out" value={diningCut} onChange={setDiningCut} hint={`Currently ${formatZAR(diningPerMonth)}/mo`} />
        <Slider label="Cut discretionary shopping" value={shoppingCut} onChange={setShoppingCut} hint={`Currently ${formatZAR(shoppingPerMonth)}/mo`} />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Monthly savings impact</p>
          <p className={`mt-1 flex items-center gap-2 font-mono text-2xl font-bold ${delta >= 0 ? "text-emerald-ai" : "text-destructive"}`}>
            {delta >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
            {formatZAR(delta)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Projected net</p>
          <p className={`mt-1 font-mono text-2xl font-bold ${projectedSavings >= 0 ? "text-foreground" : "text-destructive"}`}>
            {formatZAR(projectedSavings)}
          </p>
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange, hint }: { label: string; value: number; onChange: (n: number) => void; hint: string }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-bold text-emerald-ai">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={75}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-emerald-ai"
      />
      <p className="mt-1 text-[10px] text-muted-foreground">{hint}</p>
    </div>
  );
}
