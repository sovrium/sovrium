/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `--dry-run` plan for one config table: created, altered, recreated or
 * unchanged, the refusals the boot would raise, and the Step 5.5 rename that
 * moves its rows first.
 *
 * Split out of `schema-dry-run.ts`, which keeps the read-only connection and
 * the whole-config plan.
 */

import { Cause, Effect } from 'effect'
import * as lookupViewGenerators from '../lookup/lookup-view-generators'
import {
  findPreviousTableDefinition,
  formulaColumnsNeedRebuild,
  generateAlterTableStatements,
  needsTableRecreation,
  type ColumnDrop,
  type ViewTopologyStep,
} from '../schema-migration'
import { executeSQL, getExistingColumns, tableExists } from '../sql/sql-execution'
import { generateCreateTableSQL } from '../table-operations'
import { requiredColumnRefusals } from '../table-operations/required-column-preflight'
import {
  detectUnconvertibleRows,
  planTypeChangeProbes,
  resolveProbeIdColumn,
} from '../table-operations/type-change-preflight'
import { type RelationPlan } from './schema-dry-run-relations'
import { withSqliteDropRebuild } from './schema-dry-run-sqlite-drops'
import { withUniquePlan } from './schema-dry-run-unique'
import type { TableChange } from './schema-dry-run'
import type { TransactionLike } from '../sql/sql-execution'
import type { Table } from '@/domain/models/app/tables'
import type { DatabaseDialect } from '@/domain/models/process-env/database/database-dialect'

/** Everything one {@link planTable} call needs, bundled to keep arity low. */
export interface TablePlanInputs {
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
export const planNewTable = (
  table: Table,
  tablePrimaryKeyTypes: ReadonlyMap<string, string | undefined>,
  hasAuthConfig: boolean,
  dialect: DatabaseDialect
): TableChange => ({
  table: table.name,
  relation: lookupViewGenerators.getPhysicalTableName(table),
  kind: 'create',
  statements: [
    generateCreateTableSQL(table, {
      dialect,
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
  readonly dialect: DatabaseDialect
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
}): { readonly change: TableChange; readonly drops: readonly ColumnDrop[] } => {
  const {
    dialect,
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
  // As the apply path decides it.
  const rebuilt = formulaColumnsNeedRebuild(table, existingColumns, previous, dialect)
  if (needsTableRecreation(table, existingColumns, dialect) || rebuilt || refusals.length > 0) {
    return { change: { ...named, kind: 'recreate', statements: [], unsimulated: true }, drops: [] }
  }

  const { statements, drops } = generateAlterTableStatements({
    dialect,
    table,
    existingColumns,
    previousSchema,
    tablePrimaryKeyTypes,
    hasAuthConfig,
    physicalTableName: physical,
  })

  const kind = statements.length === 0 ? 'unchanged' : 'alter'
  return { change: { ...named, kind, statements, unsimulated: false }, drops }
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
    if (!exists) return planNewTable(table, tablePrimaryKeyTypes, hasAuthConfig, tx.dialect)

    const existingColumns = yield* getExistingColumns(tx, source)
    const refusals = yield* planRefusals({
      tx,
      table,
      physical: source,
      existingColumns,
      previousSchema,
    })

    const context = { tx, table, source, existingColumns }
    const { change: planned, drops } = planExistingTable({
      dialect: tx.dialect,
      table,
      existingColumns,
      previousSchema,
      tablePrimaryKeyTypes,
      hasAuthConfig,
      refusals,
      physical,
    })
    const change = yield* withSqliteDropRebuild({ ...context, drops, change: planned })
    const unique = yield* withUniquePlan({ ...context, change })
    const required = yield* requiredColumnRefusals({ ...context, previousSchema }).pipe(
      // effect-swallow: a row count that cannot run means "no refusal is PROVEN", not that one was found. This is a dry-run REPORT, so it keeps the plan rather than failing it; the apply path counts the rows again before any DDL and is where the refusal is enforced.
      Effect.orElseSucceed((): readonly string[] => [])
    )
    return required.length === 0
      ? unique
      : { ...unique, refusals: [...unique.refusals, ...required] }
  }).pipe(
    // A table whose plan cannot be computed is reported as unsimulated rather
    // than aborting the report: `generateAlterTableStatements` THROWS on an
    // ambiguous rename or a refused destructive drop, and losing every other
    // table's plan to it would make the mode useless when most needed. The throw
    // is REPORTED as the refusal it is (see `describePlanRefusal`): the sentence
    // naming what to do is the one thing about it knowable ahead of time.
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

/**
 * Plan one config table: the rename that moves its rows first, when Step 5.5
 * would run one, then its column changes against the relation it will have.
 */
export const planTableWithTopology = (
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
