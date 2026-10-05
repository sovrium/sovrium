/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { db } from '@/infrastructure/database/drizzle'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '../statement/validation'

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
  const existingRecords = await executeRaw(
    db,
    sql`SELECT COUNT(*) as count FROM ${tableIdentifier(tableName)} WHERE ${whereClause}`
  )

  const firstRecord = existingRecords[0]
  return firstRecord !== undefined && toFiniteCount(firstRecord.count) > 0
}

/**
 * The ids of every row an upsert record would merge onto — each row whose merge
 * fields equal the record's. Empty when the record lacks a merge field (the
 * upsert refuses it) or when no row matches, so the record would be created.
 *
 * Every matching row is returned, not the first: the upsert updates one of
 * them, and the row-level gate that reads this must judge whichever it is.
 */
export async function findRecordIdsByMergeFields(
  tableName: string,
  fields: Readonly<Record<string, unknown>>,
  fieldsToMergeOn: readonly string[]
): Promise<readonly string[]> {
  if (fieldsToMergeOn.length === 0) return []
  if (!fieldsToMergeOn.every((fieldName) => fields[fieldName] !== undefined)) return []
  const conditions = fieldsToMergeOn.map(
    (fieldName) => sql`${sql.identifier(fieldName)} = ${fields[fieldName]}`
  )
  const rows = await executeRaw(
    db,
    sql`SELECT id FROM ${tableIdentifier(tableName)} WHERE ${sql.join(conditions, sql` AND `)}`
  )
  return rows.map((row) => String(row.id))
}
