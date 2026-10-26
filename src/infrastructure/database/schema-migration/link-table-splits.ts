/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Giving each many-to-many field its own link table.
 *
 * A field that is the only many-to-many from its table to the related one
 * keeps `<table>_<related>`; once two or more fields of one table point at the
 * same table, each stores its links in `<table>_<related>_<field>`
 * (`deriveFieldLinkTableName`). An earlier version stored every such field's
 * links in the one `<table>_<related>`, with nothing recording which field
 * wrote a link. This step moves the links a database already holds to the
 * tables the config now names, before the tables the config no longer
 * accounts for are dropped:
 *
 *  - the stored schema says ONE field used the shared table (a second field
 *    was just added): its links belong to that field, found by id and else by
 *    name, and move to that field's own table. The new field starts empty;
 *  - the stored schema is absent, or says two or more fields shared it: the
 *    links cannot be told apart, so every field that shares it receives a
 *    copy, the shared table is dropped once the copies are written, and the
 *    start prints a warning naming the table, the fields and the number of
 *    links for a person to review. No link is lost, and no field shows a link
 *    it did not show before;
 *  - a field left alone again (its sibling removed) moves its own table back
 *    to `<table>_<related>`;
 *  - a field renamed under its id beside a sibling moves its own table to the
 *    name its new name derives.
 *
 * Key column names never change. PostgreSQL renames a move in place (the
 * parents are followed by OID); SQLite builds the new table, copies, and drops
 * the old one, as `link-table-renames.ts` does and for the same reasons. A
 * copy on PostgreSQL is created `LIKE` the shared table — the link table's
 * foreign keys are put back after the tables are migrated
 * (`generateJunctionForeignKeyRestoreSQL`), when every parent exists under its
 * final name.
 *
 * Read from the config and the live tables, never from the checksum: an
 * upgraded binary started on a config that did not change must split too.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { deriveLinkTableName } from '@/domain/models/app/tables/table-derived-name-validation'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { logWarning } from '@/infrastructure/logging/logger'
