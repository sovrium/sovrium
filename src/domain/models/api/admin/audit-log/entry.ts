/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Canonical audit-log entry shape exposed by `GET /api/admin/audit-log`.
 *
 * Every admin-tier write that mutates state OR every admin-tier read that
 * the design plan §6.2 marks as audit-worthy lands here. The shape is the
 * single source of truth for the audit-log read API; emitter sites construct
 * objects that conform to this shape and the route hands them back unchanged.
 *
 * @see plan §6.2 — actor/resource/severity/result shape
 * @see action-catalog.ts — canonical action -> resource-type pairs
 */

import { z } from '@hono/zod-openapi'
import { actorSchema } from '@/domain/models/api/admin/_shared/actor'
import { resourceSchema } from '@/domain/models/api/admin/_shared/resource'
import { severitySchema } from '@/domain/models/api/admin/_shared/severity'

/**
 * Action outcome — every emit records whether the action succeeded or failed
 * so operators can filter to failure-only views during incident triage.
 */
export const auditResultSchema = z
  .enum(['success', 'failure'])
  .describe('Outcome of the audited action — used for filtering during triage.')

/** @public */
export type AuditResult = z.infer<typeof auditResultSchema>

/**
 * Transport ("canal") — the first-class, closed-enum modality through which a
 * config mutation was made.
 *
 * The Activity feed's "channel" column answers "*how* was this change made?" so
 * an operator can filter for, say, every edit made over the REST API. The enum
 * is the same closed set the version ledger's `source` records:
 *
 *  - `config-file` — the on-disk config file (file launch / `…/draft/rebase`)
 *  - `env`         — an environment variable (`APP_SCHEMA`)
 *  - `api`         — the REST admin API (the dashboard's web editor goes here too)
 *  - `mcp`         — an MCP schema-edit tool
 *  - `restore`     — a version restore (`…/versions/:n/restore`)
 *
 * Stamped uniformly by EVERY mutation path so no path silently leaves the canal
 * blank — the precondition for the feed being a trustworthy audit surface.
 */
export const auditTransportSchema = z
  .enum(['config-file', 'env', 'api', 'mcp', 'restore'])
  .describe('How the change was made — the closed transport ("canal") enum.')

/** @public */
export type AuditTransport = z.infer<typeof auditTransportSchema>

/**
 * Canonical audit-log entry.
 *
 * `id` is a stable opaque string. `timestamp` is ISO 8601 UTC. `actor` and
 * `resource` reuse the shared blocks. `severity` and `result` are independent
 * filter dimensions.
 */
export const auditLogEntrySchema = z
  .object({
    id: z.string().describe('Stable opaque identifier for this audit entry.'),
    timestamp: z.iso.datetime().describe('ISO 8601 UTC timestamp when the entry was emitted.'),
    action: z.string().describe('Dot-namespaced action name (e.g. `config.version.queried`).'),
    actor: actorSchema,
    resource: resourceSchema,
    severity: severitySchema,
    result: auditResultSchema,
    transport: auditTransportSchema.describe(
      'The closed-enum transport ("canal") the change was made through. A first-class, enumerable field stamped by every mutation path.'
    ),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Domain-specific extras attached by the emitter; omit when empty.'),
  })
  .openapi('AuditLogEntry')

/** @public */
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>

/**
 * Response shape of `GET /api/admin/audit-log`.
 *
 * Single-bag `items: [...]` list. Pagination is intentionally deferred —
 * Phase 0 callers query with narrow filters (actorId + action) and never
 * page; richer pagination is layered on once the table-backed implementation
 * lands per the keystone story.
 */
export const auditLogListResponseSchema = z
  .object({
    items: z.array(auditLogEntrySchema),
    // Cursor-pagination support added in [internal ref] merge to satisfy Lane B's
    // store.ts response shape. REQUIRED-nullable per the canonical cursor
    // contract: `null` signals "no more pages". Lane A's Phase-0 routes
    // that don't paginate MUST emit `nextCursor: null` explicitly.
    nextCursor: z.string().nullable(),
  })
  .openapi('AuditLogListResponse')

/** @public */
export type AuditLogListResponse = z.infer<typeof auditLogListResponseSchema>

/**
 * Query shape for `GET /api/admin/audit-log` cursor-paginated reads.
 * Added in [internal ref] merge to satisfy Lane B's `store.ts` query API.
 */
export const auditLogQuerySchema = z
  .object({
    actorId: z.string().optional(),
    action: z.string().optional(),
    resourceType: z.string().optional(),
    transport: auditTransportSchema.optional(),
    cursor: z.string().optional(),
    // `coerce` lets the query string value (always a string) become a
    // number; `default(50)` ensures the destructured `limit` is always
    // defined in store.ts (slice(start, start + limit) needs a number).
    limit: z.coerce.number().int().positive().max(200).default(50),
  })
  .openapi('AuditLogQuery')

/** @public */
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>
