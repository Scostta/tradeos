import { getPositions, getPricesFor } from "~/services/queries/invest"
import { isCurrentMonthRun, openBlockers, positionsForLimits } from "~/lib/calculations/invest-run"
import type { OpenBlocker } from "~/lib/calculations/invest-run"
import { EUR_FX_TICKERS, buildPriceIndex, eurPerUnit, monthKey } from "~/lib/calculations/invest-fx"
import type { PriceIndex } from "~/lib/calculations/invest-fx"
import type { InvestPositionWithMeta, InvestSettings, ScreenResult, ScreenRun, ThesisAnswers } from "~/types/invest"
import type { OpenCandidate } from "./open-position-modal.client"

export type OpenAction = { candidate: OpenCandidate; blockers: OpenBlocker[] }

export type OpenContext = {
  run:           ScreenRun
  settings:      InvestSettings
  isCurrent:     boolean
  openPositions: InvestPositionWithMeta[]
  fxIndex:       PriceIndex
}

// Lo que necesita el botón Open en Screen y en /invest/[ticker]; null si falla la carga.
export async function loadOpenContext(run: ScreenRun, settings: InvestSettings): Promise<OpenContext | null> {
  const [positions, fx] = await Promise.all([
    getPositions(),
    // FX del mes del run para el importe sugerido en EUR (§5.3).
    getPricesFor([...new Set(Object.values(EUR_FX_TICKERS))], run.runDate),
  ])
  if (!positions.success || !fx.success) return null
  const today = new Date().toISOString().slice(0, 10)
  return {
    run,
    settings,
    isCurrent:     isCurrentMonthRun(run.runDate, today),
    // §1.6: los límites se cuentan solo entre las posiciones del modo actual.
    openPositions: positionsForLimits(positions.data, settings.paperMode),
    fxIndex:       buildPriceIndex(fx.data),
  }
}

export function openActionFor(ctx: OpenContext, r: ScreenResult, draft: ThesisAnswers | null): OpenAction {
  const { run, settings } = ctx
  return {
    blockers: openBlockers({
      isCurrentRun:  ctx.isCurrent,
      candidate:     r,
      openPositions: ctx.openPositions,
      maxPositions:  settings.maxPositions,
    }),
    candidate: {
      ticker:              r.ticker,
      name:                r.name,
      currency:            r.currency,
      price:               r.price,
      runDate:             run.runDate,
      totalPortfolioValue: settings.totalPortfolioValue,
      positionPct:         settings.positionPct,
      eurPerUnit:          eurPerUnit(r.currency, monthKey(run.runDate), ctx.fxIndex),
      paper:               settings.paperMode,
      draft,
    },
  }
}
