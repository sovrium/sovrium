/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which physical tables in the database the CONFIG owns.
 *
 * The config names tables; the engine materialises more relations than it names.
 * A table carrying a `lookup`, `rollup` or `count` field keeps its rows in
 * `<name>_base` behind a `<name>` VIEW, and a many-to-many relationship keeps its
 * links in a junction table `<source>_<related>`. None of those physical names
 * appears in `app.tables`, so a comparison against config names alone classifies
 * every one of them as a leftover — so a full migration would drop, then
 * re-create EMPTY, every view-backed table and every junction table in the app.
 *
 * Pure: the caller reads the live table list and decides what to do with the
 * obsolete set (count its rows, refuse, drop).
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { getBaseTableName, shouldUseView } from '../lookup/lookup-view-generators'
import { SQLITE_FTS_PREFIX } from '../schema/command-search-fts-ddl'
import { isManyToManyRelationship } from '../sql/sql-field-predicates'
import { generateJunctionTableName } from '../sql/sql-junction-tables'
import type { Table } from '@/domain/models/app/tables'

/** The suffix a view-backed table's physical relation carries. */
const BASE_SUFFIX = getBaseTableName('')

/**
 * Every physical table name the config accounts for: each config table, the
 * `<name>_base` of each view-backed one, and each many-to-many junction table in
 * BOTH directions — the engine creates `<source>_<related>`, and the reciprocal
 * side of the same relationship may be the one the config declares.
 */
export const expectedPhysicalTableNames = (tables: readonly Table[]): ReadonlySet<string> =>
  new Set(
    tables.flatMap((table) => {
      const sanitized = sanitizeTableName(table.name)
      const junctions = table.fields.filter(isManyToManyRelationship).flatMap((field) => [
        generateJunctionTableName(table.name, field.relatedTable),
        generateJunctionTableName(field.relatedTable, table.name),
        // The spelling an older engine created from the CONFIG names. SQLite
        // keeps a name's case (`Projects_tags`), and matches it
        // case-insensitively, so such a junction is still this one.
        `${table.name}_${field.relatedTable}`,
        `${field.relatedTable}_${table.name}`,
      ])
      return [
        table.name,
        sanitized,
        ...(shouldUseView(table) ? [getBaseTableName(sanitized)] : []),
        ...junctions,
      ]
    })
  )

/**
 * Whether `tableName` is the `_base` relation of a table the config declares.
 *
 * Decided on the STRIPPED owner, never on the suffix alone: `<name>_base` is kept
 * whenever `<name>` is a config table, view-backed or not. That covers the
 * view-backed → plain transition (the base table still holds the rows until the
 * topology step renames it back), and it does not protect an unrelated table the
 * author happened to name `archive_base`, whose owner `archive` is not declared.
 */
const isBaseOfConfigTable = (tableName: string, configNames: ReadonlySet<string>): boolean =>
  tableName.endsWith(BASE_SUFFIX) &&
  tableName.length > BASE_SUFFIX.length &&
  configNames.has(tableName.slice(0, -BASE_SUFFIX.length))

/**
 * Split the database's physical tables into those the config owns and those it
 * no longer declares.
 *
 * Order is preserved within each list, so a caller's drop statements follow the
 * catalog's order exactly as before.
 */
export const classifyPhysicalTables = (
  existing: readonly string[],
  tables: readonly Table[]
): { readonly keep: readonly string[]; readonly obsolete: readonly string[] } => {
  const expected = expectedPhysicalTableNames(tables)
  const configNames = new Set(
    tables.flatMap((table) => [table.name, sanitizeTableName(table.name)])
  )
  const owned = (name: string): boolean =>
    expected.has(name) || isBaseOfConfigTable(name, configNames)
  return {
    keep: existing.filter(owned),
    obsolete: existing.filter((name) => !owned(name)),
  }
}

