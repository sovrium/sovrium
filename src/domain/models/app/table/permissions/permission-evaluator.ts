/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TablePermissions, TableFieldPermissions } from '.'

/**
 * Check if user has permission based on permission configuration.
 *
 * Permission format (3-format system):
 * - `'all'` — Everyone (including unauthenticated)
 * - `'authenticated'` — Any logged-in user
 * - `string[]` — Specific role names
 */
export function hasPermission(permission: unknown, userRole: string): boolean {
  if (!permission) return false
  if (permission === 'all') return true
  if (permission === 'authenticated') return true
  if (Array.isArray(permission)) return permission.includes(userRole)
  return false
}

/**
 * Check if user role has admin privileges
 */
export function isAdminRole(userRole: string): boolean {
  return userRole === 'admin'
}

/**
 * Check permission with admin override
 */
export function checkPermissionWithAdminOverride(
  isAdmin: boolean,
  permission: unknown,
  userRole: string
): boolean {
  return isAdmin || hasPermission(permission, userRole)
}

/**
 * Evaluate table-level permissions for a user
 */
export function evaluateTablePermissions(
  tablePermissions: TablePermissions | undefined,
  userRole: string,
  isAdmin: boolean
): Readonly<{ read: boolean; create: boolean; update: boolean; delete: boolean }> {
  return {
    read: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.read, userRole),
    create: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.create, userRole),
    update: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.update, userRole),
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is accessing a property, not a Drizzle delete operation
    delete: checkPermissionWithAdminOverride(isAdmin, tablePermissions?.delete, userRole),
  }
}

/**
 * Evaluate field-level permissions for a user
 */
export function evaluateFieldPermissions(
  fieldPerms: TableFieldPermissions | undefined,
  userRole: string,
  isAdmin: boolean
): Record<string, { read: boolean; write: boolean }> {
  const fields = fieldPerms ?? []
  return Object.fromEntries(
    fields.map((fieldPerm) => [
      fieldPerm.field,
      {
        read: checkPermissionWithAdminOverride(isAdmin, fieldPerm.read, userRole),
        write: checkPermissionWithAdminOverride(isAdmin, fieldPerm.write, userRole),
      },
    ])
  )
}

/**
 * Check if user has role-based create permission for a table
 * Returns true if permission granted, false if denied
 *
 * Permission logic:
 * - Viewers: denied by default (tables must explicitly grant viewer create access)
 * - Other roles: allowed by default (unless table restricts with role-based permissions)
 *
 * Supports permission inheritance via the `inherit` field.
 */
export function hasCreatePermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{
          create?: unknown
          inherit?: string
          override?: { create?: unknown }
        }>
      }>
    | undefined,
  userRole: string,
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  const effectivePerms = getEffectivePermissions(table, allTables) as
    | Readonly<{ create?: unknown }>
    | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false
  if (userRole === 'viewer') return false

  const createPermission = effectivePerms?.create
  if (!createPermission || !Array.isArray(createPermission)) return true
  return createPermission.includes(userRole)
}

/**
 * Check if user has delete permission for the table
 *
 * Permission logic:
 * - Viewers and Members: denied by default (must be explicitly granted)
 * - Admins: allowed by default (unless explicitly restricted)
 *
 * Supports permission inheritance via the `inherit` field.
 */
export function hasDeletePermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{
          delete?: unknown
          inherit?: string
          override?: { delete?: unknown }
        }>
      }>
    | undefined,
  userRole: string,
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  const effectivePerms = getEffectivePermissions(table, allTables) as
    | Readonly<{ delete?: unknown }>
    | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is not a Drizzle delete operation, it's accessing a property
  const deletePermission = effectivePerms?.delete

  // Special handling for restrictive roles: viewers and members must be explicitly granted permission
  if (userRole === 'viewer' || userRole === 'member') {
    return Array.isArray(deletePermission) && deletePermission.includes(userRole)
  }

  // Admins and users with no explicit role: allowed by default unless explicitly restricted
  if (!deletePermission || !Array.isArray(deletePermission)) return true
  return deletePermission.includes(userRole)
}

/**
 * Check if user has update permission for a table
 * Returns true if permission granted, false if denied
 *
 * Note: When no explicit permissions are defined:
 * - Admins and members: allowed by default
 * - Viewers: denied by default (tables must explicitly grant viewer update access)
 *
 * Supports permission inheritance via the `inherit` field.
 */
export function hasUpdatePermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{
          update?: unknown
          inherit?: string
          override?: { update?: unknown }
        }>
      }>
    | undefined,
  userRole: string,
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  const effectivePerms = getEffectivePermissions(table, allTables) as
    | Readonly<{ update?: unknown }>
    | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  const updatePermission = effectivePerms?.update

  if (Array.isArray(updatePermission)) {
    return updatePermission.includes(userRole)
  }

  if (userRole === 'viewer') return false

  return true
}

/**
 * Resolve effective permissions considering inheritance
 */
