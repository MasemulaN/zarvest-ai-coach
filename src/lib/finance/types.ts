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
  byCategory: CategoryTotal[];
  monthly: MonthlyTrend[];
  recurring: { description: string; amount: number; count: number }[];
  leaks: MoneyLeak[];
  forecastNextMonth: number;
  topMerchants: { name: string; total: number }[];
}
