import { describe, it, expect } from "vitest"
import { normalizeConcept } from "./normalize-concept"

// Conceptos con la forma de los de un banco español (CaixaBank / imagin),
// anonimizados.
describe("normalizeConcept", () => {
  it.each([
    ["COMPRA TARJ. 5402XXXXXXXX1234 MERCADONA VALENCIA", "mercadona valencia"],
    ["Compra tarjeta ****4471 LIDL SUPERMERCADOS 12/10/2026", "lidl supermercados"],
    ["RECIBO NETFLIX.COM 2026-10-03", "netflix.com"],
    ["ADEUDO RECIBO MAPFRE SEGUROS REF. 0039482771", "mapfre seguros ref"],
    ["BIZUM ENVIADO A P*** C*** CENA", "cena"],
    ["Bizum recibido de M*** L***", ""],
    ["TRANSFERENCIA A FAVOR DE Cuenta Remunerada MyInvestor", "cuenta remunerada myinvestor"],
    ["PAGO MOVIL EN REPSOL E.S. 1234", "repsol e.s. 1234"],
    ["Compra internet en AMAZON EU SARL*2X4K9", "amazon eu sarl"],
    ["NÓMINA OCTUBRE EMPRESA S.L.", "nomina octubre empresa s.l"],
    ["Devolución compra ZARA ESPAÑA", "zara espana"],
    ["PAYPAL *SPOTIFY 35314369001", "paypal spotify"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeConcept(raw)).toBe(expected)
  })

  it("dos variantes del mismo comercio dan la misma contraparte", () => {
    expect(normalizeConcept("COMPRA TARJ. 5402XXXXXXXX1234 MERCADONA VALENCIA 03/10"))
      .toBe(normalizeConcept("Compra tarj. ****9876 Mercadona Valencia"))
  })

  it("colapsa espacios y es idempotente", () => {
    const once = normalizeConcept("  RECIBO   Vodafone   España  ")
    expect(once).toBe("vodafone espana")
    expect(normalizeConcept(once)).toBe(once)
  })
})
