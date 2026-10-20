// ── Ingest del add-on de NinjaTrader 8 ────────────────────────────────────────
// El add-on manda una petición por posición cerrada (de flat a flat): todos los
// trades que NinjaTrader emparejaría en el Trade Performance para esa posición,
// más una captura opcional del chart. Tiempos en UTC (el add-on convierte desde
// la zona horaria de NinjaTrader).

import { z } from "zod"

export const ingestTradeSchema = z.object({
  direction:  z.enum(["long", "short"]),
  contracts:  z.number().int().positive(),
  entryPrice: z.number(),
  exitPrice:  z.number(),
  entryTime:  z.string().datetime({ offset: true }),
  exitTime:   z.string().datetime({ offset: true }),
  pnl:        z.number(),             // bruto, en USD (como "Profit" del CSV)
  commission: z.number().default(0),
  mae:        z.number().nullable().default(null),
  mfe:        z.number().nullable().default(null),
  stopPrice:  z.number().nullable().default(null),  // stop inicial de la posición
})

export const ingestPayloadSchema = z.object({
  addonVersion: z.string().max(20),
  account:      z.string().trim().min(1).max(100),
  instrument:   z.string().trim().min(1).max(50),  // "NQ 12-26" — se limpia a "NQ"
  trades:       z.array(ingestTradeSchema).min(1).max(200),
})

export type IngestTrade   = z.infer<typeof ingestTradeSchema>
export type IngestPayload = z.infer<typeof ingestPayloadSchema>

export type IngestResponse =
  | {
      ok:         true
      imported:   number
      duplicates: number
      excluded:   number
      attached:   boolean
    }
  | { ok: false; error: string }
