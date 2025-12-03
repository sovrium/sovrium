/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Table } from '@/domain/models/app/table'
import type { TablePermission } from '@/domain/models/app/table/permissions'

/**
 * Generate role check expression for RLS policies
 *
 * @param permission - Permission configuration
 * @returns SQL expression for role check, or undefined if no role check needed
 */
const generateRoleCheck = (permission?: TablePermission): string | undefined => {
  if (!permission || permission.type !== 'roles') {
    return undefined
  }

  // Generate OR'd role checks: (role = 'admin' OR role = 'member')
  const roleChecks = permission.roles
    .map((role) => `current_setting('app.user_role')::TEXT = '${role}'`)
    .join(' OR ')

  return `(${roleChecks})`
}

/**
 * Combine organization and role checks
 *
 * @param orgIdCheck - Organization ID check expression
 * @param roleCheck - Role check expression (optional)
 * @returns Combined SQL expression
 */
const combineChecks = (orgIdCheck: string, roleCheck: string | undefined): string => {
  if (!roleCheck) {
    return orgIdCheck
  }

  return `${orgIdCheck} AND ${roleCheck}`
}

/**
 * Generate DROP POLICY statements for a table
 *
 * @param tableName - Name of the table
 * @returns Array of DROP POLICY statements
 */
const generateDropPolicies = (tableName: string): readonly string[] => [
  `DROP POLICY IF EXISTS ${tableName}_org_select ON ${tableName}`,
  `DROP POLICY IF EXISTS ${tableName}_org_insert ON ${tableName}`,
  `DROP POLICY IF EXISTS ${tableName}_org_update ON ${tableName}`,
  `DROP POLICY IF EXISTS ${tableName}_org_delete ON ${tableName}`,
]

/**
 * Generate CREATE POLICY statements for a table
 *
 * @param tableName - Name of the table
 * @param orgIdCheck - Organization ID check expression
 * @param roleChecks - Role checks for each operation
 * @returns Array of CREATE POLICY statements
 */
const generateCreatePolicies = (
  tableName: string,
  orgIdCheck: string,
  roleChecks: Readonly<{
    read: string | undefined
    create: string | undefined
    update: string | undefined
    delete: string | undefined
  }>
): readonly string[] => {
  const selectCheck = combineChecks(orgIdCheck, roleChecks.read)
  const insertCheck = combineChecks(orgIdCheck, roleChecks.create)
  const updateCheck = combineChecks(orgIdCheck, roleChecks.update)
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
  const deleteCheck = combineChecks(orgIdCheck, roleChecks.delete)

  return [
    `CREATE POLICY ${tableName}_org_select ON ${tableName} FOR SELECT USING (${selectCheck})`,
    `CREATE POLICY ${tableName}_org_insert ON ${tableName} FOR INSERT WITH CHECK (${insertCheck})`,
    `CREATE POLICY ${tableName}_org_update ON ${tableName} FOR UPDATE USING (${updateCheck}) WITH CHECK (${updateCheck})`,
    `CREATE POLICY ${tableName}_org_delete ON ${tableName} FOR DELETE USING (${deleteCheck})`,
  ]
}

/**
 * Generate RLS policy statements for organization-scoped tables
 *
 * When a table has `permissions.organizationScoped: true`, this generates:
 * 1. ALTER TABLE statement to enable RLS
 * 2. CREATE POLICY statements for all CRUD operations
 *
 * The policies filter by organization_id using current_setting('app.organization_id')
 * which is set by the application layer based on the authenticated user's context.
 *
 * Additionally supports role-based permissions when permissions.read/create/update/delete
 * are configured with type: 'roles'. Role checks are combined with organization checks using AND.
 *
 * @param table - Table definition with permissions
 * @returns Array of SQL statements to enable RLS and create policies
 */
export const generateRLSPolicyStatements = (table: Table): readonly string[] => {
  // Check if organization isolation is enabled
  const isOrganizationScoped = table.permissions?.organizationScoped === true

  if (!isOrganizationScoped) {
    return []
  }

  // Verify table has organization_id field
  const hasOrganizationIdField = table.fields.some((field) => field.name === 'organization_id')
  if (!hasOrganizationIdField) {
    console.warn(
      `[RLS] Table "${table.name}" has organizationScoped=true but no organization_id field`
    )
    return []
  }

  const tableName = table.name
  const enableRLS = `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`
  const orgIdCheck = `organization_id = current_setting('app.organization_id')::TEXT`

  const roleChecks = {
    read: generateRoleCheck(table.permissions?.read),
    create: generateRoleCheck(table.permissions?.create),
    update: generateRoleCheck(table.permissions?.update),
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    delete: generateRoleCheck(table.permissions?.delete),
  }

  const dropPolicies = generateDropPolicies(tableName)
  const createPolicies = generateCreatePolicies(tableName, orgIdCheck, roleChecks)

  return [enableRLS, ...dropPolicies, ...createPolicies]
}
