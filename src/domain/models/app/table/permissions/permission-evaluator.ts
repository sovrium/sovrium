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
  // Resolve inherited permissions if allTables provided
  let effectivePermissions = table?.permissions
  if (allTables && table && table.permissions?.inherit) {
    try {
      effectivePermissions = resolveInheritedPermissions(table as any, allTables)
    } catch (error) {
      // If inheritance resolution fails, deny access
      return false
    }
  }

  // Viewers are denied by default (must be explicitly granted permission)
  if (userRole === 'viewer') {
    return false
  }

  const createPermission = effectivePermissions?.create
  if (!createPermission || !Array.isArray(createPermission)) return true
  return createPermission.includes(userRole)
}

/**
 * Check if user has delete permission for the table
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
  // Resolve inherited permissions if allTables provided
  let effectivePermissions = table?.permissions
  if (allTables && table && table.permissions?.inherit) {
    try {
      effectivePermissions = resolveInheritedPermissions(table as any, allTables)
    } catch (error) {
      // If inheritance resolution fails, deny access
      return false
    }
  }

  // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is not a Drizzle delete operation, it's accessing a property
  const deletePermission = effectivePermissions?.delete

  // Viewers have read-only access by default - deny delete operations
  if (userRole === 'viewer') {
    return Array.isArray(deletePermission) && deletePermission.includes(userRole)
  }

  // For non-viewers, allow if no role-based restrictions or role is in allowed list
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
  // Resolve inherited permissions if allTables provided
  let effectivePermissions = table?.permissions
  if (allTables && table && table.permissions?.inherit) {
    try {
      effectivePermissions = resolveInheritedPermissions(table as any, allTables)
    } catch (error) {
      // If inheritance resolution fails, deny access
      return false
    }
  }

  const updatePermission = effectivePermissions?.update

  // If explicit role array is defined, check if user role is in allowed roles
  if (Array.isArray(updatePermission)) {
    return updatePermission.includes(userRole)
  }

  // When no explicit permissions are defined:
  // - Viewers are denied access by default (must be explicitly granted)
  // - All other roles (admin, member) are allowed
  if (userRole === 'viewer') {
    return false
  }

  return true
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
 */
export function resolveInheritedPermissions(
  table: Readonly<{ name: string; permissions?: TablePermissions }> | undefined,
  allTables: readonly Readonly<{ name: string; permissions?: TablePermissions }>[],
  visited: Set<string> = new Set()
): TablePermissions | undefined {
  if (!table || !table.permissions) return undefined

  const permissions = table.permissions

  // If no inheritance, return current permissions
  if (!permissions.inherit) {
    return permissions
  }

  // Circular inheritance detection
  if (visited.has(table.name)) {
    throw new Error(
      `Circular permission inheritance detected: ${Array.from(visited).join(' -> ')} -> ${table.name}`
    )
  }

  // Find parent table
  const parentTable = allTables.find((t) => t.name === permissions.inherit)
  if (!parentTable) {
    throw new Error(`Inherited table not found: ${permissions.inherit}`)
  }

  // Recursively resolve parent permissions
  const parentPermissions = resolveInheritedPermissions(
    parentTable,
    allTables,
    new Set([...visited, table.name])
  )

  if (!parentPermissions) return permissions

  // Merge parent permissions with current permissions (current takes precedence)
  // Override permissions take precedence over inherited
  const resolvedPermissions: TablePermissions = {
    read: permissions.override?.read ?? permissions.read ?? parentPermissions.read,
    comment: permissions.override?.comment ?? permissions.comment ?? parentPermissions.comment,
    create: permissions.override?.create ?? permissions.create ?? parentPermissions.create,
    update: permissions.override?.update ?? permissions.update ?? parentPermissions.update,
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is accessing a property, not a Drizzle delete operation
    delete: permissions.override?.delete ?? permissions.delete ?? parentPermissions.delete,
    fields: permissions.fields ?? parentPermissions.fields,
  }

  return resolvedPermissions
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
  // Resolve inherited permissions if allTables provided
  let effectivePermissions = table?.permissions
  if (allTables && table && table.permissions?.inherit) {
    try {
      effectivePermissions = resolveInheritedPermissions(table as any, allTables)
    } catch (error) {
      // If inheritance resolution fails, deny access
      return false
    }
  }

  const readPermission = effectivePermissions?.read

  // If explicit role array is defined, check if user role is in allowed roles
  if (Array.isArray(readPermission)) {
    return readPermission.includes(userRole)
  }

  // Check for 'all' or 'authenticated' permission
  if (readPermission === 'all') return true
  if (readPermission === 'authenticated') return true

  // When no explicit permissions are defined:
  // - Viewers are denied access by default (must be explicitly granted)
  // - All other roles (admin, member) are allowed
  if (userRole === 'viewer') {
    return false
  }

  return true
}
