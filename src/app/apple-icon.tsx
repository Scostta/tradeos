import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

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
          background: "#a3e635",
          color: "#0a0a0f",
          fontWeight: 700,
          fontFamily: "sans-serif",
          fontSize: 110,
          lineHeight: 1,
        }}
      >
        T
      </div>
    ),
    { ...size },
  )
}
