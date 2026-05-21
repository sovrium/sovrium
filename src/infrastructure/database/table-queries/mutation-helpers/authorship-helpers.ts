/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { getExistingColumnNames } from '@/infrastructure/database/sql/dialect-introspection'
import type { DrizzleTransaction } from '@/infrastructure/database'

export const AUTHORSHIP_FIELDS = {
  CREATED_BY: 'created_by',
  UPDATED_BY: 'updated_by',
  DELETED_BY: 'deleted_by',
} as const

async function checkAuthorshipColumns(
  tx: Readonly<DrizzleTransaction>,
  tableName: string,
  columnNames: readonly string[]
): Promise<ReadonlySet<string>> {
  return getExistingColumnNames(tx, tableName, columnNames)
}

function normalizeUserIdForDb(userId: string | undefined): string | null {
  if (!userId || userId === 'guest') return null
  return userId
}

export async function injectCreateAuthorship(
  fields: Readonly<Record<string, unknown>>,
  userId: string | undefined,
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<Record<string, unknown>> {
  const existingColumns = await checkAuthorshipColumns(tx, tableName, [
    AUTHORSHIP_FIELDS.CREATED_BY,
    AUTHORSHIP_FIELDS.UPDATED_BY,
  ])

  const authorUserId = normalizeUserIdForDb(userId)

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

export async function injectUpdateAuthorship(
  fields: Readonly<Record<string, unknown>>,
  userId: string | undefined,
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<Record<string, unknown>> {
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

export async function hasDeletedByColumn(
  tx: Readonly<DrizzleTransaction>,
  tableName: string
): Promise<boolean> {
  const existingColumns = await checkAuthorshipColumns(tx, tableName, [
    AUTHORSHIP_FIELDS.DELETED_BY,
  ])
  return existingColumns.has(AUTHORSHIP_FIELDS.DELETED_BY)
}

export function getDeletedByValue(userId: string | undefined): string | null {
  return normalizeUserIdForDb(userId)
}
