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
import { appliedQuerySchema, searchTermSchema } from '@/domain/models/api/_shared/search'
import { adminEnvelopeSchema } from '@/domain/models/api/admin/_shared/admin-envelope'

/**
 * Form submission list endpoint shapes.
 *
 * `GET /api/admin/forms/:formName/submissions` — cursor-paginated list of
 * submissions for a single top-level form (`app.forms[]` entry). Reuses the
 * shared `_admin` envelope (CC-1) and the shared cursor pagination contract.
 *
 * **Body redaction in lists** (D7 corollary): The `body` field is **never**
 * present on list-shaped responses, regardless of the
 * `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED` env var. Body reveal requires the
 * detail endpoint with explicit `?reveal=true` and admin role. The list
 * endpoint surfaces canonical metadata only — id, formName, submittedAt,
 * status, optional submitter labels under `_admin.metadata`.
 *
 * **Status enum**: matches the lifecycle states populated by the existing
 * top-level form submit pipeline (`form_submissions.status` column). Three
 * values cover the full surface: `received` (default — accepted by the
 * server), `processed` (post-success workflow ran to completion), `failed`
 * (post-success workflow errored or anti-spam rejected the submission).
 *
 * @see plan §4.7 (story #7)
 * @see [internal ref] D6/D7/D8
 */

/**
 * Canonical submission lifecycle status.
 *
 * Mirrors the public-domain `submissionStatusSchema` in
 * `src/domain/models/api/forms/submissions.ts` (see plan §6.5 — public schema
 * is canonical; admin extends, never duplicates).
 *
 * - `received`   — just created, dual-write in progress
 * - `processing` — bound table written, automation invocation pending
 * - `done`       — bound table + automation both succeeded
 * - `failed`     — ledger row preserved with `status_reason`; non-recoverable
 * - `spam`       — caught by honeypot or rate limiter; never reached automation/table
 */
export const formSubmissionStatusSchema = z
  .enum(['received', 'processing', 'done', 'failed', 'spam'])
  .describe('Form submission lifecycle status')

/**
 * Canonical form submission shape.
 *
 * `body` is OPTIONAL because the field is conditionally redacted: present
 * only on the detail endpoint when `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`
 * AND the caller passes `?reveal=true` AND has admin role. List shapes never
 * include `body`; detail without `?reveal=true` never includes `body`.
 */
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
        'Field values submitted by the form. Present ONLY when the detail endpoint is called with `?reveal=true` AND `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` AND the caller has admin role. Absent on list responses, on detail without reveal, on operator reveals, and when the env var is unset/false.'
      ),
  })
  .openapi('FormSubmission')

/**
 * Admin-envelope-extended submission item.
 *
 * Each list item carries the canonical `_admin` block. The optional
 * `metadata` slot under `_admin` is populated per-submission with
 * domain-specific extras: `ipAddress` (the recorded source IP), `userAgent`
 * (browser User-Agent header), and `sourceUrl` (Referer or page URL when
 * available). These are operator-grade observability fields — absent for
 * server-to-server submissions, present for browser-driven submissions.
 *
 * `recentAuditTrail` is OPTIONAL: present only when the detail endpoint is
 * called with `?audit=N` (D6 opt-in). The list endpoint never populates it.
 */
export const formSubmissionAdminItemSchema = formSubmissionSchema
  .extend({
    _admin: adminEnvelopeSchema
      .extend({
        recentAuditTrail: z
          .array(z.unknown())
          .max(50)
          .optional()
          .describe(
            'Up to N recent audit-log entries scoped to this submission resource. Present ONLY when the detail endpoint is called with `?audit=N` (max 50). Absent on list responses and on detail without the `?audit` query parameter.'
          ),
      })
      .describe('Operator-grade admin envelope for this submission'),
  })
  .openapi('FormSubmissionAdminItem')

