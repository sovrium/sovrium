/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { CommentRepository } from '@/application/ports/repositories/comment-repository'
import { getUserRole } from '@/application/use-cases/tables/user-role'
import { SYSTEM_USER_ID } from '@/domain/models/app/auth/guest-session'
import { logError } from '@/infrastructure/logging/logger'
import { buildSyntheticSession } from './build-guest-session'
import type { TriggerRequester } from './resolve-trigger-data'
import type { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import type { App } from '@/domain/models/app'

/**
 * The person behind a trigger, completed with the email and the name their
 * account holds, so a run reads `{{trigger.user.email}}` and
 * `{{trigger.user.name}}` beside the id and the role.
 *
 * The system (a write no person made) keeps `system` as its id and role, and
 * has no email and no name to invent: both are empty. An account the lookup
 * cannot find, or a lookup that fails, leaves both empty too — the run still
 * starts, naming the person by id; a failed lookup is logged.
 */
export const identifyRequester = (
  requester: TriggerRequester
): Effect.Effect<TriggerRequester, never, CommentRepository> =>
  Effect.gen(function* () {
    if (requester.id === SYSTEM_USER_ID) return { ...requester, email: '', name: '' }
    const comments = yield* CommentRepository
    const found = yield* Effect.result(
      comments
        .getUserMetadataById({ session: buildSyntheticSession(requester.id), userId: requester.id })
        .pipe(
          Effect.tapCause((cause) =>
            Effect.sync(() => logError('[automation:trigger-user] identity lookup failed', cause))
          )
        )
    )
    // A failed lookup costs the run the two names, never the run itself.
    const person = found._tag === 'Success' ? found.success : undefined
    return { ...requester, email: person?.email ?? '', name: person?.name ?? '' }
  }).pipe(Effect.withSpan('automations.identify-requester'))

/** {@link identifyRequester} over an optional requester: none stays none. */
export const identifyRequesterIfAny = (
  requester: TriggerRequester | undefined
): Effect.Effect<TriggerRequester | undefined, never, CommentRepository> =>
  (requester === undefined ? Effect.undefined : identifyRequester(requester)).pipe(
    Effect.withSpan('automations.identify-requester-if-any')
  )

/**
 * A signed-in form submitter as the run's `trigger.user`: id, the role the app
 * grants them, email and name. `undefined` for an anonymous submission. A
 * role that cannot be read leaves the submitter unnamed rather than guessed;
 * the failure is logged.
 */
export const identifyFormSubmitter = (
  userId: string | undefined,
  app: App
): Effect.Effect<TriggerRequester | undefined, never, AuthRepository | CommentRepository> =>
  Effect.gen(function* () {
    if (userId === undefined || userId === '') return undefined
    const role = yield* Effect.result(
      getUserRole(userId, app).pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() =>
            logError('[automation:trigger-user] submitter role lookup failed', cause)
          )
        )
      )
    )
    // Without a role the submitter cannot be named as the other triggers name theirs.
    if (role._tag === 'Failure') return undefined
    return yield* identifyRequester({ id: userId, role: role.success })
  }).pipe(Effect.withSpan('automations.identify-form-submitter'))
