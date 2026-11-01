/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { booleanFlag, coercedBoolean } from '@/domain/kernel/config-parsing/coerce'
import { looseIsoDateTime, uuid } from '@/domain/kernel/config-parsing/formats'
import { optionalField } from '@/domain/kernel/config-parsing/optional-field'
import { adminEnvelopeSchema } from '@/domain/models/api/admin/envelope/admin-envelope'
import {
  cursorPaginationQuerySchema,
  cursorPaginationResponseSchema,
} from '@/domain/models/api/cursor-pagination'
import { appliedQuerySchema, searchTermSchema } from '@/domain/models/api/search-term'
import { withDefault } from '../../schema-defaults'

/**
 * Form submission list endpoint shapes.
 *
 * `GET /api/admin/forms/:formName/submissions` — cursor-paginated list of
 * submissions for a single top-level form (`app.forms[]` entry). Reuses the
 * shared `_admin` envelope (CC-1) and the shared cursor pagination contract.
 *
 * **Bodies in lists — the detail's gate, read once per page.** A list item
 * carries `body` only when the caller passes `?reveal=true`, the instance sets
 * `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` AND the caller's account role is
 * admin-equivalent — exactly the three conditions the detail endpoint applies.
 * A revealed page writes ONE critical `form.submission.bodies.revealed` audit
 * event naming the form, not one per row. A caller who fails the gate is not
 * refused: the page answers as if no reveal was asked, `bodiesRevealed: false`,
 * so a read-only tier listing the inbox learns nothing it could not already see.
 * Without `?reveal=true` the list carries canonical metadata only — id,
 * formName, submittedAt, status, optional submitter labels under
 * `_admin.metadata`.
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
export const formSubmissionStatusSchema = Schema.Literals([
  'received',
  'processing',
  'done',
  'failed',
  'spam',
]).annotate({ description: 'Form submission lifecycle status' })

/**
 * Canonical form submission shape.
 *
 * `body` is OPTIONAL because the field is conditionally redacted: present
 * only when `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` AND the caller passes
 * `?reveal=true` AND has an admin role, on the detail and the list alike. A
 * request without `?reveal=true` never includes `body`.
 */
export const formSubmissionSchema = Schema.Struct({
  id: uuid({ description: 'Stable submission identifier (UUID)' }),
  formName: Schema.String.annotate({
    description:
      'Slug of the parent form (lowercase, kebab-case). Matches the `name` field of the `app.forms[]` entry that received this submission.',
  }).pipe(Schema.check(Schema.isPattern(/^[a-z0-9-]+$/))),
  submittedAt: looseIsoDateTime({
    description:
      'ISO 8601 UTC timestamp recorded when the public submit endpoint accepted the form',
  }),
  status: formSubmissionStatusSchema,
  body: optionalField(
    Schema.Record(Schema.String, Schema.Unknown).annotate({
      description:
        'Field values submitted by the form, keyed by field name. Present ONLY when the request passes `?reveal=true` AND `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` AND the caller has an admin role, on the detail endpoint and on the list alike. Absent without reveal, for any non-admin caller, and when the env var is unset/false.',
    })
  ),
}).annotate({ identifier: 'FormSubmission' })

/**
 * The record a submission wrote into its form's `submitTo` table.
 *
 * Two flat strings rather than a link: the console composes the address
 * (`/records/<table>?record=<id>`) itself, under its own mount.
 *
 * @public
 */
