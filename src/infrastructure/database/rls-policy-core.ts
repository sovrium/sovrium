/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Core RLS policy generation utilities
 *
 * This module contains low-level SQL generation functions for RLS policies.
 * Higher-level policy generators are in rls-policy-generators.ts.
 */

import { translatePermissionCondition } from './permission-condition-translator'
import type { TablePermission } from '@/domain/models/app/table/permissions'

// ============================================================================
// Core RLS Utilities
// ============================================================================

/**
 * Generate ALTER TABLE statements to enable RLS
 * Uses FORCE to enforce policies even for superusers (critical for E2E tests)
 *
 * @param tableName - Name of the table
 * @returns Array of ALTER TABLE statements
 */
export const generateEnableRLS = (tableName: string): readonly string[] => [
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
export const generatePolicyStatements = (
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

// ============================================================================
// Check Expression Generators
// ============================================================================

/**
 * Generate owner check expression for RLS policies
 *
 * @param permission - Permission configuration
 * @returns SQL expression for owner check, or undefined if no owner check needed
 */
export const generateOwnerCheck = (permission?: TablePermission): string | undefined => {
  if (!permission || permission.type !== 'owner') {
    return undefined
  }

  // Generate owner check: owner_id = current_setting('app.user_id', true)::TEXT
  const ownerField = permission.field
  return `${ownerField} = current_setting('app.user_id', true)::TEXT`
}

/**
 * Generate authenticated check expression for RLS policies
 *
 * Uses session context variable `app.user_id` to determine authentication status.
 * A user is authenticated if `app.user_id` is set and not empty.
 *
 * @param permission - Permission configuration
 * @returns SQL expression for authenticated check, or undefined if not authenticated permission
 */
export const generateAuthenticatedCheck = (permission?: TablePermission): string | undefined => {
  if (!permission || permission.type !== 'authenticated') {
    return undefined
  }

  // Check if user_id session variable is set and not empty
  return "current_setting('app.user_id', true) IS NOT NULL AND current_setting('app.user_id', true) != ''"
}

/**
 * Generate role check expression for RLS policies
 *
 * Empty roles array means deny all access (no one is allowed).
 * This is different from missing permission configuration.
 *
 * @param permission - Permission configuration
 * @returns SQL expression for role check, or undefined if no role check needed
 */
export const generateRoleCheck = (permission?: TablePermission): string | undefined => {
  if (!permission || permission.type !== 'roles') {
    return undefined
  }

  // Empty roles array means deny all access (no one is allowed)
  if (permission.roles.length === 0) {
    return 'false'
  }

  // Generate OR'd role checks using current_setting('app.user_role', true)
  const roleChecks = permission.roles
    .map((role) => `current_setting('app.user_role', true) = '${role}'`)
    .join(' OR ')

  return `(${roleChecks})`
}

/**
 * Generate custom permission check expression for RLS policies
 *
 * Custom permissions allow arbitrary SQL conditions with variable substitution.
 * Variables are substituted with PostgreSQL session context values:
 * - {userId} → current_setting('app.user_id', true)::TEXT
 *
 * @param permission - Permission configuration
 * @returns SQL expression for custom check, or undefined if not custom permission
 */
export const generateCustomCheck = (permission?: TablePermission): string | undefined => {
  if (!permission || permission.type !== 'custom') {
    return undefined
  }

  return translatePermissionCondition(permission.condition)
}

// ============================================================================
// Policy Statement Helpers
// ============================================================================

/**
 * Generate DROP POLICY statements for a table
 *
 * @param tableName - Name of the table
 * @returns Array of DROP POLICY statements
 */
export const generateDropPolicies = (tableName: string): readonly string[] => [
  `DROP POLICY IF EXISTS ${tableName}_select ON ${tableName}`,
  `DROP POLICY IF EXISTS ${tableName}_insert ON ${tableName}`,
  `DROP POLICY IF EXISTS ${tableName}_update ON ${tableName}`,
  `DROP POLICY IF EXISTS ${tableName}_delete ON ${tableName}`,
]

// ============================================================================
// Typed Policy Statement Generators
// ============================================================================

/**
 * Generate authenticated policy statements for a specific operation
 *
 * Creates DROP and CREATE POLICY statements for authenticated-only access control.
 *
 * @param tableName - Name of the table
 * @param operation - CRUD operation name (read/create/update/delete)
 * @param sqlCommand - SQL command (SELECT/INSERT/UPDATE/DELETE)
 * @param checkExpression - Authenticated check SQL expression
 * @returns Array of DROP and CREATE POLICY statements, or empty array if no expression
 */
export const generateAuthenticatedPolicyStatements = (
  tableName: string,
  operation: 'read' | 'create' | 'update' | 'delete',
  sqlCommand: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  checkExpression: string | undefined
): readonly string[] => {
  const policyName = `authenticated_${operation}`
  return generatePolicyStatements(tableName, policyName, sqlCommand, checkExpression)
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
export const generateRolePolicyStatements = (
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
export const generateOwnerPolicyStatements = (
  tableName: string,
  operation: 'read' | 'create' | 'update' | 'delete',
  sqlCommand: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
  checkExpression: string | undefined
): readonly string[] => {
  const policyName = `${tableName}_owner_${operation}`
  return generatePolicyStatements(tableName, policyName, sqlCommand, checkExpression)
}

/**
 * Generate permission check for a specific operation
 *
 * @param permission - Permission configuration
 * @returns SQL expression for permission check
 */
export const generateOperationCheck = (
  permission: TablePermission | undefined
): string | undefined =>
  generateAuthenticatedCheck(permission) ||
  generateRoleCheck(permission) ||
  generateOwnerCheck(permission) ||
  generateCustomCheck(permission)

/**
 * Generate policy name based on operation and permission type
 *
 * @param tableName - Name of the table
 * @param operation - CRUD operation (read/create/update/delete)
 * @param permission - Permission configuration
 * @returns Policy name
 */
export const generatePolicyName = (
  tableName: string,
  operation: string,
  permission: TablePermission | undefined
): string => {
  if (!permission) {
    return `${tableName}_${operation}`
  }

  if (permission.type === 'authenticated') {
    return `authenticated_${operation}`
  }

  if (permission.type === 'roles') {
    return `${tableName}_role_${operation}`
  }

  if (permission.type === 'owner') {
    return `${tableName}_owner_${operation}`
  }

  if (permission.type === 'custom') {
    return `${tableName}_custom_${operation}`
  }

  return `${tableName}_${operation}`
}
