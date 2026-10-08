/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `SOVRIUM_IDLE_EXIT_SECONDS`: a server that exits by itself once nobody is
 * using it, so a socket-activation proxy in front can give its memory back and
 * start it again on the next connection.
 *
 * Idle means all four of these at once:
 *
 * 1. no HTTP request in flight — counted at the listener ({@link trackRequest}),
 *    so a page, an asset and an API call all count;
 * 2. no request finished within the window;
 * 3. no automation run of this boot still `queued` or `running` (a run parked
 *    on a delay step is not running: it resumes at the next boot);
 * 4. no CONFIG-DECLARED schedule — a cron automation or an agent schedule — due
 *    within the window. Exiting would skip a job nothing would wake the app
 *    for. The engine's own housekeeping schedules (retention sweeps, the
 *    weekly digest, …) do not count: they catch up at the next boot, and
 *    counting them would keep every instance awake forever.
 *
 * The exit itself is the ordinary graceful stop (`lifecycle.ts`), so the lock
 * file is removed and the exit code is `0`, exactly as on `SIGTERM`.
 */

import { and, count, eq, gte, inArray, notInArray } from 'drizzle-orm'
import { Cron, DateTime, Result } from 'effect'
import { db } from '@/infrastructure/database'
import { resolveDialectSchema } from '@/infrastructure/database/drizzle/dialect-schema'
import {
  automationDelayedSteps as automationDelayedStepsPg,
  automationRuns as automationRunsPg,
} from '@/infrastructure/database/drizzle/schema/automation'
import {
  automationDelayedSteps as automationDelayedStepsSqlite,
  automationRuns as automationRunsSqlite,
} from '@/infrastructure/database/drizzle/schema-sqlite/automation'
import { logError } from '@/infrastructure/logging/logger'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { readServerBootInstant } from '@/infrastructure/process/server-boot-instant'
import type { App } from '@/domain/models/app'

// ─── Request activity ────────────────────────────────────────────────────────

/** Requests in flight and the instant the last one began or ended. */
const activity = { inFlight: 0, lastAt: Date.now() }

/** Note activity now, without a request — the start of the idle window. */
export const markActivity = (): void => {
  activity.lastAt = Date.now()
}

/**
 * Run one request's handler, counting it as in flight until its response is
 * produced. A streamed body (SSE) counts until its `Response` is returned, not
 * until the stream ends: an open stream is a client that is still there, but it
 * is not a request the proxy is waiting on.
 */
export const trackRequest = <R>(handle: () => R | Promise<R>): R | Promise<R> => {
  activity.inFlight += 1
  markActivity()
  const settle = (): void => {
    activity.inFlight -= 1
    markActivity()
  }
  try {
    const result = handle()
    if (result instanceof Promise) return result.finally(settle)
    settle()
    return result
  } catch (error) {
    settle()
    throw error
  }
}

// ─── Automations ─────────────────────────────────────────────────────────────

const automationRuns = resolveDialectSchema(automationRunsPg, automationRunsSqlite)
const automationDelayedSteps = resolveDialectSchema(
  automationDelayedStepsPg,
  automationDelayedStepsSqlite
)

/** Runs of THIS boot still queued or running, a run parked on a delay step excepted. */
const countRunningAutomations = async (): Promise<number> => {
  const parked = db
    .select({ runId: automationDelayedSteps.runId })
    .from(automationDelayedSteps)
    .where(eq(automationDelayedSteps.status, 'waiting'))
  const [row] = await db
    .select({ n: count() })
    .from(automationRuns)
    .where(
      and(
        inArray(automationRuns.status, ['queued', 'running']),
        gte(automationRuns.createdAt, readServerBootInstant()),
        notInArray(automationRuns.id, parked)
      )
    )
  return Number(row?.n ?? 0)
}

/** Parse one config-declared schedule; a malformed one was refused at boot, so it is skipped. */
const parseSchedule = (expression: string, timezone: string): Cron.Cron | undefined => {
  const zone = Result.try({
    try: () => DateTime.zoneMakeNamedUnsafe(timezone),
    catch: () => undefined,
  })
  if (Result.isFailure(zone)) return undefined
  const parsed = Cron.parse(expression, zone.success)
  return Result.isSuccess(parsed) ? parsed.success : undefined
}

/** Every schedule the config declares: enabled cron automations and agent schedules. */
const declaredSchedules = (app: App): readonly Cron.Cron[] => {
  const fallbackZone = resolveOperatorTimezone()
  const automations = (app.automations ?? []).flatMap((automation) => {
    const trigger = automation.trigger as {
      readonly type: string
      readonly expression?: string
      readonly timezone?: string
    }
    if (trigger.type !== 'cron' || automation.enabled === false) return []
    const cron = parseSchedule(trigger.expression ?? '', trigger.timezone ?? fallbackZone)
    return cron === undefined ? [] : [cron]
  })
  const agents = (app.agents ?? []).flatMap((agent) => {
    if (agent.schedule === undefined || agent.enabled === false) return []
    const cron = parseSchedule(agent.schedule.cron, agent.schedule.timezone ?? fallbackZone)
    return cron === undefined ? [] : [cron]
  })
  return [...automations, ...agents]
}

/** Whether any schedule fires within `windowMs` of `now`. */
const scheduleDueWithin = (
  schedules: readonly Cron.Cron[],
  now: number,
  windowMs: number
): boolean => schedules.some((cron) => Cron.next(cron, new Date(now)).getTime() - now <= windowMs)

// ─── The monitor ─────────────────────────────────────────────────────────────

/** How often the monitor looks. */
const CHECK_INTERVAL_MS = 1000

/** The armed monitor: one per process, its config replaced on a `--watch` reload. */
const armed = new Map<'schedules', readonly Cron.Cron[]>()

/**
 * Arm the idle exit: after `seconds` of idleness, call `stop` once.
 *
 * Idempotent across `--watch` reloads, which re-enter the boot: the first call
 * starts the timer, later ones only replace the schedules it reads. The timer
 * is unreferenced, so it never holds the process open on its own.
 */
export const armIdleExit = (app: App, seconds: number, stop: (reason: string) => void): void => {
  const firstArming = !armed.has('schedules')
  armed.set('schedules', declaredSchedules(app))
  if (!firstArming) return
  markActivity()
  const windowMs = seconds * 1000
  const state = { checking: false, done: false }
  const check = async (): Promise<void> => {
    const now = Date.now()
    if (activity.inFlight > 0 || now - activity.lastAt < windowMs) return
    if (scheduleDueWithin(armed.get('schedules') ?? [], now, windowMs)) return
    if ((await countRunningAutomations()) > 0) return
    // A request may have begun while the count ran.
    if (activity.inFlight > 0 || Date.now() - activity.lastAt < windowMs) return
    state.done = true
    clearInterval(timer)
    stop(`idle for ${String(seconds)}s`)
  }
  const timer = setInterval(() => {
    if (state.checking || state.done) return
    state.checking = true
    check()
      .catch((cause: unknown) => {
        // Swallowed on purpose (E6): a failed check keeps the server running,
        // the safe side, and the next tick looks again.
        logError('[server] the idle check failed; staying up', cause)
      })
      .finally(() => {
        state.checking = false
      })
  }, CHECK_INTERVAL_MS)
  timer.unref()
}