/**
 * Whether `tableName` belongs to the command palette's SQLite search index: the
 * `fts__<relation>` FTS5 virtual table and its shadow tables.
 *
 * Engine-owned and derived — every row is rebuilt from the table it mirrors by
 * `reconcileCommandSearchIndexes` after each migration — so its row count says
 * nothing about data an operator could lose, and a drop of it must never be
 * refused or reported as one. The prefix is imported from
 * `command-search-fts-ddl.ts`, which reserves it — never a copy of the literal.
 * No config table can land in it: `sanitizeTableName` collapses `__` to `_`, so
 * a user table's physical name never starts with `fts__`.
 */
export const isCommandSearchIndexTable = (tableName: string): boolean =>
  tableName.startsWith(SQLITE_FTS_PREFIX)

/** The shadow tables SQLite keeps beside every FTS5 virtual table, by suffix. */
const FTS5_SHADOW_SUFFIXES = ['data', 'idx', 'content', 'docsize', 'config'] as const

/**
 * Whether `tableName` is an FTS5 shadow table — `<virtual>_<suffix>` — of one of
 * `virtualTables`. SQLite refuses to drop such a table on its own; dropping its
 * virtual table removes it.
 */
export const isFts5ShadowTable = (tableName: string, virtualTables: ReadonlySet<string>): boolean =>
  FTS5_SHADOW_SUFFIXES.some(
    (suffix) =>
      tableName.endsWith(`_${suffix}`) &&
      virtualTables.has(tableName.slice(0, -(suffix.length + 1)))
  )

/**
 * The tables of `tableNames` to DROP, in an order SQLite accepts: virtual tables
 * first, then the rest, and never a shadow table of a virtual one — it goes with
 * its virtual table, or stays with it when that one is kept. `virtualTables` is
 * `[]` on PostgreSQL, where this returns `tableNames` unchanged.
 *
 * The catalog order is not that order: `VACUUM INTO`, which writes every backup,
 * lists the shadow tables BEFORE their virtual table, so a database restored from
 * one (or vacuumed by its operator) dropped in catalog order stops at the first
 * shadow. Order is otherwise preserved within each group.
 */
export const sqliteDropOrder = (
  tableNames: readonly string[],
  virtualTables: readonly string[]
): readonly string[] => {
  const virtual = new Set(virtualTables)
  const droppable = tableNames.filter((name) => !isFts5ShadowTable(name, virtual))
  return [
    ...droppable.filter((name) => virtual.has(name)),
    ...droppable.filter((name) => !virtual.has(name)),
  ]
}

/** `1 row`, `3 rows` — the count as an operator reads it. */
export const formatRowCount = (rows: number): string => `${rows} ${rows === 1 ? 'row' : 'rows'}`

/**
 * A stored many-to-many link table: the two CONFIG tables whose relationship it
 * held, source first, as the stored schema recorded them.
 */
export interface StoredLinkTable {
  readonly linkOf: readonly [source: string, related: string]
}

/**
 * What the stored schema says a physical table was: the `id` of the config table
 * whose rows it held, or the relationship whose links it held.
 */
export type StoredTableIdentity = number | string | StoredLinkTable

/** The relationship `physicalTable` held the links of, per the stored schema. */
const storedLinkTableFor = (
  physicalTable: string,
  storedTables: readonly object[]
): StoredLinkTable | undefined =>
  storedTables
    .flatMap((table: object): readonly StoredLinkTable[] => {
      if (!('name' in table) || typeof table.name !== 'string') return []
      if (!('fields' in table) || !Array.isArray(table.fields)) return []
      const source = table.name
      return (table.fields as readonly unknown[]).flatMap((field): readonly StoredLinkTable[] => {
        const link = field as { readonly relationType?: unknown; readonly relatedTable?: unknown }
        if (link.relationType !== 'many-to-many' || typeof link.relatedTable !== 'string') return []
        const related = link.relatedTable
        return generateJunctionTableName(source, related) === physicalTable ||
          generateJunctionTableName(related, source) === physicalTable
          ? [{ linkOf: [source, related] }]
          : []
      })
    })
    .at(0)

