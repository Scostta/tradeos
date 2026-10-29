import type { ReactElement } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { APP_URLS } from "~/constants/app-urls"
import { REVIEW } from "~/constants/copies/review"
import { getAccounts } from "~/services/queries/accounts"
import { getPlaybooksWithStats } from "~/services/queries/playbooks"
import { getReviewData } from "~/services/queries/review"
import { cn } from "~/utils/cn"
import { ReviewView } from "./components/review-view.client"
import { DayClose } from "./components/day-close.client"

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
}

// Repaso de sesión: los días con trades sin revisar (?date=) y, para el día,
// los trades uno a uno y el cierre del día en el Journal.
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ date?: string }> }): Promise<ReactElement> {
  const params = await searchParams
  const [reviewRes, accountsRes, playbooksRes] = await Promise.all([getReviewData(params.date ?? null), getAccounts(), getPlaybooksWithStats()])
  const data = reviewRes.success ? reviewRes.data : null
  // El día queda fijado en la URL: al guardar trades no salta al siguiente
  // pendiente hasta que se cierra el día (DayClose vuelve a /review).
  if (!params.date && data?.date) redirect(`${APP_URLS.REVIEW}?date=${data.date}`)
  const dayPending = data?.days.find(d => d.date === data.date)?.pending ?? 0

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{REVIEW.TITLE}</h1>
          <div className="mono text-sm text-text-mute mt-0.5">
            {data && data.pending > 0 ? REVIEW.SUBTITLE.replace("{n}", String(data.pending)) : REVIEW.SUBTITLE_DONE}
          </div>
        </div>
      </header>

      {data && data.days.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
          {data.days.map(d => (
            <Link
              key={d.date} href={`${APP_URLS.REVIEW}?date=${d.date}`}
              className={cn(
                "btn-ghost px-2.5 py-1 text-xs mono",
                d.date === data.date && "bg-surface-2 text-text border-border-hi",
                d.pending === 0 && "text-text-mute",
              )}
            >
              {(d.pending > 0 ? REVIEW.DAY_CHIP : REVIEW.DAY_DONE).replace("{date}", dayLabel(d.date)).replace("{n}", String(d.pending))}
            </Link>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto page-pad flex flex-col gap-3">
        {!data ? (
          <div className="card p-4 text-sm text-loss">{REVIEW.ERROR}</div>
        ) : !data.date || data.trades.length === 0 ? (
          <div className="card px-4 py-16 text-center text-sm text-text-mute">{data.hasTrades ? REVIEW.ALL_DONE : REVIEW.NO_TRADES}</div>
        ) : (
          <>
            <ReviewView
              key={data.date}
              trades={data.trades}
              playbooks={playbooksRes.success ? playbooksRes.data : []}
              accounts={accountsRes.success ? accountsRes.data : []}
            />
            <DayClose key={`close-${data.date}`} date={data.date} entry={data.journal} dayDone={dayPending === 0} />
          </>
        )}
      </div>
    </div>
  )
}
