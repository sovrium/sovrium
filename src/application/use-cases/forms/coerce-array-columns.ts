/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Coerce scalar values to single-element arrays for columns that PostgreSQL
 * stores as `text[]` (currently: `multi-select`).
 *
 * Background (Y-5 follow-up): native HTML `<select>` widgets (without the
 * `multiple` attribute) always submit exactly one value, even for columns
 * that the schema describes as `multi-select`. The browser form-encodes
 * `tags=urgent`, Hono's `parseBody({ all: true })` surfaces it as the
 * scalar string `'urgent'`, and `buildInsertClauses` then routes the value
 * through the regular scalar bind path — which produces
 * `INSERT INTO tickets (tags) VALUES ('urgent')`. PostgreSQL rejects that
 * with `malformed array literal: "urgent"` because the column is `text[]`.
 *
 * The fix is purely defensive: if the form submission contains a scalar
 * (string / number / boolean) for a column declared as `multi-select`,
 * wrap it in a single-element array before handing off to the table
 * write. Real multi-value submissions (rendered as N hidden inputs OR
 * via `<select multiple>`) already arrive as `string[]` and pass through
 * untouched.
 *
 * `null` / `undefined` values are intentionally left alone: those mean
 * "no value submitted" and the table layer encodes them correctly.
 *
 * Only `multi-select` is coerced here. `multiple-attachments` is backed
 * by JSONB and `buildInsertClauses` falls back to `jsonbLiteral` for
 * unknown shapes, which accepts both scalars and arrays without throwing,
 * so a separate path is unnecessary for the foundation tier.
 */

import type { App } from '@/domain/models/app'

/**
 * Column types whose storage is `text[]` and that therefore need scalar
 * submissions wrapped in single-element arrays before reaching the SQL
 * INSERT path. Kept as a `Set` so adding future array-typed columns
 * (e.g. a hypothetical `tag-list` type) is a one-line change.
 */
const ARRAY_TYPED_COLUMN_TYPES: ReadonlySet<string> = new Set(['multi-select'])

/**
 * Loose shape of a table field — kept structural so this helper does not
 * have to depend on the heavily-branded `TableField` discriminated union.
 * `app.tables[].fields` is statically typed by the domain layer, so the
 * cast at the call site is sound.
 */
interface TableFieldShape {
  readonly name: string
  readonly type: string
}

/**
 * Return the set of column names on `tableName` whose declared type is
 * one of {@link ARRAY_TYPED_COLUMN_TYPES}. Empty set when the table is
 * unknown or has no array-typed columns — the caller then short-circuits
 * to a no-op.
 */
const collectArrayTypedColumnNames = (
  app: Readonly<App>,
  tableName: string
): ReadonlySet<string> => {
  const table = app.tables?.find((t) => t.name === tableName)
  if (table === undefined) return new Set()
  const fields = (table.fields ?? []) as ReadonlyArray<TableFieldShape>
  const names = fields
    .filter((field) => ARRAY_TYPED_COLUMN_TYPES.has(field.type))
    .map((field) => field.name)
  return new Set(names)
}

/**
 * Wrap scalar values targeting array-typed columns in single-element
 * arrays. Pass-through for: values already shaped as arrays, columns not
 * declared as array-typed, and `null` / `undefined` (treated as absent).
 *
 * Pure / synchronous so it composes cleanly with the existing
 * pre-INSERT filter chain in `submit-form.ts::persistSubmission`.
 */
export const coerceScalarsForArrayColumns = (
  fields: Readonly<Record<string, unknown>>,
  app: Readonly<App>,
  tableName: string
): Readonly<Record<string, unknown>> => {
  const arrayColumns = collectArrayTypedColumnNames(app, tableName)
  if (arrayColumns.size === 0) return { ...fields }
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]): readonly [string, unknown] => {
      if (!arrayColumns.has(key)) return [key, value]
      if (value === null || value === undefined) return [key, value]
      if (Array.isArray(value)) return [key, value]
      return [key, [value]]
    })
  )
}
