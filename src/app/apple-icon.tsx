import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

// TradeOS "Candlestick T" mark — full-bleed lime tile (iOS rounds the corners).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#a3e635",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 64 64" fill="none">
          <rect x="13" y="15" width="38" height="6" rx="3" fill="#0a0a0f" />
          <rect x="30.25" y="18" width="3.5" height="34" rx="1.75" fill="#0a0a0f" />
          <rect x="24" y="28" width="16" height="18" rx="3.5" fill="#0a0a0f" />
        </svg>
      </div>
    ),
    { ...size },
  )
}
