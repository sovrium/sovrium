/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { shouldCreateDatabaseColumn } from './field-utils'
import type { Table } from '@/domain/models/app/table'
import type { TablePermission } from '@/domain/models/app/table/permissions'

/**
 * Extract role from permission configuration
 * Maps permission roles to PostgreSQL role names with _user suffix
 */
const extractRoles = (permission: TablePermission): readonly string[] => {
  if (Array.isArray(permission)) {
    // Map role names to PostgreSQL roles: 'admin' -> 'admin_user'
    return permission.map((role) => `${role}_user`)
  }
  if (permission === 'authenticated') {
    // Authenticated permissions grant access to all authenticated users
    // This includes admin_user, member_user, and authenticated_user roles
    return ['authenticated_user', 'admin_user', 'member_user']
  }
  if (permission === 'all') {
    // 'all' permissions grant access to everyone including unauthenticated users
    // PostgreSQL PUBLIC pseudo-role represents all users
    return ['PUBLIC', 'authenticated_user', 'admin_user', 'member_user']
  }
  return []
}

/**
 * Get permission hierarchy level
 * Higher number = more permissive
 */
const getPermissionLevel = (permission: TablePermission): number => {
  if (permission === 'all') return 3
  if (permission === 'authenticated') return 2
  if (Array.isArray(permission)) return 1
  return 0
}

/**
 * Find the most permissive permission from a list
 */
const getMostPermissivePermission = (
  permissions: readonly TablePermission[]
): TablePermission | undefined => {
  if (permissions.length === 0) return undefined
  return permissions.reduce((most, current) =>
    getPermissionLevel(current) > getPermissionLevel(most) ? current : most
  )
}

/**
 * Build role-to-fields mapping from field permissions
 */
const buildRoleFieldsMap = (
  fieldPermissions: readonly { field: string; permission: TablePermission | undefined }[]
): ReadonlyMap<string, readonly string[]> => {
  const roleFieldEntries = fieldPermissions.flatMap((fp) => {
    const roles = fp.permission ? extractRoles(fp.permission) : []
    return roles.map((role) => ({ role, field: fp.field }))
  })

  // Group fields by role
  const grouped = roleFieldEntries.reduce(
    (acc, { role, field }) => ({
      ...acc,
      [role]: [...(acc[role] ?? []), field],
    }),
    {} as Record<string, string[]>
  )

  return new Map(Object.entries(grouped))
}

/**
 * Add base fields to restricted roles
 */
const addBaseFieldsToRestrictedRoles = (
  roleFieldsMap: ReadonlyMap<string, readonly string[]>,
  baseRoles: readonly string[]
): ReadonlyMap<string, readonly string[]> => {
  const allRoles = Array.from(roleFieldsMap.keys())
  const restrictedRoles = allRoles.filter((role) => !baseRoles.includes(role))

  const firstBaseRole = baseRoles[0]
  const baseFields = firstBaseRole ? (roleFieldsMap.get(firstBaseRole) ?? []) : []

  const updatedEntries = restrictedRoles.map((role) => {
    const currentFields = roleFieldsMap.get(role) ?? []
    const allFields = Array.from(new Set([...baseFields, ...currentFields]))
    return [role, allFields] as const
  })

  return new Map([...Array.from(roleFieldsMap.entries()), ...updatedEntries])
}

/**
 * Determine effective table permission when not explicitly specified
 * Uses the most permissive field permission, but defaults to authenticated if only roles exist
 */
const getEffectiveTablePermission = (
  tableReadPermission: TablePermission | undefined,
  fieldPermissions: readonly { field: string; read?: TablePermission }[]
): TablePermission => {
  if (tableReadPermission) {
    return tableReadPermission
  }

  // Extract all explicit field read permissions
  const explicitFieldReadPermissions = fieldPermissions
    .map((fp) => fp.read)
    .filter((p): p is TablePermission => p !== undefined)

  // Find most permissive field permission
  const mostPermissiveFieldPermission = getMostPermissivePermission(explicitFieldReadPermissions)

  // If the most permissive field permission is a role array (least permissive), default to authenticated
  // This ensures that when only specific roles can access certain fields, unrestricted fields
  // are at least accessible to all authenticated users
  if (mostPermissiveFieldPermission && !Array.isArray(mostPermissiveFieldPermission)) {
    return mostPermissiveFieldPermission
  }

  return 'authenticated'
}

/**
 * Generate role creation and schema grant statements
 */
const generateRoleSetupStatements = (
  roles: readonly string[],
  tableName: string
): readonly string[] => {
  // Filter out PUBLIC role from creation (it's a built-in PostgreSQL role)
  const customRoles = roles.filter((role) => role !== 'PUBLIC')

  const createRoleStatements = customRoles.map(
    (role) => `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} WITH LOGIN;
  END IF;
EXCEPTION
  -- Handle race condition: another process may have created the role
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
END
$$`
  )

  const schemaGrantStatements = roles.map((role) => `GRANT USAGE ON SCHEMA public TO ${role}`)
  const revokeStatements = roles.map((role) => `REVOKE ALL ON ${tableName} FROM ${role}`)

  return [...createRoleStatements, ...schemaGrantStatements, ...revokeStatements]
}

/**
 * Generate write permission grants (UPDATE and INSERT) for fields
 */