import { shouldUseView } from '../lookup/lookup-view-generators'
import {
  executeSQLStatements,
  getExistingTableNames,
  type SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { isManyToManyRelationship } from '../sql/sql-field-predicates'
import {
  generateJunctionConstraintRenameSQL,
  generateJunctionTableDDL,
  generateJunctionTableName,
  isLiveRelation,
  junctionKeyColumns,
} from '../sql/sql-junction-tables'
import { buildTablePrimaryKeyTypesMap } from '../table-operations/column-generators'
import { countTableRows } from './table-operations'
import type { Table } from '@/domain/models/app/tables'

/** A many-to-many field of the config, with the table declaring it. */
type LinkField = {
  readonly table: Table
  readonly field: Table['fields'][number] & { readonly relatedTable: string }
}

/** One link table to move or copy, and how. */
export interface LinkTableSplit {
  /** The link table the links are stored in today. */
  readonly from: string
  /** The link table of each field receiving them. */
  readonly to: readonly string[]
  /** The table and fields that shared `from`, when the links are copied to each of them. */
  readonly review?: { readonly table: string; readonly fields: readonly string[] }
  readonly statements: readonly string[]
}

/** How the moves and copies build a link table: the DDL inputs every target shares. */
interface DdlContext {
  readonly tableUsesView: ReadonlyMap<string, boolean>
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
}

const quoted = quoteSqlIdentifier

/** A stored field, as the snapshot recorded it. */
type StoredField = {
  readonly id?: unknown
  readonly name?: unknown
  readonly relationType?: unknown
  readonly relatedTable?: unknown
}

/** The stored table `table` was, by its id, else by its name. */
const storedTableOf = (
  table: Table,
  previousSchema: { readonly tables: readonly object[] } | undefined
): { readonly fields?: readonly StoredField[] } | undefined =>
  (previousSchema?.tables as readonly { id?: unknown; name?: unknown; fields?: unknown }[])
    ?.filter((stored) => Array.isArray(stored.fields))
    .find((stored) =>
      table.id !== undefined && stored.id !== undefined
        ? stored.id === table.id
        : stored.name === table.name
    ) as { readonly fields?: readonly StoredField[] } | undefined

/** The stored many-to-many fields of `table` to the table stored as `related`. */
const storedLinksTo = (
  table: Table,
  related: string,
  previousSchema: { readonly tables: readonly object[] } | undefined
): readonly StoredField[] | undefined => {
  const stored = storedTableOf(table, previousSchema)
  if (stored === undefined) return undefined
  return (stored.fields ?? []).filter(
    (field) =>
      field.relationType === 'many-to-many' &&
      typeof field.relatedTable === 'string' &&
      sanitizeTableName(field.relatedTable) === related
  )
}

/** The current field the one stored field is: same id, else same name. */
const currentFieldOf = (stored: StoredField, fields: readonly LinkField[]): LinkField | undefined =>
  fields.find((candidate) => stored.id !== undefined && candidate.field.id === stored.id) ??
  fields.find((candidate) => candidate.field.name === stored.name)

/** The two key columns a link of `link` is stored under. */
const keyColumnsOf = ({ table, field }: LinkField): string =>
  junctionKeyColumns(table.name, field.relatedTable).map(quoted).join(', ')

/** Move `from` to `link`'s own table, rows kept. */
const moveStatements = (from: string, link: LinkField, ddl: DdlContext): readonly string[] => {
  const to = generateJunctionTableName(link.table, link.field)
  if (isSqliteRuntime()) {
    return [
      generateJunctionTableDDL(link.table, link.field, ddl.tableUsesView, ddl.tablePrimaryKeyTypes),
      `INSERT INTO ${quoted(to)} (${keyColumnsOf(link)}) SELECT ${keyColumnsOf(link)} FROM ${quoted(from)}`,
      `DROP TABLE ${quoted(from)}`,
    ]
  }
  const columns = junctionKeyColumns(link.table.name, link.field.relatedTable)
  return [
    `ALTER TABLE ${quoted(from)} RENAME TO ${quoted(to)}`,
    ...generateJunctionConstraintRenameSQL(
      from,
      to,
      columns.map((column) => [column, column] as const)
    ),
  ]
}

/** Copy every link of `from` into each field's own table, then drop `from`. */
const copyStatements = (
  from: string,
  links: readonly LinkField[],
  ddl: DdlContext
): readonly string[] => [
  ...links.flatMap((link) => {
    const to = generateJunctionTableName(link.table, link.field)
    const create = isSqliteRuntime()
      ? generateJunctionTableDDL(
          link.table,
          link.field,
          ddl.tableUsesView,
          ddl.tablePrimaryKeyTypes
        )
      : `CREATE TABLE IF NOT EXISTS ${quoted(to)} (LIKE ${quoted(from)} INCLUDING DEFAULTS INCLUDING INDEXES)`
    return [
      create,
      // `WHERE 1 = 1`: SQLite would read a bare `ON` after the FROM as a join condition.
      `INSERT INTO ${quoted(to)} (${keyColumnsOf(link)}) SELECT ${keyColumnsOf(link)} FROM ${quoted(from)} WHERE 1 = 1 ON CONFLICT DO NOTHING`,
    ]
  }),
  `DROP TABLE ${quoted(from)}`,
]

/** The split of the table two or more fields of one table to one related table shared. */
const planShared = (
  links: readonly LinkField[],
  existing: ReadonlySet<string>,
  previousSchema: { readonly tables: readonly object[] } | undefined,
  ddl: DdlContext
): readonly LinkTableSplit[] => {
  const [first] = links
  if (first === undefined) return []
  const from = deriveLinkTableName(first.table.name, first.field.relatedTable)
  if (!isLiveRelation(existing, from)) return []
  const stored = storedLinksTo(
    first.table,
    sanitizeTableName(first.field.relatedTable),
    previousSchema
  )
  const [only] = stored ?? []
  if (stored?.length === 1 && only !== undefined) {
    const owner = currentFieldOf(only, links)
    if (owner === undefined) return []
    const to = generateJunctionTableName(owner.table, owner.field)
    if (isLiveRelation(existing, to)) return []
    return [{ from, to: [to], statements: moveStatements(from, owner, ddl) }]
  }
  return [
    {
      from,
      to: links.map((link) => generateJunctionTableName(link.table, link.field)),
      review: { table: first.table.name, fields: links.map((link) => link.field.name) },
      statements: copyStatements(from, links, ddl),
    },
  ]
}

/**
 * The names `link`'s field may have stored its links under: the name the
 * stored schema records under its id, when that differs, then its name today.
 */
const namesBefore = (
  link: LinkField,
  previousSchema: { readonly tables: readonly object[] } | undefined
): readonly string[] => {
  const stored = storedTableOf(link.table, previousSchema)?.fields?.find(
    (field) => link.field.id !== undefined && field.id === link.field.id
  )
  const renamedFrom =
    typeof stored?.name === 'string' && stored.name !== link.field.name ? [stored.name] : []
  return [...renamedFrom, link.field.name]
}

/**
 * A field alone again: its own table, left by a sibling now removed, moves
 * back — from the table its name today derives, or the one its stored name
 * derives when this start also gives it a new name.
 */
const planAlone = (
  link: LinkField,
  existing: ReadonlySet<string>,
  previousSchema: { readonly tables: readonly object[] } | undefined,
  ddl: DdlContext
): readonly LinkTableSplit[] => {
  const to = generateJunctionTableName(link.table, link.field)
  if (isLiveRelation(existing, to)) return []
  const from = namesBefore(link, previousSchema)
    .map((name) => `${to}_${sanitizeTableName(name)}`)
    .find((candidate) => isLiveRelation(existing, candidate))
  return from === undefined ? [] : [{ from, to: [to], statements: moveStatements(from, link, ddl) }]
}

/**
 * A field beside a sibling, renamed under its id: its own table, named after
 * the name it was stored under, moves to the one its new name derives. Without
 * it the old table reads as a relationship the config no longer declares, and
 * the start refuses to drop its links.
 */
const planRenamed = (
  link: LinkField,
  existing: ReadonlySet<string>,
  previousSchema: { readonly tables: readonly object[] } | undefined,
  ddl: DdlContext
): readonly LinkTableSplit[] => {
  const [renamedFrom] = namesBefore(link, previousSchema)
  if (renamedFrom === undefined || renamedFrom === link.field.name) return []
  const to = generateJunctionTableName(link.table, link.field)
  const pair = deriveLinkTableName(link.table.name, link.field.relatedTable)
  const from = `${pair}_${sanitizeTableName(renamedFrom)}`
  if (from === to || !isLiveRelation(existing, from) || isLiveRelation(existing, to)) return []
  return [{ from, to: [to], statements: moveStatements(from, link, ddl) }]
}

/**
 * The moves and copies that give each many-to-many field of `tables` its own
 * link table, given the live table names and the stored schema. Pure, like
 * `planLinkTableRenames`.
 */
export const planLinkTableSplits = (
  tables: readonly Table[],
  existing: ReadonlySet<string>,
  previousSchema: { readonly tables: readonly object[] } | undefined
): readonly LinkTableSplit[] => {
  const ddl: DdlContext = {
    tableUsesView: new Map(tables.map((table) => [table.name, shouldUseView(table)])),
    tablePrimaryKeyTypes: buildTablePrimaryKeyTypesMap(tables),
  }
  return tables.flatMap((table) => {
    const links = table.fields
      .filter(isManyToManyRelationship)
      .map((field): LinkField => ({ table, field }))
    const groups = Map.groupBy(links, (link) => sanitizeTableName(link.field.relatedTable))
    return [...groups.values()].flatMap((group) => {
      const [alone] = group
      return group.length === 1 && alone !== undefined
        ? planAlone(alone, existing, previousSchema, ddl)
        : [
            ...group.flatMap((link) => planRenamed(link, existing, previousSchema, ddl)),
            ...planShared(group, existing, previousSchema, ddl),
          ]
    })
  })
}

/** `1 link`, `3 links`. */
const linkCount = (count: number): string => `${count} ${count === 1 ? 'link' : 'links'}`

/** The one line a copied shared table prints for a person to review. */
const reviewMessage = (
  split: LinkTableSplit & { readonly review: NonNullable<LinkTableSplit['review']> },
  count: number
): string => {
  const fields = split.review.fields.map((field) => JSON.stringify(field)).join(', ')
  return (
    `The many-to-many fields ${fields} of the table ${JSON.stringify(split.review.table)} ` +
    `stored their links in one link table, "${split.from}" (${linkCount(count)}), with nothing ` +
    `recording which field wrote each link. Every link is now kept under each of those fields, ` +
    `in their own link tables: review each field and remove the links that do not belong to it.`
  )
}

/**
 * Give each many-to-many field of `tables` its own link table, moving or
 * copying the links the database already holds ({@link planLinkTableSplits}).
 * Runs on the migration's transaction, so a failure keeps every link where it
 * was.
 */
export const splitSharedLinkTables = (
  tx: TransactionLike,
  tables: readonly Table[],
  previousSchema: { readonly tables: readonly object[] } | undefined
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const existing = new Set(yield* getExistingTableNames(tx))
    const splits = planLinkTableSplits(tables, existing, previousSchema)
    for (const split of splits) {
      const { review } = split
      const count = review === undefined ? 0 : yield* countTableRows(tx, split.from)
      yield* executeSQLStatements(tx, split.statements)
      if (review !== undefined) logWarning(reviewMessage({ ...split, review }, count))
    }
  }).pipe(Effect.withSpan('schema.split-shared-link-tables'))
