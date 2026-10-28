import type { ReactElement } from "react"
import { MONEY } from "~/constants/copies/money"
import type { GoalEta } from "~/lib/finance/allocate-savings"
import type { FinanceGoal } from "~/types/finance"
import { cn } from "~/utils/cn"
import { fmtEur, fmtMonth } from "../../components/money-format"
import { Bar } from "../../components/overview/overview-parts"

const G = MONEY.GOALS

function Stat({ label, children, tone }: { label: string; children: string; tone?: string }): ReactElement {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="label-caps">{label}</span>
      <span className={cn("mono text-md font-semibold truncate", tone ?? "text-text")}>{children}</span>
    </div>
  )
}

// Tarjeta de un objetivo (artboard 05): prioridad, ahorrado/meta con barra,
// aportación, falta y fecha estimada ("tight" si la fecha límite llega antes).
export function GoalCard({ goal, style, eta, needs, onEdit }: {
  goal:   FinanceGoal
  style:  { color: string; badge: string }
  eta:    GoalEta | null          // null en completados
  needs:  number | null           // aportación necesaria para la fecha límite
  onEdit: () => void
}): ReactElement {
  const done = goal.status === "completed"
  const progress = goal.savedAmount / goal.targetAmount
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)

  let line: string | null = null
  if (done) line = G.COMPLETED_LINE.replace("{target}", fmtEur(goal.targetAmount, { decimals: 0 }))
  else if (goal.monthlyAlloc <= 0) line = G.NO_MONTHLY_LINE
  else if (goal.deadline) {
    line = `${G.DEADLINE_LINE.replace("{date}", fmtMonth(goal.deadline.slice(0, 7)))} ${
      eta?.tight && needs != null ? G.NEEDS_LINE.replace("{amount}", fmtEur(needs, { decimals: 0 })) : G.ON_TRACK_LINE
    }`
  }

  return (
    <div className={cn("card p-4 flex flex-col gap-3.5 min-w-0", done && "opacity-70")}>
      <div className="flex items-center gap-2">
        <span className={cn("mono text-xs font-semibold px-1.5 py-0.5 rounded-sm", done ? "bg-profit/10 text-profit" : style.badge)}>
          {done ? G.COMPLETED : `P${goal.priority}`}
        </span>
        <span className="text-md font-semibold text-text truncate flex-1">{goal.name}</span>
        <button type="button" onClick={onEdit} className="text-xs text-text-mute hover:text-text">{G.EDIT}</button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="mono text-3xl font-semibold tracking-tight leading-none text-text">{fmtEur(goal.savedAmount, { decimals: 0 })}</span>
          <span className="text-sm text-text-mute">
            {G.OF_TARGET.replace("{target}", fmtEur(goal.targetAmount, { decimals: 0 })).replace("{pct}", `${Math.round(progress * 100)}%`)}
          </span>
        </div>
        <Bar value={progress} color={done ? "var(--color-profit)" : style.color} />
      </div>

      {!done && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label={G.MONTHLY}>{fmtEur(goal.monthlyAlloc, { decimals: 0 })}</Stat>
          <Stat label={G.REMAINING}>{fmtEur(remaining, { decimals: 0 })}</Stat>
          <Stat label={G.DONE_BY} tone={eta?.month ? (eta.tight ? "text-short" : "text-profit") : "text-text-mute"}>
            {eta?.month ? `${fmtMonth(eta.month)}${eta.tight ? ` · ${G.TIGHT}` : ""}` : G.NO_DATE}
          </Stat>
        </div>
      )}

      {line && <p className="text-sm text-text-mute">{line}</p>}
    </div>
  )
}
