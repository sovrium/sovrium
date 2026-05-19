/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database/drizzle'

export async function checkForExistingRecords(
  tableName: string,
  records: readonly { fields: Record<string, unknown> }[],
  fieldsToMergeOn: readonly string[]
): Promise<boolean> {
  const mergeConditions = records
    .filter((record) =>
      fieldsToMergeOn.every((fieldName) => record.fields[fieldName] !== undefined)
    )
    .map((record) => {
      const conditions = fieldsToMergeOn.map((fieldName) => {
        const value = record.fields[fieldName]
        return sql`${sql.identifier(fieldName)} = ${value}`
      })
      return conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1=0`
    })

  if (mergeConditions.length === 0) return false

  const whereClause = sql.join(mergeConditions, sql` OR `)
  const existingRecords = (await db.execute(
    sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)} WHERE ${whereClause}`
  )) as readonly Record<string, unknown>[]

  const firstRecord = existingRecords[0]
  return firstRecord !== undefined && Number(firstRecord.count) > 0
}
