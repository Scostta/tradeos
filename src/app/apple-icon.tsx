import { ImageResponse } from "next/og"
import {
  BRAND_ACCENT,
  BRAND_CURVE,
  BRAND_CURVE_WIDTH,
  BRAND_DOT,
  BRAND_TILE,
} from "~/lib/ui/icons/brand"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

// TradeOS "Equity curve" mark — full-bleed dark tile (iOS rounds the corners).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_TILE,
        }}
      >
        <svg width="140" height="140" viewBox="0 0 64 64" fill="none">
          <path
            d={BRAND_CURVE}
            stroke={BRAND_ACCENT}
            strokeWidth={BRAND_CURVE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={BRAND_DOT.cx} cy={BRAND_DOT.cy} r={BRAND_DOT.r} fill={BRAND_ACCENT} />
        </svg>
      </div>
    ),
    { ...size },
  )
}
