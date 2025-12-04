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
  if (permission.type === 'roles') {
    // Map role names to PostgreSQL roles: 'admin' -> 'admin_user'
    return permission.roles.map((role) => `${role}_user`)
  }
  if (permission.type === 'authenticated') {
    return ['authenticated_user']
  }
  if (permission.type === 'public') {
    // Public permissions grant access to everyone including unauthenticated users
    // PostgreSQL PUBLIC pseudo-role represents all users
    return ['PUBLIC', 'authenticated_user', 'admin_user', 'member_user']
  }
  return []
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
 * Generate PostgreSQL column-level GRANT statements for field permissions
 *
 * When a table has field-level read restrictions, this generates:
 * 1. CREATE ROLE statements for roles that don't exist
 * 2. GRANT SELECT on specific columns to roles with access
 * 3. Implicitly denies access to restricted columns (PostgreSQL default)
 *
 * Example:
 * - Table 'users' has columns: id, name, email, salary
 * - Field permission: salary.read = { type: 'roles', roles: ['admin'] }
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

  // If no field permissions configured, grant full access
  if (fieldPermissions.length === 0) {
    return []
  }

  // Map fields to their read permissions
  const tableReadPermission = table.permissions?.read

  const baseFieldPermissions = table.fields
    .filter(shouldCreateDatabaseColumn)
    .map((field) => ({ field: field.name, permission: tableReadPermission }))

  const overriddenFieldPermissions = fieldPermissions
    .filter((fp) => fp.read)
    .map((fp) => ({ field: fp.field, permission: fp.read }))

  // Merge base and overridden permissions (override wins)
  const allFieldPermissions = baseFieldPermissions.map((base) => {
    const override = overriddenFieldPermissions.find((o) => o.field === base.field)
    return override ?? base
  })

  // Build role-to-fields mapping
  const roleFieldsMap = buildRoleFieldsMap(allFieldPermissions)

  // Add base fields to restricted roles
  const baseRoles = tableReadPermission ? extractRoles(tableReadPermission) : []
  const roleFieldsWithBase = addBaseFieldsToRestrictedRoles(roleFieldsMap, baseRoles)

  // Generate SQL statements
  const finalRoles = Array.from(roleFieldsWithBase.keys())

  // Filter out PUBLIC role from creation (it's a built-in PostgreSQL role)
  const customRoles = finalRoles.filter((role) => role !== 'PUBLIC')

  const createRoleStatements = customRoles.map(
    (role) => `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} WITH LOGIN;
  END IF;
END
$$`
  )

  const schemaGrantStatements = finalRoles.map((role) => `GRANT USAGE ON SCHEMA public TO ${role}`)

  const columnGrantStatements = Array.from(roleFieldsWithBase.entries()).map(([role, fields]) => {
    const columnList = fields.map((f) => `"${f}"`).join(', ')
    return `GRANT SELECT (${columnList}) ON ${tableName} TO ${role}`
  })

  return [...createRoleStatements, ...schemaGrantStatements, ...columnGrantStatements]
}
