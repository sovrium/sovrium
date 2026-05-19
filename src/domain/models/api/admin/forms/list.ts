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
import { formSummarySchema } from '@/domain/models/api/forms/forms'

export const formsListQuerySchema = cursorPaginationQuerySchema
  .extend({
    search: z
      .string()
      .min(1)
      .optional()
      .describe(
        "Case-insensitive free-text substring match over each form's `title` AND `name` (matches in either field qualify). Empty result set returns `items: []` with HTTP 200, NOT 404 — matching the canonical empty-result-vs-anti-enum distinction (anti-enum 404 is reserved for unauthorized access, NOT empty queries)."
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
        'Include soft-deleted forms. Default `false` — D2 consumption from runs-list. Pass `?include_deleted=true` to surface tombstones for compliance review. The flag parses without 400 even though forms cannot be soft-deleted in Phase 0 (forward-contract — see story §dependencies).'
      ),
  })
  .openapi('FormsListQuery')

export type FormsListQuery = z.infer<typeof formsListQuerySchema>

export const formAdminItemSchema = formSummarySchema
  .extend({
    _admin: adminEnvelopeSchema,
  })
  .openapi('FormAdminItem')

export type FormAdminItem = z.infer<typeof formAdminItemSchema>

export const formsListResponseSchema =
  cursorPaginationResponseSchema(formAdminItemSchema).openapi('FormsListResponse')

export type FormsListResponse = z.infer<typeof formsListResponseSchema>

export const formsDetailParamsSchema = z
  .object({
    formName: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9-]*$/, 'must be kebab-case starting with a letter')
      .describe(
        'Form name (kebab-case) — matches `formNameSchema` from the public `/api/forms/:name` endpoint.'
      ),
  })
  .openapi('FormsDetailParams')

export type FormsDetailParams = z.infer<typeof formsDetailParamsSchema>

export const formAdminDetailResponseSchema = formAdminItemSchema.openapi('FormsDetailResponse')

export type FormAdminDetailResponse = z.infer<typeof formAdminDetailResponseSchema>
