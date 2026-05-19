/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { z } from '@hono/zod-openapi'
import {
  cursorPaginationQuerySchema,
  cursorPaginationResponseSchema,
} from '@/domain/models/api/_shared/cursor-pagination'
import { adminEnvelopeSchema } from '@/domain/models/api/admin/_shared/admin-envelope'
import { runSchema, runStatusSchema } from '@/domain/models/api/automations'

export const automationsRunsListQuerySchema = cursorPaginationQuerySchema
  .extend({
    status: runStatusSchema
      .optional()
      .describe(
        'Filter by run status. Mirrors the public `?status` filter on `/api/automations/runs` so admin and public callers share one vocabulary.'
      ),
    automationName: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Filter by automation definition name (matches the `name` field in the app schema `automations[]` array). Mirrors the public `?automationName` filter.'
      ),
    automationId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Filter by automation definition UUID. Admin-only — operators reading audit log entries scope by `resource.id` and the id is the stable cross-reference. Co-existing with `?automationName` is fine; both are AND-combined when both are provided.'
      ),
    from: z.iso
      .datetime()
      .optional()
      .describe(
        'Lower bound (inclusive) on `startedAt` as ISO 8601. Pair with `to` to scope to a custom window; pair with neither to scope to all history (subject to retention).'
      ),
    to: z.iso
      .datetime()
      .optional()
      .describe(
        'Upper bound (exclusive) on `startedAt` as ISO 8601. Returns 400 when `from > to`.'
      ),
    include_deleted: z
      .union([z.boolean(), z.string()])
      .transform((value) => {
        if (typeof value === 'boolean') return value
        return value === 'true' || value === '1'
      })
      .pipe(z.boolean())
      .default(false)
      .describe(
        'Include soft-deleted runs. Default `false` — the D2 lock. Pass `?include_deleted=true` to surface tombstones for compliance review. The flag parses without 400 even when the underlying table has no soft-delete column yet (forward-contract — see story §risks).'
      ),
  })
  .openapi('AutomationsRunsListQuery')

export type AutomationsRunsListQuery = z.infer<typeof automationsRunsListQuerySchema>

export const automationRunAdminItemSchema = runSchema
  .extend({
    _admin: adminEnvelopeSchema,
  })
  .openapi('AutomationRunAdminItem')

export type AutomationRunAdminItem = z.infer<typeof automationRunAdminItemSchema>

export const automationsRunsListResponseSchema = cursorPaginationResponseSchema(
  automationRunAdminItemSchema
).openapi('AutomationsRunsListResponse')

export type AutomationsRunsListResponse = z.infer<typeof automationsRunsListResponseSchema>

export const automationsRunsDetailParamsSchema = z
  .object({
    runId: z
      .string()
      .uuid()
      .describe('Run id (UUID) — matches `runSchema.id` from the public runs API.'),
  })
  .openapi('AutomationsRunsDetailParams')

export type AutomationsRunsDetailParams = z.infer<typeof automationsRunsDetailParamsSchema>

export const automationsRunsDetailResponseSchema = automationRunAdminItemSchema.openapi(
  'AutomationsRunsDetailResponse'
)

export type AutomationsRunsDetailResponse = z.infer<typeof automationsRunsDetailResponseSchema>
