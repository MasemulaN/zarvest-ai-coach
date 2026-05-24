import { Compass, LayoutDashboard, LineChart, MessageSquare, Moon, Sun, Upload } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance/store";

export function Sidebar() {
  const { analysis, theme, toggleTheme, reset } = useFinance();
  const router = useRouter();
  const path = router.state.location.pathname;

  const items = [
    { icon: LayoutDashboard, label: "Dashboard", to: "/" as const },
    { icon: LineChart, label: "Forecasting", to: "/forecasting" as const },
    { icon: MessageSquare, label: "Chat Coach", to: "/chat-coach" as const },
    { icon: Compass, label: "Insights", to: "/insights" as const },
  ];

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-full w-64 flex-col border-r border-border bg-background p-6 md:flex">
      <div className="mb-12 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-ai font-bold italic text-background">CP</div>
        <span className="text-lg font-bold tracking-tight">
          CashPilot <span className="text-emerald-ai">AI</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1">
        {items.map((it) => {
          const active = it.to === "/" ? path === "/" : path.startsWith(it.to);
          return (
            <Link
              key={it.label}
              to={it.to}
              className={`group flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-emerald-ai/10 font-medium text-emerald-ai"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <it.icon className="size-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>

      {analysis && (
        <div className="mb-4 rounded-2xl border border-emerald-ai/20 bg-gradient-to-br from-emerald-ai/15 to-transparent p-4">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-ai">Co-pilot status</p>
          <p className="text-xs leading-relaxed text-foreground/80">
            {analysis.net >= 0
              ? `Net positive of R ${Math.round(analysis.net).toLocaleString("en-ZA")} across the period.`
              : `You're R ${Math.round(Math.abs(analysis.net)).toLocaleString("en-ZA")} in the red. Let's fix it.`}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        {analysis && (
          <button
            onClick={reset}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
          >
            <Upload className="size-3.5" />
            New CSV
          </button>
        )}
      </div>
    </aside>
  );
}
