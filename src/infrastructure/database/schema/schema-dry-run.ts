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
 * upgrade needs a maintenance window; a dry run that locks tables and copies
 * rows is the cost they were trying to measure. It would not even be complete —
 * `reconcileCommandSearchIndexes` runs outside the transaction and would escape
 * the rollback entirely.
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
import { Database as BunSqlite } from 'bun:sqlite'
import { Effect } from 'effect'
import { sanitizeTableName } from '@/domain/kernel/sql/table-naming'
import * as lookupViewGenerators from '../lookup/lookup-view-generators'
import { generateAlterTableStatements, needsTableRecreation } from '../schema-migration'
import { sqliteTransactionLike } from '../sql/dialect-ddl'
import { executeSQL, getExistingColumns, tableExists } from '../sql/sql-execution'
import { applySqlitePragmas } from '../sql/sqlite-pragmas'
import { buildTablePrimaryKeyTypesMap, generateCreateTableSQL } from '../table-operations'
import {
  detectUnconvertibleRows,
  planTypeChangeProbes,
  resolveProbeIdColumn,
} from '../table-operations/type-change-preflight'
import { applySchemaDefaults } from './apply-schema-defaults'
import { getPreviousSchema } from './migration-audit-trail'
import { sortTablesByDependencies } from './schema-dependency-sorting'
import type { TransactionLike } from '../sql/sql-execution'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialectConfig } from '@/domain/models/process-env/database/database-dialect'

/** What would happen to one config table. */
export interface TableChange {
  readonly table: string
  readonly kind: 'create' | 'alter' | 'recreate' | 'unchanged'
  /** The DDL this change would run. EMPTY when {@link unsimulated} is true. */
  readonly statements: readonly string[]
  /** True when the statement list depends on runtime state and cannot be rendered. */
  readonly unsimulated: boolean
  /**
   * Why this change would be REFUSED, in the words the boot would use.
   *
   * Empty on every table that would go through. A recreate is reported as
   * {@link unsimulated} precisely because its statements cannot be rendered
   * ahead of time — but whether it will refuse is the one thing about it an
   * operator actually needs, and that IS computable read-only.
   */
  readonly refusals: readonly string[]
}

/** Everything one {@link planTable} call needs, bundled to keep arity low. */
interface TablePlanInputs {
  readonly tx: TransactionLike
  readonly table: Table
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
  readonly previousSchema: { readonly tables: readonly object[] } | undefined
  readonly hasAuthConfig: boolean
}

/** The plan for a table that does not exist yet — computable with no connection. */
const planNewTable = (
  table: Table,
  tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>,
  hasAuthConfig: boolean
): TableChange => ({
  table: table.name,
  kind: 'create',
  statements: [
    generateCreateTableSQL(table, {
      tablePrimaryKeyTypes,
      tableUsesView: new Map([[table.name, lookupViewGenerators.shouldUseView(table)]]),
      skipForeignKeys: false,
      hasAuthConfig,
    }),
  ],
  unsimulated: false,
  refusals: [],
})

/**
 * Whether a field-type change over the live rows would be REFUSED, and why.
 *
 * Read-only, and the same probe the apply path runs at its decision site
 * — which is what makes this the one fact about the otherwise
 * {@link TableChange.unsimulated} recreate that CAN be rendered ahead of time.
 */
const planRefusals = (params: {
  readonly tx: TransactionLike
  readonly table: Table
  readonly physical: string
  readonly existingColumns: ReadonlyMap<string, { readonly dataType: string }>
  readonly previousSchema: { readonly tables: readonly object[] } | undefined
}): Effect.Effect<readonly string[], never> => {
  const { tx, table, physical, existingColumns, previousSchema } = params
  const probes = planTypeChangeProbes({ table, existingColumns, previousSchema })
  if (probes.length === 0) return Effect.succeed([])
  return detectUnconvertibleRows({
    query: (sql) => executeSQL(tx, sql),
    tableName: table.name,
    physicalTableName: physical,
    idColumn: resolveProbeIdColumn(existingColumns),
    probes,
    // effect-swallow: a probe that cannot run means "no refusal is PROVEN", not "a refusal was found". This is a dry-run REPORT, so the honest degradation is to list no refusals rather than to invent one or to fail the whole plan; the apply path runs the same probe again at its own decision site and is where a real refusal is enforced.
  }).pipe(Effect.orElseSucceed(() => []))
}

/**
 * The plan for an existing table, once its live columns and refusals are known.
 *
 * The recreate branch is decided FIRST and reported WITHOUT statements:
 * `generateAlterTableStatements` deliberately returns [] on that path, so
 * treating an empty list as "nothing to do" would silently drop the single most
 * expensive operation the command can perform. A refusal forces the same branch
 * — on SQLite a field type change produces no ALTERs either, and reporting it as
 * `unchanged` beside a refusal would contradict itself.
 */
const planExistingTable = (params: {
  readonly table: Table
  readonly existingColumns: ReadonlyMap<
    string,
    { dataType: string; isNullable: string; columnDefault: string | null }
  >
  readonly previousSchema: { readonly tables: readonly object[] } | undefined
  readonly tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>
  readonly hasAuthConfig: boolean
  readonly refusals: readonly string[]
}): TableChange => {
  const { table, existingColumns, previousSchema, tablePrimaryKeyTypes, hasAuthConfig, refusals } =
    params
  if (needsTableRecreation(table, existingColumns) || refusals.length > 0) {
    return { table: table.name, kind: 'recreate', statements: [], unsimulated: true, refusals }
  }

  const statements = generateAlterTableStatements({
    table,
    existingColumns,
    previousSchema,
    tablePrimaryKeyTypes,
    hasAuthConfig,
  })

  return statements.length === 0
    ? { table: table.name, kind: 'unchanged', statements: [], unsimulated: false, refusals }
    : { table: table.name, kind: 'alter', statements, unsimulated: false, refusals }
}

