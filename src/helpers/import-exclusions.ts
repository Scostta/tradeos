// Lógica pura del preview del import: qué filas se excluyen y qué se manda al
// server action. Una fila excluida NO se importa y queda registrada en
// import_exclusions, así un re-import del mismo CSV no la vuelve a meter.

import type { ExclusionKey, PreviewRow } from "~/types"

/** Clave natural de un trade del CSV: la misma que dedupe en BD. */
export function previewRowKey(row: {
  accountName: string
  tradeNumber: number
}): string {
  return `${row.accountName}||${row.tradeNumber}`
}

export function toExclusionKey(row: {
  accountName: string
  tradeNumber: number
}): ExclusionKey {
  return { tradeNumber: row.tradeNumber, accountName: row.accountName }
}

/** Cuántas filas aún marcadas caen bajo el umbral de break-even. */
export function countBreakEven(rows: PreviewRow[], threshold: number): number {
  return rows.filter((r) => !r.excluded && Math.abs(r.netPnl) <= threshold)
    .length
}

/**
 * Excluye todo trade cuyo |net P&L| ≤ threshold (scratches / BE). No re-marca
 * nada: lo ya excluido se queda excluido.
 */
export function markBreakEven(
  rows: PreviewRow[],
  threshold: number
): PreviewRow[] {
  return rows.map((r) =>
    Math.abs(r.netPnl) <= threshold ? { ...r, excluded: true } : r
  )
}

export type ImportActions = {
  /** Filas a insertar en trades. */
  toImport: PreviewRow[]
  /** Nuevas exclusiones: se registran y, si ya estaban importadas, se borran. */
  toExclude: PreviewRow[]
  /** Exclusiones que el usuario levanta: se borra su registro y se importan. */
  toRestore: PreviewRow[]
}

/**
 * Reparte las filas del preview en las tres acciones del import.
 *
 * - `dup` marcada      → ya está en BD y así se queda: nada que hacer.
 * - `dup` desmarcada   → se excluye Y se borra el trade ya importado.
 * - `skipped` marcada  → se levanta la exclusión y se importa.
 * - `skipped` desmarcada → ya excluida en BD: no hace falta reenviarla.
 */
export function splitImportActions(rows: PreviewRow[]): ImportActions {
  return {
    toImport:  rows.filter((r) => !r.excluded && r.status !== "dup"),
    toExclude: rows.filter((r) => r.excluded && r.status !== "skipped"),
    toRestore: rows.filter((r) => !r.excluded && r.status === "skipped"),
  }
}
