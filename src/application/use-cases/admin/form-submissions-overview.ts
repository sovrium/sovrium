/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the three admin/forms submission reads
 * (`GET /api/admin/forms/:formName/submissions{,/:id,/_bulk}`).
 *
 * The submission admin-item building (status coercion + timestamp ISO
 * coercion), the opaque submissions cursor (`(submittedAt, id)`, byte-identical
 * to the former route so existing clients' cursors keep working) and the
 * response-schema validation of each body live here; the form catalogue reads
 * are `forms-overview.ts`. Only the raw `form_submissions` reads live in the
 * infrastructure repository, behind {@link AdminFormsRepository}.
 */

import { Effect } from 'effect'
import {
  AdminFormsRepository,
  type AdminFormSubmissionRow,
  type AdminFormsDatabaseError,
} from '@/application/ports/repositories/forms/admin-forms-repository'
import { decodeSafe } from '@/domain/kernel/config-parsing/decode'
import { formSubmissionDetailResponseSchema } from '@/domain/models/api/admin/forms/submission-detail'
import { formsSubmissionsBulkResponseSchema } from '@/domain/models/api/admin/forms/submissions-bulk'
import {
  formsSubmissionsListResponseSchema,
  type FormSubmissionAdminItem,
  type FormSubmissionStatus,
} from '@/domain/models/api/admin/forms/submissions-list'
import type { FormsBuildOutcome } from '@/application/use-cases/admin/forms-overview'

// ─── Pure submission-item helpers ───────────────────────────────────────────

/**
 * Coerce a `form_submissions.status` text value to the canonical lifecycle
 * status. Legacy / unrecognized values fall back to `received` so list
 * responses always validate against the strict enum.
 */
function coerceStatus(raw: unknown): FormSubmissionStatus {
  if (
    raw === 'received' ||
    raw === 'processing' ||
    raw === 'done' ||
    raw === 'failed' ||
    raw === 'spam'
  ) {
    return raw
  }
  return 'received'
}

/** Convert a DB row to the canonical admin submission shape (no body). */
function buildSubmissionAdminItem(
  row: AdminFormSubmissionRow,
  formName: string
): FormSubmissionAdminItem {
  const submittedAt =
    row.submittedAt instanceof Date
      ? row.submittedAt.toISOString()
      : new Date(row.submittedAt).toISOString()
  const deletedAt =
    row.deletedAt === null || row.deletedAt === undefined
      ? null
      : row.deletedAt instanceof Date
        ? row.deletedAt.toISOString()
        : new Date(row.deletedAt).toISOString()
  return {
    id: row.id,
    formName: row.formName ?? formName,
    submittedAt,
    status: coerceStatus(row.status),
    _admin: {
      lastModifiedBy: null,
      deletedAt,
    },
  }
}

// ─── Submissions cursor (opaque base64 of `{ submittedAt, id }`) ────────────

/** Encode a submissions-list cursor — opaque base64 of `{ submittedAt, id }`. */
export function encodeSubmissionsCursor(submittedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ submittedAt, id }), 'utf8').toString('base64')
}

/**
 * Decode a submissions-list cursor. Returns `null` (the use case maps that to
 * "ignore the cursor") when the payload is malformed.
 */
export function decodeSubmissionsCursor(
  cursor: string
): { readonly submittedAt: string; readonly id: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly submittedAt?: unknown
      readonly id?: unknown
    }
    if (typeof decoded.submittedAt !== 'string' || typeof decoded.id !== 'string') return null
    return { submittedAt: decoded.submittedAt, id: decoded.id }
  } catch {
    return null
  }
}

// ─── Submissions-list use case ───────────────────────────────────────────────

/**
 * Validated submissions-list inputs, parsed by the route from the canonical
 * query schema. The cursor stays opaque here; the use case decodes it.
 */