/**
 * What the stored schema snapshot says `physicalTable` was: the `id` it recorded
 * for the table whose rows live there — the table itself, or the `<name>_base`
 * behind a view-backed one — or, for a many-to-many link table, the
 * relationship whose links it held. `undefined` when the snapshot is absent or
 * holds neither.
 */
export const storedTableIdentityFor = (
  physicalTable: string,
  previousSchema: { readonly tables: readonly object[] } | undefined
): StoredTableIdentity | undefined => {
  const storedTables = previousSchema?.tables ?? []
  const stored = storedTables.find((table: object) => {
    if (!('name' in table) || typeof table.name !== 'string') return false
    const name = sanitizeTableName(table.name)
    return physicalTable === name || physicalTable === getBaseTableName(name)
  }) as { readonly id?: unknown } | undefined
  if (typeof stored?.id === 'number' || typeof stored?.id === 'string') return stored.id
  return stored === undefined ? storedLinkTableFor(physicalTable, storedTables) : undefined
}

/** How the stored id is written in a config: `id: 3`, `id: 'catalog'`. */
const formatIdDeclaration = (id: number | string): string =>
  typeof id === 'number' ? `id: ${id}` : `id: '${id}'`

/** The plan-then-consent sentence every drop refusal ends with. */
const DESTRUCTIVE_CONSENT =
  `read the plan with \`sovrium migrate <config> --dry-run\` and apply it with ` +
  `\`sovrium migrate <config> --allow-destructive\`.`

/**
 * The refusal for a link table. Its likeliest cause is not a table renamed
 * without an id — a link table is never declared, so "declare it with its id"
 * would point at nothing — but a table at either END renamed without one (a
 * rename under an id carries its link tables), or the relationship removed.
 */
const formatPopulatedLinkDropRefusal = (
  tableName: string,
  rows: number,
  { linkOf: [source, related] }: StoredLinkTable
): string =>
  `Refusing to drop table ${tableName} (${formatRowCount(rows)}): it holds the links of the ` +
  `many-to-many relationship between ${source} and ${related}, which the config no longer ` +
  `declares under those names, and dropping it would delete them. Starting the app never ` +
  `drops a populated table. A table renamed under the \`id\` it was stored under takes its ` +
  `link tables with it, so if ${source} or ${related} was renamed, declare it with that ` +
  `\`id\`. If the relationship was removed on purpose, ${DESTRUCTIVE_CONSENT}`

/**
 * Why a drop of a populated obsolete table is refused, in the words every
 * surface uses — the boot, `sovrium migrate`, `--dry-run` and `--check` all
 * print this sentence, so the operator reads one refusal wherever they meet it.
 *
 * It also answers the likeliest reason the table left the config: it was
 * renamed. Only an id written in the config makes a name change a rename, so
 * a table renamed without one arrives here, and the refusal says which `id`
 * keeps it — the one the stored schema recorded, when there is one. A
 * many-to-many link table gets its own wording (see
 * {@link formatPopulatedLinkDropRefusal}).
 */
export const formatPopulatedDropRefusal = (
  tableName: string,
  rows: number,
  stored?: StoredTableIdentity
): string =>
  typeof stored === 'object'
    ? formatPopulatedLinkDropRefusal(tableName, rows, stored)
    : `Refusing to drop table ${tableName} (${formatRowCount(rows)}): the config no longer ` +
      `declares it, and dropping it would delete its rows. Starting the app never drops a ` +
      `populated table. If a table in the config is ${tableName} under a new name, declare it ` +
      (stored === undefined
        ? `with the \`id\` it was stored under: `
        : `with \`${formatIdDeclaration(stored)}\`: `) +
      `only an id written in the config makes a name change a rename. Otherwise keep the ` +
      `table in the config, or ${DESTRUCTIVE_CONSENT}`
