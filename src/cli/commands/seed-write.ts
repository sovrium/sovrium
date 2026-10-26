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
 * only, so the many-to-many fields are split out first and each row's link set
 * is replaced afterwards (`seed-links.ts`).
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
import { referencesOf } from '@/application/use-cases/seed/seed-values'
import { explainWriteFailure } from '@/application/use-cases/seed/seed-write-failure'
import { upsertProgram } from '@/application/use-cases/tables/batch-operations'
import {
  createRecordProgram,
  updateRecordProgram,
} from '@/application/use-cases/tables/write-record-programs'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '@/infrastructure/database/table-queries/statement/validation'
import { runTableProgram } from '@/infrastructure/layers/table-layer'
import { alignSeededAutonumbers } from './seed-autonumber'
import {
  linkTablesTouching,
  replaceSeededLinks,
  splitSeedLinks,
  upsertReportLine,
} from './seed-links'
import { dryRunLines } from './seed-report'
import { emptyKeyIndex, idOfKey, resolveSeedFields, withKey } from './seed-resolve'
import { indexUpsertedKeys, partitionReplay, storeChangedAssets } from './seed-upsert'
import type { WriteRowLinks } from './seed-links'
import type { Resolved, SeedKeyIndex, SeedResolveContext } from './seed-resolve'
import type { UserSession } from '@/application/ports/contracts/user-session'
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
  /** The actor every row is written as: the system, or the `--as` account. */
  readonly session: Readonly<UserSession>
  /** Account ids by lower-cased email, for `@user:<email>` values. */
  readonly accounts: ReadonlyMap<string, string>
}

/** The report line(s) one table produced, and the index after writing it. */
type TableOutcome = Resolved<readonly string[]>

/** Total rows in a table, INCLUDING soft-deleted ones. */
export const countRows = (tableName: string): Promise<number> => {
  return executeRaw(db, sql`SELECT COUNT(*) AS n FROM ${tableIdentifier(tableName)}`).then((rows) =>
    Number(rows[0]?.n ?? 0)
  )
}

/** Hard-delete every row of a table, soft-deleted ones included. */
export const deleteAllRows = (tableName: string): Promise<void> => {
  return executeRaw(db, sql`DELETE FROM ${tableIdentifier(tableName)}`).then(() => undefined)
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
  tableName: string,
  tables: readonly SeedTableConfig[]
): Promise<void> => {
  const junctions = linkTablesTouching(tableName, tables)
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
  const resolved = await resolveSeedFields(context, index, withoutSelfLinks(table, record.fields), {
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

type PlannedFields = PlannedSeedTable['records'][number]['fields']

/** True when a planned value links to a row of `table` itself. */
const isSelfLink = (table: PlannedSeedTable, value: PlannedFields[string]): boolean =>
  referencesOf(value).some((ref) => ref.table === table.name)

/** A row's fields minus its links to the same table — what the insert writes. */
const withoutSelfLinks = (table: PlannedSeedTable, fields: PlannedFields): PlannedFields =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => !isSelfLink(table, value)))

/** Only a row's links to the same table — what the second pass writes. */
const selfLinksOf = (table: PlannedSeedTable, fields: PlannedFields): PlannedFields =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => isSelfLink(table, value)))

/**
 * The second pass: write every link a row makes to a row of its own table.
 *
 * A self-link cannot go in with the insert, because the row it names may be
 * defined later in the file and so have no id yet. Rows go in with the link
 * empty; once every row of the table exists, each link is written onto the row
 * that carries it. An `upsert` replay goes through here too, writing the same
 * link again onto the row it merged rather than onto a new one.
 */
