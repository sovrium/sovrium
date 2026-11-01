/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { defaultLanguageTranslator } from '@/domain/models/app/languages/translation-resolver'
import {
  disabledControlIds,
  tableControls,
  type RecordControl,
} from '@/domain/models/app/pages/record-control-service'
import {
  bareRuleContext,
  locksOf,
  ruleColumnsOf,
  tableDeclaresRules,
  translatedLocks,
} from '@/domain/models/app/tables/business-rule-service'
import type { App } from '@/domain/models/app'

type RecordRow = Readonly<Record<string, unknown>>

/** Who a page reads a row for, as far as the business rules ask: her role and groups. */
export interface LocksReader {
  readonly role?: string | undefined
  readonly groups?: readonly string[] | undefined
}

/**
 * `projected` carrying the `_locks` block the table's business rules decide on
 * `stored` for `reader` — as the records API's list judges it, the rules that
 * read the row's own columns only. Unchanged when nothing is locked.
 */
const withLocksOf = (
  scope: { readonly app: App; readonly tableName: string },
  stored: RecordRow,
  projected: RecordRow,
  reader: LocksReader | undefined
): RecordRow => {
  const { app, tableName } = scope
  if (!tableDeclaresRules(app, tableName)) return projected
  const who = {
    ...(reader?.role === undefined ? {} : { role: reader.role }),
    groups: reader?.groups ?? [],
  }
  const locks = locksOf({
    ...{ app, tableName, reader: who, existing: stored, ctx: bareRuleContext('', reader?.role) },
    ownColumnsOnly: true,
  })
  return locks === undefined
    ? projected
    : { ...projected, _locks: translatedLocks(locks, defaultLanguageTranslator(app.languages)) }
}

/**
 * `projected` — a row a page read for one visitor, less what she may not read
 * — carrying the ids of the `controls` disabled on it under `_disabled`, judged
 * on `stored`, the WHOLE row it was read as. A `button` drawn on the record
 * reads its verdict there, the way a grid reads it off the records API: the
 * condition may name a column the visitor never receives. Unchanged when no
 * control is disabled.
 */
const withVerdictOf = (
  controls: readonly RecordControl[],
  stored: RecordRow,
  projected: RecordRow
): RecordRow => {
  const ids = controls.length === 0 ? [] : disabledControlIds(controls, stored)
  return ids.length === 0 ? projected : { ...projected, _disabled: ids }
}

/** {@link withVerdictOf} for the controls of `tableName`, read off the config once per call. */
export const withDisabledControls = (
  app: App,
  tableName: string,
  stored: RecordRow,
  projected: RecordRow
): RecordRow => withVerdictOf(tableControls(app, tableName), stored, projected)

/**
 * A projection of one row that also carries its controls' verdict and its
 * rules' locks for `reader` ({@link withDisabledControls}).
 */
export const judgedOn =
  (
    app: App,
    tableName: string,
    project: (record: RecordRow) => Promise<RecordRow>,
    reader?: LocksReader
  ) =>
  async (record: RecordRow): Promise<RecordRow> =>
    withLocksOf(
      { app, tableName },
      record,
      withDisabledControls(app, tableName, record, await project(record)),
      reader
    )

/**
 * A projection of many rows that also carries each row's verdict, judged on
 * the row as read. The table's controls are read off the config once for the
 * whole read, not once per row.
 */
export const judgedRows =
  (
    app: App,
    tableName: string,
    project: (rows: readonly RecordRow[]) => Promise<readonly RecordRow[]>,
    reader?: LocksReader
  ) =>
  async (rows: readonly RecordRow[]): Promise<readonly RecordRow[]> => {
    const controls = tableControls(app, tableName)
    return (await project(rows)).map((row, index) => {
      const stored = rows[index] ?? row
      return withLocksOf({ app, tableName }, stored, withVerdictOf(controls, stored, row), reader)
    })
  }

/** Narrow a row to the columns a binding lists, and its controls' verdict; all when it lists none. */
export const narrowTo = (record: RecordRow, fields: readonly string[] | undefined): RecordRow =>
  fields === undefined
    ? record
    : Object.fromEntries(
        Object.entries(record).filter(
          ([key]) => fields.includes(key) || key === '_disabled' || key === '_locks'
        )
      )

/**
 * The columns a read of `tableName` must fetch beyond those a binding lists so
 * its controls can be judged and pressed: each column a `disabledWhen` reads,
 * and `id`, which a press names. Empty when no control of the table has a
 * `disabledWhen`.
 *
 * A binding that lists `fields` fetches only those columns, so without this a
 * condition on an unlisted column would read as absent — the control drawn
 * usable where its author disabled it — and a row without its `id` would give
 * the press no record to be judged on.
 */
export const judgedColumnsOf = (app: App, tableName: string): readonly string[] => {
  const columns = [
    ...tableControls(app, tableName).flatMap((control) =>
      control.disabledWhen === undefined ? [] : [control.disabledWhen.field]
    ),
    // The columns the table's business rules read, so `_locks` is judged on them.
    ...ruleColumnsOf(app.tables?.find((table) => table.name === tableName)),
  ]
  return columns.length === 0 ? [] : [...new Set(['id', ...columns])]
}

/** `fields` widened by `judged` ({@link judgedColumnsOf}); `undefined` (every column) stays so. */
export const fetchedColumns = (
  fields: readonly string[] | undefined,
  judged: readonly string[]
): readonly string[] | undefined =>
  fields === undefined || judged.length === 0 ? fields : [...new Set([...fields, ...judged])]

/**
 * The columns a judged read hands back: those the binding lists, and the `id`
 * a press names when the table has a judged control. The condition columns
 * fetched only to judge are dropped again; their verdict stays, in `_disabled`.
 */
export const keptColumns = (
  fields: readonly string[] | undefined,
  judged: readonly string[]
): readonly string[] | undefined =>
  fields === undefined || judged.length === 0 ? fields : [...new Set([...fields, 'id'])]

/**
 * `query` widened to fetch what `tableName`'s controls are judged on
 * ({@link fetchedColumns}), and the columns to hand back once they are
 * ({@link keptColumns}).
 */
export const judgedRead = <Q extends { readonly fields?: readonly string[] | undefined }>(
  app: App,
  tableName: string,
  query: Q
): { readonly query: Q; readonly kept: readonly string[] | undefined } => {
  const judged = judgedColumnsOf(app, tableName)
  const fetched = fetchedColumns(query.fields, judged)
  return {
    query: fetched === undefined ? query : { ...query, fields: fetched },
    kept: keptColumns(query.fields, judged),
  }
}
