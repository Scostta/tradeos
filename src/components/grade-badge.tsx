import type { ReactElement } from "react"
import { gradeDef, LOWEST_GRADE } from "~/constants/grades"
import type { GradeId } from "~/constants/grades"
import { COMMON } from "~/constants/copies/common"
import { cn } from "~/utils/cn"

type Props = {
  grade:      GradeId | null
  /** Spell out "OUT OF PLAN" next to the lowest grade (trade header). */
  outOfPlan?: boolean
  /** Render the ungraded state as a pill instead of a muted dash. */
  showUngraded?: boolean
  className?: string
}

/** Setup grade pill (A / B / D …) computed by `gradeForTrade`. */
export function GradeBadge({ grade, outOfPlan = false, showUngraded = false, className }: Props): ReactElement {
  if (grade === null) {
    return showUngraded ? (
      <span className={cn("text-xxs mono font-semibold tracking-wider rounded-sm px-2 py-0.5 text-text-mute bg-surface-2", className)}>
        {COMMON.GRADES.UNGRADED.toUpperCase()}
      </span>
    ) : (
      <span className={cn("mono text-text-mute", className)}>—</span>
    )
  }

  const def = gradeDef(grade)
  const label = outOfPlan && grade === LOWEST_GRADE ? `${def.label} · ${COMMON.GRADES.OUT_OF_PLAN}` : def.label

  return (
    <span
      className={cn("inline-flex items-center text-xxs mono font-semibold tracking-wider rounded-sm px-2 py-0.5", className)}
      style={{
        color:      def.color,
        background: `color-mix(in srgb, ${def.color} 14%, transparent)`,
        border:     `1px solid color-mix(in srgb, ${def.color} 35%, transparent)`,
      }}
    >
      {label}
    </span>
  )
}
