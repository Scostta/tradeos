import { NextRequest, NextResponse } from "next/server"

// ── Yahoo Finance ticker mapping (NinjaTrader symbol → Yahoo Finance) ─────────
// Yahoo uses continuous front-month contracts (=F suffix)
const YAHOO_TICKER: Record<string, string> = {
  NQ:  "NQ=F",    // E-mini NASDAQ-100
  MNQ: "MNQ=F",   // Micro E-mini NASDAQ-100
  ES:  "ES=F",    // E-mini S&P 500
  MES: "MES=F",   // Micro E-mini S&P 500
  RTY: "RTY=F",   // E-mini Russell 2000
  YM:  "YM=F",    // E-mini Dow Jones
  CL:  "CL=F",    // Crude Oil
  GC:  "GC=F",    // Gold
  SI:  "SI=F",    // Silver
  ZB:  "ZB=F",    // 30-Year Treasury Bond
  ZN:  "ZN=F",    // 10-Year Treasury Note
}

export type PolygonBar = {
  time:   number  // Unix seconds UTC
  open:   number
  high:   number
  low:    number
  close:  number
  volume: number
}

export type PolygonBarsResponse =
  | { ok: true;  bars: PolygonBar[]; ticker: string; source: string }
  | { ok: false; error: string }

export async function GET(req: NextRequest): Promise<NextResponse<PolygonBarsResponse>> {
  const { searchParams } = req.nextUrl
  const instrument = searchParams.get("instrument") ?? ""
  const from       = searchParams.get("from")       ?? ""
  const to         = searchParams.get("to")         ?? ""

  if (!instrument || !from || !to) {
    return NextResponse.json({ ok: false, error: "MISSING_PARAMS" })
  }

  const base   = instrument.replace(/\s.*/, "").toUpperCase()
  const ticker = YAHOO_TICKER[base]

  if (!ticker) {
    return NextResponse.json({ ok: false, error: `UNSUPPORTED_INSTRUMENT:${base}` })
  }

  // ±3 h context — generous window to absorb any timezone offset in stored timestamps
  const fromSec = Math.floor(new Date(from).getTime() / 1000) - 3 * 60 * 60
  const toSec   = Math.ceil(new Date(to).getTime()   / 1000) + 3 * 60 * 60

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}` +
    `?interval=1m&period1=${fromSec}&period2=${toSec}&includePrePost=true`

  try {
    const res  = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next:    { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `YAHOO_HTTP:${res.status}` })
    }

    const json = await res.json() as {
      chart?: {
        result?: Array<{
          timestamp?: number[]
          indicators?: {
            quote?: Array<{
              open:   (number | null)[]
              high:   (number | null)[]
              low:    (number | null)[]
              close:  (number | null)[]
              volume: (number | null)[]
            }>
          }
        }>
        error?: { description: string }
      }
    }

    const result = json.chart?.result?.[0]
    if (!result?.timestamp?.length) {
      const desc = json.chart?.error?.description ?? "NO_DATA"
      return NextResponse.json({ ok: false, error: desc })
    }

    const { timestamp } = result
    const quote = result.indicators?.quote?.[0]
    if (!quote) return NextResponse.json({ ok: false, error: "NO_QUOTE" })

    const bars: PolygonBar[] = []
    for (let i = 0; i < timestamp.length; i++) {
      const o = quote.open[i], h = quote.high[i], l = quote.low[i],
            c = quote.close[i], v = quote.volume[i]
      // Skip bars with null values (market closed / gaps)
      if (o == null || h == null || l == null || c == null) continue
      bars.push({ time: timestamp[i]!, open: o, high: h, low: l, close: c, volume: v ?? 0 })
    }

    if (bars.length < 2) {
      return NextResponse.json({ ok: false, error: "INSUFFICIENT_BARS" })
    }

    return NextResponse.json({ ok: true, bars, ticker, source: "Yahoo Finance" })
  } catch (err) {
    console.error("[yahoo/bars]", err)
    return NextResponse.json({ ok: false, error: "FETCH_FAILED" })
  }
}
