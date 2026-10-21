/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { hasReadPermission } from '@/domain/models/app/auth/permission-evaluator-service'
import { readerRowsOf } from './row-read-admission'
import { tableReadAdmits, type TableCaller } from './table-operations'
import type { LinkReader } from './linked-row-visibility'
import type { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import type { App } from '@/domain/models/app'

type DeclaredTable = NonNullable<App['tables']>[number]

/** One table, in the shape the listing answers. */
function toListedTable(table: DeclaredTable) {
  return {
    id: String(table.id),
    name: table.name,
    description: undefined, // Domain model doesn't have table description
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * The tables whose records admit the caller (`GET /api/tables`).
 *
 * An app with no `auth` has no roles to gate the listing on: every visitor is
 * the guest, and the listing names exactly the tables whose records the guest
 * may read — the same rule the records route applies.
 *
 * With `auth`, no role is refused the listing as a whole: a viewer is named
 * the tables her records serve, and an empty list where none does. A table is
 * named exactly when its records admit the caller — groups, `inherit` /
 * `override` and the open-when-undeclared default resolved by the records
 * route's own gate (`tableReadAdmits`) — and, for the signed-in `reader`, when
 * her list of it admits her at least one row (`readerRowsOf`): a table that
 * admits her no row answers her as a table that does not exist on every other
 * read, so it is not named here either.
 */
export function createListTablesProgram(
  caller: TableCaller,
  app: App,
  reader?: LinkReader
): Effect.Effect<readonly unknown[], never, DataSourceRepository> {
  const tables = app.tables ?? []
  if (app.auth === undefined) {
    const readable = tables.filter((table) => hasReadPermission(table, caller.role, tables))
    return Effect.succeed(readable.map(toListedTable)).pipe(
      Effect.withSpan('tables.create-list-tables-program')
    )
  }
  const admitted = tables.filter((table) => tableReadAdmits(app, table, caller))
  const listsAnyRow = (table: DeclaredTable) =>
    reader === undefined
      ? Effect.succeed(true)
      : Effect.map(
          readerRowsOf(app, table.name, reader),
          ({ admission }) => admission.kind !== 'no-row'
        )
  return Effect.filter(admitted, listsAnyRow).pipe(
    Effect.map((listed) => listed.map(toListedTable)),
    Effect.withSpan('tables.create-list-tables-program')
  )
}
