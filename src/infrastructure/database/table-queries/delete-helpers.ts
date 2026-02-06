/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { SessionContextError, type DrizzleTransaction } from '@/infrastructure/database'
import { validateTableName, validateColumnName } from './validation'

/**
 * Cascade soft delete to related records
 *
 * Helper function to cascade soft delete to child records based on onDelete: 'cascade' configuration
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
  }
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
        // Cascade soft delete to related records
        // eslint-disable-next-line functional/no-expression-statements -- Database update for cascade is required
        await tx.execute(
          sql`UPDATE ${sql.identifier(childTable)} SET deleted_at = NOW() WHERE ${sql.identifier(childColumn)} = ${recordId} AND deleted_at IS NULL`
        )
      }
    })
  )
}

/**
 * Fetch record before deletion for activity logging
 */
export function fetchRecordBeforeDeletion(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | undefined, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const tableIdent = sql.identifier(tableName)
      const recordBefore = (await tx.execute(
        sql`SELECT * FROM ${tableIdent} WHERE id = ${recordId} LIMIT 1`
      )) as readonly Record<string, unknown>[]
      return recordBefore[0]
    },
    catch: (error) => new SessionContextError(`Failed to fetch record before deletion`, error),
  })
}

/**
 * Execute soft delete operation
 */
export function executeSoftDelete(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const tableIdent = sql.identifier(tableName)
      const result = (await tx.execute(
        sql`UPDATE ${tableIdent} SET deleted_at = NOW() WHERE id = ${recordId} AND deleted_at IS NULL RETURNING id`
      )) as readonly Record<string, unknown>[]
      return result.length > 0
    },
    catch: (error) =>
      new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error),
  })
}

/**
 * Execute hard delete operation
 */
export function executeHardDelete(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const tableIdent = sql.identifier(tableName)
      const result = (await tx.execute(
        sql`DELETE FROM ${tableIdent} WHERE id = ${recordId} RETURNING id`
      )) as readonly Record<string, unknown>[]
      return result.length > 0
    },
    catch: (error) =>
      new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error),
  })
}

/**
 * Check if table has deleted_at column for soft delete support
 */
export function checkDeletedAtColumn(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Effect.Effect<boolean, SessionContextError> {
  return Effect.tryPromise({
    try: async () => {
      const columnCheck = (await tx.execute(
        sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${tableName} AND column_name = 'deleted_at'`
      )) as readonly Record<string, unknown>[]
      return columnCheck.length > 0
    },
    catch: (error) => new SessionContextError(`Failed to check columns for ${tableName}`, error),
  })
}
