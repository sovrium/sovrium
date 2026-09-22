/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { email, looseIsoDateTime } from '@/domain/models/api/combinators/formats'
import { transformed } from '@/domain/models/api/combinators/transform'
import { isIssuedAvatarUrl } from '@/domain/models/app/auth/avatar-url'
import { timestampSchema } from '../combinators/common'

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
export const accountExportProfileSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Unique user identifier' }),
    email: email({ description: 'User email address' }),
    name: Schema.NullOr(Schema.String.annotate({ description: 'User display name' })),
    image: transformed(Schema.NullOr(Schema.String), Schema.NullOr(Schema.String), (value) =>
      // `null` is this field's wire contract (`Schema.NullOr` above);
      // `undefined` would drop the key from the JSON export entirely.
      // eslint-disable-next-line unicorn/no-null
      isIssuedAvatarUrl(value) ? value : null
    ).annotate({ description: 'User avatar URL — a root-relative bucket object, or null' }),
    emailVerified: Schema.Boolean.annotate({
      description: 'Whether the email address is verified',
    }),
    role: Schema.Literals(['admin', 'member', 'viewer']).annotate({ description: 'User role' }),
    // The caller's own interface-language preference — an engine-owned column on
    // `auth.user`, declared through Better Auth's `user.additionalFields` rather
    // than as an app config option, so it exists for every auth-enabled app and
    // is hard-deleted with the subject's row.
    //
    // It belongs on the export because this section IS the caller's `auth.user`
    // row, and the access right covers the row rather than a chosen subset of
    // it. Note that the erasure/export coverage map is keyed by TABLE and
    // already reads `auth.user` as exported, so a new column cannot grow that
    // map — the reason to declare the field here is completeness, not the gate.
    //
    // REQUIRED and nullable, like `name` and `image` beside it. It was declared
    // optional while the column did not yet exist, so the published OpenAPI
    // document would not advertise a field the binary did not return; the column,
    // the `buildExportPayload` line and this tightening landed together, which is
    // what the three being one contract meant.
    language: Schema.NullOr(
      Schema.String.annotate({
        description:
          "The user's interface-language preference (a code or locale the app declares), or null",
      })
    ),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'AccountExportProfile' })

/**
 * Account export — session section
 *
 * One entry per `auth.session` row belonging to the caller. The session token
 * is deliberately omitted — it is a live credential, not export-relevant data.
 */
export const accountExportSessionSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Session identifier' }),
    userId: Schema.String.annotate({ description: 'User ID this session belongs to' }),
    expiresAt: looseIsoDateTime({ description: 'ISO 8601 session expiration timestamp' }),
    ipAddress: Schema.NullOr(
      Schema.String.annotate({ description: 'IP address the session was created from' })
    ),
    userAgent: Schema.NullOr(
      Schema.String.annotate({ description: 'User agent string of the session client' })
    ),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'AccountExportSession' })

/**
 * Account export — linked-account section
 *
 * One entry per `auth.account` row (OAuth providers and the email/password
 * credential record). Secret material (`password`, `accessToken`,
 * `refreshToken`, `idToken`) is deliberately OMITTED — exporting credentials is
 * a security risk and is not required by GDPR Art. 15.
 */