/**
 * Query parameters for `GET /api/admin/forms/:formName/submissions`.
 *
 * Extends the shared cursor pagination contract with three filters:
 *
 * - `status` — optional lifecycle filter (e.g. `?status=failed` to triage
 *   anti-spam rejections only).
 * - `from` / `to` — ISO 8601 timestamps bounding `submitted_at`. Inclusive of
 *   `from`, exclusive of `to` (same convention as the audit-log list).
 * - `include_deleted` — opt-in toggle to surface soft-deleted submissions
 *   (default false). Locks D2 for forms.
 * - `q` — optional free-text search (see below).
 *
 * ## What `q` searches here, and the one thing it must never search
 *
 * A submissions inbox is triaged by PERSON: "find the submission Alice sent".
 * `q` therefore matches the SUBMITTER'S IDENTITY — the account `email` and
 * `name` behind `form_submissions.submitter_user_id` — plus the submission `id`
 * an operator pastes out of a support ticket or an audit-log `resource.id`.
 * Neither is a rendered column (the inbox grid shows Status and Received and
 * nothing else), which is precisely why the response echoes
 * {@link appliedQuerySchema}: a client re-filtering the visible cells would
 * throw away every row the server matched on the submitter.
 *
 * **`body` is NEVER searched.** This is the D7 redaction lock expressed as a
 * query contract, not a scoping preference. The body is withheld from every
 * list response and is revealed only by the detail endpoint under
 * `?reveal=true` AND `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` AND an admin
 * role — so an OPERATOR can list submissions they may not read. A `q` that
 * matched body content would turn this list into a confirm/deny oracle over
 * exactly that withheld content: a caller could recover a submitted password or
 * e-mail address one substring at a time, never once calling the endpoint that
 * gates it. Widening the haystack to `body` is therefore an [internal ref] D7 change,
 * not an implementation detail.
 *
 * Also excluded: `status` (it has `?status`), `submittedAt` (bounded by
 * `?from` / `?to`), `formName` (constant — the list is already scoped to one
 * form by the path), `submitter_ip_hash` (a hash; an operator typing a real IP
 * would get zero rows and conclude, wrongly, that nothing came from it), and
 * `user_agent` (a machine string where `Mozilla` matches nearly everything —
 * a search that answers "all" answers nothing).
 *
 * Honest limit, stated because it fails SOFT: an ANONYMOUS submission has no
 * `submitter_user_id`, so only its `id` is searchable. A term that is somebody's
 * e-mail address will not surface the anonymous rows that merely CONTAIN that
 * address in their (unsearched) body.
 *
 * @see ../../_shared/search.ts — the shared `?q=` / `appliedQuery` contract
 */
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
      'When true, include soft-deleted submissions (`deletedAt` non-null) in the response. Default false.'
    ),
  q: searchTermSchema.describe(
    'Optional free-text search over the SUBMITTER identity (the account `email` and `name` behind `submitter_user_id`) and the submission `id`, as a case-insensitive literal substring. Composes with `status` / `from` / `to` / the cursor (AND), so a page is a page of MATCHES. The submitted `body` is NEVER searched — the D7 redaction lock; searching it would make this list an oracle over content the caller may not be permitted to reveal. Empty / whitespace-only means "no search".'
  ),
})

/**
 * Response shape for `GET /api/admin/forms/:formName/submissions`.
 *
 * Cursor-paginated array of admin-envelope-extended submission items. The
 * `nextCursor` field is opaque base64; callers must not parse it.
 */
export const formsSubmissionsListResponseSchema = cursorPaginationResponseSchema(
  formSubmissionAdminItemSchema
)
  .extend({ appliedQuery: appliedQuerySchema })
  .openapi('FormsSubmissionsListResponse')

/** @public */
export type FormSubmissionStatus = z.infer<typeof formSubmissionStatusSchema>
/** @public */
export type FormSubmission = z.infer<typeof formSubmissionSchema>
/** @public */
export type FormSubmissionAdminItem = z.infer<typeof formSubmissionAdminItemSchema>
/** @public */
export type FormsSubmissionsListQuery = z.infer<typeof formsSubmissionsListQuerySchema>
/** @public */
export type FormsSubmissionsListResponse = z.infer<typeof formsSubmissionsListResponseSchema>
