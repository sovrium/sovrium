/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { looseIsoDateTime, uuid } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { paginationSchema } from '../combinators/common'
import { withDefault } from '../combinators/schema-defaults'
import { formNameSchema } from './forms'

/**
 * Submission lifecycle status — mirrors the form_submissions ledger column.
 *
 * - received: just created, dual-write in progress
 * - processing: bound table written, automation invocation pending
 * - done: bound table + automation both succeeded
 * - failed: ledger row preserved with status_reason; submission writes may still
 * have committed (non-rollback contract)
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
 * File metadata embedded in submission data for attachment fields.
 */
export const submissionFileMetadataSchema = Schema.Struct({
  url: Schema.String.annotate({ description: 'Storage URL (signed when bucket is private)' }),
  name: Schema.String.annotate({ description: 'Original filename' }),
  size: Schema.Int.annotate({ description: 'File size in bytes' }).pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ),
  mimeType: Schema.String.annotate({ description: 'MIME type of the uploaded file' }),
}).annotate({ identifier: 'SubmissionFileMetadata' })

/**
 * Submitter context recorded on every ledger row.
 *
 *, the IP is HASHED (SHA-256 with per-app salt) before
 * persistence; the raw IP is never stored or returned.
 */
export const submissionMetaSchema = Schema.Struct({
  submittedAt: looseIsoDateTime({ description: 'ISO 8601 submission timestamp' }),
  submitterUserId: Schema.NullOr(
    Schema.String.annotate({
      description: 'Authenticated user id (null for anonymous public-form submissions)',
    })
  ),
  submitterIpHash: Schema.String.annotate({
    description: 'SHA-256 hash of submitter IP with per-app salt',
  }),
  submitterUserAgent: optionalField(Schema.String),
}).annotate({ identifier: 'SubmissionMeta' })

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
 * Response for `POST /api/forms/{name}/submissions` (success) and
 * `GET /api/forms/{name}/submissions/{id}`.
 */
export const submissionResponseSchema = Schema.Struct({
  id: uuid({ description: 'Submission ledger row id (UUID)' }),
  formId: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0))),
  formName: formNameSchema,
  status: submissionStatusSchema,
  statusReason: optionalField(
    Schema.NullOr(
      Schema.String.annotate({ description: 'Populated when status is failed or spam' })
    )
  ),
  data: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'Validated submission data; attachment fields contain SubmissionFileMetadata',
  }),
  linkedRecord: Schema.NullOr(
    Schema.Struct({
      table: Schema.String,
      id: Schema.Union([Schema.String, Schema.Finite]),
    }).annotate({
      description: 'Bound-table row reference when submitTo.table was set; null otherwise',
    })
  ),
  meta: submissionMetaSchema,
  completedAt: Schema.NullOr(
    looseIsoDateTime({ description: 'ISO 8601 timestamp when status reached done/failed/spam' })
  ),
}).annotate({ identifier: 'SubmissionResponse' })

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
 * instead of streaming directly (AC 122).
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

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type SubmissionStatus = typeof submissionStatusSchema.Type
/** @public */
export type SubmissionFileMetadata = typeof submissionFileMetadataSchema.Type
/** @public */
export type SubmissionMeta = typeof submissionMetaSchema.Type
/** @public */
export type CreateSubmissionRequest = typeof createSubmissionRequestSchema.Type
/** @public */
export type SubmissionResponse = typeof submissionResponseSchema.Type
/** @public */
export type SubmissionSummary = typeof submissionSummarySchema.Type
/** @public */
export type ListSubmissionsResponse = typeof listSubmissionsResponseSchema.Type
/** @public */
export type ExportSubmissionsRequest = typeof exportSubmissionsRequestSchema.Type
