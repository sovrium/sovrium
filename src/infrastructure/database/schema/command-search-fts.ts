/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Boot-time reconciliation of the per-table command-palette full-text indexes
 *.
 *
 * The SQL shapes live in `command-search-fts-ddl.ts`; this module owns WHEN they
 * are applied and how an existing, differently-shaped index is brought forward.
 *
 * ## Why this does not live in `executeMigrationSteps`
 *
 * `initializeSchemaInternal` has a checksum fast path: when `app.tables` is
 * unchanged, the whole migration transaction is skipped. That is correct for
 * table DDL — nothing about the tables changed — but it is exactly wrong for a
 * structure introduced by a BINARY upgrade rather than by a config edit. An
 * existing deployment whose config never changes would take the fast path on
 * every boot and never acquire an index it did not previously have. Reconciling
 * from the caller, after both paths converge, is what makes that case work.
 *
 * ## Why a failure here never fails boot
 *
 * The index is an ACCELERATOR, not the semantics: the query is
 * `FTS candidate ∩ escaped LIKE`, and the repository drops the candidate gate
 * and runs the `LIKE` alone whenever the FTS structures cannot be queried. So a
 * table this reconciler could not index still searches — more slowly, and
 * with mid-word substring recall restored rather than lost. Refusing to start
 * the app over a missing performance index would be a strictly worse outcome
 * than starting it without one, so every per-table failure is logged and
 * stepped over.
 */

/* eslint-disable functional/no-expression-statements -- Executing DDL IS the side effect this module exists to perform: every `await exec(tx, …)` below is a statement issued for its effect on the database and has no value to bind. Per-line disables would outnumber the code. */

import { SQL } from 'bun'
import { Data, Effect } from 'effect'
import { parseDatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'
import {
  searchableTextColumns,
  tableHasIdColumn,
} from '@/domain/utils/database/searchable-text-columns'
import { escapeSqlString } from '@/domain/utils/database/sql-formatting'
import { logDebug, logWarning } from '@/infrastructure/logging/logger'
import { getBaseTableName, shouldUseView } from '../lookup/lookup-view-generators'
import { openSqliteDdlDatabase, runSqliteSchemaTransaction } from '../sql/dialect-ddl'
import { sanitizeTableName } from '../table-queries/shared/field-utils'
import {
  isSafeIdentifier,
  pgFtsIndexName,
  pgFtsIndexPrefixFor,
  pgFtsIndexStatement,
  sqliteFtsBackfillStatement,
  sqliteFtsDropStatements,
  sqliteFtsStatements,
  sqliteFtsTableName,
  PG_FTS_INDEX_PREFIX_LIKE,
  SQLITE_FTS_PREFIX_LIKE,
  SQLITE_FTS_RECORD_ID_COLUMN,
} from './command-search-fts-ddl'
import type { TransactionLike } from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialectConfig } from '@/domain/models/env/database/database-dialect'

/** One table's resolved index target: what to index, on what, over which columns. */
interface FtsTarget {
  /** The relation the palette SELECTs from (a view name for view-backed tables). */
  readonly queriedRelation: string
  /** The real table the SQLite triggers attach to — a view cannot carry one. */
  readonly physicalTable: string
  readonly columns: readonly string[]
}

/**
 * Resolve every table that has something to index.
 *
 * Tables with no text column are skipped for the same reason the use case skips
 * them: there is nothing to search, and an FTS5 table of zero columns is not
 * even legal. Identifiers are re-checked here so an unexpected name fails closed
 * rather than reaching a DDL string.
 */
const resolveTargets = (tables: readonly Table[]): readonly FtsTarget[] =>
  tables.flatMap((table): readonly FtsTarget[] => {
    const columns = searchableTextColumns(table.fields)
    if (columns.length === 0) return []
    if (!tableHasIdColumn(table)) return []
    const sanitized = sanitizeTableName(table.name)
    const physicalTable = shouldUseView(table) ? getBaseTableName(sanitized) : sanitized
    if (!isSafeIdentifier(sanitized) || !isSafeIdentifier(physicalTable)) return []
    if (!columns.every(isSafeIdentifier)) return []
    return [{ queriedRelation: sanitized, physicalTable, columns }]
  })

/** Run one statement, discarding its rows. */
const exec = (tx: TransactionLike, statement: string): Promise<unknown> => tx.unsafe(statement)

// ─── SQLite ──────────────────────────────────────────────────────────────────

