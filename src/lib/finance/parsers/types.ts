// Resultado común de los parsers de Money (MONEY_SPEC.md §3.1).

export type ParsedTransaction = {
  line:         number          // línea del fichero (1 = primera), para los errores
  bookedAt:     string          // YYYY-MM-DD
  conceptRaw:   string
  amount:       number          // firmado: negativo = sale
  balanceAfter: number | null
}

export type ParseError = { line: number; message: string }

export type ParseResult = {
  format:    string             // "imagin", "custom"
  rows:      ParsedTransaction[]
  errors:    ParseError[]       // filas que no se pudieron leer (no se importan)
  ibanLast4: string | null      // si el fichero trae IBAN: solo los 4 últimos dígitos
}

/** Cabeceras no reconocidas: el parser no importa nada ni adivina columnas. */
export class UnrecognizedLayoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UnrecognizedLayoutError"
  }
}
