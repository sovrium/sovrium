/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { formSubmissionAdminItemSchema } from './submissions-list'


export const formSubmissionDetailQuerySchema = z.object({
  reveal: z.coerce
    .boolean()
    .default(false)
    .describe(
      'When true, include the submitted `body` field. Requires admin role AND `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`. Returns 403 `body-capture-disabled` if the env var is unset/false; 403 if the caller is not an admin. Successful reveals emit `form.submission.body.revealed` (severity: critical). ADR-012 D7.'
    ),
  audit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe(
      'When set, include up to N recent audit-log entries scoped to this submission resource under `_admin.recentAuditTrail`. Max 50; over-max returns 400 invalid query. Default omitted (no inline trail). ADR-012 D6 opt-in.'
    ),
})

export const formSubmissionDetailResponseSchema =
  formSubmissionAdminItemSchema.openapi('FormSubmissionDetail')

export const bodyCaptureDisabledErrorSchema = z
  .object({
    error: z
      .literal('body-capture-disabled')
      .describe(
        'Stable error code returned when `?reveal=true` is requested but `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED` is unset or false. Admin UIs match this string to render a configuration warning. ADR-012 D7.'
      ),
  })
  .openapi('BodyCaptureDisabledError')

export type FormSubmissionDetailQuery = z.infer<typeof formSubmissionDetailQuerySchema>
export type FormSubmissionDetailResponse = z.infer<typeof formSubmissionDetailResponseSchema>
export type BodyCaptureDisabledError = z.infer<typeof bodyCaptureDisabledErrorSchema>
