import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { analyze, determinePersonality } from "@/lib/finance/analyze";
import type { AnalysisResult, Transaction } from "@/lib/finance/types";

type View = "upload" | "analyzing" | "dashboard";

interface AICoachState {
  headline: string;
  advice: string[];
  loading: boolean;
}

interface FinanceCtx {
  view: View;
  setView: (v: View) => void;
  transactions: Transaction[];
  analysis: AnalysisResult | null;
  personality: { name: string; description: string } | null;
  coach: AICoachState;
  setCoach: (s: AICoachState) => void;
  loadTransactions: (txns: Transaction[]) => void;
  reset: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

const Ctx = createContext<FinanceCtx | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>("upload");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [coach, setCoach] = useState<AICoachState>({ headline: "", advice: [], loading: false });
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const analysis = useMemo(() => (transactions.length ? analyze(transactions) : null), [transactions]);
  const personality = useMemo(() => (analysis ? determinePersonality(analysis) : null), [analysis]);

  const value: FinanceCtx = {
    view, setView, transactions, analysis, personality, coach, setCoach,
    loadTransactions: (t) => { setTransactions(t); setView("dashboard"); },
    reset: () => { setTransactions([]); setCoach({ headline: "", advice: [], loading: false }); setView("upload"); },
    theme,
    toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinance() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFinance outside provider");
  return v;
}
