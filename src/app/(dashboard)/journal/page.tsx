import type { ReactElement } from "react"
import { JOURNAL } from "~/constants/copies/journal"
import { getJournalData } from "~/services/queries/journal"
import { getAccounts } from "~/services/queries/accounts"
import { JournalCalendar } from "./components/journal-calendar.client"

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; account?: string }>
}): Promise<ReactElement> {
  const params    = await searchParams
  const now       = new Date()
  const year      = params.year  ? parseInt(params.year,  10) : now.getFullYear()
  const month     = params.month ? parseInt(params.month, 10) : now.getMonth() + 1
  const accountId = params.account ?? null

  const [result, accountsResult] = await Promise.all([
    getJournalData(year, month, accountId),
    getAccounts(),
  ])
  const accounts = accountsResult.success ? accountsResult.data : []

  if (!result.success) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex items-center gap-4 px-7 py-3 border-b border-border bg-bg shrink-0">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text">{JOURNAL.TITLE}</h1>
            <div className="mono text-sm text-text-mute mt-0.5">{JOURNAL.SUBTITLE}</div>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="card p-5 text-sm text-loss">{JOURNAL.ERROR.LOAD_FAILED}</div>
        </div>
      </div>
    )
  }

  const { weeks, monthNet } = result.data

  return (
    <div className="flex flex-col h-full">
      <JournalCalendar
        weeks={weeks}
        monthNet={monthNet}
        year={year}
        month={month}
        accountId={accountId}
        accounts={accounts}
      />
    </div>
  )
}
