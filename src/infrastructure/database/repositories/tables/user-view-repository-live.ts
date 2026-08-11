/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Live implementation of `UserViewRepository` (Phase 9 Cycle 5).
 *
 * Owns ALL Drizzle queries against `system.user_saved_views` plus the
 * dialect-aware `config` JSONB codec and the DB-row → wire-response
 * transform. Lifted out of the application-layer use-case programs (which now
 * consume the `UserViewRepository` port) so the infrastructure dependency is
 * isolated at this single boundary.
 *
 * Unique-name collisions on `(user_id, table_name, name)` are translated to
 * `UserViewConflictError`; any other DB failure becomes `UserViewDbError`.
 */

import { and, asc, eq } from 'drizzle-orm'
import { Effect, Layer } from 'effect'
import {
  UserViewConflictError,
  UserViewDbError,
  UserViewNotFoundError,
  UserViewRepository,
  type CreateUserViewInput,
  type UpdateUserViewInput,
  type UserViewResponse,
} from '@/application/ports/repositories/tables/user-view-repository'
import { findConstraintViolation } from '@/domain/errors/driver-failure'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import { Database } from '@/infrastructure/database/drizzle/layer'
import { userSavedViews as userSavedViewsPg } from '@/infrastructure/database/drizzle/schema/user-views'
import { userSavedViews as userSavedViewsSqlite } from '@/infrastructure/database/drizzle/schema-sqlite/user-views'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { DrizzleDB } from '@/infrastructure/database/drizzle/db'

// Select the active dialect's table at runtime. Importing the pg-core table
// directly 500-ed every query on SQLite (the Drizzle client is initialized with
// the sqlite-core schema map, so the pg-core table object is not found).
const userSavedViews = resolveDialectSchema(userSavedViewsPg, userSavedViewsSqlite)

type SavedViewRow = Readonly<typeof userSavedViewsPg.$inferSelect>

/**
 * Detect a unique-constraint violation on either dialect.
 *
 * Delegates to the canonical driver classifier, which matches on the driver's
 * own result code (Postgres SQLSTATE `23505` via `errno`, SQLite
 * `SQLITE_CONSTRAINT_UNIQUE`) instead of on message text.
 *
 * The previous substring test was over-broad in a way that inverted the error
 * contract: `message.includes('unique')` also matches Drizzle's own wrapper text
 * — e.g. `Failed query: ... CREATE UNIQUE INDEX ...` — so an infrastructure
 * fault during schema work could surface to the caller as a 409 "name already
 * taken" instead of a 500.
 */
const isUniqueViolation = (err: unknown): boolean => findConstraintViolation(err) === 'unique'

/**
 * Normalize the `config` blob across dialects.
 *
 * PostgreSQL: `jsonb` column round-trips a JS object directly.
 * SQLite:     stored as TEXT — manually `JSON.parse` on read.
 */
const readConfig = (raw: unknown): Record<string, unknown> => {
  if (raw === null || raw === undefined) return {}
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return raw as Record<string, unknown>
}

/**
 * Encode `config` for storage. SQLite needs `JSON.stringify`; pg-core takes
 * objects directly.
 */
const writeConfig = (config: Record<string, unknown>): Record<string, unknown> | string =>
  isSqliteRuntime() ? JSON.stringify(config) : config

/**
 * The Wave-4 presentation keys — the shape + layout a view was saved in, as
 * opposed to the record predicate (`filters` / `sorts` / `fields` / `groupBy`).
 *
 * Named once because these three travel together through every layer of the
 * saved-view contract, and the trio was previously spelled out separately on
 * the read path and on both write paths.
 */
const PRESENTATION_KEYS = ['viewType', 'rowDensity', 'columnWidths'] as const

/**
 * Project the keys a source object actually carries.
 *
 * An ABSENT key stays absent rather than becoming `key: undefined`: the client
 * distinguishes "this view expressed no opinion" (inherit the user's
 * `user-preferences`) from an explicit value, and on SQLite the blob is
 * `JSON.stringify`d, where an explicit `undefined` is dropped but a `null` is
 * not — so presence is the only signal that survives the round trip.
 */
const pickPresent = (
  source: Readonly<Record<string, unknown>>,
  keys: readonly string[]
): Record<string, unknown> =>
  Object.fromEntries(
    keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])
  )

