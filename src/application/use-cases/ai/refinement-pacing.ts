/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Clock, Duration, Effect, Ref, Semaphore } from 'effect'
import {
  REFINEMENT_MAX_CONCURRENT,
  resolveRefinementBudget,
  type RefinementBudget,
} from '@/domain/models/process-env/ai/ai-refinement-caps'
import { logInfo } from '@/infrastructure/logging/logger'

/**
 * The pace AI-field refinements reach the provider at, per app.
 *
 * Both engines funnel through the one refinement worker: the PostgreSQL NOTIFY
 * listener runs one per notification, SQLite one per written row in the
 * server's tracked background. Neither waits for the previous one, so a bulk
 * write of a thousand rows would open a thousand provider calls at once. The
 * worker now takes a permit here first: a bounded number in flight, and on a
 * metered provider a bounded number started per window. Over either bound the
 * refinement waits; it is never dropped, and the row keeps its baseline value
 * (and a `pending` status) until its turn comes.
 */

const semaphores = new Map<string, Semaphore.Semaphore>()

const semaphoreOf = (appId: string): Semaphore.Semaphore =>
  semaphores.getOrInsertComputed(appId, () => Semaphore.makeUnsafe(REFINEMENT_MAX_CONCURRENT))

interface WindowState {
  /** Start times inside the current window, oldest first. */
  readonly starts: ReadonlyArray<number>
  /** Whether the app is already waiting on its budget, so the log line is written once. */
  readonly throttled: boolean
}

const windows = Ref.makeUnsafe<ReadonlyMap<string, WindowState>>(new Map())

/** Take a window slot now, or answer how many milliseconds to wait for one. */
const takeSlot = (
  appId: string,
  limit: number,
  windowMs: number,
  nowMs: number
): Effect.Effect<{ readonly waitMs: number; readonly announce: boolean }> =>
  Ref.modify(windows, (all) => {
    const previous = all.get(appId) ?? { starts: [], throttled: false }
    const starts = previous.starts.filter((start) => start > nowMs - windowMs)
    const room = starts.length < limit
    const next: WindowState = room
      ? { starts: [...starts, nowMs], throttled: false }
      : { starts, throttled: true }
    const waitMs = room ? 0 : Math.max(1, (starts[0] ?? nowMs) + windowMs - nowMs)
    return [{ waitMs, announce: !room && !previous.throttled }, new Map([...all, [appId, next]])]
  })

const awaitWindowSlot = (appId: string, budget: RefinementBudget): Effect.Effect<void> => {
  const { limit } = budget
  if (limit === undefined) return Effect.void
  const windowMs = budget.windowSeconds * 1000
  const attempt: Effect.Effect<void> = Effect.gen(function* () {
    const slot = yield* takeSlot(appId, limit, windowMs, yield* Clock.currentTimeMillis)
    if (slot.waitMs === 0) return
    if (slot.announce) {
      yield* Effect.sync(() =>
        logInfo(
          `[ai-compute] ${limit} refinements started in the last ${budget.windowSeconds}s: the rest are queued until the window allows them`,
          { appId }
        )
      )
    }
    yield* Effect.sleep(Duration.millis(slot.waitMs))
    yield* Effect.suspend(() => attempt)
  })
  return attempt
}

/**
 * Run one refinement's provider call within the app's pace: one of the
 * in-flight permits first, then a window slot (metered providers only). The
 * slot is taken by a call about to start, never by one still queued for a
 * permit, so the window counts the provider calls actually started.
 */
export const withRefinementPace = <A, E, R>(
  appId: string,
  env: Readonly<Record<string, string | undefined>>,
  call: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  semaphoreOf(appId)
    .withPermits(1)(awaitWindowSlot(appId, resolveRefinementBudget(env)).pipe(Effect.andThen(call)))
    .pipe(Effect.withSpan('ai-compute.with-refinement-pace'))
