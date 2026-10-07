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
 * in `auth.user`, refuses a write that would demote the last admin who can
 * still sign in (checked before the write and again after it), writes the new
 * role into that row's `role` column, and records a change that stood on the
 * admin audit trail as `user.role.changed`, attributed to the automation.
 *
 * `auth/banUser` — ban a user account.
 *
 * The handler resolves the `userId` and optional `reason` props, confirms
 * the user exists in `auth.user`, refuses to ban the last admin who can still
 * sign in (before the write and again after it), and sets `banned = true` (plus the
 * optional `ban_reason` column) on that row — the same columns Better
 * Auth's admin plugin toggles via its native `banUser` API. A banned user
 * is rejected at sign-in by Better Auth's session check. A ban that stood is
 * recorded on the admin audit trail as `user.banned`, attributed to the
 * automation, with no end and never with its reason.
 *
 * `auth/unbanUser` — re-enable a previously banned user account.
 *
 * The inverse of `auth/banUser`. The handler resolves the `userId` prop,
 * confirms the user exists in `auth.user`, and clears the ban columns
 * (`banned = false`, `ban_reason = null`) on that row — the same columns
 * Better Auth's admin plugin clears via its native `unbanUser` API. The
 * reinstated user can sign in again immediately. A ban that was really lifted
 * is recorded as `user.unbanned`; running it for an account that was not
 * banned records nothing.
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
 * Wave: the automations actions auth assign role requirement,
 */

import { Data, Effect } from 'effect'
import {
  AuthRepository,
  type AuthDatabaseError,
} from '@/application/ports/repositories/auth/auth-repository'
import { ConfigAccountProvisioner } from '@/application/ports/services/account-provisioner'
import {
  assignRoleUnderLastAdminRail,
  banUnderLastAdminRail,
} from '@/application/use-cases/auth/last-admin-rail'
import { readUserBannedById } from '@/application/use-cases/auth/read-user-ban-state'
import {
  recordBan,
  recordRoleChange,
  recordUnban,
} from '@/application/use-cases/auth/record-user-acts'
import { isAssignableRole } from '@/domain/models/app/auth/roles'
import { roleChangeOf } from '@/domain/models/app/auth/roles/role-write-validation'
import { logError } from '@/infrastructure/logging/logger'
import { actionAttributes, stringProp } from './shared'
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
  }).pipe(
    // effect-swallow: stated in the doc comment above — "cannot tell" answers as "user not found", which is the conservative direction: the caller refuses the action rather than performing it against a user it could not confirm.
    Effect.orElseSucceed(() => false)
  )

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
 * Run a best-effort user mutation through `AuthRepository` (the `unbanUser`
 * handler; `assignRole` and `banUser` write under the last-admin rail, which
 * reports whether the write applied). The column payload stays behind the port
 * instead of travelling as a Drizzle `$inferInsert` patch through the
 * application layer.
 *
 * Yields whether the write applied. A transient DB error degrades to `false`
 * rather than crashing the run (callers have already confirmed the row exists
 * via `requireExistingUser`), and the caller records nothing for it.
 */
const mutateUser = (
  run: (
    repo: Context.Service.Shape<typeof AuthRepository>
  ) => Effect.Effect<void, AuthDatabaseError>
): Effect.Effect<boolean, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    yield* run(repo)
    return true
  }).pipe(
    // The automation run is deliberately not failed by a write that did not
    // apply — but a lifted ban that never landed is a SECURITY-relevant no-op,
    // so it is logged rather than left without a trace.
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[automations] auth mutation did not apply', cause)
      })
    ),
    // effect-swallow: logged above; a write that did not apply is reported as `false`, which records nothing on the audit trail.
    Effect.orElseSucceed(() => false)
  )

/**
 * `auth/assignRole` — assign a role to an existing user.
 */
export const handleAuthAssignRole: ActionHandler = (action, app, automation) =>
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

    // The last-admin rail the admin endpoints hold, from the same shared
    // decisions, before AND after the write: an automation removes the last
    // admin no more than a person can. The role often arrives in a webhook
    // payload the author does not control, and payloads arrive concurrently.
    const written = yield* assignRoleUnderLastAdminRail(userId, role, app)
    if (written._tag === 'Refused') {
      return {
        status: 'failure',
        error: `auth.assignRole: ${written.message}`,
      } as const satisfies ActionOutcome
    }

    // Only a change that stood reaches the audit trail, attributed to the
    // automation by name: setting the role a user already holds changes nothing.
    const change = written._tag === 'Written' ? roleChangeOf(written.previous, role) : undefined
    if (change !== undefined) {
      yield* recordRoleChange({
        author: { kind: 'automation', automation: automation.name },
        userId,
        ...change,
      })
    }

    return {
      status: 'success',
      output: { userId, role },
    } as const satisfies ActionOutcome
  }).pipe(
    Effect.withSpan('automations.handle-auth-assign-role', { attributes: actionAttributes(action) })
  )

