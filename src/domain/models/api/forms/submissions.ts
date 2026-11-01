/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uuid } from '@/domain/kernel/config-parsing/formats'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'
import { paginationSchema } from '../common'
import { withDefault } from '../schema-defaults'
import { formNameSchema } from './forms'

/**
 * Submission lifecycle status — mirrors the form_submissions ledger column.
 *
 * - received: just created, dual-write in progress
 * - processing: bound table written, automation invocation pending
 * - done: bound table + automation both succeeded
 * - failed: ledger row preserved with status_reason; submission writes may still
 *   have committed (per the forms submission storage requirement non-rollback contract)
 * - spam: caught by honeypot or rate limiter; never reached automation/table
 */
export const submissionStatusSchema = Schema.Literals([
  'received',
  'processing',
  'done',
  'failed',
  'spam',
]).annotate({ description: 'Submission lifecycle state' })

/**
 * Body of `POST /api/forms/{name}/submissions`.
 *
 * The shape of `data` is dynamic (depends on the form's fields[]), so the API
 * schema accepts an opaque record. Server-side validation against the form's
 * Effect Schema enforces field types, required-ness, and conditional rules.
 *
 * `files` is a separate map keyed by field name, populated from the multipart
 * upload boundary; the API schema accepts file metadata only (the actual
 * upload bytes go through the bucket service).
 */
export const createSubmissionRequestSchema = Schema.Struct({
  data: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'Submitted field values keyed by field name',
  }),
}).annotate({ identifier: 'CreateSubmissionRequest' })

/**
 * Response for `POST /api/forms/{name}/submissions` from a JSON client. A native
 * form post is answered with a redirect instead.
 */
export const submissionResponseSchema = Schema.Struct({
  submissionId: Schema.NullOr(Schema.String).annotate({
    description: 'Submission ledger row id, or null when no ledger row was kept for this answer',
  }),
  linkedRecordId: Schema.NullOr(Schema.String).annotate({
    description: 'Id of the row written to the bound table, or null when no row was written',
  }),
  record: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'The accepted values keyed by field name',
  }),
  editUrl: optionalField(
    Schema.String.annotate({
      description: 'Private link to edit this answer, for a form that allows editing it',
    })
  ),
}).annotate({ identifier: 'SubmissionResponse' })

/** Response for an edit through a private link, from a JSON client. */
export const submissionEditResponseSchema = Schema.Struct({
  submissionId: Schema.String.annotate({ description: 'Id of the edited submission' }),
}).annotate({ identifier: 'SubmissionEditResponse' })

/**
 * Response for `POST /api/forms/{name}/drafts`. The resume link travels only in
 * the mail, so the answer states when it expires and nothing else.
 */
export const formDraftSavedResponseSchema = Schema.Struct({
  expiresAt: looseIsoDateTime({ description: 'ISO 8601 timestamp when the resume link expires' }),
}).annotate({ identifier: 'FormDraftSavedResponse' })

/**
 * Compact submission item for list endpoints.
 */
export const submissionSummarySchema = Schema.Struct({
  id: uuid(),
  formName: formNameSchema,
  status: submissionStatusSchema,
  submittedAt: looseIsoDateTime(),
  submitterUserId: Schema.NullOr(Schema.String),
}).annotate({ identifier: 'SubmissionSummary' })

/**
 * Response for `GET /admin/forms/{name}/submissions`.
 */
export const listSubmissionsResponseSchema = Schema.Struct({
  items: Schema.Array(submissionSummarySchema),
  pagination: paginationSchema,
}).annotate({ identifier: 'ListSubmissionsResponse' })

/**
 * Query parameters for `GET /admin/forms/{name}/submissions/export`.
 *
 * For result sets larger than 1000 rows, the endpoint returns 202 + a job id
 * instead of streaming directly (per the forms analytics and responses requirement AC 122).
 */
export const exportSubmissionsRequestSchema = Schema.Struct({
  format: Schema.Literals(['csv', 'json', 'xlsx'])
    .annotate({ description: 'Export file format' })
    .pipe(withDefault('csv')),
  status: optionalField(
    submissionStatusSchema.annotate({ description: 'Filter by lifecycle status' })
  ),
  from: optionalField(
    looseIsoDateTime({ description: 'Filter: submitted on or after this ISO 8601 timestamp' })
  ),
  to: optionalField(
    looseIsoDateTime({ description: 'Filter: submitted on or before this ISO 8601 timestamp' })
  ),
}).annotate({ identifier: 'ExportSubmissionsRequest' })
