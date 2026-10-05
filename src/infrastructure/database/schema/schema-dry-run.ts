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
import { Cause, Effect } from 'effect'
import {
  NO_AUTHORED_TABLE_IDS,
  type AuthoredTableIds,
} from '@/domain/models/app/tables/authored-table-ids-service'
import { postgresClientOptions } from '@/infrastructure/database/sql/postgres-client-options'
import * as lookupViewGenerators from '../lookup/lookup-view-generators'
import {
  findObsoleteTables,
  findPreviousTableDefinition,
  formulaColumnsNeedRebuild,
  generateAlterTableStatements,
  needsTableRecreation,
  obsoleteTableDropStatement,
  type ObsoleteTable,
  type ViewTopologyStep,
} from '../schema-migration'
import {
  formatPopulatedDropRefusal,
  storedTableIdentityFor,
} from '../schema-migration/table-classification'
import { ambiguousRenameMessage, type TableRenameStep } from '../schema-migration/table-operations'
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
import { planFormulaRecomputes } from './formula-engine-recompute'
import { getPreviousSchema } from './migration-audit-trail'
import { sortTablesByDependencies } from './schema-dependency-sorting'
import { planRelationSet, type RelationPlan } from './schema-dry-run-relations'
import { planViewRebuilds } from './schema-dry-run-views'
import type { TransactionLike } from '../sql/sql-execution'
import type { App } from '@/domain/models/app'
import type { Table } from '@/domain/models/app/tables'
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
  /**
   * The relation that holds the table's rows TODAY, when Step 5.5 is about to
   * rename it: the plain `<name>` of a table becoming view-backed, or the
   * `<name>_base` of one ceasing to be. Its columns are what the column diff
   * reads — never the view's — and the statements are rendered against the
   * relation the rows will be in once the rename has run.
   */
  readonly introspect?: string
}

/** The plan for a table that does not exist yet — computable with no connection. */
const planNewTable = (
  table: Table,
  tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>,
  hasAuthConfig: boolean
): TableChange => ({
  table: table.name,
  relation: lookupViewGenerators.getPhysicalTableName(table),
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
  readonly physical: string
}): TableChange => {
  const {
    table,
    existingColumns,
    previousSchema,
    tablePrimaryKeyTypes,
    hasAuthConfig,
    refusals,
    physical,
  } = params
  const named = { table: table.name, relation: physical, refusals }
  const previous = findPreviousTableDefinition(table, tablePrimaryKeyTypes, previousSchema)
  const rebuilt = formulaColumnsNeedRebuild(table, existingColumns, previous) // as the apply path
  if (needsTableRecreation(table, existingColumns) || rebuilt || refusals.length > 0) {
    return { ...named, kind: 'recreate', statements: [], unsimulated: true }
  }

  const statements = generateAlterTableStatements({
    table,
    existingColumns,
    previousSchema,
    tablePrimaryKeyTypes,
    hasAuthConfig,
    physicalTableName: physical,
  })

  return statements.length === 0
    ? { ...named, kind: 'unchanged', statements: [], unsimulated: false }
    : { ...named, kind: 'alter', statements, unsimulated: false }
}

/**
 * The refusal a plan that could not be computed was refused WITH, if it was
 * refused rather than merely unavailable.
 *
 * `generateAlterTableStatements` states its two refusals by THROWING — an
 * ambiguous field rename, and a column drop without `allowDestructive: true` —
 * so they arrive as DEFECTS in the cause. A `SQLExecutionError` from the
 * introspection arrives as a typed FAILURE instead, and that is not a refusal:
 * it means the plan is unknown, not that it would be rejected. Reading only the
 * defect is what keeps the two apart.
 *
 * Before this existed the throw was caught and dropped, so the table came back
 * as an unsimulated `recreate` with an EMPTY refusal list — `sovrium migrate
 * --dry-run` closed with "Re-run without --dry-run to apply this plan" over a
 * plan that cannot be applied, and a `--watch` pre-flight reading `refusals`
 * saw nothing wrong. The refusal was always computable; nothing was reading it.
 */
const describePlanRefusal = (cause: Cause.Cause<unknown>): readonly string[] => {
  const defect = Cause.findDefect(cause)
  if (defect._tag !== 'Success') return []
  return [defect.success instanceof Error ? defect.success.message : String(defect.success)]
}

