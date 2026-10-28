// Concepto del banco → contraparte normalizada (MONEY_SPEC.md §4.1). Sobre el
// resultado casan las reglas (§4.2) y se agrupan las suscripciones (§4.3), y
// entra en la huella del import (§3.3): cambiar esta función cambia las
// import_key de los movimientos ya importados, así que un re-import los
// duplicaría. Tocarla solo con una migración que recalcule las claves.

// Prefijos que pone el banco delante del comercio (ya sin acentos ni mayúsculas),
// de más largo a más corto para que "compra tarjeta" gane a "compra".
const BANK_PREFIXES = [
  "transferencia a favor de",
  "transferencia recibida de",
  "transferencia emitida a",
  "transferencia de",
  "transferencia a",
  "transferencia",
  "transf a favor de",
  "transf",
  "bizum enviado a",
  "bizum enviado",
  "bizum recibido de",
  "bizum recibido",
  "compra tarjeta",
  "compra tarj",
  "compra internet en",
  "compra en",
  "compra",
  "pago movil en",
  "pago movil",
  "pago en",
  "adeudo recibo",
  "adeudo",
  "recibo",
  "cargo",
  "devolucion compra",
  "devolucion",
  "abono",
  "tarj",
]

const CONNECTORS = new Set(["a", "de", "en", "del", "por"])

const DATE_FULL = /\b\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}\b/g        // dd/mm/aaaa, aaaa-mm-dd
const DATE_SHORT = /\b\d{1,2}[/.-]\d{1,2}\b/g                    // dd/mm
const CARD_MASK = /^\d*[x*]{3,}\d*$/                             // 5402xxxxxxxx1234, ****4471
const MASKED_NAME = /^[a-z]\*+$/                                 // p*** c***
const LONG_NUMBER = /^\d{5,}$/                                   // referencias, nº de comercio
const MIXED_REF = /^(?=(?:.*\d){2})(?=.*[a-z])[a-z0-9]{5,}$/     // referencias alfanuméricas: 2x4k9

function words(s: string): string[] {
  return s.split(/\s+/).filter(Boolean)
}

export function normalizeConcept(raw: string): string {
  const lowered = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // acentos
    .replace(DATE_FULL, " ")
    .replace(DATE_SHORT, " ")

  // Antes de quitar la puntuación: los asteriscos marcan tarjetas y nombres enmascarados.
  const unmasked = words(lowered).filter(w => !CARD_MASK.test(w) && !MASKED_NAME.test(w)).join(" ")

  // Puntuación fuera (se conservan . y &: netflix.com, h&m) y referencias numéricas.
  let s = words(unmasked.replace(/[^a-z0-9.& ]+/g, " "))
    .filter(w => !LONG_NUMBER.test(w) && !MIXED_REF.test(w))
    .join(" ")

  // Prefijos bancarios (pueden encadenarse: "adeudo recibo …") y conectores.
  let changed = true
  while (changed) {
    changed = false
    for (const prefix of BANK_PREFIXES) {
      if (s === prefix || s.startsWith(`${prefix} `) || s.startsWith(`${prefix}.`)) {
        s = s.slice(prefix.length).replace(/^[.\s]+/, "")
        changed = true
      }
    }
    const first = s.split(" ")[0]
    if (first && CONNECTORS.has(first) && s.includes(" ")) {
      s = s.slice(first.length + 1)
      changed = true
    }
  }

  return s.replace(/(^[.\s]+|[.\s]+$)/g, "").replace(/\s+/g, " ")
}
