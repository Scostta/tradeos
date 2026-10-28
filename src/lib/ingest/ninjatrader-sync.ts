// ── Payload del add-on → filas de trades ──────────────────────────────────────
// Usa la misma huella que el import CSV (withImportKeys), así un trade que llega
// por el add-on y luego en un CSV de NinjaTrader no se duplica.

import { extractSymbol } from "~/lib/parsers/csv-utils"
import { withImportKeys } from "~/helpers/trade-fingerprint"
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
