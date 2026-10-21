/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// eslint-disable-next-line no-restricted-syntax -- Per-user entity lists are a cross-cutting concern, not phase-specific
import { Effect } from 'effect'
import { DataSourceRepository } from '@/application/ports/repositories/tables/data-source-repository'
import {
  UserEntityListRepository,
  type EntityMutation,
  type EntityRef,
  type FavoriteRow,
  type RecentRow,
  type UserEntityListDatabaseError,
} from '@/application/ports/repositories/tables/user-entity-list-repository'
import {
  callerListsTable,
  callerRecordJudge,
} from '@/application/use-cases/tables/permissions/caller-record-gate'
import { SHARED_POOL_FANOUT_CONCURRENCY } from '@/infrastructure/database/sql/db-effect'
import { logError } from '@/infrastructure/logging/logger'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { TableRepository } from '@/application/ports/repositories/tables/table-repository'
import type { App } from '@/domain/models/app'

/**
 * Use cases for the per-user entity-list APIs (`/api/favorites`, `/api/recent`).
 *
 * The application layer owns all orchestration and pure logic:
 *   - the revive-vs-insert branch (so re-favoriting / re-visiting never
 *     accumulates duplicate rows),
 *   - the read fan-out that lists back only the records the caller's list of
 *     their table admits ({@link filterReadableEntities}),
 *   - the refusal of an entry naming a table the caller may not list
 *     ({@link entityTableAdmits}),
 *   - the `?limit=` clamp and date serialization.
 *
 * Only the raw queries live in the infrastructure repository.
 */

/** Default cap on the number of recent items returned (and stored) per user. */
export const MAX_RECENT_ITEMS = 20

/** A favorite serialized for the API response (newest first). */
export interface FavoriteOutput {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly createdAt: string
}

/** A recent item serialized for the API response (most recently viewed first). */
export interface RecentOutput {
  readonly id: string
  readonly entityType: string
  readonly entityId: string
  readonly tableId: string | null
  readonly viewedAt: string
}

/** Serialize a `Date | string` timestamp to an ISO string. */
const toIso = (value: Readonly<Date> | string): string =>
  typeof value === 'string' ? value : value.toISOString()

/** What judging a caller's entries needs: the app, and who she is. */
export interface EntityListCaller {
  readonly app: App
  readonly userId: string
}

type ReadRequirements = AuthRepository | DataSourceRepository | TableRepository

/** A failed read of entry records, logged; the entries it concerns are left out. */
const loggedLookup = <A>(
  lookup: Effect.Effect<A, unknown, DataSourceRepository>,
  tableName: string,
  fallback: () => A
): Effect.Effect<A, never, DataSourceRepository> =>
  lookup.pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[ENTITY-LISTS] Record lookup failed; leaving the entries out', cause, {
          tableName,
        })
      )
    ),
    // effect-swallow: failing closed — an entry whose record cannot be read is left out, never listed.
    Effect.orElseSucceed(fallback)
  )

/**
 * The live records of the declared table `tableName` among `ids`, read in ONE
 * query. When that query faults — an id the table's key could never hold, on a
 * database that refuses to compare it — each id is read on its own instead, so
 * such an id costs only its own entry.
 */
const liveRecordsOf = (
  tableName: string,
  ids: readonly string[]
): Effect.Effect<readonly Readonly<Record<string, unknown>>[], never, DataSourceRepository> =>
  Effect.gen(function* () {
    const repo = yield* DataSourceRepository
    const readOne = (id: string) =>
      loggedLookup(
        repo.fetchSingleRecord(tableName, 'id', id, undefined, { liveOnly: true }),
        tableName,
        () => undefined
      )
    const oneByOne = Effect.forEach(ids, readOne, {
      concurrency: SHARED_POOL_FANOUT_CONCURRENCY,
    }).pipe(Effect.map((rows) => rows.filter((row) => row !== undefined)))
    return yield* repo
      .fetchRecords(tableName, {
        filter: [{ field: 'id', operator: 'in', value: [...ids] }],
        liveOnly: true,
      })
      .pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError('[ENTITY-LISTS] Batched record read failed; reading each entry', cause, {
              tableName,
            })
          )
        ),
        // effect-swallow: the entries are read one by one instead; each failure there is logged and left out.
        Effect.catch(() => oneByOne)
      )
  })

/**
 * The entry ids, per table, of the records the caller's list of that table
 * admits: the app declares the table, the record is live, and the records API
 * would list it to her (`callerRecordJudge`). Each table costs one judge and
 * one read whatever the number of its entries, and a table the app does not
 * declare is never read.
 */
const readableRecordKeys = (
  caller: EntityListCaller,
  entries: readonly EntityRef[]
): Effect.Effect<ReadonlySet<string>, never, ReadRequirements> =>
  Effect.gen(function* () {
    const recordEntries = entries.filter((entry) => entry.entityType === 'record')
    const idsByTable = Map.groupBy(recordEntries, (entry) => entry.tableId)
    // Only a declared table is ever read; an entry naming another is left out.
    const entryTables = (caller.app.tables ?? []).filter((table) => idsByTable.has(table.name))
    const perTable = yield* Effect.forEach(
      entryTables,
      (table) =>
        Effect.gen(function* () {
          const judge = yield* callerRecordJudge(caller.app, table, caller.userId)
          if (!judge.listsAnyRow) return []
          const ids = [...new Set((idsByTable.get(table.name) ?? []).map((e) => e.entityId))]
          const records = yield* liveRecordsOf(table.name, ids)
          return records
            .filter((record) => judge.admits(record))
            .map((record) => entryKey(table.name, String(record['id'])))
        }),
      { concurrency: SHARED_POOL_FANOUT_CONCURRENCY }
    )
    return new Set(perTable.flat())
  })

