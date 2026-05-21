/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { db } from '@/infrastructure/database'
import { authUserTableRef } from '@/infrastructure/database/sql/dialect-sql'
import {
  buildAggregationSelects,
  parseAggregationResult,
  buildOrderByClause,
  buildWhereClause,
  checkDeletedAtColumn as checkDeletedAtColumnHelper,
  checkAuthorshipColumns,
} from '../query-helpers/aggregation-helpers'
import { buildTrashFilters, addTrashSorting } from '../query-helpers/trash-helpers'
import { wrapDatabaseError } from '../shared/error-handling'
import { typedExecute } from '../shared/typed-execute'
import { validateTableName } from '../shared/validation'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type { SessionContextError } from '@/infrastructure/database'

export function listRecords(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly table?: { readonly permissions?: { readonly organizationScoped?: boolean } }
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly includeDeleted?: boolean
  readonly sort?: string
  readonly app?: {
    readonly tables?: readonly { readonly name: string; readonly fields: readonly unknown[] }[]
  }
}): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  const { tableName, filter, includeDeleted, sort, app } = config
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))

        const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
        const orderByClause = buildOrderByClause(sort, app, tableName)

        return await typedExecute(
          tx,
          sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause}${orderByClause}`
        )
      }),
    catch: wrapDatabaseError(`Failed to list records from ${tableName}`),
  })
}


export function computeAggregations(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly includeDeleted?: boolean
  readonly aggregate: {
    readonly count?: boolean
    readonly sum?: readonly string[]
    readonly avg?: readonly string[]
    readonly min?: readonly string[]
    readonly max?: readonly string[]
  }
}): Effect.Effect<
  {
    readonly count?: string
    readonly sum?: Record<string, number>
    readonly avg?: Record<string, number>
    readonly min?: Record<string, number>
    readonly max?: Record<string, number>
  },
  SessionContextError
> {
  const { tableName, filter, includeDeleted, aggregate } = config
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)
        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))
        const whereClause = buildWhereClause(hasDeletedAt, includeDeleted, filter)
        const aggregationSelects = buildAggregationSelects(aggregate)
        if (aggregationSelects.length === 0) return {}

        const selectClause = sql.raw(aggregationSelects.join(', '))
        const rows = await typedExecute(
          tx,
          sql`SELECT ${selectClause} FROM ${sql.identifier(tableName)}${whereClause}`
        )
        if (rows.length === 0) return {}

        return parseAggregationResult(rows[0]!, aggregate)
      }),
    catch: wrapDatabaseError(`Failed to compute aggregations from ${tableName}`),
  })
}

function buildAuthorshipSelectFields(authorshipColumns: {
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

function buildAuthorshipJoins(
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

function transformRowWithAuthorship(
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

export function listTrash(config: {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly sort?: string
}): Effect.Effect<readonly Record<string, unknown>[], SessionContextError> {
  const { tableName, filter, sort } = config
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))

        if (!hasDeletedAt) {
          return [] as readonly Record<string, unknown>[]
        }

        const authorshipColumns = await Effect.runPromise(checkAuthorshipColumns(tx, tableName))

        const selectFields = buildAuthorshipSelectFields(authorshipColumns)
        const selectClause = sql.raw(selectFields.join(', '))
        const initialQuery = sql`SELECT ${selectClause} FROM ${sql.identifier(tableName)} t`

        const queryWithJoins = buildAuthorshipJoins(initialQuery, authorshipColumns)
        const queryWithWhere = sql`${queryWithJoins} WHERE t.deleted_at IS NOT NULL`
        const queryWithFilters = buildTrashFilters(queryWithWhere, filter?.and)
        const query = addTrashSorting(queryWithFilters, sort)

        const rows = await typedExecute(tx, query)

        return rows.map(transformRowWithAuthorship)
      }),
    catch: wrapDatabaseError(`Failed to list trash from ${tableName}`),
  })
}

export function getRecord(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  includeDeleted?: boolean
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return Effect.tryPromise({
    try: () =>
      db.transaction(async (tx) => {
        validateTableName(tableName)

        const hasDeletedAt = await Effect.runPromise(checkDeletedAtColumnHelper(tx, tableName))

        const whereClause =
          hasDeletedAt && !includeDeleted
            ? sql` WHERE id = ${recordId} AND deleted_at IS NULL`
            : sql` WHERE id = ${recordId}`

        const rows = await typedExecute(
          tx,
          sql`SELECT * FROM ${sql.identifier(tableName)}${whereClause} LIMIT 1`
        )

        return rows[0] ?? null
      }),
    catch: wrapDatabaseError(`Failed to get record ${recordId} from ${tableName}`),
  })
}
