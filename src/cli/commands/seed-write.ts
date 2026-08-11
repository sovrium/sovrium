/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Execute a validated seed plan against the database.
 *
 * ## Why writes go through `createRecordProgram`, one row at a time
 *
 * `batchCreateProgram` is the obvious choice and it is the wrong one: it never
 * calls `splitManyToManyFields`, so a `many-to-many` field reaches the base
 * INSERT as a phantom column. Only `createRecordProgram` splits link fields out
 * and writes the junction rows. A seeder wired to the batch program produces a
 * green run and zero links — the most expensive failure available here, because
 * it looks exactly like success.
 *
 * `--mode upsert` is the one exception, and it is why upsert refuses
 * many-to-many data at planning time: `upsertProgram` writes base columns only.
 *
 * ## Why `replace` deletes with raw SQL
 *
 * There is no delete-all program in the codebase, and building an id list first
 * would be both slower and wrong — `batchDeleteRecords` probes every id and
 * refuses the whole batch if one vanished between the read and the write. A
 * single `DELETE FROM` also takes soft-deleted rows with it, which `replace`
 * requires: leaving a ghost recoverable means a demo visitor restoring records
 * surfaces another visitor's data.
 */

import { sql } from 'drizzle-orm'
import { buildSystemSession } from '@/application/use-cases/automations/build-guest-session'
import { explainWriteFailure } from '@/application/use-cases/seed/seed-write-failure'
import { createRecordProgram, upsertProgram } from '@/application/use-cases/tables/programs'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { generateJunctionTableName } from '@/infrastructure/database/sql/sql-junction-tables'
import { validateTableName } from '@/infrastructure/database/table-queries/shared/validation'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { emptyKeyIndex, resolveSeedFields, withKey } from './seed-resolve'
import type { Resolved, SeedKeyIndex, SeedResolveContext } from './seed-resolve'
import type { SeedTableConfig } from '@/application/use-cases/seed/seed-config'
import type { PlannedSeedTable, SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { App } from '@/domain/models/app'
import type { SeedMode } from '@/domain/models/seed'

/** A refusal or failure during the write phase. Message is printed verbatim. */
export class SeedWriteError extends Error {}

export interface ExecuteSeedPlanInput {
  readonly app: Readonly<App>
  readonly plan: SeedPlan
  readonly tables: readonly SeedTableConfig[]
  readonly mode: SeedMode
  readonly seedDir: string
  readonly dryRun: boolean
}

/** The report line(s) one table produced, and the index after writing it. */
type TableOutcome = Resolved<readonly string[]>

/** Total rows in a table, INCLUDING soft-deleted ones. */
const countRows = (tableName: string): Promise<number> => {
  validateTableName(tableName)
  return executeRaw(db, sql`SELECT COUNT(*) AS n FROM ${sql.identifier(tableName)}`).then((rows) =>
    Number(rows[0]?.n ?? 0)
  )
}

/** Hard-delete every row of a table, soft-deleted ones included. */
const deleteAllRows = (tableName: string): Promise<void> => {
  validateTableName(tableName)
  return executeRaw(db, sql`DELETE FROM ${sql.identifier(tableName)}`).then(() => undefined)
}

/**
 * Clear the junction rows a table owns before its own rows are deleted.
 *
 * A junction carries a foreign key to both ends, so deleting the owning rows
 * first fails the constraint. Both directions are cleared because a reciprocal
 * many-to-many declaration mirrors every link into `<related>_<source>` too.
 * A junction that does not exist is not an error — the pair may be declared
 * from one side only.
 */
const clearJunctions = (tableName: string, config: SeedTableConfig | undefined): Promise<void> => {
  const related = (config?.fields ?? [])
    .filter((field) => field.type === 'relationship' && field.relationType === 'many-to-many')
    .flatMap((field) => (field.relatedTable === undefined ? [] : [field.relatedTable]))
  const junctions = related.flatMap((other) => [
    generateJunctionTableName(tableName, other),
    generateJunctionTableName(other, tableName),
  ])
  return Promise.all(
    junctions.map((junction) => deleteAllRows(junction).catch(() => undefined))
  ).then(() => undefined)
}

/** Insert one row through the record-create path (splits many-to-many links). */
const createOne = async (step: {
  readonly input: ExecuteSeedPlanInput
  readonly context: SeedResolveContext
  readonly index: SeedKeyIndex
  readonly table: PlannedSeedTable
  readonly record: PlannedSeedTable['records'][number]
}): Promise<SeedKeyIndex> => {
  const { input, context, index, table, record } = step
  const resolved = await resolveSeedFields(context, index, record.fields)
  const result = await runTableProgram(
    createRecordProgram({
      session: buildSystemSession(),
      tableName: table.name,
      fields: resolved.value,
      app: input.app,
      origin: '',
    })
  )
  if (result._tag === 'Left') {
    const explained = explainWriteFailure(result.left, {
      table: input.tables.find((candidate) => candidate.name === table.name),
      fields: resolved.value,
    })
    // eslint-disable-next-line functional/no-throw-statements -- caught by handleSeedCommand, which prints and exits 1
    throw new SeedWriteError(`${table.fileName} (key "${record.key}"): ${explained}`)
  }
  const { id } = result.right
  return typeof id === 'string' || typeof id === 'number'
    ? withKey(resolved.index, table.name, record.key, id)
    : resolved.index
}

/** Best-effort human text for whatever a table program failed with. */
const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** Every row of one table, sequentially — later rows may reference earlier ids. */
const createAll = (
  input: ExecuteSeedPlanInput,
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<TableOutcome> =>
  table.records
    .reduce<Promise<SeedKeyIndex>>(
      (previous, record) =>
        previous.then((carried) => createOne({ input, context, index: carried, table, record })),
      Promise.resolve(index)
    )
    .then((next) => ({
      value: [`${table.name}: created ${table.records.length} records`],
      index: next,
    }))

/** Match every seeded key back to the row `upsert` merged it onto. */
const indexUpsertedKeys = (
  index: SeedKeyIndex,
  table: PlannedSeedTable,
  resolved: readonly Record<string, unknown>[]
): Promise<SeedKeyIndex> => {
  validateTableName(table.name)
  const matches = (row: Record<string, unknown>, fields: Record<string, unknown>): boolean =>
    table.mergeOn.every((column) => String(row[column]) === String(fields[column]))
  return executeRaw(db, sql`SELECT * FROM ${sql.identifier(table.name)}`).then((rows) =>
    table.records.reduce<SeedKeyIndex>((carried, record, position) => {
      const fields = resolved[position]
      const row = fields === undefined ? undefined : rows.find((one) => matches(one, fields))
      const id = row?.id
      return typeof id === 'string' || typeof id === 'number'
        ? withKey(carried, table.name, record.key, id)
        : carried
    }, index)
  )
}

/** Replay one table idempotently through the upsert path. */
const upsertAll = async (
  input: ExecuteSeedPlanInput,
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<TableOutcome> => {
  // An empty `records:` list is legal — under `--mode replace` it means "this
  // table should end up empty". There is nothing to merge, and handing the
  // upsert path an empty batch is a request no driver has a sensible answer to.
  if (table.records.length === 0) {
    return { value: [`${table.name}: created 0, updated 0`], index }
  }

  const resolved = await table.records.reduce<
    Promise<Resolved<readonly Record<string, unknown>[]>>
  >(
    (previous, record) =>
      previous.then(async (carried) => {
        const one = await resolveSeedFields(context, carried.index, record.fields)
        return { value: [...carried.value, one.value], index: one.index }
      }),
    Promise.resolve({ value: [], index })
  )
  const result = await runTableProgram(
    upsertProgram(buildSystemSession(), table.name, {
      recordsData: resolved.value,
      fieldsToMergeOn: table.mergeOn,
      returnRecords: true,
      app: input.app,
    })
  )
  if (result._tag === 'Left') {
    // A batch upsert does not say WHICH row it rejected, so no value can be
    // attributed without guessing. The driver's own reason still names the
    // constraint, which names the field.
    const explained = explainWriteFailure(result.left, {
      table: input.tables.find((candidate) => candidate.name === table.name),
      fields: {},
    })
    // eslint-disable-next-line functional/no-throw-statements -- caught by handleSeedCommand, which prints and exits 1
    throw new SeedWriteError(`${table.fileName}: ${explained}`)
  }
  const next = await indexUpsertedKeys(resolved.index, table, resolved.value)
  return {
    value: [`${table.name}: created ${result.right.created}, updated ${result.right.updated}`],
    index: next,
  }
}

/** Write one table according to the active mode. */
const seedOneTable = async (
  input: ExecuteSeedPlanInput,
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<TableOutcome> => {
  const existing = input.mode === 'if-empty' ? await countRows(table.name) : 0
  if (existing > 0) {
    return { value: [`${table.name}: skipped (${existing} rows already present)`], index }
  }
  return input.mode === 'upsert'
    ? upsertAll(input, context, index, table)
    : createAll(input, context, index, table)
}

/** Clear every in-scope table, children first, before anything is inserted. */
const runReplaceDeletes = (input: ExecuteSeedPlanInput): Promise<void> =>
  input.plan.order
    .toReversed()
    .reduce<Promise<void>>(
      (previous, name) =>
        previous
          .then(() =>
            clearJunctions(
              name,
              input.tables.find((table) => table.name === name)
            )
          )
          .then(() => deleteAllRows(name)),
      Promise.resolve()
    )
    .catch((error: unknown) => {
      // eslint-disable-next-line functional/no-throw-statements -- caught by handleSeedCommand, which prints and exits 1
      throw new SeedWriteError(
        `--mode replace could not clear the target tables: ${describe(error)}. ` +
          `A table outside the seed set may hold a foreign key into one of them.`
      )
    })

/** The report a `--dry-run` prints instead of writing. */
const dryRunLines = (plan: SeedPlan): readonly string[] =>
  plan.order.flatMap((name) => {
    const table = plan.tables.find((candidate) => candidate.name === name)
    return table === undefined
      ? []
      : [`[dry-run] ${name}: would create ${table.records.length} records`]
  })

/**
 * Run the plan and return the per-table report an operator reads in a journal.
 *
 * Throws {@link SeedWriteError} on any failure — there is no partial-success
 * outcome, because `demo-reset.service` runs with `Type=oneshot` and the exit
 * code is the only signal the nightly reset produces.
 */
export const executeSeedPlan = async (input: ExecuteSeedPlanInput): Promise<readonly string[]> => {
  if (input.dryRun) return [...dryRunLines(input.plan), '[dry-run] no changes written']

  const cleared = input.mode === 'replace' ? runReplaceDeletes(input) : Promise.resolve()
  const context: SeedResolveContext = {
    plan: input.plan,
    tables: input.tables,
    seedDir: input.seedDir,
  }

  return cleared.then(() =>
    input.plan.order
      .reduce<Promise<TableOutcome>>(
        (previous, name) =>
          previous.then(async (carried) => {
            const table = input.plan.tables.find((candidate) => candidate.name === name)
            if (table === undefined) return carried
            const written = await seedOneTable(input, context, carried.index, table)
            return { value: [...carried.value, ...written.value], index: written.index }
          }),
        Promise.resolve({ value: [], index: emptyKeyIndex })
      )
      .then((outcome) => outcome.value)
  )
}
