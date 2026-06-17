import { ImageResponse } from "next/og"

export const runtime = "edge"

const ACCENT = "#a3e635"
const INK    = "#0a0a0f"

// Generates the TradeOS brand icon (lime "T" tile) at the requested spec:
//   /icons/192  /icons/512  /icons/maskable  (maskable = full-bleed + safe-zone padding)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spec: string }> },
): Promise<Response> {
  const { spec } = await params
  const maskable = spec === "maskable"
  const size = spec === "192" ? 192 : 512

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ACCENT,
          color: INK,
          fontWeight: 700,
          fontFamily: "sans-serif",
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
          fontSize: maskable ? Math.round(size * 0.42) : Math.round(size * 0.6),
          lineHeight: 1,
        }}
      >
        T
      </div>
    ),
    { width: size, height: size },
  )
}
