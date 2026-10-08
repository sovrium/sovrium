/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which answer a synchronous trigger's caller receives.
 *
 * A `webhook/response` sets the answer, and the latest one wins. A `flow/stop`
 * also carries an answer — its status, message and output — but that is only
 * the run's answer when nothing chose one before it: a stop ends the run, it
 * does not replace a response the run already set. Answering `404` and then
 * stopping is how a webhook refuses an unknown record without running the rest.
 *
 * The stop's answer is marked so every level that folds answers — the top-level
 * run, a nested sequence, a path, a loop — applies the same precedence.
 */

type ResponsePayload = Readonly<Record<string, unknown>>

/** Marks the answer a `flow/stop` carries; read by {@link laterResponse} only. */
const STOP_ANSWER_MARK = 'fromStop'

/** The answer a `flow/stop` hands its caller, marked as a fallback. */
export const stopAnswer = (body: ResponsePayload): ResponsePayload => ({
  status: 200,
  body,
  headers: {},
  [STOP_ANSWER_MARK]: true,
})

/**
 * The answer after `next` was produced: `next` replaces `current`, except that
 * a stop's answer never replaces one already set.
 */
export const laterResponse = (
  current: ResponsePayload | undefined,
  next: ResponsePayload | undefined
): ResponsePayload | undefined => {
  if (next === undefined) return current
  if (current !== undefined && next[STOP_ANSWER_MARK] === true) return current
  return next
}
