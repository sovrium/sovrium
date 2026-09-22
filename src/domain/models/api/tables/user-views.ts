/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { optionalField } from '@/domain/models/api/combinators/optional-field'
import { columnWidthsSchema, rowDensitySchema } from './user-preferences'

/**
 * View type a saved view was captured in.
 *
 * Mirrors `DataTableViewTypeSchema` (`src/domain/models/app/pages/components/
 * component-types/data/table/view-types.ts`) on the wire side of the
 * contract, exactly as `rowDensitySchema` mirrors the island's row-density
 * union. A view persisted WITHOUT this key restores as `grid` — the switcher's
 * initial state — never as "the first entry in `views`", which would silently
 * repoint every legacy saved view the day an author reorders the tabs.
 *
 * Exported because `normalizeSavedViewPresentation`
 * (`domain/models/app/tables/saved-view-presentation.ts`) tests stored blobs
 * against THIS schema rather than a parallel literal list — the two cannot
 * drift, which is what keeps the tightened response fields below safe.
 */
export const savedViewTypeSchema = Schema.Literals(['grid', 'kanban', 'calendar', 'gallery'])

/**
 * Personal Saved Views PATCH API schemas (Phase 7 Cycle 3 — body validation).
 *
 * Closes the silent-PATCH gap flagged by Phase 6 Cycle 1 + Cycle 5 audits: the
 * `/api/tables/:tableId/user-views/:viewId` PATCH/PUT handler previously merged
 * the raw JSON body into the saved-view row's `config` JSONB without any shape
 * check, silently persisting malformed filters/sorts (e.g. `filters: 'not-an-array'`,
 * `sorts: [{ direction: 'sideways' }]`) into the database.
 *
 * Shape contract (matches the runtime types defined in
 * `src/presentation/islands/hooks/use-saved-views.ts`):
 *
 *   - `filters[]`  : `{ field: string, operator: string, value }`
 *      Operator is intentionally an open string — three vocabularies coexist
 *      (UI spaced English / API camelCase / domain hyphenated) and Cycle 2
 *      explicitly locks operator-string flexibility. Outer shape is strict.
 *
 *   - `sorts[]`    : `{ field: string, direction: 'asc' | 'desc' }`
 *      Direction is a hard enum; `'sideways'` etc. must be rejected.
 *
 *   - `groupBy`    : `string | null`
 *
 *   - `baseViewId` : `string | null`
 *      Loose reference to a developer-configured view in
 *      `app.tables[].views[]` that this saved view extends.
 *
 *   - `name`       : `string` (when present, non-empty)
 *   - `isDefault`  : `boolean`
 *
 * Every key is optional — PATCH semantics are merge-with-existing.
 * `strictKeys` rejects unknown keys outright so malformed clients fail loud.
 */

/**
 * Filter `value` shape. The records API and `SavedViewFilter['value']` allow
 * primitives plus arrays of primitives (used by `isAnyOf` / `isNoneOf`). We
 * widen beyond the audit's `string | string[]` to match runtime reality:
 * `'todo'` (string), `42` (number, e.g. priority filter), and arrays for
 * multi-value operators all appear in the test fleet.
 */
const filterValueSchema = Schema.Union([
  Schema.String,
  Schema.Finite,
  Schema.Boolean,
  Schema.Null,
  Schema.Array(Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])),
])

/**
 * Saved-view filter shape. The outer triple is strictly enforced — operator
 * is open-string (3-vocabulary contract from Cycle 2). Strict mode rejects
 * stray keys so authoring mistakes surface as 400 instead of silently
 * persisting noise into JSONB.
 */
const savedViewFilterSchema = Schema.Struct({
  field: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  operator: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  value: filterValueSchema,
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })

/**
 * Saved-view sort shape. Direction is a closed enum — the predicate evaluator
 * only knows `'asc'` and `'desc'`, so anything else is a 400 instead of a
 * silently dropped predicate.
 */
const savedViewSortSchema = Schema.Struct({
  field: Schema.String.pipe(Schema.check(Schema.isMinLength(1))),
  direction: Schema.Literals(['asc', 'desc']),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })

/**
 * PATCH body for `/api/tables/:tableId/user-views/:viewId`.
 *
 * `strictKeys` enforces the closed-world: unknown top-level keys produce 400.
 * Adding a new persisted view-config dimension requires updating this schema
 * AND the route's `mergeConfigKeys` builder in lockstep — that is the design.
 *
 * `baseViewId` admits both string and number because developer-configured
 * views in `app.tables[].views[]` carry either a string id or a numeric
 * primary key — the existing `parseCreatePayload` already widened the create
 * path to `string | number`, and saved views authored against legacy schemas
 * may PATCH the same shape.
 */
