/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { App } from '@/domain/models/app'

/**
 * The questions a restart-class `--watch` reload can answer BEFORE it stops the
 * running server.
 *
 * ## Why a pre-flight exists at all
 *
 * `restartServer` stops the listener and only then builds its replacement, so
 * everything that fails between those two moments costs the operator their
 * port — and, until this campaign, was reported as "the previous server is
 * still serving" while nothing was listening. Rolling the last-good app back is
 * the net that catches whatever gets through; refusing BEFORE the stop is
 * better than both, because the browser tab never even blinks.
 *
 * ## What belongs here, and what deliberately does not
 *
 * A check earns its place here when it is READ-ONLY, CHEAP, and decidable
 * against the same state the boot will see. Two are:
 *
 * - the migration plan, which `planConfigTableChanges` computes read-only
 *   against the live database — a column drop without `allowDestructive: true`
 *   is knowable without touching a row. It has THREE answers rather than two,
 *   and the third is why it belongs here: a planner that could not open the
 *   database at all is an unanswered question, and an unanswered question is
 *   refused on this side of the stop (see {@link unanswerableRefusal});
 * - the required-env declaration, which is a pure function of the config and
 *   `process.env`.
 *
 * CSS compilation is NOT here, and that is a judgement rather than an
 * oversight. Compiling a stylesheet is the single most expensive step of a
 * boot, so pre-flighting it would pay that cost twice on every successful
 * restart to save it on the rare failing one — and the rollback already returns
 * the operator a working port when it fails. `[internal ref]` covers the
 * hot half of the same question, where a stylesheet failure never reaches a
 * stop at all because `design` is not a restart key.
 *
 * Everything reported here is a REFUSAL, in the words the operator has to act
 * on. An empty list means "nothing knowable stands in the way", never "this
 * will work".
 */

/** The sentence a tagged error carries, without its tag. */
const describeCause = (cause: unknown): string =>
  typeof cause === 'string' ? cause : cause instanceof Error ? cause.message : String(cause)

/**
 * The required environment variables the config declares and the environment
 * does not supply.
 *
 * `validateRequiredEnvVars` runs inside `startServer` well before the listener
 * binds but well AFTER `restartServer` has stopped the old one, which makes it
 * the cheapest boot refusal there is to reach from the wrong side of a stop.
 * Asking the same question here costs nothing and moves it to the right side.
 */
const envRefusals = async (app: App): Promise<readonly string[]> => {
  const { validateRequiredEnvVars } =
    await import('@/application/use-cases/env/validate-required-env-vars')
  const { Effect } = await import('effect')

  const result = await Effect.runPromise(
    validateRequiredEnvVars(app.env, process.env).pipe(Effect.result)
  )
  return result._tag === 'Failure' ? [describeCause(result.failure.cause)] : []
}

/**
 * A pre-flight that could not ask the database refuses, in the words the operator
 * has to act on.
 *
 * NOT "proceed and warn". The pre-flight's whole job is to keep a failure on the
 * safe side of `restartServer`'s stop, and a question nobody could answer is the
 * one case where proceeding costs the port outright: whatever stopped the planner
 * reading the database will stop the last-good app booting against it, so the
 * rollback is made of the same material as the fall. Measured, before this
 * existed: `[server] stopped` followed by "the previous configuration could not
 * be restored either" — a total outage nobody was told about.
 *
 * The cause is IN the sentence rather than only in the log. A refusal that says
 * "the pre-flight could not run" leaves the operator with nothing to fix, and the
 * two verdicts call for different actions: fix the config, or fix the database.
 */
const unanswerableRefusal = (cause: string): string =>
  `The migration pre-flight could not read the database, so this reload was refused before\n` +
  `anything was stopped — the server you have is still serving. Fix the database and save\n` +
  `again.\n  ${cause}`

/** Why a restart-class reload must not proceed, or an empty list. */
export const preflightRestartReload = async (app: App): Promise<readonly string[]> => {
  const { planDatabaseRefusals } = await import('./app-prelude')
  const [migration, env] = await Promise.all([planDatabaseRefusals(app), envRefusals(app)])
  return [
    ...(migration.kind === 'planned' ? migration.refusals : [unanswerableRefusal(migration.cause)]),
    ...env,
  ]
}
