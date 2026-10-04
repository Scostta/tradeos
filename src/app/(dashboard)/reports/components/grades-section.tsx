import type { ReactElement } from "react"
import { GRADE_SCALE } from "~/constants/grades"
import { REPORTS } from "~/constants/copies/reports"
import { formatPct } from "~/helpers/format"
import { GradeGroupCard } from "~/components/grade-group-card"
import type { GradeReport } from "~/types/reports"

const COPY = REPORTS.GRADES

// Best grade first, matching the By-grade cards and the badges.
const SCALE_BEST_FIRST = GRADE_SCALE.slice().reverse()

/** Setup grades across every playbook (Playbooks sub-report). */
export function GradesSection({ grades }: { grades: GradeReport }): ReactElement {
  const { coverage, groups, months } = grades

  return (
    <div className="card p-4 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="label-caps">{COPY.TITLE}</span>
        <span className="mono text-xxs text-text-mute">
          {coverage.graded}/{coverage.total} {COPY.GRADED}
        </span>
      </div>

      <CoverageBar coverage={coverage} />

      {coverage.graded === 0 ? (
        <p className="text-sm text-text-mute italic">{COPY.NONE}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="label-caps">{COPY.BY_GRADE}</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-sm border border-border overflow-hidden">
              {groups.map(g => <GradeGroupCard key={g.grade ?? "none"} group={g} />)}
            </div>
          </div>
          <GradeMix months={months} />
        </>
      )}
    </div>
  )
}

// ── Coverage ──────────────────────────────────────────────────────────────────

function CoverageBar({ coverage }: { coverage: GradeReport["coverage"] }): ReactElement {
  const { total, graded, noChecklist, noPlaybook } = coverage
  const parts = [
    { key: "graded",      n: graded,      label: COPY.COVERAGE_GRADED,       color: "var(--color-accent)"    },
    { key: "noChecklist", n: noChecklist, label: COPY.COVERAGE_NO_CHECKLIST, color: "var(--color-short)"     },
    { key: "noPlaybook",  n: noPlaybook,  label: COPY.COVERAGE_NO_PLAYBOOK,  color: "var(--color-border-hi)" },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-caps">{COPY.COVERAGE}</span>
        <span className="mono text-lg font-semibold text-text">{total ? formatPct(graded / total, 0) : "—"}</span>
      </div>
      {total > 0 && (
        <div className="flex h-2 gap-0.5" role="img" aria-label={parts.map(p => `${p.label}: ${p.n}`).join(", ")}>
          {parts.filter(p => p.n > 0).map(p => (
            <div
              key={p.key}
              className="h-full rounded-xs"
              style={{ flexGrow: p.n, flexBasis: 0, background: p.color }}
              title={`${p.label}: ${p.n}`}
            />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-dim">
        {parts.map(p => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-xs shrink-0" style={{ background: p.color }} />
            {p.label} <span className="mono text-text">{p.n}</span>
          </span>
        ))}
      </div>
      {noChecklist > 0 && <p className="text-xxs text-text-mute">{COPY.COVERAGE_HINT}</p>}
    </div>
  )
}

// ── Grade mix by month ────────────────────────────────────────────────────────

function GradeMix({ months }: { months: GradeReport["months"] }): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label-caps">{COPY.BY_MONTH}</span>
        <div className="flex items-center gap-3 text-xs text-text-dim">
          {SCALE_BEST_FIRST.map(g => (
            <span key={g.id} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-xs" style={{ background: g.color }} />
              {g.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {months.map(m => (
          <div key={m.key} className="flex items-center gap-3">
            <span className="mono text-xs text-text-dim w-16 shrink-0">{m.label}</span>
            <div className="flex-1 min-w-0 flex h-4 gap-0.5">
              {m.graded === 0 ? (
                <div className="h-full flex-1 rounded-xs bg-surface-2" title={COPY.MONTH_NONE} />
              ) : (
                SCALE_BEST_FIRST.filter(g => m.counts[g.id] > 0).map(g => (
                  <div
                    key={g.id}
                    className="h-full rounded-xs flex items-center justify-center text-xxs mono font-semibold text-bg overflow-hidden"
                    style={{ flexGrow: m.counts[g.id], flexBasis: 0, background: g.color }}
                    title={`${m.label} · ${g.label}: ${m.counts[g.id]} (${formatPct(m.counts[g.id] / m.graded, 0)})`}
                  >
                    {g.label}
                  </div>
                ))
              )}
            </div>
            <span className="mono text-xxs text-text-mute shrink-0 w-28 text-right">
              {SCALE_BEST_FIRST.map(g => `${g.label} ${m.counts[g.id]}`).join(" · ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