/**
 * Tear down EVERY object in the command-search FTS namespace, on either engine,
 * ahead of the migration.
 *
 * Not an optimisation — a correctness requirement, and one that only shows up on
 * the second boot. SQLite evolves a table by rebuilding it (create the new
 * shape, copy, drop the old, rename), and it validates every trigger that
 * references a table it is about to rename or drop. A trigger left pointing at
 * the mid-flight table aborts the whole migration:
 *
 *     error in trigger fts__tasks_ai: no such table: main.tasks
 *
 * So the mirrors are dropped BEFORE any table DDL runs and rebuilt by
 * {@link reconcileCommandSearchIndexes} afterwards. Enumerating `sqlite_master`
 * rather than deriving names from the config is deliberate: a table that was
 * RENAMED or REMOVED in this very migration is no longer in the config, and its
 * orphaned trigger is exactly the one that would break the rename.
 *
 * PostgreSQL needs the same clearing for a DIFFERENT reason. Its indexes are
 * EXPRESSION indexes over `coalesce("col", '')`, and while dropping or
 * renaming a column is handled automatically, CHANGING ITS TYPE is not: the
 * expression is re-planned against the new type and a text column becoming
 * numeric aborts the migration with
 *
 *     COALESCE types integer and text cannot be matched
 *
 * which fails the boot outright. So on both engines the search structures are
 * dropped BEFORE any table DDL and rebuilt afterwards.
 *
 * Runs INSIDE the migration transaction, so a rollback restores the mirrors
 * along with everything else. Cost is a rebuild on every boot that actually
 * migrates; the checksum fast path never gets here.
 */
export const dropCommandSearchFtsObjects = (tx: TransactionLike): Effect.Effect<void, never> =>
  Effect.promise(async () => {
    try {
      // Inside the `try`, not before it: this runs as `Effect.promise`, whose
      // rejection is a DEFECT rather than a typed failure, so anything escaping
      // this function aborts BOOT. Nothing about clearing a search index is
      // worth that.
      if (parseDatabaseDialectConfig().dialect !== 'sqlite') {
        const pgIndexes = (await tx.unsafe(
          `SELECT indexname FROM pg_indexes
           WHERE schemaname = current_schema()
             AND indexname LIKE '${PG_FTS_INDEX_PREFIX_LIKE}%' ESCAPE '\\'`
        )) as readonly { readonly indexname?: unknown }[]
        // eslint-disable-next-line functional/no-loop-statements -- sequential DDL
        for (const row of pgIndexes) {
          await exec(tx, `DROP INDEX IF EXISTS "${String(row.indexname).replace(/"/g, '""')}"`)
        }
        return
      }
      const rows = (await tx.unsafe(
        `SELECT name, type FROM sqlite_master
         WHERE type IN ('table', 'trigger') AND name LIKE '${SQLITE_FTS_PREFIX_LIKE}%' ESCAPE '\\'`
      )) as readonly { readonly name?: unknown; readonly type?: unknown }[]

      // Triggers first: dropping the FTS table out from under a live trigger is
      // the same hazard this function exists to avoid, one level down.
      const ordered = [
        ...rows.filter((row) => row.type === 'trigger'),
        ...rows.filter((row) => row.type === 'table'),
      ]
      // eslint-disable-next-line functional/no-loop-statements -- sequential DDL; the trigger/table order above is load-bearing
      for (const row of ordered) {
        const keyword = row.type === 'trigger' ? 'TRIGGER' : 'TABLE'
        await exec(tx, `DROP ${keyword} IF EXISTS "${String(row.name).replace(/"/g, '""')}"`)
      }
    } catch (error) {
      logWarning(
        `[command-search] could not clear the search-index mirrors before migration: ${String(error)}`
      )
    }
  })

/**
 * The column names of an existing FTS5 mirror, or `[]` when it does not exist.
 *
 * `PRAGMA table_info` works on a virtual table and returns nothing for a missing
 * one, so a single probe answers both "does it exist" and "is it still the right
 * shape" — which is the whole reconciliation decision.
 */
const sqliteFtsColumns = async (tx: TransactionLike, ftsTable: string): Promise<string[]> => {
  const rows = (await tx.unsafe(`PRAGMA table_info("${ftsTable}")`)) as readonly {
    readonly name?: unknown
  }[]
  return rows.map((row) => String(row.name))
}

/**
 * Create or repair one table's FTS5 mirror.
 *
 * Returns without touching anything when the mirror already carries exactly the
 * expected columns — the common case on every boot after the first, and the
 * reason this is not an unconditional drop-and-rebuild of every index at start.
 */
const reconcileSqliteTarget = async (tx: TransactionLike, target: FtsTarget): Promise<void> => {
  const ftsTable = sqliteFtsTableName(target.queriedRelation)
  const expected = [SQLITE_FTS_RECORD_ID_COLUMN, ...target.columns]
  const existing = await sqliteFtsColumns(tx, ftsTable)

  const upToDate =
    existing.length === expected.length && expected.every((column, i) => existing[i] === column)
  if (upToDate) return

  // A shape change means the mirror indexes the wrong columns; there is no
  // ALTER for an FTS5 table, so it is rebuilt. `existing.length > 0` keeps the
  // drop off the first-creation path, where there is nothing to drop.
  if (existing.length > 0) {
    // eslint-disable-next-line functional/no-loop-statements -- DDL order is load-bearing: triggers must go before the table they reference
    for (const statement of sqliteFtsDropStatements(target.queriedRelation)) {
      await exec(tx, statement)
    }
  }

  // eslint-disable-next-line functional/no-loop-statements -- DDL order is load-bearing: the table must exist before its triggers
  for (const statement of sqliteFtsStatements(target)) {
    await exec(tx, statement)
  }
  // Rows written before the triggers existed are invisible to them, so the
  // mirror is seeded from the table itself.
  await exec(tx, sqliteFtsBackfillStatement(target))
}

