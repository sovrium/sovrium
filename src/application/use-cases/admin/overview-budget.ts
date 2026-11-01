/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The overview's operator-set budget: how long each block may take and how
 * many roll-ups may run at once, both read from the environment.
 */

import { Semaphore } from 'effect'
import type { ProcessEnvShape } from '@/application/ports/services/process-env'

/**
 * Per-block latency budget (milliseconds). Each of the six domain blocks is
 * wrapped in `withBlockTimeout` with this budget, so a slow-in-production
 * source degrades to its zero block instead of pushing the concurrent roll-up
 * past the Hono `API_TIMEOUT_MS` (30s) ceiling. The blocks run concurrently, so
 * 8s is comfortably under the outer ceiling while still letting a genuinely
 * slow-but-reachable source answer.
 *
 * Operator-overridable via the `ADMIN_OVERVIEW_BLOCK_TIMEOUT_MS` env var (a
 * deployment/latency concern, so an env var — never the app schema). A missing
 * or non-positive value falls back to the default.
 */
const DEFAULT_BLOCK_TIMEOUT_MS = 8000
export const overviewBlockTimeoutMs = (env: ProcessEnvShape): number => {
  const raw = env['ADMIN_OVERVIEW_BLOCK_TIMEOUT_MS']
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BLOCK_TIMEOUT_MS
}

/**
 * How many overview roll-ups may run AT ONCE, process-wide.
 *
 * The per-request budget documented on `buildAdminOverview` (~8 peak
 * connections, under the `DATABASE_POOL_MAX` default of 10) is defeated by any
 * concurrency at all: a production incident logged three overview
 * requests within 8 ms (`07:50:35.591/.595/.599`), i.e. ~24 connections against
 * a ~10-connection pool. Every query queued behind the pool, nothing finished,
 * and all three failures landed together on the 30 s `API_TIMEOUT_MS` wall.
 *
 * A semaphore restores the invariant the budget assumed. Serializing is the
 * right trade for a dashboard tile: the per-block `withBlockTimeout` timers
 * start only AFTER a permit is acquired, so a queued request is never falsely
 * zeroed, and the worst case (wait one full roll-up, then run one) stays under
 * the outer ceiling. Operator-overridable via `ADMIN_OVERVIEW_MAX_CONCURRENT`
 * for deployments that provisioned a larger pool.
 */
const DEFAULT_MAX_CONCURRENT_OVERVIEWS = 1
const parseMaxConcurrent = (raw: string | undefined): number => {
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CONCURRENT_OVERVIEWS
}
const overviewSemaphores = new Map<'semaphore', Semaphore.Semaphore>()

/** The one process-wide semaphore, sized from the environment the first roll-up reads. */
export const overviewSemaphoreOf = (env: ProcessEnvShape): Semaphore.Semaphore =>
  overviewSemaphores.getOrInsertComputed('semaphore', () =>
    Semaphore.makeUnsafe(parseMaxConcurrent(env['ADMIN_OVERVIEW_MAX_CONCURRENT']))
  )
