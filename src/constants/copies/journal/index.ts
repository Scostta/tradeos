export const JOURNAL = {
  TITLE:    "Journal",
  SUBTITLE: "Calendar · daily notes · mood · discipline",
  MONTH_NET:  "Month net",
  NO_ACCOUNT: "Select an account in the sidebar to write journal notes.",

  ERROR: {
    LOAD_FAILED: "Failed to load journal data.",
  },

  DRAWER: {
    NET_LABEL:        "NET P&L",
    TRADES_COUNT:     "TRADES",
    WIN_RATE:         "WIN RATE",
    MOOD_LABEL:       "MOOD",
    DISC_LABEL:       "DISCIPLINE",
    DISC_TOGGLE:      "Followed the plan",
    DISC_YES:         "Yes",
    DISC_NO:          "Not today",
    PRE_LABEL:        "PRE-MARKET",
    PRE_PLACEHOLDER:  "Plan, levels, bias, headlines…",
    POST_LABEL:       "POST-MARKET",
    POST_PLACEHOLDER: "What went well? What to adjust tomorrow?",
    TRADES_LABEL:     "TRADES",
    SAVE:             "Save journal",
    DISCARD:          "Discard",
  },

  MOODS: [
    { v: 1, color: "#ef4444", label: "Off" },
    { v: 2, color: "#f59e0b", label: "Tense" },
    { v: 3, color: "#6b7280", label: "Neutral" },
    { v: 4, color: "#84cc16", label: "Focused" },
    { v: 5, color: "#22c55e", label: "Sharp" },
  ],

  TOAST: {
    SAVE_SUCCESS: "Journal entry saved.",
    SAVE_ERROR:   "Failed to save journal entry.",
  },
} as const
