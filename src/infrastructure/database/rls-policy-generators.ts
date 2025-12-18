/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * RLS Policy Generators
 *
 * High-level policy generators for different permission types.
 * Core utilities are in rls-policy-core.ts.
 */

import { logWarning } from '@/infrastructure/logging/effect-logger'
import { translatePermissionCondition } from './permission-condition-translator'
import {
  CRUD_TO_SQL_COMMAND,
  hasAuthenticatedPermissions,
  hasMixedPermissions,
  hasNoPermissions,
  hasOnlyPublicPermissions,
  hasOwnerPermissions,
  hasRecordLevelPermissions,
  hasRolePermissions,
} from './rls-permission-checks'
import {
  generateEnableRLS,
  generatePolicyStatements,
  generateOwnerCheck,
  generateAuthenticatedCheck,
  generateRoleCheck,
  generateDropPolicies,
  generateCreatePolicies,
  generateAuthenticatedPolicyStatements,
  generateRolePolicyStatements,
  generateOwnerPolicyStatements,
  generateOperationCheck,
  generatePolicyName,
} from './rls-policy-core'
import type { Table } from '@/domain/models/app/table'

// Re-export grant functions for backward compatibility
export {
  generateAuthenticatedBasedGrants,
  generateBasicTableGrants,
  generateRoleBasedGrants,
} from './rls-grants'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if table should skip RLS for field-only permissions
 */
const shouldSkipRLSForFieldPermissions = (table: Table): boolean => {
  const hasFieldPermissions = !!(table.permissions?.fields && table.permissions.fields.length > 0)
  const hasRecordPermissions = !!(
    table.permissions?.records && table.permissions.records.length > 0
  )
  return hasFieldPermissions && !hasRecordPermissions
}

/**
 * Generate authenticated checks for all CRUD operations
 */
const generateAuthenticatedChecks = (
  permissions: Table['permissions']
): Readonly<{
  read: string | undefined
  create: string | undefined
  update: string | undefined
  delete: string | undefined
}> => ({
  read: generateAuthenticatedCheck(permissions?.read),
  create: generateAuthenticatedCheck(permissions?.create),
  update: generateAuthenticatedCheck(permissions?.update),
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- permissions.delete is a permission field
  delete: generateAuthenticatedCheck(permissions?.delete),
})

/**
 * Return empty array (no policies)
 */
const returnEmptyPolicies = (): readonly string[] => []

// ============================================================================
// Policy Generators by Permission Type
// ============================================================================

/**
 * Generate RLS policy statements for owner-based permissions
 *
 * When a table has owner-based permissions (e.g., read: { type: 'owner', field: 'owner_id' }),
 * this generates RLS policies that filter records by the specified owner field.
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
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- ownerChecks.delete is a permission field
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
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- ownerChecks.delete is a permission field
    ownerChecks.delete
  )

  return [...enableRLS, ...selectPolicies, ...insertPolicies, ...updatePolicies, ...deletePolicies]
}

/**
 * Generate RLS policy statements for authenticated permissions
 *
 * When a table has authenticated permissions (e.g., read: { type: 'authenticated' }),
 * this generates RLS policies that check if the user is authenticated.
 *
 * @param table - Table definition with authenticated permissions
 * @returns Array of SQL statements to enable RLS and create authenticated policies
 */
const generateAuthenticatedBasedPolicies = (table: Table): readonly string[] => {
  // If table has ONLY field-level permissions (no record-level), skip RLS
  if (shouldSkipRLSForFieldPermissions(table)) {
    return []
  }

  const tableName = table.name
  const enableRLS = generateEnableRLS(tableName)
  const authenticatedChecks = generateAuthenticatedChecks(table.permissions)

  // Generate policies for each CRUD operation
  const selectPolicies = generateAuthenticatedPolicyStatements(
    tableName,
    'read',
    'SELECT',
    authenticatedChecks.read
  )
  const insertPolicies = generateAuthenticatedPolicyStatements(
    tableName,
    'create',
    'INSERT',
    authenticatedChecks.create
  )
  const updatePolicies = generateAuthenticatedPolicyStatements(
    tableName,
    'update',
    'UPDATE',
    authenticatedChecks.update
  )
  const deletePolicies = generateAuthenticatedPolicyStatements(
    tableName,
    'delete',
    'DELETE',
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- authenticatedChecks.delete is a permission field
    authenticatedChecks.delete
  )

  return [...enableRLS, ...selectPolicies, ...insertPolicies, ...updatePolicies, ...deletePolicies]
}

/**
 * Generate RLS policy statements for role-based permissions
 *
 * When a table has role-based permissions (e.g., read: { type: 'roles', roles: ['admin'] }),
 * this generates RLS policies that check the user's role via session variable.
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
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- roleChecks.delete is a permission field
    roleChecks.delete
  )

  return [...enableRLS, ...selectPolicies, ...insertPolicies, ...updatePolicies, ...deletePolicies]
}

/**
 * Generate RLS policy statements for record-level permissions
 *
 * When a table has `permissions.records` array, this generates RLS policies
 * based on custom conditions defined in the schema.
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

  // Group permissions by action to combine multiple conditions with AND
  const permissionsByAction = recordPermissions.reduce(
    (acc, permission) => {
      const existing = acc[permission.action] ?? []
      return { ...acc, [permission.action]: [...existing, permission] }
    },
    {} as Record<string, typeof recordPermissions>
  )

  const policies = Object.entries(permissionsByAction).flatMap(([action, permissions]) => {
    const sqlCommand = CRUD_TO_SQL_COMMAND[action as keyof typeof CRUD_TO_SQL_COMMAND]
    const policyName = `${tableName}_record_${action}`

    // Combine multiple conditions with AND logic
    const translatedConditions = permissions.map((p) => translatePermissionCondition(p.condition))
    const combinedCondition =
      translatedConditions.length === 1
        ? translatedConditions[0]
        : `(${translatedConditions.map((c) => `(${c})`).join(' AND ')})`

    return generatePolicyStatements(tableName, policyName, sqlCommand, combinedCondition)
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
 * Generate default deny RLS policies (no permissions configured)
 *
 * @param tableName - Name of the table
 * @returns Array of SQL statements to enable RLS with no policies
 */
