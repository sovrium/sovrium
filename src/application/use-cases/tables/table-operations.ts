/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { ForbiddenError } from '@/infrastructure/database/session-context'
import {
  isAdminRole,
  evaluateTablePermissions,
  evaluateFieldPermissions,
} from './permissions/permissions'
import type { App } from '@/domain/models/app'
import type { GetTableResponse } from '@/presentation/api/schemas/tables-schemas'

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
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this table')
      )
    }

    // Check role-based permissions
    if (readPermission.type === 'roles') {
      const allowedRoles = readPermission.roles || []
      if (!allowedRoles.includes(userRole)) {
        return yield* Effect.fail(
          new ForbiddenError('You do not have permission to access this table')
        )
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

    // Check table-level read permissions
    const readPermission = table.permissions?.read

    // If read permission is explicitly configured, check role-based permissions
    if (readPermission && readPermission.type === 'roles') {
      const allowedRoles = readPermission.roles || []
      if (!allowedRoles.includes(userRole)) {
        return yield* Effect.fail(
          new ForbiddenError('You do not have permission to access this table')
        )
      }
    }

    // If no read permission is configured or permission type is not 'roles',
    // allow access (route is already protected by authentication middleware)

    // Get views from table (or empty array if no views)
    const views = table.views ?? []

    // Filter views based on read permissions
    // A view is accessible if:
    // 1. It has no permissions configured (public), OR
    // 2. It has permissions.read configured and user's role is in the allowed list
    const accessibleViews = views.filter((view) => {
      const viewReadPermission = view.permissions?.read

      // No permissions configured - view is public
      if (!viewReadPermission) {
        return true
      }

      // Check if user's role is in allowed roles
      if (Array.isArray(viewReadPermission)) {
        return viewReadPermission.includes(userRole)
      }

      // Unknown permission format - deny access (secure by default)
      return false
    })

    // Map views to response format
    const result = accessibleViews.map((view) => ({
      id: view.id,
      name: view.name,
      ...(view.filters !== undefined ? { filters: view.filters } : {}),
      ...(view.sorts !== undefined ? { sorts: view.sorts } : {}),
      ...(view.fields !== undefined ? { fields: view.fields } : {}),
      ...(view.groupBy !== undefined ? { groupBy: view.groupBy } : {}),
      ...(view.isDefault !== undefined ? { isDefault: view.isDefault } : {}),
    }))

    return result
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