/** Plan one table, given the live columns the database reports. */
const planTable = (inputs: TablePlanInputs): Effect.Effect<TableChange, never> =>
  Effect.gen(function* () {
    const { tx, table, tablePrimaryKeyTypes, previousSchema, hasAuthConfig } = inputs
    const physical = lookupViewGenerators.getPhysicalTableName(table)
    const source = inputs.introspect ?? physical

    const exists = yield* tableExists(tx, source)
    if (!exists) return planNewTable(table, tablePrimaryKeyTypes, hasAuthConfig)

    const existingColumns = yield* getExistingColumns(tx, source)
    const refusals = yield* planRefusals({
      tx,
      table,
      physical: source,
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
      physical,
    })
  }).pipe(
    // A table whose plan cannot be computed is reported as unsimulated rather
    // than aborting the whole report. `generateAlterTableStatements` THROWS on
    // an ambiguous rename or a refused destructive drop, and losing every other
    // table's plan to one such table would make the mode useless exactly when
    // the operator most needs it. The throw is REPORTED as the refusal it is
    // (see `describePlanRefusal`) rather than swallowed: an operator whose plan
    // would be rejected needs the sentence naming what to do about it, and it
    // is the only thing about an unsimulated recreate that is knowable ahead of
    // time.
    Effect.catchCause((cause) =>
      Effect.succeed({
        table: inputs.table.name,
        relation: lookupViewGenerators.getPhysicalTableName(inputs.table),
        kind: 'recreate' as const,
        statements: [],
        unsimulated: true,
        refusals: describePlanRefusal(cause),
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
        // One connection: the view comparison creates a TEMPORARY probe view,
        // which lives in its session, then reads it back.
        Effect.sync(() => new SQL(postgresClientOptions(config.databaseUrl, { max: 1 }))),
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

/** A `drop` change for one obsolete table, refused when it holds rows and was not consented to. */
const planDrop = (
  entry: ObsoleteTable,
  options: PlanOptions,
  previousSchema: { readonly tables: readonly object[] } | undefined
): TableChange => ({
  table: entry.table,
  rows: entry.rows,
  kind: 'drop',
  statements: [obsoleteTableDropStatement(entry.table)],
  unsimulated: false,
  refusals:
    entry.rows > 0 && options.allowDestructive !== true
      ? [
          formatPopulatedDropRefusal(
            entry.table,
            entry.rows,
            storedTableIdentityFor(entry.table, previousSchema)
          ),
        ]
      : [],
})

/**
 * The drops Step 4 would run. The same read the apply path makes
 * (`findObsoleteTables`), so the plan names exactly the drop the migration would
 * run — or refuse.
 *
 * A failure to LIST the tables is reported as a refusal rather than as an empty
 * list: "nothing would be dropped" is a claim, and a planner that could not look
 * cannot make it.
 */
const planDrops = (
  tx: TransactionLike,
  tables: readonly Table[],
  options: PlanOptions,
  context: {
    readonly previousSchema: { readonly tables: readonly object[] } | undefined
    readonly renames: readonly TableRenameStep[]
  }
): Effect.Effect<readonly TableChange[], never> =>
  findObsoleteTables(tx, tables).pipe(
    Effect.map((obsolete) =>
      obsolete
        // A relation Step 3.5 renames is gone before Step 4 lists the leftovers.
        .filter(
          (entry) =>
            !entry.engineManaged && !context.renames.some((step) => step.from === entry.table)
        )
        .map((entry) => planDrop(entry, options, context.previousSchema))
    ),
    Effect.catch((error) =>
      Effect.succeed([
        {
          table: '(tables no longer in the config)',
          kind: 'drop' as const,
          statements: [],
          unsimulated: true,
          refusals: [`Could not list the tables the config no longer declares: ${error.message}`],
        },
      ])
    )
  )

/** A `rename` change for one Step 5.5 topology step that moves a table's rows. */
const planRename = (
  step: ViewTopologyStep & { readonly rename: NonNullable<ViewTopologyStep['rename']> }
): TableChange => ({
  table: step.table,
  from: step.rename.from,
  relation: step.rename.to,
  kind: 'rename',
  statements: step.statements,
  unsimulated: false,
  refusals: [],
})

/** A `rename` change for one Step 3.5 table rename (a name change under an authored id). */
const planTableRename = (step: TableRenameStep): TableChange => ({
  table: step.newName,
  from: step.from,
  relation: step.to,
  kind: 'rename',
  statements: step.statements,
  unsimulated: false,
  refusals: [],
})

/**
 * The changes Steps 3.5 and 5.5 report on their own: each table rename, or the
 * refusal of a rename cycle, and a catalog that could not be read.
 */
const relationChanges = (relations: RelationPlan): readonly TableChange[] => [
  ...(relations.ambiguous.length > 0
    ? [
        {
          table: [...relations.ambiguous].toSorted().join(', '),
          kind: 'rename' as const,
          statements: [],
          unsimulated: false,
          refusals: [ambiguousRenameMessage(relations.ambiguous)],
        },
      ]
    : relations.renames.map(planTableRename)),
  ...(relations.failure === undefined
    ? []
    : [
        {
          table: '(renamed tables, and tables with lookup, rollup or count fields)',
          kind: 'rename' as const,
          statements: [],
          unsimulated: true,
          refusals: [`Could not read which relation holds each table's rows: ${relations.failure}`],
        },
      ]),
]

/**
 * Plan one config table: the rename that moves its rows first, when Step 5.5
 * would run one, then its column changes against the relation it will have.
 */
const planTableWithTopology = (
  inputs: Omit<TablePlanInputs, 'introspect'>,
  relations: Pick<RelationPlan, 'renames' | 'steps'>
): Effect.Effect<readonly TableChange[], never> => {
  // A table Step 3.5 renames still holds its rows under the OLD relation when
  // the planner reads it; the statements are rendered against the new one.
  const before = new Map(relations.renames.map((step) => [step.to, step.from]))
  const step = relations.steps.find((candidate) => candidate.table === inputs.table.name)
  const rename = step?.rename
  if (step === undefined || rename === undefined) {
    const renamedFrom = before.get(lookupViewGenerators.getPhysicalTableName(inputs.table))
    return planTable(
      renamedFrom === undefined ? inputs : { ...inputs, introspect: renamedFrom }
    ).pipe(Effect.map((change) => [change]))
  }
  return planTable({ ...inputs, introspect: before.get(rename.from) ?? rename.from }).pipe(
    Effect.map((change) => [planRename({ ...step, rename }), change])
  )
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
      return [
        ...relationChanges(relations),
        ...drops,
        ...tableChanges.flat(),
        ...recomputes,
        ...views,
      ]
    })
  )
}
