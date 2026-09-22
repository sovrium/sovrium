/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/forms` and the sibling detail endpoint
 * `GET /api/admin/forms/:formName`.
 *
 * **The first non-keystone consumer of `createAdminListEndpoint`.**
 *
 * Where `[internal ref]` (story #3) authored the helper
 * against a DB-backed list (`automation_runs`), this story is the canary:
 * if the helper API generalizes to a config-backed list (rows come from
 * the in-memory `app.forms[]` array, not from a runtime-mutated DB table),
 * subsequent stories #5–#7 ship without helper changes. If forms-list
 * needs a helper field that the helper does not surface, that's a P0
 * blocker per plan §3.5 (additivity-only across stories #3–#7).
 *
 * **Three [internal ref] decisions are CONSUMED here, not locked**:
 *
 * - **D2 (consumed)** — `?include_deleted=false` is the default;
 *   `?include_deleted=true` is the opt-in. Forms are config-time entities
 *   (defined in `app.forms[]`, not stored in a runtime-mutated table) so
 *   the parameter is a forward contract — same behavior as runs-list.
 * - **D3 (consumed)** — every item carries the canonical `_admin: {
 *   lastModifiedBy, deletedAt, metadata? }` block from
 *   `envelope/admin-envelope.ts`. Forms-list is the FIRST consumer to
 *   populate `_admin.metadata` (with `fieldCount`, `submissionCount`,
 *   `lastSubmissionAt`) — proves the canonical block stays stable while
 *   domain-specific extras flow through the optional escape hatch.
 * - **D9 (consumed)** — runtime handler MUST consume
 *   `createAdminListEndpoint`. NO new helper field is authored here.
 *
 * **Schema-drift mitigation** (plan §6.5): the public `formSummarySchema`
 * from `src/domain/models/api/forms/forms.ts` is the canonical source of
 * truth for the form summary shape. This admin module **extends** it with
 * the `_admin` block — it does NOT redefine `id`, `name`, `title`, etc.
 * Future field additions to the public schema flow through automatically;
 * drift is structurally impossible.
 *
 * Source story: [internal ref]
 *
 * @see [internal ref] D2, D3, D9 — locked by story #3, consumed here
 * @see plan §4.4 — per-story design for [internal ref]
 * @see plan §3.5 — helper API additivity-only across stories #3–#7
 * @see plan §6.5 — schema reuse rule (extend, never duplicate)
 */

import { Schema } from 'effect'
import { adminEnvelopeSchema } from '@/domain/models/api/admin/envelope/admin-envelope'
import { booleanFlag } from '@/domain/models/api/combinators/coerce'
import {
  cursorPaginationQuerySchema,
  cursorPaginationResponseSchema,
} from '@/domain/models/api/combinators/cursor-pagination'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { formSummarySchema } from '@/domain/models/api/forms/forms'
import { withDefault } from '../../combinators/schema-defaults'

/**
 * Filter query parameters accepted by `GET /api/admin/forms`.
 *
 * Extends the shared cursor pagination query (`cursor`, `limit`) with the
 * forms-specific filter (`search`) and the D2-consumed `include_deleted`
 * opt-in. The `search` filter is the FIRST free-text query parameter on
 * any Phase-0 admin list endpoint — runs-list uses structured filters
 * (`?status`, `?automationName`); this story exercises the helper's
 * ability to accept arbitrary Zod-shaped filter fields.
 *
 * **Default `include_deleted=false`** is the D2 consumption. Forms cannot
 * be soft-deleted in Phase 0; the parameter parses without 400 (forward
 * contract — same shape as runs-list). The Zod `.default(false)` is
 * applied at the schema layer so handlers never see `undefined`.
 *
 * The `include_deleted` shape mirrors the runs-list pattern (boolean OR
 * stringly-typed with coercion) so loaders can consume the parsed value
 * uniformly without per-domain coercion logic.
 */
export const formsListQuerySchema = Schema.Struct({
  ...cursorPaginationQuerySchema.fields,
  search: optionalField(
    Schema.String.annotate({
      description:
        "Case-insensitive free-text substring match over each form's `title` AND `name` (matches in either field qualify). Empty result set returns `items: []` with HTTP 200, NOT 404 — matching the canonical empty-result-vs-anti-enum distinction (anti-enum 404 is reserved for unauthorized access, NOT empty queries).",
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  include_deleted: booleanFlag
    .annotate({
      description:
        'Include soft-deleted forms. Default `false` — D2 consumption from runs-list. Pass `?include_deleted=true` to surface tombstones for compliance review. The flag parses without 400 even though forms cannot be soft-deleted in Phase 0 (forward-contract — see story §dependencies).',
    })
    .pipe(withDefault(false)),
}).annotate({ identifier: 'FormsListQuery' })

/**
 * Resolved query parameter values (post-default-fill, post-coercion).
 *
 * Use `z.infer` rather than `z.input` so call sites see the parsed type:
 * `cursor: string | undefined`, `limit: number` (default applied), and
 * `include_deleted: boolean` (default applied). Avoids the Story-#1 cache
 * regression where a transitive `z.input` made the helper config too narrow.
 * @public
 */
export type FormsListQuery = typeof formsListQuerySchema.Type

/**
 * Single admin form item — public `formSummarySchema` extended with the
 * `_admin` envelope.
 *
 * The order of `.extend()` matters for OpenAPI naming: the resulting
 * schema is registered under `FormAdminItem` so client SDKs generate a
 * type that says "this is a form summary with admin extras", not just
 * "extended FormSummary". The canonical fields (`id`, `name`, `title`,
 * `path`, `accessLevel`, `isOpen`) are inherited verbatim from the public
 * `formSummarySchema`; the only addition is the `_admin` block.
 *
 * **`_admin.metadata` populated for forms** — first Phase-0 consumer to
 * surface domain-specific extras under the optional metadata slot. Per
 * the D3 lock from runs-list, the canonical block stays stable; only
 * `metadata` flows through new domain-specific fields. The runtime
 * handler populates `metadata` with:
 *
 *   - `fieldCount` (non-negative int) — `app.forms[].fields.length`
 *   - `submissionCount` (non-negative int) — `count(*)` over
 *     `form_submissions` filtered by `form_name = items[].name`
 *   - `lastSubmissionAt` (ISO 8601 datetime / null) — `max(submitted_at)`
 *     over the same join; null when the form has never received a
 *     submission
 *
 * The wire-format `_admin.metadata` is `Record<string, unknown> |
 * undefined` per the canonical envelope; the loader narrows the
 * `unknown` values at construction time. Specs can spot-check the keys
 * without depending on the metadata's full shape (the canonical block is
 * the only D3-locked surface).
 */
export const formAdminItemSchema = Schema.Struct({
  ...formSummarySchema.fields,
  _admin: adminEnvelopeSchema,
}).annotate({ identifier: 'FormAdminItem' })

/** @public */
export type FormAdminItem = typeof formAdminItemSchema.Type

/**
 * Cursor-paginated response shape for the list endpoint.
 *
 * Wraps the admin item schema with the canonical `{ items, nextCursor }`
 * envelope from `combinators/cursor-pagination.ts`. `nextCursor === null`
 * signals stream end; non-null is an opaque base64 token for the next
 * `?cursor=...` request.
 *
 * Cursor encoding for forms is `base64(name)` of the last item — forms
 * are sorted ascending by `name` (kebab-case is total-ordered, names are
 * unique within an app schema, no ties to break). Stability is trivial
 * compared to runs-list's `(startedAt DESC, id ASC)` tuple.
 */
export const formsListResponseSchema = cursorPaginationResponseSchema(formAdminItemSchema).annotate(
  { identifier: 'FormsListResponse' }
)

/** @public */
export type FormsListResponse = typeof formsListResponseSchema.Type

/**
 * Path parameter for the detail endpoint `GET /api/admin/forms/:formName`.
 *
 * Validates the `:formName` placeholder as a kebab-case form name —
 * matches the public `formNameSchema` regex `/^[a-z][a-z0-9-]*$/` for
 * consistency with `/api/forms/:name`. Invalid names return 400
 * (parameter validation) rather than 404; the 400-vs-404 distinction is
 * acceptable here because the form-name regex is publicly known via the
 * public `/api/forms/:name` endpoint and a 400 leaks no information
 * about which forms exist.
 *
 * Unknown form names (i.e., names that pass the regex but do not match
 * any entry in `app.forms[]`) DO return 404 per the anti-enumeration
 * contract — that's the [internal ref] lock.
 */
export const formsDetailParamsSchema = Schema.Struct({
  formName: Schema.String.annotate({
    description:
      'Form name (kebab-case) — matches `formNameSchema` from the public `/api/forms/:name` endpoint.',
  }).pipe(
    Schema.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(64),
      Schema.isPattern(/^[a-z][a-z0-9-]*$/)
    )
  ),
}).annotate({ identifier: 'FormsDetailParams' })

/** @public */
export type FormsDetailParams = typeof formsDetailParamsSchema.Type

/**
 * Detail endpoint response shape — a single admin form item.
 *
 * Re-exports the item schema under a distinct OpenAPI name so the detail
 * endpoint's response is documented separately from the list endpoint's
 * item shape, even though the runtime types are equal. Future evolution
 * of the detail-only fields (e.g., per-field submission distribution,
 * full availability window) will branch this schema; for now it is
 * structurally identical to the list item.
 */
export const formAdminDetailResponseSchema = formAdminItemSchema.annotate({
  identifier: 'FormsDetailResponse',
})

/** @public */
export type FormAdminDetailResponse = typeof formAdminDetailResponseSchema.Type
