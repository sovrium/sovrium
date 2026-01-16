/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * System tables that should never be dropped
 * These tables are managed by Better Auth/Drizzle migrations or migration system, not by runtime schema
 * Note: Better Auth tables use _sovrium_auth_ prefix for namespace isolation
 */
export const PROTECTED_SYSTEM_TABLES = new Set([
  // Better Auth tables (with _sovrium_auth_ prefix)
  '_sovrium_auth_users',
  '_sovrium_auth_sessions',
  '_sovrium_auth_accounts',
  '_sovrium_auth_verifications',
  '_sovrium_auth_organizations',
  '_sovrium_auth_members',
  '_sovrium_auth_invitations',
  '_sovrium_auth_two_factors',
  // Migration system tables
  '_sovrium_migration_history',
  '_sovrium_migration_log',
  '_sovrium_schema_checksum',
  // Activity and comment tables
  '_sovrium_activity_logs',
  '_sovrium_record_comments',
])
