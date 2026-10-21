/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import { generateIndexStatements } from '../generators/index-generators'
import { SQLITE_FTS_PREFIX } from '../schema/command-search-fts-ddl'
import { executeSQL, type SQLExecutionError, type TransactionLike } from '../sql/sql-execution'
import { identifierOccurrences } from './sqlite-column-drop'
import type { Table } from '@/domain/models/app/tables'

/**
 * Indexes and triggers an operator created BY HAND on a SQLite table, and what a
 * rebuild of that table does with them.
 *
 * A SQLite rebuild creates a scratch table from the config, copies the rows and
 * drops the original — and dropping a table drops every index and trigger on
 * it. The engine puts its own back afterwards (index sync, the trigger
 * generators); an object made outside the config was simply gone, where a plain
 * in-place `DROP COLUMN` would have kept it. So the rebuild reads them from
 * `sqlite_master` first and replays their stored SQL after the swap — except
 * the ones that name a column the rebuilt table no longer has, which could not
 * be created again and would describe data that is gone. Those are named:
 * logged by the rebuild, listed by `sovrium migrate --dry-run`.
 */

/** One index or trigger of a table, as `sqlite_master` stores it. */
export interface SqliteTableObject {
  readonly type: 'index' | 'trigger'
  readonly name: string
  readonly sql: string
}

/** A hand-made object the rebuild does not recreate, and the removed columns it names. */
export interface SkippedSqliteObject extends SqliteTableObject {
  readonly columns: readonly string[]
}

/** What a rebuild does with the hand-made objects of its table. */
export interface HandMadeReplayPlan {
  readonly replay: readonly SqliteTableObject[]
  readonly skipped: readonly SkippedSqliteObject[]
}

/** The name an `INDEX` statement creates, quoted or bare. */
const indexStatementName = (statement: string): string | undefined =>
  /INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([^\s(]+))/i
    .exec(statement)
    ?.slice(1)
    .find(Boolean)

/** The names of the indexes the engine creates on `table`'s physical relation. */
export const engineIndexNames = (table: Table, physicalTableName: string): ReadonlySet<string> =>
  new Set(
    generateIndexStatements({ ...table, name: physicalTableName })
      .map(indexStatementName)
      .filter((name): name is string => name !== undefined)
      .map((name) => name.toLowerCase())
  )

/**
 * Whether the engine made `object`, for a table known by `relations` (its
 * physical name and its sanitized config name, which differ for a view-backed
 * table).
 *
 * Indexes are matched against the names the index generator emits for the
 * table, plus the two name families it has ever used (`idx_<table>_…` and the
 * `<table>_<field>_key` unique indexes), so an index a config change just
 * retired is not resurrected. Triggers are matched by the families every
 * trigger generator names them in: `a_trigger_<table>_…`, `trigger_<table>_…`
 * (autonumber and AI field triggers), `trigger_compute_<table>_…` (formulas), the command-search mirror's
 * `fts__…` triggers, and `set_updated_by`. SQLite's own `sqlite_…` objects are
 * never the operator's.
 */
export const isEngineObject = (
  object: Pick<SqliteTableObject, 'type' | 'name'>,
  relations: readonly string[],
  engineIndexes: ReadonlySet<string>
): boolean => {
  const name = object.name.toLowerCase()
  if (name.startsWith('sqlite_')) return true
  const prefixes = relations.map((relation) => relation.toLowerCase())
  if (object.type === 'index') {
    return (
      engineIndexes.has(name) ||
      prefixes.some(
        (relation) =>
          name.startsWith(`idx_${relation}_`) ||
          (name.startsWith(`${relation}_`) && name.endsWith('_key'))
      )
    )
  }
  return (
    name === 'set_updated_by' ||
    name.startsWith(SQLITE_FTS_PREFIX) ||
    prefixes.some(
      (relation) =>
        name.startsWith(`a_trigger_${relation}_`) ||
        name.startsWith(`trigger_${relation}_`) ||
        name.startsWith(`trigger_compute_${relation}_`)
    )
  )
}

/**
 * Split hand-made `objects` into the ones a rebuild replays and the ones it
 * skips because their SQL names one of `removedColumns`. The name is read as an
 * identifier, quoted or bare, anywhere in the stored text — an expression,
 * a partial index's `WHERE`, a trigger body — which can only err towards
 * skipping.
 */
export const planHandMadeReplay = (
  objects: readonly SqliteTableObject[],
  removedColumns: readonly string[]
): HandMadeReplayPlan => {
  const named = objects.map((object) => ({
    object,
    columns: removedColumns.filter((column) => identifierOccurrences(object.sql, column) > 0),
  }))
  return {
    replay: named.filter(({ columns }) => columns.length === 0).map(({ object }) => object),
    skipped: named
      .filter(({ columns }) => columns.length > 0)
      .map(({ object, columns }) => ({ ...object, columns })),
  }
}

/** The line naming one object a rebuild does not recreate. */
export const skippedObjectLine = (object: SkippedSqliteObject): string =>
  `not recreated: ${object.type} ${object.name}, which names the removed column${
    object.columns.length > 1 ? 's' : ''
  } ${object.columns.join(', ')}`

/**
 * The indexes and triggers on `physicalTableName` that the engine did not make
 * (see {@link isEngineObject}), oldest first. Automatic indexes carry no SQL and
 * are left out with the engine's.
 */
export const readHandMadeObjects = (
  tx: TransactionLike,
  table: Table,
  physicalTableName: string
): Effect.Effect<readonly SqliteTableObject[], SQLExecutionError> =>
  executeSQL(
    tx,
    `SELECT type, name, sql FROM sqlite_master WHERE type IN ('index', 'trigger') AND tbl_name = $1 AND sql IS NOT NULL ORDER BY rowid`,
    [physicalTableName]
  ).pipe(
    Effect.map((rows) => {
      const relations = [physicalTableName, sanitizeTableName(table.name)]
      const engineIndexes = engineIndexNames(table, physicalTableName)
      return (rows as readonly Partial<SqliteTableObject>[])
        .filter(
          (row): row is SqliteTableObject =>
            (row.type === 'index' || row.type === 'trigger') &&
            typeof row.name === 'string' &&
            typeof row.sql === 'string'
        )
        .map(({ type, name, sql }) => ({ type, name, sql }))
        .filter((object) => !isEngineObject(object, relations, engineIndexes))
    })
  )

/**
 * Replay what `plan` keeps after a rebuild of `tableName`, and name what it
 * skips.
 *
 * A replay that SQLite refuses is logged and left out rather than failing the
 * migration: the object was made outside the config, and losing it — said
 * aloud — is the outcome the rebuild had before it replayed anything, whereas
 * refusing the boot over it would hold the whole app back.
 */
export const replayHandMadeObjects = (
  tx: TransactionLike,
  tableName: string,
  plan: HandMadeReplayPlan
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.forEach(
      plan.skipped,
      (object) => Effect.logWarning(`Rebuilding table ${tableName}: ${skippedObjectLine(object)}`),
      { discard: true }
    )
    yield* Effect.forEach(
      plan.replay,
      (object) =>
        executeSQL(tx, object.sql).pipe(
          Effect.tapCause((cause) =>
            Effect.logWarning(
              `Rebuilding table ${tableName}: the ${object.type} ${object.name} could not be recreated`,
              cause
            )
          ),
          // effect-swallow: the object was made by hand outside the config; a replay SQLite refuses leaves the table without it (logged above), which is what the rebuild did before replaying anything, rather than refusing the boot over it.
          Effect.ignore
        ),
      { discard: true }
    )
  })
