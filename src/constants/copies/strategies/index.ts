export const STRATEGIES = {
  TITLE:            "Strategies",
  SUBTITLE:         "Define setups · tag trades · track edge",
  SUBTITLE_FALLBACK: "Track which setups are working",

  CARD: {
    TRADES_LABEL:   "Trades",
    WIN_RATE_LABEL: "Win rate",
    NET_PNL_LABEL:  "Net P&L",
    NO_DESCRIPTION: "No description",
    STATUS_ACTIVE:  "ACTIVE",
    STATUS_ARCHIVED: "ARCHIVED",
    CREATED_PREFIX: "Created",
  },

  EDITOR: {
    CREATE_TITLE:           "New strategy",
    EDIT_TITLE:             "Edit strategy",
    CAPTION:                "Define a setup so you can tag trades and report on its edge.",
    NAME_LABEL:             "Name",
    NAME_PLACEHOLDER:       "e.g. London Open Fade",
    DESCRIPTION_LABEL:      "Description",
    DESCRIPTION_PLACEHOLDER: "Brief description of the setup",
    ENTRY_CRITERIA:         "Entry criteria",
    EXIT_CRITERIA:          "Exit criteria",
    MARKET_CONDITIONS:      "Market conditions",
    ADD_RULE:               "+ Add rule",
    RULE_PLACEHOLDER:       "Add a rule…",
    SAVE:                   "Save changes",
    CREATE:                 "Create strategy",
    CANCEL:                 "Cancel",
    ARCHIVE:                "Archive strategy",
    ARCHIVE_CONFIRM:        "Click again to archive",
    RESTORE:                "Restore strategy",
  },

  NEW_CARD: {
    TITLE: "New strategy",
    BODY:  "Define rules and tag trades",
  },

  EMPTY: {
    HEADLINE: "No strategies yet",
    BODY:     "Create a strategy to tag your trades and track which setups are working.",
    CTA:      "New strategy",
  },

  TOAST: {
    CREATE_SUCCESS: "Strategy created.",
    SAVE_SUCCESS:   "Strategy updated.",
    ARCHIVED:       "Strategy archived.",
    RESTORED:       "Strategy restored.",
    ERROR:          "Could not save. Please try again.",
  },

  ERROR: {
    LOAD_FAILED: "Could not load strategies.",
    TITLE:       "Something went wrong",
    MESSAGE:     "Failed to load strategies.",
    RETRY:       "Try again",
  },
} as const
