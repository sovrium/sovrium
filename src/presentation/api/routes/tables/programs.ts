/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
// eslint-disable-next-line boundaries/element-types -- Route handlers need database infrastructure for session context
import { SessionContextError, ForbiddenError } from '@/infrastructure/database/session-context'
import { filterReadableFields } from '@/presentation/api/utils/field-read-filter'
import {
  transformRecord,
  transformRecords,
  type TransformedRecord,
} from '@/presentation/api/utils/record-transformer'
import {
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  restoreRecord,
  batchCreateRecords,
  batchRestoreRecords,
  batchUpdateRecords,
  batchDeleteRecords,
} from '@/presentation/api/utils/table-queries'
import { isAdminRole, evaluateTablePermissions, evaluateFieldPermissions } from './permissions'
import type { App } from '@/domain/models/app'
// eslint-disable-next-line boundaries/element-types -- Route handlers need auth types for session management
import type { Session } from '@/infrastructure/auth/better-auth/schema'
import type {
  GetTableResponse,
  ListRecordsResponse,
  GetRecordResponse,
  RestoreRecordResponse,
  BatchRestoreRecordsResponse,
} from '@/presentation/api/schemas/tables-schemas'

/* eslint-disable functional/no-expression-statements -- Error subclass requires super() and this.name assignment */

/**
 * Error when table is not found
 */
export class TableNotFoundError extends Error {
  readonly _tag = 'TableNotFoundError'

  constructor(message: string) {
    super(message)
    this.name = 'TableNotFoundError'
  }
}

/**
 * Error when listing tables is forbidden
 */
export class ForbiddenListTablesError extends Error {
  readonly _tag = 'ForbiddenListTablesError'

  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenListTablesError'
  }
}

/* eslint-enable functional/no-expression-statements */

// Constants
const ALLOWED_ROLES_TO_LIST_TABLES = ['owner', 'admin', 'member'] as const

export function createListTablesProgram(
  userRole: string,
  app: App
): Effect.Effect<unknown[], Error> {
  // Global permission check: only owner/admin/member can list tables
  // Viewer role is explicitly denied from listing tables
  if (
    !ALLOWED_ROLES_TO_LIST_TABLES.includes(
      userRole as (typeof ALLOWED_ROLES_TO_LIST_TABLES)[number]
    )
  ) {
    return Effect.fail(new ForbiddenListTablesError('FORBIDDEN_LIST_TABLES'))
  }

  // Filter tables based on user's read permissions
  // Only return tables the user has permission to view
  const tables = app.tables ?? []

  const accessibleTables = tables.filter((table) => {
    const readPermission = table.permissions?.read

    // If no read permission configured, deny access by default (secure by default)
    if (!readPermission) {
      return false
    }

    // Check role-based permissions
    if (readPermission.type === 'roles') {
      const allowedRoles = readPermission.roles || []
      return allowedRoles.includes(userRole)
    }

    // For public, authenticated, owner, or custom permission types, allow access
    // These would need additional implementation if required
    return true
  })

  // Map tables to API response format
  const result = accessibleTables.map((table) => ({
    id: String(table.id),
    name: table.name,
    description: undefined, // Domain model doesn't have table description
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  return Effect.succeed(result)
}

export function createGetTableProgram(
  tableId: string,
  app: App,
  userRole: string
): Effect.Effect<GetTableResponse, Error> {
  return Effect.gen(function* () {
    // Find table by ID or name
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('TABLE_NOT_FOUND'))
    }

    // Check table-level read permissions
    const readPermission = table.permissions?.read

    // If no read permission is configured, deny access by default (secure by default)
    if (!readPermission) {
      return yield* Effect.fail(new ForbiddenError('FORBIDDEN'))
    }

    // Check role-based permissions
    if (readPermission.type === 'roles') {
      const allowedRoles = readPermission.roles || []
      if (!allowedRoles.includes(userRole)) {
        return yield* Effect.fail(new ForbiddenError('FORBIDDEN'))
      }
    }

    // For other permission types (public, authenticated, owner, custom), allow access
    // These would need additional implementation if required

    // Map table fields to API response format
    const fields = table.fields.map((field) => ({
      id: String(field.id),
      name: field.name,
      type: field.type,
      required: field.required,
      unique: field.unique,
      indexed: field.indexed,
      description: undefined, // Domain model doesn't have description field
    }))

    // Convert primaryKey object to string (field name) for API response
    const primaryKeyField = table.primaryKey?.field || undefined

    return {
      table: {
        id: String(table.id),
        name: table.name,
        description: undefined, // Domain model doesn't have table description
        fields,
        primaryKey: primaryKeyField,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  })
}

/**
 * Evaluate table and field permissions for a user
 */
export function createGetPermissionsProgram(
  tableId: string,
  app: App,
  userRole: string
): Effect.Effect<
  {
    table: { read: boolean; create: boolean; update: boolean; delete: boolean }
    fields: Record<string, { read: boolean; write: boolean }>
  },
  Error
> {
  return Effect.gen(function* () {
    // Find table by ID or name
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('TABLE_NOT_FOUND'))
    }

    // Admin role gets all permissions as true (override)
    const isAdmin = isAdminRole(userRole)

    return {
      table: evaluateTablePermissions(table.permissions, userRole, isAdmin),
      fields: evaluateFieldPermissions(table.permissions?.fields, userRole, isAdmin),
    }
  })
}

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
}

