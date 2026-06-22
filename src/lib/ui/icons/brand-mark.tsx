import type { ReactElement } from "react";

// TradeOS brandmark — "Candlestick T": a lime tile whose T-stem reads as a
// japanese candlestick (wick + body). Self-contained (includes its own
// background), so callers only add the accent glow shadow.
export function BrandMark({ size = 24 }: { size?: number }): ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#a3e635" />
      {/* T crossbar */}
      <rect x="13" y="15" width="38" height="6" rx="3" fill="#0a0a0f" />
      {/* candle wick (T stem) */}
      <rect x="30.25" y="18" width="3.5" height="34" rx="1.75" fill="#0a0a0f" />
      {/* candle body */}
      <rect x="24" y="28" width="16" height="18" rx="3.5" fill="#0a0a0f" />
    </svg>
  );
}
