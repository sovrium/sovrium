/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { countActiveAdmins } from '@/application/use-cases/auth/count-admins'
import { readUserRoleById } from '@/application/use-cases/auth/get-user-role'
import {
  adminRoleNamesFor,
  bansAnAdmin,
  demotesAnAdmin,
  isLastAdmin,
  lastAdminRemovalMessage,
  leavesNoAdmin,
} from '@/domain/models/app/auth/roles/role-write-validation'
import { logError } from '@/infrastructure/logging/logger'
import type {
  AuthDatabaseError,
  UserBanState,
} from '@/application/ports/repositories/auth/auth-repository'
import type { AdminRoleResolvable } from '@/domain/models/app/auth/roles'

/**
 * The last-admin rail for the writes that do not pass through Better Auth: the
 * `auth/assignRole` and `auth/banUser` automation actions.
 *
 * Both run the rail twice, from the same shared decisions the Better Auth hooks
 * apply to `/admin/set-role` and `/admin/update-user`:
 *
 *  1. BEFORE the write, the fast refusal: a write that takes an admin away while
 *     one admin remains is refused and nothing is written.
 *  2. AFTER the write, a fresh count. Two writes sent together (webhook
 *     payloads do arrive concurrently) can both pass step 1; each commits
 *     before its own recount, so at least one recount finds no admin. That
 *     write is put back — the previous role, or the previous ban columns — and
 *     refused with the same message.
 *
 * Both reads fold their own failure into `undefined`, which lets the write
 * through (see `isLastAdmin` / `leavesNoAdmin`): the rail guards trusted
 * operators against a lock-out, and a transient read failure must not make
 * role management unusable.
 */

/** How a railed write ended. */
export type RailedWrite<A> =
  /** Refused by the rail, before the write or undone after it. Nothing stands. */
  | { readonly _tag: 'Refused'; readonly message: string }
  /** The write itself failed; it was logged. Nothing stands. */
  | { readonly _tag: 'NotApplied' }
  /** The write stands. `previous` is what it replaced. */
  | { readonly _tag: 'Written'; readonly previous: A }

/** An account with no readable ban columns is restored as not banned. */
// eslint-disable-next-line unicorn/no-null -- the ban reason column is cleared with `null`
const NOT_BANNED: UserBanState = { banned: false, banReason: null }

/**
 * Run a write, reporting whether it applied. A failed write is logged with its
 * cause and reported as not applied, so the caller neither records nor
 * re-counts a change that never happened.
 */
const applied = (write: Effect.Effect<void, AuthDatabaseError>): Effect.Effect<boolean> =>
  write.pipe(
    Effect.as(true),
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[automations] auth mutation did not apply', cause)
      })
    ),
    // effect-swallow: logged above; a write that did not apply is reported to the caller as `NotApplied`, which records nothing and re-counts nothing.
    Effect.orElseSucceed(() => false)
  )

/**
 * Count the admins again after a write that took one away; when none is left,
 * put the previous state back and refuse. A restore that fails is logged: the
 * write is still refused, since answering as if it had stood would be false.
 */
const recountOrUndo = (
  app: AdminRoleResolvable,
  undo: Effect.Effect<void, AuthDatabaseError>
): Effect.Effect<string | undefined, never, AuthRepository> =>
  Effect.gen(function* () {
    const remaining = yield* countActiveAdmins(adminRoleNamesFor(app))
    if (!leavesNoAdmin(remaining)) return undefined
    yield* undo.pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[auth] could not undo a write that left no admin', cause)
        })
      ),
      // effect-swallow: logged above; the write is refused either way, so the caller is never told a lock-out stood.
      Effect.ignore
    )
    return lastAdminRemovalMessage(app)
  })

/**
 * Write `nextRole` onto `userId` under the last-admin rail. `Written.previous`
 * is the role the account held, for the audit entry.
 */
