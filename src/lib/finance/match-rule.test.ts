import { describe, it, expect } from "vitest"
import { applyRules, matchRule, transactionsByRule } from "./match-rule"
import type { Rule, RuleTarget } from "./match-rule"

const rules: Rule[] = [
  { id: "r-merca", pattern: "mercadona", categoryId: "groceries", priority: 0 },
  { id: "r-merca-online", pattern: "mercadona online", categoryId: "shopping", priority: 0 },
  { id: "r-amazon", pattern: "amazon", categoryId: "shopping", priority: 0 },
  { id: "r-amazon-prime", pattern: "prime", categoryId: "subscriptions", priority: 5 },
]

describe("matchRule", () => {
  it("contiene sobre la contraparte normalizada", () => {
    expect(matchRule("mercadona valencia", rules)?.id).toBe("r-merca")
    expect(matchRule("lidl", rules)).toBeNull()
    expect(matchRule(null, rules)).toBeNull()
    expect(matchRule("", rules)).toBeNull()
  })

  it("a igual prioridad gana el patrón más largo", () => {
    expect(matchRule("mercadona online sl", rules)?.id).toBe("r-merca-online")
  })

  it("la prioridad manda sobre la longitud", () => {
    expect(matchRule("amazon prime eu", rules)?.id).toBe("r-amazon-prime")
  })

  it("un patrón vacío nunca casa", () => {
    expect(matchRule("lo que sea", [{ id: "x", pattern: "", categoryId: "c", priority: 9 }])).toBeNull()
  })
})

describe("applyRules", () => {
  const base: Omit<RuleTarget, "id"> = {
    counterparty: "mercadona valencia", categoryId: null, categorySource: null, parentId: null, excluded: false,
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
    ({ id, counterparty, categoryId, categorySource, parentId: null, excluded: false })

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
