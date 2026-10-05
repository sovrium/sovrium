/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which decoded tables carry an `id` their AUTHOR wrote.
 *
 * A table `id` is optional. When it is omitted the decoder fills it in by ARRAY
 * POSITION (`autoGenerateTableIds`), so after the decode every table has one and
 * nothing in the decoded value says which were written and which were guessed.
 * The difference decides whether a name change is a RENAME: an id the author
 * wrote is a claim that two config entries are the same table; an id assigned
 * by position is only an index, and reading it as identity is how deleting one
 * table and declaring another in its place moved every row of the first into the
 * second.
 *
 * ### Why a set beside the decoded config, and not a property
 *
 * The decode is where the evidence disappears, and the decoded table's shape is
 * the public `Table` type — a marker property would reach the API, the stored
 * snapshot and its checksum. So the one pipeline that holds both the document as
 * written and the decoded value (`decodeAppConfigObject`) returns, BESIDE the
 * decoded config, the set of table ids the author wrote, and every caller that
 * migrates or plans hands that set on explicitly.
 *
 * A set of IDS rather than of table objects: table ids are unique in a valid
 * config, and an id survives the copies made on the way to the migration
 * (`applySchemaDefaults`), where object identity did not — a copy once read as
 * "no id written", and `--dry-run` / `--watch` reported a rename as a drop.
 *
 * ### Which way it fails
 *
 * A caller that passes no set ({@link NO_AUTHORED_TABLE_IDS}) reads every id as
 * "not written": renames stop being detected, and the old table is then refused
 * as a populated drop, loudly, with nothing moved or lost. The opposite default
 * would fail by moving rows.
 */

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The ids of the tables whose `id` their author wrote (see the module note). */
export type AuthoredTableIds = ReadonlySet<number | string>

/** No id written — the fail-safe reading for a caller that has no decode at hand. */
export const NO_AUTHORED_TABLE_IDS: AuthoredTableIds = new Set()

/**
 * Positions (0-based) of the tables that declare an `id` in the document as
 * written. Anything that is not an array of objects declares none.
 */
export const authoredTableIdPositions = (raw: unknown): ReadonlySet<number> => {
  const tables = isRecord(raw) ? raw.tables : undefined
  if (!Array.isArray(tables)) return new Set()
  return new Set(
    tables.flatMap((table: unknown, index) =>
      isRecord(table) && table.id !== undefined ? [index] : []
    )
  )
}

/**
 * The ids of the decoded tables that carry an author-written `id`.
 *
 * `decodedTables` must be the decode of `raw.tables`, in the same order — the
 * decode never reorders or filters the array, so position is the join.
 */
export const authoredTableIds = (
  raw: unknown,
  decodedTables: readonly { readonly id?: number | string }[] | undefined
): AuthoredTableIds => {
  const positions = authoredTableIdPositions(raw)
  return new Set(
    (decodedTables ?? []).flatMap((table, index) =>
      positions.has(index) && table.id !== undefined ? [table.id] : []
    )
  )
}
