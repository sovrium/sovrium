/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rows, and on each row the columns, a hand-started run's starter reads —
 * her read scope (`callerReadScope`) narrowed and widened by the records API's
 * row admission (`readerRowsOf`), so a run reads exactly what the records API
 * answers her.
 *
 * On a table where a record showing its reader no field is closed to her, a
 * starter whose own role reads no field reads only the records a grant names
 * with a role that reads one: the list query is narrowed to those ids in SQL,
 * before any page is cut, and a fetched row outside them is not admitted. A
 * starter with no such grant reads no record at all, and the table answers as
 * one that does not exist. On every admitted record she reads the columns of
 * her own role and of each role a grant gives her on that record.
 */

import { Effect } from 'effect'
import { readerRowsOf } from '@/application/use-cases/tables/row-read-admission'
import {
  isFieldReadableByCaller,
  isFieldReadableUnderFieldRules,
} from '@/domain/models/app/tables/field-read-filter-service'
import {
  admitsRow,
  type RowGrants,
  type RowReadAdmission,
} from '@/domain/models/app/tables/row-read-admission-service'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { QueryFilterNode } from '@/application/ports/repositories/tables/table-repository'
import type { LinkReader } from '@/application/use-cases/tables/linked-row-visibility'
import type { CallerReadScope } from '@/application/use-cases/tables/permissions/caller-read-authority'
import type { App } from '@/domain/models/app'

type Row = Readonly<Record<string, unknown>>

/**
 * A starter's read scope with its row admission applied. Asked about a row,
 * `readsColumn` and `selectsColumn` answer for every role she reads that row
 * under; asked about no row — which columns a filter may name — they answer
 * for her own role.
 */
export interface RunReadScope extends CallerReadScope {
  readonly readsColumn: (column: string, row?: Row) => boolean
  readonly selectsColumn: (column: string, row?: Row) => boolean
}

/** The scope a run reads under, and the grants each record is shaped with. */
export interface AdmittedReadScope {
  readonly scope: RunReadScope
  readonly grants: RowGrants
}

/** The scope's clause with `id IN` the admitted rows ANDed on, or unchanged for every row. */
const narrowedClause = (
  clause: CallerReadScope['clause'],
  admission: RowReadAdmission
): CallerReadScope['clause'] => {
  if (admission.kind !== 'granted-rows' || clause === 'nothing') return clause
  const admitted: QueryFilterNode = { field: 'id', operator: 'in', value: admission.ids }
  return clause === undefined ? admitted : { and: [clause, admitted] }
}

/** `scope` narrowed to the admitted rows and widened, on each, by the roles granted there. */
const admitScope = (
  read: { readonly app: App; readonly tableName: string; readonly reader: LinkReader },
  scope: CallerReadScope,
  rows: { readonly admission: RowReadAdmission; readonly grants: RowGrants }
): RunReadScope => {
  const { app, tableName, reader } = read
  const { admission, grants } = rows
  const grantCallers = (row: Row | undefined) =>
    row === undefined
      ? []
      : (grants.get(String(row['id'])) ?? []).map((role) => ({ role, groups: reader.groups ?? [] }))
  const readsColumn = (column: string, row?: Row): boolean =>
    scope.readsColumn(column) ||
    grantCallers(row).some((caller) => isFieldReadableByCaller(app, tableName, caller, column))
  const selectsColumn = (column: string, row?: Row): boolean =>
    scope.selectsColumn(column) ||
    grantCallers(row).some((caller) =>
      isFieldReadableUnderFieldRules(app, tableName, caller, column)
    )
  return {
    clause: narrowedClause(scope.clause, admission),
    admits: (row: Row) => scope.admits(row) && admitsRow(admission, String(row['id'])),
    readsColumn,
    selectsColumn,
    project: (row: Row) =>
      Object.fromEntries(Object.entries(row).filter(([column]) => readsColumn(column, row))),
  }
}

/**
 * The scope `reader` reads `tableName` under once the records API's row
 * admission is applied to her `scope`, or `undefined` when it admits her no
 * row — which the run answers as the records API answers a table that does
 * not exist.
 */
export const admittedReadScope = (input: {
  readonly app: App
  readonly tableName: string
  readonly scope: CallerReadScope
  readonly reader: LinkReader
}): Effect.Effect<AdmittedReadScope | undefined, never, DataSourceRepository> =>
  readerRowsOf(input.app, input.tableName, input.reader).pipe(
    Effect.map(({ admission, grants }) =>
      admission.kind === 'no-row'
        ? undefined
        : { scope: admitScope(input, input.scope, { admission, grants }), grants }
    ),
    Effect.withSpan('automations.admitted-read-scope', {
      attributes: { 'table.name': input.tableName },
    })
  )
