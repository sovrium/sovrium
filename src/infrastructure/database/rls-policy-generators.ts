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
  hasExplicitEmptyPermissions,
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
 * Check if table should skip table-level RLS policies for SELECT
 *
 * Skip table-level SELECT policies ONLY when:
 * - Field permissions exist with ONLY role-based permissions (not custom/owner)
 * - No record-level permissions exist
 *
 * Rationale: Column-level GRANT statements only handle static role-based field
 * access. Custom/owner field permissions require RLS at the row level.
 * Empty array ([]) means "no field restrictions" and table-level RLS applies.
 *
 * IMPORTANT: This only affects SELECT policies. UPDATE/DELETE/CREATE policies
 * must still be generated based on table-level permissions.
 */
const shouldSkipRLSForFieldPermissions = (table: Table): boolean => {
  const hasActualFieldPermissions = !!(
    table.permissions?.fields && table.permissions.fields.length > 0
  )
  const hasRecordPermissions = !!(
    table.permissions?.records && table.permissions.records.length > 0
  )

  // If no field permissions, don't skip RLS
  if (!hasActualFieldPermissions) {
    return false
  }

  // If record permissions exist, don't skip RLS (records need RLS)
  if (hasRecordPermissions) {
    return false
  }

  // Check if any field permission uses custom/owner type (requires RLS)
  const hasCustomFieldPermissions = table.permissions?.fields?.some(
    (fp) =>
      fp.read?.type === 'custom' ||
      fp.read?.type === 'owner' ||
      fp.write?.type === 'custom' ||
      fp.write?.type === 'owner'
  )

  // If custom field permissions exist, we need RLS for the custom read policy
  // but we still need table-level policies for UPDATE/DELETE/CREATE
  // Return false to NOT skip RLS generation
  if (hasCustomFieldPermissions) {
    return false
  }

  // Only role-based field permissions - column-level GRANTs handle access
  return true
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
 * Check if table has custom/owner field read permissions
 * These require special handling - the custom field read RLS policy handles SELECT
 */
// @ts-expect-error - Preserved for future implementation
const _hasCustomFieldReadPermissions = (table: Table): boolean =>
  table.permissions?.fields?.some(
    (fp) => fp.read?.type === 'custom' || fp.read?.type === 'owner'
  ) ?? false

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
 * Compute effective read check for role-based policies
 *
 * If no explicit read permission exists but update/delete permissions are defined,
 * this allows SELECT for those roles (UPDATE/DELETE require SELECT first).
 */
const computeEffectiveReadCheck = (
  roleChecks: Readonly<{
    read: string | undefined
    update: string | undefined
    del: string | undefined
  }>
): string | undefined => {
  if (roleChecks.read) {
    return roleChecks.read
  }

  if (!roleChecks.update && !roleChecks.del) {
    return undefined
  }

  const checks = [
    ...(roleChecks.update ? [roleChecks.update] : []),
    ...(roleChecks.del ? [roleChecks.del] : []),
  ].filter((check): check is string => Boolean(check))

  return checks.length > 0 ? checks.join(' OR ') : undefined
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
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- permissions.delete is a permission field
    del: generateRoleCheck(table.permissions?.delete),
  }

  const effectiveReadCheck = computeEffectiveReadCheck(roleChecks)

  // Generate policies for each CRUD operation
  const selectPolicies = generateRolePolicyStatements(
    tableName,
    'read',
    'SELECT',
    effectiveReadCheck
  )
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
  const deletePolicies = generateRolePolicyStatements(tableName, 'delete', 'DELETE', roleChecks.del)

  return [...enableRLS, ...selectPolicies, ...insertPolicies, ...updatePolicies, ...deletePolicies]
}

/**
 * Generate RLS policy statements for record-level permissions
 *
 * When a table has `permissions.records` array, this generates RLS policies
 * based on custom conditions defined in the schema.
 *
 * If table-level role-based permissions also exist, they are combined with
 * record-level conditions using AND logic (both must be satisfied).
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

  // Generate role checks for table-level permissions (complementary filtering)
  const roleChecks = {
    read: generateRoleCheck(table.permissions?.read),
    create: generateRoleCheck(table.permissions?.create),
    update: generateRoleCheck(table.permissions?.update),
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- permissions.delete is a permission field
    delete: generateRoleCheck(table.permissions?.delete),
  }

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

    // Combine multiple record-level conditions with AND logic
    const translatedConditions = permissions.map((p) => translatePermissionCondition(p.condition))
    const recordCondition =
      translatedConditions.length === 1
        ? translatedConditions[0]
        : `(${translatedConditions.map((c) => `(${c})`).join(' AND ')})`

    // Get role check for this action
    const roleCheck = roleChecks[action as keyof typeof roleChecks]

    // Combine role check with record-level condition if both exist
    const finalCondition = roleCheck ? `(${roleCheck}) AND (${recordCondition})` : recordCondition

    return generatePolicyStatements(tableName, policyName, sqlCommand, finalCondition)
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
  const orgIdCheck = `organization_id = current_setting('app.organization_id', true)::TEXT`

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
 * Generate default policies for tables with NO permissions object (undefined)
 *
 * When a table has `permissions: undefined` (not even an empty object), we:
 * 1. Enable RLS with FORCE
 * 2. Create policies allowing the `app_user` role (used by withSessionContext)
 *
 * This is different from explicit empty permissions `permissions: {}` which
 * creates ZERO policies (true default deny, all access blocked).
 *
 * Use case: Developer hasn't configured permissions yet, but API should work.
 *
 * @param tableName - Name of the table
 * @returns Array of SQL statements to enable RLS and allow app_user role
 */
