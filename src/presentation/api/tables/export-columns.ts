/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { countsWithheldFrom } from '@/application/use-cases/tables/link-count-narrowing'
import { isFieldReadableByCaller } from '@/domain/models/app/tables/field-read-filter-service'
import { relatedValuesRefusedTo } from '@/domain/models/app/tables/lookup-link-service'
import { toManyLinksRefusedTo } from '@/domain/models/app/tables/related-field-read-service'
import { runDomainPromise } from '@/infrastructure/logging/request-effect'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { App, Table } from '@/domain/models/app'
import type { Context } from 'hono'

/**
 * The columns of `tableName` the records API leaves out of the caller's read
 * whatever the row: a link to many records into a table she may not read (or
 * under a field rule refusing her), and a count, rollup or lookup read through
 * one or into such a table. Schema-only, so a lookup hidden on SOME rows by a
 * row-level rule keeps its column.
 */
const withheldColumnNames = (
  app: App,
  tableName: string,
  caller: Readonly<{ role: string; groups: readonly string[] }>
): ReadonlySet<string> => {
  const reader = { role: caller.role, groups: caller.groups, signedOut: false }
  return new Set([
    ...relatedValuesRefusedTo(app, tableName, reader),
    ...toManyLinksRefusedTo(app, tableName, reader),
  ])
}

/**
 * The table's columns the caller may read, judged for the CALLER — groups
 * included, since a field grant may name a group — less the
 * {@link withheldColumnNames} the records API leaves out of every record.
 */
const readableColumnNames = (
  app: App,
  table: Table | undefined,
  caller: Readonly<{ role: string; groups: readonly string[] }>,
  withheld: ReadonlySet<string>
): string[] =>
  (table?.fields ?? [])
    .map((f) => f.name)
    .filter(
      (name) =>
        table !== undefined &&
        !withheld.has(name) &&
        isFieldReadableByCaller(app, table.name, caller, name)
    )

/** The columns withheld from the caller, and the ordered columns she may read. */
const exportColumns = (
  app: App,
  table: Table | undefined,
  role: string,
  groups: readonly string[]
): { readonly withheld: ReadonlySet<string>; readonly tableFieldNames: string[] } => {
  const caller = { role, groups }
  const withheld = withheldColumnNames(app, table?.name ?? '', caller)
  return { withheld, tableFieldNames: readableColumnNames(app, table, caller, withheld) }
}

/**
 * {@link exportColumns} for `reader`, less the counts withheld from every
 * record she reads (`countsWithheldFrom`) — a count over a table whose list
 * admits her no row, and every formula over a count her list narrows — so
 * their columns are left out as any value she may not read is, even named in
 * `fields=`.
 */
export const readerExportColumns = async (
  c: Context,
  app: App,
  table: Table | undefined,
  reader: LinkReader
): Promise<ReturnType<typeof exportColumns>> => {
  const columns = exportColumns(app, table, reader.role, reader.groups ?? [])
  const counts = await runDomainPromise(c, countsWithheldFrom(app, table?.name ?? '', reader))
  if (counts.size === 0) return columns
  return {
    withheld: new Set([...columns.withheld, ...counts]),
    tableFieldNames: columns.tableFieldNames.filter((name) => !counts.has(name)),
  }
}
