import { describe, it, expect } from "vitest"
import { applyRules, matchRule, transactionsByRule } from "./match-rule"
import type { Rule, RuleTarget } from "./match-rule"

const rules: Rule[] = [
  { id: "r-merca", pattern: "mercadona", categoryId: "groceries", priority: 0, amount: null },
  { id: "r-merca-online", pattern: "mercadona online", categoryId: "shopping", priority: 0, amount: null },
  { id: "r-amazon", pattern: "amazon", categoryId: "shopping", priority: 0, amount: null },
  { id: "r-amazon-prime", pattern: "prime", categoryId: "subscriptions", priority: 5, amount: null },
]

describe("matchRule", () => {
  it("contiene sobre la contraparte normalizada", () => {
    expect(matchRule("mercadona valencia", -10, rules)?.id).toBe("r-merca")
    expect(matchRule("lidl", -10, rules)).toBeNull()
    expect(matchRule(null, -10, rules)).toBeNull()
    expect(matchRule("", -10, rules)).toBeNull()
  })

  it("a igual prioridad gana el patrón más largo", () => {
    expect(matchRule("mercadona online sl", -10, rules)?.id).toBe("r-merca-online")
  })

  it("la prioridad manda sobre la longitud", () => {
    expect(matchRule("amazon prime eu", -10, rules)?.id).toBe("r-amazon-prime")
  })

  it("un patrón vacío nunca casa", () => {
    expect(matchRule("lo que sea", -10, [{ id: "x", pattern: "", categoryId: "c", priority: 9, amount: null }])).toBeNull()
  })
})

describe("applyRules", () => {
  const base: Omit<RuleTarget, "id"> = {
    counterparty: "mercadona valencia", amount: -10, categoryId: null, categorySource: null, parentId: null, excluded: false,
  }

  it("categoriza lo pendiente y lo que venía de otra regla, nunca lo manual ni los splits", () => {
    const txs: RuleTarget[] = [
      { ...base, id: "pending" },
      { ...base, id: "old-rule", categoryId: "other", categorySource: "rule" },
      { ...base, id: "manual", categoryId: "eating", categorySource: "manual" },
      { ...base, id: "split-child", categoryId: "eating", categorySource: "split", parentId: "p" },
      { ...base, id: "split-parent", excluded: true },
      { ...base, id: "already", categoryId: "groceries", categorySource: "rule" },
      { ...base, id: "no-match", counterparty: "lidl" },
    ]
    expect(applyRules(txs, rules)).toEqual([
      { transactionId: "pending", categoryId: "groceries", ruleId: "r-merca" },
      { transactionId: "old-rule", categoryId: "groceries", ruleId: "r-merca" },
    ])
  })

  it("sin reglas no hace nada", () => {
    expect(applyRules([{ ...base, id: "a" }], [])).toEqual([])
  })
})

describe("transactionsByRule", () => {
  const tx = (id: string, counterparty: string | null, categoryId: string | null, categorySource: RuleTarget["categorySource"]): RuleTarget =>
    ({ id, counterparty, amount: -10, categoryId, categorySource, parentId: null, excluded: false })

  it("atribuye cada movimiento de regla a su regla ganadora", () => {
    const owned = transactionsByRule([
      tx("1", "mercadona valencia", "groceries", "rule"),
      tx("2", "mercadona online sl", "shopping", "rule"),
      tx("3", "amazon prime eu", "subscriptions", "rule"),
    ], rules)
    expect(Object.fromEntries(owned)).toEqual({ "r-merca": ["1"], "r-merca-online": ["2"], "r-amazon-prime": ["3"] })
  })

  it("ignora lo manual, lo sin categoría y lo que no lleva la categoría de la regla", () => {
    const owned = transactionsByRule([
      tx("1", "mercadona valencia", "groceries", "manual"),
      tx("2", "mercadona valencia", null, null),
      tx("3", "mercadona valencia", "eating-out", "rule"),
      tx("4", null, "groceries", "rule"),
    ], rules)
    expect(owned.size).toBe(0)
  })
})

describe("reglas con importe", () => {
  const atm: Rule[] = [
    { id: "r-atm", pattern: "reint.cajero", categoryId: "atm", priority: 0, amount: null },
    { id: "r-rent", pattern: "reint.cajero", categoryId: "housing", priority: 0, amount: 500 },
  ]

  it("casa solo con el importe absoluto exacto y gana a la regla sin importe", () => {
    expect(matchRule("reint.cajero", -500, atm)?.id).toBe("r-rent")
    expect(matchRule("reint.cajero", -500.004, atm)?.id).toBe("r-rent")
    expect(matchRule("reint.cajero", -200, atm)?.id).toBe("r-atm")
    expect(matchRule("reint.cajero", -500.5, atm)?.id).toBe("r-atm")
  })

  it("gana aunque la otra tenga más prioridad", () => {
    expect(matchRule("reint.cajero", -500, [{ ...atm[0]!, priority: 10 }, atm[1]!])?.id).toBe("r-rent")
  })

  it("applyRules y transactionsByRule reparten por importe", () => {
    const t = (id: string, amount: number, categoryId: string | null): RuleTarget =>
      ({ id, counterparty: "reint.cajero", amount, categoryId, categorySource: categoryId ? "rule" : null, parentId: null, excluded: false })
    expect(applyRules([t("a", -500, "atm"), t("b", -60, null)], atm)).toEqual([
      { transactionId: "a", categoryId: "housing", ruleId: "r-rent" },
      { transactionId: "b", categoryId: "atm", ruleId: "r-atm" },
    ])
    expect(Object.fromEntries(transactionsByRule([t("a", -500, "housing"), t("b", -60, "atm")], atm))).toEqual({ "r-rent": ["a"], "r-atm": ["b"] })
  })
})
