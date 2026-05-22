import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisResult } from "@/lib/finance/types";
import { formatZAR } from "@/lib/finance/analyze";

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Groceries": "var(--emerald-ai)",
  "Transport & Fuel": "oklch(0.7 0.14 200)",
  "Bills & Utilities": "oklch(0.78 0.14 90)",
  "Shopping": "oklch(0.65 0.2 25)",
  "Dining & Entertainment": "oklch(0.6 0.18 290)",
  "Subscriptions": "oklch(0.72 0.16 60)",
  "Savings & Transfers": "oklch(0.65 0.15 140)",
  "Bank Charges": "oklch(0.55 0.2 25)",
  "Other": "oklch(0.5 0.02 260)",
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="font-mono text-muted-foreground">
          {p.name}: <span className="text-foreground">{formatZAR(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function SpendingChart({ analysis }: { analysis: AnalysisResult }) {
  const data = analysis.byCategory.slice(0, 7).map((c) => ({ name: c.category.split(" ")[0], full: c.category, value: c.total }));
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Spending by category</h2>
          <p className="text-xs text-muted-foreground">{analysis.monthly.length} months · {analysis.transactions.length} transactions</p>
        </div>
        <span className="rounded-full bg-emerald-ai/10 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-emerald-ai">ZAR</span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R${Math.round(v / 1000)}k`} />
            <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.4 }} content={<ChartTooltip />} />
            <Bar dataKey="value" name="Spend" radius={[8, 8, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={CATEGORY_COLORS[d.full] ?? "var(--emerald-ai)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {analysis.byCategory.slice(0, 4).map((c) => (
          <div key={c.category} className="rounded-xl bg-background/40 p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{c.category.split(" ")[0]}</p>
            <p className="font-mono text-sm font-bold">{formatZAR(c.total)}</p>
            <p className="text-[10px] text-muted-foreground">{Math.round(c.pct * 100)}% of spend</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendChart({ analysis }: { analysis: AnalysisResult }) {
  const data = analysis.monthly.map((m) => ({ name: m.month.slice(2), Spend: m.spend, Income: m.income }));
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 md:p-8">
      <h2 className="mb-1 text-lg font-bold">Monthly trend</h2>
      <p className="mb-6 text-xs text-muted-foreground">Income vs spend over time</p>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `R${Math.round(v / 1000)}k`} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="Income" stroke="var(--emerald-ai)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--emerald-ai)" }} />
            <Line type="monotone" dataKey="Spend" stroke="oklch(0.65 0.2 25)" strokeWidth={2.5} dot={{ r: 3, fill: "oklch(0.65 0.2 25)" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
