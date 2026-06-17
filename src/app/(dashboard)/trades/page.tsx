import type { ReactElement } from "react"
import { TRADES } from "~/constants/copies/trades"
import { getAccounts } from "~/services/queries/accounts"
import { getPlaybooksWithStats } from "~/services/queries/playbooks"
import { getTradesPage } from "~/services/queries/trades"
import { parseTradeFilters } from "~/types/trade-filters"
import { TradesHeader } from "./components/trades-header"
import { TradesFilterBar } from "./components/trades-filter-bar"
import { TradesTable } from "./components/trades-table"
import { TradesPagination } from "./components/trades-pagination.client"

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{
    account?:    string
    instrument?: string
    direction?:  string
    playbook?:   string
    outcome?:    string
    mistake?:    string
    tag?:        string
    pnlMin?:     string
    pnlMax?:     string
    range?:      string
    page?:       string
  }>
}): Promise<ReactElement> {
  const params  = await searchParams
  const filters = parseTradeFilters(params)

  const [tradesResult, accountsResult, playbooksResult] = await Promise.all([
    getTradesPage(filters),
    getAccounts(),
    getPlaybooksWithStats(),
  ])

  const accounts   = accountsResult.success   ? accountsResult.data   : []
  const playbooks = playbooksResult.success ? playbooksResult.data : []

  if (!tradesResult.success) {
    return (
      <div className="flex flex-col h-full">
        <TradesHeader
          totalCount={0}
          totalNet={0}
          accounts={accounts}
          accountId={filters.accountId}
          playbooks={playbooks}
        />
        <TradesFilterBar
          filters={filters}
          instruments={[]}
          tags={[]}
          playbooks={playbooks}
        />
        <div className="flex-1 flex items-center justify-center text-text-mute text-sm">
          {TRADES.LIST.ERROR}
        </div>
      </div>
    )
  }

  const { trades, totalCount, totalNet, page, pageCount, instruments, tags } = tradesResult.data

  return (
    <div className="flex flex-col h-full">
      <TradesHeader
        totalCount={totalCount}
        totalNet={totalNet}
        accounts={accounts}
        accountId={filters.accountId}
        playbooks={playbooks}
      />
      <TradesFilterBar
        filters={filters}
        instruments={instruments}
        tags={tags}
        playbooks={playbooks}
      />
      <div className="flex-1 overflow-auto px-4 md:px-7 py-5">
        <TradesTable
          trades={trades}
          playbooks={playbooks}
        />
      </div>
      <TradesPagination
        page={page}
        pageCount={pageCount}
        totalCount={totalCount}
      />
    </div>
  )
}
