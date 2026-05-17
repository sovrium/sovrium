/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'

/**
 * Internal Table Registry
 *
 * Hardcoded enumeration of Sovrium-internal tables (auth + system pgSchemas)
 * exposed read-only via MCP to the admin role when MCP_EXPOSE_INTERNALS=true.
 *
 * NOT a configurable schema property — this lives under `shared/` (alongside
 * `permissions.ts`) rather than `app/` because it is stable infrastructure
 * data authored by Sovrium's developers, not the schema author. The `app/`
 * namespace is reserved for properties the schema author declares in their
 * YAML/TS app definition.
 *
 * These tables are NOT declared in the user's app schema (`app.tables[]`) —
 * they live in `pgSchema('auth')` (Better Auth) and `pgSchema('system')`
 * (Sovrium observability). Per the realistic-test mandate and security
 * principle, secret-bearing columns are denylisted at the tool layer
 * regardless of role.
 *
 * Derived tool names follow `{appName}_auth_{table}_{op}` and
 * `{appName}_system_{table}_{op}` (e.g. `crm_auth_user_list`,
 * `crm_system_audit_log_list`).
 *
 * Operations exposed: only `read` and `list`. No create/update/delete tools
 * are generated for internal tables — the admin's MCP surface is strictly
 * observational.
 *
 * Maintenance contract: when a new table is added under `pgSchema('auth')` or
 * `pgSchema('system')`, this registry MUST be updated. The companion test
 * file iterates Drizzle schema exports and asserts every internal table
 * appears here — failing the test forces the registry to stay in sync.
 */

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const InternalTableSchemaName = Schema.Literal('auth', 'system')

export type InternalTableSchemaName = typeof InternalTableSchemaName.Type

export const InternalTableEntrySchema = Schema.Struct({
  schema: InternalTableSchemaName,
  name: Schema.String.pipe(Schema.minLength(1)),
  denylistFields: Schema.Array(Schema.String.pipe(Schema.minLength(1))),
  description: Schema.String.pipe(Schema.minLength(1)),
}).pipe(
  Schema.annotations({
    identifier: 'InternalTableEntry',
    title: 'Internal Table Registry Entry',
    description:
      'Single internal-table descriptor: which pgSchema, table name, denylisted columns, AI-readable description.',
  })
)

export type InternalTableEntry = typeof InternalTableEntrySchema.Type

// ---------------------------------------------------------------------------
// Registry data — auth pgSchema
// ---------------------------------------------------------------------------

/**
 * Auth tables exposed read-only to admin MCP role. Source of truth:
 * `src/infrastructure/auth/better-auth/schema.ts` (`authSchema =
 * pgSchema('auth')`). Denylists strip credentials, session tokens, OAuth
 * refresh tokens, 2FA secrets, and any verification codes.
 */
export const AUTH_INTERNAL_TABLES: ReadonlyArray<InternalTableEntry> = [
  {
    schema: 'auth',
    name: 'user',
    denylistFields: [],
    description: 'User accounts. Includes name, email, role, ban status. No secrets.',
  },
  {
    schema: 'auth',
    name: 'session',
    denylistFields: ['token', 'ipAddress', 'userAgent'],
    description:
      'Active and expired user sessions. Session tokens, IPs, and user agents are denylisted to prevent session-hijack risk via AI exposure.',
  },
  {
    schema: 'auth',
    name: 'account',
    denylistFields: ['accessToken', 'refreshToken', 'idToken', 'password'],
    description:
      'Linked authentication accounts (OAuth providers, password). All credential columns are denylisted.',
  },
  {
    schema: 'auth',
    name: 'verification',
    denylistFields: ['value'],
    description:
      'Email/identity verification codes. The OTP value is denylisted to prevent replay; only metadata (identifier, expiresAt) is visible.',
  },
  {
    schema: 'auth',
    name: 'two_factor',
    denylistFields: ['secret', 'backupCodes'],
    description:
      'Two-factor authentication enrollment. TOTP secret and backup codes are denylisted — exposure would defeat 2FA entirely.',
  },
  {
    schema: 'auth',
    name: 'organization',
    denylistFields: ['metadata'],
    description:
      'Organization records (1:1 with the Sovrium app). Metadata is denylisted because it may contain operator secrets.',
  },
  {
    schema: 'auth',
    name: 'member',
    denylistFields: [],
    description: 'Organization membership records: which user has which role in the org.',
  },
  {
    schema: 'auth',
    name: 'invitation',
    denylistFields: [],
    description: 'Pending organization invitations.',
  },
  {
    schema: 'auth',
    name: 'team',
    denylistFields: [],
    description: 'Teams within the organization.',
  },
  {
    schema: 'auth',
    name: 'team_member',
    denylistFields: [],
    description: 'Team membership records.',
  },
] as const

// ---------------------------------------------------------------------------
// Registry data — system pgSchema
// ---------------------------------------------------------------------------

/**
 * System / observability tables exposed read-only to admin MCP role. Source
 * of truth: `src/infrastructure/database/drizzle/schema/*.ts`. Denylists
 * strip webhook secrets, raw file bytes, embedding vectors, and password
 * hashes.
 */
