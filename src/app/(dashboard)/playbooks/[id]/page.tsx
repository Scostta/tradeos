import type { ReactElement } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPlaybookDetail } from "~/services/queries/playbooks"
import { PLAYBOOKS } from "~/constants/copies/playbooks"
import { APP_URLS } from "~/constants/app-urls"
import { formatCurrency, formatPct, formatDate } from "~/helpers/format"
import { cn } from "~/utils/cn"
import { SignedAreaChart } from "~/components/charts/signed-area-chart.client"
import { RDistribution } from "~/components/charts/r-distribution"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import { PlaybookEditButton } from "./components/playbook-edit-button.client"
import type { AdherenceGroup } from "~/types/playbook"

const fmtR = (r: number): string => `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(2)}R`

export default async function PlaybookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<ReactElement> {
  const { id } = await params
  const result = await getPlaybookDetail(id)
  if (!result.success) notFound()

  const { playbook, metrics, rStats, equityCurve, byInstrument, adherence } = result.data
  const hasTrades = metrics.totalTrades > 0
  const hasR      = rStats.coverage.withR > 0
  const avgWL     = metrics.avgLoss !== 0 ? metrics.avgWin / Math.abs(metrics.avgLoss) : 0
  const rules     = parsePlaybookRules(playbook.rules)
  const hasRules  = rules.all.length > 0

  const cumData = equityCurve.map(p => ({
    label: formatDate(p.date),
    v:     p.equity,
  }))

  const stats: { label: string; value: string; color?: string }[] = [
    { label: PLAYBOOKS.DETAIL.STATS.NET_PNL,       value: hasTrades ? formatCurrency(metrics.netPnl) : "—", color: metrics.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)" },
    { label: PLAYBOOKS.DETAIL.STATS.WIN_RATE,      value: hasTrades ? formatPct(metrics.winRate) : "—" },
    { label: PLAYBOOKS.DETAIL.STATS.PROFIT_FACTOR, value: hasTrades ? metrics.profitFactor.toFixed(2) : "—", color: metrics.profitFactor >= 1 ? "var(--color-profit)" : "var(--color-loss)" },
    { label: PLAYBOOKS.DETAIL.STATS.EXPECTANCY_R,  value: hasR ? fmtR(rStats.expectancy) : "—", color: rStats.expectancy >= 0 ? "var(--color-profit)" : "var(--color-loss)" },
    { label: PLAYBOOKS.DETAIL.STATS.AVG_WL,        value: hasTrades && metrics.avgLoss !== 0 ? avgWL.toFixed(2) : "—" },
    { label: PLAYBOOKS.DETAIL.STATS.TRADES,        value: String(metrics.totalTrades) },
    { label: PLAYBOOKS.DETAIL.STATS.SQN,           value: hasR ? rStats.sqn.toFixed(2) : "—" },
    { label: PLAYBOOKS.DETAIL.STATS.MAX_DD,        value: hasTrades ? formatCurrency(metrics.maxDrawdown) : "—", color: "var(--color-loss)" },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 md:px-7 py-3 border-b border-border bg-bg shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-text truncate">{playbook.name}</h1>
          <span className={cn(
            "text-xs mono tracking-wider rounded-sm px-2 py-0.5 border shrink-0",
            playbook.active ? "text-profit bg-profit/10 border-profit/30" : "text-text-mute bg-surface-2 border-border"
          )}>
            {playbook.active ? PLAYBOOKS.CARD.STATUS_ACTIVE : PLAYBOOKS.CARD.STATUS_ARCHIVED}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <PlaybookEditButton playbook={playbook} />
          <Link
            href={APP_URLS.PLAYBOOKS}
            className="flex items-center gap-1.5 px-3 h-7.5 rounded-sm text-base text-text-dim border border-border hover:border-border-hi transition-colors whitespace-nowrap"
          >
            {PLAYBOOKS.DETAIL.BACK}
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-auto page-pad flex flex-col gap-4">
        {/* Description + rules */}
        <div className="card p-4 flex flex-col gap-3">
          <p className="text-sm text-text-dim">
            {playbook.description ?? <span className="italic text-text-mute">{PLAYBOOKS.CARD.NO_DESCRIPTION}</span>}
          </p>
          <div>
            <div className="label-caps mb-2">{PLAYBOOKS.DETAIL.RULES}</div>
            {!hasRules ? (
              playbook.rules
                ? <p className="text-sm text-text-dim whitespace-pre-wrap">{playbook.rules}</p>
                : <p className="text-sm text-text-mute italic">{PLAYBOOKS.DETAIL.NO_RULES}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(["entry", "exit", "conditions"] as const).map((k) =>
                  rules[k].length ? (
                    <div key={k}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xxs uppercase tracking-wider text-text-mute">{k}</span>
                        <span className="text-xxs text-text-mute">· {PLAYBOOKS.DETAIL.REQUIRE} {rules.min[k]} {PLAYBOOKS.DETAIL.OF} {rules[k].length}</span>
                      </div>
                      <ul className="list-disc list-inside text-sm text-text-dim">
                        {rules[k].map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats + By instrument */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Stats grid */}
          <div className="card p-4 flex-1 min-w-0">
            <div className="grid grid-cols-2 gap-px bg-border rounded-sm border border-border overflow-hidden">
              {stats.map((cell) => (
                <div key={cell.label} className="bg-surface p-3">
                  <div className="label-caps mb-1.5">{cell.label}</div>
                  <div className="mono text-lg font-semibold" style={{ color: cell.color ?? "var(--color-text)" }}>
                    {cell.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* By instrument */}
          <div className="card p-4 flex-1 min-w-0">
            <div className="label-caps mb-3">{PLAYBOOKS.DETAIL.BY_INSTRUMENT}</div>
            {hasTrades ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-mute">
                    <th className="text-left  font-normal label-caps pb-2">{PLAYBOOKS.DETAIL.TABLE.INSTRUMENT}</th>
                    <th className="text-right font-normal label-caps pb-2">{PLAYBOOKS.DETAIL.TABLE.TRADES}</th>
                    <th className="text-right font-normal label-caps pb-2">{PLAYBOOKS.DETAIL.TABLE.WIN_RATE}</th>
                    <th className="text-right font-normal label-caps pb-2">{PLAYBOOKS.DETAIL.TABLE.NET_PNL}</th>
                  </tr>
                </thead>
                <tbody>
                  {byInstrument.map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <td className="py-2 text-text">{row.label}</td>
                      <td className="py-2 text-right mono text-text-dim">{row.trades}</td>
                      <td className="py-2 text-right mono text-text-dim">{formatPct(row.winRate)}</td>
                      <td className="py-2 text-right mono" style={{ color: row.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)" }}>
                        {formatCurrency(row.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-text-mute italic">{PLAYBOOKS.DETAIL.EMPTY}</p>
            )}
          </div>
        </div>

        {/* Setup adherence */}
        {adherence && (
          <div className="card p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="label-caps">{PLAYBOOKS.DETAIL.ADHERENCE}</div>
              <span className="mono text-xs text-text-mute">
                {adherence.tracked}/{metrics.totalTrades} {PLAYBOOKS.DETAIL.TRACKED}
              </span>
            </div>
            {adherence.tracked === 0 ? (
              <p className="text-sm text-text-mute italic">{PLAYBOOKS.DETAIL.ADH_NONE}</p>
            ) : (
              <div className="grid grid-cols-2 gap-px bg-border rounded-sm border border-border overflow-hidden">
                <AdherenceCol label={PLAYBOOKS.DETAIL.FOLLOWED} accent="var(--color-profit)" group={adherence.followed} />
                <AdherenceCol label={PLAYBOOKS.DETAIL.BROKE}    accent="var(--color-loss)"   group={adherence.broke} />
              </div>
            )}
          </div>
        )}

        {/* Equity curve + R distribution */}
        {hasTrades && (
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="card p-4 flex-1 min-w-0">
              <div className="label-caps mb-3">{PLAYBOOKS.DETAIL.EQUITY}</div>
              {cumData.length > 1 ? (
                <SignedAreaChart uid="pb-eq" data={cumData} height={240} fewLabels />
              ) : (
                <div className="h-32 flex items-center justify-center text-xs text-text-mute">—</div>
              )}
            </div>

            <div className="card p-4 flex-1 min-w-0">
              <div className="label-caps mb-3">{PLAYBOOKS.DETAIL.R_DIST}</div>
              {hasR ? (
                <RDistribution distribution={rStats.distribution} />
              ) : (
                <p className="text-sm text-text-mute italic">{PLAYBOOKS.DETAIL.NO_R}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AdherenceCol({ label, accent, group }: {
  label:  string
  accent: string
  group:  AdherenceGroup
}): ReactElement {
  const hasR = group.rCoverage.withR > 0
  const rows = [
    { k: PLAYBOOKS.DETAIL.ADH_STATS.TRADES,       v: String(group.count) },
    { k: PLAYBOOKS.DETAIL.ADH_STATS.WIN_RATE,     v: group.count ? formatPct(group.winRate) : "—" },
    { k: PLAYBOOKS.DETAIL.ADH_STATS.NET_PNL,      v: group.count ? formatCurrency(group.netPnl) : "—" },
    { k: PLAYBOOKS.DETAIL.ADH_STATS.EXPECTANCY_R, v: hasR ? fmtR(group.expectancyR) : "—" },
  ]
  return (
    <div className="bg-surface p-4">
      <div className="text-xs font-semibold mb-3" style={{ color: accent }}>{label}</div>
      <div className="flex flex-col gap-2">
        {rows.map(r => (
          <div key={r.k} className="flex justify-between text-sm">
            <span className="text-text-mute">{r.k}</span>
            <span className="mono text-text">{r.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
