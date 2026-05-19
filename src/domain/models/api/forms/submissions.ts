/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { paginationSchema } from '../_shared/common'
import { formNameSchema } from './forms'

export const submissionStatusSchema = z
  .enum(['received', 'processing', 'done', 'failed', 'spam'])
  .describe('Submission lifecycle state')

export const submissionFileMetadataSchema = z
  .object({
    url: z.string().describe('Storage URL (signed when bucket is private)'),
    name: z.string().describe('Original filename'),
    size: z.number().int().min(0).describe('File size in bytes'),
    mimeType: z.string().describe('MIME type of the uploaded file'),
  })
  .openapi('SubmissionFileMetadata')

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

export const createSubmissionRequestSchema = z
  .object({
    data: z.record(z.string(), z.unknown()).describe('Submitted field values keyed by field name'),
    captchaToken: z
      .string()
      .optional()
      .describe('CAPTCHA verification token (Phase 3 — required when antiSpam.captcha is set)'),
  })
  .openapi('CreateSubmissionRequest')

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

export const submissionSummarySchema = z
  .object({
    id: z.uuid(),
    formName: formNameSchema,
    status: submissionStatusSchema,
    submittedAt: z.iso.datetime(),
    submitterUserId: z.string().nullable(),
  })
  .openapi('SubmissionSummary')

export const listSubmissionsResponseSchema = z
  .object({
    items: z.array(submissionSummarySchema),
    pagination: paginationSchema,
  })
  .openapi('ListSubmissionsResponse')

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

export type SubmissionStatus = z.infer<typeof submissionStatusSchema>
export type SubmissionFileMetadata = z.infer<typeof submissionFileMetadataSchema>
export type SubmissionMeta = z.infer<typeof submissionMetaSchema>
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>
export type SubmissionResponse = z.infer<typeof submissionResponseSchema>
export type SubmissionSummary = z.infer<typeof submissionSummarySchema>
export type ListSubmissionsResponse = z.infer<typeof listSubmissionsResponseSchema>
export type ExportSubmissionsRequest = z.infer<typeof exportSubmissionsRequestSchema>
