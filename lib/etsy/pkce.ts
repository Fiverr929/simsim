import crypto from "crypto"

export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url")
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url")
}

// Pinned to globalThis so Next.js hot-reloads don't clear it between /start and /callback
const g = globalThis as typeof globalThis & { _etsyPendingStates?: Map<string, { baseId: string; codeVerifier: string; createdAt: number }> }
if (!g._etsyPendingStates) g._etsyPendingStates = new Map()
const pendingStates = g._etsyPendingStates

const TTL_MS = 10 * 60 * 1000 // 10 minutes

export function saveOAuthState(baseId: string, codeVerifier: string): string {
  const state = crypto.randomBytes(16).toString("hex")
  // Clean up expired entries
  const now = Date.now()
  for (const [k, v] of pendingStates) {
    if (now - v.createdAt > TTL_MS) pendingStates.delete(k)
  }
  pendingStates.set(state, { baseId, codeVerifier, createdAt: now })
  return state
}

export function consumeOAuthState(state: string): { baseId: string; codeVerifier: string } | null {
  const entry = pendingStates.get(state)
  if (!entry) return null
  pendingStates.delete(state)
  if (Date.now() - entry.createdAt > TTL_MS) return null
  return entry
}
