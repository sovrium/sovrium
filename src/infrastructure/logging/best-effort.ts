/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { logError } from './logger'
import type { LogAttributes } from '@/infrastructure/telemetry/telemetry-sink'

/** Where a swallowed failure is reported: {@link logError}'s signature. */
export type BestEffortLog = (message: string, cause: unknown, attributes?: LogAttributes) => void

/** The two flavours of one best-effort site: a Promise, or an Effect pipe stage. */
interface BestEffort {
  /** `promise`, or `fallback` (`undefined` when omitted) once its rejection has been logged. */
  readonly promise: {
    <A>(promise: Promise<A>): Promise<A | undefined>
    <A, B>(promise: Promise<A>, fallback: B): Promise<A | B>
  }
  /** A pipe stage: the program's value, or `fallback` once its cause has been logged. */
  readonly effect: <B>(
    fallback: B
  ) => <A, E, R>(program: Effect.Effect<A, E, R>) => Effect.Effect<A | B, never, R>
}

/**
 * A failure that must not stop the caller, logged before it is defaulted.
 *
 * For the work that is optional by design — a search source, a knowledge
 * re-embed, an agent's user row — where a failure must not fail the request or
 * the boot. What it must never be is invisible: a `.catch(() => [])` makes a
 * broken source read exactly like "no results", and nothing anywhere says it
 * broke. Each flavour logs the cause through {@link logError}, under `label`
 * and `attributes`, and only then answers the fallback.
 *
 * The Effect flavour taps the WHOLE cause (defects and interruptions included)
 * ahead of the swallow, in its own pipe: a tap placed after the swallow sees
 * nothing, and the order is what `sovrium/no-effect-swallow-without-log`
 * verifies. The Promise flavour catches any rejection, which for an
 * `Effect.runPromise` bridge includes a layer that failed to build.
 *
 * @param label - What failed, stated for an operator reading the log; it is
 *   also the written reason the swallow carries.
 * @param attributes - Bounded identifiers that say WHICH one failed. Never
 *   request input or a secret.
 * @param log - The sink, {@link logError} unless a test hands its own.
 */
export const bestEffort = (
  label: string,
  attributes: LogAttributes = {},
  log: BestEffortLog = logError
): BestEffort => ({
  promise: <A, B>(promise: Promise<A>, fallback?: B): Promise<A | B | undefined> =>
    promise.catch((cause: unknown): B | undefined => {
      log(label, cause, attributes)
      return fallback
    }),
  effect:
    <B>(fallback: B) =>
    <A, E, R>(program: Effect.Effect<A, E, R>): Effect.Effect<A | B, never, R> =>
      program.pipe(
        Effect.tapCause((cause) =>
          Effect.sync(() => {
            log(label, cause, attributes)
          })
        ),
        Effect.catchCause(() => Effect.succeed(fallback))
      ),
})
