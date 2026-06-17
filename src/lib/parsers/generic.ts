// ── Generic mapped CSV importer ───────────────────────────────────────────────
// For any broker whose CSV isn't auto-detected: the user maps their columns to
// the canonical fields and we parse one completed trade per row. Trades without
// a trade id get a deterministic synthetic one so re-imports dedup idempotently.

import { parsedRowSchema, CANONICAL_IMPORT_FIELDS } from "~/types/import"
import {
  detectDelimiter,
  splitCsvLine,
  extractSymbol,
  parseFlexibleNumber,
  parseFlexibleDate,
  stableTradeNumber,
} from "~/lib/parsers/csv-utils"
import type { ParseResult, ParseError, ColumnMapping, CsvInspection, CanonicalField } from "~/types/import"

const FORMAT = "Custom CSV"

const SYNONYMS: Record<CanonicalField, string[]> = {
  instrument: ["instrument", "symbol", "ticker", "contract", "market"],
  side:       ["side", "direction", "market pos.", "b/s", "buy/sell", "position", "l/s", "type"],
  contracts:  ["contracts", "quantity", "qty", "size", "volume", "lots", "shares"],
  entryPrice: ["entry price", "entryprice", "buy price", "open price", "avg entry", "entry"],
  exitPrice:  ["exit price", "exitprice", "sell price", "close price", "avg exit", "exit"],
  entryTime:  ["entry time", "entrytime", "open time", "date/time in", "date in", "opened", "time in"],
  exitTime:   ["exit time", "exittime", "close time", "date/time out", "date out", "closed", "time out"],
  pnl:        ["gross p&l", "gross pnl", "profit", "pnl", "p&l", "realized p&l", "p/l", "gain", "net p&l"],
  commission: ["commission", "commissions", "fees", "fee", "comm"],
  account:    ["account", "account name", "acct"],
  tradeId:    ["trade #", "trade#", "trade number", "trade id", "order id", "id", "#"],
  mae:        ["mae", "max adverse"],
  mfe:        ["mfe", "max favorable"],
}

/** Splits the CSV into header + a few sample data rows for the mapping UI. */
export function inspectCsv(text: string): CsvInspection {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], sampleRows: [], delimiter: "," }
  const delimiter  = detectDelimiter(lines[0]!)
  const headers    = splitCsvLine(lines[0]!, delimiter).map((h) => h.trim())
  const sampleRows = lines.slice(1, 6).map((l) => splitCsvLine(l, delimiter).map((c) => c.trim()))
  return { headers, sampleRows, delimiter }
}

/** Best-effort auto-mapping from header names to canonical fields. */
export function guessMapping(headers: string[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase().trim())
  const used = new Set<number>()
  const mapping: ColumnMapping = {}

  for (const field of CANONICAL_IMPORT_FIELDS) {
    const syns = SYNONYMS[field.key]
    let idx = lower.findIndex((h, i) => !used.has(i) && syns.includes(h))         // exact
    if (idx === -1) idx = lower.findIndex((h, i) => !used.has(i) && syns.some((s) => h.includes(s)))  // contains
    if (idx !== -1) { mapping[field.key] = headers[idx]!; used.add(idx) }
  }
  return mapping
}

function normalizeSide(raw: string): "long" | "short" | null {
  const s = raw.trim().toLowerCase()
  if (["long", "buy", "b", "bought", "l"].includes(s)) return "long"
  if (["short", "sell", "s", "sold"].includes(s))      return "short"
  return null
}

