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
 *
 * The monitor is a fiber in a scope the server it watches owns: its stop
 * closes the scope, so a server stopped by a signal, or replaced by a `--watch`
 * restart, leaves no monitor behind.
 */

import { and, count, eq, gte, inArray, notInArray } from 'drizzle-orm'
import { Cron, Data, DateTime, Duration, Effect, Exit, Result, Schedule, Scope } from 'effect'
import { triggersOfType } from '@/domain/models/app/automations/trigger-entries-service'
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
import { onDevTimeline, readServerBootInstant } from '@/infrastructure/process/server-boot-instant'
import type { ServerInstance } from '@/application/ports/services/server-instance'
import type { App } from '@/domain/models/app'
import type { PortableDb } from '@/infrastructure/database/drizzle/db'

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
export const countRunningAutomations = async (db: PortableDb): Promise<number> => {
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
        gte(automationRuns.createdAt, onDevTimeline(readServerBootInstant())),
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
  const fallbackZone = resolveOperatorTimezone(process.env)
  const automations = (app.automations ?? []).flatMap((automation) => {
    if (automation.enabled === false) return []
    return triggersOfType(automation, 'cron').flatMap((trigger) => {
      const cron = parseSchedule(trigger.expression, trigger.timezone ?? fallbackZone)
      return cron === undefined ? [] : [cron]
    })
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
const CHECK_INTERVAL = Duration.seconds(1)

/** An idle check that could not be answered: the automation count failed. */
class IdleCheckError extends Data.TaggedError('IdleCheckError')<{ readonly cause: unknown }> {}

/** Whether the server has been idle for the whole of `windowMs`, by all four measures. */
const isIdle = async (
  countRunning: ServerInstance['countRunningAutomations'],
  schedules: readonly Cron.Cron[],
  windowMs: number
): Promise<boolean> => {
  const now = Date.now()
  if (activity.inFlight > 0 || now - activity.lastAt < windowMs) return false
  if (scheduleDueWithin(schedules, now, windowMs)) return false
  if ((await countRunning()) > 0) return false
  // A request may have begun while the count ran.
  return !(activity.inFlight > 0 || Date.now() - activity.lastAt < windowMs)
}

/**
 * Look every second until the server is idle, then call `stop` once and end.
 * One check at a time: the next waits for the previous to answer.
 */
const idleMonitor = (
  countRunning: ServerInstance['countRunningAutomations'],
  schedules: readonly Cron.Cron[],
  seconds: number,
  stop: (reason: string) => void
): Effect.Effect<void> => {
  const check = Effect.tryPromise({
    try: () => isIdle(countRunning, schedules, seconds * 1000),
    catch: (cause) => new IdleCheckError({ cause }),
  }).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() => logError('[server] the idle check failed; staying up', cause))
    ),
    // effect-swallow: logged above; a failed check keeps the server running, the safe side, and the next tick looks again.
    Effect.orElseSucceed(() => false)
  )
  return Effect.sleep(CHECK_INTERVAL).pipe(
    Effect.andThen(
      check.pipe(
        Effect.repeat({ schedule: Schedule.spaced(CHECK_INTERVAL), until: (idle) => idle })
      )
    ),
    Effect.andThen(Effect.sync(() => stop(`idle for ${String(seconds)}s`)))
  )
}

/**
 * Arm the idle exit on `server`: after `seconds` of idleness, call `stop` once.
 *
 * Answers the same server, whose `stop` first ends the monitor, so no check
 * reads a client the stop has released. The idle window starts here, once the
 * server is up; the schedules it reads are the ones `app` declares, and its
 * automation count is the server's own. A `--watch` restart stops the previous server (ending its monitor)
 * and arms the next one afresh with the new config's schedules.
 */
export const withIdleExit = (
  server: ServerInstance,
  app: App,
  seconds: number,
  stop: (reason: string) => void
): Effect.Effect<ServerInstance> =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    markActivity()
    yield* Effect.forkIn(
      idleMonitor(server.countRunningAutomations, declaredSchedules(app), seconds, stop),
      scope
    )
    return {
      ...server,
      stop: Effect.andThen(Scope.close(scope, Exit.void), server.stop),
    }
  }).pipe(Effect.withSpan('server.idle-exit.arm', { attributes: { 'idle.seconds': seconds } }))
