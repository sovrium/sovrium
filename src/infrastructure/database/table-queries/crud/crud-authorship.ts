/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { authUserTableRef } from '@/infrastructure/database/sql/dialect-sql'

/**
 * The authorship join of a trash read: the SELECT list naming the creator,
 * updater and deleter of each row, the LEFT JOINs onto the user table that
 * supply them, and the mapping that folds the flat columns into user objects.
 */

/**
 * Build SELECT field list for authorship columns
 */
export function buildAuthorshipSelectFields(authorshipColumns: {
  readonly hasCreatedBy: boolean
  readonly hasUpdatedBy: boolean
  readonly hasDeletedBy: boolean
}): readonly string[] {
  const createdByFields = authorshipColumns.hasCreatedBy
    ? [
        'created_by_user.id AS "createdByUserId"',
        'created_by_user.name AS "createdByUserName"',
        'created_by_user.email AS "createdByUserEmail"',
      ]
    : []

  const updatedByFields = authorshipColumns.hasUpdatedBy
    ? [
        'updated_by_user.id AS "updatedByUserId"',
        'updated_by_user.name AS "updatedByUserName"',
        'updated_by_user.email AS "updatedByUserEmail"',
      ]
    : []

  const deletedByFields = authorshipColumns.hasDeletedBy
    ? [
        'deleted_by_user.id AS "deletedByUserId"',
        'deleted_by_user.name AS "deletedByUserName"',
        'deleted_by_user.email AS "deletedByUserEmail"',
      ]
    : []

  return ['t.*', ...createdByFields, ...updatedByFields, ...deletedByFields]
}

/**
 * Build query with conditional JOINs for authorship tables
 */
export function buildAuthorshipJoins(
  baseQuery: Readonly<ReturnType<typeof sql>>,
  authorshipColumns: {
    readonly hasCreatedBy: boolean
    readonly hasUpdatedBy: boolean
    readonly hasDeletedBy: boolean
  }
): Readonly<ReturnType<typeof sql>> {
  const authUser = authUserTableRef()
  const queryWithCreatedBy = authorshipColumns.hasCreatedBy
    ? sql`${baseQuery} LEFT JOIN ${authUser} created_by_user ON t.created_by = created_by_user.id`
    : baseQuery

  const queryWithUpdatedBy = authorshipColumns.hasUpdatedBy
    ? sql`${queryWithCreatedBy} LEFT JOIN ${authUser} updated_by_user ON t.updated_by = updated_by_user.id`
    : queryWithCreatedBy

  const queryWithDeletedBy = authorshipColumns.hasDeletedBy
    ? sql`${queryWithUpdatedBy} LEFT JOIN ${authUser} deleted_by_user ON t.deleted_by = deleted_by_user.id`
    : queryWithUpdatedBy

  return queryWithDeletedBy
}

/**
 * Transform row data to include user objects for authorship fields
 */
export function transformRowWithAuthorship(
  row: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const {
    createdByUserId,
    createdByUserName,
    createdByUserEmail,
    updatedByUserId,
    updatedByUserName,
    updatedByUserEmail,
    deletedByUserId,
    deletedByUserName,
    deletedByUserEmail,
    ...recordFields
  } = row

  const createdByUser =
    createdByUserId !== null && createdByUserId !== undefined
      ? {
          id: createdByUserId as string,
          name: createdByUserName as string | undefined,
          email: createdByUserEmail as string | undefined,
        }
      : undefined

  const updatedByUser =
    updatedByUserId !== null && updatedByUserId !== undefined
      ? {
          id: updatedByUserId as string,
          name: updatedByUserName as string | undefined,
          email: updatedByUserEmail as string | undefined,
        }
      : undefined

  const deletedByUser =
    deletedByUserId !== null && deletedByUserId !== undefined
      ? {
          id: deletedByUserId as string,
          name: deletedByUserName as string | undefined,
          email: deletedByUserEmail as string | undefined,
        }
      : undefined

  return {
    ...recordFields,
    ...(createdByUser ? { created_by_user: createdByUser } : {}),
    ...(updatedByUser ? { updated_by_user: updatedByUser } : {}),
    ...(deletedByUser ? { deleted_by_user: deletedByUser } : {}),
  }
}
