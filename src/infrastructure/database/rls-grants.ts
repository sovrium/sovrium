/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  TEST_ROLES,
  hasNoPermissions,
  hasAuthenticatedPermissions,
  hasRolePermissions,
  extractDatabaseRoles,
} from './rls-permission-checks'
import type { Table } from '@/domain/models/app/table'

/**
 * Generate table grants for tables with no permissions configured (test access)
 *
 * When a table has NO permissions configured, it defaults to "deny all".
 * However, for E2E tests, we still need to create the standard test roles
 * and grant them basic SELECT access so they can verify the deny behavior.
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
 * Generate table grants for authenticated permissions
 *
 * When a table has authenticated permissions, the authenticated_user role needs table-level access.
 * RLS policies will then filter rows based on authentication status.
 *
 * This grants:
 * 1. CREATE ROLE statement for authenticated_user (if not exists)
 * 2. USAGE on public schema
 * 3. ALL on the table (RLS policies will restrict row access)
 *
 * @param table - Table definition with authenticated permissions
 * @returns Array of SQL statements to create roles and grant access
 */
export const generateAuthenticatedBasedGrants = (table: Table): readonly string[] => {
  if (!hasAuthenticatedPermissions(table)) {
    return []
  }

  const tableName = table.name

  // Check if table has field-level permissions
  const hasFieldPermissions =
    table.permissions?.fields !== undefined && table.permissions.fields.length > 0

  const createRoleStatements = [
    `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated_user') THEN
    CREATE ROLE authenticated_user WITH LOGIN;
  END IF;
END
$$`,
  ]

  // If field permissions exist, generateFieldPermissionGrants handles column-level grants
  // Only grant schema usage here to avoid conflicts
  if (hasFieldPermissions) {
    return [...createRoleStatements, `GRANT USAGE ON SCHEMA public TO authenticated_user`]
  }

  // No field permissions - grant full table access
  const grantStatements = [
    `GRANT USAGE ON SCHEMA public TO authenticated_user`,
    `GRANT ALL ON ${tableName} TO authenticated_user`,
  ]

  return [...createRoleStatements, ...grantStatements]
}

/**
 * Generate table grants for role-based permissions
 *
 * When a table has role-based permissions, specific test roles need basic table-level access.
 * RLS policies will then filter rows based on the application role.
 *
 * This grants access ONLY to roles mentioned in the permissions (not all test roles).
 * Example: If permissions specify ['admin', 'member'], only admin_user and member_user get grants.
 *
 * Additionally creates guest_user role (without grants) for testing permission denials.
 *
 * This grants:
 * 1. CREATE ROLE statements for mentioned roles + guest_user (if not exists)
 * 2. USAGE on public schema (for permitted roles only)
 * 3. ALL on the table (for permitted roles only - RLS policies will restrict row access)
 *
 * @param table - Table definition with role-based permissions
 * @returns Array of SQL statements to create roles and grant access
 */
export const generateRoleBasedGrants = (table: Table): readonly string[] => {
  if (!hasRolePermissions(table)) {
    return []
  }

  const tableName = table.name
  const databaseRoles = Array.from(extractDatabaseRoles(table))

  if (databaseRoles.length === 0) {
    return []
  }

  // Check if table has field-level permissions
  const hasFieldPermissions =
    table.permissions?.fields !== undefined && table.permissions.fields.length > 0

  // Always create guest_user for testing permission denials (but don't grant access)
  const allRoles = ['guest_user', ...databaseRoles]

  const createRoleStatements = allRoles.map(
    (role) => `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    CREATE ROLE ${role} WITH LOGIN;
  END IF;
END
$$`
  )

  // If field permissions exist, generateFieldPermissionGrants handles column-level grants
  // Only grant schema usage here to avoid conflicts
  if (hasFieldPermissions) {
    const schemaGrantStatements = databaseRoles.map(
      (role) => `GRANT USAGE ON SCHEMA public TO ${role}`
    )
    return [...createRoleStatements, ...schemaGrantStatements]
  }

  // No field permissions - grant full table access to permitted roles
  const grantStatements = databaseRoles.flatMap((role) => [
    `GRANT USAGE ON SCHEMA public TO ${role}`,
    `GRANT ALL ON ${tableName} TO ${role}`,
  ])

  return [...createRoleStatements, ...grantStatements]
}