export const SYSTEM_INTERNAL_TABLES: ReadonlyArray<InternalTableEntry> = [
  {
    schema: 'system',
    name: 'activity_logs',
    denylistFields: [],
    description:
      'Audit log of create/update/delete/restore actions on user-defined tables. Includes before/after JSONB diffs.',
  },
  {
    schema: 'system',
    name: 'automation_definitions',
    denylistFields: [],
    description: 'Stored automation definitions: trigger rules, action chains, enabled status.',
  },
  {
    schema: 'system',
    name: 'automation_runs',
    denylistFields: [],
    description: 'Per-execution automation history: status, duration, error messages.',
  },
  {
    schema: 'system',
    name: 'automation_run_steps',
    denylistFields: [],
    description: 'Per-step execution detail (input/output/error) within a single automation run.',
  },
  {
    schema: 'system',
    name: 'webhook_configs',
    denylistFields: ['secret'],
    description:
      'Outgoing webhook endpoint configurations. Webhook secrets are denylisted — exposure would let AI forge signed payloads to those endpoints.',
  },
  {
    schema: 'system',
    name: 'webhook_deliveries',
    denylistFields: [],
    description: 'Outbound webhook delivery log: attempt tracking, status, response bodies.',
  },
  {
    schema: 'system',
    name: 'notifications',
    denylistFields: [],
    description: 'In-app notification inbox (read/dismissed state per user).',
  },
  {
    schema: 'system',
    name: 'notification_preferences',
    denylistFields: [],
    description: 'Per-user notification channel preferences.',
  },
  {
    schema: 'system',
    name: 'notification_subscriptions',
    denylistFields: [],
    description: 'Record-level subscriptions tracking which users follow which records.',
  },
  {
    schema: 'system',
    name: 'file_storage_metadata',
    denylistFields: [],
    description:
      'File upload metadata (storage key, MIME type, size, uploader, table/record reference).',
  },
  {
    schema: 'system',
    name: 'file_storage_bytea',
    denylistFields: ['data'],
    description:
      'PostgreSQL bytea fallback for file content. The raw bytes column is denylisted (too large for a tool response and not useful to AI).',
  },
  {
    schema: 'system',
    name: 'search_indexes',
    denylistFields: [],
    description: 'Full-text and trigram index metadata: which table/field, last reindex time.',
  },
  {
    schema: 'system',
    name: 'sovrium_migration_history',
    denylistFields: [],
    description: 'Schema migration version history with checksums.',
  },
  {
    schema: 'system',
    name: 'sovrium_migration_log',
    denylistFields: [],
    description: 'Migration operation history (rollbacks, reasons, applied-by).',
  },
  {
    schema: 'system',
    name: 'sovrium_schema_checksum',
    denylistFields: [],
    description: 'Singleton row tracking the current schema state checksum.',
  },
  {
    schema: 'system',
    name: 'analytics_events',
    denylistFields: [],
    description: 'Page views and custom events: visitor hash, session, properties JSON.',
  },
  {
    schema: 'system',
    name: 'ai_conversations',
    denylistFields: [],
    description: 'Chat session metadata: userId, agentId, title.',
  },
  {
    schema: 'system',
    name: 'ai_messages',
    denylistFields: ['embeddings'],
    description:
      'Individual AI conversation messages (role, content). The embedding vector column is denylisted — large and not useful for AI clients.',
  },
  {
    schema: 'system',
    name: 'ai_tool_calls',
    denylistFields: [],
    description:
      'MCP / AI tool invocation audit: tool name, input args, output result, error, latency. Self-referential when the calling client is itself MCP.',
  },
  {
    schema: 'system',
    name: 'user_favorites',
    denylistFields: [],
    description: 'User-bookmarked records and pages (with soft-delete support).',
  },
  {
    schema: 'system',
    name: 'user_recent_items',
    denylistFields: [],
    description: 'Recently viewed entities per user.',
  },
  {
    schema: 'system',
    name: 'share_links',
    denylistFields: ['passwordHash'],
    description:
      'Anonymous page share tokens with optional password protection. The password hash is denylisted.',
  },
  {
    schema: 'system',
    name: 'user_access',
    denylistFields: [],
    description:
      'Z-3 row-level permission junction: which userId can access which recordIds in which user-defined table.',
  },
] as const

// ---------------------------------------------------------------------------
// Combined registry
// ---------------------------------------------------------------------------

/**
 * Full internal table registry. Concatenation of `AUTH_INTERNAL_TABLES` and
 * `SYSTEM_INTERNAL_TABLES`. Used by the MCP tool generator to compile
 * admin-only read-only tools.
 */
export const InternalTableRegistry: ReadonlyArray<InternalTableEntry> = [
  ...AUTH_INTERNAL_TABLES,
  ...SYSTEM_INTERNAL_TABLES,
]

/**
 * Query helper: returns all denylisted columns for a given internal table, or
 * an empty array if the table is not in the registry. Used by tool-handler
 * code to strip secret-bearing columns from query results.
 */
export const getDenylistFields = (
  schema: InternalTableSchemaName,
  tableName: string
): ReadonlyArray<string> => {
  const entry = InternalTableRegistry.find((e) => e.schema === schema && e.name === tableName)
  return entry?.denylistFields ?? []
}

/**
 * Query helper: returns true if a given table name uses an internal-reserved
 * prefix. Used by AppSchema cross-validation to reject user-defined tables
 * that would collide with the auto-generated admin internals tools.
 */
export const isReservedInternalPrefix = (tableName: string): boolean => {
  return tableName.startsWith('auth_') || tableName.startsWith('system_')
}