export interface SubmissionsListInput {
  readonly formName: string
  readonly includeDeleted: boolean
  readonly status?: FormSubmissionStatus | undefined
  readonly from?: string | undefined
  readonly to?: string | undefined
  /**
   * Free-text term over the SUBMITTER identity and the submission `id`; never
   * the body — see the repository's `buildSearchConditions` (the D7 lock).
   */
  readonly q?: string | undefined
  readonly cursor?: string | undefined
  readonly limit: number
  /** The caller ASKED for bodies (`?reveal=true`); whether it gets them is the gate's. */
  readonly reveal: boolean
}

/**
 * Build the cursor-paginated submissions-list body for a known form (the
 * anti-enum 404 is resolved before), with its `total` and — when the caller's
 * reveal gate passed — each row's body.
 *
 * Pagination semantics (preserved verbatim): fetch `limit + 1` rows ordered
 * `submitted_at DESC`; the page is the first `limit` rows; `nextCursor` is
 * non-null only when a `limit + 1`-th row existed. The cursor seek predicate is
 * a strict-less `submitted_at` (UUID ties approximated away — Phase 0 contract).
 */
export const buildSubmissionsList = (
  input: SubmissionsListInput,
  revealBodies: boolean
): Effect.Effect<
  FormsBuildOutcome<{
    readonly items: readonly FormSubmissionDetailItem[]
    readonly nextCursor: string | null
    readonly total: number
    readonly bodiesRevealed: boolean
    readonly appliedQuery: string | null
  }>,
  AdminFormsDatabaseError,
  AdminFormsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const decoded = input.cursor ? decodeSubmissionsCursor(input.cursor) : null
    const cursorBefore = decoded !== null ? new Date(decoded.submittedAt) : undefined

    const { formName, includeDeleted, status, q } = input
    const from = input.from !== undefined ? new Date(input.from) : undefined
    const to = input.to !== undefined ? new Date(input.to) : undefined
    const filters = { formName, includeDeleted, status, from, to, q }
    const page = { cursorBefore, limit: input.limit, withData: revealBodies }
    const rows = yield* repo.listSubmissions({ ...filters, ...page })
    const total = yield* repo.countSubmissions(filters)

    // `revealBodies` is the caller's gate verdict; each body is THAT row's `data`.
    const pageRows = rows.slice(0, input.limit)
    const items: ReadonlyArray<FormSubmissionDetailItem> = pageRows.map((row) => {
      const item = buildSubmissionAdminItem(row, input.formName)
      return revealBodies ? { ...item, body: (row.data ?? {}) as Record<string, unknown> } : item
    })
    const lastItem = items[items.length - 1]
    const nextCursor =
      rows.length > input.limit && lastItem !== undefined
        ? encodeSubmissionsCursor(lastItem.submittedAt, lastItem.id)
        : null

    // `appliedQuery` rides EVERY response, `null` when no term was applied. Its
    // PRESENCE — not its truthiness — is what tells the inbox grid that the
    // narrowing already happened server-side and it must not repeat it over the
    // two columns it renders. Omitting the key on a no-term request would
    // re-arm that in-memory pass the moment an operator CLEARS the box.
    const appliedQuery = input.q ?? null
    const body = { items, nextCursor, total, bodiesRevealed: revealBodies, appliedQuery }
    const parsed = decodeSafe(formsSubmissionsListResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: { ...parsed.data, appliedQuery: parsed.data.appliedQuery ?? null },
    } as const
  }).pipe(Effect.withSpan('admin.build-submissions-list'))

// ─── Submission-detail use case ──────────────────────────────────────────────

/**
 * The detail item shape — the canonical submission item plus an optional `body`
 * (populated only when the route's D7 reveal gate passes).
 */
export type FormSubmissionDetailItem = FormSubmissionAdminItem & {
  readonly body?: Record<string, unknown>
}

/**
 * Outcome of the submission-detail build. `RevealDenied` maps to the 403
 * body-capture-disabled error; `NotFound` to an anti-enum 404 (no audit emit);
 * `ValidationFailed` to a 500. `Ok` carries `bodyRevealed` so the route knows
 * whether to additionally emit `form.submission.body.revealed` (critical).
 */
