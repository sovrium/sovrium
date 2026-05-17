/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { db } from '@/infrastructure/database/drizzle'

/**
 * Check if any records exist in database based on merge fields
 *
 * Used by upsert operations to determine whether records will be
 * created or updated, which affects permission checks.
 *
 * @param tableName - Sanitized table name
 * @param records - Records with field values to check
 * @param fieldsToMergeOn - Field names to match against
 * @returns true if any matching records exist
 */
export async function checkForExistingRecords(
  tableName: string,
  records: readonly { fields: Record<string, unknown> }[],
  fieldsToMergeOn: readonly string[]
): Promise<boolean> {
  // Build WHERE clause - skip records missing merge fields (will fail validation)
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

  // If no valid records to check, return false
  if (mergeConditions.length === 0) return false

  const whereClause = sql.join(mergeConditions, sql` OR `)
  const existingRecords = (await db.execute(
    sql`SELECT COUNT(*) as count FROM ${sql.identifier(tableName)} WHERE ${whereClause}`
  )) as readonly Record<string, unknown>[]

  const firstRecord = existingRecords[0]
  return firstRecord !== undefined && Number(firstRecord.count) > 0
}
