/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { booleanFlag, coercedNumber } from '@/domain/models/api/combinators/coerce'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { withDefault } from '../../combinators/schema-defaults'
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
 * ?reveal=true returns 403 even when the env var is true.
 * Successful reveals emit `form.submission.body.revealed` audit entries
 * (severity: critical) — see plan §6.4 keystone precedent.
 *
 * @see plan §4.7 (story #7), §6.3 (D6 audit opt-in), §6.4 (D7 reveal flow)
 * @see [internal ref] D6/D7
 */

/**
 * Query parameters for `GET /api/admin/forms/:formName/submissions/:id`.
 *
 * Both flags are optional. The default response (no flags) is the
 * canonical detail shape WITHOUT the body and WITHOUT the inline audit
 * trail.
 */
export const formSubmissionDetailQuerySchema = Schema.Struct({
  reveal: booleanFlag
    .annotate({
      description:
        'When `true` (or `1`), include the submitted `body` field. Parsed strictly, as the list parses it: `false`, `0` and any other value mean no reveal. Requires admin role AND `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`. Returns 403 `body-capture-disabled` if the env var is unset/false; 403 if the caller is not an admin. Successful reveals emit `form.submission.body.revealed` (severity: critical).',
    })
    .pipe(withDefault(false)),
  audit: optionalField(
    coercedNumber
      .annotate({
        description:
          'When set, include up to N recent audit-log entries scoped to this submission resource under `_admin.recentAuditTrail`. Max 50; over-max returns 400 invalid query. Default omitted (no inline trail).',
      })
      .pipe(
        Schema.check(
          Schema.isInt(),
          Schema.isGreaterThanOrEqualTo(1),
          Schema.isLessThanOrEqualTo(50)
        )
      )
  ),
})

/**
 * The revealed answers as the form asks them: an answer keyed by its
 * question's label, and a `fieldGroups` section as an object of its answers
 * keyed by the section's label, in the form's order.
 */
const submissionAnswersSchema = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.String)])
).annotate({
  description:
    "Present exactly when `body` is: the submitted answers read through the form. Each answer is keyed by its question's label and given as the text a reader reads (a choice by its option's label, a list joined, a file by its name); the answers of a `fieldGroups` section are an object keyed by the section's label, in the form's order, after any answer no section lists. A section holding no answer is left out.",
})

/**
 * Response shape for the detail endpoint.
 *
 * Returns the same admin-envelope-extended shape as list items. The
 * conditional `body` and `_admin.recentAuditTrail` fields are populated
 * per the D6/D7 rules above; `answers` rides with `body`.
 */
export const formSubmissionDetailResponseSchema = Schema.Struct({
  ...formSubmissionAdminItemSchema.fields,
  answers: optionalField(submissionAnswersSchema),
  label: optionalField(
    Schema.String.annotate({
      description:
        "What the console calls this submission, in the caller's console language. With the answers revealed, the first text answer in the form's order, the rule that names a record (`Garnier, Sophie`). Without them, a phrase that gives away no answer: the word for a submission and when it arrived, read day-relative in the operator's zone (`Submission · Today 10:00`, `Réponse · Aujourd’hui 10:00`).",
      examples: ['Garnier, Sophie', 'Submission · Today 10:00'],
    })
  ),
}).annotate({
  identifier: 'FormSubmissionDetail',
})

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
export const bodyCaptureDisabledErrorSchema = Schema.Struct({
  error: Schema.Literal('body-capture-disabled').annotate({
    description:
      'Stable error code returned when `?reveal=true` is requested but `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED` is unset or false. Admin UIs match this string to render a configuration warning.',
  }),
}).annotate({ identifier: 'BodyCaptureDisabledError' })

/** @public */
export type FormSubmissionDetailQuery = typeof formSubmissionDetailQuerySchema.Type
/** @public */
export type FormSubmissionDetailResponse = typeof formSubmissionDetailResponseSchema.Type
/** @public */
export type BodyCaptureDisabledError = typeof bodyCaptureDisabledErrorSchema.Type
