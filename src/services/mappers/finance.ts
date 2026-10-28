import {
  financeAccountSchema,
  financeCategorySchema,
  financeGoalSchema,
  financeRuleSchema,
  financeSettingsSchema,
  financeSubscriptionSchema,
  financeTransactionSchema,
} from "~/types/finance"
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceGoal,
  FinanceRule,
  FinanceSettings,
  FinanceSubscription,
  FinanceTransaction,
} from "~/types/finance"

// Filas de finance_* (snake_case) → dominio (camelCase), validadas con Zod.
// PostgREST puede devolver numeric como string: se pasa por Number().

const num = (v: unknown): number => Number(v)
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))

export function mapFinanceAccountFromDb(row: Record<string, unknown>): FinanceAccount {
  return financeAccountSchema.parse({
    id:        row["id"],
    userId:    row["user_id"],
    name:      row["name"],
    kind:      row["kind"],
    currency:  row["currency"],
    ibanLast4: row["iban_last4"] ?? null,
    active:    row["active"] ?? true,
    createdAt: row["created_at"],
  })
}

export function mapFinanceCategoryFromDb(row: Record<string, unknown>): FinanceCategory {
  return financeCategorySchema.parse({
    id:       row["id"],
    userId:   row["user_id"],
    name:     row["name"],
    kind:     row["kind"],
    isFixed:  row["is_fixed"] ?? false,
    color:    row["color"],
    sort:     row["sort"] ?? 0,
    archived: row["archived"] ?? false,
  })
}

export function mapFinanceTransactionFromDb(row: Record<string, unknown>): FinanceTransaction {
  return financeTransactionSchema.parse({
    id:             row["id"],
    userId:         row["user_id"],
    accountId:      row["account_id"],
    bookedAt:       row["booked_at"],
    amount:         num(row["amount"]),
    currency:       row["currency"],
    conceptRaw:     row["concept_raw"],
    counterparty:   row["counterparty"] ?? null,
    balanceAfter:   numOrNull(row["balance_after"]),
    categoryId:     row["category_id"] ?? null,
    categorySource: row["category_source"] ?? null,
    excluded:       row["excluded"] ?? false,
    parentId:       row["parent_id"] ?? null,
    notes:          row["notes"] ?? null,
    source:         row["source"],
    importKey:      row["import_key"],
    createdAt:      row["created_at"],
  })
}

export function mapFinanceRuleFromDb(row: Record<string, unknown>): FinanceRule {
  return financeRuleSchema.parse({
    id:          row["id"],
    userId:      row["user_id"],
    pattern:     row["pattern"],
    categoryId:  row["category_id"],
    priority:    row["priority"] ?? 0,
    createdFrom: row["created_from"] ?? null,
    hits:        row["hits"] ?? 0,
    createdAt:   row["created_at"],
  })
}

export function mapFinanceSubscriptionFromDb(row: Record<string, unknown>): FinanceSubscription {
  return financeSubscriptionSchema.parse({
    id:           row["id"],
    userId:       row["user_id"],
    counterparty: row["counterparty"],
    amount:       num(row["amount"]),
    cadence:      row["cadence"],
    categoryId:   row["category_id"] ?? null,
    firstSeen:    row["first_seen"],
    lastSeen:     row["last_seen"],
    nextExpected: row["next_expected"] ?? null,
    occurrences:  row["occurrences"],
    status:       row["status"],
    usage:        row["usage"],
    unusedSince:  row["unused_since"] ?? null,
    updatedAt:    row["updated_at"],
  })
}

export function mapFinanceGoalFromDb(row: Record<string, unknown>): FinanceGoal {
  return financeGoalSchema.parse({
    id:           row["id"],
    userId:       row["user_id"],
    name:         row["name"],
    targetAmount: num(row["target_amount"]),
    savedAmount:  num(row["saved_amount"]),
    monthlyAlloc: num(row["monthly_alloc"]),
    priority:     row["priority"],
    deadline:     row["deadline"] ?? null,
    status:       row["status"],
    createdAt:    row["created_at"],
  })
}

export function mapFinanceSettingsFromDb(row: Record<string, unknown>): FinanceSettings {
  return financeSettingsSchema.parse({
    userId:         row["user_id"],
    monthStartDay:  row["month_start_day"] ?? 1,
    defaultAccount: row["default_account"] ?? null,
    createdAt:      row["created_at"],
  })
}
