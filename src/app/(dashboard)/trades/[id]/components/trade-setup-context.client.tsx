"use client"

import { createContext, useContext, useState } from "react"
import type { ReactNode } from "react"

// Playbook + setup checklist of the trade being viewed, shared by the sidebar
// (which edits them) and the header grade badge (which reads them), so the
// grade updates as soon as a criterion is ticked.
type TradeSetupCtx = {
  playbookId:       string | null
  followedRules:    string[] | null
  setPlaybookId:    (id: string | null) => void
  setFollowedRules: (rules: string[] | null) => void
}

const TradeSetupContext = createContext<TradeSetupCtx>({
  playbookId:       null,
  followedRules:    null,
  setPlaybookId:    () => {},
  setFollowedRules: () => {},
})

export function TradeSetupProvider({
  children,
  playbookId: initialPlaybookId,
  followedRules: initialFollowedRules,
}: {
  children:      ReactNode
  playbookId:    string | null
  followedRules: string[] | null
}) {
  const [playbookId, setPlaybookId]       = useState(initialPlaybookId)
  const [followedRules, setFollowedRules] = useState(initialFollowedRules)
  return (
    <TradeSetupContext.Provider value={{ playbookId, followedRules, setPlaybookId, setFollowedRules }}>
      {children}
    </TradeSetupContext.Provider>
  )
}

export function useTradeSetup() {
  return useContext(TradeSetupContext)
}
