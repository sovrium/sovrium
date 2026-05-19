/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import { actorSchema } from './actor'

export const adminEnvelopeSchema = z
  .object({
    auditTrailCount: z
      .number()
      .int()
      .nonnegative()
      .describe(
        'Number of audit-log entries that reference this resource as their `resource.id`. Read this before drilling into `/api/admin/audit-log?resourceId=...` to skip rows with no trail.'
      ),
    lastModifiedBy: actorSchema
      .nullable()
      .describe(
        'Canonical actor block for the most recent mutation against this resource. Null when the resource has not been mutated since creation (creation actor is logged on the audit trail, not echoed here).'
      ),
    deletedAt: z.iso
      .datetime()
      .nullable()
      .describe(
        'ISO 8601 UTC timestamp of soft-delete; null for active rows. Always present so the dashboard renders the soft-delete badge consistently — `_admin.deletedAt !== null` is the single source of truth across every domain.'
      ),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Domain-specific operator extras nested here so the canonical block stays stable across domains. Used by buckets (fileCount, totalBytes), forms (submissionCount), AI tool calls (cost-USD), etc. Omit when the domain has no extras.'
      ),
  })
  .openapi('AdminEnvelope')

export type AdminEnvelope = z.infer<typeof adminEnvelopeSchema>
