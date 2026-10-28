import { parseAmount, parseDate, splitCsvLine, splitLines } from "./csv"
import { UnrecognizedLayoutError } from "./types"
import type { ParseError, ParseResult, ParsedTransaction } from "./types"

// Export de movimientos de imagin (CSV, "Extracto Movimientos imagin_AAAAMMDD.csv").
// Formato visto en una muestra real (28/10/2026):
//
//   IBAN;Saldo disponible;Periodo
//   ES00…;2.734,67;01/10/2026 - 28/10/2026
//   Concepto;Fecha;Importe;Saldo disponible
//   MERCADONA TARIFA;27/10/2026;-16,91EUR;588,79EUR
//   …  (de más reciente a más antiguo)
//
// Si las cabeceras cambian, se rechaza el fichero entero (§3.1: no se adivinan
// columnas). Del IBAN solo se conservan los 4 últimos dígitos.

export const IMAGIN_FORMAT = "imagin"

const ACCOUNT_HEADER = ["IBAN", "Saldo disponible", "Periodo"]
const ROWS_HEADER = ["Concepto", "Fecha", "Importe", "Saldo disponible"]
const DELIMITER = ";"

const sameHeader = (cells: string[], expected: string[]) =>
  cells.length === expected.length && cells.every((c, i) => c.toLowerCase() === expected[i]!.toLowerCase())

/** ¿Tiene la forma del export de imagin? (solo mira las cabeceras) */
export function isImagin(text: string): boolean {
  const lines = splitLines(text)
  return sameHeader(splitCsvLine(lines[0] ?? "", DELIMITER), ACCOUNT_HEADER)
}

export function parseImagin(text: string): ParseResult {
  const lines = splitLines(text)
  if (!sameHeader(splitCsvLine(lines[0] ?? "", DELIMITER), ACCOUNT_HEADER)) {
    throw new UnrecognizedLayoutError("The first line is not the imagin account header (IBAN;Saldo disponible;Periodo).")
  }
  if (!sameHeader(splitCsvLine(lines[2] ?? "", DELIMITER), ROWS_HEADER)) {
    throw new UnrecognizedLayoutError("The transactions header is not Concepto;Fecha;Importe;Saldo disponible.")
  }

  const iban = (splitCsvLine(lines[1] ?? "", DELIMITER)[0] ?? "").replace(/\s/g, "")
  const ibanLast4 = /\d{4}$/.test(iban) ? iban.slice(-4) : null

  const rows: ParsedTransaction[] = []
  const errors: ParseError[] = []
  lines.slice(3).forEach((raw, i) => {
    const line = i + 4
    if (!raw.trim()) return
    const cells = splitCsvLine(raw, DELIMITER)
    if (cells.length !== ROWS_HEADER.length) {
      errors.push({ line, message: `Expected ${ROWS_HEADER.length} columns, found ${cells.length}.` })
      return
    }
    const [concept, date, amountRaw, balanceRaw] = cells as [string, string, string, string]
    const bookedAt = parseDate(date)
    const amount = parseAmount(amountRaw)
    const balance = balanceRaw ? parseAmount(balanceRaw) : null
    if (!bookedAt) return void errors.push({ line, message: `Invalid date "${date}".` })
    if (!amount) return void errors.push({ line, message: `Invalid amount "${amountRaw}".` })
    if (amount.currency && amount.currency !== "EUR") return void errors.push({ line, message: `Currency ${amount.currency} is not EUR.` })
    if (!concept) return void errors.push({ line, message: "Empty concept." })
    rows.push({ line, bookedAt, conceptRaw: concept, amount: amount.value, balanceAfter: balance?.value ?? null })
  })

  return { format: IMAGIN_FORMAT, rows, errors, ibanLast4 }
}
