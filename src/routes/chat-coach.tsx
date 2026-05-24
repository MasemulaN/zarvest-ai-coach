import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/app/DashboardShell";
import { ChatPanel } from "@/components/app/ChatPanel";
import { useFinance } from "@/lib/finance/store";

export const Route = createFileRoute("/chat-coach")({
  head: () => ({
    meta: [
      { title: "Chat Coach — CashPilot AI" },
      { name: "description", content: "Ask your AI financial coach anything about your money." },
    ],
  }),
  component: ChatCoachPage,
});

function ChatCoachPage() {
  const { analysis } = useFinance();
  if (!analysis) return null;

  return (
    <DashboardShell>
      <header className="mb-10 animate-slide-up">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-emerald-ai">Chat Coach</p>
        <h1 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Ask your AI coach anything
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Get personalised advice on spending, saving, and money leaks.
        </p>
      </header>
      <div className="mx-auto max-w-3xl">
        <ChatPanel />
      </div>
    </DashboardShell>
  );
}