/**
 * `auth/banUser` — ban an existing user account.
 *
 * `reason` is written into `ban_reason` only when supplied; an absent
 * reason leaves the column untouched (matching Better Auth's optional
 * ban-reason semantics).
 */
export const handleAuthBanUser: ActionHandler = (action, app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const userId = stringProp(props, 'userId').trim()
    const rawReason = stringProp(props, 'reason').trim()
    const reason = rawReason === '' ? undefined : rawReason

    const guard = yield* requireExistingUser(userId, 'auth.banUser')
    if (guard !== 'ok') return guard

    // A banned admin cannot sign in, so the ban holds the last-admin rail a
    // demotion holds, before and after the write: the step fails, and neither
    // `banned` nor `ban_reason` is left written.
    const banned = yield* banUnderLastAdminRail(userId, reason, app)
    if (banned._tag === 'Refused') {
      return {
        status: 'failure',
        error: `auth.banUser: ${banned.message}`,
      } as const satisfies ActionOutcome
    }

    // Only a ban that stood reaches the audit trail, attributed to the
    // automation by name. `auth/banUser` sets no end, and its reason stays on
    // the account row, never on the trail.
    if (banned._tag === 'Written') {
      yield* recordBan({
        author: { kind: 'automation', automation: automation.name },
        userId,
        expiresAt: null,
      })
    }

    return {
      status: 'success',
      output: reason === undefined ? { userId } : { userId, reason },
    } as const satisfies ActionOutcome
  }).pipe(
    Effect.withSpan('automations.handle-auth-ban-user', { attributes: actionAttributes(action) })
  )

/**
 * `auth/unbanUser` — re-enable a previously banned user account.
 *
 * Clears the ban columns: `banned = false` and `ban_reason = null`. The
 * inverse of `banUser`. Better Auth's session check treats both
 * `banned = false` and `banned = null` as "not banned"; the port writes the
 * explicit `false` so the column reflects an intentional reinstatement, and an
 * explicit `NULL` reason so no stale reason is left behind.
 */
export const handleAuthUnbanUser: ActionHandler = (action, _app, automation) =>
  Effect.gen(function* () {
    const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
    const userId = stringProp(props, 'userId').trim()

    const guard = yield* requireExistingUser(userId, 'auth.unbanUser')
    if (guard !== 'ok') return guard

    // Read BEFORE the write: afterwards the columns say "not banned" whether or
    // not a ban was lifted, and lifting a ban nobody had records nothing.
    const wasBanned = yield* readUserBannedById(userId)
    const lifted = yield* mutateUser((repo) => repo.unbanUser(userId))
    if (lifted && wasBanned === true) {
      yield* recordUnban({ author: { kind: 'automation', automation: automation.name }, userId })
    }

    return {
      status: 'success',
      output: { userId },
    } as const satisfies ActionOutcome
  }).pipe(
    Effect.withSpan('automations.handle-auth-unban-user', { attributes: actionAttributes(action) })
  )

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
): Effect.Effect<string, AuthCreateUserError, ConfigAccountProvisioner> =>
  Effect.gen(function* () {
    // Better Auth's admin createUser requires a password; generate a strong
    // throwaway when the action omitted one (the schema marks `password`
    // optional). 32 hex chars + symbol satisfies the length/complexity check
    // the vendored route enforces.
    const password =
      input.password && input.password.length > 0
        ? input.password
        : `${crypto.randomUUID().replace(/-/g, '')}A1!`
    const { userId } = yield* (yield* ConfigAccountProvisioner)
      .createUser(app.auth, { email: input.email, name: input.name, password, role: input.role })
      .pipe(
        Effect.mapError(
          ({ cause }) =>
            new AuthCreateUserError({
              cause,
              message:
                cause instanceof Error ? cause.message : `auth.createUser failed: ${String(cause)}`,
            })
        )
      )

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
  }).pipe(
    Effect.withSpan('automations.handle-auth-create-user', { attributes: actionAttributes(action) })
  )
