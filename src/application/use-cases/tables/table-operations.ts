/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  DENY_WHEN_UNDECLARED,
  evaluatePermission,
  permits,
  toPermissionValue,
} from '@/domain/models/app/auth/permission-evaluation'
import {
  hasCreatePermissionForRoles,
  hasDeletePermissionForRoles,
  hasReadPermission,
  hasReadPermissionForCaller,
  hasUpdatePermissionForRoles,
} from '@/domain/models/app/auth/permission-evaluator-service'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { forbiddenWriteFields } from '@/domain/models/app/tables/field-write-permission-service'
import {
  findViewByKey,
  maskViewDefinition,
} from '@/domain/models/app/tables/views/view-read-service'
import { tableEffectiveRoles } from './user-groups'
import type { GetTableResponse } from '@/domain/models/api/tables/tables'
import type { App } from '@/domain/models/app'
import type { PermissionCaller } from '@/domain/models/app/auth/permission-evaluation'

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

/** One table, in the shape the listing answers. */
function toListedTable(table: NonNullable<App['tables']>[number]) {
  return {
    id: String(table.id),
    name: table.name,
    description: undefined, // Domain model doesn't have table description
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * The caller the table read programs answer: a role, its group memberships and
 * — on a table with row-level rules, where the records route resolves them —
 * the `user_access` roles it holds. `anonymous` marks the visitor with no
 * session, whom a view grant naming signed-in callers does not admit.
 */
export type TableCaller = Readonly<{
  role: string
  groups: readonly string[]
  accessRoles?: readonly string[]
  anonymous?: boolean
  /**
   * The caller is admin-equivalent for the app (the built-in `admin` or the
   * app's top role), so a view grant's admin override admits her. Set by the
   * caller that holds the app; absent reads as the built-in `admin` only.
   */
  adminEquivalent?: boolean
}>

/** The caller in the shape the field predicates read. */
const asPermissionCaller = (caller: TableCaller): PermissionCaller => ({
  role: caller.role,
  groups: caller.groups,
  ...(caller.adminEquivalent === undefined ? {} : { adminEquivalent: caller.adminEquivalent }),
})

/** `caller`, marked admin-equivalent when the app's role ladder makes her so. */
const withAdminEquivalence = (caller: TableCaller, app: App): TableCaller => ({
  ...caller,
  adminEquivalent: isAdminEquivalent(caller.role, app),
})

/**
 * Whether the records route of `table` admits the caller — the ONE table read
 * gate the table list, the table definition, the view list and every view
 * without a grant of its own ask, so none of them can name a table, a field or
 * a view to a caller its records refuse, nor refuse one they serve.
 *
 * It is the records route's own predicate: the inheritance- and override-aware
 * `hasReadPermissionForCaller` over the caller's role and `group:` memberships,
 * joined on a table with row-level rules by the `user_access` roles the
 * records route's row-level guard adds there (and only there). A caller marked
 * `anonymous` — a visitor with no session — reads only a table whose resolved
 * read is `'all'`, as the records route answers her: a page render reaches this
 * gate with no auth middleware in front of it.
 */
export function tableReadAdmits(
  app: App,
  table: NonNullable<App['tables']>[number],
  caller: TableCaller
): boolean {
  return hasReadPermissionForCaller(
    table,
    { effectiveRoles: tableEffectiveRoles(table, caller), signedOut: caller.anonymous === true },
    app
  )
}

/**
 * Whether a view admits the caller, given whether its table's records do
 * (`tableAdmits`).
 *
 * A view that declares a `permissions` block is judged on that block INSTEAD
 * of its table's read — which is what lets a view open a table to roles the
 * table refuses. `ViewPermissions` is a union: `{ public: boolean }` is
 * answered on its own terms (only `true` opens, visitors included), and any
 * other block is the ordinary ladder — `'all'`, `'authenticated'`, or a list of
 * roles and `group:<name>` entries — evaluated with `DENY_WHEN_UNDECLARED` (a
 * block declaring no `read` admits nobody) and `admin-outranks-role-list` (an
 * admin satisfies a list, as on the table gate). A visitor with no session is
 * not a signed-in caller, so `'authenticated'` does not admit them.
 *
 * A view that declares NO block has nothing of its own to say: it inherits its
 * table's read: `tableAdmits`. What any view serves still passes the
 * reader's field grants and the table's row-level rule; this decides only
 * whether the view answers at all.
 */
export function viewGrantAdmits(
  view: { readonly permissions?: unknown },
  caller: TableCaller,
  tableAdmits: boolean
): boolean {
  const { permissions } = view
  if (permissions === undefined || permissions === null) return tableAdmits
  if (typeof permissions === 'object' && 'public' in permissions) {
    const publicPermissions = permissions as { readonly public: boolean }
    return publicPermissions.public === true
  }
  return permits(
    evaluatePermission(
      toPermissionValue((permissions as { readonly read?: unknown }).read),
      caller.anonymous === true ? undefined : asPermissionCaller(caller),
      { whenUndeclared: DENY_WHEN_UNDECLARED, adminOverride: 'admin-outranks-role-list' }
    )
  )
}

/** {@link viewGrantAdmits} with the table's read asked of the records route's own gate. */
export function viewReadAdmits(
  app: App,
  table: NonNullable<App['tables']>[number],
  view: { readonly permissions?: unknown },
  caller: TableCaller
): boolean {
  return viewGrantAdmits(
    view,
    withAdminEquivalence(caller, app),
    tableReadAdmits(app, table, caller)
  )
}

export function createListTablesProgram(
  caller: TableCaller,
  app: App
): Effect.Effect<readonly unknown[]> {
  // An app with no `auth` has no roles to gate the listing on: every visitor is
  // the guest, and the listing names exactly the tables whose records the guest
  // may read — the same rule the records route applies.
  if (app.auth === undefined) {
    const tables = app.tables ?? []
    const readable = tables.filter((table) => hasReadPermission(table, caller.role, tables))
    return Effect.succeed(readable.map(toListedTable)).pipe(
      Effect.withSpan('tables.create-list-tables-program')
    )
  }

  // No role is refused the listing as a whole: a viewer is named the tables
  // her records serve, and an empty list where none does.
  // A table is named exactly when its records admit the caller — groups,
  // `inherit` / `override` and the open-when-undeclared default resolved by the
  // records route's own gate — so a table declaring no `read` is listed to
  // every caller its records serve, and to no one else.
  const tables = app.tables ?? []
  const accessibleTables = tables.filter((table) => tableReadAdmits(app, table, caller))

  return Effect.succeed(accessibleTables.map(toListedTable)).pipe(
    Effect.withSpan('tables.create-list-tables-program')
  )
}

/**
 * A table's fields and primary key as one caller may see them: a field kept
 * from the caller is not named in its own table's definition, as it is not
 * named in the table's views, and the primary key is named only when the
 * caller reads it. A field read grant naming one of the caller's groups counts
 * exactly as one naming their role, as it does on the records themselves.
 */
function readableTableShape(
  app: App,
  table: NonNullable<App['tables']>[number],
  caller: TableCaller
) {
  const canRead = (field: string) =>
    isFieldReadableByCaller(app, table.name, asPermissionCaller(caller), field)
  const fields = table.fields
    .filter((field) => canRead(field.name))
    .map((field) => ({
      id: String(field.id),
      name: field.name,
      type: field.type,
      required: field.required,
      unique: field.unique,
      indexed: field.indexed,
      description: undefined, // Domain model doesn't have description field
    }))
  // Convert primaryKey object to string (field name) for API response
  const declared = table.primaryKey?.field || undefined
  const primaryKey = declared !== undefined && canRead(declared) ? declared : undefined
  return { fields, primaryKey }
}

export function createGetTableProgram(
  tableId: string,
  app: App,
  caller: TableCaller
): Effect.Effect<GetTableResponse, TableNotFoundError> {
  return Effect.gen(function* () {
    // Find table by ID or name
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('TABLE_NOT_FOUND'))
    }

    // The definition admits exactly whom the table's records admit, and
    // refuses the others exactly as a table that does not exist (S1).
    if (!tableReadAdmits(app, table, caller)) {
      return yield* Effect.fail(new TableNotFoundError('TABLE_NOT_FOUND'))
    }

    const { fields, primaryKey: primaryKeyField } = readableTableShape(app, table, caller)

    // The views as the views list answers them: only those the role may open,
    // each naming only the fields it may read. A second road to the
    // same definitions must not hand over what the first one masks.
    const mappedViews = viewDefinitionsFor(app, table, caller)

    // Map permissions to API format
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
 * The permissions map's `fields`: one entry for EVERY field the caller may
 * read, and none for a field it may not — whose name the map must not hand
 * over, as the table definition does not (see {@link readableTableShape}).
 *
 * Listing every readable field, rather than only those carrying a field rule,
 * is what lets a reader of the map treat a MISSING entry as "not readable, so
 * not writable" instead of guessing.
 *
 * `read` is the records read's own predicate, groups included. `write` is the
 * records write's own predicate — the very `forbiddenWriteFields` every write
 * door asks — so the map can never report `write: true` for a field a write
 * would refuse (a kanban board trusts it to offer a drag). That predicate
 * matches a field's `write` audience against the caller's ROLE, and refuses a
 * field with no `write` audience that the caller may not read — so a field
 * missing from the map is not readable, and writable only through an explicit
 * `write` grant naming the caller's role (a write-only field stays out).
 */
function readableFieldPermissions(
  app: App,
  table: NonNullable<App['tables']>[number],
  caller: TableCaller
): Readonly<Record<string, { readonly read: boolean; readonly write: boolean }>> {
  const reader = asPermissionCaller(caller)
  const isWritable = (name: string) =>
    forbiddenWriteFields(app, table.name, caller, { [name]: true }).length === 0
  return Object.fromEntries(
    table.fields
      .filter((field) => isFieldReadableByCaller(app, table.name, reader, field.name))
      .map((field) => [field.name, { read: true, write: isWritable(field.name) }])
  )
}

/**
 * Whether the records API's own write gate admits the caller for each
 * operation: the inheritance- and override-aware `has*PermissionForRoles` the
 * create, update and delete doors call, over the very effective roles they ask
 * (`tableEffectiveRoles`: assignment roles included under row-level rules,
 * which then only ever narrow the rows those grants reach). So the map never
 * reports an operation the API refuses — an `override.admin.delete` the
 * table's own `delete` grant would otherwise hide — nor refuses one it admits.
 */
function writeGatesAdmit(
  app: App,
  table: NonNullable<App['tables']>[number],
  caller: TableCaller
): Readonly<{ create: boolean; update: boolean; delete: boolean }> {
  const roles = tableEffectiveRoles(table, caller)
  return {
    create: hasCreatePermissionForRoles(table, roles, app),
    update: hasUpdatePermissionForRoles(table, roles, app),
    delete: hasDeletePermissionForRoles(table, roles, app),
  }
}

/**
 * Evaluate table and field permissions for a user
 */
export function createGetPermissionsProgram(
  tableId: string,
  app: App,
  caller: TableCaller
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

    // A caller refused the table is answered exactly as for a table that does
    // not exist — same error, so same status and body (S1 anti-enumeration),
    // as the table definition and its records already answer. The gate is the
    // records read's own, so the map exists exactly when the records do.
    if (!tableReadAdmits(app, table, caller)) {
      return yield* Effect.fail(new TableNotFoundError('TABLE_NOT_FOUND'))
    }

    // Past the gate above, the caller reads the table; each write flag is the
    // records API's own write gate for that operation.
    return {
      table: { read: true, ...writeGatesAdmit(app, table, caller) },
      fields: readableFieldPermissions(app, table, caller),
    }
  }).pipe(Effect.withSpan('tables.create-get-permissions-program'))
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

/**
 * The views of `table` a caller may open, each definition naming only the
 * fields that caller may read; a view resting on hidden fields is still listed,
 * without them. Shared by the views list and the table read, which both hand
 * views out — each only to a caller its own gate has already admitted to the
 * table, so a view without a grant of its own is one that caller may open.
 */
function viewDefinitionsFor(
  app: App,
  table: NonNullable<App['tables']>[number],
  caller: TableCaller
): readonly unknown[] {
  const canRead = (field: string) =>
    isFieldReadableByCaller(app, table.name, asPermissionCaller(caller), field)
  return (table.views ?? [])
    .filter((view) => viewGrantAdmits(view, withAdminEquivalence(caller, app), true))
    .map((view) => mapViewToResponse(maskViewDefinition(view, canRead)))
}

export function listViewsProgram(
  tableId: string,
  app: App,
  caller: TableCaller
): Effect.Effect<readonly unknown[], TableNotFoundError> {
  return Effect.gen(function* () {
    // Find table by ID or name
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('Table not found'))
    }

    // The view list admits exactly whom the table's records admit, and refuses
    // the others exactly as a table that does not exist (S1). It then names
    // only the views the caller may open.
    if (!tableReadAdmits(app, table, caller)) {
      return yield* Effect.fail(new TableNotFoundError('TABLE_NOT_FOUND'))
    }

    return viewDefinitionsFor(app, table, caller)
  }).pipe(Effect.withSpan('tables.list-views-program'))
}

