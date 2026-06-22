import type { ReactElement } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPublicShare } from "~/services/queries/report-share"
import { formatCurrency, formatPct, formatDurationMs } from "~/helpers/format"
import { SignedAreaChart } from "~/components/charts/signed-area-chart.client"
import { SHARE } from "~/constants/copies/share"
import { COMMON } from "~/constants/copies/common"
import { APP_URLS } from "~/constants/app-urls"
import { BrandMark } from "~/lib/ui/icons/brand-mark"
import type { ShareBreakdownRow } from "~/types/report-share"

export const metadata: Metadata = {
  title: "Performance Report · TradeOS",
  robots: { index: false },
}

function Kpi({ label, value, tone, big }: { label: string; value: string; tone?: "pos" | "neg"; big?: boolean }): ReactElement {
  const color = tone === "pos" ? "text-profit" : tone === "neg" ? "text-loss" : "text-text"
  return (
    <div className="card p-4 flex flex-col gap-1.5">
      <div className="label-caps">{label}</div>
      <div className={`mono ${big ? "text-3xl" : "text-xl"} font-semibold tracking-tight ${color}`}>{value}</div>
    </div>
  )
}

function BreakdownTable({ title, rows }: { title: string; rows: ShareBreakdownRow[] }): ReactElement {
  return (
    <div className="card p-0 overflow-hidden flex-1 min-w-0">
      <div className="px-4 py-3 border-b border-border label-caps">{title}</div>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-text-mute text-center">{SHARE.EMPTY_BREAKDOWN}</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-text-mute">
              <th className="label-caps px-4 py-2 text-left font-normal">{SHARE.TABLE.CATEGORY}</th>
              <th className="label-caps px-3 py-2 text-right font-normal">{SHARE.TABLE.TRADES}</th>
              <th className="label-caps px-3 py-2 text-right font-normal">{SHARE.TABLE.WIN}</th>
              <th className="label-caps px-4 py-2 text-right font-normal">{SHARE.TABLE.NET}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="px-4 py-2 text-sm text-text">{r.label}</td>
                <td className="px-3 py-2 mono text-sm text-text-dim text-right">{r.trades}</td>
                <td className="px-3 py-2 mono text-sm text-text-dim text-right">{formatPct(r.winRate)}</td>
                <td className="px-4 py-2 mono text-sm font-semibold text-right" style={{ color: r.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
                  {formatCurrency(r.pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<ReactElement> {
  const { token } = await params
  const share = await getPublicShare(token)
  if (!share) notFound()

  const { snapshot } = share
  const k = snapshot.kpis
  const generated = new Date(snapshot.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 flex flex-col gap-5">

        {/* Brand header */}
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md shrink-0" style={{ boxShadow: "0 0 16px var(--accent-glow)" }}>
              <BrandMark size={36} />
            </div>
            <div>
              <div className="font-semibold text-md text-text tracking-tight">{snapshot.accountLabel}</div>
              <div className="mono text-xs text-text-mute">
                {SHARE.REPORT_LABEL} · {snapshot.rangeLabel} · {SHARE.GENERATED} {generated}
              </div>
            </div>
          </div>
          <span className="mono text-xs text-text-mute hidden sm:block">{COMMON.BRAND.NAME}</span>
        </header>

        {/* Hero KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Kpi big label={SHARE.KPI.NET_PNL} value={formatCurrency(k.netPnl)} tone={k.netPnl >= 0 ? "pos" : "neg"} />
          <Kpi big label={SHARE.KPI.WIN_RATE} value={formatPct(k.winRate)} />
          <Kpi big label={SHARE.KPI.PROFIT_FACTOR} value={k.profitFactor.toFixed(2)} />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Kpi label={SHARE.KPI.TRADES} value={String(k.totalTrades)} />
          <Kpi label={SHARE.KPI.TRADING_DAYS} value={String(k.tradingDays)} />
          <Kpi label={SHARE.KPI.AVG_DAILY} value={formatCurrency(k.avgDailyNetPnl)} tone={k.avgDailyNetPnl >= 0 ? "pos" : "neg"} />
          <Kpi label={SHARE.KPI.EXPECTANCY} value={formatCurrency(k.expectancy)} tone={k.expectancy >= 0 ? "pos" : "neg"} />
          <Kpi label={SHARE.KPI.MAX_DD} value={formatCurrency(k.maxDrawdown)} tone={k.maxDrawdown < 0 ? "neg" : undefined} />
          <Kpi label={SHARE.KPI.AVG_HOLD} value={formatDurationMs(k.avgHoldTimeMs)} />
        </div>

        {/* Equity curve */}
        {snapshot.equity.length >= 2 && (
          <div className="card p-4">
            <div className="label-caps mb-3">{SHARE.EQUITY}</div>
            <SignedAreaChart uid={`share-${token}`} data={snapshot.equity.map((v) => ({ label: "", v }))} fewLabels height={260} />
          </div>
        )}

        {/* Breakdowns */}
        <div className="flex flex-col md:flex-row gap-3">
          <BreakdownTable title={SHARE.BY_DAY} rows={snapshot.byDayOfWeek} />
          <BreakdownTable title={SHARE.BY_INSTRUMENT} rows={snapshot.byInstrument} />
        </div>

        {/* Footer / CTA */}
        <footer className="flex items-center justify-between gap-4 pt-4 border-t border-border">
          <span className="mono text-xs text-text-mute">{SHARE.FOOTER}</span>
          <Link href={APP_URLS.REGISTER} className="btn-accent text-sm">{SHARE.CTA}</Link>
        </footer>
      </div>
    </div>
  )
}
