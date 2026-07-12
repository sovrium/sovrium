/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { timestampSchema } from '../_shared/common'



export const accountExportProfileSchema = z
  .object({
    id: z.string().describe('Unique user identifier'),
    email: z.email().describe('User email address'),
    name: z.string().nullable().describe('User display name'),
    image: z.url().nullable().describe('User avatar URL'),
    emailVerified: z.boolean().describe('Whether the email address is verified'),
    role: z.enum(['admin', 'member', 'viewer']).describe('User role'),
  })
  .extend(timestampSchema.shape)
  .openapi('AccountExportProfile')

export const accountExportSessionSchema = z
  .object({
    id: z.string().describe('Session identifier'),
    userId: z.string().describe('User ID this session belongs to'),
    expiresAt: z.iso.datetime().describe('ISO 8601 session expiration timestamp'),
    ipAddress: z.string().nullable().describe('IP address the session was created from'),
    userAgent: z.string().nullable().describe('User agent string of the session client'),
  })
  .extend(timestampSchema.shape)
  .openapi('AccountExportSession')

export const accountExportLinkedAccountSchema = z
  .object({
    id: z.string().describe('Linked account identifier'),
    userId: z.string().describe('User ID this linked account belongs to'),
    providerId: z
      .string()
      .describe('Authentication provider identifier (e.g. "credential", "google")'),
    accountId: z.string().describe('Provider-scoped account identifier'),
    scope: z.string().nullable().describe('OAuth scopes granted, if applicable'),
  })
  .extend(timestampSchema.shape)
  .openapi('AccountExportLinkedAccount')

export const accountExportRecordSchema = z
  .object({
    tableSlug: z.string().describe('Slug of the table the record belongs to'),
    recordId: z.string().describe('Record identifier'),
    fields: z.record(z.string(), z.unknown()).describe('Record field values keyed by field name'),
  })
  .extend(timestampSchema.shape)
  .openapi('AccountExportRecord')

export const accountExportResponseSchema = z
  .object({
    exportedAt: z.iso.datetime().describe('ISO 8601 timestamp the export was generated'),
    format: z.literal('json').describe('Export payload format (future-proofs other formats)'),
    schemaVersion: z.literal('1.0').describe('Export payload contract version'),
    profile: accountExportProfileSchema.describe("The caller's profile (auth.user row)"),
    sessions: z.array(accountExportSessionSchema).describe("The caller's authentication sessions"),
    accounts: z
      .array(accountExportLinkedAccountSchema)
      .describe("The caller's linked accounts, with all secret material omitted"),
    authoredRecords: z
      .array(accountExportRecordSchema)
      .describe('Every table record the caller authored (created_by = caller)'),
  })
  .openapi('AccountExportResponse')


export const accountDeleteConfirmRequestSchema = z
  .object({
    confirm: z
      .literal(true)
      .describe('Explicit confirmation that the account should be scheduled for erasure'),
  })
  .openapi('AccountDeleteConfirmRequest')

export const accountDeleteCancelRequestSchema = z
  .object({
    cancel: z.literal(true).describe('Explicit request to cancel a pending account erasure'),
  })
  .openapi('AccountDeleteCancelRequest')

export const accountDeleteRequestSchema = z
  .union([accountDeleteConfirmRequestSchema, accountDeleteCancelRequestSchema])
  .openapi('AccountDeleteRequest')

export const accountDeleteScheduledResponseSchema = z
  .object({
    status: z.literal('scheduled').describe('Erasure has been scheduled'),
    scheduledErasureAt: z.iso
      .datetime()
      .describe('ISO 8601 timestamp the account will be hard-deleted (now + grace period)'),
    gracePeriodDays: z.literal(7).describe('Number of days the erasure can still be cancelled'),
    cancellable: z.literal(true).describe('Whether the scheduled erasure can still be cancelled'),
  })
  .openapi('AccountDeleteScheduledResponse')

export const accountDeleteCancelledResponseSchema = z
  .object({
    status: z.literal('cancelled').describe('A pending erasure has been cancelled'),
  })
  .openapi('AccountDeleteCancelledResponse')

export const accountDeleteResponseSchema = z
  .union([accountDeleteScheduledResponseSchema, accountDeleteCancelledResponseSchema])
  .openapi('AccountDeleteResponse')


export const accountPendingErasureItemSchema = z
  .object({
    id: z
      .string()
      .describe(
        "The caller's user id — a stable row id so a data-table system binding (idKey) and refetch can key off it"
      ),
    email: z
      .email()
      .describe(
        "The caller's OWN email address — session-bound (not a PII leak), so the pending-erasure table can render whose account is scheduled for erasure"
      ),
    scheduledErasureAt: z.iso
      .datetime()
      .describe(
        'ISO 8601 — when the account will be hard-deleted (end of the grace window); the date a relative-time column renders as "dans N j"'
      ),
    requestedAt: z.iso
      .datetime()
      .describe('ISO 8601 — when the erasure was requested (scheduledErasureAt − gracePeriodDays)'),
    gracePeriodDays: z
      .literal(7)
      .describe('Number of days the erasure can still be cancelled before it is purged'),
  })
  .openapi('AccountPendingErasureItem')

export const accountPendingErasureResponseSchema = z
  .object({
    items: z
      .array(accountPendingErasureItemSchema)
      .describe(
        "The caller's OWN pending erasure — exactly one item while scheduled, empty once cancelled or never requested"
      ),
  })
  .openapi('AccountPendingErasureResponse')


export type AccountExportProfile = z.infer<typeof accountExportProfileSchema>
export type AccountExportSession = z.infer<typeof accountExportSessionSchema>
export type AccountExportLinkedAccount = z.infer<typeof accountExportLinkedAccountSchema>
export type AccountExportRecord = z.infer<typeof accountExportRecordSchema>
export type AccountExportResponse = z.infer<typeof accountExportResponseSchema>
export type AccountDeleteConfirmRequest = z.infer<typeof accountDeleteConfirmRequestSchema>
export type AccountDeleteCancelRequest = z.infer<typeof accountDeleteCancelRequestSchema>
export type AccountDeleteRequest = z.infer<typeof accountDeleteRequestSchema>
export type AccountDeleteScheduledResponse = z.infer<typeof accountDeleteScheduledResponseSchema>
export type AccountDeleteCancelledResponse = z.infer<typeof accountDeleteCancelledResponseSchema>
export type AccountDeleteResponse = z.infer<typeof accountDeleteResponseSchema>
export type AccountPendingErasureItem = z.infer<typeof accountPendingErasureItemSchema>
export type AccountPendingErasureResponse = z.infer<typeof accountPendingErasureResponseSchema>
