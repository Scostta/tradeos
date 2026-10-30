// Textos de los avisos push de Invest (POST /api/invest/notify).
export const INVEST_NOTIFY = {
  RUN_TITLE:    "New Invest screen · {month}",
  RUN_NONE:     "Nothing passed the screener this month.",
  RUN_PASS:     "{n} pass: {tickers}",
  RUN_MORE:     " +{n} more",
  SELL_TITLE:   "Sell signal · {ticker}",
  SELL_BODY:    "Closed below its 10-month SMA on {date}. Exit rule: sma_exit.",
  SELL_PAPER:   " (paper position)",
  FAIL_TITLE:   "Invest screener failed",
  FAIL_BODY:    "The monthly run didn't finish. Open the GitHub run to retry it.",
} as const
