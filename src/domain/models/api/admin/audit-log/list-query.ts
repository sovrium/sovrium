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

/**
 * Query parameters accepted by `GET /api/admin/audit-log`.
 *
 * Combines the cursor pagination convention (`cursor`, `limit`) with the
 * filters operators need most often during triage:
 *
 *   - `action`        — exact action code from the namespace catalog
 *   - `actorId`       — any actor.id (user, api-token, automation)
 *   - `resourceType`  — exact resource.type prefix (e.g. `table.record`)
 *   - `resourceId`    — exact resource.id (typically combined with type)
 *   - `from` / `to`   — ISO 8601 inclusive timestamps
 *   - `severity`      — single severity classification
 *
 * Filters compound with logical AND. `from` must be ≤ `to`; the server
 * rejects inverted ranges with 400 (caught by the Zod parse, not by an
 * application-layer check).
 *
 * Default sort is descending `timestamp` — the cursor is opaque so callers
 * never set sort direction themselves.
 *
 * @see plan §6.1 cursor pagination convention
 * @see plan §6.2 canonical filter dimensions
 */
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

/** @public */
export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>
