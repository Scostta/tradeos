// Copies del módulo Money (MONEY_SPEC.md). En inglés, como el resto de la app.

export const MONEY = {
  TITLE:    "Money",
  SUBTITLE: "Spending, savings and subscriptions",

  SETUP: {
    TITLE:        "Set up Money",
    BODY:         "Money reads your bank's export: no bank connection, no credentials. Start with the account you import from; a Cash account for cash spending and a default set of categories are created too.",
    ACCOUNT_NAME: "Account name",
    ACCOUNT_HINT: "As you call it, e.g. imagin.",
    ACCOUNT_KIND: "Type",
    IBAN_LAST4:   "Last 4 digits of the IBAN (optional)",
    IBAN_HINT:    "Only for display. Never the full IBAN.",
    SUBMIT:       "Create",
    SUBMITTING:   "Creating…",
  },

  ACCOUNT_KINDS: {
    checking: "Checking",
    savings:  "Savings",
    broker:   "Broker",
    cash:     "Cash",
  },

  ERRORS: {
    INVALID_INPUT:   "Check the form: some fields are not valid.",
    UNAUTHENTICATED: "Your session expired. Sign in again.",
    ALREADY_SET_UP:  "Money is already set up.",
    NO_SETTINGS:     "Set up Money first.",
    ACCOUNT_EXISTS:  "You already have an account with that name.",
    UNKNOWN:         "Something went wrong. Try again.",
  },
} as const
