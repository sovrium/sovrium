/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The standing check a resumed hand-started run makes before its first step.
 *
 * A run a person started by hand acts as that person. When it pauses on an
 * approval and resumes later, the person may have been banned or deleted in
 * the meantime: the resumed run then has nobody to act as, and it fails as a
 * whole — before ANY step, so a step that is not a record step (an email, an
 * outbound call through a connection the person authorised) never runs as an
 * account nobody may use any more. The record steps' own caller gate keeps its
 * check; this one is the run's.
 */

import { Effect } from 'effect'
import { AuthRepository } from '@/application/ports/repositories/auth/auth-repository'
import { logError } from '@/infrastructure/logging/logger'
import { CALLER_REFUSAL } from '../action-handlers/record-caller-gate'
import { EMPTY_RUN_ACCUMULATOR, type RunAccumulator } from './types'

/**
 * The failed accumulator a resumed run ends with when its starter no longer
 * stands, or `undefined` when the run may go ahead. A run nobody started by
 * hand always goes ahead: it acts as the system.
 */
const starterStandingRefusal = (input: {
  readonly startedByHand?: boolean
  readonly userId: string | undefined
}): Effect.Effect<RunAccumulator | undefined, never, AuthRepository> =>
  Effect.gen(function* () {
    if (input.startedByHand !== true) return undefined
    const { userId } = input
    const auth = yield* AuthRepository
    const active =
      userId === undefined
        ? false
        : yield* auth.isActiveUser(userId).pipe(
            // Logged BEFORE the swallow (E6): a failed read stops the run, and
            // that must not happen without a trace.
            Effect.tapCause((cause) =>
              Effect.sync(() => {
                logError('[automation:starter-standing] starter standing not read', cause, {
                  'sovrium.user_id': userId,
                })
              })
            ),
            // effect-swallow: a starter whose standing cannot be confirmed is treated as gone — it can only stop the run, never widen it.
            Effect.orElseSucceed(() => false)
          )
    if (active) return undefined
    const refused: RunAccumulator = {
      ...EMPTY_RUN_ACCUMULATOR,
      runStatus: 'failure',
      runError: CALLER_REFUSAL,
    }
    return refused
  }).pipe(Effect.withSpan('automations.starter-standing-refusal'))

/**
 * Run `steps` — unless the run was asked to check its starter's standing
 * (`checkStarterStanding`, set by a resume) and that starter no longer stands,
 * in which case the run ends failed with the records API's `Resource not
 * found` and `steps` never starts.
 */
export const unlessStarterGone = <E, R>(
  input: {
    readonly checkStarterStanding?: boolean
    readonly startedByHand?: boolean
    readonly userId: string | undefined
  },
  steps: Effect.Effect<RunAccumulator, E, R>
): Effect.Effect<RunAccumulator, E, R | AuthRepository> =>
  Effect.gen(function* () {
    if (input.checkStarterStanding !== true) return yield* steps
    const refused = yield* starterStandingRefusal(input)
    return refused ?? (yield* steps)
  }).pipe(Effect.withSpan('automations.unless-starter-gone'))
