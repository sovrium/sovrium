/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash, randomBytes } from 'node:crypto'

/**
 * IP hashing for form submissions ([internal ref], S5 pre-launch security).
 *
 * Sovrium NEVER persists raw submitter IPs to the `form_submissions` ledger.
 * The submission pipeline computes `SHA-256(FORM_IP_HASH_SALT + ip)` at write
 * time and stores the 64-hex-char digest in the `submitter_ip_hash` column
 * instead. The raw IP exists only in volatile in-process rate-limiter state
 * (a `Map<ipHash, ...>`), which evicts entries after the rate-limit window
 * expires.
 *
 * Why hash-on-write rather than redacting at read time:
 * - **Data minimisation**: the address is never persisted in the first place,
 *   so there is no IP trail to erase later.
 * - **Defense-in-depth**: a database leak surfaces hashes, not addresses.
 * - **Audit utility**: hashes are stable, so admins can still recognise
 *   "many submissions from the same network" without learning the address.
 *
 * The salt comes from `FORM_IP_HASH_SALT`. When unset, the server emits a
 * boot-time warning and uses a session-scoped random fallback so submissions
 * still hash (rather than crashing forms on missing-config). The fallback
 * means hashes are NOT comparable across process restarts — operators who
 * want stable hashes MUST set the env var.
 *
 * Salt rotation is NOT an erasure mechanism (S5). It is a global operator
 * action that invalidates every user's hashes at once, so it can neither be
 * triggered by, nor scoped to, one person's Art. 17 request. Per-account
 * erasure of the digest happens the same way as the rest of the submission:
 * `purgeAccount` physically deletes the ledger rows whose `submitter_user_id`
 * is the erased user, and the `submitter_ip_hash` column goes with the row.
 */

const HASH_ALGORITHM = 'sha256'

/**
 * Name of the env var that supplies the application-wide IP-hash salt.
 *
 * Exposed as a constant so the boot-warning emitter and the live submission
 * pipeline use the same lookup key.
 */
export const FORM_IP_HASH_SALT_ENV = 'FORM_IP_HASH_SALT'

/**
 * Process-lifetime fallback salt. Generated lazily the first time
 * `readIpHashSalt` is asked to resolve a salt while `FORM_IP_HASH_SALT` is
 * unset. Stable within a single process so hashes from the same session
 * remain comparable; reset across restarts so a misconfigured operator gets
 * fresh hashes rather than predictable ones.
 *
 * Generated via `crypto.randomBytes(32).toString('hex')` to match the
 * recommended 32-byte entropy floor for HMAC-style salts.
 */
// eslint-disable-next-line functional/no-let -- module-scoped lazy singleton
let processFallbackSalt: string | undefined

const buildFallbackSalt = (): string => {
  if (processFallbackSalt !== undefined) return processFallbackSalt
  // eslint-disable-next-line functional/no-expression-statements -- module-scoped lazy singleton
  processFallbackSalt = randomBytes(32).toString('hex')
  return processFallbackSalt
}

/**
 * Resolve the active salt for hashing submitter IPs.
 *
 * - Reads `FORM_IP_HASH_SALT` from the supplied `env` (defaults to
 *   `process.env`).
 * - Returns the configured value when set and non-empty.
 * - Returns a stable process-lifetime fallback when unset — see module
 *   docstring. The boot phase emits a warning so operators can spot the
 *   misconfiguration; runtime never crashes on a missing salt.
 *
 * Exposed for both the submission pipeline and the boot-warning emitter so
 * both code paths agree on the source of truth.
 */
export const readIpHashSalt = (
  env: Readonly<Record<string, string | undefined>> = process.env
): string => {
  const configured = env[FORM_IP_HASH_SALT_ENV]
  if (typeof configured === 'string' && configured.length > 0) return configured
  return buildFallbackSalt()
}

/**
 * Returns `true` when `FORM_IP_HASH_SALT` is configured (non-empty string in
 * the supplied env). Used by the boot-warning emitter to decide whether to
 * surface a "missing salt" notice — fallback hashing still works either way.
 */
export const isIpHashSaltConfigured = (
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean => {
  const configured = env[FORM_IP_HASH_SALT_ENV]
  return typeof configured === 'string' && configured.length > 0
}

/**
 * Compute the SHA-256 hash of `salt + ip`, returned as 64 lowercase hex chars.
 *
 * The order is `salt + ip` (not `ip + salt`) so that a rainbow-table attacker
 * with knowledge of the IP space still has to brute-force the salt prefix —
 * matches the standard prefix-salting convention used in Better Auth and
 * Drizzle migration audit columns.
 *
 * Returns the digest of an empty string when `ip` is empty so the column is
 * never NULL on a successful insert. Callers should reject empty IPs upstream
 * (the rate-limiter falls back to a stable "no-ip" sentinel so anonymous
 * proxied traffic still gets rate-limited as a group).
 */
export const hashIp = (salt: string, ip: string): string => {
  return createHash(HASH_ALGORITHM)
    .update(salt + ip)
    .digest('hex')
}
