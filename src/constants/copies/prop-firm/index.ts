export const PROP_FIRM = {
  // ── Editor ──────────────────────────────────────────────────────────────────
  SECTION:        "Prop firm rules",
  PHASE:          "Phase",
  PHASE_NONE:     "— Not a prop account —",
  DRAWDOWN_TYPE:  "Drawdown model",
  DRAWDOWN_NONE:  "— None —",
  DD_AMOUNT:      "Max drawdown ($)",
  DD_LOCK:        "Lock floor at ($)",
  DD_LOCK_HINT:   "Apex: start + $100 · Topstep: start balance · empty = trails forever",
  DD_NEEDS_BALANCE: "⚠ Set an initial balance above — drawdown is tracked relative to it.",
  DAILY_LOSS:     "Daily loss limit ($)",
  PROFIT_TARGET:  "Profit target ($)",
  MIN_DAYS:       "Min trading days",
  RISK_PER_TRADE: "Risk per trade ($)",
  RISK_HINT:      "Fallback for R-multiples when a trade has no stop set.",

  PHASE_LABELS: {
    evaluation: "Evaluation",
    funded:     "Funded",
    payout:     "Payout",
  },
  DRAWDOWN_TYPE_LABELS: {
    trailing_intraday: "Trailing · intraday",
    trailing_eod:      "Trailing · end-of-day",
    static:            "Static floor",
  },

  // ── Status card ───────────────────────────────────────────────────────────────
  STATUS_TITLE: "Prop firm status",
  BALANCE:      "Balance",
  DRAWDOWN:     "Drawdown",
  FLOOR:        "Floor",
  ROOM_LEFT:    "Room left",
  DAILY_LOSS_C: "Daily loss",
  REMAINING:    "left",
  TARGET:       "Profit target",
  DAYS:         "Trading days",
  OF:           "of",

  ALERT: {
    breached: "Account blown",
    danger:   "Close to breach",
    warning:  "Watch your risk",
    safe:     "Within limits",
  },
} as const
