/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the five admin/forms endpoints
 * (`GET /api/admin/forms`, `GET /api/admin/forms/:formName`, and the three
 * `.../submissions{,/:id,/_bulk}` reads).
 *
 * The application layer owns ALL pure logic:
 *   - form admin-item building (config-derived `accessLevel` / `isOpen`, the
 *     `_admin` envelope, aggregate-row → ISO metadata coercion),
 *   - submission admin-item building (status coercion + timestamp ISO coercion),
 *   - the two opaque cursor encode/decode pairs (forms-by-name and
 *     submissions-by-`(submittedAt, id)`), byte-identical to the former route so
 *     existing clients' cursors keep working,
 *   - forms-catalog pagination over the in-memory `app.forms[]` array (sort,
 *     search filter, cursor seek, page slice),
 *   - assembling + response-schema-validating each body.
 *
 * Only the raw `form_submissions` reads (per-form aggregate, cursor list,
 * detail-with-body, bulk by-id) live in the infrastructure repository, accessed
 * via {@link AdminFormsRepository}. The audit emit
 * (`form.{list,detail}.queried`, `form.submission.{list,detail,bulk}.queried`,
 * `form.submission.body.revealed`) stays in the route after a successful read.
 */

import { Effect, Layer } from 'effect'
import {
  AdminFormsRepository,
  type AdminFormAggregateRow,
  type AdminFormSubmissionRow,
  type AdminFormsDatabaseError,
} from '@/application/ports/repositories/forms/admin-forms-repository'
import {
  formAdminDetailResponseSchema,
  formsListResponseSchema,
  type FormAdminItem,
} from '@/domain/models/api/admin/forms/list'
import { formSubmissionDetailResponseSchema } from '@/domain/models/api/admin/forms/submission-detail'
import { formsSubmissionsBulkResponseSchema } from '@/domain/models/api/admin/forms/submissions-bulk'
import {
  formsSubmissionsListResponseSchema,
  type FormSubmissionAdminItem,
  type FormSubmissionStatus,
} from '@/domain/models/api/admin/forms/submissions-list'
import { classifyPermissionRung } from '@/domain/models/shared/permission-evaluation'
import { toFiniteCount } from '@/domain/utils/database/count-coercion'
import { AdminFormsRepositoryLive } from '@/infrastructure/database/repositories/forms/admin-forms-repository-live'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/* eslint-disable unicorn/no-null -- API envelope canonically uses `null` for absent values across all admin endpoints (matches public schema + audit envelope contract); preserved verbatim from the former route helpers */

// ─── Pure form-item helpers ─────────────────────────────────────────────────

/** Resolve the public-schema `accessLevel` value for a form. */
function resolveAccessLevel(form: Form): 'public' | 'authenticated' | 'role-restricted' {
  const rung = classifyPermissionRung(form.access?.require)
  if (rung === 'undeclared' || rung === 'everyone') return 'public'
  if (rung === 'any-session') return 'authenticated'
  return 'role-restricted'
}

/** Derive `isOpen` from the form's availability window. */
function resolveIsOpen(form: Form): boolean {
  const { availability } = form
  if (!availability) return true
  const now = Date.now()
  if (availability.opensAt) {
    const opens = Date.parse(availability.opensAt)
    if (!Number.isNaN(opens) && now < opens) return false
  }
  if (availability.closesAt) {
    const closes = Date.parse(availability.closesAt)
    if (!Number.isNaN(closes) && now >= closes) return false
  }
  return true
}

/** Coerce a dialect-native aggregate `lastSubmissionAt` to ISO 8601 / null. */
function aggregateLastSubmissionIso(raw: Readonly<Date> | string | null): string | null {
  if (raw === null) return null
  return raw instanceof Date ? raw.toISOString() : new Date(raw).toISOString()
}

/**
 * Build the canonical admin item for one form from its config entry + the
 * aggregate metadata read from `form_submissions`. Pure — the aggregate row is
 * supplied by the caller (which sourced it via the repository).
 */
