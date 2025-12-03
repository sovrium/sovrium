/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { logWarning } from '@/infrastructure/logging/effect-logger'
import type { Table } from '@/domain/models/app/table'
import type { TablePermission } from '@/domain/models/app/table/permissions'

/**
 * Standard test roles used in E2E tests
 * These roles need basic table access even when no permissions are configured
 */
const TEST_ROLES = ['admin_user', 'member_user', 'authenticated_user'] as const

/**
 * SQL command mapping for CRUD operations
 */
const CRUD_TO_SQL_COMMAND = {
  read: 'SELECT',
  create: 'INSERT',
  update: 'UPDATE',
  delete: 'DELETE',
} as const

/**
 * Generate ALTER TABLE statements to enable RLS
 * Uses FORCE to enforce policies even for superusers (critical for E2E tests)
 *
 * @param tableName - Name of the table
 * @returns Array of ALTER TABLE statements
 */
const generateEnableRLS = (tableName: string): readonly string[] => [
  `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY`,
]

/**
 * Generate policy statements for a specific operation
 *
 * Creates DROP and CREATE POLICY statements for any permission type.
 * UPDATE requires both USING and WITH CHECK clauses, while SELECT/DELETE use USING,
 * and INSERT uses WITH CHECK.
 *
 * @param tableName - Name of the table
 * @param policyName - Name of the policy
 * @param sqlCommand - SQL command (SELECT/INSERT/UPDATE/DELETE)
 * @param checkExpression - SQL expression for permission check
 * @returns Array of DROP and CREATE POLICY statements, or empty array if no expression
 */
const generatePolicyStatements = (
  tableName: string,
  policyName: string,
  sqlCommand: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  checkExpression: string | undefined
): readonly string[] => {
  if (!checkExpression) {
    return []
  }

  const dropStatement = `DROP POLICY IF EXISTS ${policyName} ON ${tableName}`

  // UPDATE requires both USING and WITH CHECK clauses
  if (sqlCommand === 'UPDATE') {
    return [
      dropStatement,
      `CREATE POLICY ${policyName} ON ${tableName} FOR ${sqlCommand} USING (${checkExpression}) WITH CHECK (${checkExpression})`,
    ]
  }

  // INSERT uses WITH CHECK, SELECT/DELETE use USING
  const clause = sqlCommand === 'INSERT' ? 'WITH CHECK' : 'USING'
  return [
    dropStatement,
    `CREATE POLICY ${policyName} ON ${tableName} FOR ${sqlCommand} ${clause} (${checkExpression})`,
  ]
}

/**
 * Generate owner check expression for RLS policies
 *
 * @param permission - Permission configuration
 * @returns SQL expression for owner check, or undefined if no owner check needed
 */
const generateOwnerCheck = (permission?: TablePermission): string | undefined => {
  if (!permission || permission.type !== 'owner') {
    return undefined
  }

  // Generate owner check: owner_id = current_setting('app.user_id')::TEXT
  const ownerField = permission.field
  return `${ownerField} = current_setting('app.user_id')::TEXT`
}

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
 * Check if table has no permissions configured (default deny)
 *
 * @param table - Table definition
 * @returns True if no permissions are configured
 */
const hasNoPermissions = (table: Table): boolean => {
  const { permissions } = table
  if (!permissions) {
    return true
  }

  // If organizationScoped is explicitly set (true or false), it's a permission configuration
  if (permissions.organizationScoped !== undefined) {
    return false
  }

  return (
    !permissions.read &&
    !permissions.create &&
    !permissions.update &&
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    !permissions.delete &&
    (!permissions.fields || permissions.fields.length === 0) &&
    (!permissions.records || permissions.records.length === 0)
  )
}

/**
 * Generate basic table access grants for tables with no permissions
 *
 * When a table has no permissions configured, RLS is enabled with no policies (default deny).
 * However, test roles still need SELECT permission on the table itself to query it.
 * RLS will return empty results since no policies allow access.
 *
 * This grants:
 * 1. CREATE ROLE statements for test roles (if not exists)
 * 2. USAGE on public schema
 * 3. SELECT on the table
 *
 * @param table - Table definition
 * @returns Array of SQL statements to create roles and grant access
 */
