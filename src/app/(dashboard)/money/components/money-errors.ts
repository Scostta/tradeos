import { MONEY } from "~/constants/copies/money"
import type { FinanceActionError } from "~/actions/finance"

export function moneyErrorMessage(error: FinanceActionError): string {
  return MONEY.ERRORS[error] ?? MONEY.ERRORS.UNKNOWN
}
