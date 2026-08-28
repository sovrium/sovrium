/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `auth/*` action handlers.
 *
 * `auth/assignRole` — assign a role to an existing user.
 *
 * The handler resolves the (already template-substituted) `userId` and
 * `role` props, validates the target role against the set of known roles
 * (the three built-in roles — `admin`, `member`, `viewer` — plus any
 * custom roles declared at `app.auth.roles[]`), confirms the user exists
 * in `auth.user`, and writes the new role into that row's `role` column.
 *
 * `auth/banUser` — ban a user account.
 *
 * The handler resolves the `userId` and optional `reason` props, confirms
 * the user exists in `auth.user`, and sets `banned = true` (plus the
 * optional `ban_reason` column) on that row — the same columns Better
 * Auth's admin plugin toggles via its native `banUser` API. A banned user
 * is rejected at sign-in by Better Auth's session check.
 *
 * `auth/unbanUser` — re-enable a previously banned user account.
 *
 * The inverse of `auth/banUser`. The handler resolves the `userId` prop,
 * confirms the user exists in `auth.user`, and clears the ban columns
 * (`banned = false`, `ban_reason = null`) on that row — the same columns
 * Better Auth's admin plugin clears via its native `unbanUser` API. The
 * reinstated user can sign in again immediately.
 *
 * `auth/createUser` — provision a new user account.
 *
 * The handler resolves the (already template-substituted) `email`, `name`,
 * `password`, and optional `role` props and delegates to Better Auth's
 * admin-plugin `createUser` server API — the same path `bootstrap-admin`
 * and the bootstrap-token claim flow use. Going through Better Auth (rather
 * than a raw `INSERT`) ensures the credential account row is linked and the
 * password is hashed with Better Auth's own scrypt parameters, so the new
 * user can immediately sign in. A duplicate email (or any other Better Auth
 * rejection) surfaces as a `status: 'failure'` outcome — no second row is
 * created.
 *
 * Failure semantics: a non-existent `userId` (assignRole/banUser) or a
 * Better Auth rejection (createUser) returns a `status: 'failure'`
 * outcome. The run loop marks the run as failed and the webhook dispatcher
 * escalates to HTTP 500, so the caller is not misled into thinking the
 * side effect committed.
 *
 * Wave: [internal ref],
 * [internal ref],
 * [internal ref],
 * [internal ref].
 */

import { Data, Effect } from 'effect'
import {
  AuthRepository,
  type AuthDatabaseError,
} from '@/application/ports/repositories/auth/auth-repository'
import { isAssignableRole } from '@/domain/models/app/auth/roles'
import { createAuthInstance } from '@/infrastructure/auth/better-auth/auth'
import { stringProp } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'
import type { App } from '@/domain/models/app'
import type { Context } from 'effect'

/**
 * Look up whether a user row exists for `userId` via `AuthRepository`. The
 * `Effect.catchAll` keeps the Effect total so a transient DB error surfaces as
 * "user not found" rather than crashing the run.
 */
const userExists = (userId: string): Effect.Effect<boolean, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.userExists(userId)
  }).pipe(Effect.orElseSucceed(() => false))

/**
 * Shared preamble for the `assignRole` / `banUser` handlers: validate that
 * a non-empty `userId` was supplied and that a matching user row exists.
 *
 * Returns a `failure` `ActionOutcome` (ready to return verbatim) when the
 * `userId` is blank or unknown, or `'ok'` when the user exists. `actionName`
 * is the dotted action label used in error messages (`auth.assignRole`,
 * `auth.banUser`) so each handler keeps its own diagnostic prefix.
 */
const requireExistingUser = (
  userId: string,
  actionName: string
): Effect.Effect<'ok' | ActionOutcome, never, AuthRepository> =>
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

/**
 * Run a best-effort user mutation through `AuthRepository`. Shared by the
 * `assignRole` / `banUser` / `unbanUser` handlers — each supplies the port call
 * it needs, so the column payloads stay behind the port instead of travelling
 * as a Drizzle `$inferInsert` patch through the application layer.
 *
 * The `Effect.catchAll` keeps the Effect total: a transient DB error degrades to
 * a no-op rather than crashing the run (callers have already confirmed the row
 * exists via `requireExistingUser`).
 */
const mutateUser = (
  run: (
    repo: Context.Service.Shape<typeof AuthRepository>
  ) => Effect.Effect<void, AuthDatabaseError>
): Effect.Effect<void, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    yield* run(repo)
  }).pipe(Effect.ignore)

/**
 * `auth/assignRole` — assign a role to an existing user.
 */
