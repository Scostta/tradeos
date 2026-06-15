import type { ReactElement } from "react"
import { notFound } from "next/navigation"
import { getTradeById } from "~/services/queries/trades"
import { getAccounts } from "~/services/queries/accounts"
import { getStrategiesWithStats } from "~/services/queries/strategies"
import { TradeTestShell } from "./components/trade-test-shell.client"

export default async function TradeTestPage({
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

  const account  = accounts.find(a => a.id === trade.accountId)    ?? null
  const strategy = strategies.find(s => s.id === trade.strategyId) ?? null

  return (
    <TradeTestShell
      trade={trade}
      account={account}
      strategy={strategy}
    />
  )
}
