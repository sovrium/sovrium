/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Context, Data } from 'effect'
import type { Effect } from 'effect'

/**
 * Database error for share-link operations.
 */
export class ShareLinkDatabaseError extends Data.TaggedError('ShareLinkDatabaseError')<{
  readonly cause: unknown
}> {}

/**
 * Plaintext shape returned by reads. The repository hashes
 * `passwordHash` at the boundary on writes; reads expose the column as
 * an opaque string (presence-only — never the raw password).
 */
export interface ShareLinkRow {
  readonly id: string
  readonly pageName: string
  readonly token: string
  readonly passwordHash: string | undefined
  readonly expiresAt: Date | undefined
  readonly embedAllowed: boolean
  readonly createdById: string | undefined
  readonly createdAt: Date
  readonly revokedAt: Date | undefined
  readonly viewCount: number
  readonly lastAccessedAt: Date | undefined
}

/**
 * Share Link Repository Port.
 *
 * Backs `system.share_links`. Public reads (the `/shared/{token}`
 * route) MUST filter out revoked and expired rows; the convenience
 * `findActiveByToken` does this server-side so callers can't forget.
 *
 * `recordAccess` is the analytics path — increments view_count and
 * updates last_accessed_at atomically. Spec contract:
 * `shared-page-analytics.spec.ts` asserts these are observable per-resolve.
 */
export class ShareLinkRepository extends Context.Tag('ShareLinkRepository')<
  ShareLinkRepository,
  {
    readonly create: (input: {
      readonly pageName: string
      readonly token: string
      readonly passwordHash?: string
      readonly expiresAt?: Date
      readonly embedAllowed?: boolean
      readonly createdById?: string
    }) => Effect.Effect<ShareLinkRow, ShareLinkDatabaseError>
    /** Returns any link by token (including revoked/expired) — admin lookup. */
    readonly findByToken: (
      token: string
    ) => Effect.Effect<ShareLinkRow | undefined, ShareLinkDatabaseError>
    /** Returns the link only if not revoked and not expired — public lookup. */
    readonly findActiveByToken: (
      token: string
    ) => Effect.Effect<ShareLinkRow | undefined, ShareLinkDatabaseError>
    readonly listForPage: (
      pageName: string
    ) => Effect.Effect<readonly ShareLinkRow[], ShareLinkDatabaseError>
    readonly update: (input: {
      readonly token: string
      readonly passwordHash?: string | null
      readonly expiresAt?: Date | null
      readonly embedAllowed?: boolean
    }) => Effect.Effect<ShareLinkRow | undefined, ShareLinkDatabaseError>
    /** Soft-delete by setting revoked_at = now(). Idempotent. */
    readonly revoke: (token: string) => Effect.Effect<boolean, ShareLinkDatabaseError>
    /**
     * Increment view_count and bump last_accessed_at to now().
     * Returns the updated row's view_count.
     */
    readonly recordAccess: (token: string) => Effect.Effect<number, ShareLinkDatabaseError>
  }
>() {}
