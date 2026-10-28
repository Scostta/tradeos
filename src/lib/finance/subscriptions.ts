import { daysBetween } from "./dates"
import type { Cadence } from "./recurring"

// Cálculos de la pantalla de suscripciones (MONEY_SPEC.md §5.3).

export type SubscriptionLike = {
  amount:       number        // positivo
  cadence:      Cadence
  status:       "pending" | "confirmed" | "cancelled" | "ignored"
  usage:        "unknown" | "used" | "unused" | "fixed"
  unusedSince:  string | null
  lastSeen:     string
  nextExpected: string | null
  updatedAt:    string        // último cambio del usuario (status / usage); el recálculo no lo toca
}

const PER_MONTH: Record<Cadence, number> = {
  weekly:    52 / 12,
  monthly:   1,
  quarterly: 1 / 3,
  yearly:    1 / 12,
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Coste mensual normalizado: semanales × 52/12, trimestrales / 3, anuales / 12. */
export function monthlyCost(s: Pick<SubscriptionLike, "amount" | "cadence">): number {
  return round2(s.amount * PER_MONTH[s.cadence])
}

export function yearlyCost(s: Pick<SubscriptionLike, "amount" | "cadence">): number {
  return round2(s.amount * PER_MONTH[s.cadence] * 12)
}

/** Meses completos desde `since` hasta `today`. */
export function monthsSince(since: string, today: string): number {
  return Math.floor(daysBetween(since, today) / 30.44)
}

/** "Candidatas a cancelar": confirmadas marcadas sin usar desde hace ≥ 2 meses. */
export function candidatesToCancel<T extends SubscriptionLike>(subs: T[], today: string): T[] {
  return subs.filter(s =>
    s.status === "confirmed" && s.usage === "unused" && s.unusedSince != null && monthsSince(s.unusedSince, today) >= 2)
}

/** Canceladas que han vuelto a cobrar después de cancelarlas (aviso arriba). */
export function chargingAgain<T extends SubscriptionLike>(subs: T[]): T[] {
  return subs.filter(s => s.status === "cancelled" && s.lastSeen > s.updatedAt.slice(0, 10))
}

/** Días hasta el próximo cargo (negativo si ya debería haber pasado); null si no se espera. */
export function daysToNext(s: Pick<SubscriptionLike, "nextExpected">, today: string): number | null {
  return s.nextExpected ? daysBetween(today, s.nextExpected) : null
}
