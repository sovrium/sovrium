/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
import type { GetTableResponse } from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'


export class TableNotFoundError extends Error {
  readonly _tag = 'TableNotFoundError'

  constructor(message: string) {
    super(message)
    this.name = 'TableNotFoundError'
  }
}


const ALLOWED_ROLES_TO_LIST_TABLES: readonly string[] = ['admin', 'member'] as const

export function createListTablesProgram(
  userRole: string,
  app: App
): Effect.Effect<readonly unknown[], Error> {
  if (
    !ALLOWED_ROLES_TO_LIST_TABLES.includes(
      userRole as (typeof ALLOWED_ROLES_TO_LIST_TABLES)[number]
    )
  ) {
    return Effect.fail(new ForbiddenError('You do not have permission to list tables'))
  }

  const tables = app.tables ?? []

  const accessibleTables = tables.filter((table) => {
    const readPermission = table.permissions?.read

    if (!readPermission) {
      return false
    }

    if (readPermission === 'all') return true
    if (readPermission === 'authenticated') return true
    if (Array.isArray(readPermission)) return readPermission.includes(userRole)

    return false
  })

  const result = accessibleTables.map((table) => ({
    id: String(table.id),
    name: table.name,
    description: undefined,
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
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('TABLE_NOT_FOUND'))
    }

    if (!hasPermission(table.permissions?.read, userRole)) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this table')
      )
    }

    const fields = table.fields.map((field) => ({
      id: String(field.id),
      name: field.name,
      type: field.type,
      required: field.required,
      unique: field.unique,
      indexed: field.indexed,
      description: undefined,
    }))

    const primaryKeyField = table.primaryKey?.field || undefined

    const views = table.views ?? []
    const mappedViews = views.map(mapViewToResponse)

    const permissions = table.permissions
      ? {
          read: table.permissions.read,
          create: table.permissions.create,
          update: table.permissions.update,
          delete: table.permissions.delete,
        }
      : undefined

    return {
      table: {
        id: String(table.id),
        name: table.name,
        description: undefined,
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
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('TABLE_NOT_FOUND'))
    }

    const isAdmin = isAdminRole(userRole)

    return {
      table: evaluateTablePermissions(table.permissions, userRole, isAdmin),
      fields: evaluateFieldPermissions(table.permissions?.fields, userRole, isAdmin),
    }
  })
}

function isViewAccessible(view: { readonly permissions?: unknown }, userRole: string): boolean {
  if (!view.permissions) {
    return true
  }

  if (typeof view.permissions === 'object' && 'public' in view.permissions) {
    const publicPermissions = view.permissions as { readonly public: boolean }
    return publicPermissions.public === true
  }

  const permissions = view.permissions as {
    readonly read?: readonly string[]
    readonly write?: readonly string[]
  }
  const viewReadPermission = permissions.read

  if (!viewReadPermission) {
    return false
  }

  return Array.isArray(viewReadPermission) && viewReadPermission.includes(userRole)
}

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
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('Table not found'))
    }

    const readPermission = table.permissions?.read
    if (Array.isArray(readPermission) && !readPermission.includes(userRole)) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this table')
      )
    }

    const views = table.views ?? []

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
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('Table not found'))
    }

    const view = table.views?.find((v) => v.id === viewId)

    if (!view) {
      return yield* Effect.fail(new TableNotFoundError('View not found'))
    }

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
  const filter = view.filters as
    | {
        readonly and?: readonly {
          readonly field: string
          readonly operator: string
          readonly value: unknown
        }[]
      }
    | undefined

  const sortArray = view.sorts || []
  const sort = sortArray.map((s) => `${s.field}:${s.direction}`).join(',')

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

    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('Table not found'))
    }

    const view = table.views?.find((v) => v.id === viewId)

    if (!view) {
      return yield* Effect.fail(new TableNotFoundError('View not found'))
    }

    if (!isViewAccessible(view, userRole)) {
      return yield* Effect.fail(
        new ForbiddenError('You do not have permission to access this view')
      )
    }

    const { filter, sort, fields } = buildViewQueryParams(view)

    const records = yield* repo.listRecords({
      session,
      tableName: table.name,
      filter,
      includeDeleted: false,
      sort: sort || undefined,
      app,
    })

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
  })
}
