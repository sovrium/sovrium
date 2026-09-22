/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import { ForbiddenError } from '@/domain/errors'
import {
  DENY_WHEN_UNDECLARED,
  OPEN_WHEN_UNDECLARED,
  evaluatePermission,
  permits,
  toPermissionValue,
} from '@/domain/models/app/auth/permission-evaluation'
import {
  evaluateTablePermissions,
  evaluateFieldPermissions,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminRole, hasPermission } from '@/domain/models/app/auth/permissions'
import { processRecords } from './list-helpers'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { DatabaseError } from '@/domain/errors'
import type { GetTableResponse } from '@/domain/models/api/tables/tables'
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

  // A table whose `read` was never configured is NOT listed: the listing is the
  // one surface where a fail-open leaks the existence of every table in the app
  //. No admin override — the `ALLOWED_ROLES_TO_LIST_TABLES`
  // gate above gets an operator into the endpoint, not past a table's own grant.
  const accessibleTables = tables.filter((table) =>
    permits(
      evaluatePermission(
        table.permissions?.read,
        { role: userRole },
        {
          whenUndeclared: DENY_WHEN_UNDECLARED,
          adminOverride: 'no-admin-override',
        }
      )
    )
  )

  // Map tables to API response format
  const result = accessibleTables.map((table) => ({
    id: String(table.id),
    name: table.name,
    description: undefined, // Domain model doesn't have table description
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  return Effect.succeed(result).pipe(Effect.withSpan('tables.create-list-tables-program'))
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
  }).pipe(Effect.withSpan('tables.create-get-table-program'))
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
  }).pipe(Effect.withSpan('tables.create-get-permissions-program'))
}

/**
 * Whether a view's read grant admits `userRole`.
 *
 * `ViewPermissions` is a union, and only one of its members is a permission
 * ladder. `{ public: boolean }` is answered on its own terms first, because it
 * is a shape the canonical evaluator does not model and never will. Everything
 * else is the ordinary three-rung ladder the rest of the engine speaks —
 * `'all'`, `'authenticated'`, or a role array — so it is evaluated by
 * `evaluatePermission` rather than by a role-array test standing in for the
 * whole ladder.
 *
 * The two policy choices:
 *  - `DENY_WHEN_UNDECLARED` — a `permissions` block that declares no `read` is
 *    denied, secure by default. (A view with no block AT ALL is unrestricted,
 *    and is answered above before the ladder is reached.)
 *  - `admin-outranks-role-list` — an admin satisfies a declared role array
 *    here exactly as they do on the table, bucket and agent gates, so the
 *    operator is not locked out of a view on a table they can read in full.
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
  const permissions = view.permissions as { readonly read?: unknown }

  return permits(
    evaluatePermission(
      toPermissionValue(permissions.read),
      { role: userRole },
      {
        whenUndeclared: DENY_WHEN_UNDECLARED,
        adminOverride: 'admin-outranks-role-list',
      }
    )
  )
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

    // The table's own read grant, on the same ladder its records go through.
    // `OPEN_WHEN_UNDECLARED` preserves the long-standing behaviour that a table
    // which never wrote a `permissions` block keeps its views listable — the
    // gate that matters there is `requireAuth`. The admin override is what the
    // hand-rolled `Array.isArray(read) && !read.includes(userRole)` test used to
    // omit, which let an admin read a table's RECORDS but not list its VIEWS.
    if (
      !permits(
        evaluatePermission(
          table.permissions?.read,
          { role: userRole },
          {
            whenUndeclared: OPEN_WHEN_UNDECLARED,
            adminOverride: 'admin-outranks-role-list',
          }
        )
      )
    ) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this table')
      )
    }

    // Get views from table (or empty array if no views)
    const views = table.views ?? []

    // Filter views based on read permissions and map to response format
    const accessibleViews = views.filter((view) => isViewAccessible(view, userRole))
    return accessibleViews.map(mapViewToResponse)
  }).pipe(Effect.withSpan('tables.list-views-program'))
}

export function getViewProgram(
  tableId: string,
  viewId: string,
  app: App,
  userRole: string
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

    // The definition endpoint enforces the same view grant the list and record
    // endpoints do. A view's `filters`, `fields` and `groupBy` describe exactly
    // which rows and columns the restriction was drawn around, so handing them
    // over is a disclosure in its own right. The answer is "not found", not
    // "forbidden": S1 anti-enumeration, matching what the records endpoint
    // already returns for this same caller and view.
    if (!isViewAccessible(view, userRole)) {
      return yield* Effect.fail(new TableNotFoundError('View not found'))
    }

    // Return view properties at root level. Shares `mapViewToResponse` with the
    // list endpoint, which built the identical object: the two must agree on
    // the shape of a view, and one of them having its own copy of the five
    // optional-key spreads is how they would stop agreeing.
    return mapViewToResponse(view)
  }).pipe(Effect.withSpan('tables.get-view-program'))
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
}): Effect.Effect<unknown, TableNotFoundError | ForbiddenError | DatabaseError, TableRepository> {
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
      fields,
    })

    return {
      records: [...processedRecords],
    }
  }).pipe(Effect.withSpan('tables.get-view-records-program'))
}
