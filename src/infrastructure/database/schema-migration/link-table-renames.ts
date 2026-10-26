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
  generateJunctionConstraintRenameSQL,
  generateJunctionTableDDL,
  generateJunctionTableName,
  isLiveRelation,
  junctionKeyColumns,
} from '../sql/sql-junction-tables'
import { buildTablePrimaryKeyTypesMap } from '../table-operations/column-generators'
import type { Table } from '@/domain/models/app/tables'
import type {
  LinkField,
  LinkSourceTable,
} from '@/domain/models/app/tables/table-derived-name-validation'

/**
 * A link table's two ends, as CONFIG names: the table declaring the field (with
 * its fields, which its link table's name depends on) and the field.
 */
type LinkEnds = { readonly source: LinkSourceTable; readonly field: LinkField }

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
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
}

/**
 * Every link table the config's many-to-many fields account for: each field's
 * own, and the one named after the two tables the other way round — the
 * reciprocal side of the same relationship may be the one the config declares
 * (the same reading `expectedPhysicalTableNames` makes).
 */
const linkEndsOf = (tables: readonly Table[]): readonly LinkEnds[] =>
  tables.flatMap((table) =>
    table.fields.filter(isManyToManyRelationship).flatMap((field): readonly LinkEnds[] => [
      { source: table, field },
      { source: { name: field.relatedTable }, field: { name: '', relatedTable: table.name } },
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
  ...(constraintNamesFit({ from, to, columns })
    ? [
        `ALTER TABLE ${quoted(to)} RENAME CONSTRAINT ${quoted(`${from}_pkey`)} TO ${quoted(`${to}_pkey`)}`,
        ...columns.map(
          ([before, after]) =>
            `ALTER TABLE ${quoted(to)} RENAME CONSTRAINT ${quoted(`${from}_${before}_fkey`)} TO ${quoted(`${to}_${after}_fkey`)}`
        ),
      ]
    : generateJunctionConstraintRenameSQL(from, to, columns)),
]

/**
 * Whether every constraint name of the move fits PostgreSQL's 63 characters,
 * before and after: then each is the name a fresh boot gave it. A longer one
 * was cut, or fitted, so the catalog is asked for it instead.
 */
const constraintNamesFit = ({ from, to, columns }: Pick<LinkMove, 'from' | 'to' | 'columns'>) =>
  [
    `${from}_pkey`,
    `${to}_pkey`,
    ...columns.flatMap(([before, after]) => [`${from}_${before}_fkey`, `${to}_${after}_fkey`]),
  ].every((name) => name.length <= 63)

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
const rebuild = ({
  from,
  to,
  ends,
  columns,
  tableUsesView,
  tablePrimaryKeyTypes,
}: LinkMove): readonly string[] => [
  generateJunctionTableDDL(ends.source, ends.field, tableUsesView, tablePrimaryKeyTypes),
  `INSERT INTO ${quoted(to)} (${columns.map(([, after]) => quoted(after)).join(', ')}) ` +
    `SELECT ${columns.map(([before]) => quoted(before)).join(', ')} FROM ${quoted(from)}`,
  `DROP TABLE ${quoted(from)}`,
]

/** The move of one link table whose end(s) changed name, or nothing. */
const planOne = (
  ends: LinkEnds,
  previousName: (configName: string) => string,
  existing: ReadonlySet<string>,
  views: Pick<LinkMove, 'tableUsesView' | 'tablePrimaryKeyTypes'>
): readonly LinkTableRename[] => {
  const { source, field } = ends
  const before: LinkEnds = {
    source: {
      name: previousName(source.name),
      fields: (source.fields ?? []).map((other) =>
        other.relatedTable === undefined
          ? other
          : { ...other, relatedTable: previousName(other.relatedTable) }
      ),
    },
    field: { name: field.name, relatedTable: previousName(field.relatedTable) },
  }
  const from = generateJunctionTableName(before.source, before.field)
  const to = generateJunctionTableName(source, field)
  // Nothing to carry, or somewhere it cannot go: an existing target is left
  // alone, and the old table then meets the populated-drop refusal.
  if (from === to || !isLiveRelation(existing, from) || isLiveRelation(existing, to)) return []
  const [sourceBefore, relatedBefore] = junctionKeyColumns(
    before.source.name,
    before.field.relatedTable
  )
  const [sourceAfter, relatedAfter] = junctionKeyColumns(source.name, field.relatedTable)
  const move: LinkMove = {
    from,
    to,
    ends,
    columns: [
      [sourceBefore, sourceAfter],
      [relatedBefore, relatedAfter],
    ],
    ...views,
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
  const views = {
    tableUsesView: new Map(tables.map((table) => [table.name, shouldUseView(table)])),
    tablePrimaryKeyTypes: buildTablePrimaryKeyTypesMap(tables),
  }
  const planned = linkEndsOf(tables).flatMap((ends) => planOne(ends, previousName, existing, views))
  // A link table named after the two tables is reached from both of them.
  return planned.filter(
    (link, index) => planned.findIndex((other) => other.from === link.from) === index
  )
}
