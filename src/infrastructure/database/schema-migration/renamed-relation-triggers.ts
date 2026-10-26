/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import {
  executeSQL,
  executeSQLStatements,
  type SQLExecutionError,
  type TransactionLike,
} from '../sql/sql-execution'
import { isEngineTriggerNamedAfter } from '../table-operations/sqlite-hand-made-objects'

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
  isSqliteRuntime()
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
