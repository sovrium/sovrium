/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/table-repository'
import { ForbiddenError } from '@/domain/errors'
import {
  isAdminRole,
  hasPermission,
  evaluateTablePermissions,
  evaluateFieldPermissions,
} from './permissions/permissions'
import { processRecords } from './utils/list-helpers'
import type { UserSession } from '@/application/ports/models/user-session'
import type { SessionContextError } from '@/domain/errors'
import type { GetTableResponse } from '@/domain/models/api/tables'
import type { App } from '@/domain/models/app'

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

/* eslint-enable functional/no-expression-statements */

// Constants
const ALLOWED_ROLES_TO_LIST_TABLES: readonly string[] = ['admin', 'member'] as const

export function createListTablesProgram(
  userRole: string,
  app: App
): Effect.Effect<readonly unknown[], Error> {
  // Global permission check: only admin/member can list tables
  // Viewer role is explicitly denied from listing tables
  if (
    !ALLOWED_ROLES_TO_LIST_TABLES.includes(
      userRole as (typeof ALLOWED_ROLES_TO_LIST_TABLES)[number]
    )
  ) {
    return Effect.fail(new ForbiddenError('You do not have permission to list tables'))
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

    // Check permission using simplified 3-format system
    if (readPermission === 'all') return true
    if (readPermission === 'authenticated') return true
    if (Array.isArray(readPermission)) return readPermission.includes(userRole)

    return false
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

    // Check table-level read permissions using simplified 3-format system
    if (!hasPermission(table.permissions?.read, userRole)) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this table')
      )
    }

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

    // Get views from table (or empty array if no views)
    const views = table.views ?? []
    const mappedViews = views.map(mapViewToResponse)

    // Map permissions to API format
    const permissions = table.permissions
      ? {
          read: table.permissions.read,
          create: table.permissions.create,
          update: table.permissions.update,
          // eslint-disable-next-line drizzle/enforce-delete-with-where -- False positive: accessing property, not calling Drizzle delete method
          delete: table.permissions.delete,
        }
      : undefined

    return {
      table: {
        id: String(table.id),
        name: table.name,
        description: undefined, // Domain model doesn't have table description
        fields,
        primaryKey: primaryKeyField,
        views: mappedViews,
        permissions,
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
    readonly table: {
      readonly read: boolean
      readonly create: boolean
      readonly update: boolean
      readonly delete: boolean
    }
    readonly fields: Record<string, { readonly read: boolean; readonly write: boolean }>
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

/**
 * Check if a view is accessible to a user based on permissions
 */
function isViewAccessible(view: { readonly permissions?: unknown }, userRole: string): boolean {
  // No permissions configured - view is public
  if (!view.permissions) {
    return true
  }

  // Check if permissions is public type
  if (typeof view.permissions === 'object' && 'public' in view.permissions) {
    const publicPermissions = view.permissions as { readonly public: boolean }
    return publicPermissions.public === true
  }

  // At this point, permissions must be the read/write type
  const permissions = view.permissions as {
    readonly read?: readonly string[]
    readonly write?: readonly string[]
  }
  const viewReadPermission = permissions.read

  // No read permission configured - deny access (secure by default)
  if (!viewReadPermission) {
    return false
  }

  // Check if user's role is in allowed roles
  return Array.isArray(viewReadPermission) && viewReadPermission.includes(userRole)
}

/**
 * Map a view to response format
 */
function mapViewToResponse(view: {
  readonly id: string | number
  readonly name: string
  readonly filters?: unknown
  readonly sorts?: unknown
  readonly fields?: unknown
  readonly groupBy?: unknown
  readonly isDefault?: boolean
}): unknown {
  return {
    id: view.id,
    name: view.name,
    ...(view.filters !== undefined ? { filters: view.filters } : {}),
    ...(view.sorts !== undefined ? { sorts: view.sorts } : {}),
    ...(view.fields !== undefined ? { fields: view.fields } : {}),
    ...(view.groupBy !== undefined ? { groupBy: view.groupBy } : {}),
    ...(view.isDefault !== undefined ? { isDefault: view.isDefault } : {}),
  }
}

export function listViewsProgram(
  tableId: string,
  app: App,
  userRole: string
): Effect.Effect<readonly unknown[], TableNotFoundError | ForbiddenError> {
  return Effect.gen(function* () {
    // Find table by ID or name
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('Table not found'))
    }

    // Check table-level read permissions using simplified 3-format system
    const readPermission = table.permissions?.read
    if (Array.isArray(readPermission) && !readPermission.includes(userRole)) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this table')
      )
    }

    // Get views from table (or empty array if no views)
    const views = table.views ?? []

    // Filter views based on read permissions and map to response format
    const accessibleViews = views.filter((view) => isViewAccessible(view, userRole))
    return accessibleViews.map(mapViewToResponse)
  })
}

