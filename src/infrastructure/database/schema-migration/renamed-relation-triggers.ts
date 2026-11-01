/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import {
  getBaseTableName,
  getPhysicalTableName,
} from '@/infrastructure/database/lookup/lookup-view-generators'
import {
  executeSQL,
  executeSQLStatements,
  type SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { isEngineTriggerNamedAfter } from '../table-operations/sqlite-hand-made-objects'
import type { Table } from '@/domain/models/app/tables'

/**
 * The engine triggers a SQLite `ALTER TABLE <from> RENAME TO <to>` carried onto
 * `<to>` that must go.
 *
 * Bun's SQLite runs with `legacy_alter_table = 1`: a rename re-attaches every
 * trigger of the table to the new name but leaves its BODY alone. The engine's
 * `updated_at` trigger, for one, runs `UPDATE <from> … WHERE rowid = NEW.rowid`;
 * once `<from>` is gone — or has become the table's lookup VIEW — the first
 * statement that fires or merely compiles it fails. The engine names those
 * triggers after the relation they were written for, so the ones named after
 * `<from>` are exactly the stale ones; the table's feature step writes them
 * again for `<to>` in the same migration.
 *
 * Left alone: the command-search `fts__…` triggers (keyed on the config name,
 * their bodies address the search table, still valid) and every trigger an
 * operator made by hand.
 */
export const staleRenamedTriggerNames = (
  triggerNames: readonly string[],
  from: string
): readonly string[] => triggerNames.filter((name) => isEngineTriggerNamedAfter(name, from))

/**
 * Drop the engine triggers a topology rename `<from>` → `<to>` left on `<to>`
 * still addressing `<from>` (see {@link staleRenamedTriggerNames}). SQLite
 * only: a PostgreSQL trigger runs a function bound to the table by OID, whose
 * body names no relation.
 */
export const dropStaleRenamedTriggers = (
  tx: TransactionLike,
  rename: { readonly from: string; readonly to: string }
): Effect.Effect<void, SQLExecutionError> =>
  tx.dialect === 'sqlite'
    ? executeSQL(
        tx,
        `SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = $1 ORDER BY rowid`,
        [rename.to]
      ).pipe(
        Effect.map((rows) =>
          staleRenamedTriggerNames(
            (rows as readonly { readonly name?: unknown }[])
              .map((row) => row.name)
              .filter((name): name is string => typeof name === 'string'),
            rename.from
          )
        ),
        Effect.flatMap((names) =>
          executeSQLStatements(
            tx,
            names.map((name) => `DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(name)}`)
          )
        )
      )
    : Effect.void

/**
 * Run one Step 5.5 topology step: its statements, then — when it renamed the
 * table's relation — {@link dropStaleRenamedTriggers}, so no engine trigger is
 * left addressing a relation that is gone or has become the lookup view. The
 * table's feature step writes those triggers again for the new physical name.
 */
export const runViewTopologyStep = (
  tx: TransactionLike,
  step: {
    readonly statements: readonly string[]
    readonly rename?: { readonly from: string; readonly to: string }
  }
): Effect.Effect<void, SQLExecutionError> =>
  executeSQLStatements(tx, step.statements).pipe(
    Effect.andThen(
      step.rename === undefined ? Effect.void : dropStaleRenamedTriggers(tx, step.rename)
    )
  )

/**
 * The two names a table's rows can live under: `physical`, the relation that
 * holds them for the config as it stands (`<name>_base` behind a lookup view,
 * `<name>` otherwise), and `other`, the one a topology rename moves them from.
 */
export const relationNamesOf = (
  table: Table
): { readonly physical: string; readonly other: string } => {
  const name = sanitizeTableName(table.name)
  const physical = getPhysicalTableName(table)
  return { physical, other: physical === name ? getBaseTableName(name) : name }
}

/**
 * The engine triggers on `physical` still written for `other` — what a
 * topology rename by an earlier release left behind, before a rename dropped
 * them (see {@link staleRenamedTriggerNames}). A name matching both is read as
 * written for the LONGER one: `a_trigger_activities_base_…` is named after
 * `activities_base`, not `activities`.
 */
export const strandedTriggerNames = (
  triggerNames: readonly string[],
  relations: { readonly physical: string; readonly other: string }
): readonly string[] =>
  triggerNames.filter(
    (name) =>
      isEngineTriggerNamedAfter(name, relations.other) &&
      !(
        relations.physical.length > relations.other.length &&
        isEngineTriggerNamedAfter(name, relations.physical)
      )
  )

/** The catalog read listing the triggers SQLite holds on the relation bound to `$1`. */
export const SQLITE_TRIGGER_NAMES_SQL = `SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = $1 ORDER BY rowid`

/** The `name` column of a catalog read, strings only. */
export const triggerNamesOf = (rows: unknown): readonly string[] =>
  (rows as readonly { readonly name?: unknown }[])
    .map((row) => row.name)
    .filter((name): name is string => typeof name === 'string')

/**
 * Drop, for every table, the engine triggers an earlier release's topology
 * rename left on its physical relation ({@link strandedTriggerNames}). Such a
 * trigger fails the first update of the table — `no such table`, or `no such
 * column: rowid` once the old name is the lookup view. The table's feature
 * step writes its own triggers again, and the checksum fast path declines
 * while one exists, so an upgrade with the config unchanged reaches this.
 * SQLite only, for the reason given on {@link dropStaleRenamedTriggers}.
 */
export const dropStrandedRenamedTriggers = (
  tx: TransactionLike,
  tables: readonly Table[]
): Effect.Effect<void, SQLExecutionError> =>
  tx.dialect === 'sqlite'
    ? Effect.forEach(
        tables,
        (table) => {
          const relations = relationNamesOf(table)
          return executeSQL(tx, SQLITE_TRIGGER_NAMES_SQL, [relations.physical]).pipe(
            Effect.map((rows) => strandedTriggerNames(triggerNamesOf(rows), relations)),
            Effect.flatMap((names) =>
              executeSQLStatements(
                tx,
                names.map((name) => `DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(name)}`)
              )
            )
          )
        },
        { discard: true }
      )
    : Effect.void
