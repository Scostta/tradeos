import { describe, it, expect } from "vitest"
import { manualImportKey, transactionFingerprint, withFinanceImportKeys } from "./fingerprint"

const coffee = { bookedAt: "2026-10-03", amount: -1.8, conceptRaw: "COMPRA TARJ. ****1234 CAFE PEPE", balanceAfter: null }

describe("transactionFingerprint", () => {
  it("fecha|importe con 2 decimales|concepto normalizado|saldo", () => {
    expect(transactionFingerprint({ ...coffee, balanceAfter: 1520.4 })).toBe("2026-10-03|-1.80|cafe pepe|1520.40")
    expect(transactionFingerprint(coffee)).toBe("2026-10-03|-1.80|cafe pepe")
  })

  it("variantes del concepto que normalizan igual dan la misma huella", () => {
    expect(transactionFingerprint({ ...coffee, conceptRaw: "Compra tarj. 5402XXXXXXXX9876 Cafe Pepe" }))
      .toBe(transactionFingerprint(coffee))
  })
})

describe("withFinanceImportKeys", () => {
  it("dos cafés iguales sin saldo: el ordinal #n los distingue", () => {
    const keys = withFinanceImportKeys([coffee, coffee]).map(r => r.importKey)
    expect(keys).toEqual(["2026-10-03|-1.80|cafe pepe#1", "2026-10-03|-1.80|cafe pepe#2"])
  })

  it("con saldo, dos cafés iguales ya son distintos (#1 los dos)", () => {
    const keys = withFinanceImportKeys([
      { ...coffee, balanceAfter: 100 },
      { ...coffee, balanceAfter: 98.2 },
    ]).map(r => r.importKey)
    expect(keys).toEqual(["2026-10-03|-1.80|cafe pepe|100.00#1", "2026-10-03|-1.80|cafe pepe|98.20#1"])
  })

  it("re-importar el mismo fichero (o uno que lo solapa) da las mismas claves", () => {
    const october = [coffee, { ...coffee, amount: -45.2, conceptRaw: "RECIBO ENDESA" }, coffee]
    const first = withFinanceImportKeys(october).map(r => r.importKey)
    const again = withFinanceImportKeys(october).map(r => r.importKey)
    expect(again).toEqual(first)
  })
})

describe("manualImportKey", () => {
  it("manual|<id>", () => {
    expect(manualImportKey("abc")).toBe("manual|abc")
  })
})
