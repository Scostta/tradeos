// Utilidades CSV de Money (MONEY_SPEC.md §3.1). Propias del módulo: Money no
// importa los parsers de Trading (src/lib/parsers).

/** Separador más frecuente en la línea de cabecera: ; , o tabulador. */
export function detectDelimiter(line: string): string {
  const counts = [";", ",", "\t"].map(d => [d, line.split(d).length - 1] as const)
  return counts.sort((a, b) => b[1] - a[1])[0]![1] > 0 ? counts[0]![0] : ","
}

/** Divide una línea respetando comillas dobles ("a;b" es un solo campo; "" es una comilla). */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let field = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) { out.push(field); field = "" }
    else field += ch
  }
  out.push(field)
  return out.map(f => f.trim())
}

export function splitLines(text: string): string[] {
  return text.replace(/^﻿/, "").split(/\r\n|\n|\r/)
}

/**
 * Importe con formato español o inglés y divisa opcional delante o detrás:
 * "-16,91EUR", "2.145,88 €", "1,234.56", "-12.5". Devuelve null si no es un
 * número. El último separador (, o .) seguido de 1–2 dígitos es el decimal.
 */
export function parseAmount(raw: string): { value: number; currency: string | null } | null {
  const s = raw.trim()
  const currency = s.match(/[A-Z]{3}|€/)?.[0] ?? null
  let n = s.replace(/[A-Z]{3}|€|\s/g, "")
  if (!/^[-+]?[\d.,]+$/.test(n) || !/\d/.test(n)) return null
  const decimal = n.match(/[.,](\d{1,2})$/)
  if (decimal) {
    const sep = n[n.length - decimal[1]!.length - 1]
    n = n.slice(0, n.length - decimal[1]!.length - 1).replace(/[.,]/g, "") + "." + decimal[1]
    if (sep !== "," && sep !== ".") return null
  } else {
    n = n.replace(/[.,]/g, "")
  }
  const value = Number(n)
  return Number.isFinite(value) ? { value, currency: currency === "€" ? "EUR" : currency } : null
}

/** Fecha dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa, dd/mm/aa o aaaa-mm-dd → YYYY-MM-DD; null si no es válida. */
export function parseDate(raw: string): string | null {
  const s = raw.trim().slice(0, 10)
  let y: number, m: number, d: number
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const eu = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/)
  if (iso) [y, m, d] = [+iso[1]!, +iso[2]!, +iso[3]!]
  else if (eu) [d, m, y] = [+eu[1]!, +eu[2]!, eu[3]!.length === 2 ? 2000 + +eu[3]! : +eu[3]!]
  else return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date.toISOString().slice(0, 10)
}
