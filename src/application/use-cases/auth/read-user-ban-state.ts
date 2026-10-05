/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { logError } from '@/infrastructure/logging/logger'

/**
 * Whether an account is banned right now, read before a lifted ban so the audit
 * trail can tell a ban that was really lifted from one that never existed.
 *
 * Yields `true` only for a stored ban (the rule `findUserBanState` applies),
 * `false` for an account that is not banned, and `undefined` when the account
 * does not exist or its state could not be read. An unreadable state is logged:
 * the caller then records nothing, since it cannot establish that anything
 * changed.
 */
export const readUserBannedById = (
  userId: string
): Effect.Effect<boolean | undefined, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    const state = yield* repo.findUserBanState(userId)
    return state?.banned
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => {
        logError('[auth] could not read the ban state before lifting a ban', cause)
      })
    ),
    // effect-swallow: logged above; an unreadable ban state records nothing for the lifted ban, and never blocks the unban itself.
    Effect.orElseSucceed(() => undefined),
    Effect.withSpan('auth.read-user-banned-by-id')
  )
