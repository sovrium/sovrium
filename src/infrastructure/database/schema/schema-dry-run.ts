/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What `initializeSchema` WOULD do to the config tables, computed without doing
 * any of it.
 *
 * ## Why this is not "run it and roll back"
 *
 * That shortcut looked cheaper and faithful. It is neither, for a reason only
 * visible from the operator's side: it takes WRITE LOCKS on a production
 * database and would actually execute the recreate-with-data row copy before
 * discarding it. Someone runs `--dry-run` precisely to decide whether the
 * upgrade needs a maintenance window; locking tables and copying rows is the
 * cost they were measuring. Nor would it be complete: `reconcileCommandSearchIndexes`
 * runs outside the transaction and would escape the rollback.
 *
 * ## Why read-only introspection is enough
 *
 * `TransactionLike` is a ONE-METHOD structural interface, so a plain connection
 * satisfies it and `getExistingColumns` runs happily outside a write
 * transaction. With the live columns in hand every remaining decision is pure
 * data: `needsTableRecreation` and `generateAlterTableStatements` are functions
 * of `(table, existingColumns)` and nothing else.
 *
 * ## The one thing it cannot simulate, and why that is reported rather than hidden
 *
 * `recreateTableWithDataEffect` builds its statement list from runtime state —
 * the live column set at the moment it runs. It can be NAMED but not rendered.
 * It is therefore marked {@link TableChange.unsimulated} and reported as such.
 * Omitting it would make the dry run under-report, which is worse than shipping
 * no dry run at all: the operator's decision turns on exactly that cost.
 */

import { existsSync } from 'node:fs'
import { SQL } from 'bun'
import { Effect } from 'effect'
import {
  NO_AUTHORED_TABLE_IDS,
  type AuthoredTableIds,
} from '@/domain/models/app/tables/authored-table-ids-service'
import { postgresClientOptions } from '@/infrastructure/database/sql/postgres-client-options'
import { sqliteTransactionLike } from '../sql/dialect-ddl'
import { postgresTransactionLike } from '../sql/sql-execution'
import { openSqliteReader } from '../sql/sqlite-reader'
import { buildTablePrimaryKeyTypesMap } from '../table-operations'
import { applySchemaDefaults } from './apply-schema-defaults'
import { planFormulaRecomputes } from './formula-engine-recompute'
import { getPreviousSchema } from './migration-audit-trail'
import { sortTablesByDependencies } from './schema-dependency-sorting'
import { planDrops } from './schema-dry-run-drops'
import { planLanguageWarnings } from './schema-dry-run-languages'
import { planRelationSet, relationChanges } from './schema-dry-run-relations'
import { planNewTable, planTableWithTopology } from './schema-dry-run-tables'
import { planViewRebuilds } from './schema-dry-run-views'
import type { TransactionLike } from '../sql/sql-execution'
import type { App } from '@/domain/models/app'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/**
 * What would happen to one table.
 *
 * `drop` is a table the config no longer declares; `view` is the rebuild of a
 * view-backed table's lookup VIEW, which every full migration performs;
 * `rename` is a table whose rows change relation because it gains its first, or
 * loses its last, lookup/rollup/count field (Step 5.5 moves them by RENAME);
 * `recompute` is the one-time formula recompute of Step 6.5
 * (`formula-engine-recompute.ts`).
 */
export interface TableChange {
  /** The config name (for `drop`, the physical table the config no longer owns). */
  readonly table: string
  /**
   * The relation the statements act on, when it is not the config name: the
   * `<name>_base` table that stores a view-backed table's rows.
   */
  readonly relation?: string
  /** For `rename`: the relation that holds the rows before the migration. */
  readonly from?: string
  /** For `drop`: the rows the drop would delete. */
  readonly rows?: number
  readonly kind:
    'create' | 'alter' | 'recreate' | 'unchanged' | 'drop' | 'view' | 'rename' | 'recompute'
  /** The DDL this change would run. EMPTY when {@link unsimulated} is true. */
  readonly statements: readonly string[]
  /** True when the statement list depends on runtime state and cannot be rendered. */
  readonly unsimulated: boolean
  /**
   * Why this change would be REFUSED, in the words the boot would use.
   *
   * Empty on every table that would go through. A recreate is {@link unsimulated}
   * because its statements cannot be rendered ahead of time — but whether it will
   * refuse is the one thing an operator needs, and that IS computable read-only.
   */
  readonly refusals: readonly string[]
  readonly lostObjects?: readonly string[] // SQLite rebuild: hand-made objects it won't recreate
  readonly warnings?: readonly string[] // printed whatever the kind; never a refusal
}

/**
 * Open a read-only connection satisfying `TransactionLike`, and close it after.
 * SQLite opens through `openSqliteReader` on purpose: the apply path's
 * opener CREATES the file and writes WAL pages, so `--dry-run` would bring a
 * database into existence by describing it. (An absent file never gets here;
 * see {@link planConfigTableChanges}.)
 */
