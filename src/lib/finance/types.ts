export type Category =
  | "Food & Groceries"
  | "Transport & Fuel"
  | "Bills & Utilities"
  | "Shopping"
  | "Dining & Entertainment"
  | "Subscriptions"
  | "Savings & Transfers"
  | "Income"
  | "Bank Charges"
  | "Other";

export interface Transaction {
  date: string; // ISO
  description: string;
  amount: number; // negative = outflow, positive = inflow
  category: Category;
}

export interface MoneyLeak {
  label: string;
  detail: string;
  amount: number;
  severity: "high" | "medium" | "low";
}

export interface CategoryTotal {
  category: Category;
  total: number;
  pct: number;
}

export interface MonthlyTrend {
  month: string; // YYYY-MM
  spend: number;
  income: number;
}

export interface AnalysisResult {
  transactions: Transaction[];
  totalSpend: number;
  totalIncome: number;
  net: number;
  monthsCount: number;
  avgMonthlyIncome: number;
  avgMonthlySpend: number;
  savingsRate: number; // 0-1, based on income vs spend (excludes self-transfers to savings as spend)
  savingsContributed: number; // total transferred to savings
  byCategory: CategoryTotal[];
  monthly: MonthlyTrend[];
  recurring: { description: string; amount: number; count: number }[];
  leaks: MoneyLeak[];
  forecastNextMonth: number;
  topMerchants: { name: string; total: number }[];
  hasRecurringSalary: boolean;
}

export interface Personality {
  name: string;
  description: string;
  confidence: number; // 0-1
}
