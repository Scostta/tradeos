import { MONEY } from "~/constants/copies/money"
import type { FinanceActionError } from "~/actions/finance"
import type { AiError } from "~/lib/ai/claude-json"

export function moneyErrorMessage(error: FinanceActionError | AiError): string {
  return MONEY.ERRORS[error] ?? MONEY.ERRORS.UNKNOWN
}
