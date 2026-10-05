import { createHash, randomBytes } from "node:crypto";

// Secret tokens for links and visitors (invite links, widget conversations): 32 random bytes,
// URL-safe. Only a token's SHA-256 is stored, like a password, so the database never holds a
// usable one.

/** The SHA-256 of a token, as hex: what the database stores and compares. */
export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** A new secret token, with its hash. */
export function createToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}
