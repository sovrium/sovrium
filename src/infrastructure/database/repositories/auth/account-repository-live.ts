/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Layer } from 'effect'
import {
  AccountDatabaseError,
  AccountRepository,
  type AccountLinkedRow,
  type AccountSessionRow,
  type AccountUserRow,
} from '@/application/ports/repositories/auth/account-repository'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { db } from '@/infrastructure/database'
import { authTableRef } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import {
  executeRaw,
  executeRawTyped,
  type RawSqlRunner,
} from '@/infrastructure/database/sql/dialect-execute'
import { getExistingColumnNames } from '@/infrastructure/database/sql/dialect-introspection'
import { AUTHORSHIP_FIELDS } from '@/infrastructure/database/table-queries/mutation-helpers/authorship-helpers'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'

const wrap = makeDbWrap((cause) => new AccountDatabaseError({ cause }))

function toOptionalDate(value: unknown) {
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date
  }
  return undefined
}

const tablesWithCreatedByImpl = async (
  tableNames: readonly string[]
): Promise<readonly string[]> => {
  const sanitized = [...new Set(tableNames.map(sanitizeTableName))].filter((n) => n.length > 0)
  if (sanitized.length === 0) return []

  const runner = db as unknown as RawSqlRunner
  const matched = await Promise.all(
    sanitized.map(async (name) => {
      const columns = await getExistingColumnNames(runner, name, [AUTHORSHIP_FIELDS.CREATED_BY])
      return columns.has(AUTHORSHIP_FIELDS.CREATED_BY) ? name : undefined
    })
  )
  return matched.filter((name): name is string => name !== undefined)
}

export const AccountRepositoryLive = Layer.succeed(AccountRepository, {
  loadProfile: (userId) =>
    wrap(async () => {
      const userRows = await executeRawTyped<AccountUserRow>(
        db,
        sql`SELECT id, email, name, image, email_verified AS "emailVerified",
                   role, created_at AS "createdAt", updated_at AS "updatedAt"
            FROM ${authTableRef('user')} WHERE id = ${userId}`
      )
      return userRows[0]
    }),

  loadSessions: (userId) =>
    wrap(async () =>
      executeRawTyped<AccountSessionRow>(
        db,
        sql`SELECT id, user_id AS "userId", expires_at AS "expiresAt",
                   ip_address AS "ipAddress", user_agent AS "userAgent",
                   created_at AS "createdAt", updated_at AS "updatedAt"
            FROM ${authTableRef('session')} WHERE user_id = ${userId}`
      )
    ),

  loadAccounts: (userId) =>
    wrap(async () =>
      executeRawTyped<AccountLinkedRow>(
        db,
        sql`SELECT id, user_id AS "userId", provider_id AS "providerId",
                   account_id AS "accountId", scope,
                   created_at AS "createdAt", updated_at AS "updatedAt"
            FROM ${authTableRef('account')} WHERE user_id = ${userId}`
      )
    ),

  loadScheduledErasure: (userId) =>
    wrap(async () => {
      const rows = await executeRawTyped<{ readonly scheduledErasureAt: unknown }>(
        db,
        sql`SELECT "scheduledErasureAt" AS "scheduledErasureAt"
            FROM ${authTableRef('user')} WHERE id = ${userId}`
      )
      return toOptionalDate(rows[0]?.scheduledErasureAt)
    }),

  tablesWithCreatedBy: (tableNames) => wrap(async () => tablesWithCreatedByImpl(tableNames)),

  readAuthoredRecords: (tableName, userId) =>
    wrap(async () =>
      executeRawTyped<Record<string, unknown>>(
        db,
        sql`SELECT * FROM ${sql.identifier(tableName)} WHERE ${sql.identifier(AUTHORSHIP_FIELDS.CREATED_BY)} = ${userId}`
      )
    ),

  cancelErasure: (userId) =>
    wrap(async () => {
      await executeRaw(
        db,
        sql`UPDATE ${authTableRef('user')} SET "scheduledErasureAt" = NULL WHERE id = ${userId}`
      )
    }),

  scheduleErasure: (userId, scheduledAt) =>
    wrap(async () => {
      const scheduledValue = isSqliteRuntime() ? scheduledAt.getTime() : scheduledAt
      await db.transaction(async (tx) => {
        await executeRaw(
          tx,
          sql`UPDATE ${authTableRef('user')} SET "scheduledErasureAt" = ${scheduledValue} WHERE id = ${userId}`
        )
        await executeRaw(tx, sql`DELETE FROM ${authTableRef('session')} WHERE user_id = ${userId}`)
      })
    }),
})
