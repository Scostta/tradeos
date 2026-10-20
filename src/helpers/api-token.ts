import { createHash, randomBytes } from "node:crypto"

const TOKEN_PREFIX = "tos_"

/** Chars del token que se guardan en claro para reconocerlo en la lista. */
const DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 4

/** sha256 hex: lo único que se guarda del token en BD. */
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateApiToken(): { token: string; hash: string; prefix: string } {
  const token = TOKEN_PREFIX + randomBytes(24).toString("base64url")
  return {
    token,
    hash:   hashApiToken(token),
    prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
  }
}

/** Extrae el token de "Authorization: Bearer tos_..."; null si no tiene esa forma. */
export function parseBearerToken(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(tos_[A-Za-z0-9_-]+)$/)
  return m ? m[1]! : null
}
