/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable functional/immutable-data, functional/prefer-immutable-types, functional/no-expression-statements, no-restricted-syntax, drizzle/enforce-delete-with-where -- module-level mutable scheduler state is intentional: FIFO queues + AbortController registry must mutate in place. Same pattern as run-history-store.ts. The drizzle/enforce-delete-with-where rule fires on every Map.delete() call (it's a SQL-only rule but ESLint can't distinguish JS Map.delete from Drizzle's delete query builder) — disable file-wide. */

/**
 * Per-automation FIFO concurrency scheduler.
 *
 * Owns two pieces of cross-run state that the synchronous run-loop
 * cannot:
 *
 *   1. **Semaphore + queue** — for each automation name, a counter of
 *      currently-running runs and an ordered list of waiters. When a new
 *      trigger arrives, it either admits immediately (counter < limit) or
 *      parks in the queue until an in-flight run completes.
 *   2. **Cancellation registry** — `Map<runId, AbortController>`. The
 *      cancel endpoint (`POST /api/automations/runs/:id/cancel`) calls
 *      `abort()` on the controller so the in-flight loop can short-circuit
 *      between actions and finalise the run as `'cancelled'`.
 *
 * Live-status observation lives in the DB row's `status` column directly:
 * `persistQueuedRun` writes 'queued', `markRunRunning` flips to 'running',
 * `finaliseRun` writes the terminal status. No in-memory overlay needed —
 * the runs API reads transient state straight from the DB.
 *
 * The scheduler is intentionally single-process and in-memory: queueing
 * and cancellation state do NOT survive a server restart. The runs table
 * still records every queued/running/terminal transition so observers
 * have a DB-backed record after the fact.
 *
 * Concurrency limit resolution (in order):
 *   1. `automation.concurrency.limit` from the schema (1-50; per
 * [internal ref]).
 *   2. `process.env.AUTOMATION_CONCURRENCY_DEFAULT` (operator override).
 *   3. The hard-coded {@link DEFAULT_CONCURRENCY_LIMIT} (5 per the locked
 *      architectural decision).
 */

import type { App } from '@/domain/models/app'

/**
 * Global default concurrency. Locked at 5 (decision recorded in
 * `[internal ref]`).
 */
const DEFAULT_CONCURRENCY_LIMIT = 5

interface AutomationQueueState {
  active: number
  waiters: Array<() => void>
}

// Module-level singletons. Single-process scheduler.
const queues: Map<string, AutomationQueueState> = new Map()

// Per-runId AbortController for cancellation.
const cancellers: Map<string, AbortController> = new Map()

/**
 * Resolve the concurrency limit for an automation. Per-schema field beats
 * env override beats default. Returns Infinity when neither is set AND
 * the env value is missing — but in practice the chain returns the locked
 * default of 5.
 */
export const resolveConcurrencyLimit = (
  automation: NonNullable<App['automations']>[number],
  env: Readonly<Record<string, string | undefined>>
): number => {
  const fromSchema = (automation as { readonly concurrency?: { readonly limit?: number } })
    .concurrency?.limit
  if (typeof fromSchema === 'number' && Number.isFinite(fromSchema) && fromSchema > 0) {
    return Math.floor(fromSchema)
  }
  const fromEnv = env['AUTOMATION_CONCURRENCY_DEFAULT']
  if (fromEnv !== undefined) {
    const parsed = Number(fromEnv)
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  }
  return DEFAULT_CONCURRENCY_LIMIT
}

/**
 * Acquire a slot for the given automation. Resolves immediately when the
 * concurrency limit allows, otherwise resolves later when an in-flight
 * run releases.
 */
export const acquireSlot = (automationName: string, limit: number): Promise<void> => {
  const state = queues.get(automationName) ?? { active: 0, waiters: [] }
  if (!queues.has(automationName)) {
    queues.set(automationName, state)
  }
  if (state.active < limit) {
    // Fast path: admit immediately.
    state.active = state.active + 1
    return Promise.resolve()
  }
  // Slow path: park in FIFO queue.
  return new Promise<void>((resolve) => {
    state.waiters.push(() => {
      // When a waker fires, increment active and let the caller proceed.
      state.active = state.active + 1
      resolve()
    })
  })
}

/**
 * Release a previously-acquired slot. Wakes the next waiter (if any).
 */
export const releaseSlot = (automationName: string): void => {
  const state = queues.get(automationName)
  if (state === undefined) return
  state.active = Math.max(0, state.active - 1)
  const next = state.waiters.shift()
  if (next !== undefined) {
    // The waker increments `active` itself (see acquireSlot's slow-path
    // resolver). We already decremented; the waker brings the count back
    // up to the pre-release value, preserving the FIFO invariant.
    next()
  }
}

/**
 * Register a cancellation controller for a run. The cancel endpoint
 * calls {@link signalCancellation} which triggers `abort()` on the
 * registered controller, letting the run loop short-circuit.
 */
export const registerCancellation = (runId: string): AbortController => {
  const controller = new AbortController()
  cancellers.set(runId, controller)
  return controller
}

/**
 * Drop a registered controller (run terminated normally or aborted).
 */
export const unregisterCancellation = (runId: string): void => {
  cancellers.delete(runId)
}

/**
 * Trigger cancellation for a run id. Returns `true` when a controller was
 * registered (the cancel endpoint can return 200), `false` when no
 * controller was found (e.g. the run already terminated — the endpoint
 * should still update the DB row best-effort).
 */
export const signalCancellation = (runId: string): boolean => {
  const controller = cancellers.get(runId)
  if (controller === undefined) return false
  controller.abort()
  return true
}

/**
 * True when the given runId's cancellation signal has been triggered.
 * The scheduler-wrapped run loop reads this at finalisation time so an
 * aborted run's terminal status is forced to `'cancelled'` regardless of
 * whatever the action loop produced before the abort fired.
 */
export const isCancelled = (runId: string): boolean => {
  const controller = cancellers.get(runId)
  return controller !== undefined && controller.signal.aborted
}