/** Parses the CSV with a user-provided column mapping into canonical rows. */
export function parseWithMapping(
  text: string,
  mapping: ColumnMapping,
  opts: { accountFallback?: string } = {},
): ParseResult {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) {
    return { rows: [], errors: [{ line: 1, reason: "CSV has no data rows" }], format: FORMAT }
  }

  const delimiter = detectDelimiter(lines[0]!)
  const headers   = splitCsvLine(lines[0]!, delimiter).map((h) => h.trim())

  const idx = {} as Record<CanonicalField, number>
  for (const f of CANONICAL_IMPORT_FIELDS) {
    const name = mapping[f.key]
    idx[f.key] = name ? headers.indexOf(name) : -1
  }

  const missing = CANONICAL_IMPORT_FIELDS.filter((f) => f.required && idx[f.key] === -1)
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, reason: `Map the required columns: ${missing.map((f) => f.label).join(", ")}` }],
      format: FORMAT,
    }
  }

  const accountFallback = opts.accountFallback?.trim() ?? ""
  const rows = []
  const errors: ParseError[] = []

  for (let i = 1; i < lines.length; i++) {
    const lineNumber = i + 1
    const cells = splitCsvLine(lines[i]!, delimiter)
    const get = (f: CanonicalField): string => (idx[f] >= 0 ? (cells[idx[f]]?.trim() ?? "") : "")

    const instrument = extractSymbol(get("instrument"))
    const accountName = (idx.account >= 0 ? get("account") : "") || accountFallback
    const ctx = { accountName: accountName || undefined, instrument: instrument || undefined }

    if (!accountName) { errors.push({ line: lineNumber, reason: "Missing account (map a column or set a default)", ...ctx }); continue }
    if (!instrument)  { errors.push({ line: lineNumber, reason: "Missing instrument", ...ctx }); continue }

    const direction = normalizeSide(get("side"))
    if (!direction) { errors.push({ line: lineNumber, reason: `Unknown direction: "${get("side")}"`, ...ctx }); continue }

    const contracts = Math.round(parseFlexibleNumber(get("contracts")))
    if (!Number.isFinite(contracts) || contracts <= 0) { errors.push({ line: lineNumber, reason: `Invalid contracts: "${get("contracts")}"`, ...ctx }); continue }

    const entryPrice = parseFlexibleNumber(get("entryPrice"))
    const exitPrice  = parseFlexibleNumber(get("exitPrice"))
    if (Number.isNaN(entryPrice) || Number.isNaN(exitPrice)) { errors.push({ line: lineNumber, reason: "Invalid entry/exit price", ...ctx }); continue }

    const entryTime = parseFlexibleDate(get("entryTime"))
    const exitTime  = parseFlexibleDate(get("exitTime"))
    if (!entryTime || !exitTime) { errors.push({ line: lineNumber, reason: "Invalid entry/exit time", ...ctx }); continue }

    const pnl = parseFlexibleNumber(get("pnl"))
    if (Number.isNaN(pnl)) { errors.push({ line: lineNumber, reason: `Invalid P&L: "${get("pnl")}"`, ...ctx }); continue }

    const commRaw = idx.commission >= 0 ? parseFlexibleNumber(get("commission")) : 0
    const commission = Number.isNaN(commRaw) ? 0 : Math.abs(commRaw)
    const netPnl = pnl - commission

    const maeNum = idx.mae >= 0 ? parseFlexibleNumber(get("mae")) : NaN
    const mfeNum = idx.mfe >= 0 ? parseFlexibleNumber(get("mfe")) : NaN
    const mae = Number.isNaN(maeNum) ? null : maeNum
    const mfe = Number.isNaN(mfeNum) ? null : mfeNum

    const idRaw = idx.tradeId >= 0 ? get("tradeId") : ""
    const idNum = parseInt(idRaw, 10)
    const tradeNumber = idRaw !== "" && !Number.isNaN(idNum) && idNum > 0
      ? idNum
      : stableTradeNumber([accountName, instrument, entryTime, exitTime, String(entryPrice), String(exitPrice)])

    const parsed = parsedRowSchema.safeParse({
      tradeNumber, accountName, instrument, direction, contracts,
      entryPrice, exitPrice, entryTime, exitTime, pnl, commission, netPnl,
      mae, mfe, playbookId: null, session: null, notes: null, tags: null,
    })
    if (!parsed.success) {
      errors.push({ line: lineNumber, reason: parsed.error.issues[0]?.message ?? "Validation failed", ...ctx })
      continue
    }
    rows.push(parsed.data)
  }

  return { rows, errors, format: FORMAT }
}
