import { AlertTriangle, Droplet } from "lucide-react";
import type { AnalysisResult } from "@/lib/finance/types";
import { formatZAR } from "@/lib/finance/analyze";

export function PersonalityCard({ name, description, confidence }: { name: string; description: string; confidence?: number }) {
  const pct = typeof confidence === "number" ? Math.round(confidence * 100) : null;
  return (
    <div className="rounded-3xl border border-emerald-ai/20 bg-gradient-to-br from-emerald-ai/15 via-emerald-ai/5 to-transparent p-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-ai">AI Personality verdict</p>
        {pct !== null && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {pct}% confidence
          </span>
        )}
      </div>
      <h3 className="text-2xl font-bold tracking-tight">{name}</h3>
      <p className="mt-3 text-sm leading-relaxed text-foreground/70">{description}</p>
    </div>
  );
}


export function MoneyLeaksCard({ analysis }: { analysis: AnalysisResult }) {
  const leaks = analysis.leaks;
  return (
    <div className="rounded-3xl border border-gold-leak/20 bg-gold-leak/[0.04] p-6">
      <div className="mb-5 flex items-center gap-2">
        <Droplet className="size-4 text-gold-leak" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-gold-leak">Money leaks detected</h3>
      </div>
      {leaks.length === 0 ? (
        <p className="text-xs text-muted-foreground">No major leaks spotted. Clean run.</p>
      ) : (
        <ul className="space-y-4">
          {leaks.slice(0, 4).map((l, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className={`mt-1.5 size-2 shrink-0 rounded-full ${
                l.severity === "high" ? "bg-destructive" : l.severity === "medium" ? "bg-gold-leak" : "bg-muted-foreground"
              }`} />
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{l.label}</p>
                  <p className="font-mono text-xs font-bold text-destructive">{formatZAR(-l.amount)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{l.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdviceCard({ headline, advice, loading }: { headline: string; advice: string[]; loading: boolean }) {
  if (!headline && !advice.length && !loading) return null;
  return (
    <div className="rounded-3xl border border-border bg-surface p-6">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="size-4 text-emerald-ai" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-ai">Coach says</h3>
      </div>
      {loading && !headline ? (
        <div className="space-y-2">
          <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
          <div className="h-3 w-full animate-pulse rounded bg-secondary" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-secondary" />
        </div>
      ) : (
        <>
          {headline && <p className="text-lg font-semibold leading-snug">{headline}</p>}
          {advice.length > 0 && (
            <ul className="mt-4 space-y-2">
              {advice.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="mt-0.5 font-mono text-[10px] text-emerald-ai">0{i + 1}</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
