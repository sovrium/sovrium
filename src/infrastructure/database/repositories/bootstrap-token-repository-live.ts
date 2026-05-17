/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq, gt, isNull } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  BootstrapTokenDatabaseError,
  BootstrapTokenRepository,
} from '@/application/ports/repositories/bootstrap-token-repository'
import {
  BootstrapTokenAlreadyUsedError,
  BootstrapTokenExpiredError,
  BootstrapTokenNotFoundError,
  type BootstrapToken,
} from '@/domain/models/system'
import { db } from '@/infrastructure/database'
import { sovriumBootstrapTokens } from '@/infrastructure/database/drizzle/schema/app-versioning'

/**
 * Bootstrap Token Repository Implementation (Drizzle).
 *
 * `claim` is a 3-step atomic flow:
 *
 *   1. Lookup row by `tokenHash`.
 *   2. Validate expiry + unused state.
 *   3. UPDATE ... SET used_at = now() WHERE token_hash = ? AND used_at IS NULL
 *      AND expires_at > now()  — a single conditional UPDATE so two
 *      concurrent claim requests for the same token cannot both win.
 *      If the UPDATE returns 0 rows, the second caller re-reads the row
 *      to decide whether to fail with `Expired` or `AlreadyUsed`.
 */
const decodeRow = (row: Record<string, unknown>): BootstrapToken => {
  const { usedAt } = row
  return {
    tokenHash: String(row['tokenHash']),
    expiresAt: row['expiresAt'] as Date,
    ...(usedAt instanceof Date ? { usedAt } : {}),
    createdAt: row['createdAt'] as Date,
  }
}

export const BootstrapTokenRepositoryLive = Layer.succeed(BootstrapTokenRepository, {
  create: ({ tokenHash, expiresAt }) =>
    Effect.tryPromise({
      try: async () => {
        const [row] = await db
          .insert(sovriumBootstrapTokens)
          .values({ tokenHash, expiresAt })
          .returning()
        return decodeRow((row ?? {}) as Record<string, unknown>)
      },
      catch: (cause) => new BootstrapTokenDatabaseError({ cause }),
    }),

  claim: (tokenHash: string) =>
    Effect.gen(function* () {
      const now = new Date()

      // Step 1: optimistic conditional update — succeeds atomically when
      // (token exists) AND (unused) AND (not expired).
      const updated = yield* Effect.tryPromise({
        try: () =>
          db
            .update(sovriumBootstrapTokens)
            .set({ usedAt: now })
            .where(
              and(
                eq(sovriumBootstrapTokens.tokenHash, tokenHash),
                isNull(sovriumBootstrapTokens.usedAt),
                gt(sovriumBootstrapTokens.expiresAt, now)
              )
            )
            .returning(),
        catch: (cause) => new BootstrapTokenDatabaseError({ cause }),
      })

      if (updated.length > 0 && updated[0] !== undefined) {
        return decodeRow(updated[0] as Record<string, unknown>)
      }

      // Step 2: claim failed — figure out *why* by reading the row.
      const rows = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(sovriumBootstrapTokens)
            .where(eq(sovriumBootstrapTokens.tokenHash, tokenHash))
            .limit(1),
        catch: (cause) => new BootstrapTokenDatabaseError({ cause }),
      })

      if (rows[0] === undefined) {
        return yield* new BootstrapTokenNotFoundError({ tokenHash })
      }

      const row = decodeRow(rows[0] as Record<string, unknown>)

      if (row.usedAt !== undefined) {
        return yield* new BootstrapTokenAlreadyUsedError({ usedAt: row.usedAt })
      }
      // The conditional UPDATE missed but the row is unused — must be expired.
      return yield* new BootstrapTokenExpiredError({ expiresAt: row.expiresAt })
    }),

  expireAll: () =>
    Effect.tryPromise({
      try: () => {
        const now = new Date()
        return db
          .update(sovriumBootstrapTokens)
          .set({ expiresAt: now })
          .where(
            and(
              isNull(sovriumBootstrapTokens.usedAt),
              // Only touch rows that haven't already expired, to keep the
              // operation idempotent and the audit clean.
              gt(sovriumBootstrapTokens.expiresAt, now)
            )
          )
      },
      catch: (cause) => new BootstrapTokenDatabaseError({ cause }),
    }).pipe(Effect.asVoid),
})
