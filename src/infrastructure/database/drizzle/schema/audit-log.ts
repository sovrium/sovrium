/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from '../../../auth/better-auth/schema'

/**
 * Audit Log Table Schema (Phase 8 Cycle 1a — canonical-event-store keystone)
 *
 * Append-only, immutable event store backing `GET /api/admin/audit-log`.
 * Every admin-tier mutation and every audit-worthy admin-tier read funnels
 * through `emitAuditEvent` (application layer) and lands here as one row.
 *
 * History
 *   - Migration 0000: table created in the `public` schema with columns
 *     `id / action / actor_id / metadata / created_at`. No FK on actor_id.
 *   - Migration 0003: table DROPPED — the audit-log backend was retired in
 *     favour of an in-memory Phase-0 store (`src/infrastructure/audit-log/
 *     in-memory-store.ts`) until the canonical event store could be designed.
 *   - Phase 8 Cycle 1a: table restored with the richer
 *     `AuditLogEntry` shape (actor block, resource block, severity, result)
 *     promoted to first-class columns so the read side can filter and index
 *     by the same dimensions the in-memory store already supports plus the
 *     ones the v1+ admin UI needs (severity, result).
 *
 * Why columns over a single jsonb blob
 *   The in-memory store filters by `actorId` and `action` today; promoting
 *   those to indexed columns preserves the read contract under DB load.
 *   `severity` and `result` join the column set so triage queries can narrow
 *   to failures or `critical` events without scanning JSON. `metadata` keeps
 *   its jsonb blob for emitter-supplied extras the catalog does not own.
 *
 * Why a public-schema table (not `system`)
 *   Mirrors migration 0000 verbatim. The `system` schema is for migration
 *   bookkeeping; audit log is platform-level and shared across all admin
 *   reads — placing it in `public` matches its public visibility.
 *
 * Why FK + ON DELETE SET NULL on actor_id
 * [internal ref] ("audit entry outlives the erased row") requires
 *   the entry to survive a hard-delete of the actor while shedding the
 *   identifier (GDPR Art. 17 — actor identity is erased but the immutable
 *   event log keeps the action). `system` actors carry actor_id NULL by
 *   construction, so the nullable text column accommodates both shapes.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    // Primary key — opaque UUID. The application-layer `emitAuditEvent`
    // synthesises the id via `crypto.randomUUID()`, but a DB-side default
    // is kept for resilience (raw SQL inserts during migrations / repair).
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Event metadata
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    // Action — dot-namespaced, validated against `ACTION_CATALOG` at emit
    // time. Stored as plain text so adding a new action does not require a
    // DDL change; the catalog file is the authoritative whitelist.
    action: text('action').notNull(),

    // Actor block (promoted from AuditLogEntry.actor)
    //
    // actorId is nullable because `system` actors (background jobs,
    // migrations) have no user identity. FK + ON DELETE SET NULL means the
    // audit entry outlives the erased user row — the audit log is the
    // immutable record, the user row is the mutable subject.
    actorId: text('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorType: text('actor_type').notNull(), // user | system | api-token | automation
    actorRole: text('actor_role').notNull(), // admin | operator | system
    actorEmail: text('actor_email'), // only present for 'user' actors

    // Resource block (promoted from AuditLogEntry.resource)
    //
    // type is dot-namespaced (e.g. `form.submission`, `automation.run`).
    // id is stringified for uniformity — numeric record ids pass through
    // toString(), UUIDs and slugs unchanged.
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    resourceName: text('resource_name'), // optional human-friendly label

    // Filter dimensions
    severity: text('severity').notNull(), // debug | info | warning | error | critical
    result: text('result').notNull(), // success | failure

    // Transport ("canal") — the first-class, closed-enum modality through which
    // the change was made:
    // config-file | env | api | mcp | restore. Defaults to `api` so pre-taxonomy
    // rows (and any raw-SQL insert that omits it) carry a valid canal value
    // rather than a NULL the read-side would have to special-case. Every emit
    // path supplies the real transport; the default is the resilience fallback.
    transport: text('transport').notNull().default('api'),

    // Emitter-supplied extras (NOT part of the canonical entry shape)
    metadata: jsonb('metadata'),
  },
  (table) => [
    // Mirrors migration 0000's indexes verbatim (action / actor_id /
    // created_at) and adds the new ones the column promotion enables.
    index('audit_log_action_idx').on(table.action),
    index('audit_log_actor_id_idx').on(table.actorId),
    index('audit_log_created_at_idx').on(table.createdAt),
    // New indexes — let admin UIs filter without scanning JSON.
    index('audit_log_severity_idx').on(table.severity),
    index('audit_log_result_idx').on(table.result),
    index('audit_log_resource_type_idx').on(table.resourceType),
    // Lets the Activité feed's `?transport=` filter narrow without a scan.
    index('audit_log_transport_idx').on(table.transport),
  ]
)

// Type exports for consumers ([internal ref] Cycle 1b will use these to
// shape the DB-backed `emitAuditEvent` + `listAuditEvents` replacements).
export type AuditLogRow = typeof auditLog.$inferSelect
export type NewAuditLogRow = typeof auditLog.$inferInsert
