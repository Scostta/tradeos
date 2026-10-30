// /trading/settings: ajustes del módulo Trading (add-on de NinjaTrader y umbral de BE).
export const TRADING_SETTINGS = {
  TITLE:    "Settings",
  SUBTITLE: "Trading · NinjaTrader sync and break-even",

  TABS: {
    "ninjatrader": "NinjaTrader sync",
    "break-even":  "Break-even",
  },

  BREAK_EVEN: {
    TITLE:       "Break-even",
    DESCRIPTION: "A trade is break-even when it exits within this many points of its entry. Break-even trades still count in your P&L and commissions, but not as winners or losers (win rate, profit factor, averages, streaks). You can override any trade by hand in Review or on the trade page.",
    THRESHOLD:   "Threshold (points)",
    HINT:        "1.5 pts = 6 ticks on NQ/ES. 0 = only exact-price exits.",
    SAVE:        "Save threshold",
    SAVED:       "Threshold saved. Trades recalculated.",
    INVALID:     "Enter a number between 0 and 100.",
  },

  SYNC: {
    TITLE:          "NinjaTrader sync",
    DESCRIPTION:    "An add-on for NinjaTrader 8 that sends every closed trade to TradeOS as it happens, with its initial stop loss and a compressed screenshot of the chart. Works with any connection NinjaTrader uses (Rithmic, Tradovate, CQG, Sim).",
    STEP_DOWNLOAD:  "Download the add-on and copy it to Documents\\NinjaTrader 8\\bin\\Custom\\AddOns\\",
    STEP_COMPILE:   "In NinjaTrader open New → NinjaScript Editor and press F5 to compile.",
    STEP_TOKEN:     "Generate a token, download tradeos.json and save it to Documents\\NinjaTrader 8\\",
    STEP_CHECK:     "Restart NinjaTrader. The Output window shows \"TradeOS: connected\".",
    DOWNLOAD_ADDON: "Download TradeOSSync.cs",
    TOKEN_NAME:     "Token name",
    TOKEN_NAME_DEFAULT: "NinjaTrader PC",
    GENERATE:       "Generate token",
    NEW_TOKEN_TITLE: "Your new token",
    NEW_TOKEN_HINT: "It is shown only once. Download the config file now — if you lose it, generate a new token.",
    COPY:           "Copy",
    COPIED:         "Token copied.",
    DOWNLOAD_CONFIG: "Download tradeos.json",
    ACTIVE_TOKENS:  "Active tokens",
    NO_TOKENS:      "No tokens yet.",
    LAST_USED:      "Last sync",
    NEVER_USED:     "Never used",
    CREATED:        "Created",
    REVOKE:         "Revoke",
    REVOKED:        "Token revoked. The add-on using it stops syncing.",
    CREATED_TOAST:  "Token created.",
  },

  ERRORS: {
    DEFAULT: "Something went wrong. Try again.",
  },
} as const
