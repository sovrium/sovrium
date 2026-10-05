/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Turn planned intents into the concrete values a record write takes.
 *
 * Two of the three intents need something that does not exist at planning time:
 * a `@table.key` needs an id the database has just assigned, and an
 * `@asset:file` needs a storage key the upload has just returned. This module
 * owns both, plus the one case the planner deliberately deferred.
 *
 * ## The deferred case: a reference into a table this run did not write
 *
 * `--mode if-empty` skips a table that already has rows, and `--table` can
 * exclude a parent entirely — yet the child still has to point at it. The user
 * story calls this out as the *normal* path, not an edge: "a table added to a
 * template later gets seeded on the next nightly run without disturbing the
 * ones already populated". Its parents are, by construction, already populated.
 *
 * So an unresolved key falls back to a database lookup for the row that seed
 * record WOULD have created — matched on the file's `mergeOn` if it has one,
 * else the table's `unique: true` columns, else every literal scalar the row
 * declares. A miss is a refusal, never a null link: inserting a child with a
 * dangling parent and exiting `0` is precisely what the refusal catalogue
 * exists to prevent.
 *
 * ## Why the key index is threaded rather than mutated
 *
 * Resolution is a fold: each reference may add a discovered id that later
 * references reuse (fifty children of one skipped parent issue one query, not
 * fifty). Threading the index through the fold keeps that cache explicit and
 * keeps every function here referentially transparent apart from its I/O.
 */

import { sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { StorageService } from '@/application/ports/services'
import { inferMimeFromKey } from '@/domain/kernel/identity/mime-types'
import { SYSTEM_BUCKET_NAME } from '@/domain/models/app/buckets/bucket-identity'
import { db } from '@/infrastructure/database'
import { executeRaw } from '@/infrastructure/database/sql/dialect-execute'
import { tableIdentifier } from '@/infrastructure/database/table-queries/statement/validation'
import { StorageServiceLive } from '@/infrastructure/storage/storage-service-live'
import { buildUploadStorageKey } from '@/infrastructure/storage/upload-key'
import type { SeedTableConfig } from '@/application/use-cases/seed/seed-config'
import type { PlannedSeedTable, SeedPlan } from '@/application/use-cases/seed/seed-plan'
import type { SeedValue } from '@/application/use-cases/seed/seed-values'

/** Record ids observed so far, keyed by table and seed key. */
export type SeedKeyIndex = ReadonlyMap<string, string | number>

/** Composite index key. `\0` cannot occur in a table name or a seed key. */
const indexKey = (table: string, key: string): string => `${table}\0${key}`

/** The empty index a run starts from. */
export const emptyKeyIndex: SeedKeyIndex = new Map<string, string | number>()

/** A copy of `index` that also knows `table.key`. Never mutates its input. */
export const withKey = (
  index: SeedKeyIndex,
  table: string,
  key: string,
  id: string | number
): SeedKeyIndex => new Map([...index, [indexKey(table, key), id] as const])

/** The id this run recorded for `table.key`, or `undefined`. */
export const idOfKey = (
  index: SeedKeyIndex,
  table: string,
  key: string
): string | number | undefined => index.get(indexKey(table, key))

/** A resolved value paired with the index the resolution may have extended. */
export interface Resolved<T> {
  readonly value: T
  readonly index: SeedKeyIndex
}

/** Refusal raised while resolving a value — its message is printed verbatim. */
export class SeedResolutionError extends Error {}

/** Everything value resolution needs beyond the value itself. */
export interface SeedResolveContext {
  readonly plan: SeedPlan
  readonly tables: readonly SeedTableConfig[]
  readonly seedDir: string
  /** Account ids by lower-cased email, for `@user:<email>` values. */
  readonly accounts: ReadonlyMap<string, string>
}

/** The id behind one `@user:<email>`. Planning already refused an unknown one. */
const resolveAccountId = (context: SeedResolveContext, email: string): string => {
  const id = context.accounts.get(email.toLowerCase())
  if (id === undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- caught by handleSeedCommand, which prints and exits 1
    throw new SeedResolutionError(`no account has the email "${email}".`)
  }
  return id
}

/**
 * Run async steps strictly in order, threading the index through each.
 *
 * Order matters twice over: a later row may reference an id an earlier row
 * created, and the index cache is only useful if writes to it are observed by
 * the steps that follow.
 */
const foldSequential = <T, R>(
  items: readonly T[],
  index: SeedKeyIndex,
  step: (index: SeedKeyIndex, item: T) => Promise<Resolved<R>>
): Promise<Resolved<readonly R[]>> =>
  items.reduce<Promise<Resolved<readonly R[]>>>(
    (previous, item) =>
      previous.then(async (accumulated) => {
        const next = await step(accumulated.index, item)
        return { value: [...accumulated.value, next.value], index: next.index }
      }),
    Promise.resolve({ value: [], index })
  )

/**
 * Upload one `seed/assets/<file>` into the bucket its field declares — the
 * built-in `system` bucket for a field that names none — and return the bare
 * storage key. The read path resolves the key through the same bucket, so a
 * file stored anywhere else would never be found.
 */
const uploadAsset = async (seedDir: string, filename: string, bucket: string): Promise<string> => {
  const source = Bun.file(`${seedDir}/assets/${filename}`)
  if (!(await source.exists())) {
    // eslint-disable-next-line functional/no-throw-statements -- caught by handleSeedCommand, which prints and exits 1
    throw new SeedResolutionError(`asset "${filename}" not found in ${seedDir}/assets`)
  }
  const key = buildUploadStorageKey(filename)
  const bytes = new Uint8Array(await source.arrayBuffer())
  const program = Effect.gen(function* () {
    const storage = yield* StorageService
    yield* storage.upload(key, bytes, inferMimeFromKey(filename), bucket)
  })
  return Effect.runPromise(Effect.provide(program, StorageServiceLive)).then(() => key)
}

const findConfig = (
  tables: readonly SeedTableConfig[],
  name: string
): SeedTableConfig | undefined => tables.find((table) => table.name === name)

/** The columns that identify one seed row in the database, and their values. */
const identifyingColumns = (
  table: PlannedSeedTable,
  config: SeedTableConfig | undefined,
  fields: Readonly<Record<string, SeedValue>>
): readonly (readonly [string, unknown])[] => {
  const literals = Object.entries(fields).flatMap(([name, value]) =>
    value.kind === 'literal' && value.value !== null && value.value !== undefined
      ? ([[name, value.value]] as const)
      : []
  )
  const unique = (config?.fields ?? [])
    .filter((field) => field.unique === true)
    .map((field) => field.name)
  const preferred = table.mergeOn.length > 0 ? table.mergeOn : unique
  const narrowed = literals.filter(([name]) => preferred.includes(name))
  return preferred.length > 0 && narrowed.length === preferred.length ? narrowed : literals
}

/** `SELECT id` for the row a seed record would have created, or `undefined`. */
const findExistingId = async (
  tableName: string,
  columns: readonly (readonly [string, unknown])[]
): Promise<string | number | undefined> => {
  if (columns.length === 0) return undefined
  const predicate = sql.join(
    columns.map(([name, value]) => sql`${sql.identifier(name)} = ${value}`),
    sql.raw(' AND ')
  )
  const rows = await executeRaw(
    db,
    sql`SELECT id FROM ${tableIdentifier(tableName)} WHERE ${predicate} ORDER BY id LIMIT 1`
  )
  const id = rows[0]?.id
  return typeof id === 'string' || typeof id === 'number' ? id : undefined
}

/** The id behind one `@table.key`, from this run or from the database. */
const resolveReferenceId = async (
  context: SeedResolveContext,
  index: SeedKeyIndex,
  table: string,
  key: string
): Promise<Resolved<string | number>> => {
  const known = index.get(indexKey(table, key))
  if (known !== undefined) return { value: known, index }

  const planned = context.plan.tables.find((candidate) => candidate.name === table)
  const record = planned?.records.find((candidate) => candidate.key === key)
  if (!planned || !record) {
    // eslint-disable-next-line functional/no-throw-statements -- caught by handleSeedCommand, which prints and exits 1
    throw new SeedResolutionError(
      `cannot resolve @${table}.${key} — no seed file declares a row keyed "${key}" in "${table}".`
    )
  }

  const columns = identifyingColumns(planned, findConfig(context.tables, table), record.fields)
  const existing = await findExistingId(table, columns)
  if (existing === undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- caught by handleSeedCommand, which prints and exits 1
    throw new SeedResolutionError(
      `cannot resolve @${table}.${key} — "${table}" was not written by this run ` +
        `(skipped by --mode if-empty, or outside --table) and no existing row matches that ` +
        `seed record. Re-run without --table, or with --mode replace, so "${table}" is ` +
        `written first.`
    )
  }
  return { value: existing, index: withKey(index, table, key, existing) }
}

/** Resolve one planned value into what the write path stores. */
const resolveSeedValue = async (
  context: SeedResolveContext,
  index: SeedKeyIndex,
  value: SeedValue,
  bucket: string
): Promise<Resolved<unknown>> => {
  if (value.kind === 'literal') return { value: value.value, index }
  if (value.kind === 'asset') {
    return uploadAsset(context.seedDir, value.filename, bucket).then((key) => ({
      value: key,
      index,
    }))
  }
  if (value.kind === 'assets') {
    return foldSequential(value.filenames, index, async (carried, filename) => ({
      value: await uploadAsset(context.seedDir, filename, bucket),
      index: carried,
    }))
  }
  if (value.kind === 'ref') {
    return resolveReferenceId(context, index, value.ref.table, value.ref.key)
  }
  if (value.kind === 'user') return { value: resolveAccountId(context, value.email), index }
  if (value.kind === 'users') {
    return { value: value.emails.map((email) => resolveAccountId(context, email)), index }
  }
  return foldSequential(value.refs, index, (carried, ref) =>
    resolveReferenceId(context, carried, ref.table, ref.key)
  )
}

/** Resolve every field of one row, threading the key index through. */
export const resolveSeedFields = (
  context: SeedResolveContext,
  index: SeedKeyIndex,
  fields: Readonly<Record<string, SeedValue>>,
  tableName: string
): Promise<Resolved<Record<string, unknown>>> =>
  foldSequential(Object.entries(fields), index, async (carried, [name, value]) => {
    const bucket =
      findConfig(context.tables, tableName)?.fields.find((field) => field.name === name)?.bucket ??
      SYSTEM_BUCKET_NAME
    const resolved = await resolveSeedValue(context, carried, value, bucket)
    return { value: [name, resolved.value] as const, index: resolved.index }
  }).then((resolved) => ({
    value: Object.fromEntries(resolved.value),
    index: resolved.index,
  }))
