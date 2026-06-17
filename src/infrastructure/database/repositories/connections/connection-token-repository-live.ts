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
} from '@/application/ports/repositories/connections/connection-token-repository'
import { isSentinelAccessToken } from '@/infrastructure/connections/sentinel-tokens'
import { decryptToken, encryptToken } from '@/infrastructure/crypto/token-encrypt'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { connectionTokens as connectionTokensPg } from '@/infrastructure/database/drizzle/schema/connection'
import { connectionTokens as connectionTokensSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/connection'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { isProduction } from '@/infrastructure/utils/env'

const connectionTokens = resolveDialectSchema(connectionTokensPg, connectionTokensSqlite)

const wrap = makeDbWrap((cause) => new ConnectionTokenDatabaseError({ cause }))

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
    wrap(async () => {
      const rows = await db
        .select()
        .from(connectionTokens)
        .where(
          and(eq(connectionTokens.connectionId, connectionId), eq(connectionTokens.userId, userId))
        )
        .limit(1)
      return rows[0] !== undefined ? decodeRow(rows[0] as Record<string, unknown>) : undefined
    }),

  upsertForUser: ({ connectionId, userId, accessToken, refreshToken, expiresAt }) =>
    Effect.gen(function* () {
      const guardError = checkSentinelGuard({
        connectionId,
        userId,
        accessToken,
        isProductionEnv: isProduction,
      })
      if (guardError !== undefined) {
        return yield* Effect.fail(guardError)
      }

      return yield* wrap(async () => {
        const accessEnvelope = encryptToken(accessToken)
        const refreshEnvelope =
          refreshToken !== undefined && refreshToken !== '' ? encryptToken(refreshToken) : undefined

        const valuesForWrite = {
          accessToken: accessEnvelope,
          ...(refreshEnvelope !== undefined ? { refreshToken: refreshEnvelope } : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        }

        const [row] = await db
          .insert(connectionTokens)
          .values({ connectionId, userId, ...valuesForWrite })
          .onConflictDoUpdate({
            target: [connectionTokens.connectionId, connectionTokens.userId],
            set: valuesForWrite,
          })
          .returning()
        if (row === undefined) {
          throw new Error('connection_tokens upsert returned no row')
        }
        return decodeRow(row as Record<string, unknown>)
      })
    }),

  deleteForUser: ({ connectionId, userId }) =>
    wrap(async () => {
      const deleted = await db
        .delete(connectionTokens)
        .where(
          and(eq(connectionTokens.connectionId, connectionId), eq(connectionTokens.userId, userId))
        )
        .returning({ id: connectionTokens.id })
      return deleted.length > 0
    }),

  countForConnection: (connectionId) =>
    wrap(async () => {
      const rows = await db
        .select({ id: connectionTokens.id })
        .from(connectionTokens)
        .where(eq(connectionTokens.connectionId, connectionId))
      return rows.length
    }),

  listUsersForConnection: ({ connectionId }) =>
    wrap(async () => {
      const rows = await db
        .select()
        .from(connectionTokens)
        .where(eq(connectionTokens.connectionId, connectionId))
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
    }),
})
