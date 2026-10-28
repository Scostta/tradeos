import { normalizeConcept } from "./normalize-concept"

// Huella de un movimiento importado (MONEY_SPEC.md §3.3). Dedupe por
// (account_id, import_key): re-importar un mes o solapar rangos no duplica.
//
//   booked_at|importe (2 decimales)|normalizeConcept(concepto)|saldo tras el movimiento#n
//
// El saldo (si el export lo trae) distingue dos cafés iguales el mismo día; si
// no lo trae, lo cubre #n, el ordinal entre movimientos idénticos del fichero.

export type FingerprintFields = {
  bookedAt:     string          // YYYY-MM-DD
  amount:       number          // firmado
  conceptRaw:   string
  balanceAfter: number | null
}

export function transactionFingerprint(t: FingerprintFields): string {
  const parts = [t.bookedAt, t.amount.toFixed(2), normalizeConcept(t.conceptRaw)]
  if (t.balanceAfter != null) parts.push(t.balanceAfter.toFixed(2))
  return parts.join("|")
}

/** Huella + `#n` para cada fila del fichero, en su orden. */
export function withFinanceImportKeys<T extends FingerprintFields>(rows: T[]): (T & { importKey: string })[] {
  const seen = new Map<string, number>()
  return rows.map(row => {
    const fp = transactionFingerprint(row)
    const n = (seen.get(fp) ?? 0) + 1
    seen.set(fp, n)
    return { ...row, importKey: `${fp}#${n}` }
  })
}

/** Movimientos manuales (efectivo, partes de un split): nunca chocan con un import. */
export function manualImportKey(id: string): string {
  return `manual|${id}`
}
