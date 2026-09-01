/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from '@hono/zod-openapi'
import { isIssuedAvatarUrl } from '@/domain/utils/avatar-url'
import { timestampSchema } from '../_shared/common'

/**
 * Account self-service & GDPR API schemas
 *
 * Zod schemas for the authenticated account endpoints:
 * - `GET  /api/account/export` — GDPR Art. 15 (access) + Art. 20 (portability)
 * - `POST /api/account/delete` — GDPR Art. 17 (erasure)
 *
 * Both endpoints operate only on the authenticated caller. There is no
 * client-supplied user id, so cross-account access is impossible by
 * construction (anti-enumeration).
 */

// ============================================================================
// Account Export Schemas
// ============================================================================

/**
 * Account export — profile section
 *
 * The caller's `auth.user` row. Secret material is never present on this row.
 */
export const accountExportProfileSchema = z
  .object({
    id: z.string().describe('Unique user identifier'),
    email: z.email().describe('User email address'),
    name: z.string().nullable().describe('User display name'),
    // NOT `z.url()`. An avatar is a root-relative bucket object
    // (`/api/buckets/{bucket}/files/{key}`), which `z.url()` rejects — and this
    // schema is `.parse`d, not `safeParse`d, so that rejection THREW and made
    // the caller's own Art. 15 export 500. `z.url()` was also never a guard in
    // the other direction: it happily admits `javascript:alert(1)`.
    //
    // The transform additionally neutralises values stored BEFORE the write
    // guard existed. Any legacy row can still hold an arbitrary string, and
    // this endpoint is the caller's own data view, so the safe reading of an
    // unrecognised value is "no avatar" rather than echoing an attacker-chosen
    // URL back out of the API for some client to render.
    image: z
      .string()
      .nullable()
      // eslint-disable-next-line unicorn/no-null -- `null` is this field's wire contract (`.nullable()` above); `undefined` would drop the key from the JSON export entirely.
      .transform((value) => (isIssuedAvatarUrl(value) ? value : null))
      .describe('User avatar URL — a root-relative bucket object, or null'),
    emailVerified: z.boolean().describe('Whether the email address is verified'),
    role: z.enum(['admin', 'member', 'viewer']).describe('User role'),
  })
  .extend(timestampSchema.shape)
  .openapi('AccountExportProfile')

/**
 * Account export — session section
 *
 * One entry per `auth.session` row belonging to the caller. The session token
 * is deliberately omitted — it is a live credential, not export-relevant data.
 */
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

/**
 * Account export — linked-account section
 *
 * One entry per `auth.account` row (OAuth providers and the email/password
 * credential record). Secret material (`password`, `accessToken`,
 * `refreshToken`, `idToken`) is deliberately OMITTED — exporting credentials is
 * a security risk and is not required by GDPR Art. 15.
 */
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

/**
 * Account export — authored-record section
 *
 * One entry per table record across the app where `created_by` equals the
 * caller. Satisfies the GDPR Art. 20 portability requirement for
 * user-generated content.
 */
export const accountExportRecordSchema = z
  .object({
    tableSlug: z.string().describe('Slug of the table the record belongs to'),
    recordId: z.string().describe('Record identifier'),
    fields: z.record(z.string(), z.unknown()).describe('Record field values keyed by field name'),
  })
  .extend(timestampSchema.shape)
  .openapi('AccountExportRecord')

/**
 * Account export — form-submission section
 *
 * One entry per `system.form_submissions` row whose `submitter_user_id` equals
 * the caller. Submissions made anonymously (no `submitter_user_id`) belong to
 * nobody and are never attributed to an exporting user.
 *
 * `submitter_ip_hash` is deliberately OMITTED. Sovrium never holds the
 * submitter's IP: it is hashed at the route boundary and the raw address never
 * reaches the application layer, so there is no address to disclose — only a
 * digest of one. That digest is also unstable (with `FORM_IP_HASH_SALT` unset
 * the salt is a process-lifetime random value, so the same address hashes
 * differently after a restart), which makes it neither intelligible under
 * Art. 15 nor portable under Art. 20. Where an IP IS retained in clear, the
 * export already surfaces it (`sessions[].ipAddress`).
 */
export const accountExportFormSubmissionSchema = z
  .object({
    submissionId: z.string().describe('Ledger row identifier of the submission'),
    formName: z
      .string()
      .nullable()
      .describe(
        'Name of the submitted form — nullable because the ledger also stores share-link submissions, which carry no form name'
      ),
    status: z.string().nullable().describe('Lifecycle status of the submission (e.g. "received")'),
    data: z
      .record(z.string(), z.unknown())
      .describe('The values the caller actually submitted, keyed by field name'),
    userAgent: z
      .string()
      .nullable()
      .describe('User agent string the submission was sent with, when recorded'),
    submittedAt: z.iso.datetime().describe('ISO 8601 timestamp the submission was received'),
  })
  .openapi('AccountExportFormSubmission')

/**
 * Account export response schema
 *
 * The complete personal-data footprint of the authenticated caller, returned by
 * `GET /api/account/export`. A single machine-readable JSON document covering
 * GDPR Art. 15 (right of access) and Art. 20 (right to data portability).
 */
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
    formSubmissions: z
      .array(accountExportFormSubmissionSchema)
      .describe('Every form submission the caller made (submitter_user_id = caller)'),
  })
  .openapi('AccountExportResponse')

