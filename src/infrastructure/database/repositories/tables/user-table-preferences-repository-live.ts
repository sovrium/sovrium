/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live implementation of `UserTablePreferencesRepository` (Phase 9 Cycle 5).
 *
 * Owns ALL Drizzle queries against `system.user_table_preferences` plus the
 * dialect-aware JSON codec and the DB-row → wire-response transform. Lifted
 * out of the application-layer use-case programs (which now consume the
 * `UserTablePreferencesRepository` port) so the infrastructure dependency is
 * isolated at this single boundary.
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

// Select the active dialect's table at runtime. Importing the pg-core table
// directly 500-ed every query on SQLite (the Drizzle client is initialized with
// the sqlite-core schema map, so the pg-core table object is not found).
const userTablePreferences = resolveDialectSchema(
  userTablePreferencesPg,
  userTablePreferencesSqlite
)

type PrefsRow = Readonly<typeof userTablePreferencesPg.$inferSelect>

/**
 * Decode a JSON column across dialects. PostgreSQL JSONB round-trips an
 * object directly; SQLite stores TEXT and needs `JSON.parse`.
 */
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

/** Encode a JSON column for storage. SQLite needs stringify; pg-core does not. */
const writeJson = (value: unknown): unknown =>
  isSqliteRuntime() && value !== undefined ? JSON.stringify(value) : value

/** Map a Drizzle row to the wire-response shape consumed by clients. */
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

/** Pick `body[key]` if defined, else the fallback. */
const pickOr = <T>(value: T | undefined, fallback: T): T => (value === undefined ? fallback : value)

/** Merge PATCH body into existing row's column-value bag for storage. */
const buildValues = (
  input: Readonly<UpdateUserTablePreferencesInput>,
  current: PrefsRow | undefined
) => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dialect-conditional shape
  columnWidths: writeJson(pickOr(input.columnWidths, readJson(current?.columnWidths))) as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dialect-conditional shape
  columnOrder: writeJson(pickOr(input.columnOrder, readJson(current?.columnOrder))) as any,
  rowDensity: pickOr(input.rowDensity, current?.rowDensity ?? undefined),
  defaultViewId: pickOr(input.defaultViewId, current?.defaultViewId ?? undefined),
  frozenColumns: pickOr(input.frozenColumns, current?.frozenColumns ?? undefined),
})

/** Find the existing preferences row for `(userId, tableName)`. */
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

/** Read prefs for caller+table; canonical empty response when none exist. */
const getPreferences = (
  db: Readonly<DrizzleDB>,
  input: { readonly userId: string; readonly tableName: string }
): Effect.Effect<UserTablePreferencesResponse, UserPreferencesDbError> =>
  Effect.gen(function* () {
    const current = yield* findCurrent(db, input)
    return current ? toPreferencesResponse(current) : emptyPreferencesResponse(input.tableName)
  })

/** Upsert prefs (PATCH merge); `created` distinguishes insert (201) vs update (200). */
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

/** Delete prefs row for caller+table; idempotent (no-op when absent). */
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

/**
 * Live `UserTablePreferencesRepository` — resolves the `Database` Drizzle
 * handle once, then closes over it for every method.
 */
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
