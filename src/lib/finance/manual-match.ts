// Emparejar el import con lo apuntado a mano (MONEY_SPEC.md §3.2.5): una fila
// nueva del extracto sustituye a un movimiento manual de la misma cuenta con el
// mismo importe y fecha a ±MANUAL_MATCH_DAYS. El concepto no cuenta: el que
// escribe el usuario nunca se parece al del banco.

export const MANUAL_MATCH_DAYS = 3

export type MatchImportRow = { importKey: string; bookedAt: string; amount: number }
export type MatchManual = { id: string; bookedAt: string; amount: number }

const cents = (n: number) => Math.round(n * 100)
const dayDiff = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000

/** Si la fila del extracto puede ser ese movimiento manual (mismo importe, fecha dentro de la ventana). */
export function isManualMatch(row: Omit<MatchImportRow, "importKey">, manual: MatchManual, days = MANUAL_MATCH_DAYS): boolean {
  return cents(row.amount) === cents(manual.amount) && dayDiff(row.bookedAt, manual.bookedAt) <= days
}

/**
 * importKey → id del manual. Cada manual y cada fila se usan una vez; se
 * asignan primero las parejas más cercanas en fecha (a igualdad, la fila y el
 * manual que antes salen), así dos cafés iguales en días seguidos no se cruzan.
 */
export function matchManualTransactions(rows: MatchImportRow[], manuals: MatchManual[], days = MANUAL_MATCH_DAYS): Map<string, string> {
  const pairs: { key: string; id: string; diff: number; r: number; m: number }[] = []
  rows.forEach((row, r) => {
    manuals.forEach((manual, m) => {
      if (isManualMatch(row, manual, days)) pairs.push({ key: row.importKey, id: manual.id, diff: dayDiff(row.bookedAt, manual.bookedAt), r, m })
    })
  })
  pairs.sort((a, b) => a.diff - b.diff || a.r - b.r || a.m - b.m)

  const out = new Map<string, string>()
  const used = new Set<string>()
  for (const p of pairs) {
    if (out.has(p.key) || used.has(p.id)) continue
    out.set(p.key, p.id)
    used.add(p.id)
  }
  return out
}
