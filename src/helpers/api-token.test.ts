import { describe, expect, it } from "vitest"
import { generateApiToken, hashApiToken, parseBearerToken } from "~/helpers/api-token"

describe("api tokens", () => {
  it("generates a prefixed token whose hash and display prefix match", () => {
    const { token, hash, prefix } = generateApiToken()

    expect(token.startsWith("tos_")).toBe(true)
    expect(hash).toBe(hashApiToken(token))
    expect(token.startsWith(prefix)).toBe(true)
    expect(prefix).toHaveLength(8)
  })

  it("parses only well-formed bearer headers", () => {
    expect(parseBearerToken("Bearer tos_abc-DEF_123")).toBe("tos_abc-DEF_123")
    expect(parseBearerToken("Bearer abc")).toBeNull()
    expect(parseBearerToken("tos_abc")).toBeNull()
    expect(parseBearerToken(null)).toBeNull()
  })
})
