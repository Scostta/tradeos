"use client"

import type { ReactElement } from "react"
import { GradeBadge } from "~/components/grade-badge"
import { parsePlaybookRules } from "~/helpers/playbook-rules"
import { gradeForRules } from "~/lib/calculations/trade-grade"
import type { Playbook } from "~/types/playbook"
import { useTradeSetup } from "./trade-setup-context.client"

/** Header grade badge — recomputed live from the sidebar's checklist state. */
export function TradeGradeBadge({ playbooks }: { playbooks: Playbook[] }): ReactElement | null {
  const { playbookId, followedRules } = useTradeSetup()
  const playbook = playbooks.find(p => p.id === playbookId)
  if (!playbook) return null

  const rules = parsePlaybookRules(playbook.rules)
  if (rules.entry.length === 0) return null

  return <GradeBadge grade={gradeForRules(rules, followedRules)} outOfPlan showUngraded />
}
