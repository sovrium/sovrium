/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { paginationSchema } from '../_shared/common'
import { formNameSchema } from './forms'

/**
 * Submission lifecycle status — mirrors the form_submissions ledger column.
 *
 * - received: just created, dual-write in progress
 * - processing: bound table written, automation invocation pending
 * - done: bound table + automation both succeeded
 * - failed: ledger row preserved with status_reason; submission writes may still
 *   have committed (per US-FORMS-SUBMISSION-STORAGE non-rollback contract)
 * - spam: caught by honeypot or rate limiter; never reached automation/table
 */
export const submissionStatusSchema = z
  .enum(['received', 'processing', 'done', 'failed', 'spam'])
  .describe('Submission lifecycle state')

/**
 * File metadata embedded in submission data for attachment fields.
 */
export const submissionFileMetadataSchema = z
  .object({
    url: z.string().describe('Storage URL (signed when bucket is private)'),
    name: z.string().describe('Original filename'),
    size: z.number().int().min(0).describe('File size in bytes'),
    mimeType: z.string().describe('MIME type of the uploaded file'),
  })
  .openapi('SubmissionFileMetadata')

/**
 * Submitter context recorded on every ledger row.
 *
 * Per US-FORMS-ANTI-SPAM, the IP is HASHED (SHA-256 with per-app salt) before
 * persistence; the raw IP is never stored or returned.
 */
export const submissionMetaSchema = z
  .object({
    submittedAt: z.iso.datetime().describe('ISO 8601 submission timestamp'),
    submitterUserId: z
      .string()
      .nullable()
      .describe('Authenticated user id (null for anonymous public-form submissions)'),
    submitterIpHash: z.string().describe('SHA-256 hash of submitter IP with per-app salt'),
    submitterUserAgent: z.string().optional(),
  })
  .openapi('SubmissionMeta')

/**
 * Body of `POST /api/forms/{name}/submissions`.
 *
 * The shape of `data` is dynamic (depends on the form's fields[]), so the API
 * schema accepts an opaque record. Server-side validation against the form's
 * Effect Schema enforces field types, required-ness, and conditional rules.
 *
 * `files` is a separate map keyed by field name, populated from the multipart
 * upload boundary; the API schema accepts file metadata only (the actual
 * upload bytes go through the bucket service per US-FORMS-FILE-UPLOADS).
 */
export const createSubmissionRequestSchema = z
  .object({
    data: z.record(z.string(), z.unknown()).describe('Submitted field values keyed by field name'),
    captchaToken: z
      .string()
      .optional()
      .describe('CAPTCHA verification token (Phase 3 — required when antiSpam.captcha is set)'),
  })
  .openapi('CreateSubmissionRequest')

/**
 * Response for `POST /api/forms/{name}/submissions` (success) and
 * `GET /api/forms/{name}/submissions/{id}`.
 */
export const submissionResponseSchema = z
  .object({
    id: z.uuid().describe('Submission ledger row id (UUID)'),
    formId: z.number().int().positive(),
    formName: formNameSchema,
    status: submissionStatusSchema,
    statusReason: z
      .string()
      .nullable()
      .optional()
      .describe('Populated when status is failed or spam'),
    data: z
      .record(z.string(), z.unknown())
      .describe('Validated submission data; attachment fields contain SubmissionFileMetadata'),
    linkedRecord: z
      .object({
        table: z.string(),
        id: z.union([z.string(), z.number()]),
      })
      .nullable()
      .describe('Bound-table row reference when submitTo.table was set; null otherwise'),
    meta: submissionMetaSchema,
    completedAt: z.iso
      .datetime()
      .nullable()
      .describe('ISO 8601 timestamp when status reached done/failed/spam'),
  })
  .openapi('SubmissionResponse')

/**
 * Compact submission item for list endpoints.
 */
export const submissionSummarySchema = z
  .object({
    id: z.uuid(),
    formName: formNameSchema,
    status: submissionStatusSchema,
    submittedAt: z.iso.datetime(),
    submitterUserId: z.string().nullable(),
  })
  .openapi('SubmissionSummary')

/**
 * Response for `GET /admin/forms/{name}/submissions`.
 */
export const listSubmissionsResponseSchema = z
  .object({
    items: z.array(submissionSummarySchema),
    pagination: paginationSchema,
  })
  .openapi('ListSubmissionsResponse')

/**
 * Query parameters for `GET /admin/forms/{name}/submissions/export`.
 *
 * For result sets larger than 1000 rows, the endpoint returns 202 + a job id
 * instead of streaming directly (per US-FORMS-ANALYTICS-AND-RESPONSES AC 122).
 */
export const exportSubmissionsRequestSchema = z
  .object({
    format: z.enum(['csv', 'json', 'xlsx']).default('csv').describe('Export file format'),
    status: submissionStatusSchema.optional().describe('Filter by lifecycle status'),
    from: z.iso
      .datetime()
      .optional()
      .describe('Filter: submitted on or after this ISO 8601 timestamp'),
    to: z.iso
      .datetime()
      .optional()
      .describe('Filter: submitted on or before this ISO 8601 timestamp'),
  })
  .openapi('ExportSubmissionsRequest')

/**
 * TypeScript types inferred from the schemas.
 * @public
 */
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>
/** @public */
export type SubmissionFileMetadata = z.infer<typeof submissionFileMetadataSchema>
/** @public */
export type SubmissionMeta = z.infer<typeof submissionMetaSchema>
/** @public */
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>
/** @public */
export type SubmissionResponse = z.infer<typeof submissionResponseSchema>
/** @public */
export type SubmissionSummary = z.infer<typeof submissionSummarySchema>
/** @public */
export type ListSubmissionsResponse = z.infer<typeof listSubmissionsResponseSchema>
/** @public */
export type ExportSubmissionsRequest = z.infer<typeof exportSubmissionsRequestSchema>
