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


export const formSubmissionStatusSchema = z
  .enum(['received', 'processing', 'done', 'failed', 'spam'])
  .describe('Form submission lifecycle status')

export const formSubmissionSchema = z
  .object({
    id: z.string().uuid().describe('Stable submission identifier (UUID)'),
    formName: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .describe(
        'Slug of the parent form (lowercase, kebab-case). Matches the `name` field of the `app.forms[]` entry that received this submission.'
      ),
    submittedAt: z
      .string()
      .datetime()
      .describe(
        'ISO 8601 UTC timestamp recorded when the public submit endpoint accepted the form'
      ),
    status: formSubmissionStatusSchema,
    body: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Field values submitted by the form. Present ONLY when the detail endpoint is called with `?reveal=true` AND `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` AND the caller has admin role. Absent on list responses, on detail without reveal, on operator/auditor reveals, and when the env var is unset/false. ADR-012 D7.'
      ),
  })
  .openapi('FormSubmission')

export const formSubmissionAdminItemSchema = formSubmissionSchema
  .extend({
    _admin: adminEnvelopeSchema
      .extend({
        recentAuditTrail: z
          .array(z.unknown())
          .max(50)
          .optional()
          .describe(
            'Up to N recent audit-log entries scoped to this submission resource. Present ONLY when the detail endpoint is called with `?audit=N` (max 50). Absent on list responses and on detail without the `?audit` query parameter. ADR-012 D6 opt-in.'
          ),
      })
      .describe('Operator-grade admin envelope for this submission'),
  })
  .openapi('FormSubmissionAdminItem')

export const formsSubmissionsListQuerySchema = cursorPaginationQuerySchema.extend({
  status: formSubmissionStatusSchema.optional().describe('Filter to one lifecycle state'),
  from: z
    .string()
    .datetime()
    .optional()
    .describe('Inclusive lower bound on `submittedAt` (ISO 8601 UTC)'),
  to: z
    .string()
    .datetime()
    .optional()
    .describe('Exclusive upper bound on `submittedAt` (ISO 8601 UTC)'),
  include_deleted: z.coerce
    .boolean()
    .default(false)
    .describe(
      'When true, include soft-deleted submissions (`deletedAt` non-null) in the response. Default false. ADR-012 D2.'
    ),
})

export const formsSubmissionsListResponseSchema = cursorPaginationResponseSchema(
  formSubmissionAdminItemSchema
).openapi('FormsSubmissionsListResponse')

export type FormSubmissionStatus = z.infer<typeof formSubmissionStatusSchema>
export type FormSubmission = z.infer<typeof formSubmissionSchema>
export type FormSubmissionAdminItem = z.infer<typeof formSubmissionAdminItemSchema>
export type FormsSubmissionsListQuery = z.infer<typeof formsSubmissionsListQuerySchema>
export type FormsSubmissionsListResponse = z.infer<typeof formsSubmissionsListResponseSchema>
