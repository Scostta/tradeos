import type { Trade } from "~/types/trade"

// Un trade está revisado cuando se guardó en el repaso de sesión (reviewed_at),
// o cuando tiene playbook y su checklist registrado (followed_rules no null;
// [] = ninguna regla), p. ej. calificado desde la ficha del trade.
export function isReviewed(t: Pick<Trade, "reviewedAt" | "playbookId" | "followedRules">): boolean {
  return t.reviewedAt != null || (t.playbookId != null && t.followedRules != null)
}
