/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/table-repository'
import { SessionContextError } from '@/domain/errors'
import {
  computeGroupedAggregations,
  reshapeShortcutAggregations,
  type AggregateConfig,
} from './utils/aggregation-helpers'
import { formatFieldForDisplay } from './utils/display-formatter'
import { filterReadableFields } from './utils/field-read-filter'
import { processRecords, applyPagination } from './utils/list-helpers'
import { preserveIdType } from './utils/preserve-id-type'
import { transformRecord } from './utils/record-transformer'
import type { TransformedRecord } from './utils/record-transformer'
import type { UserSession } from '@/application/ports/models/user-session'
import type {
  ListRecordsResponse,
  GetRecordResponse,
  RestoreRecordResponse,
} from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'

// Re-export from table-operations
export {
  TableNotFoundError,
  createListTablesProgram,
  createGetTableProgram,
  createGetPermissionsProgram,
  listViewsProgram,
  getViewProgram,
  getViewRecordsProgram,
} from './table-operations'

// Re-export from batch-operations
export {
  batchCreateProgram,
  batchUpdateProgram,
  batchDeleteProgram,
  batchRestoreProgram,
  upsertProgram,
} from './batch-operations'

interface ListRecordsConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App
  readonly userRole: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly includeDeleted?: boolean
  readonly format?: 'display'
  readonly timezone?: string
  readonly sort?: string
  readonly fields?: string
  readonly limit?: number
  readonly offset?: number
  readonly aggregate?: AggregateConfig
  readonly groupBy?: string
}

function toGroupName(record: Readonly<Record<string, unknown>>, groupBy: string): string {
  const raw = record[groupBy]
  return raw === null || raw === undefined ? '' : String(raw)
}

function computeGroupCounts(
  records: readonly Readonly<Record<string, unknown>>[],
  groupBy: string
): ReadonlyMap<string, number> {
  return records.reduce<ReadonlyMap<string, number>>((acc, r) => {
    const name = toGroupName(r, groupBy)
    return new Map([...acc, [name, (acc.get(name) ?? 0) + 1]])
  }, new Map<string, number>())
}

function computeSimpleGroups(
  records: readonly Readonly<Record<string, unknown>>[],
  groupBy: string
): readonly { readonly name: string; readonly count: number }[] {
  return Array.from(computeGroupCounts(records, groupBy).entries()).map(([name, count]) => ({
    name,
    count,
  }))
}

function computeListRecordsAggregationBlock(params: {
  readonly repo: TableRepository['Type']
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly records: readonly Readonly<Record<string, unknown>>[]
  readonly filter?: ListRecordsConfig['filter']
  readonly includeDeleted?: boolean
  readonly aggregate: AggregateConfig
  readonly groupBy?: string
}) {
  return Effect.gen(function* () {
    const { repo, session, tableName, records, filter, includeDeleted, aggregate, groupBy } = params
    if (groupBy) {
      const aggregated = computeGroupedAggregations(records, groupBy, aggregate)
      const counts = computeGroupCounts(records, groupBy)
      const withCount = aggregated.map((g) => ({
        name: g.name,
        count: counts.get(g.name) ?? 0,
        aggregations: g.aggregations,
      }))
      return { groups: withCount }
    }
    const raw = yield* repo.computeAggregations({
      session,
      tableName,
      filter,
      includeDeleted,
      aggregate,
    })
    const aggregations = aggregate.shortcut ? reshapeShortcutAggregations(raw, aggregate) : raw
    return { aggregations }
  })
}

export function createListRecordsProgram(
  config: ListRecordsConfig
): Effect.Effect<ListRecordsResponse, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, app, userRole, filter, includeDeleted, aggregate, groupBy } = config
    const { format, timezone, sort, fields, limit, offset } = config

    const records = yield* repo.listRecords({ session, tableName, filter, includeDeleted, sort })
    const processedRecords = processRecords({
      records,
      app,
      tableName,
      userRole,
      format,
      timezone,
      fields,
    })
    const { paginatedRecords, pagination } = applyPagination(
      processedRecords,
      records.length,
      limit,
      offset
    )

    const aggBlock = aggregate
      ? yield* computeListRecordsAggregationBlock({
          repo,
          session,
          tableName,
          records,
          filter,
          includeDeleted,
          aggregate,
          groupBy,
        })
      : {}

    // When groupBy is specified without aggregate, compute simple name/count groups
    const simpleGroupsBlock =
      groupBy && !aggregate ? { groups: computeSimpleGroups(records, groupBy) } : {}

    return {
      records: [...paginatedRecords] as TransformedRecord[],
      pagination,
      ...aggBlock,
      ...simpleGroupsBlock,
    } as unknown as ListRecordsResponse
  })
}

