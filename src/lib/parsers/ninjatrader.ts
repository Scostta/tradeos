import type { ParsedRow, ParseError, ParseResult } from "~/types"
import { parsedRowSchema } from "~/types/import"
import { detectDelimiter, extractSymbol } from "~/lib/parsers/csv-utils"

// Column name variants: [standard export, grid export]
const COLUMN_ALIASES: Record<string, string[]> = {
  "Trade #":      ["Trade #", "Trade number"],
  "Account":      ["Account"],
  "Instrument":   ["Instrument"],
  "Market pos.":  ["Market pos."],
  "Quantity":     ["Quantity", "Qty"],
  "Entry price":  ["Entry price"],
  "Exit price":   ["Exit price"],
  "Entry time":   ["Entry time"],
  "Exit time":    ["Exit time"],
  "Profit":       ["Profit"],
  "Commission":   ["Commission"],
  "MAE":          ["MAE"],
  "MFE":          ["MFE"],
}

const CANONICAL_COLUMNS = Object.keys(COLUMN_ALIASES) as Array<keyof typeof COLUMN_ALIASES>

// NinjaTrader exports timestamps in the PC's LOCAL timezone (not UTC).
// We must convert to UTC using the JS Date constructor, which interprets
// a local-time string via the local timezone of the runtime environment.
// On the server (Next.js), process.env.TZ controls this — it should match
// the timezone the NinjaTrader PC was in when the CSV was exported.
// Default assumption: the server timezone matches the CSV timezone.

// "3/10/2025 9:32:01 AM" (MM/DD/YYYY AM/PM — US NinjaTrader export)
const DATE_AMPM_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)$/i

// "11/05/2026 15:31:05" or "18/06/2026 9:12:55" (DD/MM/YYYY 24h — European
// NinjaTrader Grid export; hour may be 1 digit before 10:00, no leading zero)
const DATE_24H_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/

