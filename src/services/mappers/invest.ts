import {
  investPositionSchema,
  investPriceSchema,
  investSettingsSchema,
  positionCheckSchema,
  screenResultSchema,
  screenRunSchema,
} from "~/types/invest"
import type {
  InvestPosition,
  InvestPrice,
  InvestSettings,
  PositionCheck,
  ScreenResult,
  ScreenRun,
} from "~/types/invest"

export function mapScreenRunFromDb(row: Record<string, unknown>): ScreenRun {
  return screenRunSchema.parse({
    id:           row["id"],
    runDate:      row["run_date"],
    executedAt:   row["executed_at"],
    universeSize: row["universe_size"],
    passedCount:  row["passed_count"],
    benchmark:    row["benchmark"],
    jobVersion:   row["job_version"],
  })
}

export function mapScreenResultFromDb(row: Record<string, unknown>): ScreenResult {
  return screenResultSchema.parse({
    id:                row["id"],
    runId:             row["run_id"],
    ticker:            row["ticker"],
    name:              row["name"] ?? null,
    exchange:          row["exchange"] ?? null,
    sector:            row["sector"] ?? null,
    currency:          row["currency"] ?? null,
    marketCap:         row["market_cap"] ?? null,
    revenueGrowthYoy:  row["revenue_growth_yoy"] ?? null,
    fcfMargin:         row["fcf_margin"] ?? null,
    grossMargin:       row["gross_margin"] ?? null,
    grossMarginPrev:   row["gross_margin_prev"] ?? null,
    netDebtEbitda:     row["net_debt_ebitda"] ?? null,
    roic:              row["roic"] ?? null,
    price:             row["price"] ?? null,
    sma10m:            row["sma10m"] ?? null,
    momentum121:       row["momentum_12_1"] ?? null,
    relStrength6m:     row["rel_strength_6m"] ?? null,
    monthsListed:      row["months_listed"] ?? null,
    passesFundamental: row["passes_fundamental"],
    passesTechnical:   row["passes_technical"],
    passes:            row["passes"],
    failReasons:       row["fail_reasons"] ?? [],
  })
}

export function mapInvestSettingsFromDb(row: Record<string, unknown>): InvestSettings {
  return investSettingsSchema.parse({
    userId:              row["user_id"],
    totalPortfolioValue: row["total_portfolio_value"],
    satellitePct:        row["satellite_pct"],
    maxPositions:        row["max_positions"],
    positionPct:         row["position_pct"],
    benchmarkTicker:     row["benchmark_ticker"],
    startedAt:           row["started_at"],
    lastReviewedRunId:   row["last_reviewed_run_id"] ?? null,
    updatedAt:           row["updated_at"] ?? null,
  })
}

export function mapInvestPositionFromDb(row: Record<string, unknown>): InvestPosition {
  return investPositionSchema.parse({
    id:         row["id"],
    userId:     row["user_id"],
    ticker:     row["ticker"],
    runId:      row["run_id"],
    openedAt:   row["opened_at"],
    entryPrice: row["entry_price"],
    shares:     row["shares"],
    feesOpen:   row["fees_open"] ?? 0,
    thesis:     row["thesis"],
    falsifiers: row["falsifiers"],
    closedAt:   row["closed_at"] ?? null,
    exitPrice:  row["exit_price"] ?? null,
    feesClose:  row["fees_close"] ?? 0,
    exitReason: row["exit_reason"] ?? null,
    exitNote:   row["exit_note"] ?? null,
    createdAt:  row["created_at"],
  })
}

export function mapPositionCheckFromDb(row: Record<string, unknown>): PositionCheck {
  return positionCheckSchema.parse({
    positionId: row["position_id"],
    runId:      row["run_id"],
    price:      row["price"],
    sma10m:     row["sma10m"],
    signal:     row["signal"],
  })
}

export function mapInvestPriceFromDb(row: Record<string, unknown>): InvestPrice {
  return investPriceSchema.parse({
    ticker:   row["ticker"],
    monthEnd: row["month_end"],
    adjClose: row["adj_close"],
  })
}
