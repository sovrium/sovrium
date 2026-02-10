/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TablePermissions, TableFieldPermissions } from '@/domain/models/app/table/permissions'

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
 */
export function hasCreatePermission(
  table: Readonly<{ permissions?: Readonly<{ create?: unknown }> }> | undefined,
  userRole: string
): boolean {
  // Viewers are denied by default (must be explicitly granted permission)
  if (userRole === 'viewer') {
    return false
  }

  const createPermission = table?.permissions?.create
  if (!createPermission || !Array.isArray(createPermission)) return true
  return createPermission.includes(userRole)
}

/**
 * Check if user has delete permission for the table
 */
export function hasDeletePermission(
  table: Readonly<{ permissions?: Readonly<{ delete?: unknown }> }> | undefined,
  userRole: string
): boolean {
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is not a Drizzle delete operation, it's accessing a property
  const deletePermission = table?.permissions?.delete

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
 */
export function hasUpdatePermission(
  table: Readonly<{ permissions?: Readonly<{ update?: unknown }> }> | undefined,
  userRole: string
): boolean {
  const updatePermission = table?.permissions?.update

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
 * Check if user has read permission for a table
 * Returns true if permission granted, false if denied
 *
 * Note: When no explicit permissions are defined:
 * - Admins and members: allowed by default
 * - Viewers: denied by default (tables must explicitly grant viewer access)
 */
export function hasReadPermission(
  table: Readonly<{ permissions?: Readonly<{ read?: unknown }> }> | undefined,
  userRole: string
): boolean {
  const readPermission = table?.permissions?.read

  // If explicit role array is defined, check if user role is in allowed roles
  if (Array.isArray(readPermission)) {
    return readPermission.includes(userRole)
  }

  // When no explicit permissions are defined:
  // - Viewers are denied access by default (must be explicitly granted)
  // - All other roles (admin, member) are allowed
  if (userRole === 'viewer') {
    return false
  }

  return true
}