export function getViewProgram(
  tableId: string,
  viewId: string,
  app: App,
  caller: TableCaller
): Effect.Effect<unknown, TableNotFoundError> {
  return Effect.gen(function* () {
    // Find table by ID or name
    const table = app.tables?.find((t) => String(t.id) === tableId || t.name === tableId)

    if (!table) {
      return yield* Effect.fail(new TableNotFoundError('Table not found'))
    }

    // By id OR name — the same lookup the records route and a page binding use.
    const view = findViewByKey(table.views, viewId)

    if (!view) {
      return yield* Effect.fail(new TableNotFoundError('View not found'))
    }

    // The definition endpoint enforces the same view grant the list and record
    // endpoints do — the view's own grant when it declares one, else its
    // table's read. A view's `filters`, `fields` and `groupBy` describe exactly
    // which rows and columns the restriction was drawn around, so handing them
    // over is a disclosure in its own right. The answer is "not found", not
    // "forbidden": S1 anti-enumeration, matching what the records endpoint
    // already returns for this same caller and view.
    if (!viewReadAdmits(app, table, view, caller)) {
      return yield* Effect.fail(new TableNotFoundError('View not found'))
    }

    // Return view properties at root level. Shares `mapViewToResponse` with the
    // list endpoint, which built the identical object: the two must agree on
    // the shape of a view, and one of them having its own copy of the five
    // optional-key spreads is how they would stop agreeing.
    // Like the list: the definition names only the fields its reader may read.
    const canRead = (field: string) =>
      isFieldReadableByCaller(app, table.name, asPermissionCaller(caller), field)
    return mapViewToResponse(maskViewDefinition(view, canRead))
  }).pipe(Effect.withSpan('tables.get-view-program'))
}
