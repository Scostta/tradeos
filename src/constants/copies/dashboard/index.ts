export const DASHBOARD = {
  TITLE:    "Dashboard",
  SUBTITLE: "Overview · metrics · equity curve",

  RANGE: {
    TODAY: "Today",
    WEEK:  "This Week",
    MONTH: "This Month",
    YTD:   "YTD",
  },

  METRICS: {
    NET_PNL:       "Net P&L",
    WIN_RATE:      "Win Rate",
    PROFIT_FACTOR: "Profit Factor",
    MAX_DRAWDOWN:  "Max Drawdown",
    AVG_WIN:       "Avg Win",
    AVG_LOSS:      "Avg Loss",
    SUB_PEAK:      "peak-to-trough",
    SUB_WINNERS:   "winners",
    SUB_LOSERS:    "losers",
    PF_HEALTHY:    "healthy",
    PF_POSITIVE:   "positive",
    PF_REVIEW:     "review",
  },

  EQUITY: {
    LABEL:       "Equity Curve",
    MODE_LINE:   "Line",
    MODE_AREA:   "Area",
    MODE_CANDLE: "Candle",
  },

  BY_DAY: {
    LABEL: "P&L · By Day",
  },

  RECENT: {
    LABEL:    "Recent Trades",
    VIEW_ALL: "View all →",
    HEADERS: {
      NUMBER:     "#",
      TIME:       "Time",
      INSTRUMENT: "Instrument",
      DIR:        "Dir",
      QTY:        "Qty",
      NET_PNL:    "Net P&L",
    },
    DIR_LONG:  "LONG",
    DIR_SHORT: "SHORT",
  },

  EMPTY: {
    TITLE:   "No trades yet",
    MESSAGE: "Import a NinjaTrader CSV to see your metrics and equity curve.",
    CTA:     "Go to Import",
  },

  ERROR: {
    TITLE:   "Could not load dashboard",
    MESSAGE: "Something went wrong fetching your trades. Try again.",
    RETRY:   "Retry",
  },
} as const
