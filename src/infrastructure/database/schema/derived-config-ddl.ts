/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The app-table DDL the engine DERIVED from `tables` between two boots — the
 * `derived_ddl` column of `system.boot_ledger` ([internal ref] amendment A6).
 *
 * ## Derived from two snapshots, not observed from the transaction
 *
 * A6's own wording is "the app-table DDL the engine *derived* from `tables`",
 * and derived is what this is. `initializeSchema` returns `void` and applies its
 * statements several layers down inside a `TransactionLike`; threading a
 * mutable sink through the whole schema-migration layer for the benefit of an
 * observability row would be the larger change and the more fragile one.
 *
 * Deriving instead is pure, testable without a database, and — this is the part
 * that matters — cannot disagree with reality in the direction that would hurt.
 * If `tables` is unchanged the derivation is empty and the initializer also
 * skipped, because the checksum matched; if `tables` changed the derivation
 * produces statements and the initializer also ran a full migration. The two
 * agree wherever an operator could tell.
 *
 * It is the same shape as `schema-dry-run.ts`, one axis over: that module asks
 * what the engine would do to a LIVE database, this one asks what it derived
 * between two CONFIGURATIONS. Both reuse the real generators rather than
 * re-deriving DDL, for the same reason — a second implementation is a second
 * thing to keep true, and its divergence would surface as a ledger reporting
 * work the engine never did.
 *
 * ## Additive, and that is a claim rather than an omission
 *
 * A boot that REMOVES a table or a field derives nothing here. Whether the
 * engine actually drops anything is not a function of the two configurations:
 * `dropObsoleteTables` and `validateDestructiveOps` decide it at runtime from
 * policy and from the live rows, and a removal they refuse would be recorded
 * here as work that never happened. The additions have no such gate — a table
 * the configuration declares and the database lacks IS created — so they are
 * the half that can be stated honestly from config alone.
 */

import { shouldUseView } from '../lookup/lookup-view-generators'
import { buildColumnStatements } from '../schema-migration/column-detection'
import { buildTablePrimaryKeyTypesMap, generateCreateTableSQL } from '../table-operations'
import type { Table } from '@/domain/models/app/tables'

/** One derived statement and the table it operates on. */
export interface DerivedDdlStatement {
  readonly statement: string
  readonly table: string
}

/**
 * The previous boot's tables, as much of them as this derivation reads.
 *
 * Narrower than `Table` on purpose. The previous side comes out of a stored
 * snapshot — a plain JSON document that has been through the redactor — so
 * typing it as a full `Table` would be a cast asserting far more than the two
 * properties actually touched, and would silently invite a future reader to
 * trust a field the redactor may have rewritten.
 */
export interface PriorTable {
  readonly name: string
  readonly fields?: readonly { readonly name: string }[] | undefined
}

/** The fields a table declares, by name. */
const fieldNamesOf = (table: PriorTable | undefined): ReadonlySet<string> =>
  new Set((table?.fields ?? []).map((field) => field.name))

/**
 * The composite-primary-key field list, in the spelling `generateCreateTableSQL`
 * uses — repeated rather than imported because it is the generator's own
 * reading of `table.primaryKey`, not a shared rule.
 */
const primaryKeyFieldsOf = (table: Table): readonly string[] =>
  table.primaryKey?.type === 'composite' ? (table.primaryKey.fields ?? []) : []

/**
 * The DDL this boot's `tables` derives against the previous boot's.
 *
 * The baseline row passes `undefined` and gets an empty list. That is the same
 * bound the diff carries and for the same reason: with no previous boot there
 * is no second side, and rendering the whole schema as `CREATE TABLE`s would be
 * a claim about work performed at a boot the ledger never saw. What the engine
 * state actually was at that point is carried by `engine_migrations`, which is
 * read from the database rather than derived.
 */
export const deriveConfigDdl = (params: {
  readonly previousTables: readonly PriorTable[] | undefined
  readonly currentTables: readonly Table[]
  readonly hasAuthConfig: boolean
}): readonly DerivedDdlStatement[] => {
  const { previousTables, currentTables, hasAuthConfig } = params
  if (previousTables === undefined) return []

  const before = new Map(previousTables.map((table) => [table.name, table] as const))
  const tablePrimaryKeyTypes = buildTablePrimaryKeyTypesMap(currentTables)

  return currentTables.flatMap((table): readonly DerivedDdlStatement[] => {
    const prior = before.get(table.name)

    if (prior === undefined) {
      return [
        {
          table: table.name,
          statement: generateCreateTableSQL(table, {
            tablePrimaryKeyTypes,
            tableUsesView: new Map([[table.name, shouldUseView(table)]]),
            skipForeignKeys: false,
            hasAuthConfig,
          }),
        },
      ]
    }

    const existing = fieldNamesOf(prior)
    const columnsToAdd = table.fields.filter((field) => !existing.has(field.name))
    if (columnsToAdd.length === 0) return []

    const { addStatements } = buildColumnStatements({
      tableName: table.name,
      columnsToDrop: [],
      columnsToAdd,
      primaryKeyFields: primaryKeyFieldsOf(table),
      allFields: table.fields,
      tablePrimaryKeyTypes,
      hasAuthConfig,
    })
    return addStatements.map((statement) => ({ table: table.name, statement }))
  })
}
