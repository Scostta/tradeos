// Tagged execution mistakes. Shared by the trade sidebar (tagging) and the
// /trades filter bar (filtering). Stored in trades.mistakes (text[]).
export const MISTAKE_PRESETS = [
  "No setup", "Chased entry", "Moved stop", "Oversized",
  "Revenge trade", "FOMO", "Early exit", "Late entry",
] as const

export type MistakePreset = (typeof MISTAKE_PRESETS)[number]
