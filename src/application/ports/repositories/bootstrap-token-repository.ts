/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data, type Effect } from 'effect'
import type { BootstrapToken, BootstrapTokenError } from '@/domain/models/system'

/**
 * Database error for bootstrap-token operations.
 */
export class BootstrapTokenDatabaseError extends Data.TaggedError('BootstrapTokenDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Bootstrap Token Repository Port.
 *
 * Backs `system.sovrium_bootstrap_tokens`. Plaintext is never stored —
 * `create` accepts a TTL and returns the persisted row keyed by the
 * SHA-256 hash; the *plaintext* is generated and printed by the
 * `generateBootstrapTokenIfNeeded` use case at server boot, never
 * returned by this port.
 *
 * `claim` enforces the one-time, time-bounded contract:
 *   1. lookup row by `tokenHash`            → NotFound (401)
 *   2. ensure now() < expiresAt              → Expired (401)
 *   3. ensure usedAt IS NULL                → AlreadyUsed (401)
 *   4. atomically set usedAt = now() + return the row.
 *
 * `expireAll` is a guardrail: once the first admin is provisioned via
 * env-var bootstrap, the use case calls `expireAll` to invalidate any
 * pending tokens.
 */
export class BootstrapTokenRepository extends Context.Tag('BootstrapTokenRepository')<
  BootstrapTokenRepository,
  {
    /**
     * Persist a new token row. Caller must hash the plaintext with
     * SHA-256 BEFORE invoking this method — the port is hash-only.
     */
    readonly create: (input: {
      readonly tokenHash: string
      readonly expiresAt: Date
    }) => Effect.Effect<BootstrapToken, BootstrapTokenDatabaseError>
    /**
     * Atomic one-time consume. Looks up by hash, validates expiry +
     * unused, marks usedAt = now() and returns the row.
     */
    readonly claim: (
      tokenHash: string
    ) => Effect.Effect<BootstrapToken, BootstrapTokenDatabaseError | BootstrapTokenError>
    /** Mark every active row as expired (sets expiresAt = now()). */
    readonly expireAll: () => Effect.Effect<void, BootstrapTokenDatabaseError>
  }
>() {}
