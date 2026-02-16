/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { SessionContextError, type DrizzleTransaction } from '@/infrastructure/database'
import { hasDeletedByColumn, getDeletedByValue } from './authorship-helpers'
import { validateTableName, validateColumnName } from './validation'

/**
 * Cascade soft delete to related records
 *
 * Helper function to cascade soft delete to child records based on onDelete: 'cascade' configuration
 */
// eslint-disable-next-line max-params, max-lines-per-function -- Cascade delete requires app config, userId, and complex conditional logic for deleted_by
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
): Promise<void> {
  if (!app.tables) return

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
  // eslint-disable-next-line functional/no-expression-statements -- Database updates for cascade delete are required side effects
  await Promise.all(
    relatedTables.map(async (relatedInfo) => {
      const childTable = relatedInfo.tableName
      const childColumn = relatedInfo.fieldName

      validateTableName(childTable)
      validateColumnName(childColumn)

      // Check if child table has deleted_at column
      const childColumnCheck = (await tx.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${childTable} AND column_name = 'deleted_at'`
      )) as readonly Record<string, unknown>[]

      if (childColumnCheck.length > 0) {
        // Check if child table has deleted_by column (using helper)
        const hasDeletedByCol = await hasDeletedByColumn(tx, childTable)

        // Cascade soft delete to related records with deleted_by if column exists
        if (hasDeletedByCol) {
          // eslint-disable-next-line functional/no-expression-statements -- Database update for cascade is required
          await tx.execute(
            sql`UPDATE ${sql.identifier(childTable)} SET deleted_at = NOW(), deleted_by = ${deletedByValue} WHERE ${sql.identifier(childColumn)} = ${recordId} AND deleted_at IS NULL`
          )
        } else {
          // eslint-disable-next-line functional/no-expression-statements -- Database update for cascade is required
          await tx.execute(
            sql`UPDATE ${sql.identifier(childTable)} SET deleted_at = NOW() WHERE ${sql.identifier(childColumn)} = ${recordId} AND deleted_at IS NULL`
          )
        }
      }
    })
  )
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

    const tableIdent = sql.identifier(tableName)

    // Build UPDATE query with or without deleted_by
    const result = hasDeletedByCol
      ? ((await tx.execute(
          sql`UPDATE ${tableIdent} SET deleted_at = NOW(), deleted_by = ${deletedByValue} WHERE id = ${recordId} AND deleted_at IS NULL RETURNING id`
        )) as readonly Record<string, unknown>[])
      : ((await tx.execute(
          sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id = ${recordId} AND deleted_at IS NULL RETURNING id`
        )) as readonly Record<string, unknown>[])

    return result.length > 0
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error)
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
    const tableIdent = sql.identifier(tableName)
    const result = (await tx.execute(
      sql`DELETE FROM ${tableIdent} WHERE id = ${recordId} RETURNING id`
    )) as readonly Record<string, unknown>[]
    return result.length > 0
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error)
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
    const columnCheck = (await tx.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
    )) as readonly Record<string, unknown>[]
    return columnCheck.length > 0
  } catch (error) {
    // eslint-disable-next-line functional/no-throw-statements -- Required for transaction error handling
    throw new SessionContextError(`Failed to check columns for ${tableName}`, error)
  }
}
