import { describe, it, expect } from "vitest"
import { detectDelimiter, parseAmount, parseDate, splitCsvLine } from "./csv"
import { isImagin, parseImagin } from "./imagin"
import { guessMapping, inspectCsv, mappingIsComplete, parseWithMapping } from "./generic"
import { detectKnownFormat } from "./registry"
import { UnrecognizedLayoutError } from "./types"

// Mismo formato que el export real de imagin (28/10/2026), con datos inventados.
const IMAGIN = [
  "IBAN;Saldo disponible;Periodo",
  "ES0000000000000000001234;1.500,00;01/10/2026 - 28/10/2026",
  "Concepto;Fecha;Importe;Saldo disponible",
  "NOMINA (TRF);28/10/2026;2.000,00EUR;1.500,00EUR",
  "MERCADONA TARIFA;27/10/2026;-16,91EUR;-500,00EUR",
  "BIZUM RECIBIDO;25/10/2026;15,00EUR;-483,09EUR",
  "NETFLIX.COM;03/10/2026;-12,99EUR;-498,09EUR",
  "",
].join("\r\n")

describe("csv utils", () => {
  it("parseAmount: formato español, inglés y divisa", () => {
    expect(parseAmount("-16,91EUR")).toEqual({ value: -16.91, currency: "EUR" })
    expect(parseAmount("2.145,88EUR")).toEqual({ value: 2145.88, currency: "EUR" })
    expect(parseAmount("1,234.56")).toEqual({ value: 1234.56, currency: null })
    expect(parseAmount("-12.5 €")).toEqual({ value: -12.5, currency: "EUR" })
    expect(parseAmount("1.234")).toEqual({ value: 1234, currency: null })
    expect(parseAmount("12,5")).toEqual({ value: 12.5, currency: null })
    expect(parseAmount("abc")).toBeNull()
    expect(parseAmount("")).toBeNull()
  })

  it("parseDate: dd/mm/aaaa, dd-mm-aa y aaaa-mm-dd; rechaza fechas imposibles", () => {
    expect(parseDate("28/10/2026")).toBe("2026-10-28")
    expect(parseDate("1-2-26")).toBe("2026-02-01")
    expect(parseDate("2026-10-28")).toBe("2026-10-28")
    expect(parseDate("31/02/2026")).toBeNull()
    expect(parseDate("mañana")).toBeNull()
  })

  it("separador y comillas", () => {
    expect(detectDelimiter("Concepto;Fecha;Importe")).toBe(";")
    expect(detectDelimiter("a,b,c")).toBe(",")
    expect(splitCsvLine('"PAGO; TIENDA";01/10/2026;"-1,00"', ";")).toEqual(["PAGO; TIENDA", "01/10/2026", "-1,00"])
  })
})

describe("parseImagin", () => {
  it("lee los movimientos con su saldo y solo los 4 últimos dígitos del IBAN", () => {
    expect(isImagin(IMAGIN)).toBe(true)
    const r = parseImagin(IMAGIN)
    expect(r.format).toBe("imagin")
    expect(r.ibanLast4).toBe("1234")
    expect(r.errors).toEqual([])
    expect(r.rows).toEqual([
      { line: 4, bookedAt: "2026-10-28", conceptRaw: "NOMINA (TRF)", amount: 2000, balanceAfter: 1500 },
      { line: 5, bookedAt: "2026-10-27", conceptRaw: "MERCADONA TARIFA", amount: -16.91, balanceAfter: -500 },
      { line: 6, bookedAt: "2026-10-25", conceptRaw: "BIZUM RECIBIDO", amount: 15, balanceAfter: -483.09 },
      { line: 7, bookedAt: "2026-10-03", conceptRaw: "NETFLIX.COM", amount: -12.99, balanceAfter: -498.09 },
    ])
  })

  it("filas malas van a errores con su línea; el resto se importa", () => {
    const bad = IMAGIN.replace("27/10/2026", "32/10/2026").replace("-12,99EUR", "-12,99USD")
    const r = parseImagin(bad)
    expect(r.rows.map(x => x.conceptRaw)).toEqual(["NOMINA (TRF)", "BIZUM RECIBIDO"])
    expect(r.errors).toEqual([
      { line: 5, message: 'Invalid date "32/10/2026".' },
      { line: 7, message: "Currency USD is not EUR." },
    ])
  })

  it("si cambian las cabeceras, rechaza el fichero entero (no adivina columnas)", () => {
    const changed = IMAGIN.replace("Concepto;Fecha;Importe;Saldo disponible", "Fecha;Concepto;Importe;Saldo")
    expect(() => parseImagin(changed)).toThrow(UnrecognizedLayoutError)
  })
})

describe("registry", () => {
  it("autodetecta imagin; lo demás va al genérico", () => {
    expect(detectKnownFormat(IMAGIN)?.format).toBe("imagin")
    expect(detectKnownFormat("Fecha,Concepto,Importe\n01/10/2026,X,-1")).toBeNull()
  })
})

describe("importador genérico con mapeo", () => {
  const CSV = [
    "Banco Ejemplo - movimientos",
    "Fecha operación;Fecha valor;Concepto;Cargo;Abono;Saldo",
    "03/10/2026;03/10/2026;RECIBO LUZ;45,20;;1.000,00",
    "05/10/2026;05/10/2026;TRANSFERENCIA RECIBIDA;;300,00;1.300,00",
  ].join("\n")

  it("encuentra la cabecera y propone el mapeo por nombre", () => {
    const insp = inspectCsv(CSV)
    expect(insp.headerLine).toBe(1)
    expect(insp.delimiter).toBe(";")
    const m = guessMapping(insp.headers)
    expect(m).toEqual({ date: 0, concept: 2, debit: 3, credit: 4, balance: 5 })
    expect(mappingIsComplete(m)).toBe(true)
  })

  it("cargo/abono → importe firmado", () => {
    const r = parseWithMapping(CSV, { date: 0, concept: 2, debit: 3, credit: 4, balance: 5 })
    expect(r.rows).toEqual([
      { line: 3, bookedAt: "2026-10-03", conceptRaw: "RECIBO LUZ", amount: -45.2, balanceAfter: 1000 },
      { line: 4, bookedAt: "2026-10-05", conceptRaw: "TRANSFERENCIA RECIBIDA", amount: 300, balanceAfter: 1300 },
    ])
  })

  it("sin fecha, concepto e importe (o cargo + abono) el mapeo no está completo", () => {
    expect(mappingIsComplete({ date: 0, concept: 1 })).toBe(false)
    expect(mappingIsComplete({ date: 0, concept: 1, debit: 2 })).toBe(false)
  })
})
