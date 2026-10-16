/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The links that point AT a table: every relationship field of another table
 * whose `relatedTable` is this one.
 *
 * A record sheet that declares no `related` sections lists, under the record,
 * the records of other tables that link to it — a quote shows the site visits
 * booked against it without anyone writing that down. This is the derivation,
 * in the order the config declares the tables and, within a table, its fields.
 *
 * A table linking to ITSELF is left out: its records are the sheet's own kind,
 * reached from the grid the sheet was opened from, and listing them under each
 * other would read as a second copy of that grid.
 */

/** The parts of a table this module reads. */
export interface RelationSourceTable {
  readonly name: string
  readonly fields: ReadonlyArray<{
    readonly name: string
    readonly type: string
    readonly relatedTable?: string | undefined
  }>
}

/** One link pointing at the table: the table it lives on and its field there. */
export interface ReverseRelation {
  readonly table: string
  readonly field: string
}

/** Every relationship field of another table that targets `tableName`. */
export const reverseRelationsOf = (
  tableName: string,
  tables: readonly RelationSourceTable[] | undefined
): readonly ReverseRelation[] =>
  (tables ?? [])
    .filter((table) => table.name !== tableName)
    .flatMap((table) =>
      table.fields
        .filter((field) => field.type === 'relationship' && field.relatedTable === tableName)
        .map((field) => ({ table: table.name, field: field.name }))
    )
