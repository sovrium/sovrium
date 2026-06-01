/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { appendAuditEntryToDbTx } from '@/infrastructure/audit-log/drizzle-store'
import { db } from '@/infrastructure/database'
import { AUTHORSHIP_FIELDS } from '@/infrastructure/database/table-queries/mutation-helpers/authorship-helpers'
import { logInfo } from '@/infrastructure/logging/logger'
import { executeRaw, type RawSqlRunner } from './sql/dialect-execute'
import { getExistingColumnNames } from './sql/dialect-introspection'
import { authTableRef, nowExpr } from './sql/dialect-sql'
import type { AuditLogEntry } from '@/domain/models/api/admin/audit-log/entry'
import type { DrizzleTransaction } from '@/infrastructure/database'


async function tablesWithCreatedBy(
  tx: Readonly<DrizzleTransaction>,
  tableNames: readonly string[]
): Promise<readonly string[]> {
  if (tableNames.length === 0) return []

  const sanitized = [...new Set(tableNames.map(sanitizeTableName))].filter(
    (name) => name.length > 0
  )
  if (sanitized.length === 0) return []

  const runner = tx as unknown as RawSqlRunner
  const matched = await Promise.all(
    sanitized.map(async (name) => {
      const columns = await getExistingColumnNames(runner, name, [AUTHORSHIP_FIELDS.CREATED_BY])
      return columns.has(AUTHORSHIP_FIELDS.CREATED_BY) ? name : undefined
    })
  )
  return matched.filter((name): name is string => name !== undefined)
}

export async function purgeAccount(
  userId: string,
  appTableNames: readonly string[]
): Promise<void> {
  await db.transaction(async (tx) => {
    const emailRows = (await executeRaw(
      tx,
      sql`SELECT email FROM ${authTableRef('user')} WHERE id = ${userId}`
    )) as unknown as readonly { email: string }[]
    const erasedEmail = emailRows[0]?.email

    const recordTables = await tablesWithCreatedBy(tx, appTableNames)
    for (const tableName of recordTables) {
      await executeRaw(
        tx,
        sql`DELETE FROM ${sql.identifier(tableName)} WHERE ${sql.identifier(AUTHORSHIP_FIELDS.CREATED_BY)} = ${userId}`
      )
    }

    await executeRaw(
      tx,
      sql`DELETE FROM ${authTableRef('verification')}
          WHERE identifier IN (SELECT email FROM ${authTableRef('user')} WHERE id = ${userId})`
    )

    await executeRaw(tx, sql`DELETE FROM ${authTableRef('two_factor')} WHERE user_id = ${userId}`)
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('session')} WHERE user_id = ${userId}`)
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('account')} WHERE user_id = ${userId}`)

    const purgeEntry: Readonly<AuditLogEntry> = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: AUDIT_ACTIONS.ACCOUNT_DELETION_PURGED,
      actor: {
        id: userId,
        type: 'user',
        role: 'system',
        ...(erasedEmail ? { email: erasedEmail } : {}),
      },
      resource: { type: 'user', id: userId },
      severity: 'critical',
      result: 'success',
      metadata: {
        erasedUserId: userId,
        ...(erasedEmail ? { erasedEmail } : {}),
      },
    }
    await appendAuditEntryToDbTx(tx, purgeEntry)

    await executeRaw(tx, sql`DELETE FROM ${authTableRef('user')} WHERE id = ${userId}`)
  })

  logInfo(`[account-purge] Hard-deleted account ${userId}`)
}

export async function purgeDueAccounts(appTableNames: readonly string[]): Promise<number> {
  const dueRows = (await executeRaw(
    db,
    sql`SELECT id FROM ${authTableRef('user')}
        WHERE "scheduledErasureAt" IS NOT NULL AND "scheduledErasureAt" <= ${nowExpr()}`
  )) as unknown as readonly { id: string }[]

  for (const row of dueRows) {
    await purgeAccount(row.id, appTableNames)
  }

  return dueRows.length
}