/** Project the Wave-4 presentation keys out of a stored `config` blob. */
const readPresentationState = (config: Record<string, unknown>): Record<string, unknown> =>
  pickPresent(config, PRESENTATION_KEYS)

/**
 * Map a Drizzle row into the wire-response shape expected by the API
 * contract (consumed by clients through `userViewResponseSchema`).
 */
const toViewResponse = (row: SavedViewRow): UserViewResponse => {
  const config = readConfig(row.config)
  const { baseViewId } = config
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
  const updatedAt =
    row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt)
  return {
    id: row.id,
    name: row.name,
    tableName: row.tableName,
    isDefault: row.isDefault === true,
    filters: config['filters'] ?? undefined,
    sorts: config['sorts'] ?? undefined,
    fields: config['fields'] ?? undefined,
    groupBy: config['groupBy'] ?? undefined,
    ...readPresentationState(config),
    baseViewId:
      typeof baseViewId === 'string' || typeof baseViewId === 'number' || baseViewId === null
        ? baseViewId
        : undefined,
    createdAt,
    updatedAt,
  }
}

/**
 * The complete set of keys persisted inside the `config` JSONB blob — the
 * PERSISTENCE half of the saved-view contract.
 *
 * This is an explicit allow-list, not a body spread: accepting a key in
 * `userViewPatchSchema` and PERSISTING it are two different decisions, and a
 * spread would quietly write whatever a future validator started admitting.
 *
 * It is stated ONCE because the create path and the PATCH path were previously
 * two hand-maintained copies of the same eight keys. They had already been
 * edited in lockstep twice (baseViewId, then the Wave-4 presentation trio); the
 * third time is the one that gets missed, and the symptom — a key that
 * validates, reaches the repository, and is then dropped on the way to the
 * column — looks like a successful write from every layer above.
 *
 * `satisfies` ties the list to BOTH input types, so a key renamed on either
 * port interface fails to compile here instead of silently ceasing to persist.
 */
const CONFIG_KEYS = [
  'filters',
  'sorts',
  'fields',
  'groupBy',
  ...PRESENTATION_KEYS,
  'baseViewId',
] as const satisfies readonly (keyof CreateUserViewInput & keyof UpdateUserViewInput)[]

/** Extract the `config` blob from a create-payload (everything but name/isDefault). */
const extractConfigFromCreate = (input: Readonly<CreateUserViewInput>): Record<string, unknown> =>
  pickPresent(input as Record<string, unknown>, CONFIG_KEYS)

/** Merge PATCH config keys into the existing JSON config. */
const mergeConfigKeys = (
  existing: Record<string, unknown>,
  body: Readonly<UpdateUserViewInput>
): Record<string, unknown> => ({
  ...existing,
  ...pickPresent(body as Record<string, unknown>, CONFIG_KEYS),
})

/** Resolve the next `name` value, falling back to the existing row. */
const resolveName = (input: Readonly<UpdateUserViewInput>, current: SavedViewRow): string =>
  input.name !== undefined && input.name.trim() !== '' ? input.name : current.name

/** Resolve the next `isDefault` value, falling back to the existing row. */
const resolveIsDefault = (input: Readonly<UpdateUserViewInput>, current: SavedViewRow): boolean =>
  typeof input.isDefault === 'boolean' ? input.isDefault : current.isDefault === true

/** Find the caller's owned row by `(viewId, userId, tableName)`. */
const findOwnedRow = (
  db: Readonly<DrizzleDB>,
  input: Readonly<UpdateUserViewInput>
): Effect.Effect<SavedViewRow | undefined, UserViewDbError> =>
  Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(userSavedViews)
        .where(
          and(
            eq(userSavedViews.id, input.viewId),
            eq(userSavedViews.userId, input.userId),
            eq(userSavedViews.tableName, input.tableName)
          )
        )
        .limit(1)
        .then((rows) => rows[0]),
    catch: (cause) => new UserViewDbError({ cause }),
  })

/** List the caller's saved views for `tableName`, ordered oldest-first. */
const listViews = (
  db: Readonly<DrizzleDB>,
  input: { readonly userId: string; readonly tableName: string }
): Effect.Effect<readonly UserViewResponse[], UserViewDbError> =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(userSavedViews)
          .where(
            and(
              eq(userSavedViews.userId, input.userId),
              eq(userSavedViews.tableName, input.tableName)
            )
          )
          .orderBy(asc(userSavedViews.createdAt)),
      catch: (cause) => new UserViewDbError({ cause }),
    })
    return rows.map(toViewResponse)
  })