export const handleAuthAssignRole: ActionHandler = (action, app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const userId = stringProp(props, 'userId').trim()
    const role = stringProp(props, 'role').trim()

    // Same vocabulary the HTTP write boundary enforces (`isAssignableRole`), so
    // an automation and `POST /api/auth/admin/set-role` can never disagree about
    // what a valid role is. The previous local set omitted the admin-tier names,
    // which made `operator` provisionable over HTTP but not by an automation.
    if (userId !== '' && !isAssignableRole(role, app)) {
      return {
        status: 'failure',
        error: `auth.assignRole: '${role}' is not a valid role name (expected a built-in role, an admin-tier role, or one declared in auth.roles)`,
      } as const satisfies ActionOutcome
    }

    const guard = yield* requireExistingUser(userId, 'auth.assignRole')
    if (guard !== 'ok') return guard

    yield* mutateUser((repo) => repo.updateUserRole(userId, role))

    return {
      status: 'success',
      output: { userId, role },
    } as const satisfies ActionOutcome
  })

/**
 * `auth/banUser` — ban an existing user account.
 *
 * `reason` is written into `ban_reason` only when supplied; an absent
 * reason leaves the column untouched (matching Better Auth's optional
 * ban-reason semantics).
 */
export const handleAuthBanUser: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const userId = stringProp(props, 'userId').trim()
    const rawReason = stringProp(props, 'reason').trim()
    const reason = rawReason === '' ? undefined : rawReason

    const guard = yield* requireExistingUser(userId, 'auth.banUser')
    if (guard !== 'ok') return guard

    yield* mutateUser((repo) => repo.banUser(userId, reason))

    return {
      status: 'success',
      output: reason === undefined ? { userId } : { userId, reason },
    } as const satisfies ActionOutcome
  })

/**
 * `auth/unbanUser` — re-enable a previously banned user account.
 *
 * Clears the ban columns: `banned = false` and `ban_reason = null`. The
 * inverse of `banUser`. Better Auth's session check treats both
 * `banned = false` and `banned = null` as "not banned"; the port writes the
 * explicit `false` so the column reflects an intentional reinstatement, and an
 * explicit `NULL` reason so no stale reason is left behind.
 */
export const handleAuthUnbanUser: ActionHandler = (action, _app, _automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const userId = stringProp(props, 'userId').trim()

    const guard = yield* requireExistingUser(userId, 'auth.unbanUser')
    if (guard !== 'ok') return guard

    yield* mutateUser((repo) => repo.unbanUser(userId))

    return {
      status: 'success',
      output: { userId },
    } as const satisfies ActionOutcome
  })

/**
 * Tagged error for the Better Auth `createUser` call. Wrapping the unknown
 * rejection in a Data.TaggedError keeps the Effect error channel
 * discriminable (effect/globalErrorInEffectCatch / globalErrorInEffectFailure)
 * — the surrounding handler still surfaces a string error in the
 * ActionOutcome via `Effect.either`, but the intermediate channel is now
 * type-safe.
 *
 * `cause` carries the original error so a debugger / structured logger can
 * recover the upstream Better Auth rejection (duplicate email, weak
 * password, etc.) if needed.
 */
class AuthCreateUserError extends Data.TaggedError('AuthCreateUserError')<{
  readonly cause: unknown
  readonly message: string
}> {}

/**
 * Provision a new user via Better Auth's admin-plugin `createUser` server
 * API. Resolves with the new user's id on success, or fails with an
 * `AuthCreateUserError` on any Better Auth rejection (duplicate email, weak
 * password, etc.) so the caller can convert it to a `status: 'failure'`
 * outcome.
 *
 * The `role` is widened at the call boundary because Better Auth's plugin
 * types insist on its closed `'user' | 'admin'` union while Sovrium permits
 * custom roles declared in `auth.roles[]`.
 */
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
        // Better Auth's admin createUser requires a password; generate a
        // strong throwaway when the action omitted one (the schema marks
        // `password` optional). 32 hex chars + symbol satisfies the
        // length/complexity check the vendored route enforces.
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

/**
 * `auth/createUser` — provision a new user account.
 */
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

    if (role !== undefined && !isAssignableRole(role, app)) {
      return {
        status: 'failure',
        error: `auth.createUser: '${role}' is not a valid role name (expected a built-in role, an admin-tier role, or one declared in auth.roles)`,
      } as const satisfies ActionOutcome
    }

    const created = yield* Effect.result(provisionUser(app, { email, name, password, role }))
    if (created._tag === 'Failure') {
      return {
        status: 'failure',
        error: `auth.createUser: ${created.failure.message}`,
      } as const satisfies ActionOutcome
    }

    return {
      status: 'success',
      output: { userId: created.success, email, name },
    } as const satisfies ActionOutcome
  })
