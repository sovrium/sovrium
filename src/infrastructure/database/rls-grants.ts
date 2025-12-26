/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  hasNoPermissions,
  hasAuthenticatedPermissions,
  hasRolePermissions,
  extractDatabaseRoles,
} from './rls-permission-checks'
import type { Table } from '@/domain/models/app/table'

/**
 * Standard test roles used in E2E tests
 * These roles need basic table access even when no permissions are configured
 */
const TEST_ROLES = ['admin_user', 'member_user', 'authenticated_user'] as const

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
EXCEPTION
  -- Handle race condition: another process may have created the role
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
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
EXCEPTION
  -- Handle race condition: another process may have created the role
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
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
EXCEPTION
  -- Handle race condition: another process may have created the role
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
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

/**
 * Generate grants for app_user role (used by withSessionContext)
 *
 * The app_user role is used by withSessionContext to enforce RLS policies.
 * It needs ALL privileges on the table to allow operations, but RLS policies
 * will restrict row-level access based on session context.
 *
 * This grants:
 * 1. CREATE ROLE statement for app_user (if not exists)
 * 2. USAGE on public schema
 * 3. ALL on the table (RLS policies will restrict row access)
 *
 * @param table - Table definition
 * @returns Array of SQL statements to create role and grant access
 */
export const generateAppUserGrants = (table: Table): readonly string[] => {
  const tableName = table.name

  const createRoleStatement = `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN;
  END IF;
EXCEPTION
  -- Handle race condition: another process may have created the role
  WHEN duplicate_object THEN NULL;
  WHEN unique_violation THEN NULL;
END
$$`

  // Grant the current database user (typically the owner) membership in app_user role
  // This allows SET ROLE app_user to succeed (required for RLS policies)
  // Note: Superusers can always SET ROLE without explicit grants
  const grantMembershipStatement = `DO $$
DECLARE
  is_superuser_val boolean;
  current_user_val text;
BEGIN
  -- Get current user
  SELECT current_user INTO current_user_val;

  -- Check if current user is a superuser
  SELECT rolsuper INTO is_superuser_val
  FROM pg_roles
  WHERE rolname = current_user_val;

  -- Only grant if not a superuser (superusers don't need explicit grants)
  IF NOT is_superuser_val THEN
    EXECUTE format('GRANT app_user TO %I', current_user_val);
  END IF;
EXCEPTION
  -- Ignore errors if already granted
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN NULL;
END
$$`

  const grantStatements = [
    `GRANT USAGE ON SCHEMA public TO app_user`,
    `GRANT ALL ON ${tableName} TO app_user`,
  ]

  return [createRoleStatement, grantMembershipStatement, ...grantStatements]
}
