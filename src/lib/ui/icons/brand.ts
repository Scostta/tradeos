// TradeOS brandmark — "Equity curve": a lime equity line climbing across a
// dark tile, ending in a dot (the current balance). Single source of truth for
// the mark's geometry, drawn on a 64×64 grid. Used by <BrandMark>, the apple
// icon and the /icons/[spec] PWA icons. src/app/icon.svg is static and mirrors
// these values by hand — keep it in sync if you change anything here.

export const BRAND_ACCENT = "#a3e635"
export const BRAND_TILE = "#15151c"

export const BRAND_CURVE = "M11 46 L22 36 L30 41 L41 26 L51 18"
export const BRAND_CURVE_WIDTH = 5.5
export const BRAND_DOT = { cx: 51, cy: 18, r: 5 } as const
