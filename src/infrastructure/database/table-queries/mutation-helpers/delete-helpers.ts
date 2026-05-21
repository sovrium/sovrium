/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { SessionContextError } from '@/domain/errors'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { columnExists } from '@/infrastructure/database/sql/dialect-introspection'
import { nowExpr } from '@/infrastructure/database/sql/dialect-sql'
import { validateTableName, validateColumnName } from '../shared/validation'
import { hasDeletedByColumn, getDeletedByValue } from './authorship-helpers'
import type { DrizzleTransaction } from '@/infrastructure/database/drizzle/db'

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

  await Promise.all(
    relatedTables.map(async (relatedInfo) => {
      const childTable = relatedInfo.tableName
      const childColumn = relatedInfo.fieldName

      validateTableName(childTable)
      validateColumnName(childColumn)

      const childHasDeletedAt = await columnExists(tx, childTable, 'deleted_at')

      if (childHasDeletedAt) {
        const hasDeletedByCol = await hasDeletedByColumn(tx, childTable)

        if (hasDeletedByCol) {
          await executeRaw(
            tx,
            sql`UPDATE ${sql.identifier(childTable)} SET deleted_at = ${nowExpr()}, deleted_by = ${deletedByValue} WHERE ${sql.identifier(childColumn)} = ${recordId} AND deleted_at IS NULL`
          )
        } else {
          await executeRaw(
            tx,
            sql`UPDATE ${sql.identifier(childTable)} SET deleted_at = ${nowExpr()} WHERE ${sql.identifier(childColumn)} = ${recordId} AND deleted_at IS NULL`
          )
        }
      }
    })
  )
}

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
): Promise<boolean> {
  if (!app.tables) return false

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

  if (relatedTables.length === 0) return false

  await Promise.all(
    relatedTables.map(async (relatedInfo) => {
      const childTable = relatedInfo.tableName
      const childColumn = relatedInfo.fieldName

      validateTableName(childTable)
      validateColumnName(childColumn)

      await executeRaw(
        tx,
        sql`UPDATE ${sql.identifier(childTable)} SET ${sql.identifier(childColumn)} = NULL WHERE ${sql.identifier(childColumn)} = ${recordId}`
      )
    })
  )

  return true
}

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
      validateTableName(relatedInfo.tableName)
      validateColumnName(relatedInfo.fieldName)

      const result = await executeRaw(
        tx,
        sql`SELECT COUNT(*) as count FROM ${sql.identifier(relatedInfo.tableName)} WHERE ${sql.identifier(relatedInfo.fieldName)} = ${recordId}`
      )

      return Number(result[0]?.count ?? 0) > 0
    })
  )

  return hasChildrenResults.some(Boolean)
}

export async function executeSoftDelete(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string,
  userId?: string
): Promise<boolean> {
  try {
    const hasDeletedByCol = await hasDeletedByColumn(tx, tableName)
    const deletedByValue = getDeletedByValue(userId)

    const tableIdent = sql.identifier(tableName)

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
    throw new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error)
  }
}

export async function executeHardDelete(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  recordId: string
): Promise<boolean> {
  try {
    const tableIdent = sql.identifier(tableName)
    const result = await executeRaw(
      tx,
      sql`DELETE FROM ${tableIdent} WHERE id = ${recordId} RETURNING id`
    )
    return result.length > 0
  } catch (error) {
    throw new SessionContextError(`Failed to delete record ${recordId} from ${tableName}`, error)
  }
}

export async function checkDeletedAtColumn(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<boolean> {
  try {
    return await columnExists(tx, tableName, 'deleted_at')
  } catch (error) {
    throw new SessionContextError(`Failed to check columns for ${tableName}`, error)
  }
}