/** Plan one table, given the live columns the database reports. */
const planTable = (inputs: TablePlanInputs): Effect.Effect<TableChange, never> =>
  Effect.gen(function* () {
    const { tx, table, tablePrimaryKeyTypes, previousSchema, hasAuthConfig } = inputs
    const sanitized = sanitizeTableName(table.name)
    const usesView = lookupViewGenerators.shouldUseView(table)
    const physical = usesView ? lookupViewGenerators.getBaseTableName(sanitized) : sanitized

    const exists = yield* tableExists(tx, physical)
    if (!exists) return planNewTable(table, tablePrimaryKeyTypes, hasAuthConfig)

    const existingColumns = yield* getExistingColumns(tx, physical)
    const refusals = yield* planRefusals({
      tx,
      table,
      physical,
      existingColumns,
      previousSchema,
    })

    return planExistingTable({
      table,
      existingColumns,
      previousSchema,
      tablePrimaryKeyTypes,
      hasAuthConfig,
      refusals,
    })
  }).pipe(
    // A table whose plan cannot be computed is reported as unsimulated rather
    // than aborting the whole report. `generateAlterTableStatements` THROWS on
    // an ambiguous rename or a refused destructive drop, and losing every other
    // table's plan to one such table would make the mode useless exactly when
    // the operator most needs it.
    Effect.catchCause(() =>
      Effect.succeed({
        table: inputs.table.name,
        kind: 'recreate' as const,
        statements: [],
        unsimulated: true,
        refusals: [],
      })
    )
  )

/**
 * Open a read-only connection satisfying `TransactionLike`, and close it after.
 *
 * The SQLite branch opens `{ create: false, readonly: true }`, which is not
 * belt-and-braces: `openSqliteDdlDatabase` — the opener the apply path uses —
 * CREATES the file and writes WAL pages, so borrowing it here made `--dry-run`
 * bring a database into existence merely by describing it. The Postgres-only
 * specs could never have caught that, which is exactly how a SQLite-only defect
 * ships. An absent file never reaches this function at all; see
 * {@link planConfigTableChanges}.
 */
const withReadOnlyTx = <A>(
  config: DatabaseDialectConfig,
  use: (tx: TransactionLike) => Effect.Effect<A, never>
): Effect.Effect<A, never> =>
  config.dialect === 'postgres'
    ? Effect.acquireUseRelease(
        Effect.sync(() => new SQL(config.databaseUrl)),
        (client) => use({ unsafe: (sql: string) => client.unsafe(sql) }),
        // effect-promise: total -- `SQL.close()` resolves once the pool is drained and has no rejection path; as the `acquireUseRelease` RELEASE arm it must also stay infallible, or a teardown failure would displace the plan this read-only transaction just produced.
        (client) => Effect.promise(() => client.close())
      )
    : Effect.acquireUseRelease(
        Effect.sync(() => {
          const client = new BunSqlite(config.path, { create: false, readonly: true })
          // The busy timeout alone — the other two PRAGMAs need write access
          // this handle deliberately does not have. Without it a `--dry-run`
          // run concurrent with any writer is refused rather than delayed.

          applySqlitePragmas(client, { readOnly: true })
          return client
        }),
        (client) => use(sqliteTransactionLike(client)),
        (client) => Effect.sync(() => client.close())
      )

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
  config: DatabaseDialectConfig
): Effect.Effect<readonly TableChange[], never> => {
  const tables = applySchemaDefaults(sortTablesByDependencies(app.tables ?? []), app)
  const tablePrimaryKeyTypes = buildTablePrimaryKeyTypesMap(tables)

  // A SQLite database that does not exist yet is planned WITHOUT opening one.
  // Every config table is necessarily new, so the answer needs no introspection
  // — and opening the file to discover that would create it, which is the one
  // thing this mode promises not to do.
  if (config.dialect === 'sqlite' && !existsSync(config.path)) {
    return Effect.succeed(
      tables.map((table) => planNewTable(table, tablePrimaryKeyTypes, !!app.auth))
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
        // `catchCause` would additionally swallow DEFECTS, and a defect on this
        // line does not mean "no previous snapshot"; it means the plan was
        // computed against a snapshot nobody could read. The report would then
        // under-state the change set with no indication it had done so, which
        // [internal ref] classes as a defect rather than a limitation — the same
        // judgement this module already makes about the unsimulated recreate.
        // Letting a defect through turns a silently wrong plan into a refusal.
        // effect-swallow: see the paragraph above — a missing previous snapshot is the FIRST-BOOT case, not an error, and `orElseSucceed` is narrowed to failures precisely so a defect still refuses the plan.
        Effect.orElseSucceed(() => undefined)
      )

      return yield* Effect.forEach(tables, (table) =>
        planTable({ tx, table, tablePrimaryKeyTypes, previousSchema, hasAuthConfig: !!app.auth })
      )
    })
  )
}
