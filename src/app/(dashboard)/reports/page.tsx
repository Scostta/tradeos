import type { ReactElement } from "react"
import Link from "next/link"
import { getReportsData } from "~/services/queries/reports"
import { getAccounts } from "~/services/queries/accounts"
import { listReportShares } from "~/services/queries/report-share"
import { REPORTS } from "~/constants/copies/reports"
import { TRADES } from "~/constants/copies/trades"
import { tradesRangeSchema } from "~/types/trade-filters"
import type { TradesRange } from "~/types/trade-filters"
import { AccountSelector } from "~/components/account-selector.client"
import { FilterBar } from "~/components/filter-bar"
import { RangeSelector } from "~/components/range-selector.client"
import { ReportsShell } from "./components/reports-shell.client"
import { ExportReportPdf } from "./components/export-report-pdf.client"
import { ShareReportModal } from "./components/share-report-modal.client"

const RANGE_OPTIONS = [
  { id: "today", label: TRADES.LIST.RANGE.DAY   },
  { id: "week",  label: TRADES.LIST.RANGE.WEEK  },
  { id: "month", label: TRADES.LIST.RANGE.MONTH },
  { id: "ytd",   label: TRADES.LIST.RANGE.YEAR  },
  { id: "all",   label: TRADES.LIST.RANGE.ALL   },
] as const

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string; range?: string }>
}): Promise<ReactElement> {
  const params    = await searchParams
  const accountId = params.account ?? null
  const parsed    = tradesRangeSchema.safeParse(params.range)
  const range: TradesRange = parsed.success ? parsed.data : "all"

  const [result, accountsResult, sharesResult] = await Promise.all([
    getReportsData(accountId, range),
    getAccounts(),
    listReportShares(),
  ])

  const accounts = accountsResult.success ? accountsResult.data : []
  const shares   = sharesResult.success ? sharesResult.data : []

  const accountName = accountId
    ? (accounts.find(a => a.id === accountId)?.name ?? REPORTS.PDF.ALL)
    : REPORTS.PDF.ALL
  const rangeLabel = RANGE_OPTIONS.find(o => o.id === range)?.label ?? TRADES.LIST.RANGE.ALL

  const header = (
    <header className="flex flex-col md:flex-row md:items-center gap-3 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">{REPORTS.TITLE}</h1>
        <div className="mono text-sm text-text-mute mt-0.5">{REPORTS.SUBTITLE}</div>
      </div>
      <div className="md:ml-auto flex items-center gap-2">
        {result.success && result.data.hasTrades && (
          <>
            <ShareReportModal accountId={accountId} range={range} shares={shares} />
            <ExportReportPdf accountName={accountName} rangeLabel={rangeLabel} data={result.data} />
          </>
        )}
        {accounts.length > 0 && (
          <AccountSelector accounts={accounts} value={accountId} />
        )}
      </div>
    </header>
  )

  const filterBar = (
    <FilterBar
      actions={<RangeSelector value={range} options={RANGE_OPTIONS} />}
    />
  )

  if (!result.success) {
    return (
      <div className="flex flex-col h-full">
        {header}
        {filterBar}
        <div className="flex-1 flex items-center justify-center p-7">
          <div className="card p-5 max-w-sm text-center">
            <div className="text-md font-semibold text-text mb-1">{REPORTS.ERROR.TITLE}</div>
            <div className="text-sm text-text-mute">{REPORTS.ERROR.MESSAGE}</div>
          </div>
        </div>
      </div>
    )
  }

  if (!result.data.hasTrades) {
    return (
      <div className="flex flex-col h-full">
        {header}
        {filterBar}
        <div className="flex-1 flex items-center justify-center p-7">
          <div className="card p-8 max-w-sm text-center flex flex-col items-center gap-4">
            <svg
              width="48" height="48"
              viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.3"
              strokeLinecap="round" strokeLinejoin="round"
              className="text-text-mute"
            >
              <path d="M17.5 19a4.5 4.5 0 0 0 0-9h-1.8A7 7 0 1 0 4 15.92" />
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
            </svg>
            <div>
              <div className="text-md font-semibold text-text mb-1">{REPORTS.EMPTY.TITLE}</div>
              <div className="text-sm text-text-mute">{REPORTS.EMPTY.MESSAGE}</div>
            </div>
            <Link
              href="/import"
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{
                background: "var(--color-accent)",
                color:      "#0a0a0f",
              }}
            >
              {REPORTS.EMPTY.CTA}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {header}
      {filterBar}
      <ReportsShell data={result.data} accountId={accountId} />
    </div>
  )
}
