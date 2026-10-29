import { describe, expect, it } from "vitest"
import { estimatedCommission, rateFor } from "./commissions"

const rates = [{ instrument: "NQ", roundTurn: 3.98 }, { instrument: "MNQ", roundTurn: 1.02 }]
const trade = (instrument: string, contracts: number, commission = 0, commissionEstimated = false) =>
  ({ instrument, contracts, commission, commissionEstimated })

describe("rateFor", () => {
  it("busca por símbolo raíz sin distinguir mayúsculas", () => {
    expect(rateFor(rates, "mnq")).toBe(1.02)
    expect(rateFor(rates, "ES")).toBeNull()
  })
})

describe("estimatedCommission", () => {
  it("tarifa × contratos en los que llegan sin comisión", () => {
    expect(estimatedCommission(trade("MNQ", 2), rates)).toBe(2.04)
    expect(estimatedCommission(trade("NQ", 3), rates)).toBe(11.94)
  })

  it("recalcula las estimadas y nunca toca una comisión real", () => {
    expect(estimatedCommission(trade("MNQ", 2, 1.5, true), rates)).toBe(2.04)
    expect(estimatedCommission(trade("MNQ", 2, 1.5, false), rates)).toBeNull()
  })

  it("sin tarifa para el instrumento no hace nada", () => {
    expect(estimatedCommission(trade("ES", 1), rates)).toBeNull()
  })
})