export const accountExportLinkedAccountSchema = Schema.Struct({
  ...Schema.Struct({
    id: Schema.String.annotate({ description: 'Linked account identifier' }),
    userId: Schema.String.annotate({ description: 'User ID this linked account belongs to' }),
    providerId: Schema.String.annotate({
      description: 'Authentication provider identifier (e.g. "credential", "google")',
    }),
    accountId: Schema.String.annotate({ description: 'Provider-scoped account identifier' }),
    scope: Schema.NullOr(
      Schema.String.annotate({ description: 'OAuth scopes granted, if applicable' })
    ),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'AccountExportLinkedAccount' })

/**
 * Account export — authored-record section
 *
 * One entry per table record across the app where `created_by` equals the
 * caller. Satisfies the GDPR Art. 20 portability requirement for
 * user-generated content.
 */
export const accountExportRecordSchema = Schema.Struct({
  ...Schema.Struct({
    tableSlug: Schema.String.annotate({ description: 'Slug of the table the record belongs to' }),
    recordId: Schema.String.annotate({ description: 'Record identifier' }),
    fields: Schema.Record(Schema.String, Schema.Unknown).annotate({
      description: 'Record field values keyed by field name',
    }),
  }).fields,
  ...timestampSchema.fields,
}).annotate({ identifier: 'AccountExportRecord' })

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
 * digest of one. That digest is stable — the salt is derived from the install's
 * root secret, so the same address hashes identically across restarts — but it
 * remains an opaque, install-scoped correlation token: the salt never leaves
 * the install, so the value is meaningless anywhere else and cannot be reversed
 * to an address. It is therefore neither intelligible under Art. 15 nor portable
 * under Art. 20. Where an IP IS retained in clear, the
 * export already surfaces it (`sessions[].ipAddress`).
 */
export const accountExportFormSubmissionSchema = Schema.Struct({
  submissionId: Schema.String.annotate({ description: 'Ledger row identifier of the submission' }),
  formName: Schema.NullOr(
    Schema.String.annotate({
      description:
        'Name of the submitted form — nullable because the ledger also stores share-link submissions, which carry no form name',
    })
  ),
  status: Schema.NullOr(
    Schema.String.annotate({ description: 'Lifecycle status of the submission (e.g. "received")' })
  ),
  data: Schema.Record(Schema.String, Schema.Unknown).annotate({
    description: 'The values the caller actually submitted, keyed by field name',
  }),
  userAgent: Schema.NullOr(
    Schema.String.annotate({
      description: 'User agent string the submission was sent with, when recorded',
    })
  ),
  submittedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the submission was received' }),
}).annotate({ identifier: 'AccountExportFormSubmission' })

/**
 * Account export response schema
 *
 * The complete personal-data footprint of the authenticated caller, returned by
 * `GET /api/account/export`. A single machine-readable JSON document covering
 * GDPR Art. 15 (right of access) and Art. 20 (right to data portability).
 */
export const accountExportResponseSchema = Schema.Struct({
  exportedAt: looseIsoDateTime({ description: 'ISO 8601 timestamp the export was generated' }),
  format: Schema.Literal('json').annotate({
    description: 'Export payload format (future-proofs other formats)',
  }),
  schemaVersion: Schema.Literal('1.0').annotate({ description: 'Export payload contract version' }),
  profile: accountExportProfileSchema.annotate({
    description: "The caller's profile (auth.user row)",
  }),
  sessions: Schema.Array(accountExportSessionSchema).annotate({
    description: "The caller's authentication sessions",
  }),
  accounts: Schema.Array(accountExportLinkedAccountSchema).annotate({
    description: "The caller's linked accounts, with all secret material omitted",
  }),
  authoredRecords: Schema.Array(accountExportRecordSchema).annotate({
    description: 'Every table record the caller authored (created_by = caller)',
  }),
  formSubmissions: Schema.Array(accountExportFormSubmissionSchema).annotate({
    description: 'Every form submission the caller made (submitter_user_id = caller)',
  }),
}).annotate({ identifier: 'AccountExportResponse' })

// ============================================================================
// Account Deletion Schemas
// ============================================================================

/**
 * Account delete — confirm request shape
 *
 * `{ confirm: true }` schedules the account for erasure. The literal-`true`
 * requirement is an explicit anti-fat-finger confirmation.
 */
export const accountDeleteConfirmRequestSchema = Schema.Struct({
  confirm: Schema.Literal(true).annotate({
    description: 'Explicit confirmation that the account should be scheduled for erasure',
  }),
}).annotate({ identifier: 'AccountDeleteConfirmRequest' })

/**
 * Account delete — cancel request shape
 *
 * `{ cancel: true }` cancels a pending erasure during the grace window.
 */
export const accountDeleteCancelRequestSchema = Schema.Struct({
  cancel: Schema.Literal(true).annotate({
    description: 'Explicit request to cancel a pending account erasure',
  }),
}).annotate({ identifier: 'AccountDeleteCancelRequest' })

/**
 * Account delete request schema
 *
 * Body of `POST /api/account/delete`. A discriminated union — exactly one of a
 * confirm-shape or a cancel-shape. A body matching neither is rejected `400`.
 */
export const accountDeleteRequestSchema = Schema.Union([
  accountDeleteConfirmRequestSchema,
  accountDeleteCancelRequestSchema,
]).annotate({ identifier: 'AccountDeleteRequest' })

/**
 * Account delete — scheduled response shape
 *
 * Returned `202 Accepted` when `{ confirm: true }` schedules an erasure.
 */
export const accountDeleteScheduledResponseSchema = Schema.Struct({
  status: Schema.Literal('scheduled').annotate({ description: 'Erasure has been scheduled' }),
  scheduledErasureAt: looseIsoDateTime({
    description: 'ISO 8601 timestamp the account will be hard-deleted (now + grace period)',
  }),
  gracePeriodDays: Schema.Literal(7).annotate({
    description: 'Number of days the erasure can still be cancelled',
  }),
  cancellable: Schema.Literal(true).annotate({
    description: 'Whether the scheduled erasure can still be cancelled',
  }),
}).annotate({ identifier: 'AccountDeleteScheduledResponse' })

/**
 * Account delete — cancelled response shape
 *
 * Returned `200 OK` when `{ cancel: true }` clears a pending erasure.
 */
export const accountDeleteCancelledResponseSchema = Schema.Struct({
  status: Schema.Literal('cancelled').annotate({
    description: 'A pending erasure has been cancelled',
  }),
}).annotate({ identifier: 'AccountDeleteCancelledResponse' })

/**
 * Account delete response schema
 *
 * Response of `POST /api/account/delete` — a union of the scheduled (`202`) and
 * cancelled (`200`) response shapes.
 */
export const accountDeleteResponseSchema = Schema.Union([
  accountDeleteScheduledResponseSchema,
  accountDeleteCancelledResponseSchema,
]).annotate({ identifier: 'AccountDeleteResponse' })

// ============================================================================
// Pending-Erasure Read Schemas
// ============================================================================

/**
 * Pending-erasure — one item
 *
 * The caller's OWN scheduled erasure, surfaced by `GET
 * /api/account/pending-erasure`. There is exactly one item while an erasure is
 * scheduled (`scheduledErasureAt` is set on the `auth.user` row), and the
 * collection is empty otherwise. The shape is a rows envelope so a `table`
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
export const accountPendingErasureItemSchema = Schema.Struct({
  id: Schema.String.annotate({
    description:
      "The caller's user id — a stable row id so a table system binding (idKey) and refetch can key off it",
  }),
  email: email({
    description:
      "The caller's OWN email address — session-bound (not a PII leak), so the pending-erasure table can render whose account is scheduled for erasure",
  }),
  scheduledErasureAt: looseIsoDateTime({
    description:
      'ISO 8601 — when the account will be hard-deleted (end of the grace window); the date a relative-time column renders as "dans N j"',
  }),
  requestedAt: looseIsoDateTime({
    description: 'ISO 8601 — when the erasure was requested (scheduledErasureAt − gracePeriodDays)',
  }),
  gracePeriodDays: Schema.Literal(7).annotate({
    description: 'Number of days the erasure can still be cancelled before it is purged',
  }),
}).annotate({ identifier: 'AccountPendingErasureItem' })

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
export const accountPendingErasureResponseSchema = Schema.Struct({
  items: Schema.Array(accountPendingErasureItemSchema).annotate({
    description:
      "The caller's OWN pending erasure — exactly one item while scheduled, empty once cancelled or never requested",
  }),
}).annotate({ identifier: 'AccountPendingErasureResponse' })

// ============================================================================
// TypeScript Types
// ============================================================================

export type AccountExportProfile = typeof accountExportProfileSchema.Type
export type AccountExportSession = typeof accountExportSessionSchema.Type
export type AccountExportLinkedAccount = typeof accountExportLinkedAccountSchema.Type
export type AccountExportRecord = typeof accountExportRecordSchema.Type
export type AccountExportFormSubmission = typeof accountExportFormSubmissionSchema.Type
export type AccountExportResponse = typeof accountExportResponseSchema.Type
export type AccountDeleteConfirmRequest = typeof accountDeleteConfirmRequestSchema.Type
export type AccountDeleteCancelRequest = typeof accountDeleteCancelRequestSchema.Type
export type AccountDeleteRequest = typeof accountDeleteRequestSchema.Type
export type AccountDeleteScheduledResponse = typeof accountDeleteScheduledResponseSchema.Type
export type AccountDeleteCancelledResponse = typeof accountDeleteCancelledResponseSchema.Type
export type AccountDeleteResponse = typeof accountDeleteResponseSchema.Type
export type AccountPendingErasureItem = typeof accountPendingErasureItemSchema.Type
export type AccountPendingErasureResponse = typeof accountPendingErasureResponseSchema.Type
