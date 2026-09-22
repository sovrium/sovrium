/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createHash } from 'node:crypto'
import { deriveSubkey } from '@/infrastructure/crypto/root-secret'

/**
 * IP hashing for form submissions ([internal ref], S5 pre-launch security).
 *
 * Sovrium NEVER persists raw submitter IPs to the `form_submissions` ledger.
 * The submission pipeline computes `SHA-256(salt + ip)` at write time and
 * stores the 64-hex-char digest in the `submitter_ip_hash` column instead. The
 * raw IP exists only in volatile in-process rate-limiter state (a
 * `Map<ipHash, ...>`), which evicts entries after the rate-limit window
 * expires.
 *
 * Why hash-on-write rather than redacting at read time:
 * - **Data minimisation**: the address is never persisted in the first place,
 *   so there is no IP trail to erase later.
 * - **Defense-in-depth**: a database leak surfaces hashes, not addresses.
 * - **Audit utility**: hashes are stable, so admins can still recognise
 *   "many submissions from the same network" without learning the address.
 *
 * The salt is DERIVED from the install's persisted root secret, never
 * configured. Every install therefore gets a high-entropy, install-unique salt
 * that survives restarts with zero configuration — which is what makes the
 * audit-utility property above actually hold. There is no env var to forget,
 * so there is no boot warning and no per-process fallback that would silently
 * re-key the ledger on every restart.
 *
 * The salt is never logged, never returned by an API, and never exported: only
 * the digest leaves this module.
 *
 * Salt rotation is NOT an erasure mechanism (S5). Rotating the root secret
 * invalidates every user's hashes at once, so it can neither be triggered by,
 * nor scoped to, one person's Art. 17 request. Per-account erasure of the
 * digest happens the same way as the rest of the submission: `purgeAccount`
 * physically deletes the ledger rows whose `submitter_user_id` is the erased
 * user, and the `submitter_ip_hash` column goes with the row.
 */

const HASH_ALGORITHM = 'sha256'

/**
 * Domain-separation purpose for the IP-hash salt.
 *
 * The string IS the scrypt salt handed to `deriveSubkey`, so changing it
 * re-keys every submitter hash ever stored: existing `submitter_ip_hash` values
 * would stop matching newly-computed ones, and cross-submission correlation
 * would break for the whole ledger. Treat it as frozen.
 *
 * It is distinct from every other purpose string (`sovrium-auth-salt`,
 * `sovrium-token-salt`, ...) because handing one derived value to two
 * primitives is a key-reuse anti-pattern.
 */
const IP_HASH_SALT_PURPOSE = 'sovrium-form-ip-hash-salt'

// eslint-disable-next-line functional/no-let -- one-shot process-lifetime memo: scryptSync is deliberately expensive and this runs on every form submission and every comment
let cachedSalt: string | undefined

/**
 * Resolve the salt used to hash submitter IPs, as 64 lowercase hex chars.
 *
 * Derived from the root secret, so it is stable for the lifetime of an install
 * and identical across restarts, while remaining unique per install and absent
 * from the public source tree.
 *
 * Memoized for the process lifetime because `deriveSubkey` runs `scryptSync`,
 * which is intentionally slow; the inputs (root secret and purpose) cannot
 * change mid-run.
 */
export const resolveIpHashSalt = (): string => {
  if (cachedSalt !== undefined) return cachedSalt
  // eslint-disable-next-line functional/no-expression-statements -- memo assignment
  cachedSalt = deriveSubkey(IP_HASH_SALT_PURPOSE).toString('hex')
  return cachedSalt
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
