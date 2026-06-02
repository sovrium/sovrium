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
} from '@/application/ports/repositories/account-repository'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { db } from '@/infrastructure/database'
import { authTableRef } from '@/infrastructure/database/drizzle/dialect-schema'
import { makeDbWrap } from '@/infrastructure/database/sql/db-effect'
import { executeRaw, executeRawTyped } from '@/infrastructure/database/sql/dialect-execute'
import { AUTHORSHIP_FIELDS } from '@/infrastructure/database/table-queries/mutation-helpers/authorship-helpers'

const wrap = makeDbWrap((cause) => new AccountDatabaseError({ cause }))

const tablesWithCreatedByImpl = async (
  tableNames: readonly string[]
): Promise<readonly string[]> => {
  const sanitized = [...new Set(tableNames.map(sanitizeTableName))].filter((n) => n.length > 0)
  if (sanitized.length === 0) return []

  const nameList = sql.join(
    sanitized.map((name) => sql`${name}`),
    sql`, `
  )
  const rows = (await db.execute(
    sql`SELECT DISTINCT table_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = ${AUTHORSHIP_FIELDS.CREATED_BY}
          AND table_name IN (${nameList})`
  )) as unknown as readonly { table_name: string }[]
  return rows.map((row) => row.table_name)
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
      await db.transaction(async (tx) => {
        await executeRaw(
          tx,
          sql`UPDATE ${authTableRef('user')} SET "scheduledErasureAt" = ${scheduledAt} WHERE id = ${userId}`
        )
        await executeRaw(tx, sql`DELETE FROM ${authTableRef('session')} WHERE user_id = ${userId}`)
      })
    }),
})
