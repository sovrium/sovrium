/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { formSubmissionAdminItemSchema } from './submissions-list'

/**
 * Form submission detail endpoint shapes.
 *
 * `GET /api/admin/forms/:formName/submissions/:submissionId` — single
 * submission with optional inline audit trail (D6) and optional body reveal
 * (D7).
 *
 * **D6 — `?audit=N` opt-in**: When the caller passes `?audit=N`, the response
 * `_admin.recentAuditTrail` field carries up to N audit-log entries scoped
 * to this submission resource. Default omitted (no inline trail). Max 50;
 * over-max returns 400. This is the FIRST non-audit-log detail endpoint to
 * lock the `?audit=N` opt-in convention — every Phase-1 detail endpoint
 * inherits this shape.
 *
 * **D7 — `?reveal=true` body capture**: When the caller passes `?reveal=true`
 * AND `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` AND has admin role, the
 * response `body` field carries the submitted form field values. Without
 * the env var, ANY `?reveal=true` request returns 403
 * `{ error: 'body-capture-disabled' }`. Without admin role (operator,
 * auditor) `?reveal=true` returns 403 even when the env var is true.
 * Successful reveals emit `form.submission.body.revealed` audit entries
 * (severity: critical) — see plan §6.4 keystone precedent.
 *
 * @see plan §4.7 (story #7), §6.3 (D6 audit opt-in), §6.4 (D7 reveal flow)
 * @see ADR-012 D6/D7
 */

/**
 * Query parameters for `GET /api/admin/forms/:formName/submissions/:id`.
 *
 * Both flags are optional. The default response (no flags) is the
 * canonical detail shape WITHOUT the body and WITHOUT the inline audit
 * trail.
 */
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

/**
 * Response shape for the detail endpoint.
 *
 * Returns the same admin-envelope-extended shape as list items. The
 * conditional `body` and `_admin.recentAuditTrail` fields are populated
 * per the D6/D7 rules above.
 */
export const formSubmissionDetailResponseSchema =
  formSubmissionAdminItemSchema.openapi('FormSubmissionDetail')

/**
 * Error payload returned when `?reveal=true` is requested but
 * `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED` is unset or false.
 *
 * Status code 403 (NOT 404 anti-enum), per the keystone AI body-reveal
 * precedent: the route exists for the caller's role; the operator's env-var
 * policy is the gate. Surfacing `403` with a stable error code lets admin
 * UIs render a "Body capture disabled by operator" banner without parsing
 * arbitrary error strings.
 */
export const bodyCaptureDisabledErrorSchema = z
  .object({
    error: z
      .literal('body-capture-disabled')
      .describe(
        'Stable error code returned when `?reveal=true` is requested but `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED` is unset or false. Admin UIs match this string to render a configuration warning. ADR-012 D7.'
      ),
  })
  .openapi('BodyCaptureDisabledError')

/** @public */
export type FormSubmissionDetailQuery = z.infer<typeof formSubmissionDetailQuerySchema>
/** @public */
export type FormSubmissionDetailResponse = z.infer<typeof formSubmissionDetailResponseSchema>
/** @public */
export type BodyCaptureDisabledError = z.infer<typeof bodyCaptureDisabledErrorSchema>
