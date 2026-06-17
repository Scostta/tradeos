export const SHARE = {
  BUTTON:       "Share",
  REPORT_LABEL: "Performance report",
  GENERATED:    "Shared",

  KPI: {
    NET_PNL:       "Net P&L",
    WIN_RATE:      "Win rate",
    PROFIT_FACTOR: "Profit factor",
    TRADES:        "Total trades",
    TRADING_DAYS:  "Trading days",
    AVG_DAILY:     "Avg daily P&L",
    EXPECTANCY:    "Expectancy",
    MAX_DD:        "Max drawdown",
    AVG_HOLD:      "Avg hold time",
  },

  EQUITY:        "Equity curve",
  BY_DAY:        "By day of week",
  BY_INSTRUMENT: "By instrument",
  TABLE: {
    CATEGORY: "Category",
    TRADES:   "Trades",
    WIN:      "Win %",
    NET:      "Net P&L",
  },
  EMPTY_BREAKDOWN: "—",

  FOOTER:  "Shared via TradeOS",
  CTA:     "Start your own trading journal →",

  NOT_FOUND_TITLE: "Report not available",
  NOT_FOUND_MSG:   "This shared report has been revoked or doesn't exist.",
  NOT_FOUND_CTA:   "Go to TradeOS",

  MODAL: {
    TITLE:    "Share report",
    DESC:     "Anyone with the link sees a read-only snapshot — KPIs and equity curve only, no individual trades or notes.",
    CREATE:   "Create share link",
    CREATING: "Creating…",
    COPY:     "Copy",
    COPIED:   "Copied",
    OPEN:     "Open",
    EXISTING: "Your shared reports",
    NONE:     "No shared reports yet.",
    REVOKE:   "Revoke",
    CANCEL:   "Close",
    ERROR:    "Could not create the link. Try again.",
  },
} as const
