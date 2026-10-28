"use client"

import { useState, useTransition } from "react"
import type { ReactElement, ReactNode } from "react"
import { setSubscriptionStatus, setSubscriptionUsage } from "~/actions/finance"
import { MONEY } from "~/constants/copies/money"
import {
  candidatesToCancel,
  chargingAgain,
  daysToNext,
  monthlyCost,
  monthsSince,
  yearlyCost,
} from "~/lib/finance/subscriptions"
import { INPUT_CLS } from "~/lib/ui/form"
import { Toast } from "~/lib/ui/toast"
import type { FinanceSubscription } from "~/types/finance"
import { cn } from "~/utils/cn"
import { displayName, fmtDay, fmtEur } from "../../components/money-format"
import { moneyErrorMessage } from "../../components/money-errors"

const S = MONEY.SUBSCRIPTIONS

export type Evidence = { intervalMedian: number; intervalSpread: number; amountSpread: number }

type Tab = "confirmed" | "pending" | "ignored"

const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`

function Metric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }): ReactElement {
  return (
    <div className="card flex flex-col gap-2 px-4 py-3.5 min-w-0">
      <span className="label-caps">{label}</span>
      <span className={cn("mono text-3xl font-semibold tracking-tight leading-none", tone ?? "text-text")}>{value}</span>
      <span className="text-xs text-text-mute mt-auto">{sub}</span>
    </div>
  )
}

function Panel({ title, right, tone, children }: { title: string; right?: ReactNode; tone?: string; children: ReactNode }): ReactElement {
  return (
    <div className="card p-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className={cn("label-caps", tone)}>{title}</span>
        {right}
      </div>
      <div className="px-4 py-3 flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

function NextCharge({ sub, today }: { sub: FinanceSubscription; today: string }): ReactElement {
  const days = daysToNext(sub, today)
  if (days == null || sub.status !== "confirmed" && sub.status !== "pending") return <span className="text-text-mute">—</span>
  if (days < 0) return <span className="text-text-mute">{S.OVERDUE.replace("{date}", fmtDay(sub.nextExpected!))}</span>
  const soon = days <= 3
  return (
    <span className={soon ? "text-short" : "text-text-dim"}>
      {days === 0 ? S.TODAY : days <= 7 ? S.IN_DAYS.replace("{n}", String(days)) : fmtDay(sub.nextExpected!)}
    </span>
  )
}

function Usage({ sub, today }: { sub: FinanceSubscription; today: string }): ReactElement {
  const dot = { used: "bg-profit", unused: "bg-loss", fixed: "bg-text-mute", unknown: "bg-border-hi" }[sub.usage]
  const label = sub.usage === "unused" && sub.unusedSince
    ? S.UNUSED_MONTHS.replace("{n}", String(monthsSince(sub.unusedSince, today)))
    : S.USAGE[sub.usage]
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-text-dim whitespace-nowrap">
      <span className={cn("size-2 rounded-full", dot)} />{label}
    </span>
  )
}

function evidenceText(sub: FinanceSubscription, ev: Evidence | undefined): string {
  const days = ev
    ? ev.intervalSpread > 0 ? S.EVIDENCE_DAYS.replace("{median}", String(ev.intervalMedian)).replace("{spread}", String(ev.intervalSpread)) : String(ev.intervalMedian)
    : "—"
  const amount = !ev || ev.amountSpread < 0.005 ? S.SAME_AMOUNT : S.AMOUNT_VARIES.replace("{pct}", pct(ev.amountSpread))
  return S.EVIDENCE.replace("{n}", String(sub.occurrences)).replace("{days}", days).replace("{amount}", amount).replace("{date}", fmtDay(sub.lastSeen))
}

// §5.3 (artboard 03): pestañas, tabla, panel "To confirm", candidatas a
// cancelar y aviso de canceladas que vuelven a cobrar.
export function SubscriptionsView({ subscriptions, evidence, avgMonthlySpent, today }: {
  subscriptions:   FinanceSubscription[]
  evidence:        Record<string, Evidence>
  avgMonthlySpent: number | null
  today:           string
}): ReactElement {
  const confirmed = subscriptions.filter(s => s.status === "confirmed")
  const pending = subscriptions.filter(s => s.status === "pending")
  const inactive = subscriptions.filter(s => s.status === "ignored" || s.status === "cancelled")
  const [tab, setTab] = useState<Tab>(confirmed.length ? "confirmed" : "pending")
  const [editing, setEditing] = useState<FinanceSubscription | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, startTransition] = useTransition()

  const monthly = confirmed.reduce((a, s) => a + monthlyCost(s), 0)
  const cancel = candidatesToCancel(subscriptions, today)
  const unusedYearly = cancel.reduce((a, s) => a + yearlyCost(s), 0)
  const again = chargingAgain(subscriptions)
  const rows = { confirmed, pending, ignored: inactive }[tab]

  function run(action: () => Promise<{ success: boolean; error?: unknown }>) {
    startTransition(async () => {
      const res = await action()
      if (!res.success) {
        setError(moneyErrorMessage(res.error as Parameters<typeof moneyErrorMessage>[0]))
        setTimeout(() => setError(null), 4000)
      }
    })
  }
  const setStatus = (s: FinanceSubscription, status: FinanceSubscription["status"]) =>
    run(() => setSubscriptionStatus({ subscriptionId: s.id, status }))
  const setUsage = (s: FinanceSubscription, usage: FinanceSubscription["usage"]) =>
    run(() => setSubscriptionUsage({ subscriptionId: s.id, usage }))

  const tabs: { id: Tab; label: string }[] = [
    { id: "confirmed", label: S.TAB_CONFIRMED.replace("{n}", String(confirmed.length)) },
    { id: "pending", label: S.TAB_PENDING.replace("{n}", String(pending.length)) },
    { id: "ignored", label: S.TAB_IGNORED.replace("{n}", String(inactive.length)) },
  ]
  // El modal lee la versión actual (tras guardar, la página se revalida).
  const editingNow = editing ? subscriptions.find(s => s.id === editing.id) ?? null : null

  return (
    <>
      {error && <div className="fixed top-4 right-4 z-50"><Toast variant="error" message={error} /></div>}

      <div className="flex flex-wrap items-center gap-2 px-4 md:px-7 py-2.5 border-b border-border bg-bg shrink-0">
        <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
          {tabs.map((t, i) => (
            <button
              key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-1.5 text-sm whitespace-nowrap cursor-pointer border-t",
                i > 0 && "border-l border-l-border",
                tab === t.id ? "bg-surface-2 text-text border-t-accent" : "text-text-mute border-t-transparent hover:text-text-dim",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto page-pad">
        <div className="flex flex-col gap-3">
          {again.map(s => (
            <div key={s.id} className="card px-4 py-3 border-loss/40 bg-loss/5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="label-caps text-loss">{S.AGAIN_TITLE}</span>
              <span className="text-sm text-text">
                {S.AGAIN_BODY.replace("{name}", displayName(s.counterparty)).replace("{amount}", fmtEur(s.amount)).replace("{date}", fmtDay(s.lastSeen))}
              </span>
            </div>
          ))}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Metric label={S.METRIC_ACTIVE} value={String(confirmed.length)} sub={S.METRIC_ACTIVE_SUB.replace("{n}", String(pending.length))} />
            <Metric label={S.METRIC_MONTHLY} value={fmtEur(monthly)} sub={S.METRIC_MONTHLY_SUB} />
            <Metric
              label={S.METRIC_YEARLY} value={fmtEur(monthly * 12, { decimals: 0 })}
              sub={avgMonthlySpent ? S.METRIC_YEARLY_SUB.replace("{pct}", pct(monthly / avgMonthlySpent, 1)) : S.METRIC_YEARLY_NONE}
            />
            <Metric
              label={S.METRIC_UNUSED} value={fmtEur(unusedYearly, { decimals: 0 })} tone={unusedYearly > 0 ? "text-loss" : undefined}
              sub={S.METRIC_UNUSED_SUB.replace("{n}", String(cancel.length))}
            />
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <div className="card p-0 overflow-x-auto min-w-0" style={{ flex: "999 1 520px" }}>
              {rows.length === 0 ? (
                <div className="px-4 py-14 text-center text-sm text-text-mute">
                  {{ confirmed: S.EMPTY_CONFIRMED, pending: S.EMPTY_PENDING, ignored: S.EMPTY_IGNORED }[tab]}
                </div>
              ) : (
                <table className="w-full border-collapse" style={{ minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th className="label-caps px-3 py-2.5 border-b border-border text-left">{S.HEAD_SERVICE}</th>
                      <th className="label-caps px-3 py-2.5 border-b border-border text-left">{S.HEAD_CADENCE}</th>
                      <th className="label-caps px-3 py-2.5 border-b border-border text-right">{S.HEAD_AMOUNT}</th>
                      <th className="label-caps px-3 py-2.5 border-b border-border text-left">{tab === "ignored" ? S.STATUS_LABEL : S.HEAD_NEXT}</th>
                      <th className="label-caps px-3 py-2.5 border-b border-border text-left">{S.HEAD_USAGE}</th>
                      <th className="border-b border-border" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(s => (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                        <td className="px-3 py-2.5">
                          <div className="text-sm font-medium text-text">{displayName(s.counterparty)}</div>
                          <div className="mono text-xs text-text-mute">{S.CHARGES.replace("{n}", String(s.occurrences))}</div>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-text-dim">{S.CADENCES[s.cadence]}</td>
                        <td className="px-3 py-2.5 mono text-sm text-right text-text whitespace-nowrap">{fmtEur(s.amount)}</td>
                        <td className="px-3 py-2.5 mono text-sm whitespace-nowrap">
                          {tab === "ignored" ? <span className="text-text-mute">{S.STATUS[s.status]}</span> : <NextCharge sub={s} today={today} />}
                        </td>
                        <td className="px-3 py-2.5"><Usage sub={s} today={today} /></td>
                        <td className="px-3 py-2.5 text-right">
                          <button type="button" onClick={() => setEditing(s)} className="btn-ghost px-2.5 py-1 text-xs">{S.EDIT}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-col gap-3 min-w-0" style={{ flex: "1 1 280px", maxWidth: 360 }}>
              {pending.length > 0 && (
                <Panel
                  title={S.PENDING_TITLE}
                  right={<span className="mono text-xs font-semibold uppercase px-1.5 py-0.5 rounded-sm bg-short/10 text-short">{S.PENDING_NEW.replace("{n}", String(pending.length))}</span>}
                >
                  {pending.map(s => (
                    <div key={s.id} className="rounded-md border border-border bg-surface-2 px-3 py-2.5 flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-text truncate">{displayName(s.counterparty)}</span>
                        <span className="mono text-sm text-text shrink-0">{fmtEur(s.amount)}</span>
                      </div>
                      <div className="text-xs text-text-mute">{evidenceText(s, evidence[`${s.counterparty}|${s.cadence}`])}</div>
                      <div className="flex gap-1.5">
                        <button type="button" disabled={pendingAction} onClick={() => setStatus(s, "confirmed")} className="btn-accent flex-1 justify-center py-1.5 disabled:opacity-60">{S.CONFIRM}</button>
                        <button type="button" disabled={pendingAction} onClick={() => setStatus(s, "ignored")} className="btn-ghost flex-1 justify-center py-1.5 disabled:opacity-60">{S.NOT_A_SUB}</button>
                      </div>
                    </div>
                  ))}
                </Panel>
              )}

              <Panel title={S.CANCEL_TITLE} tone="text-loss">
                {cancel.length === 0 ? (
                  <span className="text-xs text-text-mute">{S.CANCEL_NONE}</span>
                ) : (
                  <>
                    <span className="text-xs text-text-mute">{S.CANCEL_HINT}</span>
                    {cancel.map(s => (
                      <div key={s.id} className="flex justify-between text-sm">
                        <span className="text-text">{displayName(s.counterparty)}</span>
                        <span className="mono text-text-dim">{S.PER_YEAR.replace("{amount}", fmtEur(yearlyCost(s), { decimals: 0 }))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold border-t border-border pt-2">
                      <span>{S.IF_CANCELLED}</span>
                      <span className="mono text-profit">+{S.PER_YEAR.replace("{amount}", fmtEur(unusedYearly, { decimals: 0 }))}</span>
                    </div>
                  </>
                )}
              </Panel>

              <Panel title={S.RULE_TITLE}>
                <p className="text-xs text-text-mute">{S.RULE_BODY}</p>
              </Panel>
            </div>
          </div>
        </div>
      </div>

      {editingNow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditing(null)}>
          <div className="card p-5 flex flex-col gap-4 w-full" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div>
              <div className="text-lg font-semibold text-text">{S.EDIT_TITLE}</div>
              <div className="text-sm text-text-mute mt-0.5">
                {displayName(editingNow.counterparty)} · <span className="mono">{fmtEur(editingNow.amount)}</span> · {S.CADENCES[editingNow.cadence]}
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="label-caps">{S.USAGE_LABEL}</span>
              <select
                value={editingNow.usage} disabled={pendingAction}
                onChange={e => setUsage(editingNow, e.target.value as FinanceSubscription["usage"])}
                className={INPUT_CLS}
              >
                {(["unknown", "used", "unused", "fixed"] as const).map(u => <option key={u} value={u}>{S.USAGE[u]}</option>)}
              </select>
              <span className="text-xs text-text-mute">{S.USAGE_HINT}</span>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label-caps">{S.STATUS_LABEL}</span>
              <select
                value={editingNow.status} disabled={pendingAction}
                onChange={e => setStatus(editingNow, e.target.value as FinanceSubscription["status"])}
                className={INPUT_CLS}
              >
                {(["confirmed", "pending", "cancelled", "ignored"] as const).map(st => <option key={st} value={st}>{S.STATUS[st]}</option>)}
              </select>
            </label>
            <div className="flex justify-end">
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost">{S.CLOSE}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