// ============================================================================
// Account Deletion Schemas
// ============================================================================

/**
 * Account delete — confirm request shape
 *
 * `{ confirm: true }` schedules the account for erasure. The literal-`true`
 * requirement is an explicit anti-fat-finger confirmation.
 */
export const accountDeleteConfirmRequestSchema = z
  .object({
    confirm: z
      .literal(true)
      .describe('Explicit confirmation that the account should be scheduled for erasure'),
  })
  .openapi('AccountDeleteConfirmRequest')

/**
 * Account delete — cancel request shape
 *
 * `{ cancel: true }` cancels a pending erasure during the grace window.
 */
export const accountDeleteCancelRequestSchema = z
  .object({
    cancel: z.literal(true).describe('Explicit request to cancel a pending account erasure'),
  })
  .openapi('AccountDeleteCancelRequest')

/**
 * Account delete request schema
 *
 * Body of `POST /api/account/delete`. A discriminated union — exactly one of a
 * confirm-shape or a cancel-shape. A body matching neither is rejected `400`.
 */
export const accountDeleteRequestSchema = z
  .union([accountDeleteConfirmRequestSchema, accountDeleteCancelRequestSchema])
  .openapi('AccountDeleteRequest')

/**
 * Account delete — scheduled response shape
 *
 * Returned `202 Accepted` when `{ confirm: true }` schedules an erasure.
 */
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

/**
 * Account delete — cancelled response shape
 *
 * Returned `200 OK` when `{ cancel: true }` clears a pending erasure.
 */
export const accountDeleteCancelledResponseSchema = z
  .object({
    status: z.literal('cancelled').describe('A pending erasure has been cancelled'),
  })
  .openapi('AccountDeleteCancelledResponse')

/**
 * Account delete response schema
 *
 * Response of `POST /api/account/delete` — a union of the scheduled (`202`) and
 * cancelled (`200`) response shapes.
 */
export const accountDeleteResponseSchema = z
  .union([accountDeleteScheduledResponseSchema, accountDeleteCancelledResponseSchema])
  .openapi('AccountDeleteResponse')

// ============================================================================
// Pending-Erasure Read Schemas
// ============================================================================

/**
 * Pending-erasure — one item
 *
 * The caller's OWN scheduled erasure, surfaced by `GET
 * /api/account/pending-erasure`. There is exactly one item while an erasure is
 * scheduled (`scheduledErasureAt` is set on the `auth.user` row), and the
 * collection is empty otherwise. The shape is a rows envelope so a `data-table`
 * can bind to it via `dataSource.system` and re-query it on `onSuccess.refetch`
 * (the GDPR pending-erasure list the consoles-as-config conversion needs).
 *
 * `requestedAt` is DERIVED, not stored: scheduling always sets
 * `scheduledErasureAt = requestedAt + gracePeriodDays`, so the request moment is
 * recovered as `scheduledErasureAt − gracePeriodDays` (the `auth.user` table
 * carries no separate request-timestamp column).
 *
 * `email` is the caller's OWN address. The pending erasure is always the
 * requester's own account (the read is session-bound — there is no client-supplied
 * id), so surfacing it is not a PII leak; it lets the GDPR pending-erasure
 * data-table bind a `{ field: 'email' }` column that names whose account is on its
 * way out.
 */
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

/**
 * Pending-erasure response schema
 *
 * Body of `GET /api/account/pending-erasure` — the caller's OWN pending erasure
 * as a `{ items }` rows envelope. Exactly one item while an erasure is scheduled;
 * an empty `items` array once it is cancelled (or was never scheduled). The
 * endpoint is session-bound (no client-supplied id → no enumeration surface);
 * an unauthenticated request is rejected `401` (the same `unauthorized` envelope
 * as the sibling export/delete handlers), never leaking another caller's state.
 */
export const accountPendingErasureResponseSchema = z
  .object({
    items: z
      .array(accountPendingErasureItemSchema)
      .describe(
        "The caller's OWN pending erasure — exactly one item while scheduled, empty once cancelled or never requested"
      ),
  })
  .openapi('AccountPendingErasureResponse')

// ============================================================================
// TypeScript Types
// ============================================================================

export type AccountExportProfile = z.infer<typeof accountExportProfileSchema>
export type AccountExportSession = z.infer<typeof accountExportSessionSchema>
export type AccountExportLinkedAccount = z.infer<typeof accountExportLinkedAccountSchema>
export type AccountExportRecord = z.infer<typeof accountExportRecordSchema>
export type AccountExportFormSubmission = z.infer<typeof accountExportFormSubmissionSchema>
export type AccountExportResponse = z.infer<typeof accountExportResponseSchema>
export type AccountDeleteConfirmRequest = z.infer<typeof accountDeleteConfirmRequestSchema>
export type AccountDeleteCancelRequest = z.infer<typeof accountDeleteCancelRequestSchema>
export type AccountDeleteRequest = z.infer<typeof accountDeleteRequestSchema>
export type AccountDeleteScheduledResponse = z.infer<typeof accountDeleteScheduledResponseSchema>
export type AccountDeleteCancelledResponse = z.infer<typeof accountDeleteCancelledResponseSchema>
export type AccountDeleteResponse = z.infer<typeof accountDeleteResponseSchema>
export type AccountPendingErasureItem = z.infer<typeof accountPendingErasureItemSchema>
export type AccountPendingErasureResponse = z.infer<typeof accountPendingErasureResponseSchema>