export function createListRecordsProgram(
  config: ListRecordsConfig
): Effect.Effect<ListRecordsResponse, SessionContextError> {
  return Effect.gen(function* () {
    const { session, tableName, app, userRole, filter } = config
    // Find table schema to check organization-scoped settings
    const table = app.tables?.find((t) => t.name === tableName)

    // Query records with session context (organization filtering automatically applied if enabled)
    const records = yield* listRecords(session, tableName, table, filter)

    // Apply field-level read permissions filtering
    // Note: Row-level ownership filtering is handled by RLS policies
    // Organization-level filtering is handled by listRecords when organizationScoped is true
    // Field-level filtering is handled at application layer
    const { userId } = session
    const filteredRecords = records.map((record) =>
      filterReadableFields({ app, tableName, userRole, userId, record })
    )

    return {
      records: transformRecords(filteredRecords),
      pagination: {
        page: 1,
        limit: 10,
        total: filteredRecords.length,
        totalPages: Math.ceil(filteredRecords.length / 10),
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }
  })
}

interface GetRecordConfig {
  readonly session: Readonly<Session>
  readonly tableName: string
  readonly recordId: string
  readonly app: App
  readonly userRole: string
}

/**
 * Check if record passes organization isolation check
 * Returns true if access is allowed, false if denied
 */
function passesOrganizationCheck(
  record: Readonly<Record<string, unknown>>,
  activeOrganizationId: string | null | undefined
): boolean {
  const recordOrgId = record['organization_id']
  if (recordOrgId === undefined || !activeOrganizationId) return true
  return String(recordOrgId) === String(activeOrganizationId)
}

/**
 * Check if record passes ownership check
 * Returns true if access is allowed, false if denied
 */
function passesOwnershipCheck(
  record: Readonly<Record<string, unknown>>,
  userId: string,
  app: App,
  tableName: string
): boolean {
  const recordUserId = record['user_id'] ?? record['owner_id']
  const table = app.tables?.find((t) => t.name === tableName)
  const hasOwnerField = table?.fields.some((f) => f.name === 'user_id' || f.name === 'owner_id')
  if (!hasOwnerField || recordUserId === undefined) return true
  return String(recordUserId) === String(userId)
}

export function createGetRecordProgram(
  config: GetRecordConfig
): Effect.Effect<GetRecordResponse, SessionContextError> {
  return Effect.gen(function* () {
    const { session, tableName, recordId, app, userRole } = config
    const { userId, activeOrganizationId } = session

    const record = yield* getRecord(session, tableName, recordId)
    if (!record) return yield* Effect.fail(new SessionContextError('Record not found'))

    // Enforce organization isolation (return 404 to prevent enumeration)
    if (!passesOrganizationCheck(record, activeOrganizationId)) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    // Enforce ownership check (return 404 to prevent enumeration)
    if (!passesOwnershipCheck(record, userId, app, tableName)) {
      return yield* Effect.fail(new SessionContextError('Record not found'))
    }

    const filteredRecord = filterReadableFields({ app, tableName, userRole, userId, record })
    return { record: transformRecord(filteredRecord) }
  })
}

export function createRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  fields: Readonly<Record<string, unknown>>
) {
  return Effect.gen(function* () {
    // Create record with session context (organization_id and owner_id set automatically)
    const record = yield* createRecord(session, tableName, fields)
    const transformed = transformRecord(record)
    // Return in format expected by tests: flatten to just include fields and id at root
    return {
      id: transformed.id,
      fields: transformed.fields,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    }
  })
}