const withReadOnlyTx = <A>(
  config: DatabaseDialectConfig,
  use: (tx: TransactionLike) => Effect.Effect<A, never>
): Effect.Effect<A, never> =>
  config.dialect === 'postgres'
    ? Effect.acquireUseRelease(
        // One connection: the TEMPORARY probe view lives in its session.
        Effect.sync(() => new SQL(postgresClientOptions(config.databaseUrl, { max: 1 }))),
        (client) => use(postgresTransactionLike(client)),
        // effect-promise: total -- `SQL.close()` resolves once the pool is drained and has no rejection path; as the `acquireUseRelease` RELEASE arm it must also stay infallible, or a teardown failure would displace the plan this read-only transaction just produced.
        (client) => Effect.promise(() => client.close())
      )
    : Effect.acquireUseRelease(
        // Never creates the file, and writes nothing; the busy timeout is set,
        // so a `--dry-run` concurrent with a writer is delayed, not refused.
        Effect.sync(() => openSqliteReader(config.path)),
        (client) => use(sqliteTransactionLike(client)),
        (client) => Effect.sync(() => client.close())
      )

/** Options that change what the planned migration would be allowed to do. */
export interface PlanOptions {
  /**
   * The one-shot consent of `sovrium migrate --allow-destructive`: a drop of a
   * table that still holds rows is planned without a refusal.
   */
  readonly allowDestructive?: boolean
  /**
   * The ids the author WROTE, as `decodeAppConfigObject` returned them beside
   * the config — the same set the apply path reads a rename from, so the plan
   * cannot name a rename the migration would not run. Omitted, no id reads as
   * written.
   */
  readonly authoredTableIds?: AuthoredTableIds
}

/**
 * Plan every config table.
 *
 * `applySchemaDefaults` and `sortTablesByDependencies` are applied first, and in
 * the same order the apply path applies them, so the plan describes the tables
 * the migration would actually see rather than the ones the config literally
 * declares.
 */
export const planConfigTableChanges = (
  app: App,
  config: DatabaseDialectConfig,
  options: PlanOptions = {}
): Effect.Effect<readonly TableChange[], never> => {
  const tables = applySchemaDefaults(sortTablesByDependencies(app.tables ?? []), app)
  const tablePrimaryKeyTypes = buildTablePrimaryKeyTypesMap(tables)

  // A SQLite database that does not exist yet is planned WITHOUT opening one.
  // Every config table is necessarily new, so the answer needs no introspection
  // — and opening the file to discover that would create it, which is the one
  // thing this mode promises not to do.
  if (config.dialect === 'sqlite' && !existsSync(config.path)) {
    return Effect.succeed(
      tables.map((table) => planNewTable(table, tablePrimaryKeyTypes, !!app.auth, config.dialect))
    )
  }

  return withReadOnlyTx(config, (tx) =>
    Effect.gen(function* () {
      // Absent on a database whose journal has not reached the migration that
      // creates the checksum table — which is the NORMAL state for a dry run
      // taken before the upgrade. "No previous snapshot" is what the apply path
      // sees there too.
      const previousSchema = yield* getPreviousSchema(tx).pipe(
        // `orElseSucceed`, NOT `catchCause`. The tolerance being bought here is
        // narrow and typed: `getPreviousSchema` declares `SQLExecutionError` and
        // nothing else, and the state it stands for — the checksum table does
        // not exist yet — is the normal one before the upgrade.
        //
        // `catchCause` would also swallow DEFECTS, and a defect here means the plan was computed
        // against a snapshot nobody could read: a silently under-stated change set, which the
        // two-machine `sovrium migrate` design classes as a defect. Letting it through refuses.
        // effect-swallow: see the paragraph above — a missing previous snapshot is the FIRST-BOOT case, not an error, and `orElseSucceed` is narrowed to failures precisely so a defect still refuses the plan.
        Effect.orElseSucceed(() => undefined)
      )

      const relations = yield* planRelationSet(
        tx,
        tables,
        previousSchema,
        options.authoredTableIds ?? NO_AUTHORED_TABLE_IDS
      )
      const drops = yield* planDrops(tx, tables, options, { previousSchema, ...relations })
      const tableChanges = yield* Effect.forEach(tables, (table) =>
        planTableWithTopology(
          { tx, table, tablePrimaryKeyTypes, previousSchema, hasAuthConfig: !!app.auth },
          relations
        )
      )
      const recomputes = yield* planFormulaRecomputes(tx, tables, previousSchema)
      const views = yield* planViewRebuilds(tx, app, tables, config.dialect)
      const languages = yield* planLanguageWarnings(tx, tables, app, config.dialect)
      return [
        ...relationChanges(relations),
        ...drops,
        ...tableChanges.flat(),
        ...recomputes,
        ...views,
        ...languages,
      ]
    })
  )
}
