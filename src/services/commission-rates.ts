import type { SupabaseClient } from "@supabase/supabase-js"
import { estimatedCommission } from "~/lib/calculations/commissions"
import type { CommissionRate } from "~/lib/calculations/commissions"

// Tarifas de comisión por cuenta (tabla commission_rates). Las usan el ingest
// del add-on (cliente service role), el import CSV y la action de /accounts,
// así que reciben el cliente de Supabase en vez de crearlo.

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Tarifas por cuenta; null si la consulta falla. */
export async function loadCommissionRates(
  supabase: SupabaseClient, accountIds: string[],
): Promise<Map<string, CommissionRate[]> | null> {
  const out = new Map<string, CommissionRate[]>()
  if (accountIds.length === 0) return out
  const { data, error } = await supabase
    .from("commission_rates").select("account_id, instrument, round_turn").in("account_id", accountIds)
  if (error) {
    console.error(error)
    return null
  }
  for (const r of data ?? []) {
    const list = out.get(r.account_id as string) ?? []
    list.push({ instrument: r.instrument as string, roundTurn: Number(r.round_turn) })
    out.set(r.account_id as string, list)
  }
  return out
}

/**
 * Comisión, neto y marca de estimada de una fila que va a insertarse: si llega
 * sin comisión y la cuenta tiene tarifa para el instrumento, se estima.
 */
export function withEstimatedCommission(
  row: { instrument: string; contracts: number; pnl: number; commission: number },
  rates: CommissionRate[] | undefined,
): { commission: number; net_pnl: number; commission_estimated: boolean } {
  const est = rates ? estimatedCommission({ ...row, commissionEstimated: false }, rates) : null
  const commission = est ?? row.commission
  return { commission, net_pnl: round2(row.pnl - commission), commission_estimated: est != null }
}

/**
 * Recalcula las comisiones de los trades de una cuenta que no tienen comisión
 * real (0 o estimada) con sus tarifas actuales. Un instrumento sin tarifa
 * devuelve sus estimadas a 0. Devuelve cuántos trades cambian, o null.
 */
export async function reapplyCommissionRates(
  supabase: SupabaseClient, userId: string, accountId: string, rates: CommissionRate[],
): Promise<number | null> {
  const { data, error } = await supabase
    .from("trades")
    .select("id, instrument, contracts, pnl, commission, commission_estimated")
    .eq("user_id", userId).eq("account_id", accountId)
    .or("commission.eq.0,commission_estimated.eq.true")
  if (error) {
    console.error(error)
    return null
  }

  const updates: { id: string; commission: number; net_pnl: number; commission_estimated: boolean }[] = []
  for (const t of data ?? []) {
    const current = Number(t.commission ?? 0)
    const estimated = t.commission_estimated === true
    const est = estimatedCommission(
      { instrument: t.instrument as string, contracts: Number(t.contracts), commission: current, commissionEstimated: estimated },
      rates,
    )
    const commission = est ?? (estimated ? 0 : current)    // sin tarifa: la estimada vuelve a 0
    const nowEstimated = est != null
    if (commission === current && nowEstimated === estimated) continue
    updates.push({ id: t.id as string, commission, net_pnl: round2(Number(t.pnl) - commission), commission_estimated: nowEstimated })
  }

  for (const u of updates) {
    const { error: updError } = await supabase
      .from("trades")
      .update({ commission: u.commission, net_pnl: u.net_pnl, commission_estimated: u.commission_estimated })
      .eq("id", u.id).eq("user_id", userId)
    if (updError) {
      console.error(updError)
      return null
    }
  }
  return updates.length
}
