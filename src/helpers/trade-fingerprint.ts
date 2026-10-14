// Clave natural de un trade importado. El "Trade number" de NinjaTrader es solo
// la posición de la fila dentro de cada export (se reinicia en 1), así que no
// sirve para deduplicar entre CSVs distintos. La huella usa los datos reales
// del trade.
//
// Mantener en sync con la expresión SQL de
// supabase/migrations/20261014120000_trade_import_key.sql (backfill).

type FingerprintFields = {
  instrument: string
  direction:  string
  contracts:  number
  entryPrice: number
  exitPrice:  number
  entryTime:  string
  exitTime:   string
}

const epochSeconds = (iso: string): number => Math.floor(Date.parse(iso) / 1000)

/**
 * instrument|direction|contracts|entry epoch|exit epoch|entry price|exit price.
 * Precios con 4 decimales y tiempos en segundos para casar con numeric(12,4) y
 * timestamptz en BD.
 */
export function tradeFingerprint(t: FingerprintFields): string {
  return [
    t.instrument,
    t.direction,
    String(t.contracts),
    String(epochSeconds(t.entryTime)),
    String(epochSeconds(t.exitTime)),
    t.entryPrice.toFixed(4),
    t.exitPrice.toFixed(4),
  ].join("|")
}

/**
 * Huella + `#n`: n-ésima aparición de esa huella en la misma cuenta dentro del
 * CSV. Dos trades idénticos (p. ej. dos fills de 1 contrato al mismo precio y
 * segundo) se distinguen, y un re-import del mismo export les da las mismas
 * claves.
 */
export function withImportKeys<T extends FingerprintFields & { accountName: string }>(
  rows: T[]
): (T & { importKey: string })[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const fp = tradeFingerprint(row)
    const scope = `${row.accountName}||${fp}`
    const n = (seen.get(scope) ?? 0) + 1
    seen.set(scope, n)
    return { ...row, importKey: `${fp}#${n}` }
  })
}

/** La clave casa con los datos de la fila (no se ha manipulado en el cliente). */
export function importKeyMatches(row: FingerprintFields & { importKey: string }): boolean {
  return /^.+#\d+$/.test(row.importKey) &&
    row.importKey.slice(0, row.importKey.lastIndexOf("#")) === tradeFingerprint(row)
}