export type SubmissionDetailOutcome =
  | {
      readonly _tag: 'Ok'
      readonly body: FormSubmissionDetailItem
      readonly bodyRevealed: boolean
    }
  | { readonly _tag: 'NotFound' }
  | { readonly _tag: 'RevealDenied' }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/**
 * Validated submission-detail inputs, parsed by the route. `reveal` is the
 * `?reveal=true` query flag; `captureAllowed` and `isAdmin` are the two D7 gate
 * predicates resolved by the route (env var + actor role) — kept as inputs so
 * the use case stays free of `process.env` and auth concerns.
 */
export interface SubmissionDetailInput {
  readonly formName: string
  readonly submissionId: string
  readonly reveal: boolean
  readonly captureAllowed: boolean
  readonly isAdmin: boolean
}

/**
 * Build the single-submission detail body.
 *
 * The route resolves the anti-enum 404 for an unknown FORM name before calling
 * this use case; the unknown SUBMISSION id 404 happens here (the row read
 * returns `undefined`).
 *
 * D7 reveal gate (preserved verbatim): `?reveal=true` requires
 * `captureAllowed` (env) AND `isAdmin` (role); otherwise `RevealDenied` (403).
 * When permitted, the `data` payload is included as `body` and the route emits
 * the extra critical `form.submission.body.revealed` audit entry.
 */
export const buildSubmissionDetail = (
  input: SubmissionDetailInput
): Effect.Effect<SubmissionDetailOutcome, AdminFormsDatabaseError, AdminFormsRepository> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const row = yield* repo.findSubmissionDetail(input.formName, input.submissionId)
    if (row === undefined) {
      return { _tag: 'NotFound' } as const
    }

    // D7 reveal gate. The route already resolved the env + role predicates.
    if (input.reveal && (!input.captureAllowed || !input.isAdmin)) {
      return { _tag: 'RevealDenied' } as const
    }
    const bodyToInclude: Readonly<Record<string, unknown>> | undefined = input.reveal
      ? ((row.data ?? {}) as Record<string, unknown>)
      : undefined

    const item = buildSubmissionAdminItem(row, input.formName)

    const withBody: FormSubmissionDetailItem =
      bodyToInclude !== undefined ? { ...item, body: bodyToInclude } : item

    const parsed = decodeSafe(formSubmissionDetailResponseSchema)(withBody)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: parsed.data as FormSubmissionDetailItem,
      bodyRevealed: bodyToInclude !== undefined,
    } as const
  }).pipe(Effect.withSpan('admin.build-submission-detail'))

// ─── Submissions-bulk use case ───────────────────────────────────────────────

/**
 * Build the bulk-read body for a known form. The route resolves the 100-cap
 * pre-screen, the request-body validation, and the anti-enum 404 BEFORE calling
 * this use case; `ids` here is the validated, already-capped id array.
 *
 * Semantics (preserved verbatim): one `IN (...)` read of non-deleted rows;
 * soft-deleted + missing ids drop silently; the result is re-ordered to match
 * the request id order.
 */
export const buildSubmissionsBulk = (
  formName: string,
  ids: readonly string[]
): Effect.Effect<
  FormsBuildOutcome<{ readonly items: readonly FormSubmissionAdminItem[] }>,
  AdminFormsDatabaseError,
  AdminFormsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const rows = yield* repo.findSubmissionsByIds(formName, ids)

    // Map by id for order-preserving lookup (immutable — no push loop).
    const byId = new Map(rows.map((row) => [row.id, buildSubmissionAdminItem(row, formName)]))
    const items = ids
      .map((id) => byId.get(id))
      .filter((item): item is FormSubmissionAdminItem => item !== undefined)

    const body = { items }
    const parsed = decodeSafe(formsSubmissionsBulkResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { items: parsed.data.items } } as const
  }).pipe(Effect.withSpan('admin.build-submissions-bulk'))
