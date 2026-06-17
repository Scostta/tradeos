export const INSIGHTS = {
  TITLE:        "AI Insights",
  PAGE_SUBTITLE: "Patterns Claude found in your trading",
  CARD_TITLE:   "AI Insights",

  GENERATE:     "Generate analysis",
  REFRESH:      "Refresh",
  REGENERATE:   "Regenerate",
  VIEW_ALL:     "View all",
  ANALYZING:    "Analyzing…",

  GENERATED:    "Generated",
  ANALYZED:     "trades analyzed",
  STALE:        "Your data changed since this analysis. Refresh to update.",

  EMPTY: {
    TITLE:   "No analysis yet",
    MESSAGE: "Let Claude review your trades and surface patterns in timing, discipline and risk.",
  },
  INSUFFICIENT: {
    TITLE:   "Not enough trades yet",
    MESSAGE: "Import at least 25 closed trades for a reliable AI analysis.",
  },
  NOT_CONFIGURED: {
    TITLE:   "AI not configured",
    MESSAGE: "Add an ANTHROPIC_API_KEY to enable AI Insights.",
  },

  CATEGORY: {
    timing:     "Timing",
    discipline: "Discipline",
    risk:       "Risk",
    strategy:   "Strategy",
  },

  ERRORS: {
    AI_NOT_CONFIGURED: "AI is not configured — add an ANTHROPIC_API_KEY.",
    INSUFFICIENT_DATA: "Need at least 25 closed trades.",
    DEFAULT:           "Could not generate the analysis. Try again.",
  },

  SUCCESS:     "Analysis ready.",
  CACHED:      "Already up to date.",
} as const
