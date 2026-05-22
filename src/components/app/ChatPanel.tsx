import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { chatWithCoach } from "@/lib/finance/coach.functions";
import { useFinance } from "@/lib/finance/store";
import { formatZAR } from "@/lib/finance/analyze";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

function buildContext(a: ReturnType<typeof useFinance>["analysis"], p: ReturnType<typeof useFinance>["personality"]): string {
  if (!a) return "";
  const cats = a.byCategory.slice(0, 5).map((c) => `${c.category}: ${formatZAR(c.total)} (${Math.round(c.pct * 100)}%)`).join("; ");
  const months = a.monthly.map((m) => `${m.month}: spend ${formatZAR(m.spend)}, income ${formatZAR(m.income)}`).join("; ");
  const monthsCount = Math.max(a.monthly.length, 1);
  return [
    `Personality: ${p?.name ?? "n/a"}`,
    `Avg monthly income: ${formatZAR(a.totalIncome / monthsCount)}`,
    `Avg monthly spend: ${formatZAR(a.totalSpend / monthsCount)}`,
    `Net for period: ${formatZAR(a.net)}`,
    `Next-month forecast spend: ${formatZAR(a.forecastNextMonth)}`,
    `Top categories: ${cats}`,
    `Monthly trend: ${months}`,
    `Leaks: ${a.leaks.map((l) => `${l.label} (${formatZAR(-l.amount)})`).join("; ") || "none"}`,
  ].join("\n");
}

export function ChatPanel() {
  const { analysis, personality } = useFinance();
  const chat = useServerFn(chatWithCoach);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: analysis ? `I've reviewed your statement. Average monthly spend is ${formatZAR(analysis.totalSpend / Math.max(analysis.monthly.length, 1))}. Ask me anything.` : "Upload a statement and I'll start coaching." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const { reply } = await chat({ data: { messages: next, context: buildContext(analysis, personality) } });
      setMessages((m) => [...m, { role: "assistant", content: reply || "..." }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Chat failed");
      setMessages((m) => [...m, { role: "assistant", content: "Sorry — I couldn't reach the AI. Try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  }

  const suggestions = ["Can I afford R5,000 in shopping this month?", "How can I save more?", "What's leaking my money?"];

  return (
    <div className="flex h-[640px] flex-col overflow-hidden rounded-3xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <div className="size-2 animate-pulse rounded-full bg-emerald-ai" />
        <p className="text-xs font-mono font-bold uppercase tracking-widest">Coach Pilot</p>
        <span className="ml-auto text-[10px] text-muted-foreground">Online</span>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === "user"
                ? "rounded-br-sm bg-emerald-ai text-background"
                : "rounded-bl-sm bg-background text-foreground"
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-background px-4 py-3">
              <div className="flex gap-1">
                <span className="size-1.5 animate-bounce rounded-full bg-emerald-ai" />
                <span className="size-1.5 animate-bounce rounded-full bg-emerald-ai [animation-delay:120ms]" />
                <span className="size-1.5 animate-bounce rounded-full bg-emerald-ai [animation-delay:240ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-emerald-ai/40 hover:text-emerald-ai"
            >
              <Sparkles className="-mt-0.5 mr-1 inline size-3" />
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-border p-4"
      >
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the coach…"
            disabled={busy}
            className="w-full rounded-full border border-border bg-background px-4 py-3 pr-12 text-sm outline-none transition-colors focus:border-emerald-ai/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-full bg-emerald-ai text-background transition-opacity disabled:opacity-40"
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
