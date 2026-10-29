import type { AppModule } from "~/helpers/active-module"

// Avisos del sidebar que pide el layout (dashboard): solo lectura.
export type SidebarBadges = {
  reviewPending: number    // Trading: trades sin revisar en /review
  investNewRun:  boolean   // Invest: run del mes sin abrir en Screen
}

export const NO_BADGES: SidebarBadges = { reviewPending: 0, investNewRun: false }

/** Módulos con algo pendiente, para el punto del conmutador. */
export function modulesWithBadge(b: SidebarBadges): Set<AppModule> {
  const s = new Set<AppModule>()
  if (b.reviewPending > 0) s.add("trading")
  if (b.investNewRun) s.add("invest")
  return s
}
