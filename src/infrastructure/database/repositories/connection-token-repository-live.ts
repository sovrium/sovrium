/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { and, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  ConnectionTokenDatabaseError,
  ConnectionTokenRepository,
  SentinelTokenInProductionError,
  type ConnectionTokenPlaintext,
  type ConnectionUserSummary,
} from '@/application/ports/repositories/connection-token-repository'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'
import { decryptToken, encryptToken } from '@/infrastructure/crypto/token-encrypt'
import { db } from '@/infrastructure/database'
import { connectionTokens } from '@/infrastructure/database/drizzle/schema/connection'
import { isProduction } from '@/infrastructure/utils/env'

/**
 * Connection Token Repository Implementation (Drizzle).
 *
 * Encrypts on write, decrypts on read. The `access_token` and
 * `refresh_token` columns store base64-JSON envelopes (`v1:{...}`)
 * produced by `crypto/token-encrypt.ts`. Callers above the repo see
 * plaintext via the `ConnectionTokenPlaintext` shape.
 *
 * Upsert is a single INSERT ... ON CONFLICT DO UPDATE keyed on the
 * `(connection_id, user_id)` unique index (audit H3). Two concurrent
 * OAuth callbacks for the same user resolve to exactly one row.
 */
/**
 * Defense-in-depth guard (REC-C4-4): refuse to persist a sentinel-shaped
 * access token when running in production. Returns the error to fail
 * with, or `undefined` to proceed. Pure; takes the production check as
 * an injected predicate so unit tests can drive both branches without
 * touching `process.env`.
 *
 * @internal — exported for unit tests; production callers go through
 * `upsertForUser` which composes this guard into the Effect.
 */
export const checkSentinelGuard = (
  input: Readonly<{
    connectionId: string
    userId: string
    accessToken: string
    isProductionEnv: () => boolean
  }>
): Readonly<SentinelTokenInProductionError> | undefined => {
  if (!input.isProductionEnv()) return undefined
  if (!isSentinelAccessToken(input.accessToken)) return undefined
  return new SentinelTokenInProductionError({
    connectionId: input.connectionId,
    userId: input.userId,
  })
}

const decodeRow = (row: Record<string, unknown>): ConnectionTokenPlaintext => {
  const refreshEnvelope = row['refreshToken'] as string | null | undefined
  const expiresAt = row['expiresAt'] as Date | null | undefined
  return {
    id: String(row['id']),
    connectionId: String(row['connectionId']),
    userId: String(row['userId']),
    accessToken: decryptToken(String(row['accessToken'])),
    refreshToken:
      typeof refreshEnvelope === 'string' && refreshEnvelope !== ''
        ? decryptToken(refreshEnvelope)
        : undefined,
    expiresAt: expiresAt instanceof Date ? expiresAt : undefined,
    createdAt: row['createdAt'] as Date,
    updatedAt: row['updatedAt'] as Date,
  }
}

export const ConnectionTokenRepositoryLive = Layer.succeed(ConnectionTokenRepository, {
  findForUser: ({ connectionId, userId }) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(connectionTokens)
          .where(
            and(
              eq(connectionTokens.connectionId, connectionId),
              eq(connectionTokens.userId, userId)
            )
          )
          .limit(1)
        return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
      },
      catch: (cause) => new ConnectionTokenDatabaseError({ cause }),
    }),

  upsertForUser: ({ connectionId, userId, accessToken, refreshToken, expiresAt }) =>
    Effect.gen(function* () {
      // Defense-in-depth (REC-C4-4): refuse to persist a sentinel-shaped
      // access token in production. The seeder no-ops at NODE_ENV ===
      // 'production' (see runSeedTestConnectionTokens), but if NODE_ENV is
      // unset (a fail-open scenario in some deployment platforms), the
      // seeder would still run. This repository-side check is the second
      // line of defense — even with a misconfigured environment, a
      // sentinel cannot reach the production database via this method.
      // Real OAuth providers never hand back tokens ending in
      // '.signature-placeholder', so a true positive only occurs when
      // someone has tried to inject a test sentinel.
      const guardError = checkSentinelGuard({
        connectionId,
        userId,
        accessToken,
        isProductionEnv: isProduction,
      })
      if (guardError !== undefined) {
        // @effect-diagnostics effect/unnecessaryFailYieldableError:off
        // We use `Effect.fail(...)` here to match the convention used
        // throughout `application/use-cases/tables/programs.ts` and
        // `comment-programs.ts` (10+ sites). Switching just this one to
        // `yield* guardError` would be a stylistic outlier.
        return yield* Effect.fail(guardError)
      }

      return yield* Effect.tryPromise({
        try: async () => {
          const accessEnvelope = encryptToken(accessToken)
          const refreshEnvelope =
            refreshToken !== undefined && refreshToken !== ''
              ? encryptToken(refreshToken)
              : undefined

          const valuesForWrite = {
            accessToken: accessEnvelope,
            ...(refreshEnvelope !== undefined ? { refreshToken: refreshEnvelope } : {}),
            ...(expiresAt !== undefined ? { expiresAt } : {}),
          }

          // Single statement, atomic against the
          // (connection_id, user_id) unique index. updatedAt is bumped via
          // the schema's $onUpdate so we don't need to set it explicitly.
          const [row] = await db
            .insert(connectionTokens)
            .values({ connectionId, userId, ...valuesForWrite })
            .onConflictDoUpdate({
              target: [connectionTokens.connectionId, connectionTokens.userId],
              set: valuesForWrite,
            })
            .returning()
          if (row === undefined) {
            // eslint-disable-next-line functional/no-throw-statements -- defensive; INSERT...RETURNING never returns zero rows for a successful write
            throw new Error('connection_tokens upsert returned no row')
          }
          return decodeRow(row as Record<string, unknown>)
        },
        catch: (cause) => new ConnectionTokenDatabaseError({ cause }),
      })
    }),

  deleteForUser: ({ connectionId, userId }) =>
    Effect.tryPromise({
      try: async () => {
        const deleted = await db
          .delete(connectionTokens)
          .where(
            and(
              eq(connectionTokens.connectionId, connectionId),
              eq(connectionTokens.userId, userId)
            )
          )
          .returning({ id: connectionTokens.id })
        return deleted.length > 0
      },
      catch: (cause) => new ConnectionTokenDatabaseError({ cause }),
    }),

  countForConnection: (connectionId) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select({ id: connectionTokens.id })
          .from(connectionTokens)
          .where(eq(connectionTokens.connectionId, connectionId))
        return rows.length
      },
      catch: (cause) => new ConnectionTokenDatabaseError({ cause }),
    }),

  listUsersForConnection: ({ connectionId }) =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db
          .select()
          .from(connectionTokens)
          .where(eq(connectionTokens.connectionId, connectionId))
        // Token-content filtering (sentinel detection, etc.) lives in the
        // injection path (`auth-headers.ts`); the listing endpoint
        // returns a row for every (connection_id, user_id) tuple that
        // exists in the database, leaving role-based exclusion (admins
        // don't authorize per-user-scope connections) to the API
        // handler — see `users-handler.ts` for that layer.
        const summaries: readonly ConnectionUserSummary[] = rows.map((row) => {
          const r = row as Record<string, unknown>
          const expires = r['expiresAt']
          return {
            userId: String(r['userId']),
            expiresAt: expires instanceof Date ? expires : undefined,
            createdAt: r['createdAt'] as Date,
            updatedAt: r['updatedAt'] as Date,
          }
        })
        return summaries
      },
      catch: (cause) => new ConnectionTokenDatabaseError({ cause }),
    }),
})
