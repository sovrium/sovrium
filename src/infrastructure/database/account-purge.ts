/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { AUDIT_ACTIONS } from '@/domain/models/api/admin/audit-log/action-catalog'
import { sanitizeTableName } from '@/domain/utils/database/table-naming'
import { appendAuditEntryToDbTx } from '@/infrastructure/audit-log/drizzle-store'
import { db } from '@/infrastructure/database'
import { AUTHORSHIP_FIELDS } from '@/infrastructure/database/table-queries/mutation-helpers/authorship-helpers'
import { logInfo } from '@/infrastructure/logging/logger'
import { nowEpochMsSqlLiteral } from './sql/dialect-ddl'
import { executeRaw, type RawSqlRunner } from './sql/dialect-execute'
import { getExistingColumnNames, systemTableExists } from './sql/dialect-introspection'
import { authTableRef, systemTableRef } from './sql/dialect-sql'
import type { AuditLogEntry } from '@/domain/models/api/admin/audit-log/entry'
import type { DrizzleTransaction } from '@/infrastructure/database'


const SHED_AUTHORSHIP_FIELDS = [AUTHORSHIP_FIELDS.UPDATED_BY, AUTHORSHIP_FIELDS.DELETED_BY] as const

async function authorshipColumnsByTable(
  tx: Readonly<DrizzleTransaction>,
  tableNames: readonly string[]
): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  if (tableNames.length === 0) return new Map()

  const sanitized = [...new Set(tableNames.map(sanitizeTableName))].filter(
    (name) => name.length > 0
  )
  if (sanitized.length === 0) return new Map()

  const runner = tx as unknown as RawSqlRunner
  const probed = await Promise.all(
    sanitized.map(async (name) => {
      const columns = await getExistingColumnNames(runner, name, [
        AUTHORSHIP_FIELDS.CREATED_BY,
        ...SHED_AUTHORSHIP_FIELDS,
      ])
      return [name, columns] as const
    })
  )
  return new Map(probed.filter(([, columns]) => columns.size > 0))
}

const USER_OWNED_GATED_SYSTEM_TABLES = ['comment_read_state', 'user_access'] as const

async function deleteUserOwnedGatedSystemRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  const runner = tx as unknown as RawSqlRunner

  for (const tableName of USER_OWNED_GATED_SYSTEM_TABLES) {
    if (await systemTableExists(runner, tableName)) {
      await executeRaw(tx, sql`DELETE FROM ${systemTableRef(tableName)} WHERE user_id = ${userId}`)
    }
  }
}

async function sweepAppTableAuthorship(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  appTableNames: readonly string[]
): Promise<void> {
  const authorshipTables = await authorshipColumnsByTable(tx, appTableNames)

  for (const [tableName, columns] of authorshipTables) {
    if (columns.has(AUTHORSHIP_FIELDS.CREATED_BY)) {
      await executeRaw(
        tx,
        sql`DELETE FROM ${sql.identifier(tableName)} WHERE ${sql.identifier(AUTHORSHIP_FIELDS.CREATED_BY)} = ${userId}`
      )
    }

    for (const column of SHED_AUTHORSHIP_FIELDS) {
      if (!columns.has(column)) continue
      await executeRaw(
        tx,
        sql`UPDATE ${sql.identifier(tableName)} SET ${sql.identifier(column)} = NULL WHERE ${sql.identifier(column)} = ${userId}`
      )
    }
  }
}

async function shedGrantIssuerIdentifier(
  tx: Readonly<DrizzleTransaction>,
  userId: string
): Promise<void> {
  const runner = tx as unknown as RawSqlRunner
  if (!(await systemTableExists(runner, 'user_access'))) return

  await executeRaw(
    tx,
    sql`UPDATE ${systemTableRef('user_access')} SET created_by = NULL WHERE created_by = ${userId}`
  )
}

async function deleteAiActivityRows(
  tx: Readonly<DrizzleTransaction>,
  userId: string,
  erasedEmail: string | undefined
): Promise<void> {
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('ai_activity_logs')}
        WHERE actor_type = 'user' AND actor_name = ${userId}`
  )

  if (erasedEmail === undefined) return
  await executeRaw(
    tx,
    sql`DELETE FROM ${systemTableRef('ai_activity_logs')}
        WHERE actor_type = 'user' AND (actor_name = ${erasedEmail} OR user_email = ${erasedEmail})`
  )
}

function buildPurgeAuditEntry(
  userId: string,
  erasedEmail: string | undefined
): Readonly<AuditLogEntry> {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action: AUDIT_ACTIONS.ACCOUNT_DELETION_PURGED,
    actor: {
      id: null,
      type: 'system',
      role: 'system',
    },
    resource: { type: 'user', id: userId },
    severity: 'critical',
    result: 'success',
    transport: 'api',
    metadata: {
      erasedUserId: userId,
      ...(erasedEmail ? { erasedEmail } : {}),
    },
  }
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

    await sweepAppTableAuthorship(tx, userId, appTableNames)

    await executeRaw(
      tx,
      sql`DELETE FROM ${systemTableRef('form_submissions')} WHERE submitter_user_id = ${userId}`
    )

    await executeRaw(
      tx,
      sql`DELETE FROM ${systemTableRef('record_comments')} WHERE user_id = ${userId}`
    )

    await deleteUserOwnedGatedSystemRows(tx, userId)

    await shedGrantIssuerIdentifier(tx, userId)

    await deleteAiActivityRows(tx, userId, erasedEmail)

    await executeRaw(
      tx,
      sql`DELETE FROM ${systemTableRef('_admin_search_index')}
          WHERE type = 'user' AND entity_id = ${userId}`
    )

    await executeRaw(
      tx,
      sql`DELETE FROM ${authTableRef('verification')}
          WHERE identifier IN (SELECT email FROM ${authTableRef('user')} WHERE id = ${userId})`
    )

    await executeRaw(tx, sql`DELETE FROM ${authTableRef('two_factor')} WHERE user_id = ${userId}`)
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('session')} WHERE user_id = ${userId}`)
    await executeRaw(tx, sql`DELETE FROM ${authTableRef('account')} WHERE user_id = ${userId}`)

    await appendAuditEntryToDbTx(tx, buildPurgeAuditEntry(userId, erasedEmail))

    await executeRaw(tx, sql`DELETE FROM ${authTableRef('user')} WHERE id = ${userId}`)
  })

  logInfo(`[account-purge] Hard-deleted account ${userId}`)
}

export async function purgeDueAccounts(appTableNames: readonly string[]): Promise<number> {
  const dueRows = (await executeRaw(
    db,
    sql`SELECT id FROM ${authTableRef('user')}
        WHERE "scheduledErasureAt" IS NOT NULL AND "scheduledErasureAt" <= ${sql.raw(nowEpochMsSqlLiteral())}`
  )) as unknown as readonly { id: string }[]

  for (const row of dueRows) {
    await purgeAccount(row.id, appTableNames)
  }

  return dueRows.length
}
