/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
  // Better Auth organization plugin tables (in auth schema)
  'auth.organization',
  'auth.member',
  'auth.invitation',
  'auth.team',
  'auth.team_member',
  'auth.role',
  // Migration system tables (in system schema)
  'system.migration_history',
  'system.migration_log',
  'system.schema_checksum',
  // Drizzle's own migration-tracking table. The `drizzle-orm` migrator
  // (`migrate(...)`) creates it to record which generated migrations have
  // already been applied, making a re-run on an existing database idempotent.
  // On SQLite (zero-config mode) it lives in the same flat namespace as every
  // other table, so without this guard `dropObsoleteTables` would drop it on
  // the next boot — losing migration tracking, so the next `migrateSqlite`
  // re-runs `0000_*` and collides with the already-created tables. On
  // PostgreSQL it lives in the `drizzle` schema (outside
  // `getExistingTableNames`' `public` scope), so this entry is defensive
  // there. Unqualified to match the bare name SQLite's `sqlite_master` reports.
  '__drizzle_migrations',
  // Activity and comment tables (in system schema)
  'system.activity_logs',
  'system.record_comments',
  // Automation tables (in system schema)
  'system.automation_definitions',
  'system.automation_runs',
  'system.automation_run_steps',
  'system.automation_scheduled_jobs',
  'system.automation_delayed_steps',
  'system.automation_approval_requests',
  // Connection tables (in system schema)
  'system.connections',
  'system.connection_tokens',
  // Webhook tables (in system schema)
  'system.webhook_configs',
  'system.webhook_deliveries',
  // Storage tables (in system schema). Both are created by Drizzle migrations.
  // The bytea-adapter writes binary content to system.file_storage_bytea with
  // metadata in system.file_storage_metadata; there is no longer a runtime-
  // created public-schema table (the legacy `_sovrium_files` was renamed and
  // moved to system.* per the internal-table naming convention).
  'system.file_storage_metadata',
  'system.file_storage_bytea',
  // AI tables (in system schema)
  'system.ai_conversations',
  'system.ai_messages',
  'system.ai_embeddings',
  'system.ai_knowledge_sources',
  'system.ai_field_cache',
  'system.ai_tool_calls',
  // Search tables (in system schema)
  'system.search_indexes',
  // Audit-log table — Phase 8 Cycle 1a/1b canonical event store.
  //
  // Lives in the `public` schema on Postgres (matches migration 0000's
  // original placement before the Phase-0 in-memory pivot in migration
  // 0003 dropped it; migration 0006 restores it in the same `public`
  // schema). `getExistingTableNames` scopes to `public` and returns the
  // bare `audit_log`, so we list the unqualified name here. Without this
  // guard, the boot-time `dropObsoleteTables` sees `audit_log` as a
  // public-schema table not declared in `app.tables[]` and drops it on
  // every server start — silently turning every audit emit into a
  // best-effort no-op and breaking the [internal ref]
  // assertions that read the table directly.
  //
  // On SQLite the mirror also names the table `audit_log` (no prefix —
  // it deliberately mirrors the pg `public.audit_log` placement, see
  // `schema-sqlite/audit-log.ts`), so the unqualified entry catches
  // both dialects. SQLite's `auth_`/`system_`-prefix protection below
  // does NOT cover this case.
  'audit_log',
])
