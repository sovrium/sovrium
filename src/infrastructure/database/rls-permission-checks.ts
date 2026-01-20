/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'
import type { TablePermission } from '@/domain/models/app/table/permissions'

/**
 * SQL command mapping for CRUD operations
 */
export const CRUD_TO_SQL_COMMAND = {
  read: 'SELECT',
  create: 'INSERT',
  update: 'UPDATE',
  delete: 'DELETE',
} as const

/**
 * Check if permission is public
 */
export const isPublicPermission = (permission?: TablePermission): boolean =>
  permission?.type === 'public'

/**
 * Check if table has ONLY public permissions (all configured permissions are public)
 *
 * A table with only public permissions doesn't need RLS at all - everyone can access everything.
 * This is different from "no permissions" (which means default deny).
 *
 * @param table - Table definition
 * @returns True if all configured permissions are public type
 */
export const hasOnlyPublicPermissions = (table: Table): boolean => {
  const { permissions } = table
  if (!permissions) {
    return false
  }

  // If field-level or record-level permissions exist, it's not fully public
  if (permissions.fields && permissions.fields.length > 0) {
    return false
  }
  if (permissions.records && permissions.records.length > 0) {
    return false
  }

  // Check all CRUD permissions - if any permission exists and is NOT public, return false
  const permissionValues = [
    permissions.read,
    permissions.create,
    permissions.update,
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    permissions.delete,
  ]

  // At least one permission must exist
  const hasAnyPermission = permissionValues.some((p) => p !== undefined)
  if (!hasAnyPermission) {
    return false
  }

  // All existing permissions must be public
  return permissionValues.every((p) => p === undefined || isPublicPermission(p))
}

/**
 * Check if table has NO permissions object defined at all
 *
 * When the permissions property is undefined (not even an empty object),
 * we allow API access via app_user role. This is for developer convenience
 * when a table hasn't been configured with permissions yet.
 *
 * @param table - Table definition
 * @returns True if permissions is undefined (not configured)
 */
export const hasNoPermissions = (table: Table): boolean => {
  return table.permissions === undefined
}

/**
 * Check if table has an explicit empty permissions object
 *
 * When permissions is explicitly set to {} (empty object with all fields undefined),
 * this represents an intentional "deny all" configuration. In this case:
 * - RLS is enabled (default deny)
 * - No policies are created
 * - All access is blocked
 *
 * This is different from undefined (hasNoPermissions), which allows API access.
 *
 * @param table - Table definition
 * @returns True if permissions object exists but is completely empty
 */
export const hasExplicitEmptyPermissions = (table: Table): boolean => {
  const { permissions } = table

  // Must have a permissions object (not undefined)
  if (!permissions) {
    return false
  }

  // Check if all permission types are undefined (empty object)
  return (
    permissions.read === undefined &&
    permissions.create === undefined &&
    permissions.update === undefined &&
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    permissions.delete === undefined &&
    (permissions.fields === undefined || permissions.fields.length === 0) &&
    (permissions.records === undefined || permissions.records.length === 0)
  )
}

/**
 * Check if table has owner-based permissions
 *
 * @param table - Table definition
 * @returns True if any CRUD operation uses owner-based permission
 */
export const hasOwnerPermissions = (table: Table): boolean => {
  const { permissions } = table
  if (!permissions) {
    return false
  }

  return (
    permissions.read?.type === 'owner' ||
    permissions.create?.type === 'owner' ||
    permissions.update?.type === 'owner' ||
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    permissions.delete?.type === 'owner'
  )
}

/**
 * Check if table has authenticated permissions
 *
 * @param table - Table definition
 * @returns True if any CRUD operation uses authenticated permission
 */
export const hasAuthenticatedPermissions = (table: Table): boolean => {
  const { permissions } = table
  if (!permissions) {
    return false
  }

  return (
    permissions.read?.type === 'authenticated' ||
    permissions.create?.type === 'authenticated' ||
    permissions.update?.type === 'authenticated' ||
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    permissions.delete?.type === 'authenticated'
  )
}

/**
 * Check if table has role-based permissions (without organization scoping)
 *
 * @param table - Table definition
 * @returns True if any CRUD operation uses role-based permission
 */
export const hasRolePermissions = (table: Table): boolean => {
  const { permissions } = table
  if (!permissions) {
    return false
  }

  return (
    permissions.read?.type === 'roles' ||
    permissions.create?.type === 'roles' ||
    permissions.update?.type === 'roles' ||
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    permissions.delete?.type === 'roles'
  )
}

/**
 * Check if table has record-level permissions
 *
 * @param table - Table definition
 * @returns True if table has record-level permissions defined
 */
export const hasRecordLevelPermissions = (table: Table): boolean =>
  table.permissions?.records !== undefined && table.permissions.records.length > 0

/**
 * Check if table has mixed permission types
 *
 * A table has mixed permissions when different CRUD operations use different permission types.
 * For example: read uses authenticated, but create uses roles.
 *
 * @param table - Table definition
 * @returns True if table has mixed permission types
 */
export const hasMixedPermissions = (table: Table): boolean => {
  const { permissions } = table
  if (!permissions) {
    return false
  }

  // Skip if has record-level permissions (those are handled separately)
  if (hasRecordLevelPermissions(table)) {
    return false
  }

  // Get permission types for each CRUD operation
  const allTypes = [
    permissions.read?.type,
    permissions.create?.type,
    permissions.update?.type,
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    permissions.delete?.type,
  ]
  const permissionTypes = allTypes.filter(
    (type): type is NonNullable<typeof type> => type !== undefined && type !== 'public'
  )

  // If less than 2 non-public permissions, no mixing possible
  if (permissionTypes.length < 2) {
    return false
  }

  // Check if there are different permission types
  const uniqueTypes = new Set(permissionTypes)
  return uniqueTypes.size > 1
}

/**
 * Extract database role names from table permissions
 *
 * Converts application role names (e.g., 'admin', 'member') to
 * database role names (e.g., 'admin_user', 'member_user').
 *
 * @param table - Table definition with role-based permissions
 * @returns Set of database role names to grant access to
 */
/**
 * Extract roles from a single permission configuration
 */
const getRolesFromPermission = (permission?: TablePermission): readonly string[] =>
  permission?.type === 'roles' && permission.roles
    ? permission.roles.map((role) => `${role}_user`)
    : []

export const extractDatabaseRoles = (table: Table): ReadonlySet<string> => {
  const { permissions } = table
  if (!permissions) {
    return new Set()
  }

  // Collect all roles from each CRUD operation using functional approach
  const allRoles = [
    permissions.read,
    permissions.create,
    permissions.update,
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- permissions.delete is a permission field, not a Drizzle delete operation
    permissions.delete,
  ].flatMap(getRolesFromPermission)

  return new Set(allRoles)
}
