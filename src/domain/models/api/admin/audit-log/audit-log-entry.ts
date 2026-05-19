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

const auditResultSchema = z
  .enum(['success', 'failure'])
  .describe('Whether the underlying operation completed successfully')

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
