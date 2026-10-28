import { addDays, addMonths, daysBetween } from "./dates"

// Recurrentes (MONEY_SPEC.md §4.3): cargos de la misma contraparte con importe
// estable y cadencia regular. Solo detecta: el usuario confirma (status) y
// marca el uso (usage); el upsert en finance_subscriptions nunca pisa eso.

export type Cadence = "weekly" | "monthly" | "quarterly" | "yearly"

// Intervalo en días entre cargos consecutivos que cuenta como cada cadencia.
const CADENCE_DAYS: [Cadence, number, number][] = [
  ["weekly", 6, 8],
  ["monthly", 28, 33],
  ["quarterly", 85, 97],
  ["yearly", 355, 375],
]

const AMOUNT_TOLERANCE = 0.1   // ±10 % de la mediana de los 3 últimos cargos
const MIN_OCCURRENCES = 2

export type RecurringInput = {
  bookedAt:     string
  amount:       number          // firmado: los cargos son negativos
  counterparty: string | null
  categoryId:   string | null
  excluded:     boolean
}

export type RecurringCandidate = {
  counterparty:   string
  amount:         number        // positivo: mediana de los 3 últimos cargos
  cadence:        Cadence
  categoryId:     string | null // la del último cargo
  firstSeen:      string
  lastSeen:       string
  nextExpected:   string
  occurrences:    number
  intervalMedian: number        // días; evidencia para "Pending" ("every 30 ± 1 days")
  intervalSpread: number
  amountSpread:   number        // máx. desviación del importe sobre la mediana (0 = mismo importe)
}

export function cadenceOf(days: number): Cadence | null {
  return CADENCE_DAYS.find(([, min, max]) => days >= min && days <= max)?.[0] ?? null
}

export function nextCharge(date: string, cadence: Cadence): string {
  switch (cadence) {
    case "weekly":    return addDays(date, 7)
    case "monthly":   return addMonths(date, 1)
    case "quarterly": return addMonths(date, 3)
    case "yearly":    return addMonths(date, 12)
  }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/**
 * Por contraparte: los cargos dentro de ±10 % de la mediana de los 3 últimos
 * y, de ellos, la racha final con intervalos de la misma cadencia. Así una
 * subida de precio (9,99 → 12,99) sigue siendo la misma suscripción con el
 * importe nuevo, y un Bizum irregular no sale.
 */
export function detectRecurring(transactions: RecurringInput[]): RecurringCandidate[] {
  const byCounterparty = new Map<string, RecurringInput[]>()
  for (const t of transactions) {
    if (t.excluded || t.amount >= 0 || !t.counterparty) continue
    const list = byCounterparty.get(t.counterparty) ?? []
    list.push(t)
    byCounterparty.set(t.counterparty, list)
  }

  const out: RecurringCandidate[] = []
  for (const [counterparty, list] of byCounterparty) {
    if (list.length < MIN_OCCURRENCES) continue
    const charges = [...list].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt))
    const reference = median(charges.slice(-3).map(c => -c.amount))
    const inBand = charges.filter(c => Math.abs(-c.amount - reference) <= reference * AMOUNT_TOLERANCE)

    // Racha final con la misma cadencia, desde el último cargo hacia atrás.
    const run: RecurringInput[] = []
    let cadence: Cadence | null = null
    const intervals: number[] = []
    for (let i = inBand.length - 1; i >= 0; i--) {
      const charge = inBand[i]!
      if (run.length === 0) { run.unshift(charge); continue }
      const days = daysBetween(charge.bookedAt, run[0]!.bookedAt)
      const c = cadenceOf(days)
      if (!c || (cadence && c !== cadence)) break
      cadence = c
      intervals.unshift(days)
      run.unshift(charge)
    }
    if (!cadence || run.length < MIN_OCCURRENCES) continue

    const amounts = run.map(c => -c.amount)
    const amount = Math.round(median(amounts.slice(-3)) * 100) / 100
    const intervalMedian = median(intervals)
    const last = run[run.length - 1]!
    out.push({
      counterparty,
      amount,
      cadence,
      categoryId: last.categoryId,
      firstSeen: run[0]!.bookedAt,
      lastSeen: last.bookedAt,
      nextExpected: nextCharge(last.bookedAt, cadence),
      occurrences: run.length,
      intervalMedian,
      intervalSpread: Math.max(...intervals.map(d => Math.abs(d - intervalMedian))),
      amountSpread: Math.max(...amounts.map(a => Math.abs(a - amount) / amount)),
    })
  }
  return out.sort((a, b) => a.counterparty.localeCompare(b.counterparty))
}
