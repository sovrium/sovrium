/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where each SQLite table's rows go when a SQLite backup is restored into
 * PostgreSQL.
 *
 * SQLite keeps the system and auth tables flat (`auth_user`,
 * `system_activity_logs`, and one unprefixed `audit_log`) where PostgreSQL
 * uses the `auth` and `system` schemas. A prefix rule would almost work and
 * that is the problem: `audit_log` already breaks it, and the next exception
 * would drop a table out of every restore without a sound. So every engine
 * table is named here, either mapped to its PostgreSQL table or skipped with
 * its reason, and `sqlite-to-postgres-table-map.test.ts` fails the build when
 * a table appears in either Drizzle schema without a verdict.
 *
 * The tables the config declares are not engine tables: they keep their name
 * and live in `public` on both engines (a view-backed table's rows are in its
 * `<name>_base` table on both, and views are never copied).
 */

/** The PostgreSQL table, `schema.name`, for every SQLite engine table whose rows are copied. */
export const ENGINE_TABLE_MAP: Readonly<Record<string, string>> = {
  audit_log: 'public.audit_log',
  auth_account: 'auth.account',
  auth_api_key: 'auth.api_key',
  auth_device_code: 'auth.device_code',
  auth_invitation: 'auth.invitation',
  auth_jwks: 'auth.jwks',
  auth_member: 'auth.member',
  auth_oauth_access_token: 'auth.oauth_access_token',
  auth_oauth_client: 'auth.oauth_client',
  auth_oauth_client_assertion: 'auth.oauth_client_assertion',
  auth_oauth_client_resource: 'auth.oauth_client_resource',
  auth_oauth_consent: 'auth.oauth_consent',
  auth_oauth_refresh_token: 'auth.oauth_refresh_token',
  auth_oauth_resource: 'auth.oauth_resource',
  auth_organization: 'auth.organization',
  auth_passkey: 'auth.passkey',
  auth_session: 'auth.session',
  auth_team: 'auth.team',
  auth_team_member: 'auth.team_member',
  auth_two_factor: 'auth.two_factor',
  auth_user: 'auth.user',
  auth_verification: 'auth.verification',
  system__admin_search_index: 'system._admin_search_index',
  system_account_baselines: 'system.account_baselines',
  system_activity_logs: 'system.activity_logs',
  system_admin_digest_snapshots: 'system.admin_digest_snapshots',
  system_ai_activity_logs: 'system.ai_activity_logs',
  system_ai_chat_attachments: 'system.ai_chat_attachments',
  system_ai_compute_status: 'system.ai_compute_status',
  system_ai_conversations: 'system.ai_conversations',
  system_ai_embeddings: 'system.ai_embeddings',
  system_ai_facts: 'system.ai_facts',
  system_ai_field_cache: 'system.ai_field_cache',
  system_ai_knowledge_sources: 'system.ai_knowledge_sources',
  system_ai_messages: 'system.ai_messages',
  system_ai_tool_calls: 'system.ai_tool_calls',
  system_analytics_events: 'system.analytics_events',
  system_automation_approval_requests: 'system.automation_approval_requests',
  system_automation_definitions: 'system.automation_definitions',
  system_automation_delayed_steps: 'system.automation_delayed_steps',
  system_automation_digest_buckets: 'system.automation_digest_buckets',
  system_automation_digest_items: 'system.automation_digest_items',
  system_automation_pauses: 'system.automation_pauses',
  system_automation_run_refs: 'system.automation_run_refs',
  system_automation_run_steps: 'system.automation_run_steps',
  system_automation_runs: 'system.automation_runs',
  system_automation_scheduled_jobs: 'system.automation_scheduled_jobs',
  system_automation_state: 'system.automation_state',
  system_boot_ledger: 'system.boot_ledger',
  system_browser_sessions: 'system.browser_sessions',
  system_calendar_feed_tokens: 'system.calendar_feed_tokens',
  system_comment_read_state: 'system.comment_read_state',
  system_connection_app_tokens: 'system.connection_app_tokens',
  system_connection_tokens: 'system.connection_tokens',
  system_connections: 'system.connections',
  system_design_system_shares: 'system.design_system_shares',
  system_email_messages: 'system.email_messages',
  system_email_suppressions: 'system.email_suppressions',
  system_file_storage_bytea: 'system.file_storage_bytea',
  system_file_storage_metadata: 'system.file_storage_metadata',
  system_form_submissions: 'system.form_submissions',
  system_links: 'system.links',
  system_migration_log: 'system.migration_log',
  system_notification_preferences: 'system.notification_preferences',
  system_notifications: 'system.notifications',
  system_read_state: 'system.read_state',
  system_record_comments: 'system.record_comments',
  system_search_index: 'system.search_index',
  system_search_indexes: 'system.search_indexes',
  system_sovrium_bootstrap_tokens: 'system.sovrium_bootstrap_tokens',
  system_user_access: 'system.user_access',
  system_user_favorites: 'system.user_favorites',
  system_user_presence: 'system.user_presence',
  system_user_recent_items: 'system.user_recent_items',
  system_webhook_configs: 'system.webhook_configs',
  system_webhook_deliveries: 'system.webhook_deliveries',
  system_webhook_outbox: 'system.webhook_outbox',
  system_webhook_outbox_subjects: 'system.webhook_outbox_subjects',
}

