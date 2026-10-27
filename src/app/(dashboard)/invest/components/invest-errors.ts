import type { InvestActionError } from "~/actions/invest"
import { INVEST } from "~/constants/copies/invest"

const MESSAGES: Record<InvestActionError, string> = { ...INVEST.BLOCKERS, ...INVEST.ERRORS }

export function investErrorMessage(code: InvestActionError): string {
  return MESSAGES[code] ?? INVEST.ERRORS.UNKNOWN
}