const writeSelfLinks = (
  input: ExecuteSeedPlanInput,
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: PlannedSeedTable
): Promise<SeedKeyIndex> =>
  table.records
    .filter((record) => Object.keys(selfLinksOf(table, record.fields)).length > 0)
    .reduce<Promise<SeedKeyIndex>>(
      (previous, record) =>
        previous.then(async (carried) => {
          const resolved = await resolveSeedFields(
            context,
            carried,
            selfLinksOf(table, record.fields),
            { table: table.name, key: record.key }
          )
          const id = idOfKey(resolved.index, table.name, record.key)
          if (id === undefined) {
            throw new SeedWriteError(
              `${table.fileName} (key "${record.key}"): the row was not written, so its link ` +
                `to the same table cannot be.`
            )
          }
          const result = await runTableProgram(
            updateRecordProgram(input.session, table.name, String(id), {
              fields: resolved.value,
              app: input.app,
            })
          )
          if (result._tag === 'Failure') {
            const explained = explainWriteFailure(result.failure, {
              table: input.tables.find((candidate) => candidate.name === table.name),
              fields: resolved.value,
            })
            throw new SeedWriteError(`${table.fileName} (key "${record.key}"): ${explained}`)
          }
          return resolved.index
        }),
      Promise.resolve(index)
    )

/** Best-effort human text for whatever a table program failed with. */
const describe = (error: unknown) => (error instanceof Error ? error.message : String(error))

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
    .then((created) => writeSelfLinks(input, context, created, table))
    .then((next) => ({
      value: [`${table.name}: created ${table.records.length} records`],
      index: next,
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
        const one = await resolveSeedFields(
          { ...context, storeAssets: false },
          carried.index,
          withoutSelfLinks(table, record.fields),
          { table: table.name, key: record.key }
        )
        return { value: [...carried.value, one.value], index: one.index }
      }),
    Promise.resolve({ value: [], index })
  )
  const config = input.tables.find((one) => one.name === table.name)
  const split = splitSeedLinks(table, resolved.value)
  const bases = split.map((row) => row.base)
  const { changed, unchanged } = await partitionReplay(table, bases, input.app)
  await storeChangedAssets(context, table, bases, changed)
  const written = await upsertChanged(input, table, changed)
  const indexed = await indexUpsertedKeys(resolved.index, table, bases)
  const write = writeRowLinks(input, table)
  const relinked = await replaceSeededLinks({ table, config, index: indexed, rows: split, write })
  const relinkedOnly = table.records.filter(
    (record, position) =>
      relinked.has(record.key) && !changed.some((row) => row === bases[position])
  ).length
  const counts = { ...written, unchanged, relinkedOnly }
  const value = [upsertReportLine({ table: table.name, ...counts })]
  return { value, index: await writeSelfLinks(input, context, indexed, table) }
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
  const write = input.mode === 'upsert' ? upsertAll : createAll
  const outcome = await write(input, context, index, table)
  await alignSeededAutonumbers(table, input.tables)
  return outcome
}

/** Clear every in-scope table, children first, before anything is inserted. */
const runReplaceDeletes = (input: ExecuteSeedPlanInput): Promise<void> =>
  input.plan.order
    .toReversed()
    .reduce<Promise<void>>(
      (previous, name) =>
        previous.then(() => clearJunctions(name, input.tables)).then(() => deleteAllRows(name)),
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
      await Promise.all(counted.map(async (n) => [n, await countRows(n)] as const))
    )
    const lines = [...dryRunLines(input.plan, input.mode, present), '[dry-run] no changes written']
    return { value: lines, index: emptyKeyIndex }
  }

  const cleared = input.mode === 'replace' ? runReplaceDeletes(input) : Promise.resolve()
  const context: SeedResolveContext = {
    plan: input.plan,
    tables: input.tables,
    seedDir: input.seedDir,
    accounts: input.accounts,
  }

  return cleared.then(() =>
    input.plan.order.reduce<Promise<TableOutcome>>(
      (previous, name) =>
        previous.then(async (carried) => {
          const table = input.plan.tables.find((candidate) => candidate.name === name)
          if (table === undefined) return carried
          const written = await seedOneTable(input, context, carried.index, table)
          return { value: [...carried.value, ...written.value], index: written.index }
        }),
      Promise.resolve({ value: [], index: emptyKeyIndex })
    )
  )
}