export function getViewProgram(
  tableId: string,
  viewId: string,
  app: App
): Effect.Effect<unknown, TableNotFoundError> {
  return Effect.gen(function* () {
    // Find table by ID or name
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('Table not found'))
    }

    // Find view in table
    const view = table.views?.find((v) => v.id === viewId)

    if (!view) {
      return yield* Effect.fail(new TableNotFoundError('View not found'))
    }

    // Return view properties at root level
    return {
      id: view.id,
      name: view.name,
      ...(view.filters !== undefined ? { filters: view.filters } : {}),
      ...(view.sorts !== undefined ? { sorts: view.sorts } : {}),
      ...(view.fields !== undefined ? { fields: view.fields } : {}),
      ...(view.groupBy !== undefined ? { groupBy: view.groupBy } : {}),
      ...(view.isDefault !== undefined ? { isDefault: view.isDefault } : {}),
    }
  })
}

/**
 * Build query parameters from view configuration
 */
function buildViewQueryParams(view: {
  readonly filters?: unknown
  readonly sorts?: readonly { readonly field: string; readonly direction: string }[]
  readonly fields?: readonly string[] | unknown
}): {
  readonly filter:
    | {
        readonly and?: readonly {
          readonly field: string
          readonly operator: string
          readonly value: unknown
        }[]
      }
    | undefined
  readonly sort: string
  readonly fields: string | undefined
} {
  // Build filter from view filters
  // View filters may be of type ViewFilterNode, need to extract the 'and' array if present
  const filter = view.filters as
    | {
        readonly and?: readonly {
          readonly field: string
          readonly operator: string
          readonly value: unknown
        }[]
      }
    | undefined

  // Build sort from view sorts
  const sortArray = view.sorts || []
  const sort = sortArray.map((s) => `${s.field}:${s.direction}`).join(',')

  // Build fields list from view fields
  const fieldsStr = Array.isArray(view.fields) ? view.fields.join(',') : undefined

  return { filter, sort, fields: fieldsStr }
}

export function getViewRecordsProgram(config: {
  readonly tableId: string
  readonly viewId: string
  readonly app: App
  readonly userRole: string
  readonly session: Readonly<UserSession>
}): Effect.Effect<
  unknown,
  TableNotFoundError | ForbiddenError | SessionContextError,
  TableRepository
> {
  return Effect.gen(function* () {
    const repo = yield* TableRepository
    const { tableId, viewId, app, userRole, session } = config

    // Find table by ID or name
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('Table not found'))
    }

    // Find view in table
    const view = table.views?.find((v) => v.id === viewId)

    if (!view) {
      return yield* Effect.fail(new TableNotFoundError('View not found'))
    }

    // Check view-level read permissions
    if (!isViewAccessible(view, userRole)) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this view')
      )
    }

    // Build query parameters from view configuration
    const { filter, sort, fields } = buildViewQueryParams(view)

    // Query records with view filters and sorts
    const records = yield* repo.listRecords({
      session,
      tableName: table.name,
      filter,
      includeDeleted: false,
      sort: sort || undefined,
      app,
    })

    // Process records with field filtering
    const processedRecords = processRecords({
      records,
      app,
      tableName: table.name,
      userRole,
      userId: session.userId,
      fields,
    })

    return {
      records: [...processedRecords],
    }
  })
}
