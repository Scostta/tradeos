import { describe, it, expect } from "vitest"
import { allocateSavings, goalEta, requiredMonthly } from "./allocate-savings"
import type { GoalInput } from "./allocate-savings"

const goal = (id: string, priority: number, monthlyAlloc: number, extra: Partial<GoalInput> = {}): GoalInput => ({
  id, priority, monthlyAlloc, targetAmount: 5000, savedAmount: 0, deadline: null, status: "active", ...extra,
})

const emergency = goal("emergency", 1, 300)
const travel = goal("travel", 2, 200)
const van = goal("van", 3, 150)

describe("allocateSavings", () => {
  it("ahorro suficiente: cada uno recibe su aportación y sobra el resto", () => {
    expect(allocateSavings([van, travel, emergency], 1000)).toEqual({
      allocations: [
        { goalId: "emergency", wanted: 300, allocated: 300, completes: false },
        { goalId: "travel", wanted: 200, allocated: 200, completes: false },
        { goalId: "van", wanted: 150, allocated: 150, completes: false },
      ],
      unallocated: 350,
    })
  })

  it("ahorro insuficiente: se recorta primero el de menor prioridad (número más alto)", () => {
    const { allocations, unallocated } = allocateSavings([emergency, travel, van], 420)
    expect(allocations.map(a => [a.goalId, a.allocated])).toEqual([["emergency", 300], ["travel", 120], ["van", 0]])
    expect(unallocated).toBe(0)
  })

  it("un objetivo que se completa a mitad solo recibe lo que le falta", () => {
    const nearly = goal("nearly", 1, 300, { targetAmount: 1000, savedAmount: 900 })
    const { allocations, unallocated } = allocateSavings([nearly, travel], 600)
    expect(allocations).toEqual([
      { goalId: "nearly", wanted: 100, allocated: 100, completes: true },
      { goalId: "travel", wanted: 200, allocated: 200, completes: false },
    ])
    expect(unallocated).toBe(300)
  })

  it("sin ahorro (o negativo) no reparte nada; los no activos no cuentan", () => {
    expect(allocateSavings([emergency], -200)).toEqual({
      allocations: [{ goalId: "emergency", wanted: 300, allocated: 0, completes: false }],
      unallocated: 0,
    })
    expect(allocateSavings([goal("old", 1, 100, { status: "archived" })], 500).allocations).toEqual([])
  })
})

describe("goalEta", () => {
  it("meses hasta completar a su aportación, contando el primero", () => {
    // Faltan 1.000 a 300/mes → 4 aportaciones: nov, dic, ene, feb.
    expect(goalEta(goal("g", 1, 300, { targetAmount: 1000 }), "2026-11")).toEqual({ month: "2027-02", tight: false })
  })

  it("'tight' si la fecha límite llega antes", () => {
    expect(goalEta(goal("g", 1, 300, { targetAmount: 1000, deadline: "2027-01-31" }), "2026-11"))
      .toEqual({ month: "2027-02", tight: true })
  })

  it("sin aportación no hay fecha", () => {
    expect(goalEta(goal("g", 1, 0), "2026-11").month).toBeNull()
  })
})

describe("requiredMonthly", () => {
  it("lo que falta repartido entre los meses hasta la fecha límite, incluido el suyo", () => {
    // Nov → feb = 4 meses; faltan 1.000.
    expect(requiredMonthly({ targetAmount: 1000, savedAmount: 0, deadline: "2027-02-28" }, "2026-11")).toBe(250)
    expect(requiredMonthly({ targetAmount: 1000, savedAmount: 0, deadline: null }, "2026-11")).toBeNull()
  })
})