function buildFormAdminItem(
  form: Form,
  aggregate: AdminFormAggregateRow
  // eslint-disable-next-line functional/prefer-immutable-types -- FormAdminItem is the Zod-inferred response shape (upstream-mutable); the route serializes it straight to JSON without mutating
): FormAdminItem {
  const submissionCount = toFiniteCount(aggregate.submissionCount)
  const lastSubmissionAt = aggregateLastSubmissionIso(aggregate.lastSubmissionAt ?? null)

  return {
    id: form.id,
    name: form.name,
    title: form.title,
    ...(form.path !== undefined ? { path: form.path } : {}),
    accessLevel: resolveAccessLevel(form),
    isOpen: resolveIsOpen(form),
    _admin: {
      lastModifiedBy: null,
      deletedAt: null,
      metadata: {
        fieldCount: form.fields.length,
        submissionCount,
        lastSubmissionAt,
      },
    },
  }
}

// ─── Forms cursor (opaque base64 of `{ afterName }`) ────────────────────────

/** Encode a forms-list cursor — opaque base64 of `{ afterName }`. */
export function encodeFormsCursor(afterName: string): string {
  return Buffer.from(JSON.stringify({ afterName }), 'utf8').toString('base64')
}

/**
 * Decode a forms-list cursor into the start index within `forms`. Malformed
 * cursors (or an `afterName` no longer present in the filtered list) restart
 * from the head — byte-identical to the former route helper.
 */
export function decodeFormsCursor(
  cursor: string,
  forms: ReadonlyArray<{ readonly name: string }>
): number {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as {
      readonly afterName?: unknown
    }
    if (typeof decoded.afterName !== 'string') return 0
    const idx = forms.findIndex((f) => f.name === decoded.afterName)
    return idx === -1 ? 0 : idx + 1
  } catch {
    return 0
  }
}

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
  // eslint-disable-next-line functional/prefer-immutable-types -- FormSubmissionAdminItem is the Zod-inferred response shape (upstream-mutable); the route serializes it straight to JSON without mutating
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

// ─── Forms-list use case ─────────────────────────────────────────────────────

/**
 * Validated forms-list inputs, parsed by the route from the query string. The
 * cursor stays opaque here — the use case decodes it (so the encode/decode pair
 * stays co-located with the rest of the pure logic).
 */
export interface FormsListInput {
  readonly cursor?: string | undefined
  readonly limit: number
  readonly search?: string | undefined
}

/**
 * Outcome of a list/detail build. `Ok` carries the response-schema-validated
 * body; `ValidationFailed` signals the assembled body failed the response gate
 * (the route maps this to a 500 + logs the Zod error, exactly as before).
 */
export type FormsBuildOutcome<B> =
  | { readonly _tag: 'Ok'; readonly body: B }
  | { readonly _tag: 'ValidationFailed'; readonly error: unknown }

/** `NotFound` variant — the route maps it to an anti-enum 404 (no audit emit). */
export type FormsDetailOutcome<B> = FormsBuildOutcome<B> | { readonly _tag: 'NotFound' }

/**
 * Build the cursor-paginated forms-list body.
 *
 * The forms catalog is the in-memory `app.forms[]` array (config-backed, not a
 * DB table). Pagination semantics (preserved verbatim from the former route):
 * sort ascending by `name`, apply the optional case-insensitive search over
 * `name` AND `title`, seek to the cursor's index, slice `limit` rows. Each page
 * row then runs a per-form aggregate read (in parallel) to populate
 * `_admin.metadata`. `nextCursor` is non-null only when more rows follow.
 */
export const BuildFormsList = (
  app: App,
  input: FormsListInput
): Effect.Effect<
  FormsBuildOutcome<{
    readonly items: readonly FormAdminItem[]
    readonly nextCursor: string | null
  }>,
  AdminFormsDatabaseError,
  AdminFormsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const allForms: readonly Form[] = (app.forms ?? []).slice()
    // Sort ascending by name for stable cursor traversal (immutable copy).
    const sortedForms = allForms.toSorted((a, b) => a.name.localeCompare(b.name))

    // Apply search filter (case-insensitive substring over name AND title).
    const filtered = input.search
      ? sortedForms.filter((f) => {
          const haystack = `${f.name} ${f.title}`.toLowerCase()
          return haystack.includes(input.search!.toLowerCase())
        })
      : sortedForms

    const startIndex = input.cursor ? decodeFormsCursor(input.cursor, filtered) : 0
    const pageSlice = filtered.slice(startIndex, startIndex + input.limit)
    const nextStart = startIndex + pageSlice.length
    const lastForm = pageSlice[pageSlice.length - 1]
    const nextCursor =
      nextStart < filtered.length && lastForm !== undefined
        ? encodeFormsCursor(lastForm.name)
        : null

    // Build admin items in parallel — each item runs a small aggregate query.
    const items = yield* Effect.all(
      pageSlice.map((form) =>
        repo.aggregateForForm(form.name).pipe(Effect.map((agg) => buildFormAdminItem(form, agg)))
      ),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )

    const body = { items, nextCursor }
    const parsed = formsListResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { items: parsed.data.items, nextCursor: parsed.data.nextCursor } }
  })

