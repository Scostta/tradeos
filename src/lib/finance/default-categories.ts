import type { CategoryKind } from "./summary"

// Categorías con las que arranca Money (MONEY_SPEC.md §2.2). Se crean al dar
// de alta finance_settings; después el usuario las edita, archiva o añade.

export type DefaultCategory = {
  name:    string
  kind:    CategoryKind
  isFixed: boolean
  color:   string
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Housing",           kind: "expense",  isFixed: true,  color: "#6366f1" },
  { name: "Vehicle",           kind: "expense",  isFixed: true,  color: "#0ea5e9" },
  { name: "Insurance",         kind: "expense",  isFixed: true,  color: "#64748b" },
  { name: "Utilities",         kind: "expense",  isFixed: true,  color: "#14b8a6" },
  { name: "Subscriptions",     kind: "expense",  isFixed: true,  color: "#a855f7" },
  { name: "Groceries",         kind: "expense",  isFixed: false, color: "#22c55e" },
  { name: "Eating out",        kind: "expense",  isFixed: false, color: "#f97316" },
  { name: "Transport",         kind: "expense",  isFixed: false, color: "#eab308" },
  { name: "Health",            kind: "expense",  isFixed: false, color: "#ef4444" },
  { name: "Sports",            kind: "expense",  isFixed: false, color: "#84cc16" },
  { name: "Shopping",          kind: "expense",  isFixed: false, color: "#ec4899" },
  { name: "Travel",            kind: "expense",  isFixed: false, color: "#06b6d4" },
  { name: "Gifts",             kind: "expense",  isFixed: false, color: "#f43f5e" },
  { name: "Other expense",     kind: "expense",  isFixed: false, color: "#94a3b8" },
  { name: "Salary",            kind: "income",   isFixed: false, color: "#10b981" },
  { name: "Other income",      kind: "income",   isFixed: false, color: "#34d399" },
  { name: "Transfer",          kind: "transfer", isFixed: false, color: "#475569" },
  { name: "Savings/Investing", kind: "savings",  isFixed: false, color: "#a3e635" },
]

/** Nombre de la cuenta de efectivo que se crea con el alta (§2.1, §5.7). */
export const CASH_ACCOUNT_NAME = "Cash"
