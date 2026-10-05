/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { GUEST_USER_ID, SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import { logError } from '@/infrastructure/logging'

/** A guest or system actor has no account to read an address from. */
const hasNoAccount = (userId: string): boolean =>
  userId === '' || userId === GUEST_USER_ID || userId === SYSTEM_USER_ID

/**
 * A user's email address, by user id — THE lookup every door shares: a form's
 * `$user.email` prefill and choice filters, and the row-level rules that name
 * `$currentUser.email`.
 *
 * Yields `undefined` when there is no such account (a guest, the system actor,
 * an id naming nobody) or the lookup fails. A failure is logged with its cause
 * and then read as "no email", which can only NARROW what passes: a form
 * prefill drops the entry rather than leaking the literal `$user.email` token
 * (S1), and a rule naming the reader's email matches no row.
 *
 * `AuthRepository` is declared rather than provided (standing rule E1).
 */
export const findUserEmailById = (
  userId: string
): Effect.Effect<string | undefined, never, AuthRepository> =>
  Effect.gen(function* () {
    if (hasNoAccount(userId)) return undefined
    const repo = yield* AuthRepository
    return yield* repo.findUserEmailById(userId)
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[auth] User email lookup failed; reading it as no email', cause, { userId })
      )
    ),
    // effect-swallow: an unknown email can only NARROW what passes — a prefill drops its entry instead of rendering the literal `$user.email` token (S1), and a rule naming `$currentUser.email` matches no row.
    Effect.orElseSucceed(() => undefined),
    Effect.withSpan('auth.find-user-email-by-id')
  )

/**
 * The email address of each of `userIds`, in ONE read — for a door that judges
 * many people at once (the comment mention picker). An id with no account, or
 * no address, is absent from the map. A failure is logged and read as no
 * addresses at all, for the same reason as {@link findUserEmailById}.
 */
export const findUserEmailsByIds = (
  userIds: readonly string[]
): Effect.Effect<ReadonlyMap<string, string>, never, AuthRepository> =>
  Effect.gen(function* () {
    const wanted = [...new Set(userIds)].filter((userId) => !hasNoAccount(userId))
    if (wanted.length === 0) return new Map<string, string>()
    const repo = yield* AuthRepository
    return yield* repo.findUserEmailsByIds(wanted)
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        logError('[auth] User email batch lookup failed; reading it as no email', cause, {
          count: String(userIds.length),
        })
      )
    ),
    // effect-swallow: an unknown email can only NARROW what passes — a rule naming `$currentUser.email` then matches no row for anyone in the batch.
    Effect.orElseSucceed(() => new Map<string, string>()),
    Effect.withSpan('auth.find-user-emails-by-ids')
  )
