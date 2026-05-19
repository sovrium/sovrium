/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { BUILT_IN_ROLES } from '@/domain/models/app/auth/roles'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { users } from '@/infrastructure/auth/better-auth/schema'
import { db } from '@/infrastructure/database'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type { App } from '@/domain/models/app'

const knownRoleNames = (app: App): ReadonlySet<string> => {
  const custom = app.auth?.roles?.map((r) => r.name) ?? []
  return new Set<string>([...BUILT_IN_ROLES, ...custom])
}

const userExists = (userId: string): Effect.Effect<boolean> =>
  Effect.promise(() =>
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .then((rows) => rows.length > 0)
      .catch(() => false)
  )

const requireExistingUser = (
  userId: string,
  actionName: string
): Effect.Effect<'ok' | ActionOutcome> =>
  Effect.gen(function* () {
    if (userId === '') {
      return {
        status: 'failure',
        error: `${actionName} requires a non-empty \`userId\``,
      } as const satisfies ActionOutcome
    }
    const exists = yield* userExists(userId)
    if (!exists) {
      return {
        status: 'failure',
        error: `${actionName}: no user found with id '${userId}'`,
      } as const satisfies ActionOutcome
    }
    return 'ok' as const
  })

const updateUserRow = (
  userId: string,
  patch: Readonly<Partial<typeof users.$inferInsert>>
): Effect.Effect<void> =>
  Effect.promise(() =>
    db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .then(() => undefined)
      .catch(() => undefined)
  )

export const handleAuthAssignRole: ActionHandler = (action, app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const userId = stringProp(props, 'userId').trim()
    const role = stringProp(props, 'role').trim()

    if (userId !== '' && !knownRoleNames(app).has(role)) {
      return {
        status: 'failure',
        error: `auth.assignRole: '${role}' is not a valid role name (expected a built-in role or one declared in auth.roles)`,
      } as const satisfies ActionOutcome
    }

    const guard = yield* requireExistingUser(userId, 'auth.assignRole')
    if (guard !== 'ok') return guard

    yield* updateUserRow(userId, { role })

    return {
      status: 'success',
      output: { userId, role },
    } as const satisfies ActionOutcome
  })

export const handleAuthBanUser: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const userId = stringProp(props, 'userId').trim()
    const rawReason = stringProp(props, 'reason').trim()
    const reason = rawReason === '' ? undefined : rawReason

    const guard = yield* requireExistingUser(userId, 'auth.banUser')
    if (guard !== 'ok') return guard

    yield* updateUserRow(
      userId,
      reason === undefined ? { banned: true } : { banned: true, banReason: reason }
    )

    return {
      status: 'success',
      output: reason === undefined ? { userId } : { userId, reason },
    } as const satisfies ActionOutcome
  })

export const handleAuthUnbanUser: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const userId = stringProp(props, 'userId').trim()

    const guard = yield* requireExistingUser(userId, 'auth.unbanUser')
    if (guard !== 'ok') return guard

    yield* updateUserRow(userId, { banned: false, banReason: null })

    return {
      status: 'success',
      output: { userId },
    } as const satisfies ActionOutcome
  })

class AuthCreateUserError extends Data.TaggedError('AuthCreateUserError')<{
  readonly cause: unknown
  readonly message: string
}> {}

const provisionUser = (
  app: App,
  input: {
    readonly email: string
    readonly name: string
    readonly password: string | undefined
    readonly role: string | undefined
  }
): Effect.Effect<string, AuthCreateUserError> =>
  Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => {
        const authInstance = createAuthInstance(app.auth)
        const password =
          input.password && input.password.length > 0
            ? input.password
            : `${crypto.randomUUID().replace(/-/g, '')}A1!`
        return authInstance.api.createUser({
          body: {
            email: input.email,
            name: input.name,
            password,
            ...(input.role ? { role: input.role as 'user' | 'admin' } : {}),
          },
        })
      },
      catch: (cause) =>
        new AuthCreateUserError({
          cause,
          message:
            cause instanceof Error ? cause.message : `auth.createUser failed: ${String(cause)}`,
        }),
    })

    const userId = (result as { user?: { id?: string } } | undefined)?.user?.id
    if (typeof userId !== 'string' || userId.length === 0) {
      return yield* new AuthCreateUserError({
        cause: undefined,
        message: 'Better Auth createUser returned no user id',
      })
    }
    return userId
  })

export const handleAuthCreateUser: ActionHandler = (action, app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const email = stringProp(props, 'email').trim()
    const name = stringProp(props, 'name').trim()
    const rawPassword = stringProp(props, 'password').trim()
    const password = rawPassword === '' ? undefined : rawPassword
    const rawRole = stringProp(props, 'role').trim()
    const role = rawRole === '' ? undefined : rawRole

    if (email === '') {
      return {
        status: 'failure',
        error: 'auth.createUser requires a non-empty `email`',
      } as const satisfies ActionOutcome
    }

    if (name === '') {
      return {
        status: 'failure',
        error: 'auth.createUser requires a non-empty `name`',
      } as const satisfies ActionOutcome
    }

    if (role !== undefined && !knownRoleNames(app).has(role)) {
      return {
        status: 'failure',
        error: `auth.createUser: '${role}' is not a valid role name (expected a built-in role or one declared in auth.roles)`,
      } as const satisfies ActionOutcome
    }

    const created = yield* Effect.either(provisionUser(app, { email, name, password, role }))
    if (created._tag === 'Left') {
      return {
        status: 'failure',
        error: `auth.createUser: ${created.left.message}`,
      } as const satisfies ActionOutcome
    }

    return {
      status: 'success',
      output: { userId: created.right, email, name },
    } as const satisfies ActionOutcome
  })
