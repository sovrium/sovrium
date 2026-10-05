/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Would a reader's own read of these rows carry everything they carry? A row
 * read with the engine's authority — an automation step's output, a record
 * trigger's captured record — is shown to a reader only when it holds nothing
 * her row-level rules hide: the row itself, every record a relationship of it
 * names, and every lookup it carries, judged hop after hop as the records API
 * judges it for her ({@link omitHiddenLookups}).
 *
 * The rows are judged as they were captured, against the records as they are
 * now: a linked record her rule hides today withholds the row. Which tables and
 * columns her role may read at all is the caller's to judge; this module
 * judges rows.
 */

import { Effect } from 'effect'
import { isAdminEquivalent } from '@/domain/models/app/auth/roles'
import { keysOf } from '@/domain/models/app/tables/lookup-row-judgement-service'
import { omitHiddenLookups } from './hidden-lookup-omission'
import { readableKeys, type LinkReader } from './linked-row-visibility'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { DatabaseError } from '@/domain/errors'
import type { App, Table } from '@/domain/models/app'

type Row = Readonly<Record<string, unknown>>

/** Are all of `keys` rows of `table` her row-level rule admits? */
const allReadable = (
  app: App,
  table: Table,
  keys: readonly string[],
  reader: LinkReader
): Effect.Effect<boolean, DatabaseError, TableRepository | DataSourceRepository | AuthRepository> =>
  readableKeys(app, table, keys, reader).pipe(
    Effect.map((readable) => readable === undefined || keys.every((key) => readable.has(key)))
  )

/**
 * The declared tables `table`'s relationships link to, with the keys `rows`
 * name through each. A link to a table the config does not declare (the
 * platform's `users`) holds no row-level rule to judge.
 */
const linkedKeysByTable = (
  app: App,
  table: Table,
  rows: readonly Row[]
): readonly (readonly [Table, readonly string[]])[] =>
  table.fields
    .filter((field) => field.type === 'relationship')
    .flatMap((field) => {
      const relatedName = (field as { readonly relatedTable?: unknown }).relatedTable
      const related = app.tables?.find((candidate) => candidate.name === relatedName)
      const keys = [...new Set(rows.flatMap((row) => keysOf(row[field.name])))]
      return related === undefined || keys.length === 0 ? [] : [[related, keys] as const]
    })

/** Two captured values alike, compared by their JSON form. */
const alike = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right)

/**
 * True when `reader`'s own read of every row of `rows` in `tableName` would
 * carry it whole: her row-level rule admits the row and every record its
 * relationships name, and no lookup it carries is left out or narrowed for
 * her. An unrestricted reader reads every row whole; a table the config no
 * longer declares cannot be judged, and reads as not whole.
 */
export const rowsReadWholeBy = (
  app: App,
  tableName: string,
  rows: readonly Row[],
  reader: LinkReader
): Effect.Effect<boolean, DatabaseError, TableRepository | DataSourceRepository | AuthRepository> =>
  Effect.gen(function* () {
    const table = app.tables?.find((candidate) => candidate.name === tableName)
    if (table === undefined) return false
    if (rows.length === 0 || isAdminEquivalent(reader.role, app)) return true
    const own = rows.flatMap((row) => keysOf(row['id']))
    if (!(yield* allReadable(app, table, own, reader))) return false
    const linked = yield* Effect.forEach(linkedKeysByTable(app, table, rows), ([related, keys]) =>
      allReadable(app, related, keys, reader)
    )
    if (linked.includes(false)) return false
    const judged = yield* omitHiddenLookups(app, tableName, rows, reader)
    return rows.every((row, index) => {
      const seen = judged[index] ?? {}
      return Object.keys(row).every((key) => Object.hasOwn(seen, key) && alike(seen[key], row[key]))
    })
  }).pipe(Effect.withSpan('tables.rows-read-whole-by', { attributes: { 'table.name': tableName } }))
