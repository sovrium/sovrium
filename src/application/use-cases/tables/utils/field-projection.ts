/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { SELECTABLE_SYSTEM_FIELDS } from './list-helpers'
import type { App } from '@/domain/models/app'

/**
 * [internal ref]: turn a `?fields=` selection into the column list a `SELECT` may name.
 *
 * Field selection used to be a purely in-memory trim applied after `SELECT *`,
 * so nothing had to decide whether a requested name was addressable — the whole
 * row arrived either way. A projected select list has no such slack: naming a
 * column that does not exist on the read relation is a hard database error, and
 * omitting one the response pipeline needs is a silent wrong answer. Both
 * decisions live here.
 */

type SchemaField = {
  readonly name?: unknown
  readonly type?: unknown
  readonly relationType?: unknown
}

/**
 * Columns that must be projected whatever the caller asked for.
 *
 * `id` is the envelope's identity, the junction key the many-to-many read joins
 * on, and the key the `_aiCompute` status projection is built against. The two
 * timestamps sit at the ROOT of the envelope beside it — and their absence does
 * NOT raise: `transformRecord` falls back to `new Date().toISOString()`, so a
 * missed force-include here surfaces as a plausible-looking WRONG timestamp on
 * every row rather than as an error.
 *
 * Deliberately snake_case: these are raw column names, not the camelCase the
 * envelope publishes.
 */
const ALWAYS_PROJECTED = ['id', 'created_at', 'updated_at'] as const

/**
 * Optional system columns — projected when the table actually has them.
 *
 * Unlike {@link ALWAYS_PROJECTED} these are not created for every table:
 * `created_by` / `updated_by` / `deleted_by` exist only when the table declares
 * the matching authorship field, and `deleted_at` only when it is soft-delete
 * capable. Emitting `SELECT "created_by"` against a table without one is a hard
 * error, which is why the list is resolved against the live catalog in the
 * infrastructure layer rather than assumed here.
 */
const OPTIONAL_SYSTEM_COLUMNS = ['created_by', 'updated_by', 'deleted_by', 'deleted_at'] as const

/**
 * Whether a declared field is addressable on the relation a list reads.
 *
 * Three field shapes have no column there and must be STRIPPED rather than
 * force-included:
 *
 *   - `many-to-many` — its values live in a junction table and are supplied
 *     afterwards by `enrichRecordsWithManyToMany`;
 *   - `one-to-many` — the foreign key is on the RELATED table;
 *   - `button` — a UI-only action that stores nothing.
 *
 * ⚠️ `shouldCreateDatabaseColumn` is the neighbouring trap and must NOT be used
 * as this predicate. It agrees on those three but also returns `false` for
 * `count` — and `count`, like `lookup` and `rollup`, is a correlated expression
 * inside the VIEW that `shouldUseView` puts in front of the base table. Those
 * ARE columns on the relation being read, so excluding them would silently drop
 * data the caller explicitly asked for. The question here is "addressable on
 * the READ RELATION", not "backed by a stored base column".
 */
const isProjectableField = (field: SchemaField): boolean => {
  if (field.type === 'button') return false
  if (
    field.type === 'relationship' &&
    (field.relationType === 'one-to-many' || field.relationType === 'many-to-many')
  ) {
    return false
  }
  return true
}

/**
 * The columns a projected list should name, or `undefined` for `SELECT *`.
 *
 * `undefined` is returned whenever the projection cannot be adjudicated —
 * no `fields` selection, or a table this app does not declare. Falling back to
 * the whole row is the only safe reading: `export-handlers` and the MCP tool
 * call both list with no `fields` and expect every column.
 *
 * `groupBy` levels are force-included because `computeGroupPartitions` reads
 * the RAW row. A grouped column that was not projected produces `undefined`
 * group headers with no error at all.
 *
 * The optional system columns are appended as CANDIDATES; the infrastructure
 * layer intersects the whole list with the live catalog before it reaches a
 * select list, so a table lacking one simply does not get it.
 */
export const buildProjectionColumns = (config: {
  readonly app: App
  readonly tableName: string
  readonly fields?: string
  readonly groupBy?: string
}): readonly string[] | undefined => {
  const { app, tableName, fields, groupBy } = config
  if (!fields) return undefined

  const table = app.tables?.find((t) => t.name === tableName)
  if (!table) return undefined

  const projectable = new Set(
    table.fields.filter((field) => isProjectableField(field)).map((field) => field.name)
  )

  const named = (value: string | undefined): readonly string[] =>
    (value ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0 && !SELECTABLE_SYSTEM_FIELDS.has(name))
      .filter((name) => projectable.has(name))

  return [
    ...new Set([
      ...ALWAYS_PROJECTED,
      ...named(fields),
      ...named(groupBy),
      ...OPTIONAL_SYSTEM_COLUMNS,
    ]),
  ]
}
