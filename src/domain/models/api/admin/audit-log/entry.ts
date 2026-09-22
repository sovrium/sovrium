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

import { Schema } from 'effect'
import { actorSchema } from '@/domain/models/api/admin/envelope/actor'
import { resourceSchema } from '@/domain/models/api/admin/envelope/resource'
import { severitySchema } from '@/domain/models/api/admin/envelope/severity'
import { coercedNumber } from '@/domain/models/api/combinators/coerce'
import { looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { withDefault } from '../../combinators/schema-defaults'

/**
 * Action outcome — every emit records whether the action succeeded or failed
 * so operators can filter to failure-only views during incident triage.
 */
export const auditResultSchema = Schema.Literals(['success', 'failure']).annotate({
  description: 'Outcome of the audited action — used for filtering during triage.',
})

/** @public */
export type AuditResult = typeof auditResultSchema.Type

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
export const auditTransportSchema = Schema.Literals([
  'config-file',
  'env',
  'api',
  'mcp',
  'restore',
]).annotate({ description: 'How the change was made — the closed transport ("canal") enum.' })

/** @public */
export type AuditTransport = typeof auditTransportSchema.Type

/**
 * Canonical audit-log entry.
 *
 * `id` is a stable opaque string. `timestamp` is ISO 8601 UTC. `actor` and
 * `resource` reuse the shared blocks. `severity` and `result` are independent
 * filter dimensions.
 */
export const auditLogEntrySchema = Schema.Struct({
  id: Schema.String.annotate({ description: 'Stable opaque identifier for this audit entry.' }),
  timestamp: looseIsoDateTime({
    description: 'ISO 8601 UTC timestamp when the entry was emitted.',
  }),
  action: Schema.String.annotate({
    description: 'Dot-namespaced action name (e.g. `config.version.queried`).',
  }),
  actor: actorSchema,
  resource: resourceSchema,
  severity: severitySchema,
  result: auditResultSchema,
  transport: auditTransportSchema.annotate({
    description:
      'The closed-enum transport ("canal") the change was made through. A first-class, enumerable field stamped by every mutation path.',
  }),
  metadata: optionalField(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'Domain-specific extras attached by the emitter; omit when empty.',
    })
  ),
}).annotate({ identifier: 'AuditLogEntry' })

/** @public */
export type AuditLogEntry = typeof auditLogEntrySchema.Type

/**
 * Response shape of `GET /api/admin/audit-log`.
 *
 * Single-bag `items: [...]` list. Pagination is intentionally deferred —
 * Phase 0 callers query with narrow filters (actorId + action) and never
 * page; richer pagination is layered on once the table-backed implementation
 * lands per the keystone story.
 */
export const auditLogListResponseSchema = Schema.Struct({
  items: Schema.Array(auditLogEntrySchema),
  nextCursor: Schema.NullOr(Schema.String),
}).annotate({ identifier: 'AuditLogListResponse' })

/** @public */
export type AuditLogListResponse = typeof auditLogListResponseSchema.Type

/**
 * Query shape for `GET /api/admin/audit-log` cursor-paginated reads.
 * Added in [internal ref] merge to satisfy Lane B's `store.ts` query API.
 */
export const auditLogQuerySchema = Schema.Struct({
  actorId: optionalField(Schema.String),
  action: optionalField(Schema.String),
  resourceType: optionalField(Schema.String),
  transport: optionalField(auditTransportSchema),
  cursor: optionalField(Schema.String),
  limit: coercedNumber.pipe(
    Schema.check(Schema.isInt(), Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(200)),
    withDefault(50)
  ),
}).annotate({ identifier: 'AuditLogQuery' })

/** @public */
export type AuditLogQuery = typeof auditLogQuerySchema.Type
