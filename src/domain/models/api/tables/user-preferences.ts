/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { z } from 'zod'

/**
 * Personal Table Preferences API schemas (Phase 7 Cycle 3 — PATCH body validation).
 *
 * Closes the silent-PATCH gap flagged by Phase 6 Cycle 1 + Cycle 5 audits: the
 * `/api/tables/:tableId/user-preferences` PATCH/PUT handler previously merged
 * the raw JSON body into the preferences row without any shape or enum check,
 * silently persisting garbage (e.g. `rowDensity: 'banana'`, `columnWidths: null`,
 * arrays where objects were expected) into the JSONB columns.
 *
 * Vocabulary contract (matches `src/presentation/api/routes/user-table-preferences.ts`):
 *
 *   - `rowDensity`     : 'compact' | 'normal' | 'spacious'
 *   - `columnWidths`   : Record<string, number>  (`{ [columnId]: widthPx }`)
 *   - `columnOrder`    : string[]                (display order of column ids)
 *   - `frozenColumns`  : number                  (leading columns to freeze)
 *   - `defaultViewId`  : string                  (loose FK to user-views.id)
 *
 * Every field is optional — PATCH semantics are upsert + merge: an absent key
 * keeps the current value. `.strict()` rejects unknown keys outright so malformed
 * clients fail loud rather than silently dropping data. The route accepts both
 * PATCH and PUT against the same handler, so this schema applies to both.
 */

/** Row-density enum mirrors the literal union used throughout the data-table island. */
export const rowDensitySchema = z.enum(['compact', 'normal', 'spacious'])

/**
 * Column-widths shape: a flat `{ [columnId]: widthPx }` record where every
 * value is a finite non-negative number. Disallows arrays and null (the two
 * silent-accept landmines documented above) by virtue of `z.record(...)`.
 *
 * Exported because a saved view can carry its OWN layout — the same shape,
 * scoped per-view instead of per-(user, table). Sharing the definition is what
 * keeps the two stores from drifting into accepting different garbage.
 */
export const columnWidthsSchema = z.record(z.string(), z.number().finite().nonnegative())

/**
 * PATCH body for `/api/tables/:tableId/user-preferences`.
 *
 * `.strict()` enforces the closed-world: unknown keys produce 400. Adding a
 * new preference key requires updating this schema AND the route's
 * `mergePreferences` builder in lockstep — that is the design.
 */
export const userTablePreferencesPatchSchema = z
  .object({
    rowDensity: rowDensitySchema.optional(),
    columnWidths: columnWidthsSchema.optional(),
    columnOrder: z.array(z.string()).optional(),
    frozenColumns: z.number().int().nonnegative().optional(),
    defaultViewId: z.string().optional(),
  })
  .strict()

/**
 * @public Wire-contract companion type to `userTablePreferencesPatchSchema`
 * (the live PATCH-body validator). Exported per the Zod single-source-of-truth
 * convention; the application
 * layer currently consumes the structurally-identical port interface.
 */
export type UserTablePreferencesPatch = z.infer<typeof userTablePreferencesPatchSchema>

/**
 * Response schema — Phase 8 Cycle 2.
 *
 * Single source of truth for the wire shape returned by the user-preferences
 * routes (GET / PATCH / PUT / DELETE — all four converge on the same envelope).
 * The route handler parses every `c.json(...)` payload through this schema so
 * the OpenAPI contract holds at runtime (S4 invariant: never return raw DB
 * rows; shape via `src/domain/models/api/` Zod schemas).
 *
 * Content fields are widened to permissive types for backward-compatibility
 * with rows persisted before Phase 7 Cycle 3 (PATCH-body validation). New
 * writes are gated by `userTablePreferencesPatchSchema`; the response schema
 * stays generous on read so a legacy malformed row does not 500 the GET path.
 */
export const userTablePreferencesResponseSchema = z.object({
  tableName: z.string(),
  columnWidths: z.unknown().optional(),
  columnOrder: z.unknown().optional(),
  rowDensity: z.string().optional(),
  defaultViewId: z.string().optional(),
  frozenColumns: z.number().optional(),
  updatedAt: z.string().optional(),
})

/**
 * @public Wire-contract companion type to `userTablePreferencesResponseSchema`
 * (the live response envelope validator). Exported per the Zod
 * single-source-of-truth convention; the application layer currently consumes
 * the structurally-identical port interface of the same name.
 */
export type UserTablePreferencesResponse = z.infer<typeof userTablePreferencesResponseSchema>
