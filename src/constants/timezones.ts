// Curated IANA timezones — covers the major futures sessions (CME = Chicago)
// plus common trader locations. The settings <select> renders these in order.
export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Athens",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const

export type Timezone = (typeof TIMEZONES)[number]

export const CURRENCIES = ["USD", "EUR", "GBP"] as const

export type Currency = (typeof CURRENCIES)[number]
