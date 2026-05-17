/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { actorSchema } from '@/domain/models/api/admin/_shared/actor'
import { resourceSchema } from '@/domain/models/api/admin/_shared/resource'
import { severitySchema } from '@/domain/models/api/admin/_shared/severity'
import { auditActionSchema } from './action-catalog'

/**
 * Operation outcome attached to every audit-log entry.
 *
 * `success` indicates the side-effect committed; `failure` indicates a
 * recoverable failure path was emitted (e.g. webhook delivery 500'd, AI
 * request errored). Outcome is independent of severity — a `success` event
 * can still be `critical` (PII reveal) and a `failure` can be `info` (a
 * scheduled retry that's expected to succeed shortly).
 */
const auditResultSchema = z
  .enum(['success', 'failure'])
  .describe('Whether the underlying operation completed successfully')

/**
 * Canonical audit-log entry shape returned by `/api/admin/audit-log` and
 * `/api/admin/audit-log/:id`.
 *
 * **Immutability**: every entry is written once and never mutated. There is
 * no PATCH/DELETE on audit-log entries — `auth.user.pii_redacted` events
 * scrub PII from the auth tables but the audit log itself retains hashed
 * actor identifiers (see plan §6.9 PII redaction policy).
 *
 * **action** is constrained to the namespace catalog — see `action-catalog.ts`.
 *
 * **prompt/response** appear only when `action.startsWith('ai.')` AND the
 * `AI_AUDIT_CAPTURE_BODIES_ALLOWED` env var is `true`. List responses always
 * redact them; the detail endpoint reveals them only for `admin` callers
 * (operators and auditors get the redacted variant).
 *
 * @see plan §6.2 (audit-log shape)
 * @see plan §12 Q2/Q3/Q4 (locked retention, body capture, force-delete)
 */
export const auditLogEntrySchema = z
  .object({
    id: z
      .string()
      .describe(
        'Stable audit event identifier (e.g. `audit_01HK3XTZQYVABCD`). Generated server-side; clients must not assume any internal structure beyond uniqueness.'
      ),
    timestamp: z.iso
      .datetime()
      .describe(
        'ISO 8601 timestamp at which the action was committed. Used as the sort key (descending) and the partition column for the 90-day hot-table.'
      ),
    actor: actorSchema,
    action: auditActionSchema.describe(
      'Action code from the canonical namespace catalog. See action-catalog.ts for the authoritative list.'
    ),
    resource: resourceSchema,
    result: auditResultSchema,
    severity: severitySchema,
    correlationId: z
      .string()
      .nullable()
      .describe(
        'Optional request correlation id (Hono context request id, automation run id, etc.) used to group related audit entries across services. Null when no correlation context was available at write-time.'
      ),
    metadata: z
      .record(z.string(), z.unknown())
      .nullable()
      .describe(
        'Open metadata bag (HTTP method, path, status code, retry attempt count, automation step name, etc.). Null when no extra context was attached.'
      ),
    prompt: z
      .string()
      .nullable()
      .optional()
      .describe(
        'AI-only: user prompt sent to the provider. Present iff `action.startsWith("ai.")` AND `AI_AUDIT_CAPTURE_BODIES_ALLOWED=true`. Always null in list responses; populated on detail endpoint after explicit reveal (admin role only).'
      ),
    response: z
      .string()
      .nullable()
      .optional()
      .describe('AI-only: provider response body. Same gating rules as `prompt`.'),
  })
  .openapi('AuditLogEntry')

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>
