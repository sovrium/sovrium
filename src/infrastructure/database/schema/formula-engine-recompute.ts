/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The one-time recompute of every trigger-computed formula when the database
 * was last migrated by an older formula engine (see `formula-engine-version.ts`).
 *
 * The per-table backfill already runs when a formula is added or edited; this
 * covers the case the config cannot see — a binary upgrade that changes the
 * values a formula should hold, or a previous binary that never filled a
 * formula for the rows already there. It reuses that backfill, so the recompute
 * fires no automation and leaves every row's `updated_at` alone.
 */

import { Effect } from 'effect'
import { logDebug } from '@/infrastructure/logging/logger'
import { FORMULA_ENGINE_VERSION } from '../formula/formula-engine-version'
import { getPhysicalTableName } from '../lookup/lookup-view-generators'
import { tableExists, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import {
  backfillTriggerFormulas,
  triggerFormulaBackfillStatements,
} from '../table-operations/table-features'
import { getStoredFormulaEngineVersion } from './migration-audit-trail'
import type { TableChange } from './schema-dry-run'
import type { Table } from '@/domain/models/app/tables'

/**
 * Whether the stored formula values were computed by an older engine: a
 * database some migration completed on (a stored row) whose stamp is below
 * this binary's. A database with no completed migration has nothing stored.
 */
export const formulaEngineOutdated = (
  tx: TransactionLike
): Effect.Effect<boolean, SQLExecutionError> =>
  getStoredFormulaEngineVersion(tx).pipe(
    Effect.map((stored) => stored !== undefined && stored < FORMULA_ENGINE_VERSION)
  )

/** The checksum singleton as the boot's fast-path probe reads it. */
export interface StoredChecksumRow {
  readonly checksum: string
  readonly formula_engine_version: number | string | null
}

/**
 * Whether the stamp on the stored checksum row names this binary's formula
 * engine or a newer one. An older stamp means the stored formula values may be
 * wrong although the config did not move, so the fast path is declined and the
 * full migration recomputes them.
 */
export const storedFormulaEngineCurrent = (row: StoredChecksumRow): boolean => {
  const current = Number(row.formula_engine_version ?? 0) >= FORMULA_ENGINE_VERSION
  if (!current) {
    logDebug(
      '[schema] checksum matches but an older formula engine stored the values — full migration'
    )
  }
  return current
}

/** The tables whose rows hold a trigger-computed formula to recompute. */
export const tablesWithStoredFormulas = (tables: readonly Table[]): readonly Table[] =>
  tables.filter((table) => triggerFormulaBackfillStatements(table).length > 0)

/**
 * Recompute every trigger-computed formula of every existing table, once, when
 * an older formula engine stored the values. Runs inside the migration
 * transaction, after the tables and their triggers are in place; the new stamp
 * is stored with the checksum at the end of the same migration.
 */
export const recomputeFormulasForOlderEngine = (
  tx: TransactionLike,
  tables: readonly Table[]
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    if (!(yield* formulaEngineOutdated(tx))) return
    const targets = yield* Effect.filter(tablesWithStoredFormulas(tables), (table) =>
      tableExists(tx, getPhysicalTableName(table))
    )
    logDebug('[schema] an older formula engine stored the formula values — recomputing', {
      tables: targets.map((table) => table.name).join(', '),
    })
    yield* Effect.forEach(targets, (table) => backfillTriggerFormulas(tx, table), {
      discard: true,
    })
  }).pipe(Effect.withSpan('schema.recompute-formulas-for-older-engine'))

/**
 * The recomputes Step 6.5 would run, read-only. A stamp that cannot be read is
 * the state before the column's own migration, which leaves `0` — older than
 * this binary — so it plans the recompute the apply path will then run.
 */
export const planFormulaRecomputes = (
  tx: TransactionLike,
  tables: readonly Table[],
  previousSchema: { readonly tables: readonly object[] } | undefined
): Effect.Effect<readonly TableChange[], never> =>
  Effect.gen(function* () {
    if (previousSchema === undefined) return []
    // effect-swallow: an unreadable stamp is the state before the column's migration, which leaves `0` — older than this binary — so "recompute" is the faithful plan, not a hidden failure.
    const outdated = yield* formulaEngineOutdated(tx).pipe(Effect.orElseSucceed(() => true))
    if (!outdated) return []
    const existing = yield* Effect.filter(tablesWithStoredFormulas(tables), (table) =>
      tableExists(tx, getPhysicalTableName(table)).pipe(
        // effect-swallow: a table whose existence cannot be read is left out of this report line only; its create or alter line already says what the plan knows about it.
        Effect.orElseSucceed(() => false)
      )
    )
    return existing.map((table): TableChange => ({
      table: table.name,
      relation: getPhysicalTableName(table),
      kind: 'recompute',
      statements: triggerFormulaBackfillStatements(table),
      unsimulated: false,
      refusals: [],
    }))
  })
