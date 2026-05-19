/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { sanitizeTableName } from '@/domain/utils/table-naming'
import { db } from '@/infrastructure/database'
import { AUTHORSHIP_FIELDS } from '@/infrastructure/database/table-queries/mutation-helpers/authorship-helpers'
import { logInfo } from '@/infrastructure/logging/logger'
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

  const nameList = sql.join(
    sanitized.map((name) => sql`${name}`),
    sql`, `
  )
  const rows = (await tx.execute(
    sql`SELECT DISTINCT table_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = ${AUTHORSHIP_FIELDS.CREATED_BY}
          AND table_name IN (${nameList})`
  )) as unknown as readonly { table_name: string }[]

  return rows.map((row) => row.table_name)
}

export async function purgeAccount(
  userId: string,
  appTableNames: readonly string[]
): Promise<void> {
  await db.transaction(async (tx) => {
    const recordTables = await tablesWithCreatedBy(tx, appTableNames)
    for (const tableName of recordTables) {
      await tx.execute(
        sql`DELETE FROM ${sql.identifier(tableName)} WHERE ${sql.identifier(AUTHORSHIP_FIELDS.CREATED_BY)} = ${userId}`
      )
    }

    await tx.execute(
      sql`DELETE FROM auth.verification
          WHERE identifier IN (SELECT email FROM auth.user WHERE id = ${userId})`
    )

    await tx.execute(sql`DELETE FROM auth.two_factor WHERE user_id = ${userId}`)
    await tx.execute(sql`DELETE FROM auth.session WHERE user_id = ${userId}`)
    await tx.execute(sql`DELETE FROM auth.account WHERE user_id = ${userId}`)

    await tx.execute(sql`DELETE FROM auth.user WHERE id = ${userId}`)

    await tx.execute(
      sql`INSERT INTO audit_log (action, actor_id) VALUES ('account.deletion.completed', ${userId})`
    )
  })

  logInfo(`[account-purge] Hard-deleted account ${userId}`)
}

export async function purgeDueAccounts(appTableNames: readonly string[]): Promise<number> {
  const dueRows = (await db.execute(
    sql`SELECT id FROM auth.user
        WHERE "scheduledErasureAt" IS NOT NULL AND "scheduledErasureAt" <= NOW()`
  )) as unknown as readonly { id: string }[]

  for (const row of dueRows) {
    await purgeAccount(row.id, appTableNames)
  }

  return dueRows.length
}