interface ListTrashConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly app: App
  readonly userRole: string
  readonly filter?: {
    readonly and?: readonly {
      readonly field: string
      readonly operator: string
      readonly value: unknown
    }[]
  }
  readonly sort?: string
  readonly limit?: number
  readonly offset?: number
}

/**
 * Extract deletedBy user ID from a raw trash record.
 * The listTrash query joins auth.user and returns deleted_by_user object.
 * We extract only the user ID string to match the flat authorship format.
 */
function extractDeletedByUserId(rawRecord: Readonly<Record<string, unknown>>): string | undefined {
  const deletedByUser = rawRecord['deleted_by_user']
  if (!deletedByUser || typeof deletedByUser !== 'object') return undefined
  const userObj = deletedByUser as Record<string, unknown>
  if (!userObj['id']) return undefined
  return String(userObj['id'])
}

export function createListTrashProgram(
  config: ListTrashConfig
): Effect.Effect<ListRecordsResponse, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, app, userRole, filter, sort, limit, offset } = config

    // Query soft-deleted records with session context (RLS policies apply automatically)
    const records = yield* repo.listTrash({ session, tableName, filter, sort })

    // Process records (field-level filtering, transformations)
    const processedRecords = processRecords({
      records,
      app,
      tableName,
      userRole,
    })

    // Preserve numeric IDs and attach deletedBy user object from joined query results
    const recordsWithPreservedIds = processedRecords.map((record) => {
      // Try to parse ID as number if it's a numeric string, otherwise keep as-is
      const rawRecord = records.find((r) => String(r.id) === String(record.id))
      const originalId = rawRecord?.id
      const id = typeof originalId === 'number' ? originalId : record.id

      // Extract deletedBy user ID from the raw record's join result
      const deletedBy = rawRecord ? extractDeletedByUserId(rawRecord) : undefined

      return {
        ...record,
        id,
        ...(deletedBy ? { deletedBy } : {}),
      }
    })

    // Apply pagination
    const { paginatedRecords, pagination } = applyPagination(
      recordsWithPreservedIds,
      records.length,
      limit,
      offset
    )

    return {
      records: [...paginatedRecords] as TransformedRecord[],
      pagination,
    }
  })
}

interface GetRecordConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly userRole: string
  readonly includeDeleted?: boolean
  readonly format?: 'display'
}

export function createGetRecordProgram(
  config: GetRecordConfig
): Effect.Effect<GetRecordResponse, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { session, tableName, recordId, app, userRole, includeDeleted } = config

    const record = yield* repo.getRecord(session, tableName, recordId, includeDeleted)
    if (!record) return yield* Effect.fail(new SessionContextError('Record not found'))

    const filteredRecord = filterReadableFields({ app, tableName, userRole, record })
    const transformed = transformRecord(filteredRecord, { app, tableName, format: config.format })

    const fields =
      config.format === 'display'
        ? Object.fromEntries(
            Object.entries(transformed.fields).map(([k, v]) => {
              const isObj = typeof v === 'object' && v !== null && !Array.isArray(v)
              if (isObj && 'displayValue' in (v as object))
                return [k, (v as { displayValue: string }).displayValue]
              const r = formatFieldForDisplay({ fieldName: k, value: v, app, tableName })
              return [k, r ? r.displayValue : v]
            })
          )
        : transformed.fields

    // Preserve TEXT primary keys (e.g. scope tables in `auth.scopeTables`)
    // as strings; only coerce when the value *looks* numeric. Avoids NaN
    // for opaque string ids.
    const id = preserveIdType(record.id)

    // Spread fields at root level as flat aliases (same pattern as createRecordProgram).
    // Lets callers access record.fieldName in addition to record.fields.fieldName.
    return {
      ...fields,
      id,
      fields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    }
  })
}

