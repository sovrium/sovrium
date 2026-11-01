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
 * green run and zero links, which looks exactly like success.
 *
 * `--mode upsert` is the one exception: `upsertProgram` writes base columns
 * only, so each row's link set is replaced afterwards (`links.ts`).
 *
 * ## Why many-to-many links are written after every table
 *
 * A junction row needs the rows at both of its ends, so a many-to-many field
 * orders no table (`table-order.ts`): `jobs.apps` beside `apps.job` would
 * otherwise be a cycle. Every table's rows go in first, in dependency order,
 * with their many-to-many fields left out; once the last table is written,
 * each table's links are written onto its rows, whichever table they point at.
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
import { linkTablesTouching } from '@/application/use-cases/seed/reset-app-data'
import { explainWriteFailure } from '@/application/use-cases/seed/seed-write-failure'
import { upsertProgram } from '@/application/use-cases/tables/batch-operations'
import {
  createRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/write-record-programs'
import { executeRawOn } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '@/infrastructure/database/table-queries/statement/validation'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { alignSeededAutonumbers } from './autonumber'
import { replaceSeededLinks, splitSeedLinks, upsertReportLine } from './links'
import { dryRunLines } from './report'
import { emptyKeyIndex, resolveSeedFields, seedAssetStore, withKey } from './resolve'
import {
  addCreatedLinks,
  resolveDeferredLinks,
  resolveEachRecord,
  rowFieldsOf,
  writeSelfLinks,
} from './row-links'
import { indexUpsertedKeys, partitionReplay, storeChangedAssets } from './upsert'
import { SeedWriteError } from './write-error'
import type { WriteRowLinks } from './links'
import type { Resolved, SeedKeyIndex, SeedResolveContext } from './resolve'
import type { UserSession } from '@/application/ports/contracts/user-session'
import type { SeedTableConfig } from '@/application/use-cases/seed/seed-config'
import type { PlannedSeedTable, SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { App } from '@/domain/models/app'
import type { SeedMode } from '@/domain/models/seed'
import type { DatabaseService } from '@/infrastructure/database/drizzle/layer'

export interface ExecuteSeedPlanInput {
  /** The database the run reads and writes. */
  readonly database: DatabaseService
  readonly app: Readonly<App>
  readonly plan: SeedPlan
  readonly tables: readonly SeedTableConfig[]
  readonly mode: SeedMode
  readonly seedDir: string
  readonly dryRun: boolean
  /** The actor every row is written as: the system, or the `--as` account. */
  readonly session: Readonly<UserSession>
  /** Account ids by lower-cased email, for `@user:<email>` values. */
  readonly accounts: ReadonlyMap<string, string>
}

/** The report line(s) one table produced, and the index after writing it. */
type TableOutcome = Resolved<readonly string[]>

/**
 * One table's rows written. Its many-to-many links, and with them its report
 * line, wait until every table's rows exist: `finish` writes them.
 */
interface TableRows {
  readonly index: SeedKeyIndex
  readonly finish: (index: SeedKeyIndex) => Promise<TableOutcome>
}

/** A table whose rows are all written and which has no link left to write. */
const finished = (index: SeedKeyIndex, lines: readonly string[]): TableRows => ({
  index,
  finish: (carried) => Promise.resolve({ value: lines, index: carried }),
})

/** Total rows in a table, INCLUDING soft-deleted ones. */
export const countRows = (
  { client, dialect }: DatabaseService,
  tableName: string
): Promise<number> => {
  return executeRawOn(
    dialect.kind,
    client,
    sql`SELECT COUNT(*) AS n FROM ${tableIdentifier(tableName)}`
  ).then((rows) => Number(rows[0]?.n ?? 0))
}

/** Hard-delete every row of a table, soft-deleted ones included. */
export const deleteAllRows = (
  { client, dialect }: DatabaseService,
  tableName: string
): Promise<void> => {
  return executeRawOn(dialect.kind, client, sql`DELETE FROM ${tableIdentifier(tableName)}`).then(
    () => undefined
  )
}

/**
 * Clear the junction rows that point at a table's rows before they are deleted.
 *
 * A junction carries a foreign key to both ends, so deleting the rows first
 * fails the constraint. Every link table with the table at either end is
 * cleared: its own fields' and every other table's many-to-many field to it,
 * a reciprocal declaration mirroring each link into the related table's own.
 * A junction that does not exist is not an error.
 */
export const clearJunctions = (
  { client, dialect }: DatabaseService,
  tableName: string,
  tables: readonly SeedTableConfig[]
): Promise<void> => {
  const junctions = linkTablesTouching(tableName, tables)
  return Promise.all(
    junctions.map((junction) => deleteAllRows({ client, dialect }, junction).catch(() => undefined))
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
  const resolved = await resolveSeedFields(context, index, rowFieldsOf(table, record.fields), {
    table: table.name,
    key: record.key,
  })
  const result = await runTableProgram(
    createRecordProgram({
      session: input.session,
      tableName: table.name,
      fields: resolved.value,
      app: input.app,
      origin: '',
    })
  )
  if (result._tag === 'Failure') {
    const explained = explainWriteFailure(result.failure, {
      table: input.tables.find((candidate) => candidate.name === table.name),
      fields: resolved.value,
    })
    throw new SeedWriteError(`${table.fileName} (key "${record.key}"): ${explained}`)
  }
  const { id } = result.success
  return typeof id === 'string' || typeof id === 'number'
    ? withKey(resolved.index, table.name, record.key, id)
    : resolved.index
}

/** Best-effort human text for whatever a table program failed with. */
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Every row of one table, sequentially — later rows may reference earlier ids. */
const createAll = (
  input: ExecuteSeedPlanInput,
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<TableRows> =>
  table.records
    .reduce<Promise<SeedKeyIndex>>(
      (previous, record) =>
        previous.then((carried) => createOne({ input, context, index: carried, table, record })),
      Promise.resolve(index)
    )
    .then((created) => writeSelfLinks(writeRowLinks(input, table), context, created, table))
    .then((next) => ({
      index: next,
      finish: async (carried) => ({
        value: [`${table.name}: created ${table.records.length} records`],
        index: await addCreatedLinks(writeRowLinks(input, table), context, carried, table),
      }),
    }))

/** Write a row's link fields onto it — the many-to-many half of an upsert. */
const writeRowLinks =
  (input: ExecuteSeedPlanInput, table: PlannedSeedTable): WriteRowLinks =>
  async (target, fields) => {
    const result = await runTableProgram(
      updateRecordProgram(input.session, table.name, String(target.id), {
        fields,
        app: input.app,
      })
    )
    if (result._tag === 'Failure') {
      const config = input.tables.find((one) => one.name === table.name)
      const explained = explainWriteFailure(result.failure, { table: config, fields })
      throw new SeedWriteError(`${table.fileName} (key "${target.key}"): ${explained}`)
    }
  }

/** Merge the rows a replay would change; a refusal names the file and the reason. */
const upsertChanged = async (
  input: ExecuteSeedPlanInput,
  table: PlannedSeedTable,
  changed: readonly Record<string, unknown>[]
): Promise<{ readonly created: number; readonly updated: number }> => {
  if (changed.length === 0) return { created: 0, updated: 0 }
  const result = await runTableProgram(
    upsertProgram(input.session, table.name, {
      recordsData: changed,
      fieldsToMergeOn: table.mergeOn,
      returnRecords: true,
      app: input.app,
    })
  )
  if (result._tag === 'Failure') {
    // A batch upsert does not say WHICH row it rejected; the driver's reason names the field.
    const failed = { table: input.tables.find((one) => one.name === table.name), fields: {} }
    throw new SeedWriteError(`${table.fileName}: ${explainWriteFailure(result.failure, failed)}`)
  }
  return result.success
}

/** Replay one table idempotently through the upsert path. */
const upsertAll = async (
  input: ExecuteSeedPlanInput,
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<TableRows> => {
  // An empty `records:` list is legal — under `--mode replace` it means "this
  // table should end up empty". There is nothing to merge, and handing the
  // upsert path an empty batch is a request no driver has a sensible answer to.
  if (table.records.length === 0) return finished(index, [`${table.name}: created 0, updated 0`])

  const resolved = await resolveEachRecord(
    { ...context, storeAssets: false },
    index,
    table,
    (fields) => rowFieldsOf(table, fields)
  )
  const bases = resolved.value
  const { changed, unchanged } = await partitionReplay(input.database, table, bases, input.app)
  await storeChangedAssets(context, table, bases, changed)
  const written = await upsertChanged(input, table, changed)
  const indexed = await indexUpsertedKeys(input.database, resolved.index, table, bases)
  const finish = async (carried: SeedKeyIndex): Promise<TableOutcome> => {
    const links = await resolveDeferredLinks(context, carried, table)
    const config = input.tables.find((one) => one.name === table.name)
    const rows = splitSeedLinks(table, links.value)
    const write = writeRowLinks(input, table)
    const relinked = await replaceSeededLinks({ table, config, index: links.index, rows, write })
    const relinkedOnly = table.records.filter(
      (record, position) =>
        relinked.has(record.key) && !changed.some((row) => row === bases[position])
    ).length
    const counts = { ...written, unchanged, relinkedOnly }
    return { value: [upsertReportLine({ table: table.name, ...counts })], index: links.index }
  }
  return {
    index: await writeSelfLinks(writeRowLinks(input, table), context, indexed, table),
    finish,
  }
}

/** Write one table according to the active mode. */
const seedOneTable = async (
  input: ExecuteSeedPlanInput,
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<TableRows> => {
  const existing = input.mode === 'if-empty' ? await countRows(input.database, table.name) : 0
  if (existing > 0) {
    return finished(index, [`${table.name}: skipped (${existing} rows already present)`])
  }
  const write = input.mode === 'upsert' ? upsertAll : createAll
  const outcome = await write(input, context, index, table)
  await alignSeededAutonumbers(input.database, table, input.tables)
  return outcome
}

/** Clear every in-scope table, children first, before anything is inserted. */
const runReplaceDeletes = (input: ExecuteSeedPlanInput): Promise<void> =>
  input.plan.order
    .toReversed()
    .reduce<Promise<void>>(
      (previous, name) =>
        previous
          .then(() => clearJunctions(input.database, name, input.tables))
          .then(() => deleteAllRows(input.database, name)),
      Promise.resolve()
    )
    .catch((error: unknown) => {
      throw new SeedWriteError(
        `--mode replace could not clear the target tables: ${describe(error)}. ` +
          `A table outside the seed set may hold a foreign key into one of them.`
      )
    })

/**
 * Run the plan and return the per-table report an operator reads in a journal,
 * with the id of every key it wrote — the accounts' grants are written after.
 *
 * Throws {@link SeedWriteError} on any failure — there is no partial-success
 * outcome, because `demo-reset.service` runs with `Type=oneshot` and the exit
 * code is the only signal the nightly reset produces.
 */
export const executeSeedPlan = async (input: ExecuteSeedPlanInput): Promise<TableOutcome> => {
  if (input.dryRun) {
    // `if-empty` skips a table that holds rows, so its plan says which ones would be skipped.
    const counted = input.mode === 'if-empty' ? input.plan.order : []
    const present = new Map(
      await Promise.all(counted.map(async (n) => [n, await countRows(input.database, n)] as const))
    )
    const lines = [...dryRunLines(input.plan, input.mode, present), '[dry-run] no changes written']
    return { value: lines, index: emptyKeyIndex }
  }

  const cleared = input.mode === 'replace' ? runReplaceDeletes(input) : Promise.resolve()
  const context: SeedResolveContext = {
    client: input.database.client,
    dialect: input.database.dialect,
    plan: input.plan,
    tables: input.tables,
    seedDir: input.seedDir,
    accounts: input.accounts,
    assetStore: seedAssetStore(),
  }

  const tables = input.plan.order.flatMap((name) => {
    const table = input.plan.tables.find((candidate) => candidate.name === name)
    return table === undefined ? [] : [table]
  })
  await cleared
  const rows = await tables.reduce<Promise<Resolved<readonly TableRows[]>>>(
    (previous, table) =>
      previous.then(async (carried) => {
        const written = await seedOneTable(input, context, carried.index, table)
        return { value: [...carried.value, written], index: written.index }
      }),
    Promise.resolve({ value: [], index: emptyKeyIndex })
  )
  // Every table's rows exist: each table's links go in, in the same order.
  return rows.value.reduce<Promise<TableOutcome>>(
    (previous, table) =>
      previous.then(async (carried) => {
        const done = await table.finish(carried.index)
        return { value: [...carried.value, ...done.value], index: done.index }
      }),
    Promise.resolve({ value: [], index: rows.index })
  )
}