const generateDefaultDenyPolicies = (tableName: string): readonly string[] =>
  generateEnableRLS(tableName)

/**
 * Generate mixed permission policies (authenticated + role-based combinations)
 *
 * When a table has different permission types for different CRUD operations,
 * this generates policies for each operation based on its individual permission type.
 *
 * @param table - Table definition with mixed permissions
 * @returns Array of SQL statements to enable RLS and create mixed policies
 */
const generateMixedPermissionPolicies = (table: Table): readonly string[] => {
  const tableName = table.name
  const enableRLS = generateEnableRLS(tableName)

  // Generate checks and policy names for each operation
  const readCheck = generateOperationCheck(table.permissions?.read)
  const createCheck = generateOperationCheck(table.permissions?.create)
  const updateCheck = generateOperationCheck(table.permissions?.update)
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- permissions.delete is a permission field
  const deleteCheck = generateOperationCheck(table.permissions?.delete)

  const readPolicyName = generatePolicyName(tableName, 'read', table.permissions?.read)
  const createPolicyName = generatePolicyName(tableName, 'create', table.permissions?.create)
  const updatePolicyName = generatePolicyName(tableName, 'update', table.permissions?.update)
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- permissions.delete is a permission field
  const deletePolicyName = generatePolicyName(tableName, 'delete', table.permissions?.delete)

  // Generate policies for each CRUD operation
  const selectPolicies = generatePolicyStatements(tableName, readPolicyName, 'SELECT', readCheck)
  const insertPolicies = generatePolicyStatements(
    tableName,
    createPolicyName,
    'INSERT',
    createCheck
  )
  const updatePolicies = generatePolicyStatements(
    tableName,
    updatePolicyName,
    'UPDATE',
    updateCheck
  )
  const deletePolicies = generatePolicyStatements(
    tableName,
    deletePolicyName,
    'DELETE',
    deleteCheck
  )

  return [...enableRLS, ...selectPolicies, ...insertPolicies, ...updatePolicies, ...deletePolicies]
}

// ============================================================================
// Policy Generator Selection
// ============================================================================

/**
 * Determine which RLS policy generator to use based on table permissions
 *
 * Priority order (first match wins):
 * 1. Public permissions → No RLS
 * 2. No permissions → Default deny
 * 3. Record-level → Custom conditions
 * 4. Mixed permissions → Individual policies per operation
 * 5. Owner-based → Owner field check
 * 6. Authenticated → auth.is_authenticated()
 * 7. Role-based → Role checks
 * 8. Organization-scoped → Organization ID filter
 */
const selectPolicyGenerator = (
  table: Table
  // eslint-disable-next-line complexity
): ((table: Table) => readonly string[]) | (() => readonly string[]) => {
  if (hasOnlyPublicPermissions(table)) {
    return returnEmptyPolicies
  }

  if (hasNoPermissions(table)) {
    const tableName = table.name
    return () => generateDefaultDenyPolicies(tableName)
  }

  if (hasRecordLevelPermissions(table)) {
    return generateRecordLevelPolicies
  }

  // Handle mixed permissions (authenticated read + role create, etc.)
  if (hasMixedPermissions(table)) {
    return generateMixedPermissionPolicies
  }

  if (hasOwnerPermissions(table)) {
    return generateOwnerBasedPolicies
  }

  if (hasAuthenticatedPermissions(table) && !table.permissions?.organizationScoped) {
    return generateAuthenticatedBasedPolicies
  }

  if (hasRolePermissions(table) && !table.permissions?.organizationScoped) {
    return generateRoleBasedPolicies
  }

  if (table.permissions?.organizationScoped) {
    return generateOrganizationScopedPolicies
  }

  return returnEmptyPolicies
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Generate RLS policy statements for tables with various permission types
 *
 * Supports the following permission configurations:
 *
 * 1. **Public permissions** (e.g., read: { type: 'public' }):
 *    - No RLS is enabled
 *    - All access is unrestricted
 *
 * 2. **No permissions** (default deny):
 *    - Enables RLS with no policies
 *    - All access is blocked
 *
 * 3. **Record-level permissions** (permissions.records array):
 *    - Custom RLS conditions defined per CRUD action
 *    - Supports variable substitution: {userId}, {organizationId}
 *
 * 4. **Owner-based permissions** (e.g., read: { type: 'owner', field: 'owner_id' }):
 *    - Filters records by the specified owner field
 *
 * 5. **Authenticated permissions** (e.g., update: { type: 'authenticated' }):
 *    - Checks if user is authenticated via auth.is_authenticated()
 *
 * 6. **Role-based permissions** (e.g., read: { type: 'roles', roles: ['admin'] }):
 *    - Checks user's role via current_setting('app.user_role')
 *
 * 7. **Organization-scoped** (permissions.organizationScoped: true):
 *    - Filters by organization_id using current_setting('app.organization_id')
 *
 * @param table - Table definition with permissions
 * @returns Array of SQL statements to enable RLS and create policies
 */
export const generateRLSPolicyStatements = (table: Table): readonly string[] => {
  const generator = selectPolicyGenerator(table)
  return generator(table)
}
