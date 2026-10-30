"use client"

import { useState, useTransition } from "react"
import type { ReactElement } from "react"
import { useRouter } from "next/navigation"
import { upsertJournalEntry } from "~/actions/journal"
import { APP_URLS } from "~/constants/app-urls"
import { REVIEW } from "~/constants/copies/review"
import { Spinner } from "~/lib/ui/spinner"
import { MoodPicker } from "~/components/journal/mood-picker.client"
import { Toast } from "~/lib/ui/toast"
import type { ToastVariant } from "~/lib/ui/toast"
import type { JournalEntry } from "~/types/journal"
import { cn } from "~/utils/cn"

// Cierre del día del repaso: ánimo, si se siguió el plan y notas post-mercado,
// en la entrada del Journal de ese día (conserva las notas pre-mercado). Si el
// día ya no tiene trades pendientes, guardar pasa al siguiente día pendiente.
export function DayClose({ date, entry, dayDone }: { date: string; entry: JournalEntry | null; dayDone: boolean }): ReactElement {
  const router = useRouter()
  const [mood, setMood] = useState<number | null>(entry?.mood ?? null)
  const [followedPlan, setFollowedPlan] = useState<boolean | null>(entry?.followedPlan ?? null)
  const [notes, setNotes] = useState(entry?.postMarketNotes ?? "")
  const [toast, setToast] = useState<{ message: string; variant: ToastVariant } | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const res = await upsertJournalEntry({
        date, preMarketNotes: entry?.preMarketNotes ?? null, postMarketNotes: notes.trim() || null, mood, followedPlan,
      })
      if (res.success && dayDone) { router.push(APP_URLS.REVIEW); return }
      setToast(res.success ? { message: REVIEW.DAY_SAVED, variant: "success" } : { message: REVIEW.ERROR, variant: "error" })
      setTimeout(() => setToast(null), 2500)
    })
  }

  return (
    <div className="card p-0">
      {toast && <div className="fixed top-4 right-4 z-50"><Toast variant={toast.variant} message={toast.message} /></div>}
      <div className="px-4 py-3 border-b border-border"><span className="label-caps">{REVIEW.DAY_CLOSE}</span></div>
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 px-4 py-4">
        <div className="flex flex-col gap-1.5 w-full sm:w-90">
          <span className="label-caps">{REVIEW.MOOD}</span>
          <MoodPicker value={mood} onChange={setMood} className="w-full" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label-caps">{REVIEW.FOLLOWED_PLAN}</span>
          <div className="flex gap-1">
            {([true, false] as const).map(v => (
              <button
                key={String(v)} type="button" onClick={() => setFollowedPlan(followedPlan === v ? null : v)} aria-pressed={followedPlan === v}
                className={cn(
                  "px-3 h-9 rounded-sm border text-sm cursor-pointer",
                  followedPlan === v ? (v ? "border-profit/50 bg-profit/10 text-profit" : "border-loss/50 bg-loss/10 text-loss") : "border-border text-text-dim hover:border-border-hi",
                )}
              >
                {v ? REVIEW.YES : REVIEW.NO}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5 flex-1 min-w-64">
          <span className="label-caps">{REVIEW.POST_NOTES}</span>
          <textarea
            value={notes} rows={3} onChange={e => setNotes(e.target.value)} placeholder={REVIEW.POST_PLACEHOLDER}
            className="bg-surface-2 border border-border rounded-sm px-2.5 py-2 text-base text-text w-full outline-none focus:border-border-hi resize-y"
          />
        </label>
        <button type="button" onClick={save} disabled={pending} className="btn-accent self-end inline-flex items-center gap-2 disabled:opacity-60">
          {pending && <Spinner />}{REVIEW.SAVE_DAY}
        </button>
      </div>
    </div>
  )
}
