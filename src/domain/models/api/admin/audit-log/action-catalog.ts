/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'

/**
 * Canonical audit-log action namespace catalog.
 *
 * Every mutating handler in `src/presentation/api/routes/` (and every
 * application-layer use-case that emits an audit event) must use one of these
 * action codes. The catalog supersets today's `/api/activity` actions
 * (`record.created/updated/deleted/restored`) while preserving the existing
 * shape so legacy callers keep working.
 *
 * **Naming convention**: `<domain>.<resource>.<verb>` (lowercase, dot-separated,
 * past-tense verbs for completed operations). Multi-segment resources use
 * additional dots: `automation.run.retried`, `bucket.file.signed_url_issued`.
 *
 * **Discovery**: Audit events are emitted by the application layer at
 * write-time. Adding a new action requires:
 *   1. Add the action literal to `AUDIT_ACTIONS` below
 *   2. Update `auditActionSchema` (Zod enum derived from this list)
 *   3. Wire the emit at the use-case site
 *
 * @see plan §6.2 (canonical audit-log shape + action namespace catalog)
 */

/**
 * Authoritative list of audit-log action codes.
 *
 * `as const` so TypeScript narrows the array elements to a literal union, and
 * the Zod enum below picks them up automatically. Categories are grouped with
 * blank-line breaks for readability — order is not significant at runtime.
 */
