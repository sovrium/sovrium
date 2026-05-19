/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { cursorPaginationQuerySchema } from '@/domain/models/api/_shared/cursor-pagination'
import { actorTypeSchema } from '@/domain/models/api/admin/_shared/actor'
import { severitySchema } from '@/domain/models/api/admin/_shared/severity'
import { auditActionSchema } from './action-catalog'

export const listAuditLogQuerySchema = cursorPaginationQuerySchema
  .extend({
    action: auditActionSchema
      .optional()
      .describe('Filter by exact action code. See action-catalog.ts for the authoritative list.'),
    actorId: z
      .string()
      .optional()
      .describe(
        'Filter by actor identifier (user id, api-token id, automation id). Combined with optional `actorType` server-side.'
      ),
    actorType: actorTypeSchema.optional().describe('Narrow the actor by class.'),
    resourceType: z
      .string()
      .optional()
      .describe(
        'Filter by namespaced resource type (e.g. `table.record`, `automation.run`, `bucket.file`).'
      ),
    resourceId: z
      .string()
      .optional()
      .describe(
        'Filter by exact resource identifier. Typically used together with `resourceType` so the join is unambiguous.'
      ),
    severity: severitySchema.optional().describe('Filter by severity classification.'),
    from: z.iso
      .datetime()
      .optional()
      .describe(
        'Inclusive lower bound on `timestamp`. ISO 8601. Combined with `to` for explicit ranges; ignored if absent.'
      ),
    to: z.iso
      .datetime()
      .optional()
      .describe(
        'Inclusive upper bound on `timestamp`. ISO 8601. Server returns 400 if `from > to`.'
      ),
  })
  .refine(
    (q) => {
      if (q.from && q.to) return q.from <= q.to
      return true
    },
    { message: '`from` must be less than or equal to `to`' }
  )

export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>
