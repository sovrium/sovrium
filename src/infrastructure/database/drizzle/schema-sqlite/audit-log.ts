/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'
import { users } from './auth-tables'

/**
 * Audit Log Table Schema — sqlite-core mirror of `schema/audit-log.ts`.
 *
 * Column-by-column parity with the pg-core sibling — same column names,
 * same nullability, same FK behaviour. The SQLite-specific deltas:
 *
 *   - `id` default: pg uses `gen_random_uuid()` (DB-side); SQLite has no
 *     equivalent server-side UUID function, so we fall back to an app-side
 *     `crypto.randomUUID()` default via `$defaultFn`. The application-layer
 *     `emitAuditEvent` already supplies the id explicitly, so the DB default
 *     is the resilience-only fallback for raw SQL inserts (matches the
 *     pattern in `activity-log.ts`).
 *
 *   - `created_at` storage: SQLite has no native `timestamp` type. We mirror
 *     the activity-log pattern: `integer(... , { mode: 'timestamp_ms' })`
 *     with a JS `new Date()` default. The Drizzle ORM hands callers `Date`
 *     objects on both dialects so the read path is identical.
 *
 *   - `metadata` storage: SQLite has no `jsonb`. We use `text(..., { mode:
 *     'json' })` which serialises/deserialises automatically via Drizzle,
 *     matching the activity-log handling of jsonb-on-pg / text-json-on-sqlite.
 *
 *   - `actor_id` FK: SQLite supports `ON DELETE SET NULL` (with foreign-key
 *     enforcement enabled — Sovrium's bun:sqlite setup turns FKs on via
 *     PRAGMA at boot, per `db-bun.ts`). Same semantics as the pg sibling:
 *     a hard-delete of the actor row null-ifies actor_id on every entry the
 *     actor produced, so the audit entry survives the user erasure.
 *
 * Table name: plain `audit_log` (no `system_` prefix) — mirrors the
 * pg-core sibling's placement in the `public` schema (which under SQLite
 * becomes the unprefixed default). Using `sqliteTable` directly (not
 * `systemTable`) reflects that.
 * @public Live schema, reached only by drizzle-kit through the string path in
 * `drizzle.config.ts` — a consumer no TypeScript import can express. It has no
 * TS importer because no dialect-branching caller needs the SQLite object yet.
 * Deleting it would drop the table from the next generated SQLite migration.
 */
export const auditLog = sqliteTable(
  'audit_log',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),

    action: text('action').notNull(),

    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: text('actor_type').notNull(),
    actorRole: text('actor_role').notNull(),
    actorEmail: text('actor_email'),

    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    resourceName: text('resource_name'),

    severity: text('severity').notNull(),
    result: text('result').notNull(),

    // Transport ("canal") — sqlite-core mirror of the pg-core column. Closed
    // enum config-file | env | api | mcp | restore, defaulting to `api` so any
    // row that omits it (raw SQL / pre-taxonomy) carries a valid canal value
    //.
    transport: text('transport').notNull().default('api'),

    metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
  },
  (table) => [
    index('audit_log_action_idx').on(table.action),
    index('audit_log_actor_id_idx').on(table.actorId),
    index('audit_log_created_at_idx').on(table.createdAt),
    index('audit_log_severity_idx').on(table.severity),
    index('audit_log_result_idx').on(table.result),
    index('audit_log_resource_type_idx').on(table.resourceType),
    index('audit_log_transport_idx').on(table.transport),
  ]
)