const generateWritePermissionGrants = (
  tableName: string,
  databaseColumns: readonly { name: string }[],
  fieldPermissions: readonly { field: string; write?: TablePermission }[],
  tablePermissions: Table['permissions']
): readonly string[] => {
  // Build field permissions map for WRITE (UPDATE/INSERT):
  // - Fields with specific write permissions: use their specific permission
  // - Fields without specific permissions: inherit from table-level create/update permissions
  // - If no table-level write permission, use authenticated as default (more restrictive than read)
  const effectiveWritePermission: TablePermission =
    tablePermissions?.create ?? tablePermissions?.update ?? 'authenticated'

  const allFieldWritePermissions = databaseColumns.map((field) => {
    const fieldPermission = fieldPermissions.find((fp) => fp.field === field.name)
    return {
      field: field.name,
      permission: fieldPermission?.write ?? effectiveWritePermission,
    }
  })

  // Build role-to-fields mapping for write
  const roleFieldsWriteMap = buildRoleFieldsMap(allFieldWritePermissions)
  const writeBaseRoles = extractRoles(effectiveWritePermission)
  const roleFieldsWriteWithBase = addBaseFieldsToRestrictedRoles(roleFieldsWriteMap, writeBaseRoles)

  // Generate UPDATE grant statements
  const columnUpdateGrantStatements = Array.from(roleFieldsWriteWithBase.entries()).map(
    ([role, fields]) => {
      const columnList = fields.map((f) => `"${f}"`).join(', ')
      return `GRANT UPDATE (${columnList}) ON ${tableName} TO ${role}`
    }
  )

  // Generate INSERT grant statements
  const columnInsertGrantStatements = Array.from(roleFieldsWriteWithBase.entries()).map(
    ([role, fields]) => {
      const columnList = fields.map((f) => `"${f}"`).join(', ')
      return `GRANT INSERT (${columnList}) ON ${tableName} TO ${role}`
    }
  )

  return [...columnUpdateGrantStatements, ...columnInsertGrantStatements]
}

/**
 * Build complete field permissions map with defaults
 */
const buildAllFieldPermissions = (
  databaseColumns: readonly { name: string }[],
  fieldPermissions: readonly { field: string; read?: TablePermission }[],
  effectiveTablePermission: TablePermission
): readonly { field: string; permission: TablePermission }[] => {
  return databaseColumns.map((field) => {
    const fieldPermission = fieldPermissions.find((fp) => fp.field === field.name)
    return {
      field: field.name,
      permission: fieldPermission?.read ?? effectiveTablePermission,
    }
  })
}

/**
 * Generate SELECT grant statements for role-based column permissions
 */
const generateColumnSelectGrants = (
  tableName: string,
  roleFieldsWithBase: ReadonlyMap<string, readonly string[]>
): readonly string[] => {
  return Array.from(roleFieldsWithBase.entries()).map(([role, fields]) => {
    const columnList = fields.map((f) => `"${f}"`).join(', ')
    return `GRANT SELECT (${columnList}) ON ${tableName} TO ${role}`
  })
}

/**
 * Generate PostgreSQL column-level GRANT statements for field permissions
 *
 * When a table has field-level read restrictions, this generates:
 * 1. CREATE ROLE statements for roles that don't exist
 * 2. GRANT SELECT on specific columns to roles with access
 * 3. Implicitly denies access to restricted columns (PostgreSQL default)
 *
 * Example:
 * - Table 'users' has columns: id, name, email, salary
 * - Table permission: read = 'authenticated'
 * - Field permission: salary.read = ['admin']
 * - Result:
 *   - CREATE ROLE IF NOT EXISTS authenticated_user
 *   - CREATE ROLE IF NOT EXISTS admin_user
 *   - GRANT SELECT (id, name, email) ON users TO authenticated_user
 *   - GRANT SELECT (id, name, email, salary) ON users TO admin_user
 *
 * @param table - Table definition with field permissions
 * @returns Array of SQL statements (CREATE ROLE + GRANT)
 */
export const generateFieldPermissionGrants = (table: Table): readonly string[] => {
  const tableName = table.name
  const fieldPermissions = table.permissions?.fields ?? []

  if (fieldPermissions.length === 0) {
    return []
  }

  const effectiveTablePermission = getEffectiveTablePermission(
    table.permissions?.read,
    fieldPermissions
  )
  const databaseColumns = table.fields.filter(shouldCreateDatabaseColumn)

  const allFieldPermissions = buildAllFieldPermissions(
    databaseColumns,
    fieldPermissions,
    effectiveTablePermission
  )

  const roleFieldsMap = buildRoleFieldsMap(allFieldPermissions)
  const baseRoles = extractRoles(effectiveTablePermission)
  const roleFieldsWithBase = addBaseFieldsToRestrictedRoles(roleFieldsMap, baseRoles)

  const finalRoles = Array.from(roleFieldsWithBase.keys())
  const roleSetupStatements = generateRoleSetupStatements(finalRoles, tableName)
  const columnGrantStatements = generateColumnSelectGrants(tableName, roleFieldsWithBase)

  const writeGrantStatements = generateWritePermissionGrants(
    tableName,
    databaseColumns,
    fieldPermissions,
    table.permissions
  )

  return [...roleSetupStatements, ...columnGrantStatements, ...writeGrantStatements]
}