const entryKey = (tableName: string, entityId: string): string =>
  JSON.stringify([tableName, entityId])

/**
 * Filter a list of entity rows down to those the caller may still read,
 * preserving order. An entry for a removed record, a missing one, a record
 * her list does not admit and a table the app does not declare are all left
 * out alike. Pages, and entries naming no table, have no row to judge.
 */
const filterReadableEntities = <T extends EntityRef>(
  caller: EntityListCaller,
  rows: readonly T[]
): Effect.Effect<readonly T[], never, ReadRequirements> =>
  Effect.map(readableRecordKeys(caller, rows), (readable) =>
    rows.filter(
      (row) =>
        row.entityType !== 'record' ||
        row.tableId === null ||
        readable.has(entryKey(row.tableId, row.entityId))
    )
  )

/**
 * Whether the caller may keep an entry naming `input`'s table: a record of a
 * table the app does not declare, or of one whose list admits her no row, is
 * refused exactly as a table that does not exist. The record itself is not
 * judged, so keeping a record of a table she may list is accepted whatever
 * its id.
 */
const entityTableAdmits = (
  caller: EntityListCaller,
  input: EntityMutation
): Effect.Effect<boolean, never, ReadRequirements> =>
  input.entityType !== 'record' || input.tableName === null
    ? Effect.succeed(true)
    : callerListsTable({ app: caller.app, tableName: input.tableName, userId: caller.userId })

/**
 * List the caller's favorites, newest first. Soft-deleted favorites are
 * excluded by the repository; favorites whose record she may no longer read
 * are filtered out here (`filterReadableEntities`).
 */
export const ListFavorites = (
  caller: EntityListCaller
): Effect.Effect<
  readonly FavoriteOutput[],
  UserEntityListDatabaseError,
  UserEntityListRepository | ReadRequirements
> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    const rows = yield* repo.listFavorites(caller.userId)
    const visible = yield* filterReadableEntities(caller, rows)
    return visible.map((row: Readonly<FavoriteRow>): FavoriteOutput => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      tableId: row.tableId,
      createdAt: toIso(row.createdAt),
    }))
  }).pipe(Effect.withSpan('user-entity-lists.list-favorites'))

/**
 * Add an entity to the caller's favorites — `false`, and nothing kept, when
 * its table is one she may not list (`entityTableAdmits`). Reviving a soft-deleted row keeps a
 * single row per (user, entity, table) and resets `created_at` so the favorite
 * sorts to the top of the list.
 */
export const AddFavorite = (
  caller: EntityListCaller,
  input: EntityMutation
): Effect.Effect<
  boolean,
  UserEntityListDatabaseError,
  UserEntityListRepository | ReadRequirements
> =>
  Effect.gen(function* () {
    if (!(yield* entityTableAdmits(caller, input))) return false
    const repo = yield* UserEntityListRepository
    const { userId } = caller
    const existingId = yield* repo.findFavoriteId(
      userId,
      input.entityType,
      input.entityId,
      input.tableName
    )
    if (existingId !== undefined) {
      yield* repo.reviveFavorite(existingId, input.tableName)
      return true
    }
    yield* repo.insertFavorite(userId, input)
    return true
  }).pipe(Effect.withSpan('user-entity-lists.add-favorite'))

/**
 * Soft-delete an entity from the caller's favorites.
 */
export const RemoveFavorite = (
  userId: string,
  input: EntityMutation
): Effect.Effect<void, UserEntityListDatabaseError, UserEntityListRepository> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    yield* repo.softDeleteFavorite(userId, input.entityType, input.entityId, input.tableName)
  }).pipe(Effect.withSpan('user-entity-lists.remove-favorite'))

/**
 * List the caller's recent items, most recently viewed first. Items whose
 * record she may no longer read are filtered out (`filterReadableEntities`),
 * then the result is clamped to `limit`.
 */
export const ListRecent = (
  caller: EntityListCaller,
  limit: number
): Effect.Effect<
  readonly RecentOutput[],
  UserEntityListDatabaseError,
  UserEntityListRepository | ReadRequirements
> =>
  Effect.gen(function* () {
    const repo = yield* UserEntityListRepository
    const rows = yield* repo.listRecent(caller.userId)
    const visible = yield* filterReadableEntities(caller, rows)
    return visible.slice(0, limit).map((row: Readonly<RecentRow>): RecentOutput => ({
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      tableId: row.tableId,
      viewedAt: toIso(row.viewedAt),
    }))
  }).pipe(Effect.withSpan('user-entity-lists.list-recent'))

/**
 * Record a view of an entity for the caller — `false`, and nothing kept, when
 * its table is one she may not list (`entityTableAdmits`). Re-visiting an entity refreshes
 * the existing row's `viewed_at` so the recent list keeps a single row per
 * (user, entity, table): the same record id in another table is another entry. Inserting also prunes rows beyond `MAX_RECENT_ITEMS`.
 */
export const RecordRecent = (
  caller: EntityListCaller,
  input: EntityMutation
): Effect.Effect<
  boolean,
  UserEntityListDatabaseError,
  UserEntityListRepository | ReadRequirements
> =>
  Effect.gen(function* () {
    if (!(yield* entityTableAdmits(caller, input))) return false
    const repo = yield* UserEntityListRepository
    const { userId } = caller
    const existingId = yield* repo.findRecentId(
      userId,
      input.entityType,
      input.entityId,
      input.tableName
    )
    if (existingId !== undefined) {
      yield* repo.refreshRecent(existingId, input.tableName)
      return true
    }
    yield* repo.insertRecent(userId, input)
    yield* repo.pruneRecent(userId, MAX_RECENT_ITEMS)
    return true
  }).pipe(Effect.withSpan('user-entity-lists.record-recent'))
