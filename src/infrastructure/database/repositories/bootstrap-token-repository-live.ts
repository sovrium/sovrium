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
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { sovriumBootstrapTokens as sovriumBootstrapTokensPg } from '@/infrastructure/database/drizzle/schema/app-versioning'
import { sovriumBootstrapTokens as sovriumBootstrapTokensSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/app-versioning'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'

const sovriumBootstrapTokens = resolveDialectSchema(
  sovriumBootstrapTokensPg,
  sovriumBootstrapTokensSqlite
)

const wrap = makeDbWrap((cause) => new BootstrapTokenDatabaseError({ cause }))

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
    wrap(async () => {
      const [row] = await db
        .insert(sovriumBootstrapTokens)
        .values({ tokenHash, expiresAt })
        .returning()
      return decodeRow((row ?? {}) as Record<string, unknown>)
    }),

  claim: (tokenHash: string) =>
    Effect.gen(function* () {
      const now = new Date()

      const updated = yield* wrap(() =>
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
          .returning()
      )

      if (updated.length > 0 && updated[0] !== undefined) {
        return decodeRow(updated[0] as Record<string, unknown>)
      }

      const rows = yield* wrap(() =>
        db
          .select()
          .from(sovriumBootstrapTokens)
          .where(eq(sovriumBootstrapTokens.tokenHash, tokenHash))
          .limit(1)
      )

      if (rows[0] === undefined) {
        return yield* new BootstrapTokenNotFoundError({ tokenHash })
      }

      const row = decodeRow(rows[0] as Record<string, unknown>)

      if (row.usedAt !== undefined) {
        return yield* new BootstrapTokenAlreadyUsedError({ usedAt: row.usedAt })
      }
      return yield* new BootstrapTokenExpiredError({ expiresAt: row.expiresAt })
    }),

  expireAll: () =>
    wrap(() => {
      const now = new Date()
      return db
        .update(sovriumBootstrapTokens)
        .set({ expiresAt: now })
        .where(
          and(
            isNull(sovriumBootstrapTokens.usedAt),
            gt(sovriumBootstrapTokens.expiresAt, now)
          )
        )
    }).pipe(Effect.asVoid),
})
