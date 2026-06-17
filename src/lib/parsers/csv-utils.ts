// ── Shared CSV parsing helpers ────────────────────────────────────────────────
// Used by the NinjaTrader parser (symbol + delimiter detection) and the generic
// mapped importer (flexible number/date parsing, quote-aware splitting, and a
// deterministic synthetic trade number for CSVs that don't carry one).

/** Picks the most likely delimiter from a header line: tab, semicolon or comma. */
export function detectDelimiter(headerLine: string): string {
  const tabs   = (headerLine.match(/\t/g) ?? []).length
  const semis  = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  if (tabs >= semis && tabs >= commas && tabs > 0) return "\t"
  return semis > commas ? ";" : ","
}

/** Splits one CSV line on `delimiter`, honoring double-quoted fields (RFC-4180-ish). */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ }  // escaped quote
        else inQuotes = false
      } else cur += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      out.push(cur); cur = ""
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

/** "NQ 03-25" → "NQ". Keeps the clean root symbol. */
export function extractSymbol(instrument: string): string {
  return instrument.trim().split(" ")[0] ?? instrument.trim()
}

/**
 * Parses a money/number string from any broker CSV: strips currency symbols and
 * spaces, supports "(500)" negatives, and resolves "," vs "." as thousands/decimal.
 * Returns NaN if not numeric.
 */
export function parseFlexibleNumber(raw: string): number {
  let s = raw.trim().replace(/[$€£\s]/g, "")
  if (s === "") return NaN

  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }

  const hasComma = s.includes(",")
  const hasDot   = s.includes(".")
  if (hasComma && hasDot) {
    // The right-most separator is the decimal point; the other groups thousands.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".")
    else s = s.replace(/,/g, "")
  } else if (hasComma) {
    const parts = s.split(",")
    const looksThousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && parts[0]!.length <= 3
    s = looksThousands ? s.replace(/,/g, "") : s.replace(",", ".")
  }

  const n = parseFloat(s)
  return Number.isNaN(n) ? NaN : (neg ? -n : n)
}

// Date format variants supported by the generic importer.
const ISO_TZ_RE  = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/
const ISO_RE     = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/
const AMPM_RE    = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
const SLASH24_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/

function toIso(y: number, mo: number, d: number, h: number, mi: number, s: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 59) return null
  const dt = new Date(y, mo - 1, d, h, mi, s)  // local time → ISO (UTC)
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

/**
 * Parses a date/time from common broker formats → ISO UTC string (or null).
 * Order: ISO-with-offset, "YYYY-MM-DD HH:mm[:ss]", US "MM/DD/YYYY h:mm AM/PM",
 * US 24h, then EU 24h (DD/MM) only when the US reading is invalid (day > 12).
 * Non-offset dates are read as local wall-clock (matches the NinjaTrader parser).
 */
export function parseFlexibleDate(raw: string): string | null {
  const v = raw.trim()
  if (v === "") return null

  if (ISO_TZ_RE.test(v)) {
    const dt = new Date(v)
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
  }

  let m = v.match(ISO_RE)
  if (m) return toIso(+m[1]!, +m[2]!, +m[3]!, +m[4]!, +m[5]!, m[6] ? +m[6] : 0)

  m = v.match(AMPM_RE)
  if (m) {
    let h = +m[4]!
    const mer = m[7]!.toUpperCase()
    if (mer === "AM") { if (h === 12) h = 0 } else if (h !== 12) h += 12
    return toIso(+m[3]!, +m[1]!, +m[2]!, h, +m[5]!, m[6] ? +m[6] : 0)
  }

  m = v.match(SLASH24_RE)
  if (m) {
    const a = +m[1]!, b = +m[2]!
    // Prefer US (MM/DD); fall back to EU (DD/MM) when the month would be invalid.
    const usOk = a >= 1 && a <= 12
    const [mo, d] = usOk ? [a, b] : [b, a]
    return toIso(+m[3]!, mo, d, +m[4]!, +m[5]!, m[6] ? +m[6] : 0)
  }

  return null
}

/**
 * Deterministic positive 31-bit trade number from a stable natural key, for CSVs
 * that don't carry a trade id. Same input → same number, so re-imports dedup
 * idempotently against the (account_id, trade_number) constraint.
 */
export function stableTradeNumber(parts: string[]): number {
  const s = parts.join("|")
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 2147483647) + 1
}
