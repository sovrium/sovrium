/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pre-migration clearing of the command-palette full-text indexes: the half of
 * their lifecycle that runs INSIDE the migration transaction. The rebuild, after
 * it commits, is `command-search-fts.ts`.
 */

import { Data, Effect } from 'effect'
import { quoteSqlIdentifier } from '@/domain/kernel/sql/sql-formatting'
import { parseDatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'
import { logWarning } from '@/infrastructure/logging/logger'
import { PG_FTS_INDEX_PREFIX_LIKE, SQLITE_FTS_PREFIX_LIKE } from './command-search-fts-ddl'
import type { TransactionLike } from '../sql/sql-execution'

/** The clearing failed; carried only as far as the warning that reports it. */
class CommandSearchFtsClearError extends Data.TaggedError('CommandSearchFtsClearError')<{
  readonly cause: unknown
}> {}

/** Every PostgreSQL GIN expression index in the feature's reserved namespace. */
const clearPostgres = async (tx: TransactionLike): Promise<void> => {
  const rows = (await tx.unsafe(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = current_schema()
       AND indexname LIKE '${PG_FTS_INDEX_PREFIX_LIKE}%' ESCAPE '\\'`
  )) as readonly { readonly indexname?: unknown }[]
  for (const row of rows) {
    await tx.unsafe(`DROP INDEX IF EXISTS ${quoteSqlIdentifier(String(row.indexname))}`)
  }
}

/**
 * The `fts__*` objects `sqlite_master` lists NOW, of one kind. Read again before
 * each pass, because dropping a virtual table removes its shadow tables too.
 */
const sqliteFtsObjects = async (
  tx: TransactionLike,
  kind: 'trigger' | 'virtual table' | 'table'
): Promise<readonly string[]> => {
  const rows = (await tx.unsafe(
    `SELECT name FROM sqlite_master
     WHERE type = $1
       AND name LIKE '${SQLITE_FTS_PREFIX_LIKE}%' ESCAPE '\\'
       AND ($2 = 0 OR sql LIKE 'CREATE VIRTUAL TABLE%')`,
    [kind === 'trigger' ? 'trigger' : 'table', kind === 'virtual table' ? 1 : 0]
  )) as readonly { readonly name?: unknown }[]
  return rows.map((row) => String(row.name))
}

/**
 * Triggers first: dropping the FTS table out from under a live trigger is the
 * same hazard this clearing exists to avoid, one level down. Then the FTS5
 * VIRTUAL tables, which take their shadow tables (`_data`, `_idx`, `_content`,
 * `_docsize`, `_config`) with them. SQLite refuses to drop a shadow table on its
 * own ("may not be dropped"), and the catalog order cannot be trusted to list
 * the virtual table first: `VACUUM INTO`, which writes every backup, lists the
 * shadows BEFORE it, so a restored database dropped in catalog order stops at
 * the first one. Last, whatever is left (the record-key tables), re-listed so
 * nothing already gone is dropped twice.
 */
const clearSqlite = async (tx: TransactionLike): Promise<void> => {
  for (const name of await sqliteFtsObjects(tx, 'trigger')) {
    await tx.unsafe(`DROP TRIGGER IF EXISTS ${quoteSqlIdentifier(name)}`)
  }
  for (const kind of ['virtual table', 'table'] as const) {
    for (const name of await sqliteFtsObjects(tx, kind)) {
      await tx.unsafe(`DROP TABLE IF EXISTS ${quoteSqlIdentifier(name)}`)
    }
  }
}

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
 * `reconcileCommandSearchIndexes` afterwards. Enumerating `sqlite_master`
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
 *
 * A failure is logged with its cause and stepped over, never raised: anything
 * escaping here would abort BOOT, and nothing about clearing a search index is
 * worth that. Should it happen, the later steps still cope — the obsolete-table
 * sweep skips FTS5 shadow tables and drops virtual tables first.
 */
export const dropCommandSearchFtsObjects = (tx: TransactionLike): Effect.Effect<void, never> =>
  Effect.tryPromise({
    try: () =>
      parseDatabaseDialectConfig().dialect === 'sqlite' ? clearSqlite(tx) : clearPostgres(tx),
    catch: (cause) => new CommandSearchFtsClearError({ cause }),
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() =>
        logWarning(
          `[command-search] could not clear the search-index mirrors before migration: ${String(error.cause)}`
        )
      )
    )
  )