/**
 * Engine tables whose rows are NOT copied, and why. Each reason is one of two:
 * the schema build already wrote the table's rows for the database it built
 * (copying them would collide on their ids or describe the wrong database), or
 * the table is a SQLite-only search structure PostgreSQL derives by itself.
 */
export const SKIPPED_SQLITE_TABLES: Readonly<Record<string, string>> = {
  __drizzle_migrations: 'the migration journal: the schema build writes its own',
  sqlite_sequence:
    'SQLite id counters: read to continue numbering, then represented by PostgreSQL sequences',
  system_schema_checksum: 'the config checksum: the schema build writes its own',
  system_migration_history: 'the config migration ledger: the schema build writes its own',
  system__admin_search_fts:
    'the SQLite full-text index of the admin search: PostgreSQL derives it from the copied rows',
}

/** PostgreSQL tables no SQLite table feeds, and why. */
export const POSTGRES_ONLY_TABLES: Readonly<Record<string, string>> = {
  'drizzle.__drizzle_migrations': 'the migration journal: written by the schema build',
}

/**
 * PostgreSQL columns a copy derives instead of copying, keyed by `schema.table`,
 * each an SQL expression over the copied row (`v.<column>`). SQLite has no such
 * column: the PostgreSQL search document is rebuilt from the copied text, as
 * the search service would have computed it, never read from SQLite.
 */
export const DERIVED_POSTGRES_COLUMNS: Readonly<Record<string, Readonly<Record<string, string>>>> =
  {
    'system.search_index': { content_tsv: "to_tsvector('english', v.raw_content::text)" },
  }

/** The suffixes of the shadow tables SQLite's FTS5 keeps beside a full-text table. */
const FTS5_SHADOW_SUFFIXES = ['_data', '_idx', '_docsize', '_config', '_content'] as const

/**
 * Whether a SQLite table is a full-text index (or one of its shadow tables):
 * the per-table `fts__<table>` the command palette searches, or the admin
 * search index. PostgreSQL keeps a GIN index over each table's own columns
 * instead, which it maintains as rows are inserted, so none of these is copied.
 */
export const isSqliteSearchStructure = (table: string): boolean => {
  const base =
    FTS5_SHADOW_SUFFIXES.reduce<string | undefined>(
      (found, suffix) =>
        found ?? (table.endsWith(suffix) ? table.slice(0, -suffix.length) : undefined),
      undefined
    ) ?? table
  return (
    table.startsWith('fts__') ||
    table === 'system__admin_search_fts' ||
    base === 'system__admin_search_fts'
  )
}

/** One table's copy: its SQLite name and its PostgreSQL schema and name. */
export interface TableCopy {
  readonly source: string
  readonly schema: string
  readonly table: string
}

/** The copies to run, and the SQLite tables that have nowhere to go. */
export interface TableCopyPlan {
  readonly copies: readonly TableCopy[]
  readonly unmapped: readonly string[]
}

const splitQualified = (qualified: string): { readonly schema: string; readonly table: string } => {
  const dot = qualified.indexOf('.')
  return { schema: qualified.slice(0, dot), table: qualified.slice(dot + 1) }
}

/**
 * Pair every SQLite base table with the PostgreSQL base table its rows go to.
 *
 * `targets` is the set of `schema.name` base tables the PostgreSQL schema build
 * produced. An engine table goes where {@link ENGINE_TABLE_MAP} says; a skipped
 * table or a search structure goes nowhere; any other table is one the config
 * declares and goes to `public` under its own name. A table with no target is
 * `unmapped`, which aborts the restore: its rows would otherwise be lost.
 */
export const planTableCopies = (
  sqliteTables: readonly string[],
  targets: ReadonlySet<string>
): TableCopyPlan => {
  const candidates = sqliteTables
    .filter((table) => SKIPPED_SQLITE_TABLES[table] === undefined)
    .filter((table) => !isSqliteSearchStructure(table))
    .map((source) => ({ source, qualified: ENGINE_TABLE_MAP[source] ?? `public.${source}` }))
  return {
    copies: candidates
      .filter((candidate) => targets.has(candidate.qualified))
      .map((candidate) => ({ source: candidate.source, ...splitQualified(candidate.qualified) })),
    unmapped: candidates
      .filter((candidate) => !targets.has(candidate.qualified))
      .map((candidate) => candidate.source),
  }
}
