/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { SessionContextError } from '@/infrastructure/database/session-context'
import {
  listRecords,
  listTrash,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  permanentlyDeleteRecord,
  restoreRecord,
  computeAggregations,
} from '@/infrastructure/database/table-queries'
import { filterReadableFields } from './utils/field-read-filter'
import { processRecords, applyPagination } from './utils/list-helpers'
import { transformRecord } from './utils/record-transformer'
import type { TransformedRecord } from './utils/record-transformer'
import type { App } from '@/domain/models/app'
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type {
  ListRecordsResponse,
  GetRecordResponse,
  RestoreRecordResponse,
} from '@/presentation/api/schemas/tables-schemas'

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
  readonly session: Readonly<Session>
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
  readonly aggregate?: {
    readonly count?: boolean
    readonly sum?: readonly string[]
    readonly avg?: readonly string[]
    readonly min?: readonly string[]
    readonly max?: readonly string[]
  }
}

export function createListRecordsProgram(
  config: ListRecordsConfig
): Effect.Effect<ListRecordsResponse, SessionContextError> {
  return Effect.gen(function* () {
    const {
      session,
      tableName,
      app,
      userRole,
      filter,
      includeDeleted,
      format,
      timezone,
      sort,
      fields,
      limit,
      offset,
      aggregate,
    } = config

    const records = yield* listRecords({ session, tableName, filter, includeDeleted, sort })

    const processedRecords = processRecords({
      records,
      app,
      tableName,
      userRole,
      userId: session.userId,
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

    const aggregations = aggregate
      ? yield* computeAggregations({ session, tableName, filter, includeDeleted, aggregate })
      : undefined

    return {
      records: [...paginatedRecords] as TransformedRecord[],
      pagination,
      ...(aggregations ? { aggregations } : {}),
    }
  })
}

interface ListTrashConfig {
  readonly session: Readonly<Session>
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

export function createListTrashProgram(
  config: ListTrashConfig
): Effect.Effect<ListRecordsResponse, SessionContextError> {
  return Effect.gen(function* () {
    const { session, tableName, app, userRole, filter, sort, limit, offset } = config

    // Query soft-deleted records with session context (RLS policies apply automatically)
    const records = yield* listTrash({ session, tableName, filter, sort })

    // Process records (field-level filtering, transformations)
    const processedRecords = processRecords({
      records,
      app,
      tableName,
      userRole,
      userId: session.userId,
    })

    // Apply pagination
    const { paginatedRecords, pagination } = applyPagination(
      processedRecords,
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
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly userRole: string
  readonly includeDeleted?: boolean
}

/**
 * Check if record passes ownership check
 * Returns true if access is allowed, false if denied
 */
/**
 * Check if user has role-based read permissions that bypass ownership checks
 */
function hasRoleBasedReadPermission(
  table:
    | {
        readonly permissions?: {
          readonly read?: { readonly type?: string; readonly roles?: readonly string[] }
        }
      }
    | undefined,
  userRole?: string
): boolean {
  if (table?.permissions?.read?.type !== 'roles') return false
  const allowedRoles = table.permissions.read.roles
  return Boolean(userRole && allowedRoles?.includes(userRole))
}

/**
 * Check if record passes ownership check
 * Returns true if access is allowed, false if denied
 */
function passesOwnershipCheck(config: {
  readonly record: Readonly<Record<string, unknown>>
  readonly userId: string
  readonly app: App
  readonly tableName: string
  readonly userRole?: string
}): boolean {
  const { record, userId, app, tableName, userRole } = config
  const recordUserId = record['user_id'] ?? record['owner_id']
  const table = app.tables?.find((t) => t.name === tableName)
  const hasOwnerField = table?.fields.some((f) => f.name === 'user_id' || f.name === 'owner_id')

  if (!hasOwnerField || recordUserId === undefined) return true
  if (hasRoleBasedReadPermission(table, userRole)) return true

  return String(recordUserId) === String(userId)
}

export function createGetRecordProgram(
  config: GetRecordConfig
): Effect.Effect<GetRecordResponse, SessionContextError> {
  return Effect.gen(function* () {
    const { session, tableName, recordId, app, userRole, includeDeleted } = config
    const { userId } = session

    const record = yield* getRecord(session, tableName, recordId, includeDeleted)
    if (!record) return yield* Effect.fail(new SessionContextError('Record not found'))

    // Enforce ownership check (return 404 to prevent enumeration)
    // Role-based permissions bypass ownership checks (RLS already enforced at DB level)
    if (!passesOwnershipCheck({ record, userId, app, tableName, userRole })) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    const filteredRecord = filterReadableFields({ app, tableName, userRole, userId, record })
    const transformed = transformRecord(filteredRecord, { app, tableName })

    // Return flattened format (id, fields, timestamps at root level)
    // Parse id as number to match test expectations
    const id = typeof record.id === 'number' ? record.id : Number(record.id)

    return {
      id,
      fields: transformed.fields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    }
  })
}

interface CreateRecordConfig {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly fields: Readonly<Record<string, unknown>>
  readonly app?: App
  readonly userRole?: string
}

export function createRecordProgram(config: CreateRecordConfig) {
  const { session, tableName, fields, app, userRole } = config
  return Effect.gen(function* () {
    // Create record with session context (owner_id set automatically)
    const record = yield* createRecord(session, tableName, fields)

    // Extract owner_id from raw record BEFORE transformation
    // (transformRecord moves these into fields.owner_id)
    const ownerId = record.owner_id

    const transformed = transformRecord(record)

    // Apply field-level read permissions filtering
    // If app and userRole are provided, filter fields based on permissions
    const filteredFields =
      app && userRole
        ? (() => {
            const { userId } = session
            const filteredRecord = filterReadableFields({
              app,
              tableName,
              userRole,
              userId,
              record,
            })

            // Transform filtered record to get only user fields (exclude system fields)
            const transformedFiltered = transformRecord(filteredRecord)
            return transformedFiltered.fields
          })()
        : transformed.fields

    // Return in format expected by tests: system fields at root, user fields nested
    // owner_id needs to be at root level for API compatibility
    return {
      id: transformed.id,
      ...(ownerId !== undefined ? { owner_id: ownerId } : {}),
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    }
  })
}

export function updateRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  params: {
    readonly fields: Readonly<Record<string, unknown>>
    readonly app?: App
    readonly userRole?: string
  }
) {
  return Effect.gen(function* () {
    // Update record with session context (RLS policies enforce access control)
    const record = yield* updateRecord(session, tableName, recordId, {
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
            const { userId } = session
            const filteredRecord = filterReadableFields({
              app: params.app!,
              tableName,
              userRole: params.userRole!,
              userId,
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

    // Return in format expected by tests: system fields at root, user fields nested
    // Preserve original ID type (number if it was number in database)
    const originalId = record.id
    return {
      id: typeof originalId === 'number' ? originalId : transformed.id,
      fields: filteredFields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    }
  })
}

export function restoreRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<RestoreRecordResponse, SessionContextError> {
  return Effect.gen(function* () {
    // Restore soft-deleted record with session context
    const record = yield* restoreRecord(session, tableName, recordId)

    // Handle special error marker for non-deleted records
    if (record && '_error' in record && record._error === 'not_deleted') {
      return yield* Effect.fail(new SessionContextError('Record is not deleted'))
    }

    if (!record) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    return {
      success: true as const,
      record: transformRecord(record),
    }
  })
}

/**
 * Raw record retrieval program (no permission filtering)
 * Used for internal checks like record existence verification
 */
export function rawGetRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<Record<string, unknown> | null, SessionContextError> {
  return getRecord(session, tableName, recordId)
}

/**
 * Delete record program
 * Wraps Infrastructure deleteRecord for proper layer architecture
 */
export function deleteRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  app?: App
): Effect.Effect<boolean, SessionContextError> {
  return deleteRecord(session, tableName, recordId, app)
}

/**
 * Permanently delete record program
 * Wraps Infrastructure permanentlyDeleteRecord for proper layer architecture
 */
export function permanentlyDeleteRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  recordId: string
): Effect.Effect<boolean, SessionContextError> {
  return permanentlyDeleteRecord(session, tableName, recordId)
}