function parseAmPmDate(raw: string): string | null {
  const m = raw.trim().match(DATE_AMPM_REGEX)
  if (!m) return null

  const month = parseInt(m[1]!, 10)
  const day   = parseInt(m[2]!, 10)
  const year  = parseInt(m[3]!, 10)
  let h       = parseInt(m[4]!, 10)
  const min   = parseInt(m[5]!, 10)
  const sec   = parseInt(m[6]!, 10)
  const mer   = m[7]!.toUpperCase()

  if (mer === "AM") { if (h === 12) h = 0 }
  else              { if (h !== 12) h += 12 }

  if (month < 1 || month > 12 || day < 1 || day > 31 || h > 23 || min > 59 || sec > 59) return null

  // Build a local-time Date and convert to UTC ISO string
  const d = new Date(year, month - 1, day, h, min, sec)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

// Grid export uses DD/MM/YYYY 24h (European format)
function parse24hDate(raw: string): string | null {
  const m = raw.trim().match(DATE_24H_REGEX)
  if (!m) return null

  const day   = parseInt(m[1]!, 10)
  const month = parseInt(m[2]!, 10)
  const year  = parseInt(m[3]!, 10)
  const h     = parseInt(m[4]!, 10)
  const min   = parseInt(m[5]!, 10)
  const sec   = parseInt(m[6]!, 10)

  if (month < 1 || month > 12 || day < 1 || day > 31 || h > 23 || min > 59 || sec > 59) return null

  const d = new Date(year, month - 1, day, h, min, sec)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

function parseDate(raw: string): string | null {
  return parseAmPmDate(raw) ?? parse24hDate(raw)
}

// Handles "137,50 $", "137.50", "-2,00 $", "0.00"
function parseNumber(raw: string): number {
  const cleaned = raw.trim().replace(/\s*\$$/, "").replace(",", ".")
  return parseFloat(cleaned)
}

function buildColumnIndex(
  headerCols: string[]
): Record<string, number> | null {
  const idx: Record<string, number> = {}

  for (const canonical of CANONICAL_COLUMNS) {
    const aliases = COLUMN_ALIASES[canonical]!
    const found = aliases
      .map((alias) => headerCols.findIndex((h) => h.trim() === alias))
      .find((i) => i !== -1)

    if (found === undefined) return null
    idx[canonical] = found
  }

  return idx
}

export function parseNinjaTraderCsv(csvText: string): ParseResult {
  const lines = csvText
    .split(/\r\n|\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 1, reason: "Unrecognized CSV header" }], format: "unknown" }
  }

  const headerLine = lines[0]!
  const delimiter  = detectDelimiter(headerLine)
  const headerCols = headerLine.split(delimiter).map((c) => c.trim())
  const idx        = buildColumnIndex(headerCols)

  if (!idx) {
    return { rows: [], errors: [{ line: 1, reason: "Unrecognized CSV header" }], format: "unknown" }
  }

  const format = delimiter === ";" ? "NinjaTrader Grid" : "NinjaTrader v8"
  const rows: ParsedRow[]   = []
  const errors: ParseError[] = []

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1
    const cells = lines[i]!.split(delimiter)

    const exitTimeRaw = cells[idx["Exit time"]!]?.trim() ?? ""
    if (exitTimeRaw === "") continue

    const rawInstrument = cells[idx["Instrument"]!]?.trim() ?? ""
    const instrument    = extractSymbol(rawInstrument)
    const accountName   = cells[idx["Account"]!]?.trim() ?? ""
    const errorCtx      = { accountName: accountName || undefined, instrument: instrument || undefined }

    const marketPos      = cells[idx["Market pos."]!]?.trim() ?? ""
    const directionLower = marketPos.toLowerCase()
    let direction: "long" | "short"
    if (directionLower === "long")       direction = "long"
    else if (directionLower === "short") direction = "short"
    else {
      errors.push({ line: lineNumber, reason: `Unknown market position: "${marketPos}"`, ...errorCtx })
      continue
    }

    const tradeNumberRaw = cells[idx["Trade #"]!]?.trim() ?? ""
    const tradeNumber    = parseInt(tradeNumberRaw, 10)
    if (isNaN(tradeNumber)) {
      errors.push({ line: lineNumber, reason: `Invalid trade number: "${tradeNumberRaw}"`, ...errorCtx })
      continue
    }

    const quantityRaw = cells[idx["Quantity"]!]?.trim() ?? ""
    const contracts   = parseInt(quantityRaw, 10)
    if (isNaN(contracts)) {
      errors.push({ line: lineNumber, reason: `Invalid quantity: "${quantityRaw}"`, ...errorCtx })
      continue
    }

    const entryPriceRaw = cells[idx["Entry price"]!]?.trim() ?? ""
    const entryPrice    = parseNumber(entryPriceRaw)
    if (isNaN(entryPrice)) {
      errors.push({ line: lineNumber, reason: `Invalid entry price: "${entryPriceRaw}"`, ...errorCtx })
      continue
    }

    const exitPriceRaw = cells[idx["Exit price"]!]?.trim() ?? ""
    const exitPrice    = parseNumber(exitPriceRaw)
    if (isNaN(exitPrice)) {
      errors.push({ line: lineNumber, reason: `Invalid exit price: "${exitPriceRaw}"`, ...errorCtx })
      continue
    }

    const entryTimeRaw = cells[idx["Entry time"]!]?.trim() ?? ""
    const entryTime    = parseDate(entryTimeRaw)
    if (entryTime === null) {
      errors.push({ line: lineNumber, reason: `Invalid entry time: "${entryTimeRaw}"`, ...errorCtx })
      continue
    }

    const exitTime = parseDate(exitTimeRaw)
    if (exitTime === null) {
      errors.push({ line: lineNumber, reason: `Invalid exit time: "${exitTimeRaw}"`, ...errorCtx })
      continue
    }

    const profitRaw = cells[idx["Profit"]!]?.trim() ?? ""
    const pnl       = parseNumber(profitRaw)
    if (isNaN(pnl)) {
      errors.push({ line: lineNumber, reason: `Invalid profit: "${profitRaw}"`, ...errorCtx })
      continue
    }

    const commissionRaw = cells[idx["Commission"]!]?.trim() ?? ""
    const commission    = commissionRaw === "" ? 0 : parseNumber(commissionRaw)
    if (isNaN(commission)) {
      errors.push({ line: lineNumber, reason: `Invalid commission: "${commissionRaw}"`, ...errorCtx })
      continue
    }

    const netPnl = pnl - commission

    const maeRaw = cells[idx["MAE"]!]?.trim() ?? ""
    const maeNum = parseNumber(maeRaw)
    const mae: number | null = maeRaw === "" || isNaN(maeNum) ? null : maeNum

    const mfeRaw = cells[idx["MFE"]!]?.trim() ?? ""
    const mfeNum = parseNumber(mfeRaw)
    const mfe: number | null = mfeRaw === "" || isNaN(mfeNum) ? null : mfeNum

    const candidate = {
      tradeNumber,
      accountName,
      instrument,
      direction,
      contracts,
      entryPrice,
      exitPrice,
      entryTime,
      exitTime,
      pnl,
      commission,
      netPnl,
      mae,
      mfe,
      playbookId: null,
      session:    null,
      notes:      null,
      tags:       null,
    }

    const parsed = parsedRowSchema.safeParse(candidate)
    if (!parsed.success) {
      const reason = parsed.error.issues[0]?.message ?? "Validation failed"
      errors.push({ line: lineNumber, reason, ...errorCtx })
      continue
    }

    rows.push(parsed.data)
  }

  return { rows, errors, format }
}
