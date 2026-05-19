/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { formSubmissionAdminItemSchema } from './submissions-list'


export const formsSubmissionsBulkRequestSchema = z
  .object({
    ids: z
      .array(z.string().uuid())
      .min(1)
      .max(100)
      .describe(
        'Submission ids to fetch (1-100). Order is preserved in the response. Missing or soft-deleted ids drop silently — compare request and response lengths to detect drops.'
      ),
  })
  .openapi('FormsSubmissionsBulkRequest')

export const formsSubmissionsBulkResponseSchema = z
  .object({
    items: z
      .array(formSubmissionAdminItemSchema)
      .describe(
        'Submissions in request-order. Missing or soft-deleted ids are silently omitted; operators detect drops via `request.ids.length - response.items.length`.'
      ),
  })
  .openapi('FormsSubmissionsBulkResponse')

export const tooManyIdsErrorSchema = z
  .object({
    error: z
      .literal('too-many-ids')
      .describe(
        'Stable error code returned when the bulk request `ids` array exceeds 100 entries. Admin UIs match this string to render a "split your batch" warning. ADR-012 §3.4.'
      ),
  })
  .openapi('TooManyIdsError')

export type FormsSubmissionsBulkRequest = z.infer<typeof formsSubmissionsBulkRequestSchema>
export type FormsSubmissionsBulkResponse = z.infer<typeof formsSubmissionsBulkResponseSchema>
export type TooManyIdsError = z.infer<typeof tooManyIdsErrorSchema>
