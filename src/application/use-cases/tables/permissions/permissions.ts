/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { TablePermissions, TableFieldPermissions } from '@/domain/models/app/table/permissions'

/**
 * Check if user has permission based on permission configuration
 */
export function hasPermission(permission: unknown, userRole: string): boolean {
  // Type assertion for permission configuration
  const perm = permission as
    | { type: 'public' }
    | { type: 'authenticated' }
    | { type: 'roles'; roles?: string[] }
    | { type: 'owner' }
    | undefined

  if (!perm) return false

  switch (perm.type) {
    case 'public':
      return true
    case 'authenticated':
      return true
    case 'roles':
      return perm.roles?.includes(userRole) ?? false
    case 'owner':
      return true // Owner check requires row-level context
    default:
      return false
  }
}

/**
 * Check if user role has admin privileges
 */
export function isAdminRole(userRole: string): boolean {
  return userRole === 'admin' || userRole === 'owner'
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

  const createPermission = table?.permissions?.create as
    | { type: 'roles'; roles?: string[] }
    | { type?: string }
    | undefined
  if (createPermission?.type !== 'roles') return true
  // Type narrowing: we know it's the 'roles' type here
  const allowedRoles = (createPermission as { type: 'roles'; roles?: string[] }).roles || []
  return allowedRoles.includes(userRole)
}

/**
 * Extract delete permission configuration from table
 */
function getDeletePermission(
  table: Readonly<{ permissions?: Readonly<{ delete?: unknown }> }> | undefined
):
  | Readonly<{ type: 'roles'; roles?: readonly string[] }>
  | Readonly<{ type?: string }>
  | undefined {
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- This is not a Drizzle delete operation, it's accessing a property
  return table?.permissions?.delete as
    | { type: 'roles'; roles?: string[] }
    | { type?: string }
    | undefined
}

/**
 * Check if role is allowed in role-based permission
 */
function isRoleAllowed(
  permission:
    | Readonly<{ type: 'roles'; roles?: readonly string[] }>
    | Readonly<{ type?: string }>
    | undefined,
  userRole: string
): boolean {
  if (permission?.type !== 'roles') return false
  const allowedRoles = (permission as { type: 'roles'; roles?: string[] }).roles || []
  return allowedRoles.includes(userRole)
}

/**
 * Check viewer-specific delete permission
 */
function checkViewerDeletePermission(
  deletePermission:
    | Readonly<{ type: 'roles'; roles?: readonly string[] }>
    | Readonly<{ type?: string }>
    | undefined,
  userRole: string
): boolean {
  return deletePermission?.type === 'roles' && isRoleAllowed(deletePermission, userRole)
}

/**
 * Check if user has delete permission for the table
 */
export function hasDeletePermission(
  table: Readonly<{ permissions?: Readonly<{ delete?: unknown }> }> | undefined,
  userRole: string
): boolean {
  const deletePermission = getDeletePermission(table)

  // Viewers have read-only access by default - deny delete operations
  if (userRole === 'viewer') {
    return checkViewerDeletePermission(deletePermission, userRole)
  }

  // For non-viewers, allow if no role-based restrictions or role is in allowed list
  if (deletePermission?.type !== 'roles') return true
  return isRoleAllowed(deletePermission, userRole)
}

/**
 * Check if user has update permission for a table
 * Returns true if permission granted, false if denied
 *
 * Note: When no explicit permissions are defined:
 * - Admins, owners, and members: allowed by default
 * - Viewers: denied by default (tables must explicitly grant viewer update access)
 */
export function hasUpdatePermission(
  table: Readonly<{ permissions?: Readonly<{ update?: unknown }> }> | undefined,
  userRole: string
): boolean {
  const updatePermission = table?.permissions?.update as
    | { type: 'roles'; roles?: string[] }
    | { type?: string }
    | undefined

  // If explicit role-based permissions are defined, check if user role is in allowed roles
  if (updatePermission?.type === 'roles') {
    const allowedRoles = (updatePermission as { type: 'roles'; roles?: string[] }).roles || []
    return allowedRoles.includes(userRole)
  }

  // When no explicit permissions are defined:
  // - Viewers are denied access by default (must be explicitly granted)
  // - All other roles (admin, owner, member) are allowed
  if (userRole === 'viewer') {
    return false
  }

  // When no explicit permissions are defined, all authenticated users (except viewers) are allowed
  return true
}

/**
 * Check if user has read permission for a table
 * Returns true if permission granted, false if denied
 *
 * Note: When no explicit permissions are defined:
 * - Admins, owners, and members: allowed by default
 * - Viewers: denied by default (tables must explicitly grant viewer access)
 */
export function hasReadPermission(
  table: Readonly<{ permissions?: Readonly<{ read?: unknown }> }> | undefined,
  userRole: string
): boolean {
  const readPermission = table?.permissions?.read as
    | { type: 'roles'; roles?: string[] }
    | { type?: string }
    | undefined

  // If explicit role-based permissions are defined, check if user role is in allowed roles
  if (readPermission?.type === 'roles') {
    const allowedRoles = (readPermission as { type: 'roles'; roles?: string[] }).roles || []
    return allowedRoles.includes(userRole)
  }

  // When no explicit permissions are defined:
  // - Viewers are denied access by default (must be explicitly granted)
  // - All other roles (admin, owner, member) are allowed
  if (userRole === 'viewer') {
    return false
  }

  return true
}
