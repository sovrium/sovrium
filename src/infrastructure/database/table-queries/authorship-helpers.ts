/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { typedExecute } from './typed-execute'
import type { DrizzleTransaction } from '@/infrastructure/database'

/**
 * Authorship field names used across the system
 */
export const AUTHORSHIP_FIELDS = {
  CREATED_BY: 'created_by',
  UPDATED_BY: 'updated_by',
  DELETED_BY: 'deleted_by',
} as const

/**
 * Check if table has specific authorship columns
 * Queries information_schema once per transaction for efficiency
 *
 * @param tx - Database transaction
 * @param tableName - Table name
 * @param columnNames - Column names to check
 * @returns Set of existing column names
 */
async function checkAuthorshipColumns(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columnNames: readonly string[]
): Promise<Set<string>> {
  // Query information_schema for column existence
  const rows = await typedExecute<{ column_name: string }>(
    tx,
    sql.raw(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name IN (${columnNames.map((name) => `'${name}'`).join(', ')})`
    )
  )

  return new Set(rows.map((row) => row.column_name))
}

/**
 * Normalize user ID for database storage
 * Converts 'guest' to NULL for unauthenticated users
 *
 * @param userId - User ID from session
 * @returns Normalized user ID or NULL for guest users
 */
function normalizeUserIdForDb(userId: string | undefined): string | null {
  // eslint-disable-next-line unicorn/no-null -- NULL is intentional for database columns when no auth configured
  if (!userId || userId === 'guest') return null
  return userId
}

/**
 * Inject authorship fields into record for INSERT operations
 * Sets both created_by and updated_by to the same user ID on creation
 *
 * @param fields - Original record fields
 * @param userId - User ID from session
 * @param tx - Database transaction
 * @param tableName - Table name
 * @returns Fields with authorship metadata injected
 */
export async function injectCreateAuthorship(
  fields: Readonly<Record<string, unknown>>,
  userId: string | undefined,
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<Record<string, unknown>> {
  // Check which authorship columns exist
  const existingColumns = await checkAuthorshipColumns(tx, tableName, [
    AUTHORSHIP_FIELDS.CREATED_BY,
    AUTHORSHIP_FIELDS.UPDATED_BY,
  ])

  // Normalize user ID for database
  const authorUserId = normalizeUserIdForDb(userId)

  // Build fields object with authorship metadata (immutable)
  return {
    ...fields,
    ...(existingColumns.has(AUTHORSHIP_FIELDS.CREATED_BY)
      ? { [AUTHORSHIP_FIELDS.CREATED_BY]: authorUserId }
      : {}),
    ...(existingColumns.has(AUTHORSHIP_FIELDS.UPDATED_BY)
      ? { [AUTHORSHIP_FIELDS.UPDATED_BY]: authorUserId }
      : {}),
  }
}

/**
 * Inject updated_by field for UPDATE operations
 *
 * @param fields - Original record fields
 * @param userId - User ID from session
 * @param tx - Database transaction
 * @param tableName - Table name
 * @returns Fields with updated_by injected
 */
export async function injectUpdateAuthorship(
  fields: Readonly<Record<string, unknown>>,
  userId: string | undefined,
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<Record<string, unknown>> {
  // Check if updated_by column exists
  const existingColumns = await checkAuthorshipColumns(tx, tableName, [
    AUTHORSHIP_FIELDS.UPDATED_BY,
  ])

  const authorUserId = normalizeUserIdForDb(userId)

  return {
    ...fields,
    ...(existingColumns.has(AUTHORSHIP_FIELDS.UPDATED_BY)
      ? { [AUTHORSHIP_FIELDS.UPDATED_BY]: authorUserId }
      : {}),
  }
}

/**
 * Check if table has deleted_by column for soft delete authorship tracking
 *
 * @param tx - Database transaction
 * @param tableName - Table name
 * @returns True if deleted_by column exists
 */
export async function hasDeletedByColumn(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<boolean> {
  const existingColumns = await checkAuthorshipColumns(tx, tableName, [
    AUTHORSHIP_FIELDS.DELETED_BY,
  ])
  return existingColumns.has(AUTHORSHIP_FIELDS.DELETED_BY)
}

/**
 * Get normalized user ID for soft delete operations
 * Returns NULL for guest users, user ID otherwise
 *
 * @param userId - User ID from session
 * @returns Normalized user ID or NULL
 */
export function getDeletedByValue(userId: string | undefined): string | null {
  return normalizeUserIdForDb(userId)
}
