/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { formSubmissionAdminItemSchema } from './submissions-list'

/**
 * Form submission bulk read endpoint shapes.
 *
 * `POST /api/admin/forms/:formName/submissions/_bulk` — fetch multiple
 * submissions by ID array in a single request. Locks D8: the `_bulk` URL
 * convention (underscore prefix, segment after `:formName/submissions/`)
 * is established here as Sovrium's bulk read contract for every Phase-1+
 * domain that needs one (`/api/admin/{tables,buckets,users}/.../{slug}/_bulk`).
 *
 * **Why POST, not GET**: A 100-id query string can exceed 8KB on long UUIDs,
 * which several reverse proxies truncate or reject. Bulk reads are the only
 * read-class endpoints where this happens, so they are POST despite being
 * read-only. The `_bulk` segment makes the intent obvious in URLs and
 * audit-log filters.
 *
 * **Body redaction**: Bulk responses NEVER include the `body` field. Body
 * reveal is intentionally restricted to the single-resource detail endpoint
 * (per D7) so each reveal produces ONE `form.submission.body.revealed`
 * audit entry — never 100 in a burst. Operators who need bulk body access
 * must either (a) dump the underlying database via a privileged path, or
 * (b) iterate the detail endpoint, generating one audit entry per reveal.
 *
 * **Order preservation**: Items in the response appear in the same order as
 * the input `ids` array. Ids that don't exist (or that are soft-deleted
 * without the corresponding `include_deleted` opt-in — but bulk does not
 * support that flag in this Phase 0 contract; soft-deleted ids drop) are
 * silently dropped from the response. Operators who need to know which ids
 * were dropped compare `request.ids.length` to `response.items.length`.
 *
 * **Max 100 ids**: Above 100, returns 400 `{ error: 'too-many-ids' }`.
 * Locks ADR-012 §3.4. The 100 ceiling matches the request-size budget the
 * server can reasonably parse + execute within the request timeout.
 *
 * @see plan §4.7 (story #7), §6.4 (bulk emit policy)
 * @see ADR-012 D8
 */

/**
 * Bulk read request payload.
 *
 * `ids` is an array of UUID strings. Empty arrays return 400 (a meaningful
 * bulk read needs at least one id; passing zero is a client bug). Over-100
 * returns 400 `too-many-ids`.
 */
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

/**
 * Bulk read response payload.
 *
 * Items appear in request order. Missing ids drop; the response is NOT a
 * sparse array. Each item carries the full admin envelope (same shape as
 * list items). The `body` field is ALWAYS absent — bulk reads do not honor
 * `?reveal=true`.
 */
export const formsSubmissionsBulkResponseSchema = z
  .object({
    items: z
      .array(formSubmissionAdminItemSchema)
      .describe(
        'Submissions in request-order. Missing or soft-deleted ids are silently omitted; operators detect drops via `request.ids.length - response.items.length`.'
      ),
  })
  .openapi('FormsSubmissionsBulkResponse')

/**
 * Error payload returned when the bulk request exceeds 100 ids.
 *
 * Status code 400, stable error string. Locked by ADR-012 §3.4.
 */
export const tooManyIdsErrorSchema = z
  .object({
    error: z
      .literal('too-many-ids')
      .describe(
        'Stable error code returned when the bulk request `ids` array exceeds 100 entries. Admin UIs match this string to render a "split your batch" warning. ADR-012 §3.4.'
      ),
  })
  .openapi('TooManyIdsError')

/** @public */
export type FormsSubmissionsBulkRequest = z.infer<typeof formsSubmissionsBulkRequestSchema>
/** @public */
export type FormsSubmissionsBulkResponse = z.infer<typeof formsSubmissionsBulkResponseSchema>
/** @public */
export type TooManyIdsError = z.infer<typeof tooManyIdsErrorSchema>