function getEffectivePermissions(
  table: Readonly<{ name: string; permissions?: unknown }> | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: unknown }>[] | undefined
): unknown {
  if (!allTables || !table) return table?.permissions

  const tableWithInheritance = table as Readonly<{
    name: string
    permissions?: Readonly<{ inherit?: string }>
  }>

  if (!tableWithInheritance.permissions?.inherit) {
    return table.permissions
  }

  try {
    return resolveInheritedPermissions(
      table as Readonly<{ name: string; permissions?: TablePermissions }>,
      allTables as readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
    )
  } catch {
    return undefined
  }
}

/**
 * Check if inheritance resolution failed
 */
function inheritanceFailed(
  table: Readonly<{ permissions?: Readonly<{ inherit?: string }> }> | undefined,
  allTables: readonly unknown[] | undefined,
  effectivePermissions: unknown
): boolean {
  return Boolean(allTables && table?.permissions?.inherit && !effectivePermissions)
}

/**
 * Check if circular inheritance exists
 */
function hasCircularInheritance(tableName: string, visited: ReadonlySet<string>): boolean {
  return visited.has(tableName)
}

/**
 * Find parent table by name
 */
function findParentTable(
  parentName: string | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): Readonly<{ name: string; permissions?: TablePermissions }> | undefined {
  if (!parentName) return undefined
  return allTables.find((t) => t.name === parentName)
}

/**
 * Merge a single permission property with override support
 */
function mergePermission<T>(
  overrideValue: T | undefined,
  currentValue: T | undefined,
  parentValue: T | undefined
): T | undefined {
  return overrideValue ?? currentValue ?? parentValue
}

/**
 * Merge parent and current permissions with override support
 */
function mergePermissions(
  permissions: TablePermissions,
  parentPermissions: TablePermissions
): TablePermissions {
  const { override, read, comment, create, update, delete: deletePerms, fields } = permissions

  return {
    read: mergePermission(override?.read, read, parentPermissions.read),
    comment: mergePermission(override?.comment, comment, parentPermissions.comment),
    create: mergePermission(override?.create, create, parentPermissions.create),
    update: mergePermission(override?.update, update, parentPermissions.update),
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is accessing a property, not a Drizzle delete operation
    delete: mergePermission(override?.delete, deletePerms, parentPermissions.delete),
    fields: fields ?? parentPermissions.fields,
  }
}

/**
 * Resolve inherited permissions for a table
 *
 * Recursively resolves permissions by following the inheritance chain.
 * Handles circular inheritance detection and merges override permissions.
 *
 * @param table - The table to resolve permissions for
 * @param allTables - All tables in the app (for parent lookup)
 * @param visited - Set of visited table names (for circular detection)
 * @returns Resolved permissions or undefined if inheritance chain is invalid
 * @throws Error if circular inheritance detected or parent table not found
 */
export function resolveInheritedPermissions(
  table: Readonly<{ name: string; permissions?: TablePermissions }> | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  visited: ReadonlySet<string> = new Set()
): TablePermissions | undefined {
  if (!table?.permissions) return undefined

  const { permissions } = table

  // If no inheritance, return current permissions
  if (!permissions.inherit) {
    return permissions
  }

  // Circular inheritance detection
  if (hasCircularInheritance(table.name, visited)) {
    // Return undefined to indicate error (caught by callers)
    return undefined
  }

  // Find parent table
  const parentTable = findParentTable(permissions.inherit, allTables)
  if (!parentTable) {
    // Return undefined to indicate error (caught by callers)
    return undefined
  }

  // Recursively resolve parent permissions
  const parentPermissions = resolveInheritedPermissions(
    parentTable,
    allTables,
    new Set([...visited, table.name])
  )

  if (!parentPermissions) return permissions

  // Merge parent permissions with current permissions (current takes precedence)
  return mergePermissions(permissions, parentPermissions)
}

/**
 * Check if user has read permission for a table
 * Returns true if permission granted, false if denied
 *
 * Note: When no explicit permissions are defined:
 * - Admins and members: allowed by default
 * - Viewers: denied by default (tables must explicitly grant viewer access)
 *
 * Supports permission inheritance via the `inherit` field.
 */
export function hasReadPermission(
  table:
    | Readonly<{
        name: string
        permissions?: Readonly<{ read?: unknown; inherit?: string; override?: { read?: unknown } }>
      }>
    | undefined,
  userRole: string,
  allTables?: readonly Readonly<{ name: string; permissions?: TablePermissions }>[]
): boolean {
  const effectivePerms = getEffectivePermissions(table, allTables) as
    | Readonly<{ read?: unknown }>
    | undefined

  if (inheritanceFailed(table, allTables, effectivePerms)) return false

  const readPermission = effectivePerms?.read

  if (Array.isArray(readPermission)) {
    return readPermission.includes(userRole)
  }

  if (readPermission === 'all') return true
  if (readPermission === 'authenticated') return true

  if (userRole === 'viewer') return false

  return true
}
