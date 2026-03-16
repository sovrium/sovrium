/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * System tables that should never be dropped
 * These tables are managed by Better Auth/Drizzle migrations or migration system, not by runtime schema
 * Note: Better Auth tables are in the auth schema with native Better Auth table names
 * System tables are in the system schema (system.*)
 */
export const PROTECTED_SYSTEM_TABLES = new Set([
  // Better Auth tables (in auth schema)
  'auth.user',
  'auth.session',
  'auth.account',
  'auth.verification',
  'auth.two_factor',
  'auth.team',
  'auth.team_member',
  'auth.role',
  // Migration system tables (in system schema)
  'system.migration_history',
  'system.migration_log',
  'system.schema_checksum',
  // Activity and comment tables (in system schema)
  'system.activity_logs',
  'system.record_comments',
])