/** Insert a saved view; map unique-name collisions to UserViewConflictError. */
const createView = (
  db: Readonly<DrizzleDB>,
  input: Readonly<CreateUserViewInput>
): Effect.Effect<
  UserViewResponse,
  UserViewConflictError | UserViewDbError | UserViewNotFoundError
> =>
  Effect.gen(function* () {
    const config = extractConfigFromCreate(input)
    const inserted = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(userSavedViews)
          .values({
            userId: input.userId,
            tableName: input.tableName,
            name: input.name,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dialect-conditional payload shape
            config: writeConfig(config) as any,
            isDefault: input.isDefault === true,
          })
          .returning(),
      catch: (cause) =>
        isUniqueViolation(cause)
          ? new UserViewConflictError({ message: 'A view with that name already exists' })
          : new UserViewDbError({ cause }),
    })
    const row = inserted[0]
    if (!row) {
      return yield* new UserViewNotFoundError({})
    }
    return toViewResponse(row)
  })

/** Update an owned saved view; merge config + map collisions to conflict. */
const updateView = (
  db: Readonly<DrizzleDB>,
  input: Readonly<UpdateUserViewInput>
): Effect.Effect<
  UserViewResponse,
  UserViewConflictError | UserViewDbError | UserViewNotFoundError
> =>
  Effect.gen(function* () {
    const current = yield* findOwnedRow(db, input)
    if (!current) {
      return yield* new UserViewNotFoundError({ viewId: input.viewId })
    }
    const mergedConfig = mergeConfigKeys(readConfig(current.config), input)
    const updated = yield* Effect.tryPromise({
      try: () =>
        db
          .update(userSavedViews)
          .set({
            name: resolveName(input, current),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dialect-conditional payload shape
            config: writeConfig(mergedConfig) as any,
            isDefault: resolveIsDefault(input, current),
            updatedAt: new Date(),
          })
          .where(eq(userSavedViews.id, input.viewId))
          .returning(),
      catch: (cause) =>
        isUniqueViolation(cause)
          ? new UserViewConflictError({ message: 'A view with that name already exists' })
          : new UserViewDbError({ cause }),
    })
    const row = updated[0]
    if (!row) {
      return yield* new UserViewNotFoundError({ viewId: input.viewId })
    }
    return toViewResponse(row)
  })

/** Delete an owned saved view; surface a no-op as UserViewNotFoundError. */
const deleteView = (
  db: Readonly<DrizzleDB>,
  input: { readonly userId: string; readonly tableName: string; readonly viewId: string }
): Effect.Effect<void, UserViewDbError | UserViewNotFoundError> =>
  Effect.gen(function* () {
    const deleted = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(userSavedViews)
          .where(
            and(
              eq(userSavedViews.id, input.viewId),
              eq(userSavedViews.userId, input.userId),
              eq(userSavedViews.tableName, input.tableName)
            )
          )
          .returning({ id: userSavedViews.id }),
      catch: (cause) => new UserViewDbError({ cause }),
    })
    if (deleted.length === 0) {
      return yield* new UserViewNotFoundError({ viewId: input.viewId })
    }
  })

/** Resolve a saved view by id (no ownership scoping); missing → not-found. */
const getSharedView = (
  db: Readonly<DrizzleDB>,
  input: { readonly viewId: string }
): Effect.Effect<UserViewResponse, UserViewDbError | UserViewNotFoundError> =>
  Effect.gen(function* () {
    const rows = yield* Effect.tryPromise({
      try: () =>
        db.select().from(userSavedViews).where(eq(userSavedViews.id, input.viewId)).limit(1),
      catch: (cause) => new UserViewDbError({ cause }),
    })
    const row = rows[0]
    if (!row) {
      return yield* new UserViewNotFoundError({ viewId: input.viewId })
    }
    return toViewResponse(row)
  })

/**
 * Live `UserViewRepository` — resolves the `Database` Drizzle handle once,
 * then closes over it for every method.
 */
export const UserViewRepositoryLive = Layer.effect(
  UserViewRepository,
  Effect.gen(function* () {
    const db = yield* Database
    return UserViewRepository.of({
      list: (input) => listViews(db, input),
      create: (input) => createView(db, input),
      update: (input) => updateView(db, input),
      delete: (input) => deleteView(db, input),
      getShared: (input) => getSharedView(db, input),
    })
  })
)