export const assignRoleUnderLastAdminRail = (
  userId: string,
  nextRole: string,
  app: AdminRoleResolvable
): Effect.Effect<RailedWrite<string | undefined>, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const previousRole = yield* readUserRoleById(userId)
    const demotes = demotesAnAdmin(nextRole, previousRole, app)
    if (demotes && isLastAdmin(yield* countActiveAdmins(adminRoleNamesFor(app)))) {
      return { _tag: 'Refused', message: lastAdminRemovalMessage(app) } as const
    }

    if (!(yield* applied(repo.updateUserRole(userId, nextRole)))) {
      return { _tag: 'NotApplied' } as const
    }

    if (demotes && previousRole !== undefined) {
      const refusal = yield* recountOrUndo(app, repo.updateUserRole(userId, previousRole))
      if (refusal !== undefined) return { _tag: 'Refused', message: refusal } as const
    }
    return { _tag: 'Written', previous: previousRole } as const
  }).pipe(Effect.withSpan('auth.assign-role-under-last-admin-rail'))

/**
 * Ban `userId` under the last-admin rail: a banned admin cannot sign in, so
 * banning the last one locks everybody out exactly as demoting it would. An
 * admin already banned is not counted, so banning it again removes nobody.
 */
export const banUnderLastAdminRail = (
  userId: string,
  reason: string | undefined,
  app: AdminRoleResolvable
): Effect.Effect<RailedWrite<undefined>, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const role = yield* readUserRoleById(userId)
    const previous = yield* repo.findUserBanState(userId).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[auth] could not read the ban state before a railed ban', cause)
        })
      ),
      // effect-swallow: an unreadable ban state reads as "not banned", which makes the rail count rather than skip — the direction that keeps an admin.
      Effect.orElseSucceed(() => undefined)
    )
    const removesAnAdmin = bansAnAdmin(role, previous?.banned === true, app)
    if (removesAnAdmin && isLastAdmin(yield* countActiveAdmins(adminRoleNamesFor(app)))) {
      return { _tag: 'Refused', message: lastAdminRemovalMessage(app) } as const
    }

    if (!(yield* applied(repo.banUser(userId, reason)))) {
      return { _tag: 'NotApplied' } as const
    }

    if (removesAnAdmin) {
      const refusal = yield* recountOrUndo(
        app,
        repo.restoreUserBanState(userId, previous ?? NOT_BANNED)
      )
      if (refusal !== undefined) return { _tag: 'Refused', message: refusal } as const
    }
    return { _tag: 'Written', previous: undefined } as const
  }).pipe(Effect.withSpan('auth.ban-under-last-admin-rail'))

/**
 * The last-admin rail for a door that removes the account itself — a deletion
 * scheduled through `POST /api/account/delete`, or one confirmed by the link
 * `/delete-user` mails.
 *
 * An erased account can no longer sign in, so erasing an admin takes one away
 * exactly as banning it does: an admin-capable role that is not already banned
 * counts, and the refusal fires when it is the only one left. Returns the
 * rail's message when the removal must be refused, `undefined` otherwise.
 *
 * Nothing is written, so there is nothing to recount: each door calls this
 * before it acts, and the immediate door calls it again when the link is
 * followed, because the other admins can be demoted in between.
 */
export const accountRemovalRefusal = (
  userId: string,
  app: AdminRoleResolvable
): Effect.Effect<string | undefined, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const role = yield* readUserRoleById(userId)
    const ban = yield* repo.findUserBanState(userId).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() => {
          logError('[auth] could not read the ban state before an account removal', cause)
        })
      ),
      // effect-swallow: an unreadable ban state reads as "not banned", which makes the rail count rather than skip — the direction that keeps an admin.
      Effect.orElseSucceed(() => undefined)
    )
    if (!bansAnAdmin(role, ban?.banned === true, app)) return undefined
    return isLastAdmin(yield* countActiveAdmins(adminRoleNamesFor(app)))
      ? lastAdminRemovalMessage(app)
      : undefined
  }).pipe(Effect.withSpan('auth.account-removal-refusal'))
