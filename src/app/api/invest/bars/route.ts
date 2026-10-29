import { NextRequest, NextResponse } from "next/server"
import { createClient } from "~/utils/supabase/server"

// Velas para /invest/positions/[id] (diarias, §4.3) y /invest/[ticker]
// (mensuales o diarias, §4.7). Mismo patrón que /api/polygon/bars: Yahoo chart
// v8, sesión obligatoria. ?interval=1d (por defecto: 18 meses) | 1mo (36
// meses). Las URLs son estables (range fijo) para que la caché de 24 h sirva a
// todas las peticiones del día; el recorte se hace aquí.
//
// Velas ajustadas (OHLC × adjclose / close): la SMA 10 y el nivel de salida se
// calculan sobre adj_close mensual, como la regla, y así se comparan en la
// misma escala.

const WINDOWS = {
  "1d":  { range: "2y", months: 18 },
  "1mo": { range: "5y", months: 36 },
} as const
type Interval = keyof typeof WINDOWS
const CACHE_SECONDS = 60 * 60 * 24
const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-=^]{0,19}$/

export type InvestBar = {
  time:  string   // YYYY-MM-DD en la hora de la bolsa
  open:  number
  high:  number
  low:   number
  close: number
}

export type InvestBarsResponse =
  | { ok: true; bars: InvestBar[] }
  | { ok: false; error: string }

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: { gmtoffset?: number }
      timestamp?: number[]
      indicators?: {
        quote?: Array<{ open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[] }>
        adjclose?: Array<{ adjclose: (number | null)[] }>
      }
    }>
    error?: { description: string }
  }
}

export async function GET(req: NextRequest): Promise<NextResponse<InvestBarsResponse>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 })
  }

  const ticker = (req.nextUrl.searchParams.get("ticker") ?? "").trim().toUpperCase()
  if (!TICKER_RE.test(ticker)) {
    return NextResponse.json({ ok: false, error: "INVALID_TICKER" }, { status: 400 })
  }

  const param = req.nextUrl.searchParams.get("interval") ?? "1d"
  if (!(param in WINDOWS)) {
    return NextResponse.json({ ok: false, error: "INVALID_INTERVAL" }, { status: 400 })
  }
  const interval = param as Interval
  const { range, months } = WINDOWS[interval]
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}`

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next:    { revalidate: CACHE_SECONDS },
    })
    if (!res.ok) return NextResponse.json({ ok: false, error: `YAHOO_HTTP:${res.status}` })

    const json = await res.json() as YahooChart
    const result = json.chart?.result?.[0]
    const quote = result?.indicators?.quote?.[0]
    const adj = result?.indicators?.adjclose?.[0]?.adjclose
    if (!result?.timestamp?.length || !quote) {
      return NextResponse.json({ ok: false, error: json.chart?.error?.description ?? "NO_DATA" })
    }

    const offset = result.meta?.gmtoffset ?? 0
    const from = new Date()
    from.setUTCMonth(from.getUTCMonth() - months)
    const fromDay = from.toISOString().slice(0, 10)

    const bars: InvestBar[] = []
    result.timestamp.forEach((ts, i) => {
      const o = quote.open[i], h = quote.high[i], l = quote.low[i], c = quote.close[i]
      if (o == null || h == null || l == null || c == null || c === 0) return
      const day = new Date((ts + offset) * 1000).toISOString().slice(0, 10)
      // Mensuales: siempre el día 1 (Yahoo fecha la del mes en curso con el día de hoy).
      const time = interval === "1mo" ? `${day.slice(0, 7)}-01` : day
      if (time < fromDay) return
      const k = adj?.[i] != null ? adj[i]! / c : 1
      const bar = { time, open: o * k, high: h * k, low: l * k, close: c * k }
      const prev = bars.at(-1)
      if (prev?.time === time) {
        // Misma fecha: Yahoo repite el día en curso (diarias) o añade la cotización
        // de hoy al mes en curso (mensuales). Se fusionan: apertura de la primera,
        // extremos de las dos, cierre de la última.
        bars[bars.length - 1] = { time, open: prev.open, high: Math.max(prev.high, bar.high), low: Math.min(prev.low, bar.low), close: bar.close }
      } else {
        bars.push(bar)
      }
    })

    if (bars.length < 2) return NextResponse.json({ ok: false, error: "INSUFFICIENT_BARS" })
    return NextResponse.json({ ok: true, bars })
  } catch (err) {
    console.error("[invest/bars]", err)
    return NextResponse.json({ ok: false, error: "FETCH_FAILED" })
  }
}