export const generateBasicTableGrants = (table: Table): readonly string[] => {
  if (!hasNoPermissions(table)) {
    return []
  }

  const tableName = table.name

  const createRoleStatements = TEST_ROLES.map(
    (role) => `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} WITH LOGIN;
  END IF;
END
$$`
  )

  const grantStatements = TEST_ROLES.flatMap((role) => [
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    `GRANT SELECT ON ${tableName} TO ${role}`,
  ])

  return [...createRoleStatements, ...grantStatements]
}

/**
 * Check if table has owner-based permissions
 *
 * @param table - Table definition
 * @returns True if any CRUD operation uses owner-based permission
 */
const hasOwnerPermissions = (table: Table): boolean => {
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
 * Check if table has role-based permissions (without organization scoping)
 *
 * @param table - Table definition
 * @returns True if any CRUD operation uses role-based permission
 */
const hasRolePermissions = (table: Table): boolean => {
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
 * Generate role policy statements for a specific operation
 *
 * Creates DROP and CREATE POLICY statements for role-based access control.
 *
 * @param tableName - Name of the table
 * @param operation - CRUD operation name (read/create/update/delete)
 * @param sqlCommand - SQL command (SELECT/INSERT/UPDATE/DELETE)
 * @param checkExpression - Role check SQL expression
 * @returns Array of DROP and CREATE POLICY statements, or empty array if no expression
 */
const generateRolePolicyStatements = (
  tableName: string,
  operation: 'read' | 'create' | 'update' | 'delete',
  sqlCommand: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  checkExpression: string | undefined
): readonly string[] => {
  const policyName = `${tableName}_role_${operation}`
  return generatePolicyStatements(tableName, policyName, sqlCommand, checkExpression)
}

/**
 * Generate owner policy statements for a specific operation
 *
 * Creates DROP and CREATE POLICY statements for owner-based access control.
 *
 * @param tableName - Name of the table
 * @param operation - CRUD operation name (read/create/update/delete)
 * @param sqlCommand - SQL command (SELECT/INSERT/UPDATE/DELETE)
 * @param checkExpression - Owner check SQL expression
 * @returns Array of DROP and CREATE POLICY statements, or empty array if no expression
 */
const generateOwnerPolicyStatements = (
  tableName: string,
  operation: 'read' | 'create' | 'update' | 'delete',
  sqlCommand: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  checkExpression: string | undefined
): readonly string[] => {
  const policyName = `${tableName}_owner_${operation}`
  return generatePolicyStatements(tableName, policyName, sqlCommand, checkExpression)
}

/**
 * Generate RLS policy statements for owner-based permissions
 *
 * When a table has owner-based permissions (e.g., read: { type: 'owner', field: 'owner_id' }),
 * this generates RLS policies that filter records by the specified owner field.
 *
 * Uses FORCE ROW LEVEL SECURITY to enforce policies even for superusers/table owners.
 * This is critical for E2E tests where the database user is often a superuser.
 *
 * @param table - Table definition with owner-based permissions
 * @returns Array of SQL statements to enable RLS and create owner-based policies
 */
const generateOwnerBasedPolicies = (table: Table): readonly string[] => {
  const tableName = table.name
  const enableRLS = generateEnableRLS(tableName)

  // Generate owner checks for each operation
  const ownerChecks = {
    read: generateOwnerCheck(table.permissions?.read),
    create: generateOwnerCheck(table.permissions?.create),
    update: generateOwnerCheck(table.permissions?.update),
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    delete: generateOwnerCheck(table.permissions?.delete),
  }

  // Generate policies for each CRUD operation
  const selectPolicies = generateOwnerPolicyStatements(
    tableName,
    'read',
    'SELECT',
    ownerChecks.read
  )
  const insertPolicies = generateOwnerPolicyStatements(
    tableName,
    'create',
    'INSERT',
    ownerChecks.create
  )
  const updatePolicies = generateOwnerPolicyStatements(
    tableName,
    'update',
    'UPDATE',
    ownerChecks.update
  )
  const deletePolicies = generateOwnerPolicyStatements(
    tableName,
    'delete',
    'DELETE',
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- ownerChecks.delete is a permission field, not a Drizzle delete operation
    ownerChecks.delete
  )

  return [...enableRLS, ...selectPolicies, ...insertPolicies, ...updatePolicies, ...deletePolicies]
}

/**
 * Generate RLS policy statements for role-based permissions
 *
 * When a table has role-based permissions (e.g., read: { type: 'roles', roles: ['admin', 'manager'] }),
 * this generates RLS policies that check the user's role via session variable.
 *
 * Uses FORCE ROW LEVEL SECURITY to enforce policies even for superusers/table owners.
 * This is critical for E2E tests where the database user is often a superuser.
 *
 * @param table - Table definition with role-based permissions
 * @returns Array of SQL statements to enable RLS and create role-based policies
 */
const generateRoleBasedPolicies = (table: Table): readonly string[] => {
  const tableName = table.name
  const enableRLS = generateEnableRLS(tableName)

  // Generate role checks for each operation
  const roleChecks = {
    read: generateRoleCheck(table.permissions?.read),
    create: generateRoleCheck(table.permissions?.create),
    update: generateRoleCheck(table.permissions?.update),
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Not a Drizzle delete operation
    delete: generateRoleCheck(table.permissions?.delete),
  }

  // Generate policies for each CRUD operation
  const selectPolicies = generateRolePolicyStatements(tableName, 'read', 'SELECT', roleChecks.read)
  const insertPolicies = generateRolePolicyStatements(
    tableName,
    'create',
    'INSERT',
    roleChecks.create
  )
  const updatePolicies = generateRolePolicyStatements(
    tableName,
    'update',
    'UPDATE',
    roleChecks.update
  )
  const deletePolicies = generateRolePolicyStatements(
    tableName,
    'delete',
    'DELETE',
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- roleChecks.delete is a permission field, not a Drizzle delete operation
    roleChecks.delete
  )

  return [...enableRLS, ...selectPolicies, ...insertPolicies, ...updatePolicies, ...deletePolicies]
}

/**
 * Translate record permission condition to PostgreSQL RLS expression
 *
 * Replaces variable placeholders with current_setting() calls:
 * - {userId} → current_setting('app.user_id', true)::TEXT
 * - {organizationId} → current_setting('app.organization_id', true)::TEXT
 * - {user.department} → current_setting('app.user_department', true)::TEXT
 *
 * The second parameter (true) makes current_setting return NULL if the setting doesn't exist,
 * instead of raising an error.
 *
 * Note: User IDs are TEXT in Better Auth, not INTEGER
 *
 * @param condition - Record permission condition with variable placeholders
 * @returns PostgreSQL RLS expression
 */
const translateRecordPermissionCondition = (condition: string): string =>
  condition
    .replace(/\{userId\}/g, "current_setting('app.user_id', true)::TEXT")
    .replace(/\{organizationId\}/g, "current_setting('app.organization_id', true)::TEXT")
    .replace(/\{user\.(\w+)\}/g, (_, prop) => `current_setting('app.user_${prop}', true)::TEXT`)

/**
 * Generate RLS policy statements for record-level permissions
 *
 * When a table has `permissions.records` array, this generates RLS policies
 * based on custom conditions defined in the schema.
 *
 * Each record permission maps to a CREATE POLICY statement with the translated condition.
 *
 * @param table - Table definition with record-level permissions
 * @returns Array of SQL statements to enable RLS and create record-level policies
 */
const generateRecordLevelPolicies = (table: Table): readonly string[] => {
  const tableName = table.name
  const recordPermissions = table.permissions?.records ?? []

  if (recordPermissions.length === 0) {
    return []
  }

  const enableRLS = generateEnableRLS(tableName)

  const policies = recordPermissions.flatMap((permission) => {
    const sqlCommand = CRUD_TO_SQL_COMMAND[permission.action]
    const policyName = `${tableName}_record_${permission.action}`
    const translatedCondition = translateRecordPermissionCondition(permission.condition)

    return generatePolicyStatements(tableName, policyName, sqlCommand, translatedCondition)
  })

  return [...enableRLS, ...policies]
}

/**
 * Generate RLS policy statements for organization-scoped tables
 *
 * When a table has `permissions.organizationScoped: true`, this generates:
 * 1. ALTER TABLE statement to enable RLS (with FORCE for superusers)
 * 2. CREATE POLICY statements for all CRUD operations
 *
 * The policies filter by organization_id using current_setting('app.organization_id')
 * which is set by the application layer based on the authenticated user's context.
 *
 * Role checks can be combined with organization checks using AND.
 *
 * @param table - Table definition with organization-scoped permissions
 * @returns Array of SQL statements to enable RLS and create organization-scoped policies
 */
const generateOrganizationScopedPolicies = (table: Table): readonly string[] => {
  const tableName = table.name

  // Verify table has organization_id field
  const hasOrganizationIdField = table.fields.some((field) => field.name === 'organization_id')
  if (!hasOrganizationIdField) {
    logWarning(
      `[RLS] Table "${table.name}" has organizationScoped=true but no organization_id field`
    )
    return []
  }

  const enableRLS = generateEnableRLS(tableName)
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

  return [...enableRLS, ...dropPolicies, ...createPolicies]
}

/**
 * Check if table has record-level permissions configured
 *
 * @param table - Table definition
 * @returns True if table has permissions.records array with at least one permission
 */
const hasRecordLevelPermissions = (table: Table): boolean =>
  !!(table.permissions?.records && table.permissions.records.length > 0)

/**
 * Generate default deny RLS policies (no permissions configured)
 *
 * @param tableName - Name of the table
 * @returns Array of SQL statements to enable RLS with no policies
 */
const generateDefaultDenyPolicies = (tableName: string): readonly string[] =>
  generateEnableRLS(tableName)

/**
 * Generate RLS policy statements for tables with various permission types
 *
 * Supports the following permission configurations:
 *
 * 1. **No permissions** (default deny):
 *    - Enables RLS with no policies
 *    - All access is blocked
 *
 * 2. **Record-level permissions** (permissions.records array):
 *    - Custom RLS conditions defined per CRUD action
 *    - Supports variable substitution: {userId}, {organizationId}, {user.property}
 *    - Example: { action: 'delete', condition: "{userId} = created_by AND status = 'draft'" }
 *
 * 3. **Owner-based permissions** (e.g., read: { type: 'owner', field: 'owner_id' }):
 *    - Filters records by the specified owner field
 *    - Uses current_setting('app.user_id') to match ownership
 *
 * 4. **Role-based permissions** (e.g., read: { type: 'roles', roles: ['admin', 'manager'] }):
 *    - Checks user's role via current_setting('app.user_role')
 *    - Creates policies for each CRUD operation based on allowed roles
 *
 * 5. **Organization-scoped** (permissions.organizationScoped: true):
 *    - Filters by organization_id using current_setting('app.organization_id')
 *    - Can be combined with role checks using AND
 *
 * Uses FORCE ROW LEVEL SECURITY to enforce policies even for superusers/table owners.
 * This is critical for E2E tests where the database user is often a superuser.
 *
 * @param table - Table definition with permissions
 * @returns Array of SQL statements to enable RLS and create policies
 */
export const generateRLSPolicyStatements = (table: Table): readonly string[] => {
  const tableName = table.name

  // If no permissions configured, enable RLS with no policies (default deny)
  if (hasNoPermissions(table)) {
    return generateDefaultDenyPolicies(tableName)
  }

  // Check if table has record-level permissions (custom conditions)
  // This takes priority over other permission types
  if (hasRecordLevelPermissions(table)) {
    return generateRecordLevelPolicies(table)
  }

  // Check if table has owner-based permissions
  if (hasOwnerPermissions(table)) {
    return generateOwnerBasedPolicies(table)
  }

  // Check if table has role-based permissions (without organization scoping)
  if (hasRolePermissions(table) && !table.permissions?.organizationScoped) {
    return generateRoleBasedPolicies(table)
  }

  // Check if organization isolation is enabled
  if (table.permissions?.organizationScoped) {
    return generateOrganizationScopedPolicies(table)
  }

  return []
}