/**
 * Build the single-form detail body for `formName`. Unknown form (not in
 * `app.forms[]`) → `NotFound` (anti-enum 404). The form-name regex validation
 * stays in the route (it returns 400, not 404).
 */
export const BuildFormDetail = (
  app: App,
  formName: string
): Effect.Effect<
  FormsDetailOutcome<FormAdminItem>,
  AdminFormsDatabaseError,
  AdminFormsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const form = (app.forms ?? []).find((f) => f.name === formName)
    if (!form) {
      return { _tag: 'NotFound' } as const
    }

    const aggregate = yield* repo.aggregateForForm(form.name)
    const item = buildFormAdminItem(form, aggregate)
    const parsed = formAdminDetailResponseSchema.safeParse(item)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data }
  })

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
  readonly cursor?: string | undefined
  readonly limit: number
}

/**
 * Build the cursor-paginated submissions-list body for a known form.
 *
 * The route resolves the anti-enum 404 (unknown form name) BEFORE calling this
 * use case, so the form is assumed to exist here.
 *
 * Pagination semantics (preserved verbatim): fetch `limit + 1` rows ordered
 * `submitted_at DESC`; the page is the first `limit` rows; `nextCursor` is
 * non-null only when a `limit + 1`-th row existed. The cursor seek predicate is
 * a strict-less `submitted_at` (UUID ties approximated away — Phase 0 contract).
 */
export const BuildSubmissionsList = (
  input: SubmissionsListInput
): Effect.Effect<
  FormsBuildOutcome<{
    readonly items: readonly FormSubmissionAdminItem[]
    readonly nextCursor: string | null
  }>,
  AdminFormsDatabaseError,
  AdminFormsRepository
> =>
  Effect.gen(function* () {
    const repo = yield* AdminFormsRepository

    const decoded = input.cursor ? decodeSubmissionsCursor(input.cursor) : null
    const cursorBefore = decoded !== null ? new Date(decoded.submittedAt) : undefined

    const rows = yield* repo.listSubmissions({
      formName: input.formName,
      includeDeleted: input.includeDeleted,
      status: input.status,
      from: input.from !== undefined ? new Date(input.from) : undefined,
      to: input.to !== undefined ? new Date(input.to) : undefined,
      cursorBefore,
      limit: input.limit,
    })

    const pageRows = rows.slice(0, input.limit)
    const items = pageRows.map((row) => buildSubmissionAdminItem(row, input.formName))
    const lastItem = items[items.length - 1]
    const nextCursor =
      rows.length > input.limit && lastItem !== undefined
        ? encodeSubmissionsCursor(lastItem.submittedAt, lastItem.id)
        : null

    const body = { items, nextCursor }
    const parsed = formsSubmissionsListResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { items: parsed.data.items, nextCursor: parsed.data.nextCursor } }
  })

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
export const BuildSubmissionDetail = (
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
    const bodyToInclude: Record<string, unknown> | undefined = input.reveal
      ? ((row.data ?? {}) as Record<string, unknown>)
      : undefined

    const item = buildSubmissionAdminItem(row, input.formName)
    // eslint-disable-next-line functional/prefer-immutable-types -- FormSubmissionDetailItem is the Zod-inferred response shape (upstream-mutable); serialized straight to JSON without mutating
    const withBody: FormSubmissionDetailItem =
      bodyToInclude !== undefined ? { ...item, body: bodyToInclude } : item

    const parsed = formSubmissionDetailResponseSchema.safeParse(withBody)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: parsed.data as FormSubmissionDetailItem,
      bodyRevealed: bodyToInclude !== undefined,
    }
  })

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
export const BuildSubmissionsBulk = (
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
    const parsed = formsSubmissionsBulkResponseSchema.safeParse(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: { items: parsed.data.items } }
  })

/* eslint-enable unicorn/no-null */

/**
 * Application layer for the admin-forms use cases.
 */
export const AdminFormsLayer = Layer.mergeAll(AdminFormsRepositoryLive)
