/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'
import { columnWidthsSchema, rowDensitySchema } from './user-preferences'

/**
 * View type a saved view was captured in.
 *
 * Mirrors `DataTableViewTypeSchema` (`src/domain/models/app/pages/components/
 * component-types/data/data-table/view-types.ts`) across the Effect→Zod
 * boundary, exactly as `rowDensitySchema` mirrors the island's row-density
 * union. A view persisted WITHOUT this key restores as `grid` — the switcher's
 * initial state — never as "the first entry in `views`", which would silently
 * repoint every legacy saved view the day an author reorders the tabs.
 */
const savedViewTypeSchema = z.enum(['grid', 'kanban', 'calendar', 'gallery'])

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
 * Every key is optional — PATCH semantics are merge-with-existing. `.strict()`
 * rejects unknown keys outright so malformed clients fail loud.
 */

/**
 * Filter `value` shape. The records API and `SavedViewFilter['value']` allow
 * primitives plus arrays of primitives (used by `isAnyOf` / `isNoneOf`). We
 * widen beyond the audit's `string | string[]` to match runtime reality:
 * `'todo'` (string), `42` (number, e.g. priority filter), and arrays for
 * multi-value operators all appear in the test fleet.
 */
const filterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
])

/**
 * Saved-view filter shape. The outer triple is strictly enforced — operator
 * is open-string (3-vocabulary contract from Cycle 2). Strict mode rejects
 * stray keys so authoring mistakes surface as 400 instead of silently
 * persisting noise into JSONB.
 */
const savedViewFilterSchema = z
  .object({
    field: z.string().min(1),
    operator: z.string().min(1),
    value: filterValueSchema,
  })
  .strict()

/**
 * Saved-view sort shape. Direction is a closed enum — the predicate evaluator
 * only knows `'asc'` and `'desc'`, so anything else is a 400 instead of a
 * silently dropped predicate.
 */
const savedViewSortSchema = z
  .object({
    field: z.string().min(1),
    direction: z.enum(['asc', 'desc']),
  })
  .strict()

/**
 * PATCH body for `/api/tables/:tableId/user-views/:viewId`.
 *
 * `.strict()` enforces the closed-world: unknown top-level keys produce 400.
 * Adding a new persisted view-config dimension requires updating this schema
 * AND the route's `mergeConfigKeys` builder in lockstep — that is the design.
 *
 * `baseViewId` admits both string and number because developer-configured
 * views in `app.tables[].views[]` carry either a string id or a numeric
 * primary key — the existing `parseCreatePayload` already widened the create
 * path to `string | number`, and saved views authored against legacy schemas
 * may PATCH the same shape.
 */
export const userViewPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
    filters: z.array(savedViewFilterSchema).optional(),
    sorts: z.array(savedViewSortSchema).optional(),
    fields: z.array(z.string()).optional(),
    groupBy: z.union([z.string(), z.null()]).optional(),
    baseViewId: z.union([z.string(), z.number(), z.null()]).optional(),
    // ---- Presentation state --------------------------------------
    // A saved view must restore what the user actually SAW, not just which
    // records they saw. All three follow the existing all-optional convention:
    // absent means "this view expresses no opinion", and the per-(user, table)
    // `user-preferences` value is the fallback. A view that never set a density
    // must not clobber the user's table-wide default when it is applied.
    viewType: savedViewTypeSchema.optional(),
    rowDensity: rowDensitySchema.optional(),
    columnWidths: columnWidthsSchema.optional(),
  })
  .strict()

/**
 * @public Wire-contract companion type to `userViewPatchSchema`. Exported per
 * the Zod single-source-of-truth convention
 *; saved-view consumers
 * currently use the structurally-identical port interface.
 */
export type UserViewPatch = z.infer<typeof userViewPatchSchema>

/**
 * Response schema — Phase 8 Cycle 2.
 *
 * Single source of truth for the wire shape returned by every saved-view
 * route (list/create/update/share). The route handler parses every
 * `c.json(...)` payload through this schema so the OpenAPI contract holds
 * at runtime and the pre-launch security checklist S4 invariant ("never
 * return raw DB rows from an API route — shape responses via
 * src/domain/models/api/ Zod schemas") is enforced.
 *
 * Mirror of the pre-Cycle-2 `toResponseRow` helper that lived inline in
 * the route file. Optional keys reflect "absent from the JSONB `config`
 * blob" — clients distinguish "never set" from "explicitly cleared" by
 * presence vs explicit `null`. `.passthrough()` would be unsafe here:
 * `.strict()` is also unsafe because the inferred type then refuses
 * legitimate-but-optional keys. The middle ground (default `.strip()`)
 * matches the runtime helper.
 */
export const userViewResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  tableName: z.string(),
  isDefault: z.boolean(),
  // Content fields are widened to `unknown` for backward-compatibility:
  // saved views authored before Phase 7 Cycle 3 (the PATCH-body validation
  // landing) may have persisted shapes that don't satisfy
  // `savedViewFilterSchema` / `savedViewSortSchema`. Parsing a legitimate
  // historical row through the strict input shape would 500 in production —
  // input validation is the right gate for shape; the response schema's job
  // is the envelope contract.
  filters: z.unknown().optional(),
  sorts: z.unknown().optional(),
  fields: z.unknown().optional(),
  groupBy: z.unknown().optional(),
  baseViewId: z.union([z.string(), z.number(), z.null()]).optional(),
  // Presentation state. Widened to `unknown` for the same reason as
  // the content fields above: rows persisted before these keys existed, and
  // rows written by a future client, must not 500 the GET path. Input
  // validation is the gate for shape; the response schema's job is the envelope.
  viewType: z.unknown().optional(),
  rowDensity: z.unknown().optional(),
  columnWidths: z.unknown().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * @public Wire-contract companion type to `userViewResponseSchema` (the live
 * response envelope validator). Exported per the Zod single-source-of-truth
 * convention; saved-view consumers currently use the structurally-identical
 * port interface of the same name.
 */
export type UserViewResponse = z.infer<typeof userViewResponseSchema>

/**
 * List response — `GET /api/tables/:tableId/user-views`. Returns an array
 * of saved views ordered by creation time (oldest first). No pagination
 * cursor in v1; the per-(user,table) cardinality is small by design.
 */
export const userViewsListResponseSchema = z.array(userViewResponseSchema)
/**
 * @public Wire-contract companion type to `userViewsListResponseSchema`.
 * Exported per the Zod single-source-of-truth convention; the list route
 * currently returns the inferred array shape via the schema directly.
 */
export type UserViewsListResponse = z.infer<typeof userViewsListResponseSchema>
