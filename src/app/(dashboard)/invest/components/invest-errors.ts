import type { InvestActionError } from "~/actions/invest"
import type { AiError } from "~/lib/ai/claude-json"
import { INVEST } from "~/constants/copies/invest"

const MESSAGES: Record<InvestActionError | AiError, string> = { ...INVEST.BLOCKERS, ...INVEST.ERRORS }

export function investErrorMessage(code: InvestActionError | AiError): string {
  return MESSAGES[code] ?? INVEST.ERRORS.UNKNOWN
}
