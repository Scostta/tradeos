import type { ReactElement } from "react";
import {
  BRAND_ACCENT,
  BRAND_CURVE,
  BRAND_CURVE_WIDTH,
  BRAND_DOT,
  BRAND_TILE,
} from "./brand";

// TradeOS brandmark — "Equity curve". Self-contained (includes its own tile
// and a faint accent border so it separates from the dark UI), so callers only
// add the accent glow shadow.
export function BrandMark({ size = 24 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill={BRAND_TILE} />
      <rect
        x="0.5"
        y="0.5"
        width="63"
        height="63"
        rx="13.5"
        stroke={BRAND_ACCENT}
        strokeOpacity="0.25"
      />
      <path
        d={BRAND_CURVE}
        stroke={BRAND_ACCENT}
        strokeWidth={BRAND_CURVE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle {...BRAND_DOT} fill={BRAND_ACCENT} />
    </svg>
  );
}
