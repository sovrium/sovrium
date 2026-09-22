/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which of a table's fields are searchable as free text — the single definition
 * shared by the two sides of the command-palette search.
 *
 * It has to be one definition because the two sides must agree EXACTLY: the
 * application layer builds the `LIKE` predicate over these columns
 * (`use-cases/command-search.ts`), while the infrastructure layer builds the
 * full-text index over them at schema-reconciliation time
 * (`database/schema/command-search-fts.ts`). A column present in one list and
 * absent from the other is invisible to the hybrid `FTS ∩ LIKE` search: the
 * candidate gate never nominates the row, so the `LIKE` that would have matched
 * it is never asked. Two copies of this set drift silently and fail closed.
 */

/** Field types whose physical columns are searchable as text. */
export const TEXT_FIELD_TYPES: ReadonlySet<string> = new Set([
  'single-line-text',
  'long-text',
  'rich-text',
  'email',
  'url',
])

/** Minimal shape this module needs of a field — name plus type. */
interface NamedTypedField {
  readonly name: string
  readonly type: string
}

/** The intrinsic primary-key column the DDL layer adds unless told otherwise. */
const ID_COLUMN = 'id'

/**
 * Whether the table physically carries the intrinsic `id` column.
 *
 * It usually does — the DDL layer adds one automatically — but NOT when the
 * config declares a COMPOSITE primary key over other fields and no `id` field of
 * its own. Every structure in the command-palette search keys on `id`: the
 * SQLite FTS mirror stores it, the sync triggers read `new."id"`, and the
 * palette's own `SELECT id` reads it back.
 *
 * Getting this wrong would be far worse than a missing index. SQLite compiles a
 * trigger body when the triggering STATEMENT is prepared, not when the trigger
 * is created, so a trigger over a nonexistent `new."id"` is accepted quietly and
 * then fails every INSERT into that table with `no such column: new.id` — a
 * search accelerator would have broken writes.
 *
 * ## Why the rule is restated here rather than imported
 *
 * The authority is `needsAutomaticIdColumn` in
 * `infrastructure/database/table-operations/column-generators.ts`, and importing
 * it from the schema reconciler introduced a MODULE CYCLE that left
 * `INTRINSIC_ID_COLUMN` in its temporal dead zone at call time — every app with
 * tables died at boot with `ReferenceError: INTRINSIC_ID_COLUMN is not defined`.
 * The rule is three lines; the cycle was a startup crash. Parity with the
 * authority is pinned by a test rather than by an import — see
 * `infrastructure/database/schema/command-search-fts.test.ts`, which imports
 * both and asserts they agree.
 */
export const tableHasIdColumn = (table: {
  readonly fields: readonly NamedTypedField[]
  readonly primaryKey?: { readonly type?: string; readonly fields?: readonly string[] }
}): boolean => {
  if (table.fields.some((field) => field.name === ID_COLUMN)) return true
  const primaryKeyFields =
    table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []
  // A composite key over other columns suppresses the automatic `id`; one that
  // includes `id` still gets it.
  return primaryKeyFields.length === 0 || primaryKeyFields.includes(ID_COLUMN)
}

/**
 * The text column names of a table that are searchable as text, in declaration
 * order. Declaration order is load-bearing downstream: the palette's `__label`
 * expression is `COALESCE(<these columns>)`, so reordering them changes which
 * column a result is labelled from.
 */
export const searchableTextColumns = (
  fields: readonly NamedTypedField[] | undefined
): readonly string[] =>
  (fields ?? []).filter((field) => TEXT_FIELD_TYPES.has(field.type)).map((field) => field.name)
