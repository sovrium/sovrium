/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Session binding: a session is honoured only from the client it was issued to.
 *
 * Better Auth records the IP address and the User-Agent that created a session.
 * A request presenting that session's cookie from a DIFFERENT address or agent
 * is treated as carrying no session at all — a defence against a replayed
 * cookie.
 *
 * ─── WHY THIS IS ONE FUNCTION, IN THE DOMAIN ───────────────────────────────
 *
 * Two readers resolve a session: the API's `authMiddleware` and the page
 * renderer's session reader (which also gates the mounted console). They must
 * give the SAME answer, or the page tier admits a caller its own API refuses —
 * a page rendering data server-side for a cookie the API would 401. One pure
 * predicate both call is how they stay the same.
 *
 * A binding the session does not carry cannot be violated: Better Auth stores
 * `''` rather than omitting the field when it cannot determine the client IP
 * or the request had no User-Agent, and a request side that cannot supply a
 * value (no trusted forwarding header) has nothing to compare. Each check
 * therefore rejects only on two present, differing values.
 */

/** What Better Auth recorded when the session was created. */
export interface SessionBinding {
  readonly ipAddress?: string | null
  readonly userAgent?: string | null
}

/** What the current request presents, derived the same way. */
export interface RequestFingerprint {
  readonly ipAddress: string | undefined
  readonly userAgent: string | undefined
}

/** Whether a session may be honoured for a request with this fingerprint. */
export const isSessionBindingValid = (
  binding: SessionBinding,
  current: RequestFingerprint
): boolean => {
  if (binding.ipAddress && current.ipAddress && binding.ipAddress !== current.ipAddress) {
    return false
  }
  if (binding.userAgent && current.userAgent && binding.userAgent !== current.userAgent) {
    return false
  }
  return true
}
