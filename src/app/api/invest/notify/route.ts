// ── POST /api/invest/notify ───────────────────────────────────────────────────
// Lo llama el job del screener (scripts/screener, GitHub Actions) para mandar
// los avisos push de Invest (INVEST_SPEC §4.10):
//   { event: "run", runDate }      → run nuevo a todos los suscritos, y señal de
//                                    venta al dueño de cada posición abierta
//                                    con check `sell` en ese run
//   { event: "failure", runUrl? }  → el job falló o abortó
// Auth: "Authorization: Bearer <INVEST_NOTIFY_SECRET>". Sin sesión: service
// role. Repetir la llamada repite los avisos (un rerun del job vuelve a avisar).

import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { z } from "zod"
import { envServer } from "~/env/server"
import { pushConfigured, sendPushToUsers, subscribedUserIds } from "~/lib/push/send"
import { createServerClient } from "~/utils/supabase/service"
import { APP_URLS } from "~/constants/app-urls"
import { INVEST_NOTIFY as C } from "~/constants/copies/invest/notify"

const MAX_TICKERS = 5

const bodySchema = z.discriminatedUnion("event", [
  z.object({ event: z.literal("run"), runDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ event: z.literal("failure"), runUrl: z.string().url().optional() }),
])

function authorized(header: string | null): boolean {
  const token = header?.match(/^Bearer\s+(\S+)$/)?.[1]
  if (!token || envServer.INVEST_NOTIFY_SECRET === "") return false
  const a = createHash("sha256").update(token).digest()
  const b = createHash("sha256").update(envServer.INVEST_NOTIFY_SECRET).digest()
  return timingSafeEqual(a, b)
}

const monthLabel = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

const dayLabel = (date: string): string =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!authorized(req.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 })
  }
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "PUSH_NOT_CONFIGURED" }, { status: 503 })

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 })
  const body = parsed.data

  if (body.event === "failure") {
    const result = await sendPushToUsers(await subscribedUserIds(), {
      title: C.FAIL_TITLE,
      body:  C.FAIL_BODY,
      url:   body.runUrl ?? APP_URLS.INVEST,
      tag:   "invest-failure",
    })
    return NextResponse.json({ ok: true, ...result })
  }

  const service = createServerClient()
  const { data: run, error: runError } = await service
    .from("invest_screen_runs")
    .select("id, run_date, passed_count")
    .eq("run_date", body.runDate)
    .maybeSingle()
  if (runError) {
    console.error(runError)
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 })
  }
  if (!run) return NextResponse.json({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 })

  const [passingRes, sellRes] = await Promise.all([
    service.from("invest_screen_results").select("ticker").eq("run_id", run.id).eq("passes", true).order("ticker"),
    service.from("invest_position_checks").select("position_id").eq("run_id", run.id).eq("signal", "sell"),
  ])
  const error = passingRes.error ?? sellRes.error
  if (error) {
    console.error(error)
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 })
  }

  // Run nuevo: a todos los suscritos (el run es compartido).
  const tickers = (passingRes.data ?? []).map(r => r.ticker as string)
  const runBody = tickers.length === 0
    ? C.RUN_NONE
    : C.RUN_PASS.replace("{n}", String(tickers.length)).replace("{tickers}", tickers.slice(0, MAX_TICKERS).join(", "))
      + (tickers.length > MAX_TICKERS ? C.RUN_MORE.replace("{n}", String(tickers.length - MAX_TICKERS)) : "")
  const runResult = await sendPushToUsers(await subscribedUserIds(), {
    title: C.RUN_TITLE.replace("{month}", monthLabel(run.run_date as string)),
    body:  runBody,
    url:   APP_URLS.INVEST,
    tag:   `invest-run-${run.run_date as string}`,
  })

  // Señales de venta: solo al dueño de cada posición, y solo si sigue abierta.
  const sellIds = (sellRes.data ?? []).map(r => r.position_id as string)
  let sells = 0
  if (sellIds.length > 0) {
    const { data: positions, error: posError } = await service
      .from("invest_positions")
      .select("id, user_id, ticker, paper")
      .in("id", sellIds)
      .is("closed_at", null)
    if (posError) console.error(posError)
    for (const p of positions ?? []) {
      const r = await sendPushToUsers([p.user_id as string], {
        title: C.SELL_TITLE.replace("{ticker}", p.ticker as string),
        body:  C.SELL_BODY.replace("{date}", dayLabel(run.run_date as string)) + (p.paper ? C.SELL_PAPER : ""),
        url:   APP_URLS.INVEST_POSITION(p.id as string),
        tag:   `invest-sell-${p.id as string}`,
      })
      sells += r.sent
    }
  }

  return NextResponse.json({ ok: true, run: runResult, sellNotifications: sells })
}