export const AUDIT_ACTIONS = [
  // -----------------------------------------------------------------
  // auth.* — Better Auth admin plugin + sessions
  // -----------------------------------------------------------------
  'auth.user.created',
  'auth.user.updated',
  'auth.user.role_changed',
  'auth.user.banned',
  'auth.user.unbanned',
  'auth.user.impersonated',
  'auth.user.pii_redacted',
  'auth.user.deleted',
  'auth.session.created',
  'auth.session.refreshed',
  'auth.session.revoked',
  'auth.session.expired',
  'auth.session.revoked_all',
  'auth.invitation.sent',
  'auth.invitation.accepted',
  'auth.invitation.revoked',
  'auth.password.reset_requested',
  'auth.password.reset_completed',
  'auth.password.changed',
  'auth.two_factor.enabled',
  'auth.two_factor.disabled',
  'auth.api_token.created',
  'auth.api_token.revoked',

  // -----------------------------------------------------------------
  // record.* — table records (supersets today's /api/activity)
  // -----------------------------------------------------------------
  'record.created',
  'record.updated',
  'record.deleted', // soft-delete
  'record.restored',
  'record.force_deleted', // hard-delete; emitted iff tables[].allowForceDelete === true
  'record.batch_created',
  'record.batch_updated',
  'record.batch_deleted',
  'record.batch_restored',
  'record.exported',

  // -----------------------------------------------------------------
  // table.* — schema / metadata operations
  // -----------------------------------------------------------------
  'table.permissions.changed',
  'table.index.rebuilt',
  'table.overview.queried', // emitted by GET /api/admin/tables/overview (US-ADMIN-TABLES-OVERVIEW)

  // -----------------------------------------------------------------
  // automation.* — automation engine
  // -----------------------------------------------------------------
  'automation.definition.enabled',
  'automation.definition.disabled',
  'automation.overview.queried', // emitted by GET /api/admin/automations/overview (US-ADMIN-AUTOMATIONS-OVERVIEW)
  'automation.run.started',
  'automation.run.completed',
  'automation.run.failed',
  'automation.run.retried',
  'automation.run.cancelled',
  'automation.run.dead_lettered',
  'automation.runs.list.queried', // emitted by GET /api/admin/automations/runs (US-ADMIN-AUTOMATIONS-RUNS-LIST)
  'automation.runs.detail.queried', // emitted by GET /api/admin/automations/runs/:runId (US-ADMIN-AUTOMATIONS-RUNS-LIST)

  // -----------------------------------------------------------------
  // bucket.* — file storage
  // -----------------------------------------------------------------
  'bucket.file.uploaded',
  'bucket.file.deleted',
  'bucket.file.signed_url_issued',
  'bucket.quota.exceeded',
  'bucket.list.queried', // emitted by GET /api/admin/buckets (US-ADMIN-BUCKETS-LIST)
  'bucket.overview.queried', // emitted by GET /api/admin/buckets/overview (reshape of legacy /quota)

  // -----------------------------------------------------------------
  // webhook.* — outgoing webhook deliveries (planned US-TABLES-TABLE-WEBHOOKS)
  // -----------------------------------------------------------------
  'webhook.subscription.created',
  'webhook.subscription.deleted',
  'webhook.secret.rotated',
  'webhook.delivery.succeeded',
  'webhook.delivery.failed',
  'webhook.delivery.retried',
  'webhook.delivery.dead_lettered',

  // -----------------------------------------------------------------
  // notification.* — operator dispatch + per-user inbox
  // -----------------------------------------------------------------
  'notification.dispatched',
  'notification.delivered',
  'notification.failed',
  'notification.retried',
  'notification.digest.sent',

  // -----------------------------------------------------------------
  // ai.* — AI provider requests, RAG, MCP, body-reveal compliance events
  // -----------------------------------------------------------------
  'ai.request.completed',
  'ai.request.failed',
  'ai.budget.warned',
  'ai.budget.exceeded',
  'ai.embedding.rebuilt',
  'ai.mcp.invocation.completed',
  'ai.mcp.invocation.failed',
  'audit.body.revealed', // body-reveal — see plan §12 Q3 (env-gated, always critical severity)

  // -----------------------------------------------------------------
  // email.* — outgoing email via Nodemailer
  // -----------------------------------------------------------------
  'email.queued',
  'email.sent',
  'email.bounced',
  'email.failed',
  'email.retried',

  // -----------------------------------------------------------------
  // form.* — form submissions + admin reads
  // -----------------------------------------------------------------
  'form.detail.queried', // emitted by GET /api/admin/forms/:formName (US-ADMIN-FORMS-LIST)
  'form.list.queried', // emitted by GET /api/admin/forms (US-ADMIN-FORMS-LIST)
  'form.submission.body.revealed', // emitted by GET /api/admin/forms/:formName/submissions/:id?reveal=true (US-ADMIN-FORMS-SUBMISSIONS-LIST). Severity: critical. ADR-012 D7.
  'form.submission.bulk.queried', // emitted ONCE per POST /api/admin/forms/:formName/submissions/_bulk call (NOT per id). ADR-012 D8.
  'form.submission.deleted',
  'form.submission.detail.queried', // emitted by GET /api/admin/forms/:formName/submissions/:id (US-ADMIN-FORMS-SUBMISSIONS-LIST). ADR-012 D6/D7.
  'form.submission.list.queried', // emitted by GET /api/admin/forms/:formName/submissions (US-ADMIN-FORMS-SUBMISSIONS-LIST).
  'form.submission.received',

  // -----------------------------------------------------------------
  // connection.* — OAuth2 connections to external providers
  // -----------------------------------------------------------------
  'connection.user.connected',
  'connection.user.disconnected',
  'connection.token.refresh_failed',

  // -----------------------------------------------------------------
  // config.* — runtime configuration
  // -----------------------------------------------------------------
  'config.feature_flag.toggled',
  'config.version.queried', // emitted by GET /api/admin/config/version (US-ADMIN-CONFIG-VERSION)

  // -----------------------------------------------------------------
  // realtime.* — WebSocket / SSE sessions (planned)
  // -----------------------------------------------------------------
  'realtime.session.opened',
  'realtime.session.closed',
  'realtime.session.force_disconnected',

  // -----------------------------------------------------------------
  // user.* — admin-dashboard read aggregates over the auth surface
  // (write actions for users live under auth.user.*; this section is
  // for read-only aggregate emits such as the users-overview tile)
  // -----------------------------------------------------------------
  'user.overview.queried', // emitted by GET /api/admin/users/overview (US-ADMIN-USERS-OVERVIEW)

  // -----------------------------------------------------------------
  // audit.* — meta events about the audit log itself
  // -----------------------------------------------------------------
  'audit.log.queried', // emitted when /api/admin/audit-log is queried — see open question §A
  'audit.log.exported',
  'audit.log.archived',
] as const

/**
 * TypeScript literal union of every known audit action code.
 */
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/**
 * Zod enum derived from `AUDIT_ACTIONS`. Single source of truth for every
 * wire-format schema that needs to validate or describe an audit action code
 * (list-query filter, audit-log-entry shape, export-request filter, action
 * catalog descriptor). Inlining `z.enum(AUDIT_ACTIONS)` at call sites is
 * forbidden — always import this constant.
 */
export const auditActionSchema = z.enum(AUDIT_ACTIONS)

/**
 * Type guard that narrows an arbitrary string to `AuditAction`.
 *
 * Use at write-time (application layer) before persisting an audit-log entry
 * to catch typos that would otherwise produce orphan entries that fail the
 * action-catalog endpoint contract.
 */
export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as ReadonlyArray<string>).includes(value)
}
