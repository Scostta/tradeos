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
  INVEST:     "/invest",
  INSIGHTS:   "/insights",
  SETTINGS:   "/settings",

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
