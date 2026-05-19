/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

export const PROTECTED_SYSTEM_TABLES = new Set([
  'auth.user',
  'auth.session',
  'auth.account',
  'auth.verification',
  'auth.two_factor',
  'auth.organization',
  'auth.member',
  'auth.invitation',
  'auth.team',
  'auth.team_member',
  'auth.role',
  'system.migration_history',
  'system.migration_log',
  'system.schema_checksum',
  'system.activity_logs',
  'system.record_comments',
  'system.automation_definitions',
  'system.automation_runs',
  'system.automation_run_steps',
  'system.automation_scheduled_jobs',
  'system.automation_delayed_steps',
  'system.automation_approval_requests',
  'system.connections',
  'system.connection_tokens',
  'system.notifications',
  'system.notification_preferences',
  'system.notification_subscriptions',
  'system.webhook_configs',
  'system.webhook_deliveries',
  'system.file_storage_metadata',
  'system.file_storage_bytea',
  'system.ai_conversations',
  'system.ai_messages',
  'system.ai_embeddings',
  'system.ai_knowledge_sources',
  'system.ai_field_cache',
  'system.ai_tool_calls',
  'system.search_indexes',
  'audit_log',
])