// ─── PostgreSQL ──────────────────────────────────────────────────────────────

/**
 * Index names on `relation` that belong to this feature's reserved namespace.
 *
 * The `_` in the prefix is escaped because it is a LIKE wildcard: unescaped,
 * `cs_fts_notes_%` would also match names this module did not create, and this
 * list is a DROP list.
 */
const pgObsoleteIndexNames = async (
  tx: TransactionLike,
  target: FtsTarget
): Promise<readonly string[]> => {
  const prefix = pgFtsIndexPrefixFor(target.queriedRelation).replace(/_/g, '\\_')
  const keep = pgFtsIndexName(target.queriedRelation, target.columns)
  const rows = (await tx.unsafe(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = '${escapeSqlString(target.queriedRelation)}'
       AND indexname LIKE '${escapeSqlString(prefix)}%' ESCAPE '\\'`
  )) as readonly { readonly indexname?: unknown }[]
  return rows.map((row) => String(row.indexname)).filter((name) => name !== keep)
}

/**
 * Create one table's GIN expression index, dropping any earlier one built over a
 * different column set.
 *
 * The index NAME encodes the column set (see `pgFtsIndexName`), so the create is
 * a genuine no-op once the shape is settled — a GIN rebuild on every restart
 * would be a real cost on a large table, and the digest is what avoids it.
 */
const reconcilePostgresTarget = async (tx: TransactionLike, target: FtsTarget): Promise<void> => {
  // eslint-disable-next-line functional/no-loop-statements -- sequential DDL on the single reserved connection
  for (const name of await pgObsoleteIndexNames(tx, target)) {
    await exec(tx, `DROP INDEX IF EXISTS "${name}"`)
  }
  await exec(tx, pgFtsIndexStatement({ relation: target.queriedRelation, columns: target.columns }))
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/** Reconcile every target on one open transaction, isolating per-table failures. */
const reconcileAll = async (
  tx: TransactionLike,
  targets: readonly FtsTarget[],
  dialect: 'postgres' | 'sqlite'
): Promise<void> => {
  // eslint-disable-next-line functional/no-loop-statements -- sequential DDL on the single reserved connection; a fan-out here cannot exceed it anyway
  for (const target of targets) {
    try {
      await (dialect === 'sqlite'
        ? reconcileSqliteTarget(tx, target)
        : reconcilePostgresTarget(tx, target))
    } catch (error) {
      // Degrade, never fail boot — the palette falls back to the plain escaped
      // LIKE for this table. See the module header.
      logWarning(
        `[command-search] could not reconcile the search index for "${target.queriedRelation}" — the palette will fall back to an unindexed scan for it: ${String(error)}`
      )
    }
  }
}

/**
 * Ensure every searchable table carries its command-palette full-text index.
 *
 * Called from `initializeSchemaInternal` AFTER the migration decision, on both
 * the migrated and the checksum-skipped path, in its own short transaction.
 * Idempotent: a second call with an unchanged schema issues no DDL at all.
 */
/**
 * Tagged wrapper for a failed reconciliation transaction. Never escapes this
 * module — the caller degrades to a logged warning — but tagging keeps the
 * Effect error channel distinct and preserves the original failure as `cause`.
 */
class CommandSearchFtsReconciliationError extends Data.TaggedError(
  'CommandSearchFtsReconciliationError'
)<{
  readonly cause: unknown
}> {}

export const reconcileCommandSearchIndexes = (
  dialectConfig: Readonly<DatabaseDialectConfig>,
  tables: readonly Table[]
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const targets = resolveTargets(tables)
    if (targets.length === 0) return

    yield* Effect.tryPromise({
      try: async () => {
        if (dialectConfig.dialect === 'sqlite') {
          const sqliteDb = openSqliteDdlDatabase(dialectConfig.path)
          try {
            await runSqliteSchemaTransaction(sqliteDb, (tx) => reconcileAll(tx, targets, 'sqlite'))
          } finally {
            sqliteDb.close()
          }
          return
        }
        const client = new SQL({ url: dialectConfig.databaseUrl, max: 1 })
        try {
          await client.begin(async (tx) => {
            await reconcileAll(tx as TransactionLike, targets, 'postgres')
          })
        } finally {
          await client.close()
        }
      },
      catch: (error) => new CommandSearchFtsReconciliationError({ cause: error }),
    }).pipe(
      // The transaction itself failing (a closed database, a lock) is the same
      // class of problem as one table failing: the search still works, unindexed.
      Effect.catchAll((error) =>
        Effect.sync(() =>
          logWarning(
            `[command-search] search-index reconciliation was skipped — the palette will fall back to unindexed scans: ${String(error.cause)}`
          )
        )
      )
    )

    logDebug('[command-search] search indexes reconciled', {
      tables: targets.map((target) => target.queriedRelation).join(', '),
    })
  })
