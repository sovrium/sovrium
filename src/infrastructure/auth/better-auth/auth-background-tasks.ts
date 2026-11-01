/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Cause, Data, Effect } from 'effect'
import { trackBackgroundRun } from '@/infrastructure/automations/background-runs'
import { logError } from '@/infrastructure/logging/logger'

/** A background auth task (a sign-in link, a sign-in code, a reset mail) that failed. */
export class AuthBackgroundTaskError extends Data.TaggedError('AuthBackgroundTaskError')<{
  readonly cause: unknown
}> {}

/** The task as an Effect whose failure is an {@link AuthBackgroundTaskError}. */
export const awaitAuthTask = (
  task: Promise<unknown>
): Effect.Effect<unknown, AuthBackgroundTaskError> =>
  Effect.tryPromise({
    try: () => task,
    catch: (cause) => new AuthBackgroundTaskError({ cause }),
  })

/** The task's own error, for the log, rather than the wrapper around it. */
const unwrapTaskCause = (error: unknown): unknown =>
  error instanceof AuthBackgroundTaskError ? error.cause : error

/**
 * The work an auth request hands off instead of waiting for: above all the
 * emails a request for a sign-in link, a sign-in code or a password reset
 * sends.
 *
 * Waiting for the mail is what told an address that has an account from one
 * that has none: the request for a known address answered once the mail was
 * out, hundreds of milliseconds later than the one for an unknown address,
 * which sends nothing. Handed off, both answer as soon as the request is
 * recorded. Better Auth hands its own sends here through
 * `advanced.backgroundTasks.handler`; the sign-in link sender does the same.
 *
 * The task is held as a tracked background run, so a stopping server waits
 * for a mail on its way out rather than cutting it off.
 */
export const runAuthTaskInBackground = (task: Promise<unknown>): void => {
  void Effect.runPromise(
    trackBackgroundRun(
      awaitAuthTask(task).pipe(
        Effect.withSpan('auth.background-task'),
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            logError('[auth] a background auth task failed', unwrapTaskCause(Cause.squash(cause)))
          })
        ),
        // The request already answered: a failed mail has nobody left to tell
        // but the log above, and must not take the server down with it.
        Effect.ignore
      )
    )
  )
}
