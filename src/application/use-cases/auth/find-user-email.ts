/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'

/**
 * Resolve a user's email address by user id.
 *
 * Yields `undefined` when the user is not found or the lookup fails — the form
 * prefill path treats a missing email as "drop the prefill entry" and must
 * never leak the literal `$user.email` token, so the failure is folded into the
 * value here and the effect cannot fail.
 *
 * `AuthRepository` is declared rather than provided (standing rule E1). The form
 * route runs it on the request's services with `runDomainPromise`.
 */
export const findUserEmailById = (
  userId: string
): Effect.Effect<string | undefined, never, AuthRepository> =>
  Effect.gen(function* () {
    const repo = yield* AuthRepository
    return yield* repo.findUserEmailById(userId)
  }).pipe(
    // effect-swallow: the form prefill drops the entry on `undefined`; the alternative is rendering the literal `$user.email` token to the visitor (S1), so a failed lookup must read as "no email" rather than propagate.
    Effect.orElseSucceed(() => undefined),
    Effect.withSpan('auth.find-user-email-by-id')
  )
