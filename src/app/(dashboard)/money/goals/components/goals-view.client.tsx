"use client"

import { useState } from "react"
import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import { allocateSavings, goalEta, requiredMonthly } from "~/lib/finance/allocate-savings"
import type { MonthKey } from "~/lib/finance/dates"
import type { FinanceGoal } from "~/types/finance"
import { cn } from "~/utils/cn"
import { fmtEur, fmtMonth } from "../../components/money-format"
import { Card, Metric } from "../../components/overview/overview-parts"
import { GoalCard } from "./goal-card"
import { GoalEditModal } from "./goal-edit-modal.client"
import { goalStyle } from "./goal-style"
import { NewGoalCard } from "./new-goal-card.client"

const G = MONEY.GOALS

// §5.4 (artboard 05). Todo se calcula sobre el ahorro real de este mes: es el
// que se repartirá cuando cierre.
export function GoalsView({ goals, thisMonth, avg6, openMonth, closedThrough }: {
  goals:         FinanceGoal[]          // activos y completados, por prioridad
  thisMonth:     number                 // ahorro real del mes en curso
  avg6:          number | null
  openMonth:     MonthKey               // primer mes que aún aportará
  closedThrough: MonthKey | null
}): ReactElement {
  const [editing, setEditing] = useState<FinanceGoal | null>(null)

  const active = goals.filter(g => g.status === "active")
  const completed = goals.filter(g => g.status === "completed")
  const { allocations, unallocated } = allocateSavings(active, thisMonth)
  const allocated = allocations.reduce((a, x) => a + x.allocated, 0)
  const wanted = allocations.reduce((a, x) => a + x.wanted, 0)
  const short = Math.max(0, wanted - allocated)
  const cut = allocations.find(a => a.allocated < a.wanted)

  const listed = [...active, ...completed]
  const savedTotal = listed.reduce((a, g) => a + g.savedAmount, 0)
  const targetTotal = listed.reduce((a, g) => a + g.targetAmount, 0)

  const etas = new Map(active.map(g => [g.id, goalEta(g, openMonth)]))
  const next = active
    .map(g => ({ g, month: etas.get(g.id)!.month }))
    .filter((x): x is { g: FinanceGoal; month: MonthKey } => x.month != null)
    .sort((a, b) => a.month.localeCompare(b.month) || a.g.priority - b.g.priority)[0]

  const rank = new Map(active.map((g, i) => [g.id, i]))
  const byId = new Map(active.map(g => [g.id, g]))
  const barTotal = Math.max(allocated + unallocated, wanted, 1)

  return (
    <div className="flex-1 min-h-0 overflow-auto page-pad">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric label={G.CAPACITY} value={fmtEur(thisMonth, { decimals: 0 })} tone={thisMonth < 0 ? "text-loss" : undefined}>
            <span>{avg6 == null ? G.CAPACITY_NO_AVG : G.CAPACITY_SUB.replace("{avg}", fmtEur(avg6, { decimals: 0 }))}</span>
          </Metric>
          <Metric label={G.ALLOCATED} value={fmtEur(allocated, { decimals: 0 })}>
            <span className={cn(short > 0 && "text-short")}>
              {(short > 0 ? G.ALLOCATED_SHORT.replace("{short}", fmtEur(short, { decimals: 0 })) : G.ALLOCATED_SUB.replace("{free}", fmtEur(unallocated, { decimals: 0 })))
                .replace("{n}", String(active.length))}
            </span>
          </Metric>
          <Metric label={G.SAVED} value={fmtEur(savedTotal, { decimals: 0 })}>
            <span>{G.SAVED_SUB.replace("{pct}", targetTotal > 0 ? `${Math.round((savedTotal / targetTotal) * 100)}%` : "—")}</span>
          </Metric>
          <Metric label={G.NEXT} value={next ? fmtMonth(next.month) : "—"}>
            <span>{next ? G.NEXT_SUB.replace("{name}", next.g.name).replace("{amount}", fmtEur(next.g.monthlyAlloc, { decimals: 0 })) : G.NEXT_NONE}</span>
          </Metric>
        </div>

        {active.length > 0 && (
          <Card title={G.ALLOCATION} right={<span className="text-xs text-text-mute">{G.ALLOCATION_NOTE}</span>}>
            <div className="flex flex-col gap-3 px-4 py-3.5">
              <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden bg-surface-2">
                {allocations.filter(a => a.allocated > 0).map(a => (
                  <div key={a.goalId} style={{ flex: a.allocated / barTotal, background: goalStyle(rank.get(a.goalId)!).color }} />
                ))}
                {unallocated > 0 && <div style={{ flex: unallocated / barTotal, background: "var(--color-border-hi)" }} />}
                {short > 0 && <div style={{ flex: short / barTotal }} />}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                {allocations.map(a => (
                  <span key={a.goalId} className="flex items-center gap-2">
                    <span className="size-2 rounded-full shrink-0" style={{ background: goalStyle(rank.get(a.goalId)!).color }} />
                    <span className="text-text-dim">{byId.get(a.goalId)!.name}</span>
                    <span className={cn("mono", a.allocated < a.wanted ? "text-short" : "text-text")}>{fmtEur(a.allocated, { decimals: 0 })}</span>
                  </span>
                ))}
                {unallocated > 0 && (
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full shrink-0 bg-border-hi" />
                    <span className="text-text-dim">{G.UNALLOCATED}</span>
                    <span className="mono text-text">{fmtEur(unallocated, { decimals: 0 })}</span>
                  </span>
                )}
              </div>
              {cut && (
                <p className="text-sm text-short">
                  {G.CUT.replace("{name}", byId.get(cut.goalId)!.name)
                    .replace("{got}", fmtEur(cut.allocated, { decimals: 0 })).replace("{wanted}", fmtEur(cut.wanted, { decimals: 0 }))}
                </p>
              )}
              <p className="text-xs text-text-mute">
                {closedThrough ? G.CLOSED_THROUGH.replace("{month}", fmtMonth(closedThrough)) : G.NOT_CLOSED}
              </p>
            </div>
          </Card>
        )}

        {listed.length === 0 && <div className="card px-4 py-6 text-sm text-text-mute">{G.EMPTY}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
          {listed.map(g => (
            <GoalCard
              key={g.id}
              goal={g}
              style={goalStyle(rank.get(g.id) ?? 99)}
              eta={etas.get(g.id) ?? null}
              needs={g.status === "active" ? requiredMonthly(g, openMonth) : null}
              onEdit={() => setEditing(g)}
            />
          ))}
          <NewGoalCard free={unallocated} openMonth={openMonth} />
        </div>

        <div className="card p-4 flex flex-col gap-1.5">
          <span className="label-caps">{G.REAL_TITLE}</span>
          <p className="text-sm text-text-dim">{G.REAL_BODY}</p>
        </div>
      </div>

      {editing && <GoalEditModal key={editing.id} goal={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
