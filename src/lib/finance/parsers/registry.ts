import { IMAGIN_FORMAT, isImagin, parseImagin } from "./imagin"
import type { ParseResult } from "./types"

// Parsers con formato conocido, autodetectados por cabecera (MONEY_SPEC.md
// §3.1). Lo que no se reconoce va al importador genérico con mapeo.

type KnownParser = { format: string; detect: (text: string) => boolean; parse: (text: string) => ParseResult }

const KNOWN: KnownParser[] = [
  { format: IMAGIN_FORMAT, detect: isImagin, parse: parseImagin },
]

export function detectKnownFormat(text: string): KnownParser | null {
  return KNOWN.find(p => p.detect(text)) ?? null
}
