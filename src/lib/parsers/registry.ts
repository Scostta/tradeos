// ── Known-format CSV parser registry ──────────────────────────────────────────
// Tries each known broker parser by auto-detecting its header. Returns the first
// recognized ParseResult, or null when no known format matches (→ the UI falls
// back to the generic column-mapping importer).

import { parseNinjaTraderCsv } from "~/lib/parsers/ninjatrader"
import type { ParseResult } from "~/types/import"

const KNOWN_PARSERS: ((text: string) => ParseResult)[] = [
  parseNinjaTraderCsv,
]

export function detectKnownFormat(text: string): ParseResult | null {
  for (const parse of KNOWN_PARSERS) {
    const result = parse(text)
    if (result.format !== "unknown") return result
  }
  return null
}
