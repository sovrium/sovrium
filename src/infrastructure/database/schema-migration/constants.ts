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
  // Notification tables (in system schema)
  'system.notifications',
  'system.notification_preferences',
  'system.notification_subscriptions',
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
])
