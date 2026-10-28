// ── Payload del add-on → filas de trades ──────────────────────────────────────
// Usa la misma huella que el import CSV (withImportKeys), así un trade que llega
// por el add-on y luego en un CSV de NinjaTrader no se duplica.

import { extractSymbol } from "~/lib/parsers/csv-utils"
import { tradeFingerprint, withImportKeys } from "~/helpers/trade-fingerprint"
import type { IngestPayload } from "~/types/ingest"

export type SyncTradeRow = {
  instrument:  string
  direction:   "long" | "short"
  contracts:   number
  entryPrice:  number
  exitPrice:   number
  entryTime:   string
  exitTime:    string
  pnl:         number
  commission:  number
  netPnl:      number
  mae:         number | null
  mfe:         number | null
  stopPrice:   number | null
  importKey:   string
}

const toIso = (t: string): string => new Date(t).toISOString()

export function buildSyncTradeRows(payload: IngestPayload): SyncTradeRow[] {
  const instrument = extractSymbol(payload.instrument)

  const rows = payload.trades.map((t) => ({
    instrument,
    direction:   t.direction,
    contracts:   t.contracts,
    entryPrice:  t.entryPrice,
    exitPrice:   t.exitPrice,
    entryTime:   toIso(t.entryTime),
    exitTime:    toIso(t.exitTime),
    pnl:         t.pnl,
    commission:  t.commission,
    netPnl:      t.pnl - t.commission,
    mae:         t.mae,
    mfe:         t.mfe,
    stopPrice:   t.stopPrice,
  }))

  // Todas las filas son de la misma cuenta: el #n cuenta dentro del payload.
  const keyed = withImportKeys(rows.map((r) => ({ ...r, accountName: payload.account })))
  return rows
    .map((row, i) => ({ ...row, importKey: keyed[i]!.importKey }))
    // Un trade con la salida antes que la entrada es imposible: lo generaba el
    // add-on ≤ 2.0 al recibir el historial reenviado en orden inverso tras una
    // reconexión de Rithmic (un short convertido en long).
    .filter((row) => row.exitTime >= row.entryTime)
}

export type ExistingTrade = Pick<
  SyncTradeRow,
  "instrument" | "direction" | "contracts" | "entryPrice" | "exitPrice" | "entryTime" | "exitTime"
>

// Huella sin contratos: mismo instrumento, dirección, horas y precios.
const lotKey = (t: ExistingTrade): string => tradeFingerprint({ ...t, contracts: 0 })

/**
 * Quita los trades que ya están en la cuenta aunque con otro reparto de
 * contratos. Al releer el historial (reinicio de NinjaTrader), Rithmic puede
 * agrupar las ejecuciones de otra forma: el long 4 enviado en vivo vuelve como
 * long 1 + long 3, con otra import_key. Si los trades existentes con la misma
 * huella sin contratos ya suman al menos esos contratos, el reenvío sobra.
 */
export function dropCoveredRows<T extends ExistingTrade>(rows: T[], existing: ExistingTrade[]): T[] {
  const sum = (list: ExistingTrade[]) => {
    const totals = new Map<string, number>()
    for (const t of list) totals.set(lotKey(t), (totals.get(lotKey(t)) ?? 0) + t.contracts)
    return totals
  }
  const have = sum(existing)
  const incoming = sum(rows)
  return rows.filter((row) => (have.get(lotKey(row)) ?? 0) < incoming.get(lotKey(row))!)
}
