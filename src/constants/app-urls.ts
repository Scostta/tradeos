export const APP_URLS = {
  HOME:       "/",
  DASHBOARD:  "/dashboard",
  TRADES:     "/trades",
  IMPORT:     "/import",
  REPORTS:    "/reports",
  PLAYBOOKS: "/playbooks",
  JOURNAL:    "/journal",
  ACCOUNTS:   "/accounts",
  GOALS:      "/goals",
  INVEST:             "/invest",
  INVEST_POSITIONS:   "/invest/positions",
  INVEST_PERFORMANCE: "/invest/performance",
  INVEST_TICKER:      (ticker: string) => `/invest/${encodeURIComponent(ticker)}`,
  INVEST_POSITION:    (id: string) => `/invest/positions/${id}`,
  MONEY:              "/money",
  MONEY_TRANSACTIONS: "/money/transactions",
  MONEY_SUBSCRIPTIONS: "/money/subscriptions",
  MONEY_GOALS:        "/money/goals",
  MONEY_IMPORT:       "/money/import",
  MONEY_SETTINGS:     "/money/settings",
  MONEY_CASH:         "/money/cash",
  INSIGHTS:   "/insights",
  SETTINGS:   "/settings",

  // Prefijos de los módulos Invest y Money (getActiveModule en src/helpers/active-module.ts).
  INVEST_PREFIX:   "/invest",
  MONEY_PREFIX:    "/money",

  SHARE_PREFIX:    "/share/",

  // Add-on de NinjaTrader: auth por Bearer token (api_tokens), sin sesión.
  INGEST_PREFIX:   "/api/ingest/",
  ADDON_DOWNLOAD:  "/downloads/TradeOSSync.cs",

  LOGIN:           "/login",
  REGISTER:        "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD:  "/reset-password",
  AUTH_CALLBACK:   "/auth/callback",
  AUTH_ERROR:      "/auth/auth-error",
  AUTH_PREFIX:     "/auth/",
} as const;
