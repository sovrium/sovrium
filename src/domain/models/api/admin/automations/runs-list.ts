/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * API contract for `GET /api/admin/automations/runs` and the sibling detail
 * endpoint `GET /api/admin/automations/runs/:runId`.
 *
 * **The keystone of the admin list-endpoint pattern.**
 *
 * This is the first list-shape admin endpoint in Phase-0 with a public
 * counterpart at `/api/automations/runs`. It locks three [internal ref] binding
 * decisions simultaneously:
 *
 * - **D2** — soft-delete visibility default off. `?include_deleted=false` is
 *   the canonical default; opting in requires `?include_deleted=true`. The
 *   parameter parses without 400 even on tables that do not yet have a
 *   soft-delete column (forward contract per plan §4.3 risk #5) — the day
 *   `automation_runs` gains `deleted_at`, the AC sharpens.
 * - **D3** — `_admin` envelope as the canonical operator-extras namespace.
 *   Each item in the response carries `_admin: { lastModifiedBy,
 *   lastModifiedBy, deletedAt }` (plus optional `metadata`). The shape is
 *   defined once in `envelope/admin-envelope.ts` (CC-1) and consumed via
 *   `.extend({ _admin: adminEnvelopeSchema })` here.
 * - **D9** — a canonical `createAdminListEndpoint` helper, planned at
 *   `src/presentation/api/admin/_shared/list-endpoint.ts`. It was never
 *   authored: that path does not exist and nothing in `src/` names the symbol.
 *   The runs-list endpoint is hand-wired in
 *   `src/presentation/api/routes/admin/automations.ts` (`handleListRuns`), which
 *   reads this schema directly through `decodeSafe`. The D9 lock is therefore
 * still OPEN, not satisfied — `[internal ref]`
 * and `[internal ref]` both still describe the helper as
 *   existing.
 *
 * **Schema-drift mitigation** (plan §6.5): the public `runSchema` from
 * `src/domain/models/api/automations/automations.ts` is the canonical source
 * of truth for the run row shape. This admin module **extends** it with the
 * `_admin` block — it does NOT redefine `id`, `status`, `startedAt`, etc.
 * Future field additions to the public schema flow through automatically;
 * drift is structurally impossible.
 *
 * Source story: [internal ref]
 *
 * ## What `?q=` searches, and what it deliberately does not
 *
 * `automationName` is the column the operator reads in the grid. `error` is the
 * failure message and is **not a rendered column** (the run-history grid shows
 * Automation / Status / Started / Duration and nothing else) — which is exactly
 * why the response must echo {@link appliedQuerySchema}: a client that re-ran its
 * own in-memory filter over the visible cells would discard the very row the
 * server just matched on `error`. "Which runs blew up on ECONNREFUSED" is the
 * question this search exists to answer, and it is unanswerable from the cells.
 *
 * Deliberately EXCLUDED, each for its own reason:
 *
 * - `status` — it already has a precise filter (`?status`) AND a dedicated
 *   combobox on the surface. Folding it into free text would make `?q=failed`
 *   return every failed run in the app, burying the one the operator was looking
 *   for under a category match they did not ask for. The two knobs compose with
 *   AND instead. It is also rendered through a client-side localizer
 *   (`localizeRunStatusRows` maps `failed` → `Failed`), so a free-text status
 *   match would agree with the cell only by accident of language.
 * - `startedAt` — bounded by `?from` / `?to`, which is the honest shape for a
 *   time window; substring-matching a formatted timestamp is not a search.
 * - `triggerData` — an unbounded JSON blob whose text form differs per dialect.
 *   A substring hit inside serialized JSON is not a fact about the run.
 * - `id` — the detail endpoint (`/runs/:runId`) addresses a run by id exactly;
 *   a substring match over a UUID is noise, not recall.
 *
 * @see [internal ref] D2, D3, D9 — locked by this story
 * @see ../../combinators/search.ts — the shared `?q=` / `appliedQuery` contract
 * @see plan §4.3 — per-story design for [internal ref]
 * @see plan §5.1 — CC-1 shared `_admin` envelope (authored alongside)
 * @see plan §6.5 — schema reuse rule (extend, never duplicate)
 */

import { Schema } from 'effect'
import { adminEnvelopeSchema } from '@/domain/models/api/admin/envelope/admin-envelope'
import { runSchema, runStatusSchema } from '@/domain/models/api/automations'
import { booleanFlag } from '@/domain/models/api/combinators/coerce'
import {
  cursorPaginationQuerySchema,
  cursorPaginationResponseSchema,
} from '@/domain/models/api/combinators/cursor-pagination'
import { describedUnknown } from '@/domain/models/api/combinators/described-ref'
import { looseIsoDateTime, uuid } from '@/domain/models/api/combinators/formats'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { appliedQuerySchema, searchTermSchema } from '@/domain/models/api/combinators/search'
import { withDefault } from '../../combinators/schema-defaults'

/**
 * Filter query parameters accepted by `GET /api/admin/automations/runs`.
 *
 * Extends the shared cursor pagination query (`cursor`, `limit`) with the
 * runs-specific filters: `status`, `automationName`, `from`/`to`, and the
 * D2-locked `include_deleted` opt-in.
 *
 * **Default `include_deleted=false`** is the D2 lock. The dashboard never
 * surfaces soft-deleted rows by default; operators with a compliance need
 * pass `?include_deleted=true` explicitly. The default is applied at the schema
 * layer — `.pipe(withDefault(false))` — so handlers never see `undefined`.
 * `withDefault` is Effect 4's spelling of Zod's `.default(false)`: it wraps the
 * value in `Effect.succeed` and orders `annotate` BEFORE the default, which is
 * what keeps `"default": false` in the emitted OpenAPI document. See
 * `combinators/schema-defaults.ts`.
 *
 * Adding `?automationId=` (the public counterpart filters by name; admin
 * gets the id-shaped variant for stable cross-referencing with audit log
 * `resource.id`) is non-breaking — appending a sibling field on the query.
 */
export const automationsRunsListQuerySchema = Schema.Struct({
  ...cursorPaginationQuerySchema.fields,
  status: optionalField(
    runStatusSchema.annotate({
      description:
        'Filter by run status. Mirrors the public `?status` filter on `/api/automations/runs` so admin and public callers share one vocabulary.',
    })
  ),
  automationName: optionalField(
    Schema.String.annotate({
      description:
        'Filter by automation definition name (matches the `name` field in the app schema `automations[]` array). Mirrors the public `?automationName` filter.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  automationId: optionalField(
    Schema.String.annotate({
      description:
        'Filter by automation definition UUID. Admin-only — operators reading audit log entries scope by `resource.id` and the id is the stable cross-reference. Co-existing with `?automationName` is fine; both are AND-combined when both are provided.',
    }).pipe(Schema.check(Schema.isMinLength(1)))
  ),
  from: optionalField(
    looseIsoDateTime({
      description:
        'Lower bound (inclusive) on `startedAt` as ISO 8601. Pair with `to` to scope to a custom window; pair with neither to scope to all history (subject to retention).',
    })
  ),
  to: optionalField(
    looseIsoDateTime({
      description:
        'Upper bound (exclusive) on `startedAt` as ISO 8601. Returns 400 when `from > to`.',
    })
  ),
  include_deleted: booleanFlag
    .annotate({
      description:
        'Include soft-deleted runs. Default `false` — the D2 lock. Pass `?include_deleted=true` to surface tombstones for compliance review. The flag parses without 400 even when the underlying table has no soft-delete column yet (forward-contract — see story §risks).',
    })
    .pipe(withDefault(false)),
  q: searchTermSchema.annotate({
    description:
      'Optional free-text search over the run `automationName` and the failure `error` message, as a case-insensitive literal substring. Composes with every other filter (AND) and with the cursor, so a page is a page of MATCHES. `status`, `startedAt` and `triggerData` are intentionally NOT searched — see the searchable-field contract in the module docstring. Empty / whitespace-only means "no search".',
  }),
}).annotate({ identifier: 'AutomationsRunsListQuery' })

/**
 * Resolved query parameter values (post-default-fill, post-coercion).
 *
 * Derived from `.Type` — Effect 4's counterpart to Zod's `z.infer`, not
 * `z.input` — so call sites see the DECODED type: `cursor: string | undefined`,
 * `limit: number` (default applied), and `include_deleted: boolean` (default
 * applied). The encoded side (`Codec.Encoded`) would report the pre-default
 * wire shape, which is the Story-#1 regression where a transitive input type
 * made the helper config too narrow.
 * @public
 */
export type AutomationsRunsListQuery = typeof automationsRunsListQuerySchema.Type

/**
 * Single admin run item — public `runSchema` extended with the `_admin`
 * envelope.
 *
 * The order of `.extend()` matters for OpenAPI naming: the resulting schema
 * is registered under `AutomationRunAdminItem` so client SDKs generate a
 * type that says "this is an automation run with admin extras", not just
 * "extended Run". The canonical fields (`id`, `status`, `startedAt`, ...)
 * are inherited verbatim from the public `runSchema`; the only addition is
 * the `_admin` block.
 */
export const automationRunAdminItemSchema = Schema.Struct({
  ...runSchema.fields,
  _admin: adminEnvelopeSchema,
}).annotate({ identifier: 'AutomationRunAdminItem' })

/** @public */
export type AutomationRunAdminItem = typeof automationRunAdminItemSchema.Type

/**
 * Cursor-paginated response shape for the list endpoint.
 *
 * Wraps the admin item schema with the canonical `{ items, nextCursor }`
 * envelope from `combinators/cursor-pagination.ts`. `nextCursor === null`
 * signals stream end; non-null is an opaque base64 token for the next
 * `?cursor=...` request.
 */
export const automationsRunsListResponseSchema = Schema.Struct({
  ...cursorPaginationResponseSchema(automationRunAdminItemSchema).fields,
  appliedQuery: appliedQuerySchema,
}).annotate({ identifier: 'AutomationsRunsListResponse' })

/** @public */
export type AutomationsRunsListResponse = typeof automationsRunsListResponseSchema.Type

/**
 * Path parameter for the detail endpoint `GET /api/admin/automations/runs/:runId`.
 *
 * Validates the `:runId` placeholder as a UUID — the public `runSchema.id`
 * is `z.string().uuid()`, so the admin detail endpoint shares that constraint.
 * Invalid UUIDs return 400 (parameter validation) rather than 404; the
 * 404-vs-400 distinction is OK here because the parameter shape is publicly
 * known via the OpenAPI document and a 400 leaks no extra information about
 * which run ids exist.
 */
export const automationsRunsDetailParamsSchema = Schema.Struct({
  runId: uuid({ description: 'Run id (UUID) — matches `runSchema.id` from the public runs API.' }),
}).annotate({ identifier: 'AutomationsRunsDetailParams' })

/** @public */
export type AutomationsRunsDetailParams = typeof automationsRunsDetailParamsSchema.Type

/**
 * Detail endpoint response shape — a single admin run item.
 *
 * Re-exports the item schema under a distinct OpenAPI name so the detail
 * endpoint's response is documented separately from the list endpoint's
 * item shape, even though the runtime types are equal. Future evolution of
 * the detail-only fields (e.g. step traces, prompt/response capture) will
 * branch this schema; for now it is structurally identical to the list
 * item.
 */
export const automationsRunsDetailResponseSchema = automationRunAdminItemSchema.annotate({
  identifier: 'AutomationsRunsDetailResponse',
})

/** @public */
export type AutomationsRunsDetailResponse = typeof automationsRunsDetailResponseSchema.Type

/**
 * Per-step I/O row surfaced by the admin run-detail endpoint for the dashboard
 * run-detail panel.
 *
 * The run model already persists each step's `input` (the action's `props`) and
 * `output` (`run-persistence.ts:108-109`); this row projects those persisted
 * fields so the dashboard renders the per-step Input/Output panels without a new
 * backend. `input`/`output` are `z.unknown()` (arbitrary JSON), nullable for
 * steps that produced neither.
 */
export const adminRunStepSchema = Schema.Struct({
  /**
   * The step's position in the run, from the persisted `step_index` column.
   *
   * A FACT the row carries, not a rendering. It is published because a console
   * that draws a step rail needs to number its markers, and the alternatives
   * were both worse: synthesising the number from the array position ties the
   * label to a client-side index the config cannot name, and inventing an
   * `$index` interpolation token adds a second grammar for a number the row can
   * simply carry. Publishing a pre-composed label instead would be the
   * [internal ref] violation this deliberately avoids — an endpoint publishes
   * facts, the console composes.
   */
  index: Schema.Finite.annotate({
    description: 'Zero-based position of this step within the run (persisted `step_index`).',
  }),
  name: Schema.String.annotate({ description: 'Action step name (the automation action `name`).' }),
  status: Schema.String.annotate({
    description: 'Step execution status (e.g. completed / failed / skipped).',
  }),
  input: optionalField(describedUnknown('Step input — the action `props` (Input panel).')),
  output: optionalField(describedUnknown('Step output data (Sortie panel; null when none).')),
  error: Schema.NullOr(
    Schema.String.annotate({ description: 'Error message if the step failed.' })
  ),
}).annotate({ identifier: 'AdminRunStep' })

/** @public */
export type AdminRunStep = typeof adminRunStepSchema.Type

/**
 * Run-detail response WITH the per-step I/O list — the shape the dashboard's
 * run-detail panel consumes. Extends the canonical detail item (run row +
 * `_admin`) with a `steps` array so the per-step Input/Output panels resolve.
 *
 * The bare {@link automationsRunsDetailResponseSchema} stays the documented
 * Phase-0 contract (it is forward-compatible — `steps` is an additive field that
 * `.parse()` on the bare schema simply strips); this richer variant is what
 * `BuildAdminRunDetail` now emits.
 */
export const automationsRunsDetailWithStepsResponseSchema = Schema.Struct({
  ...automationRunAdminItemSchema.fields,
  steps: Schema.Array(adminRunStepSchema).annotate({
    description: 'Per-step execution rows with input (props) + output, ordered by step index.',
  }),
}).annotate({ identifier: 'AutomationsRunsDetailWithStepsResponse' })

/** @public */
export type AutomationsRunsDetailWithStepsResponse =
  typeof automationsRunsDetailWithStepsResponseSchema.Type