interface CreateRecordConfig {
  readonly session: Readonly<UserSession>
  readonly tableName: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly app?: App
  readonly userRole?: string
}

export function createRecordProgram(config: CreateRecordConfig) {
  const { session, tableName, fields, app, userRole } = config
  return Effect.gen(function* () {
    const repo = yield* TableRepository

    // Create record with session context
    const record = yield* repo.createRecord(session, tableName, fields)

    const transformed = transformRecord(record)

    // Apply field-level read permissions filtering
    // If app and userRole are provided, filter fields based on permissions
    const filteredFields =
      app && userRole
        ? (() => {
            const filteredRecord = filterReadableFields({
              app,
              tableName,
              userRole,
              record,
            })

            // Transform filtered record to get only user fields (exclude system fields)
            const transformedFiltered = transformRecord(filteredRecord)
            return transformedFiltered.fields
          })()
        : transformed.fields

    // Return in format expected by tests: system fields at root, user fields
    // both nested (canonical) and at the root (flat alias). The flat alias
    // supports specs that read `record.file` instead of `record.fields.file`.
    return {
      ...filteredFields,
      id: transformed.id,
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    }
  })
}

export function updateRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  params: {
    readonly fields: Readonly<Record<string, unknown>>
    readonly app?: App
    readonly userRole?: string
  }
) {
  return Effect.gen(function* () {
    const repo = yield* TableRepository

    // Update record with session context (RLS policies enforce access control)
    const record = yield* repo.updateRecord(session, tableName, recordId, {
      fields: params.fields,
      app: params.app,
    })

    // Transform with app context to include table-specific fields like created_at/updated_at
    const transformed = transformRecord(record, { app: params.app, tableName })

    // Apply field-level read permissions filtering
    // If app and userRole are provided, filter fields based on permissions
    const filteredFields =
      params.app && params.userRole
        ? (() => {
            const filteredRecord = filterReadableFields({
              app: params.app!,
              tableName,
              userRole: params.userRole!,
              record,
            })

            // Transform filtered record to get only user fields (exclude system fields)
            const transformedFiltered = transformRecord(filteredRecord, {
              app: params.app,
              tableName,
            })
            return transformedFiltered.fields
          })()
        : transformed.fields

    // Return in format expected by tests: system fields at root, user fields
    // both nested (canonical) and at the root (flat alias). Mirrors the
    // create-record response so PATCH and POST share the same envelope.
    // Preserve original ID type (number if it was number in database).
    const originalId = record.id
    return {
      ...filteredFields,
      id: typeof originalId === 'number' ? originalId : transformed.id,
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
      ...(transformed.createdBy ? { createdBy: transformed.createdBy } : {}),
      ...(transformed.updatedBy ? { updatedBy: transformed.updatedBy } : {}),
      ...(transformed.deletedBy ? { deletedBy: transformed.deletedBy } : {}),
    }
  })
}

export function restoreRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<RestoreRecordResponse, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const record = yield* repo.restoreRecord(session, tableName, recordId)
    // Special error marker for non-deleted records (vs. missing rows).
    if (record && '_error' in record && record._error === 'not_deleted')
      return yield* Effect.fail(new SessionContextError('Record is not deleted'))
    if (!record) return yield* Effect.fail(new SessionContextError('Record not found'))
    return { success: true as const, record: transformRecord(record) }
  })
}

/** Raw record retrieval (no permission filtering) — used for internal checks. */
export function rawGetRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.getRecord(session, tableName, recordId)
  })
}

/** Soft-delete a record. Wraps Infrastructure for layer architecture. */
export function deleteRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string,
  app?: App
): Effect.Effect<
  { success: boolean; setNullPerformed: boolean; restrictViolation: boolean },
  SessionContextError,
  TableRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.deleteRecord(session, tableName, recordId, app)
  })
}

/** Permanently delete a record. Wraps Infrastructure for layer architecture. */
export function permanentlyDeleteRecordProgram(
  session: Readonly<UserSession>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, SessionContextError, TableRepository> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    return yield* repo.permanentlyDeleteRecord(session, tableName, recordId)
  })
}