export const userViewPatchSchema = Schema.Struct({
  name: optionalField(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
  isDefault: optionalField(Schema.Boolean),
  filters: optionalField(Schema.Array(savedViewFilterSchema)),
  sorts: optionalField(Schema.Array(savedViewSortSchema)),
  fields: optionalField(Schema.Array(Schema.String)),
  groupBy: optionalField(Schema.Union([Schema.String, Schema.Null])),
  baseViewId: optionalField(Schema.Union([Schema.String, Schema.Finite, Schema.Null])),
  viewType: optionalField(savedViewTypeSchema),
  rowDensity: optionalField(rowDensitySchema),
  columnWidths: optionalField(columnWidthsSchema),
}).annotate({ strictKeys: true, title: 'sovrium:strict-keys' })

/**
 * @public Wire-contract companion type to `userViewPatchSchema`. Exported per
 * the wire-contract single-source-of-truth convention
 * (`[internal ref]`, which records the Zod
 * removal); saved-view consumers
 * currently use the structurally-identical port interface.
 */
export type UserViewPatch = typeof userViewPatchSchema.Type

/**
 * Response schema — Phase 8 Cycle 2.
 *
 * Single source of truth for the wire shape returned by every saved-view
 * route (list/create/update/share). The route handler parses every
 * `c.json(...)` payload through this schema so the OpenAPI contract holds
 * at runtime and the pre-launch security checklist S4 invariant ("never
 * return raw DB rows from an API route — shape responses via
 * src/domain/models/api/ schemas") is enforced.
 *
 * Mirror of the pre-Cycle-2 `toResponseRow` helper that lived inline in
 * the route file. Optional keys reflect "absent from the JSONB `config`
 * blob" — clients distinguish "never set" from "explicitly cleared" by
 * presence vs explicit `null`. Admitting unknown keys wholesale would be
 * unsafe here, and `strictKeys` is also unsafe because the inferred type then
 * refuses legitimate-but-optional keys. Effect's default — drop what the
 * struct does not declare — is the middle ground, and matches the runtime
 * helper.
 *
 * `viewType`, `rowDensity` and `columnWidths` carry the same unions the PATCH
 * body enforces, so the wire contract now says what a client may actually
 * receive instead of `unknown`.
 *
 * That tightening is only safe BECAUSE the route normalises first. The CREATE
 * path still copies those three keys out of the request body with no schema
 * between it and the JSONB `config` blob, so a value these unions reject is
 * writable today — and without normalisation one such blob would fail this
 * decode and turn the whole LIST into a 500, taking every OTHER view the user
 * owns down with it. `normalizeSavedViewPresentation`
 * (`domain/models/app/tables/saved-view-presentation.ts`) runs on every response
 * built here, and tests each value against the very schemas named below so the
 * two can never disagree. Removing that call re-opens the 500
 *.
 *
 * The suite is NOT the evidence this is safe: measured 2026-09-11, the whole
 * `[internal ref]` directory stays GREEN with
 * these fields tightened and no normaliser at all. Only
 * [internal ref] fails in that state.
 */
export const userViewResponseSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  tableName: Schema.String,
  isDefault: Schema.Boolean,
  filters: optionalField(Schema.Unknown),
  sorts: optionalField(Schema.Unknown),
  fields: optionalField(Schema.Unknown),
  groupBy: optionalField(Schema.Unknown),
  baseViewId: optionalField(Schema.Union([Schema.String, Schema.Finite, Schema.Null])),
  viewType: optionalField(savedViewTypeSchema),
  rowDensity: optionalField(rowDensitySchema),
  columnWidths: optionalField(columnWidthsSchema),
  createdAt: Schema.String,
  updatedAt: Schema.String,
})

/**
 * @public Wire-contract companion type to `userViewResponseSchema` (the live
 * response envelope validator). Exported per the wire-contract single-source-of-truth
 * convention; saved-view consumers currently use the structurally-identical
 * port interface of the same name.
 */
export type UserViewResponse = typeof userViewResponseSchema.Type

/**
 * List response — `GET /api/tables/:tableId/user-views`. Returns an array
 * of saved views ordered by creation time (oldest first). No pagination
 * cursor in v1; the per-(user,table) cardinality is small by design.
 */
export const userViewsListResponseSchema = Schema.Array(userViewResponseSchema)
/**
 * @public Wire-contract companion type to `userViewsListResponseSchema`.
 * Exported per the wire-contract single-source-of-truth convention; the list route
 * currently returns the inferred array shape via the schema directly.
 */
export type UserViewsListResponse = typeof userViewsListResponseSchema.Type
