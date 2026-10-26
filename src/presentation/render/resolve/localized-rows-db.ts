/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { localizeStoredCell } from '@/domain/models/app/languages/localized-value-service'
import { translatableReadFieldsOf } from '@/domain/models/app/tables/translatable-read-service'
import type { DataSourceDb } from './data-source-contracts'
import type { App } from '@/domain/models/app'

/** A cell in `lang`, `null` when it holds nothing to show — as a database `NULL` reads. */
const localizedOrNull = (value: unknown, lang: string, app: App): unknown => {
  const cell = localizeStoredCell(value, lang, app.languages)
  return Array.isArray(cell) ? cell.map((item: unknown) => item ?? null) : (cell ?? null)
}

/** Where a localized row keeps the cells it localized, as they were stored. */
const STORED_CELLS = Symbol('stored translatable cells')

/** A row this module localized, carrying its stored cells. */
type WithStoredCells = { readonly [STORED_CELLS]?: Readonly<Record<string, unknown>> }

/**
 * `field` of `row` as it is STORED: the language map of a translatable cell a
 * page reader localized, else the cell as read. A collection page's addresses
 * read a translatable slug in every language, which the localized string —
 * one language, with its fallback — no longer holds.
 */
export const storedCellOf = (row: Readonly<Record<string, unknown>>, field: string): unknown => {
  const stored = (row as WithStoredCells)[STORED_CELLS]
  return stored !== undefined && field in stored ? stored[field] : row[field]
}

/**
 * A page's record readers, serving translatable content in the page's language.
 *
 * A translatable field stores one value per language; a page shows one, in the
 * language it is served in — the same one its `$t:` keys resolve in — falling
 * back to `languages.fallback`, then `languages.default`. Resolving the rows as
 * they are read, rather than at each `$record.` site, means every binding on
 * the page (a list, a single record, a collection page's own record) reads the
 * same string, and no raw map reaches a renderer.
 */
export const withLocalizedRows = <Db extends DataSourceDb>(db: Db, app: App, lang: string): Db => {
  if (app.languages === undefined) return db
  const localize = <Row extends Record<string, unknown>>(tableName: string, row: Row): Row => {
    const translatable = [...translatableReadFieldsOf(app, tableName)].filter((name) => name in row)
    if (translatable.length === 0) return row
    return {
      ...row,
      ...Object.fromEntries(
        translatable.map((name) => [name, localizedOrNull(row[name], lang, app)])
      ),
      [STORED_CELLS]: Object.fromEntries(translatable.map((name) => [name, row[name]])),
    }
  }
  return {
    ...db,
    fetchRecords: async (tableName, options) =>
      (await db.fetchRecords(tableName, options)).map((row) => localize(tableName, row)),
    // eslint-disable-next-line max-params -- implements the port's positional signature
    fetchSingleRecord: async (tableName, paramField, paramValue, fields, options) => {
      const row = await db.fetchSingleRecord(tableName, paramField, paramValue, fields, options)
      return row === undefined ? undefined : localize(tableName, row)
    },
  }
}
