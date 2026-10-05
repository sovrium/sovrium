/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { DatabaseError } from '@/domain/errors'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { columnExists } from '@/infrastructure/database/sql/dialect-introspection'
import { nowExpr } from '@/infrastructure/database/sql/dialect-sql'
import { validateColumnName, tableIdentifier, databaseTableName } from '../statement/validation'
import { hasDeletedByColumn, getDeletedByValue } from './authorship-helpers'
import type { CommittedRowChange } from '@/application/ports/services/record-change-feed'
import type { DrizzleTransaction } from '@/infrastructure/database/drizzle/db'

/**
 * Cascade soft delete to related records
 *
 * Soft-deletes the child records of every table whose relationship field
 * references this table with `onDelete: 'cascade'`, and returns each child row
 * it removed (`RETURNING *`, on both dialects) so the delete can announce them
 * on their own table's change stream once it commits.
 */
export async function cascadeSoftDelete(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  app: {
    readonly tables?: ReadonlyArray<{
      readonly name: string
      readonly fields: ReadonlyArray<{
        readonly name: string
        readonly type: string
        readonly relatedTable?: string
        readonly onDelete?: string
      }>
    }>
  },
  userId?: string
): Promise<readonly CommittedRowChange[]> {
  if (!app.tables) return []

  // Find all tables with relationship fields that reference this table with onDelete: 'cascade'
  const relatedTables = app.tables.flatMap((table) =>
    table.fields
      .filter(
        (field) =>
          field.type === 'relationship' &&
          field.relatedTable === tableName &&
          field.onDelete === 'cascade'
      )
      .map((field) => ({
        tableName: table.name,
        fieldName: field.name,
      }))
  )

  const deletedByValue = getDeletedByValue(userId)

  // Cascade soft delete to each related table
  const removed = await Promise.all(
    relatedTables.map(async (relatedInfo) => {
      const childTable = relatedInfo.tableName
      const childColumn = relatedInfo.fieldName

      validateColumnName(childColumn)

      // Check if child table has deleted_at column (dialect-aware introspection)
      const childHasDeletedAt = await columnExists(tx, databaseTableName(childTable), 'deleted_at')
      if (!childHasDeletedAt) return []

      // Check if child table has deleted_by column (using helper)
      const hasDeletedByCol = await hasDeletedByColumn(tx, childTable)

      // Cascade soft delete to related records with deleted_by if column exists
      const rows = hasDeletedByCol
        ? await executeRaw(
            tx,
            sql`UPDATE ${tableIdentifier(childTable)} SET deleted_at = ${nowExpr()}, deleted_by = ${deletedByValue} WHERE ${sql.identifier(childColumn)} = ${recordId} AND deleted_at IS NULL RETURNING *`
          )
        : await executeRaw(
            tx,
            sql`UPDATE ${tableIdentifier(childTable)} SET deleted_at = ${nowExpr()} WHERE ${sql.identifier(childColumn)} = ${recordId} AND deleted_at IS NULL RETURNING *`
          )
      return rows.map((row): CommittedRowChange => ({
        tableName: childTable,
        event: 'delete',
        recordId: String(row['id']),
        previous: row,
      }))
    })
  )
  return removed.flat()
}

/**
 * Cascade set-null to related records
 *
 * Sets the FK column to NULL in the child records of every table whose
 * relationship field references this table with `onDelete: 'set-null'`, and
 * returns each live child row it changed (`RETURNING *`) with the row as it
 * stood, so the delete can announce them as updates on their own table.
 */
