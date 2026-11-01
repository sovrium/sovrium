/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Use cases for the two admin/forms catalogue endpoints
 * (`GET /api/admin/forms`, `GET /api/admin/forms/:formName`); the three
 * `.../submissions{,/:id,/_bulk}` reads are `form-submissions-overview.ts`.
 *
 * The application layer owns ALL pure logic:
 *   - form admin-item building (config-derived `accessLevel` / `isOpen`, the
 *     `_admin` envelope, aggregate-row → ISO metadata coercion),
 *   - the opaque forms-by-name cursor, byte-identical to the former route so
 *     existing clients' cursors keep working,
 *   - forms-catalog pagination over the in-memory `app.forms[]` array (sort,
 *     search filter, cursor seek, page slice),
 *   - assembling + response-schema-validating each body.
 *
 * Only the raw `form_submissions` reads (here, the per-form aggregate) live in the infrastructure repository, accessed
 * via {@link AdminFormsRepository}. The audit emit
 * (`form.{list,detail}.queried`, `form.submission.{list,detail,bulk}.queried`,
 * `form.submission.body.revealed`) stays in the route after a successful read.
 */

import { Effect } from 'effect'
import {
  AdminFormsRepository,
  type AdminFormAggregateRow,
  type AdminFormsDatabaseError,
} from '@/application/ports/repositories/forms/admin-forms-repository'
import { decodeSafe } from '@/domain/kernel/config-parsing/decode'
import { toFiniteCount } from '@/domain/kernel/sql/count-coercion'
import {
  formAdminDetailResponseSchema,
  formsListResponseSchema,
  type FormAdminItem,
} from '@/domain/models/api/admin/forms/list'
import { classifyPermissionRung } from '@/domain/models/app/auth/permission-evaluation'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

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
function buildFormAdminItem(form: Form, aggregate: AdminFormAggregateRow): FormAdminItem {
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
 * (the route maps this to a 500 + logs the schema decode error, exactly as before).
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
export const buildFormsList = (
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
    const items = yield* Effect.forEach(
      pageSlice,
      (form) =>
        repo.aggregateForForm(form.name).pipe(Effect.map((agg) => buildFormAdminItem(form, agg))),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )

    const body = { items, nextCursor }
    const parsed = decodeSafe(formsListResponseSchema)(body)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return {
      _tag: 'Ok',
      body: { items: parsed.data.items, nextCursor: parsed.data.nextCursor },
    } as const
  }).pipe(Effect.withSpan('admin.build-forms-list'))

/**
 * Build the single-form detail body for `formName`. Unknown form (not in
 * `app.forms[]`) → `NotFound` (anti-enum 404). The form-name regex validation
 * stays in the route (it returns 400, not 404).
 */
export const buildFormDetail = (
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
    const parsed = decodeSafe(formAdminDetailResponseSchema)(item)
    if (!parsed.success) {
      return { _tag: 'ValidationFailed', error: parsed.error } as const
    }
    return { _tag: 'Ok', body: parsed.data } as const
  }).pipe(Effect.withSpan('admin.build-form-detail'))
