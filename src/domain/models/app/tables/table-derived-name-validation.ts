/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { RESERVED_TABLE_NAMES } from '@/domain/models/app/tables/reserved-table-names'

/**
 * The table a many-to-many link stores its links in: the database names of
 * both ends, source first (`orders_clients`). The engine builds the link table
 * under exactly this name.
 */
export const deriveLinkTableName = (sourceTable: string, relatedTable: string): string =>
  `${sanitizeTableName(sourceTable)}_${sanitizeTableName(relatedTable)}`

/** A table as far as the names it derives depend on it. */
type NamedTable = {
  readonly name: string
  readonly fields?: ReadonlyArray<{
    readonly type: string
    readonly relationType?: string
    readonly relatedTable?: string
  }>
  readonly views?: ReadonlyArray<{ readonly id: string | number; readonly query?: string }>
}

/** One many-to-many link: the table declaring it, the table it links to, its link table. */
type Link = { readonly source: string; readonly related: string; readonly linkTable: string }

const linksOf = (tables: ReadonlyArray<NamedTable>): readonly Link[] =>
  tables.flatMap((table) =>
    (table.fields ?? []).flatMap((field) =>
      field.type === 'relationship' &&
      field.relationType === 'many-to-many' &&
      typeof field.relatedTable === 'string'
        ? [
            {
              source: table.name,
              related: field.relatedTable,
              linkTable: deriveLinkTableName(table.name, field.relatedTable),
            },
          ]
        : []
    )
  )

const quote = (name: string): string => JSON.stringify(name)

/** A link as a message names it: `"orders" → "clients"`. */
const describe = (link: Link): string => `${quote(link.source)} → ${quote(link.related)}`

/** A table stored under a name the engine serves itself. */
const reservedTableMessage = (tables: ReadonlyArray<NamedTable>): string | undefined => {
  const table = tables.find((candidate) =>
    RESERVED_TABLE_NAMES.has(sanitizeTableName(candidate.name))
  )
  return table === undefined
    ? undefined
    : `Table ${quote(table.name)} is stored as the database table "${sanitizeTableName(table.name)}", a name the engine serves itself: rename it`
}

/**
 * A many-to-many link whose link table another link — between a different pair
 * of tables — also derives, or a declared table, or a name the engine serves.
 * Two fields between the SAME pair share one link table on purpose.
 */
const linkTableMessage = (tables: ReadonlyArray<NamedTable>): string | undefined => {
  const links = linksOf(tables)
  return links
    .map((link, index) => {
      const shared = links
        .slice(0, index)
        .find(
          (other) =>
            other.linkTable === link.linkTable &&
            (sanitizeTableName(other.source) !== sanitizeTableName(link.source) ||
              sanitizeTableName(other.related) !== sanitizeTableName(link.related))
        )
      if (shared !== undefined) {
        return `The many-to-many links ${describe(shared)} and ${describe(link)} both store their links in the table "${link.linkTable}": rename one of the tables`
      }
      const declared = tables.find((table) => sanitizeTableName(table.name) === link.linkTable)
      if (declared !== undefined) {
        return `The many-to-many link ${describe(link)} stores its links in the table "${link.linkTable}", the name the table ${quote(declared.name)} is stored under: rename one of them`
      }
      return RESERVED_TABLE_NAMES.has(link.linkTable)
        ? `The many-to-many link ${describe(link)} stores its links in the table "${link.linkTable}", a name the engine serves itself: rename one of the tables`
        : undefined
    })
    .find((message) => message !== undefined)
}

/**
 * Check that no two tables derive the same database table.
 *
 * A table is stored under the name {@link sanitizeTableName} derives from its
 * config name — lowercase, every other character an underscore — so
 * `Open Deals`, `open_deals` and `open-deals` are three names for one table.
 * Only identical names were refused, and two such names validated and then
 * read and wrote the same rows: the migration folded both declarations onto
 * one relation.
 *
 * Identical names are left to the plain uniqueness check that runs first; this
 * one names the two tables that differ and the table they would share.
 *
 * A table is also refused when it is stored under a name the engine serves
 * itself (`user_access`), and a many-to-many link when its link table takes a
 * name another link — between a different pair of tables — a declared table,
 * or the engine already takes; and a view when the database view it becomes
 * takes the name of another table's view, a table, a link table or the engine.
 *
 * Returns the message for the first collision, or `undefined`.
 */
export const validateDistinctDerivedTableNames = (
  tables: ReadonlyArray<NamedTable>
): string | undefined =>
  distinctTableNamesMessage(tables) ??
  reservedTableMessage(tables) ??
  linkTableMessage(tables) ??
  viewNameMessage(tables)

/** A view stored as a database view: the table declaring it and the name, its id verbatim. */
type StoredView = { readonly table: string; readonly name: string }

/**
 * The database views a table's views become: every view with a `query`, and
 * every view whose id is a string — a numeric id is served by the records API
 * alone. Each is stored under its id as written, quoted, in the one namespace
 * every table and view of the app shares.
 */
const storedViewsOf = (tables: ReadonlyArray<NamedTable>): readonly StoredView[] =>
  tables.flatMap((table) =>
    (table.views ?? [])
      .filter((view) => view.query !== undefined || typeof view.id !== 'number')
      .map((view) => ({ table: table.name, name: String(view.id) }))
  )

/**
 * A view stored under a name another table's view, a table, a link table or
 * the engine already takes. Both engines refuse the second relation, so the
 * app validated and then could not start.
 */
const viewNameMessage = (tables: ReadonlyArray<NamedTable>): string | undefined => {
  const views = storedViewsOf(tables)
  const links = linksOf(tables)
  return views
    .map((view, index) => {
      const twin = views.slice(0, index).find((other) => other.name === view.name)
      if (twin !== undefined) {
        return `The tables ${quote(twin.table)} and ${quote(view.table)} both declare a view stored as the database view "${view.name}": rename one of them`
      }
      const table = tables.find((candidate) => sanitizeTableName(candidate.name) === view.name)
      if (table !== undefined) {
        return `The view "${view.name}" of the table ${quote(view.table)} is stored under the name the table ${quote(table.name)} is stored as: rename one of them`
      }
      const link = links.find((candidate) => candidate.linkTable === view.name)
      if (link !== undefined) {
        return `The view "${view.name}" of the table ${quote(view.table)} is stored under the name the many-to-many link ${describe(link)} stores its links in: rename the view`
      }
      return RESERVED_TABLE_NAMES.has(view.name)
        ? `The view "${view.name}" of the table ${quote(view.table)} is stored under a name the engine serves itself: rename the view`
        : undefined
    })
    .find((message) => message !== undefined)
}

const distinctTableNamesMessage = (tables: ReadonlyArray<NamedTable>): string | undefined => {
  const collision = tables
    .map((table, index) => ({ table, index, derived: sanitizeTableName(table.name) }))
    .flatMap(({ table, index, derived }) => {
      const earlier = tables
        .slice(0, index)
        .find((other) => other.name !== table.name && sanitizeTableName(other.name) === derived)
      return earlier === undefined ? [] : [{ first: earlier.name, second: table.name, derived }]
    })
    .at(0)
  if (collision === undefined) return undefined
  return `Tables ${JSON.stringify(collision.first)} and ${JSON.stringify(collision.second)} are both stored as the database table "${collision.derived}": rename one of them`
}
