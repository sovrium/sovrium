/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { and, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  emptyPreferencesResponse,
  UserPreferencesDbError,
  UserPreferencesWriteError,
  UserTablePreferencesRepository,
  type UpdatePreferencesResult,
  type UpdateUserTablePreferencesInput,
  type UserTablePreferencesResponse,
} from '@/application/ports/repositories/tables/user-table-preferences-repository'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { userTablePreferences as userTablePreferencesPg } from '@/infrastructure/database/drizzle/schema/user-views'
import { userTablePreferences as userTablePreferencesSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/user-views'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { DrizzleDB } from '@/infrastructure/database/drizzle/db'

const userTablePreferences = resolveDialectSchema(
  userTablePreferencesPg,
  userTablePreferencesSqlite
)

type PrefsRow = Readonly<typeof userTablePreferencesPg.$inferSelect>

const readJson = (raw: unknown): unknown => {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown
    } catch {
      return undefined
    }
  }
  return raw
}

const writeJson = (value: unknown): unknown =>
  isSqliteRuntime() && value !== undefined ? JSON.stringify(value) : value

const toPreferencesResponse = (row: PrefsRow): UserTablePreferencesResponse => ({
  tableName: row.tableName,
  columnWidths: readJson(row.columnWidths) ?? undefined,
  columnOrder: readJson(row.columnOrder) ?? undefined,
  rowDensity: row.rowDensity ?? undefined,
  defaultViewId: row.defaultViewId ?? undefined,
  frozenColumns: row.frozenColumns ?? undefined,
  updatedAt:
    row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt ?? ''),
})

const pickOr = <T>(value: T | undefined, fallback: T): T => (value === undefined ? fallback : value)

const buildValues = (
  input: Readonly<UpdateUserTablePreferencesInput>,
  current: PrefsRow | undefined
) => ({
  columnWidths: writeJson(pickOr(input.columnWidths, readJson(current?.columnWidths))) as any,
  columnOrder: writeJson(pickOr(input.columnOrder, readJson(current?.columnOrder))) as any,
  rowDensity: pickOr(input.rowDensity, current?.rowDensity ?? undefined),
  defaultViewId: pickOr(input.defaultViewId, current?.defaultViewId ?? undefined),
  frozenColumns: pickOr(input.frozenColumns, current?.frozenColumns ?? undefined),
})

const findCurrent = (
  db: Readonly<DrizzleDB>,
  input: { readonly userId: string; readonly tableName: string }
): Effect.Effect<PrefsRow | undefined, UserPreferencesDbError> =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(userTablePreferences)
        .where(
          and(
            eq(userTablePreferences.userId, input.userId),
            eq(userTablePreferences.tableName, input.tableName)
          )
        )
        .limit(1)
        .then((rows) => rows[0]),
    catch: (cause) => new UserPreferencesDbError({ cause }),
  })

const getPreferences = (
  db: Readonly<DrizzleDB>,
  input: { readonly userId: string; readonly tableName: string }
): Effect.Effect<UserTablePreferencesResponse, UserPreferencesDbError> =>
  Effect.gen(function* () {
    const current = yield* findCurrent(db, input)
    return current ? toPreferencesResponse(current) : emptyPreferencesResponse(input.tableName)
  })

const updatePreferences = (
  db: Readonly<DrizzleDB>,
  input: Readonly<UpdateUserTablePreferencesInput>
): Effect.Effect<UpdatePreferencesResult, UserPreferencesDbError | UserPreferencesWriteError> =>
  Effect.gen(function* () {
    const current = yield* findCurrent(db, input)
    const values = buildValues(input, current)

    if (current) {
      const updated = yield* Effect.tryPromise({
        try: () =>
          db
            .update(userTablePreferences)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(userTablePreferences.id, current.id))
            .returning(),
        catch: (cause) => new UserPreferencesDbError({ cause }),
      })
      const row = updated[0]
      if (!row) {
        return yield* new UserPreferencesWriteError({ message: 'Failed to update preferences' })
      }
      return { response: toPreferencesResponse(row), created: false }
    }

    const inserted = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(userTablePreferences)
          .values({ userId: input.userId, tableName: input.tableName, ...values })
          .returning(),
      catch: (cause) => new UserPreferencesDbError({ cause }),
    })
    const row = inserted[0]
    if (!row) {
      return yield* new UserPreferencesWriteError({ message: 'Failed to create preferences' })
    }
    return { response: toPreferencesResponse(row), created: true }
  })

const deletePreferences = (
  db: Readonly<DrizzleDB>,
  input: { readonly userId: string; readonly tableName: string }
): Effect.Effect<void, UserPreferencesDbError> =>
  Effect.tryPromise({
    try: () =>
      db
        .delete(userTablePreferences)
        .where(
          and(
            eq(userTablePreferences.userId, input.userId),
            eq(userTablePreferences.tableName, input.tableName)
          )
        )
        .then(() => undefined),
    catch: (cause) => new UserPreferencesDbError({ cause }),
  })

export const UserTablePreferencesRepositoryLive = Layer.effect(
  UserTablePreferencesRepository,
  Effect.gen(function* () {
    const db = yield* Database
    return UserTablePreferencesRepository.of({
      get: (input) => getPreferences(db, input),
      update: (input) => updatePreferences(db, input),
      delete: (input) => deletePreferences(db, input),
    })
  })
)
