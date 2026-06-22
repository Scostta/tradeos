import { ImageResponse } from "next/og"

export const runtime = "edge"

const ACCENT = "#a3e635"
const INK    = "#0a0a0f"

// Generates the TradeOS "Candlestick T" brand icon at the requested spec:
//   /icons/192  /icons/512  /icons/maskable  (maskable = full-bleed + safe-zone padding)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ spec: string }> },
): Promise<Response> {
  const { spec } = await params
  const maskable = spec === "maskable"
  const size = spec === "192" ? 192 : 512

  // Maskable icons must keep their content inside the safe zone (~60% of the
  // canvas) since launchers crop the edges; "any" icons get a rounded tile.
  const glyph = Math.round(size * (maskable ? 0.6 : 0.78))

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
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 64 64" fill="none">
          <rect x="13" y="15" width="38" height="6" rx="3" fill={INK} />
          <rect x="30.25" y="18" width="3.5" height="34" rx="1.75" fill={INK} />
          <rect x="24" y="28" width="16" height="18" rx="3.5" fill={INK} />
        </svg>
      </div>
    ),
    { width: size, height: size },
  )
}
