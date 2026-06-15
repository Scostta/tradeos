import type { ReactElement } from "react"
import { notFound } from "next/navigation"
import { getTradeById } from "~/services/queries/trades"
import { getAccounts } from "~/services/queries/accounts"
import { getStrategiesWithStats } from "~/services/queries/strategies"
import { TradeViewHeader } from "./components/trade-view-header"
import { TradeHeroCard } from "./components/trade-hero-card"
import { TradeExcursionBar } from "./components/trade-excursion-bar"
import { TradeExecutionChart } from "./components/trade-execution-chart.client"
import { TradeSidebar } from "./components/trade-sidebar.client"
import { StopPriceProvider } from "./components/stop-price-context.client"

export default async function TradeViewPage({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReactElement> {
  const { id } = await params

  const [tradeResult, accountsResult, strategiesResult] = await Promise.all([
    getTradeById(id),
    getAccounts(),
    getStrategiesWithStats(),
  ])

  if (!tradeResult.success) notFound()

  const trade      = tradeResult.data
  const accounts   = accountsResult.success   ? accountsResult.data   : []
  const strategies = strategiesResult.success ? strategiesResult.data : []

  const account  = accounts.find(a => a.id === trade.accountId)   ?? null
  const strategy = strategies.find(s => s.id === trade.strategyId) ?? null

  return (
    <div className="flex flex-col h-full">
      <TradeViewHeader trade={trade} />

      <StopPriceProvider initial={trade.stopPrice ?? null}>
        <div className="flex-1 overflow-auto px-4 md:px-7 py-5">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "1fr 360px" }}
          >
            {/* Left — main content */}
            <div className="flex flex-col gap-4 min-w-0">
              <TradeHeroCard trade={trade} account={account} strategy={strategy} />
              <TradeExcursionBar trade={trade} />
              <TradeExecutionChart trade={trade} />
            </div>

            {/* Right — sidebar */}
            <TradeSidebar trade={trade} strategies={strategies} />
          </div>
        </div>
      </StopPriceProvider>
    </div>
  )
}
