import { monthKey, shiftMonth } from "./invest-fx"
import type { MonthKey } from "./invest-fx"
import type { InvestPrice } from "~/types/invest"

// Overlays del gráfico de /invest/positions/[id] (INVEST_SPEC.md §4.3). Solo
// para mostrar: la señal hold/sell la calcula el job (evaluate(), §1.3) y se lee
// de invest_position_checks. Todo sobre adj_close mensual de invest_prices,
// igual que la regla; nunca sobre las velas diarias.

const SMA_MONTHS = 10

export type StepPoint = { time: string; value: number }   // time = YYYY-MM-DD

function monthlyCloses(prices: InvestPrice[], ticker: string): Map<MonthKey, { monthEnd: string; close: number }> {
  const out = new Map<MonthKey, { monthEnd: string; close: number }>()
  for (const p of prices) {
    if (p.ticker === ticker) out.set(monthKey(p.monthEnd), { monthEnd: p.monthEnd, close: p.adjClose })
  }
  return out
}

/**
 * SMA de 10 cierres mensuales como escalones: un punto por cierre de mes (su
 * month_end) con la media de ese mes y los 9 anteriores. En el gráfico se dibuja
 * con LineType.WithSteps, así que el valor solo cambia a fin de mes. Un mes sin
 * los 10 cierres consecutivos no tiene punto.
 */
export function smaSteps(prices: InvestPrice[], ticker: string): StepPoint[] {
  const closes = monthlyCloses(prices, ticker)
  const out: StepPoint[] = []
  for (const month of [...closes.keys()].sort()) {
    const window = Array.from({ length: SMA_MONTHS }, (_, i) => closes.get(shiftMonth(month, -i))?.close)
    if (window.some(v => v == null)) continue
    const value = (window as number[]).reduce((a, v) => a + v, 0) / SMA_MONTHS
    out.push({ time: closes.get(month)!.monthEnd, value })
  }
  return out
}

/**
 * Escalones para la ventana de velas [firstTime, lastTime]: el escalón vigente
 * al empezar la ventana arranca en la primera vela (sin fechas repetidas, que
 * lightweight-charts rechaza) y el último se alarga hasta la última vela.
 */
export function stepsInRange(steps: StepPoint[], firstTime: string, lastTime: string): StepPoint[] {
  const out: StepPoint[] = []
  for (const [i, step] of steps.entries()) {
    const next = steps[i + 1]
    if (step.time > lastTime) break
    if (step.time >= firstTime) out.push(step)
    else if (!next || next.time > firstTime) out.push({ time: firstTime, value: step.value })
  }
  const last = out[out.length - 1]
  if (last && last.time < lastTime) out.push({ time: lastTime, value: last.value })
  return out
}

/**
 * Nivel de salida del cierre de `evaluationDate`: el precio por debajo del
 * cual ese cierre quedaría bajo su propia SMA 10. Con S = suma de los 9 cierres
 * anteriores, cierre < (S + cierre) / 10  ⇔  cierre < S / 9: la media de esos 9.
 * null si falta alguno (p. ej. el job aún no ha guardado el último mes).
 */
export function exitLevel(prices: InvestPrice[], ticker: string, evaluationDate: string): number | null {
  const closes = monthlyCloses(prices, ticker)
  const month = monthKey(evaluationDate)
  const previous = Array.from({ length: SMA_MONTHS - 1 }, (_, i) => closes.get(shiftMonth(month, -(i + 1)))?.close)
  if (previous.some(v => v == null)) return null
  return (previous as number[]).reduce((a, v) => a + v, 0) / (SMA_MONTHS - 1)
}
