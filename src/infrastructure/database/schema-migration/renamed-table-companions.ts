/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import { executeSQL, executeSQLStatements } from '../sql/sql-execution'
import type { SQLExecutionError, TransactionLike } from '../sql/sql-execution'

/**
 * The objects a table renamed IN PLACE still carries under its old name.
 *
 * `ALTER TABLE <old> RENAME TO <new>` moves the rows and keeps every trigger,
 * constraint and index attached — under the names the engine derived from the
 * OLD table name. The migration that follows installs the engine's triggers,
 * unique constraints and indexes under the NEW name, so without this step the
 * table would hold both sets:
 *
 * - two `updated_at` triggers and two formula triggers — on PostgreSQL the old
 *   formula trigger still computes the formula it was created with, and runs
 *   after the new one whenever its name sorts later, so an edited formula
 *   stores its previous value; on SQLite the old triggers' bodies still name
 *   the old table, and every write to the renamed table fails with
 *   `no such table`;
 * - a duplicate unique constraint and duplicate indexes.
 *
 * A rebuild would avoid this, since its `DROP TABLE` takes every one of those
 * objects with it; this gives the same outcome without the rebuild. Every
 * trigger on the table is dropped (each installer runs again under the new
 * name, as it would after a rebuild). On PostgreSQL the constraints and indexes
 * named after the old table take the new name — which is what the unique and
 * index sync look for, so they are kept rather than duplicated; SQLite cannot
 * rename an index, so its old-named indexes are dropped and the index sync
 * builds them under the new name.
 *
 * @param prefixes - old → new name pairs a companion's name may start with: the
 *   physical relation and, for a view-backed table, the derived table name its
 *   constraints are named after.
 */
export const retireRenamedTableCompanions = (
  tx: TransactionLike,
  relation: string,
  prefixes: readonly (readonly [from: string, to: string])[]
): Effect.Effect<void, SQLExecutionError> =>
  Effect.gen(function* () {
    const ordered = [...prefixes].toSorted(([a], [b]) => b.length - a.length)
    const renamed = (name: string, lead = ''): string | undefined => {
      const pair = ordered.find(([from]) => name.startsWith(`${lead}${from}_`))
      return pair === undefined
        ? undefined
        : `${lead}${pair[1]}${name.slice(lead.length + pair[0].length)}`
    }
    const statements = isSqliteRuntime()
      ? yield* sqliteCompanionStatements(tx, relation, renamed)
      : yield* postgresCompanionStatements(tx, relation, renamed)
    yield* executeSQLStatements(tx, statements)
  })

type Renamer = (name: string, lead?: string) => string | undefined

const names = (rows: unknown, key: string): readonly string[] =>
  (rows as readonly Record<string, unknown>[]).map((row) => String(row[key]))

const sqliteCompanionStatements = (
  tx: TransactionLike,
  relation: string,
  renamed: Renamer
): Effect.Effect<readonly string[], SQLExecutionError> =>
  Effect.gen(function* () {
    const triggers = names(
      yield* executeSQL(
        tx,
        `SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = '${relation}'`
      ),
      'name'
    )
    // `sql IS NOT NULL` leaves out the automatic index behind a UNIQUE column.
    const indexes = names(
      yield* executeSQL(
        tx,
        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = '${relation}' AND sql IS NOT NULL`
      ),
      'name'
    )
    return [
      ...triggers.map((name) => `DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(name)}`),
      ...indexes
        .filter((name) => renamed(name, 'idx_') !== undefined)
        .map((name) => `DROP INDEX IF EXISTS ${quoteSqlIdentifier(name)}`),
    ]
  })

const postgresCompanionStatements = (
  tx: TransactionLike,
  relation: string,
  renamed: Renamer
): Effect.Effect<readonly string[], SQLExecutionError> =>
  Effect.gen(function* () {
    const table = quoteSqlIdentifier(relation)
    const triggers = names(
      yield* executeSQL(
        tx,
        `SELECT tgname FROM pg_trigger WHERE tgrelid = '${relation}'::regclass AND NOT tgisinternal`
      ),
      'tgname'
    )
    const constraints = names(
      yield* executeSQL(
        tx,
        `SELECT conname FROM pg_constraint WHERE conrelid = '${relation}'::regclass`
      ),
      'conname'
    )
    // Indexes that back a constraint follow the constraint's rename.
    const indexes = names(
      yield* executeSQL(
        tx,
        `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = '${relation}' AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE conrelid = '${relation}'::regclass)`
      ),
      'indexname'
    )
    return [
      ...triggers.map((name) => `DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(name)} ON ${table}`),
      ...constraints.flatMap((name) => {
        const next = renamed(name)
        return next === undefined
          ? []
          : [
              `ALTER TABLE ${table} RENAME CONSTRAINT ${quoteSqlIdentifier(name)} TO ${quoteSqlIdentifier(next)}`,
            ]
      }),
      ...indexes.flatMap((name) => {
        const next = renamed(name, 'idx_')
        return next === undefined
          ? []
          : [`ALTER INDEX ${quoteSqlIdentifier(name)} RENAME TO ${quoteSqlIdentifier(next)}`]
      }),
    ]
  })
