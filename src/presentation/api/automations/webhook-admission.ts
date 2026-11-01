/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The bound on the runs of one automation waiting for a slot.
 *
 * An automation runs at most `concurrency.limit` runs at once and queues the
 * others. A webhook anyone can call would otherwise let a caller queue runs
 * faster than they finish, each one a row of history and a waiting fiber. Past
 * {@link MAX_WAITING_RUNS} waiting runs, a webhook call answers `503` with a
 * `Retry-After`, before any run is recorded: the caller tries again later
 * rather than the server holding an ever longer queue.
 */

import { Effect } from 'effect'
import { AutomationScheduler } from '@/application/ports/services/automation-scheduler'
import { ApiErrorCode } from '@/domain/models/api/error'
import { errorBody } from '@/presentation/api/runtime/auth-helpers'
import type { Context } from 'hono'

/** The most runs of one automation a webhook call may leave waiting for a slot. */
export const MAX_WAITING_RUNS = 100

/** The seconds a refused caller is asked to wait before calling again. */
const RETRY_AFTER_SECONDS = 30

/** The refusal of a call to an automation whose queue is full. */
const webhookQueueFull = (c: Context): Response =>
  c.json(
    errorBody({
      error: 'queue_full',
      message: 'This automation has too many runs waiting; try again later',
      code: ApiErrorCode.SERVICE_UNAVAILABLE,
    }),
    503,
    { 'Retry-After': String(RETRY_AFTER_SECONDS) }
  )

/** The `503` a call to `automationName` answers while its queue is full, else `undefined`. */
export const refuseFullQueue = (c: Context, automationName: string) =>
  Effect.map(
    AutomationScheduler.use((scheduler) => scheduler.waiting(automationName)),
    (waiting) => (waiting >= MAX_WAITING_RUNS ? webhookQueueFull(c) : undefined)
  )
