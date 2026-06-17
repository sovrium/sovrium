/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
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
import { Database } from '@/infrastructure/database/drizzle/layer'
import { userSavedViews } from '@/infrastructure/database/drizzle/schema/user-views'
import { isSqliteRuntime } from '@/infrastructure/database/unsupported-in-sqlite'
import type { DrizzleDB } from '@/infrastructure/database/drizzle/db'

type SavedViewRow = Readonly<typeof userSavedViews.$inferSelect>

const isUniqueViolation = (err: unknown): boolean => {
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes('unique') || message.includes('UNIQUE') || message.includes('duplicate key')
  )
}

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

const writeConfig = (config: Record<string, unknown>): Record<string, unknown> | string =>
  isSqliteRuntime() ? JSON.stringify(config) : config

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
    baseViewId:
      typeof baseViewId === 'string' || typeof baseViewId === 'number' || baseViewId === null
        ? baseViewId
        : undefined,
    createdAt,
    updatedAt,
  }
}

const extractConfigFromCreate = (
  input: Readonly<CreateUserViewInput>
): Record<string, unknown> => ({
  ...(input.filters !== undefined && { filters: input.filters }),
  ...(input.sorts !== undefined && { sorts: input.sorts }),
  ...(input.fields !== undefined && { fields: input.fields }),
  ...(input.groupBy !== undefined && { groupBy: input.groupBy }),
  ...(input.baseViewId !== undefined && { baseViewId: input.baseViewId }),
})

const mergeConfigKeys = (
  existing: Record<string, unknown>,
  body: Readonly<UpdateUserViewInput>
): Record<string, unknown> => ({
  ...existing,
  ...(body.filters !== undefined && { filters: body.filters }),
  ...(body.sorts !== undefined && { sorts: body.sorts }),
  ...(body.fields !== undefined && { fields: body.fields }),
  ...(body.groupBy !== undefined && { groupBy: body.groupBy }),
  ...(body.baseViewId !== undefined && { baseViewId: body.baseViewId }),
})

const resolveName = (input: Readonly<UpdateUserViewInput>, current: SavedViewRow): string =>
  input.name !== undefined && input.name.trim() !== '' ? input.name : current.name

const resolveIsDefault = (input: Readonly<UpdateUserViewInput>, current: SavedViewRow): boolean =>
  typeof input.isDefault === 'boolean' ? input.isDefault : current.isDefault === true

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