export const submissionLinkedRecordSchema = Schema.Struct({
  table: Schema.String.annotate({
    description: 'The `submitTo` table the submission wrote into, by its declared `name`.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  id: Schema.String.annotate({
    description: 'The id of the record it created there.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({ identifier: 'SubmissionLinkedRecord' })

/**
 * One automation run a submission started: the runs of a `form` trigger
 * naming this form and carrying this submission, and the runs a record
 * trigger on the `submitTo` table started for the record this submission
 * created. Never another submission's runs.
 *
 * @public
 */
export const submissionRunSchema = Schema.Struct({
  id: Schema.String.annotate({
    description: 'The run id, as `GET /api/admin/automations/runs/:id` reads it.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  automation: Schema.String.annotate({
    description: 'The automation that ran, by its declared `name`.',
  }).pipe(Schema.check(Schema.isMinLength(1))),
  status: Schema.String.annotate({
    description:
      'The run status as the runs list reports it (`success`, `failed`, `running`, `waiting`, and so on).',
  }).pipe(Schema.check(Schema.isMinLength(1))),
}).annotate({ identifier: 'SubmissionRun' })

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
export const formSubmissionAdminItemSchema = Schema.Struct({
  ...formSubmissionSchema.fields,
  _admin: Schema.Struct({
    ...adminEnvelopeSchema.fields,
    submitter: optionalField(
      Schema.String.annotate({
        description:
          "Who sent the submission, as a person reads it: the signed-in account's name, else its email; the guest email for a guest submission that left one. ABSENT for an anonymous submission. Never an address, a hash or a user agent (S4).",
        examples: ['Alice Mercier', 'guest@example.com'],
      }).pipe(Schema.check(Schema.isMinLength(1)))
    ),
    linkedRecord: optionalField(
      Schema.NullOr(submissionLinkedRecordSchema).annotate({
        description:
          'The record this submission created in its `submitTo` table, or null when it created none (no `submitTo`, a failed write, a spam submission). Read from the submission ledger, not searched for.',
      })
    ),
    runCount: optionalField(
      Schema.Int.annotate({
        description:
          'How many automation runs this submission started, the runs `_admin.runs` lists on the detail. Counted for a whole page in ONE grouped lookup, never one query per row.',
      }).pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))
    ),
    answersPreview: optionalField(
      Schema.String.annotate({
        description:
          'The first three answer-carrying fields of the form, in declaration order, as "Label: value · Label: value · Label: value", each label the field label the form declares, each value cut to 40 characters with "…". Under the SAME gate as `body`: the values are present only on a page whose `bodiesRevealed` is true, and every value reads "•••" otherwise, so a masked preview carries the form labels and none of what was submitted. Absent when the form has no answer-carrying field.',
        examples: [
          'Your name: Inès Garnier · Work email: ines.garnier@example.com · Message: Do you offer a non-profit disc…',
          'Your name: ••• · Work email: ••• · Message: •••',
        ],
      }).pipe(Schema.check(Schema.isMinLength(1)))
    ),
    runs: optionalField(
      Schema.Array(submissionRunSchema).annotate({
        description:
          'The automation runs this submission started, newest first: the runs of a `form` trigger on this form for this submission, and the runs a record trigger on the `submitTo` table started for `linkedRecord`. Present on the DETAIL endpoint only; the list carries `runCount`. Empty when it started none.',
      })
    ),
    recentAuditTrail: optionalField(
      Schema.Array(Schema.Unknown)
        .annotate({
          description:
            'Up to N recent audit-log entries scoped to this submission resource. Present ONLY when the detail endpoint is called with `?audit=N` (max 50). Absent on list responses and on detail without the `?audit` query parameter.',
        })
        .pipe(Schema.check(Schema.isMaxLength(50)))
    ),
  }).annotate({
    title:
      'sovrium:extends=AdminEnvelope|own=submitter,linkedRecord,runCount,answersPreview,runs,recentAuditTrail',
    description: 'Operator-grade admin envelope for this submission',
  }),
}).annotate({
  title: 'sovrium:extends=FormSubmission|own=_admin',
  identifier: 'FormSubmissionAdminItem',
})

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
 * query contract, not a scoping preference. The body is withheld unless the
 * request passes `?reveal=true` AND the instance sets
 * `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` AND the caller has an admin role —
 * so an OPERATOR can list submissions they may not read. A `q` that
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
 * @see ../../combinators/search.ts — the shared `?q=` / `appliedQuery` contract
 */
export const formsSubmissionsListQuerySchema = Schema.Struct({
  ...cursorPaginationQuerySchema.fields,
  status: optionalField(
    formSubmissionStatusSchema.annotate({ description: 'Filter to one lifecycle state' })
  ),
  from: optionalField(
    looseIsoDateTime({ description: 'Inclusive lower bound on `submittedAt` (ISO 8601 UTC)' })
  ),
  to: optionalField(
    looseIsoDateTime({ description: 'Exclusive upper bound on `submittedAt` (ISO 8601 UTC)' })
  ),
  include_deleted: coercedBoolean
    .annotate({
      description:
        'When true, include soft-deleted submissions (`deletedAt` non-null) in the response. Default false.',
    })
    .pipe(withDefault(false)),
  // STRICT parse (`booleanFlag`), unlike `include_deleted`: `coercedBoolean`
  // reads the string "false" as true, and a reveal is the one flag whose
  // accidental `true` writes a critical audit event and ships every body.
  reveal: booleanFlag
    .annotate({
      description:
        "When true, each item carries its submitted `body`, only for an admin caller on an instance that sets `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true`, the detail endpoint's own gate. A revealed page writes one critical `form.submission.bodies.revealed` audit event. A caller who fails the gate is not refused: the page answers without bodies and `bodiesRevealed: false`. Never widens `q`, which does not search bodies whatever this says.",
    })
    .pipe(withDefault(false)),
  q: searchTermSchema.annotate({
    description:
      'Optional free-text search over the SUBMITTER identity (the account `email` and `name` behind `submitter_user_id`) and the submission `id`, as a case-insensitive literal substring. Composes with `status` / `from` / `to` / the cursor (AND), so a page is a page of MATCHES. The submitted `body` is NEVER searched (the D7 redaction lock): searching it would make this list an oracle over content the caller may not be permitted to reveal. Empty / whitespace-only means "no search".',
  }),
})

/**
 * Response shape for `GET /api/admin/forms/:formName/submissions`.
 *
 * Cursor-paginated array of admin-envelope-extended submission items. The
 * `nextCursor` field is opaque base64; callers must not parse it.
 *
 * `total` counts every submission the request's filters match — `status`,
 * `from`, `to`, `include_deleted` and `q` — with the cursor and the page size
 * set aside, so a pager can say "26–30 of 30" rather than inferring a total
 * from the rows it holds. It is the same figure on every page of one query.
 *
 * `bodiesRevealed` says whether THIS page carries bodies: `true` only when the
 * reveal gate passed. A client that asked for a reveal reads it to tell
 * "answers hidden on this instance" from "answers shown".
 */
export const formsSubmissionsListResponseSchema = Schema.Struct({
  ...cursorPaginationResponseSchema(formSubmissionAdminItemSchema).fields,
  total: Schema.Finite.annotate({
    description:
      'How many submissions match the filters (status, from, to, include_deleted, q), whatever the cursor and page size: the same figure on every page of one query.',
  }).pipe(Schema.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))),
  bodiesRevealed: Schema.Boolean.annotate({
    description:
      'Whether the items on this page carry their submitted `body`: true only when `?reveal=true` was asked, the instance sets `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED=true` and the caller has an admin role.',
  }),
  appliedQuery: appliedQuerySchema,
  resultSummary: optionalField(
    Schema.String.annotate({
      description:
        'The matching submissions as one phrase in the operator’s console language, composed on the server from `total`: `11 submissions` in English, `11 réponses` in French, the singular for one (`1 submission`). A data-table bound to this endpoint prints it in its bottom bar in place of its own count of the rows it holds.',
      examples: ['11 submissions'],
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
}).annotate({ identifier: 'FormsSubmissionsListResponse' })

/** @public */
export type FormSubmissionStatus = typeof formSubmissionStatusSchema.Type
/** @public */
export type FormSubmission = typeof formSubmissionSchema.Type
/** @public */
export type FormSubmissionAdminItem = typeof formSubmissionAdminItemSchema.Type
/** @public */
export type FormsSubmissionsListQuery = typeof formsSubmissionsListQuerySchema.Type
/** @public */
export type FormsSubmissionsListResponse = typeof formsSubmissionsListResponseSchema.Type
