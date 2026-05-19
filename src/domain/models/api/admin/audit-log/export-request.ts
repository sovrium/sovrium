/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { severitySchema } from '@/domain/models/api/admin/_shared/severity'
import { auditActionSchema } from './action-catalog'

export const exportAuditLogRequestSchema = z
  .object({
    action: auditActionSchema
      .optional()
      .describe('Filter by exact action code. Same semantics as the list endpoint.'),
    actorId: z.string().optional().describe('Filter by actor identifier.'),
    resourceType: z.string().optional().describe('Filter by namespaced resource type.'),
    resourceId: z.string().optional().describe('Filter by exact resource id.'),
    severity: severitySchema.optional().describe('Filter by severity classification.'),
    from: z.iso
      .datetime()
      .describe(
        'Inclusive lower bound on `timestamp`. ISO 8601. Required (open-ended exports are not supported).'
      ),
    to: z.iso.datetime().describe('Inclusive upper bound on `timestamp`. ISO 8601. Required.'),
    format: z
      .enum(['ndjson'])
      .default('ndjson')
      .describe('Export format. Only NDJSON supported in v1.'),
  })
  .refine((q) => q.from <= q.to, { message: '`from` must be less than or equal to `to`' })
  .refine(
    (q) => {
      const fromMs = Date.parse(q.from)
      const toMs = Date.parse(q.to)
      const days = (toMs - fromMs) / (1000 * 60 * 60 * 24)
      return days <= 368
    },
    {
      message: 'Export range must not exceed 368 days. Paginate by month for longer ranges.',
    }
  )
  .openapi('ExportAuditLogRequest')

export type ExportAuditLogRequest = z.infer<typeof exportAuditLogRequestSchema>

export const exportAuditLogResponseSchema = z
  .object({
    jobId: z
      .string()
      .describe('Unique identifier for the asynchronous export job. Use to poll for status.'),
    statusUrl: z
      .string()
      .describe(
        'Relative URL of the job status endpoint (e.g. `/api/admin/jobs/job_01HK...`). Poll this for completion.'
      ),
    status: z
      .enum(['queued', 'running'])
      .describe('Job status at acknowledgement time. Always `queued` or `running`.'),
    estimatedSize: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .describe(
        'Server estimate of the matching event count, used to size progress bars. Null when the estimate is not yet available.'
      ),
  })
  .openapi('ExportAuditLogResponse')

export type ExportAuditLogResponse = z.infer<typeof exportAuditLogResponseSchema>
