/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The many-to-many link tables a table rename carries along.
 *
 * A many-to-many relationship keeps its links in a table named from the
 * DATABASE names of both ends, source first (`orders_clients`), whose key
 * columns are the singular of each end (`order_id`, `client_id`) and whose
 * PostgreSQL constraints are named after the link table and its columns
 * (`orders_clients_order_id_fkey`, `orders_clients_pkey`). Renaming either end
 * under its `id` therefore changes the name a fresh boot would give every one
 * of those. Left alone, the old link table is a table the config no longer
 * accounts for — a populated one, so the boot refused the rename — and the
 * relationship reads an empty new one.
 *
 * Pure, like `planTableRenames`: the caller supplies the live table names.
 */

import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { shouldUseView } from '../lookup/lookup-view-generators'
import { isManyToManyRelationship } from '../sql/sql-field-predicates'
import {
  generateJunctionTableDDL,
  generateJunctionTableName,
  junctionKeyColumns,
} from '../sql/sql-junction-tables'
import type { Table } from '@/domain/models/app/tables'

/** A link table's two ends, as CONFIG names, source first. */
type LinkEnds = readonly [source: string, related: string]

/** One key column of a link table: its name today and the one it becomes. */
type KeyColumn = readonly [before: string, after: string]

/** One link table to carry: its relation today, the one it becomes, and how. */
export interface LinkTableRename {
  readonly from: string
  readonly to: string
  readonly statements: readonly string[]
}

/** What a link table's move needs to know beyond its two names. */
interface LinkMove {
  readonly from: string
  readonly to: string
  readonly ends: LinkEnds
  readonly columns: readonly [KeyColumn, KeyColumn]
  readonly tableUsesView: ReadonlyMap<string, boolean>
}

/**
 * Every link table the config's many-to-many fields account for, in BOTH
 * directions: the engine creates `<source>_<related>`, and the reciprocal side
 * of the same relationship may be the one the config declares (the same reading
 * `expectedPhysicalTableNames` makes).
 */
const linkEndsOf = (tables: readonly Table[]): readonly LinkEnds[] =>
  tables.flatMap((table) =>
    table.fields.filter(isManyToManyRelationship).flatMap((field): readonly LinkEnds[] => [
      [table.name, field.relatedTable],
      [field.relatedTable, table.name],
    ])
  )

const quoted = quoteSqlIdentifier

/**
 * PostgreSQL: rename in place. Postgres follows the parent tables by OID, so
 * the table, its key columns and the constraint names a fresh boot would give
 * it (its primary key and one foreign key per end) are all it takes.
 */
const renameInPlace = ({ from, to, columns }: LinkMove): readonly string[] => [
  `ALTER TABLE ${quoted(from)} RENAME TO ${quoted(to)}`,
  ...columns
    .filter(([before, after]) => before !== after)
    .map(
      ([before, after]) =>
        `ALTER TABLE ${quoted(to)} RENAME COLUMN ${quoted(before)} TO ${quoted(after)}`
    ),
  `ALTER TABLE ${quoted(to)} RENAME CONSTRAINT ${quoted(`${from}_pkey`)} TO ${quoted(`${to}_pkey`)}`,
  ...columns.map(
    ([before, after]) =>
      `ALTER TABLE ${quoted(to)} RENAME CONSTRAINT ${quoted(`${from}_${before}_fkey`)} TO ${quoted(`${to}_${after}_fkey`)}`
  ),
]

/**
 * SQLite: build the link table a fresh boot would build, copy the links, drop
 * the old one. An in-place rename is not enough there: the schema step runs
 * with foreign keys off and Bun's SQLite in `legacy_alter_table` mode, where
 * renaming a PARENT table leaves the link table's `REFERENCES` naming the old
 * one — the closing `foreign_key_check` then reads every link as orphaned —
 * and a `RENAME COLUMN` after it fails outright (`SQL logic error`) on the
 * renamed table's stale trigger body. The new table references the parents by
 * their new names; with foreign keys off it may be created before they exist.
 */
const rebuild = ({ from, to, ends, columns, tableUsesView }: LinkMove): readonly string[] => [
  generateJunctionTableDDL(ends[0], ends[1], tableUsesView),
  `INSERT INTO ${quoted(to)} (${columns.map(([, after]) => quoted(after)).join(', ')}) ` +
    `SELECT ${columns.map(([before]) => quoted(before)).join(', ')} FROM ${quoted(from)}`,
  `DROP TABLE ${quoted(from)}`,
]

/** The move of one link table whose end(s) changed name, or nothing. */
const planOne = (
  ends: LinkEnds,
  previousName: (configName: string) => string,
  existing: ReadonlySet<string>,
  tableUsesView: ReadonlyMap<string, boolean>
): readonly LinkTableRename[] => {
  const [source, related] = ends
  const before: LinkEnds = [previousName(source), previousName(related)]
  const from = generateJunctionTableName(before[0], before[1])
  const to = generateJunctionTableName(source, related)
  // Nothing to carry, or somewhere it cannot go: an existing target is left
  // alone, and the old table then meets the populated-drop refusal.
  if (from === to || !existing.has(from) || existing.has(to)) return []
  const [sourceBefore, relatedBefore] = junctionKeyColumns(before[0], before[1])
  const [sourceAfter, relatedAfter] = junctionKeyColumns(source, related)
  const move: LinkMove = {
    from,
    to,
    ends,
    columns: [
      [sourceBefore, sourceAfter],
      [relatedBefore, relatedAfter],
    ],
    tableUsesView,
  }
  return [{ from, to, statements: isSqliteRuntime() ? rebuild(move) : renameInPlace(move) }]
}

/**
 * The link tables to carry for `renames` (old CONFIG name → new), given the
 * config's `tables` and the live table names: each link table with an end
 * that was renamed moves to the name derived from the new names, its key
 * columns (and on PostgreSQL its constraint names) with it, rows kept.
 */
export const planLinkTableRenames = (
  renames: ReadonlyMap<string, string>,
  tables: readonly Table[],
  existing: ReadonlySet<string>
): readonly LinkTableRename[] => {
  if (renames.size === 0) return []
  const previousByNew = new Map([...renames].map(([oldName, newName]) => [newName, oldName]))
  const previousName = (configName: string): string => previousByNew.get(configName) ?? configName
  const tableUsesView = new Map(tables.map((table) => [table.name, shouldUseView(table)]))
  const planned = linkEndsOf(tables).flatMap((ends) =>
    planOne(ends, previousName, existing, tableUsesView)
  )
  // Two fields between the same pair of tables share one link table.
  return planned.filter(
    (link, index) => planned.findIndex((other) => other.from === link.from) === index
  )
}
