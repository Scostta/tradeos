import { ImageResponse } from "next/og"
import {
  BRAND_ACCENT,
  BRAND_CURVE,
  BRAND_CURVE_WIDTH,
  BRAND_DOT,
  BRAND_TILE,
} from "~/lib/ui/icons/brand"

export const runtime = "edge"

// Generates the TradeOS "Equity curve" brand icon at the requested spec:
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
  const glyph = Math.round(size * (maskable ? 0.6 : 0.82))

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
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 64 64" fill="none">
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
    { width: size, height: size },
  )
}