const generateDefaultDenyPolicies = (tableName: string): readonly string[] => {
  const enableRLS = generateEnableRLS(tableName)

  // Allow authenticated users (identified by app.user_id session variable)
  // This enables authenticated API access while blocking direct database access
  // Note: We use session variables instead of current_user because SET ROLE may not work reliably in all environments
  const authenticatedCheck = `current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) != ''`

  const selectPolicies = generatePolicyStatements(
    tableName,
    `${tableName}_authenticated_select`,
    'SELECT',
    authenticatedCheck
  )
  const insertPolicies = generatePolicyStatements(
    tableName,
    `${tableName}_authenticated_insert`,
    'INSERT',
    authenticatedCheck
  )
  const updatePolicies = generatePolicyStatements(
    tableName,
    `${tableName}_authenticated_update`,
    'UPDATE',
    authenticatedCheck
  )
  const deletePolicies = generatePolicyStatements(
    tableName,
    `${tableName}_authenticated_delete`,
    'DELETE',
    authenticatedCheck
  )

  return [...enableRLS, ...selectPolicies, ...insertPolicies, ...updatePolicies, ...deletePolicies]
}

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
 * Check if table has ONLY field permissions (no row-level permissions)
 * In this case, field-level filtering happens at the application layer,
 * but we still need RLS policies to allow app_user role to access rows
 */
const hasOnlyFieldPermissions = (table: Table): boolean => {
  const { permissions } = table
  return Boolean(
    permissions?.fields &&
    permissions.fields.length > 0 &&
    !permissions.read &&
    !permissions.create &&
    !permissions.update &&
    // eslint-disable-next-line drizzle/enforce-delete-with-where -- Checking property, not calling delete method
    !permissions.delete &&
    !permissions.records
  )
}

/**
 * Determine which RLS policy generator to use based on table permissions
 *
 * Priority order (first match wins):
 * 1. Public permissions → No RLS
 * 2. Explicit empty permissions {} → Only enable RLS (true deny, 0 policies)
 * 3. No permissions undefined → Allow API access (app_user policies)
 * 4. Record-level → Custom conditions
 * 5. Mixed permissions → Individual policies per operation
 * 6. Owner-based → Owner field check
 * 7. Authenticated → auth.is_authenticated()
 * 8. Role-based → Role checks
 * 9. Organization-scoped → Organization ID filter
 * 10. Field-only permissions → Default deny with app_user access
 */
const selectPolicyGenerator = (
  table: Table
  // eslint-disable-next-line complexity
): ((table: Table) => readonly string[]) | (() => readonly string[]) => {
  if (hasOnlyPublicPermissions(table)) return returnEmptyPolicies
  if (hasExplicitEmptyPermissions(table)) return () => generateEnableRLS(table.name)
  if (hasNoPermissions(table)) return () => generateDefaultDenyPolicies(table.name)
  if (hasRecordLevelPermissions(table)) return generateRecordLevelPolicies
  if (hasMixedPermissions(table)) return generateMixedPermissionPolicies
  if (hasOwnerPermissions(table)) return generateOwnerBasedPolicies
  if (hasAuthenticatedPermissions(table) && !table.permissions?.organizationScoped) {
    return generateAuthenticatedBasedPolicies
  }
  if (hasRolePermissions(table) && !table.permissions?.organizationScoped) {
    return generateRoleBasedPolicies
  }
  if (table.permissions?.organizationScoped) return generateOrganizationScopedPolicies
  if (hasOnlyFieldPermissions(table)) return () => generateDefaultDenyPolicies(table.name)
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
 * 2. **Explicit empty permissions** (permissions: {}):
 *    - Enables RLS with FORCE
 *    - Creates ZERO policies
 *    - All access is blocked (true default deny)
 *
 * 3. **No permissions object** (permissions: undefined):
 *    - Enables RLS with FORCE
 *    - Creates policies allowing app_user role
 *    - API access works, direct DB access is blocked
 *
 * 4. **Record-level permissions** (permissions.records array):
 *    - Custom RLS conditions defined per CRUD action
 *    - Supports variable substitution: {userId}, {organizationId}
 *
 * 5. **Owner-based permissions** (e.g., read: { type: 'owner', field: 'owner_id' }):
 *    - Filters records by the specified owner field
 *
 * 6. **Authenticated permissions** (e.g., update: { type: 'authenticated' }):
 *    - Checks if user is authenticated via auth.is_authenticated()
 *
 * 7. **Role-based permissions** (e.g., read: { type: 'roles', roles: ['admin'] }):
 *    - Checks user's role via current_setting('app.user_role')
 *
 * 8. **Organization-scoped** (permissions.organizationScoped: true):
 *    - Filters by organization_id using current_setting('app.organization_id')
 *
 * @param table - Table definition with permissions
 * @returns Array of SQL statements to enable RLS and create policies
 */
export const generateRLSPolicyStatements = (table: Table): readonly string[] => {
  const generator = selectPolicyGenerator(table)
  const statements = generator(table)
  console.log(`[RLS-GEN] Table: ${table.name}`)
  console.log(`[RLS-GEN] Policies count: ${statements.length}`)
  console.log(`[RLS-GEN] First 3 policies:`)
  statements.slice(0, 3).forEach((stmt, i) => {
    console.log(`  [${i}] ${stmt.substring(0, 150)}...`)
  })
  return statements
}