export async function cascadeSetNull(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  app: {
    readonly tables?: ReadonlyArray<{
      readonly name: string
      readonly fields: ReadonlyArray<{
        readonly name: string
        readonly type: string
        readonly relatedTable?: string
        readonly onDelete?: string
      }>
    }>
  }
): Promise<{ readonly performed: boolean; readonly changes: readonly CommittedRowChange[] }> {
  if (!app.tables) return { performed: false, changes: [] }

  // Find all tables with relationship fields that reference this table with onDelete: 'set-null'
  const relatedTables = app.tables.flatMap((table) =>
    table.fields
      .filter(
        (field) =>
          field.type === 'relationship' &&
          field.relatedTable === tableName &&
          field.onDelete === 'set-null'
      )
      .map((field) => ({
        tableName: table.name,
        fieldName: field.name,
      }))
  )

  if (relatedTables.length === 0) return { performed: false, changes: [] }

  // Set FK to NULL in each related table
  const changed = await Promise.all(
    relatedTables.map(async (relatedInfo) => {
      const childTable = relatedInfo.tableName
      const childColumn = relatedInfo.fieldName

      validateColumnName(childColumn)

      const rows = await executeRaw(
        tx,
        sql`UPDATE ${tableIdentifier(childTable)} SET ${sql.identifier(childColumn)} = NULL WHERE ${sql.identifier(childColumn)} = ${recordId} RETURNING *`
      )
      // A child already in the trash is not on anyone's live view.
      return rows
        .filter((row) => row['deleted_at'] === undefined || row['deleted_at'] === null)
        .map((row): CommittedRowChange => ({
          tableName: childTable,
          event: 'update',
          recordId: String(row['id']),
          row,
          previous: { ...row, [childColumn]: recordId },
        }))
    })
  )

  return { performed: true, changes: changed.flat() }
}

/**
 * Check restrict-on-delete constraint for related records.
 *
 * Returns true if any child records exist whose `relationship` field on
 * `tableName` is configured with `onDelete: 'restrict'`. Caller (`deleteRecord`)
 * surfaces this as `restrictViolation: true` so the route handler can return
 * HTTP 400 instead of attempting the delete.
 */
export async function checkRestrictConstraint(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  app: {
    readonly tables?: ReadonlyArray<{
      readonly name: string
      readonly fields: ReadonlyArray<{
        readonly name: string
        readonly type: string
        readonly relatedTable?: string
        readonly onDelete?: string
      }>
    }>
  }
): Promise<boolean> {
  if (!app.tables) return false

  const restrictedTables = app.tables.flatMap((table) =>
    table.fields
      .filter(
        (field) =>
          field.type === 'relationship' &&
          field.relatedTable === tableName &&
          field.onDelete === 'restrict'
      )
      .map((field) => ({ tableName: table.name, fieldName: field.name }))
  )

  if (restrictedTables.length === 0) return false

  const hasChildrenResults = await Promise.all(
    restrictedTables.map(async (relatedInfo) => {
      validateColumnName(relatedInfo.fieldName)

      const result = await executeRaw(
        tx,
        sql`SELECT COUNT(*) as count FROM ${tableIdentifier(relatedInfo.tableName)} WHERE ${sql.identifier(relatedInfo.fieldName)} = ${recordId}`
      )

      return toFiniteCount(result[0]?.count) > 0
    })
  )

  return hasChildrenResults.some(Boolean)
}

/**
 * Execute soft delete operation
 * Promise-based for transaction use
 */
export async function executeSoftDelete(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  userId?: string
): Promise<boolean> {
  try {
    // Check if table has deleted_by column using helper
    const hasDeletedByCol = await hasDeletedByColumn(tx, tableName)
    const deletedByValue = getDeletedByValue(userId)

    const tableIdent = tableIdentifier(tableName)

    // Build UPDATE query with or without deleted_by
    const result = hasDeletedByCol
      ? await executeRaw(
          tx,
          sql`UPDATE ${tableIdent} SET deleted_at = ${nowExpr()}, deleted_by = ${deletedByValue} WHERE id = ${recordId} AND deleted_at IS NULL RETURNING id`
        )
      : await executeRaw(
          tx,
          sql`UPDATE ${tableIdent} SET deleted_at = ${nowExpr()} WHERE id = ${recordId} AND deleted_at IS NULL RETURNING id`
        )

    return result.length > 0
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new DatabaseError(`Failed to delete record ${recordId} from ${tableName}`, error)
  }
}

/**
 * Execute hard delete operation
 * Promise-based for transaction use
 */
export async function executeHardDelete(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Promise<boolean> {
  try {
    const tableIdent = tableIdentifier(tableName)
    const result = await executeRaw(
      tx,
      sql`DELETE FROM ${tableIdent} WHERE id = ${recordId} RETURNING id`
    )
    return result.length > 0
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new DatabaseError(`Failed to delete record ${recordId} from ${tableName}`, error)
  }
}

/**
 * Check if table has deleted_at column for soft delete support
 * Promise-based for transaction use
 */
export async function checkDeletedAtColumn(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<boolean> {
  try {
    return await columnExists(tx, databaseTableName(tableName), 'deleted_at')
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new DatabaseError(`Failed to check columns for ${tableName}`, error)
  }
}
