/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'


export const AUDIT_ACTIONS = [
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

  'record.created',
  'record.updated',
  'record.deleted',
  'record.restored',
  'record.force_deleted',
  'record.batch_created',
  'record.batch_updated',
  'record.batch_deleted',
  'record.batch_restored',
  'record.exported',

  'table.permissions.changed',
  'table.index.rebuilt',
  'table.overview.queried',

  'automation.definition.enabled',
  'automation.definition.disabled',
  'automation.overview.queried',
  'automation.run.started',
  'automation.run.completed',
  'automation.run.failed',
  'automation.run.retried',
  'automation.run.cancelled',
  'automation.run.dead_lettered',
  'automation.runs.list.queried',
  'automation.runs.detail.queried',

  'bucket.file.uploaded',
  'bucket.file.deleted',
  'bucket.file.signed_url_issued',
  'bucket.quota.exceeded',
  'bucket.list.queried',
  'bucket.overview.queried',

  'webhook.subscription.created',
  'webhook.subscription.deleted',
  'webhook.secret.rotated',
  'webhook.delivery.succeeded',
  'webhook.delivery.failed',
  'webhook.delivery.retried',
  'webhook.delivery.dead_lettered',

  'notification.dispatched',
  'notification.delivered',
  'notification.failed',
  'notification.retried',
  'notification.digest.sent',

  'ai.request.completed',
  'ai.request.failed',
  'ai.budget.warned',
  'ai.budget.exceeded',
  'ai.embedding.rebuilt',
  'ai.mcp.invocation.completed',
  'ai.mcp.invocation.failed',
  'audit.body.revealed',

  'email.queued',
  'email.sent',
  'email.bounced',
  'email.failed',
  'email.retried',

  'form.detail.queried',
  'form.list.queried',
  'form.submission.body.revealed',
  'form.submission.bulk.queried',
  'form.submission.deleted',
  'form.submission.detail.queried',
  'form.submission.list.queried',
  'form.submission.received',

  'connection.user.connected',
  'connection.user.disconnected',
  'connection.token.refresh_failed',

  'config.feature_flag.toggled',
  'config.version.queried',

  'realtime.session.opened',
  'realtime.session.closed',
  'realtime.session.force_disconnected',

  'user.overview.queried',

  'audit.log.queried',
  'audit.log.exported',
  'audit.log.archived',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const auditActionSchema = z.enum(AUDIT_ACTIONS)

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as ReadonlyArray<string>).includes(value)
}
