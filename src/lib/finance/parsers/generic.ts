import { detectDelimiter, parseAmount, parseDate, splitCsvLine, splitLines } from "./csv"
import type { ParseError, ParseResult, ParsedTransaction } from "./types"

// Importador genérico con mapeo de columnas (MONEY_SPEC.md §3.1), para bancos
// sin parser propio. El usuario elige qué columna es cada campo; el mapeo se
// propone a partir de los nombres de cabecera, nunca se aplica sin verlo.

export const GENERIC_FORMAT = "custom"

export type FinanceField = "date" | "concept" | "amount" | "debit" | "credit" | "balance"

export const FINANCE_FIELDS: { key: FinanceField; required: boolean }[] = [
  { key: "date",    required: true },
  { key: "concept", required: true },
  { key: "amount",  required: false },   // o debit + credit
  { key: "debit",   required: false },
  { key: "credit",  required: false },
  { key: "balance", required: false },
]

export type FinanceMapping = Partial<Record<FinanceField, number>>   // campo → índice de columna

export type CsvInspection = {
  delimiter:  string
  headerLine: number          // índice (0) de la línea de cabecera
  headers:    string[]
  sampleRows: string[][]      // 5 primeras filas de datos
}

const SYNONYMS: Record<FinanceField, string[]> = {
  date:    ["fecha operacion", "fecha", "date", "booking date", "fecha valor", "f. operacion"],
  concept: ["concepto", "descripcion", "description", "concept", "detalle", "movimiento"],
  amount:  ["importe", "amount", "cantidad", "importe eur"],
  debit:   ["cargo", "debe", "debit", "gasto"],
  credit:  ["abono", "haber", "credit", "ingreso"],
  balance: ["saldo", "saldo disponible", "balance", "saldo tras movimiento"],
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

/** La cabecera es la primera línea (de las 10 primeras) con más columnas reconocibles. */
export function inspectCsv(text: string): CsvInspection {
  const lines = splitLines(text).filter(l => l.trim())
  const delimiter = detectDelimiter(lines.find(l => /[;,\t]/.test(l)) ?? "")
  let headerLine = 0
  let best = -1
  lines.slice(0, 10).forEach((l, i) => {
    const cells = splitCsvLine(l, delimiter).map(norm)
    const score = cells.filter(c => Object.values(SYNONYMS).some(syns => syns.includes(c))).length
    if (score > best) { best = score; headerLine = i }
  })
  return {
    delimiter,
    headerLine,
    headers: splitCsvLine(lines[headerLine] ?? "", delimiter),
    sampleRows: lines.slice(headerLine + 1, headerLine + 6).map(l => splitCsvLine(l, delimiter)),
  }
}

/** Propuesta de mapeo por nombre de cabecera (exacto primero, luego "contiene"). */
export function guessMapping(headers: string[]): FinanceMapping {
  const lower = headers.map(norm)
  const used = new Set<number>()
  const mapping: FinanceMapping = {}
  for (const { key } of FINANCE_FIELDS) {
    const syns = SYNONYMS[key]
    let idx = syns.map(s => lower.findIndex((h, i) => !used.has(i) && h === s)).find(i => i !== -1) ?? -1
    if (idx === -1) idx = lower.findIndex((h, i) => !used.has(i) && syns.some(s => h.includes(s)))
    if (idx !== -1) { mapping[key] = idx; used.add(idx) }
  }
  // Si hay importe con signo, cargo/abono sobran (y al revés).
  if (mapping.amount != null) { delete mapping.debit; delete mapping.credit }
  return mapping
}

export function mappingIsComplete(m: FinanceMapping): boolean {
  return m.date != null && m.concept != null && (m.amount != null || (m.debit != null && m.credit != null))
}

export function parseWithMapping(text: string, mapping: FinanceMapping): ParseResult {
  const { delimiter, headerLine } = inspectCsv(text)
  const all = splitLines(text)
  // headerLine cuenta solo líneas no vacías: se recalcula sobre el fichero entero.
  let seen = -1
  const start = all.findIndex(l => l.trim() && ++seen === headerLine) + 1

  const rows: ParsedTransaction[] = []
  const errors: ParseError[] = []
  const cell = (cells: string[], f: FinanceField) => (mapping[f] != null ? cells[mapping[f]!] ?? "" : "")

  all.slice(start).forEach((raw, i) => {
    const line = start + i + 1
    if (!raw.trim()) return
    const cells = splitCsvLine(raw, delimiter)
    const bookedAt = parseDate(cell(cells, "date"))
    const concept = cell(cells, "concept")
    let amount: number | null = null
    let currency: string | null = null
    if (mapping.amount != null) {
      const a = parseAmount(cell(cells, "amount"))
      amount = a?.value ?? null
      currency = a?.currency ?? null
    } else {
      const debit = parseAmount(cell(cells, "debit"))
      const credit = parseAmount(cell(cells, "credit"))
      if (debit || credit) amount = (credit?.value ?? 0) - Math.abs(debit?.value ?? 0)
      currency = debit?.currency ?? credit?.currency ?? null
    }
    const balance = mapping.balance != null ? parseAmount(cell(cells, "balance")) : null

    if (!bookedAt) return void errors.push({ line, message: `Invalid date "${cell(cells, "date")}".` })
    if (amount == null) return void errors.push({ line, message: "Invalid amount." })
    if (currency && currency !== "EUR") return void errors.push({ line, message: `Currency ${currency} is not EUR.` })
    if (!concept) return void errors.push({ line, message: "Empty concept." })
    rows.push({ line, bookedAt, conceptRaw: concept, amount, balanceAfter: balance?.value ?? null })
  })
  return { format: GENERIC_FORMAT, rows, errors, ibanLast4: null }
}