export function updateRecordProgram(
  session: Readonly<Session>,
  tableName: string,
  recordId: string,
  fields: Readonly<Record<string, unknown>>
) {
  return Effect.gen(function* () {
    // Update record with session context (RLS policies enforce access control)
    const record = yield* updateRecord(session, tableName, recordId, fields)
    return { record: transformRecord(record) }
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

export function batchCreateProgram(
  session: Readonly<Session>,
  tableName: string,
  recordsData: readonly Record<string, unknown>[]
) {
  return Effect.gen(function* () {
    // Create records in the database
    const createdRecords = yield* batchCreateRecords(session, tableName, recordsData)

    // Transform records to API format
    const transformed = transformRecords(createdRecords)

    return {
      records: transformed,
      count: transformed.length,
    }
  })
}

export function batchUpdateProgram(
  session: Readonly<Session>,
  tableName: string,
  recordsData: readonly { id: string; [key: string]: unknown }[]
): Effect.Effect<{ records: TransformedRecord[]; count: number }, SessionContextError> {
  return Effect.gen(function* () {
    const updatedRecords = yield* batchUpdateRecords(session, tableName, recordsData)

    // Transform records to API format (nested fields structure)
    const transformed = transformRecords(updatedRecords)

    return {
      records: transformed,
      count: transformed.length,
    }
  })
}

export function batchDeleteProgram(
  session: Readonly<Session>,
  tableName: string,
  ids: readonly string[]
): Effect.Effect<
  { success: true; count: number; deletedIds: readonly string[] },
  SessionContextError
> {
  return Effect.gen(function* () {
    const deletedCount = yield* batchDeleteRecords(session, tableName, ids)
    return {
      success: true as const,
      count: deletedCount,
      deletedIds: ids,
    }
  })
}

export function batchRestoreProgram(
  session: Readonly<Session>,
  tableName: string,
  ids: readonly string[]
): Effect.Effect<BatchRestoreRecordsResponse, SessionContextError | ForbiddenError> {
  return Effect.gen(function* () {
    const restored = yield* batchRestoreRecords(session, tableName, ids)
    return {
      success: true as const,
      restored,
    }
  })
}

export function upsertProgram(
  recordsData: readonly { id?: string; fields?: Record<string, unknown> }[]
) {
  const records = recordsData.map((r) => ({
    id: r.id ?? crypto.randomUUID(),
    fields: r.fields ?? {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
  return Effect.succeed({
    records,
    created: recordsData.filter((r) => !r.id).length,
    updated: recordsData.filter((r) => r.id).length,
  })
}

export function listViewsProgram() {
  return Effect.succeed({ views: [] })
}

export function getViewProgram(tableId: string, viewId: string) {
  return Effect.succeed({
    view: {
      id: viewId,
      name: 'Default View',
      tableId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  })
}

export function getViewRecordsProgram() {
  return Effect.succeed({
    records: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  })
}
