import type { DrawdownType, PropPhase } from "~/types/account"

// Standard plan specs for the prop firms our users trade most. Selecting a
// preset fills the account editor's prop-firm fields in one shot. Values are
// the firms' published evaluation rules; users can tweak after applying.
//
// Apex   — trailing-intraday drawdown, floor locks at start + $100, NO daily
//          loss limit.
// Topstep — trailing end-of-day drawdown, floor locks at the start balance,
//          no separate daily loss limit in the current Trading Combine.

export type PropFirmPreset = {
  id:             string
  firm:           string        // grouping + broker autofill
  label:          string
  initialBalance: number
  drawdownType:   DrawdownType
  drawdownAmount: number
  drawdownLockAt: number | null
  dailyLossLimit: number | null
  profitTarget:   number | null
  minTradingDays: number | null
  propPhase:      PropPhase
}

const APEX = "Apex Trader Funding"
const TOPSTEP = "Topstep"

export const PROP_FIRM_PRESETS: PropFirmPreset[] = [
  // ── Apex (trailing intraday · lock = start + $100 · no daily loss) ───────────
  { id: "apex-25k",  firm: APEX, label: "Apex 25K",  initialBalance: 25000,  drawdownType: "trailing_intraday", drawdownAmount: 1500, drawdownLockAt: 25100,  dailyLossLimit: null, profitTarget: 1500,  minTradingDays: 1, propPhase: "evaluation" },
  { id: "apex-50k",  firm: APEX, label: "Apex 50K",  initialBalance: 50000,  drawdownType: "trailing_intraday", drawdownAmount: 2500, drawdownLockAt: 50100,  dailyLossLimit: null, profitTarget: 3000,  minTradingDays: 1, propPhase: "evaluation" },
  { id: "apex-75k",  firm: APEX, label: "Apex 75K",  initialBalance: 75000,  drawdownType: "trailing_intraday", drawdownAmount: 2750, drawdownLockAt: 75100,  dailyLossLimit: null, profitTarget: 4250,  minTradingDays: 1, propPhase: "evaluation" },
  { id: "apex-100k", firm: APEX, label: "Apex 100K", initialBalance: 100000, drawdownType: "trailing_intraday", drawdownAmount: 3000, drawdownLockAt: 100100, dailyLossLimit: null, profitTarget: 6000,  minTradingDays: 1, propPhase: "evaluation" },
  { id: "apex-150k", firm: APEX, label: "Apex 150K", initialBalance: 150000, drawdownType: "trailing_intraday", drawdownAmount: 5000, drawdownLockAt: 150100, dailyLossLimit: null, profitTarget: 9000,  minTradingDays: 1, propPhase: "evaluation" },
  { id: "apex-250k", firm: APEX, label: "Apex 250K", initialBalance: 250000, drawdownType: "trailing_intraday", drawdownAmount: 6500, drawdownLockAt: 250100, dailyLossLimit: null, profitTarget: 15000, minTradingDays: 1, propPhase: "evaluation" },
  { id: "apex-300k", firm: APEX, label: "Apex 300K", initialBalance: 300000, drawdownType: "trailing_intraday", drawdownAmount: 7500, drawdownLockAt: 300100, dailyLossLimit: null, profitTarget: 20000, minTradingDays: 1, propPhase: "evaluation" },

  // ── Topstep (trailing end-of-day · lock = start balance) ─────────────────────
  { id: "topstep-50k",  firm: TOPSTEP, label: "Topstep 50K",  initialBalance: 50000,  drawdownType: "trailing_eod", drawdownAmount: 2000, drawdownLockAt: 50000,  dailyLossLimit: null, profitTarget: 3000, minTradingDays: 2, propPhase: "evaluation" },
  { id: "topstep-100k", firm: TOPSTEP, label: "Topstep 100K", initialBalance: 100000, drawdownType: "trailing_eod", drawdownAmount: 3000, drawdownLockAt: 100000, dailyLossLimit: null, profitTarget: 6000, minTradingDays: 2, propPhase: "evaluation" },
  { id: "topstep-150k", firm: TOPSTEP, label: "Topstep 150K", initialBalance: 150000, drawdownType: "trailing_eod", drawdownAmount: 4500, drawdownLockAt: 150000, dailyLossLimit: null, profitTarget: 9000, minTradingDays: 2, propPhase: "evaluation" },
]

// Firm names in display order, derived from the preset list.
export const PROP_FIRM_PRESET_FIRMS: string[] = [...new Set(PROP_FIRM_PRESETS.map((p) => p.firm))]
