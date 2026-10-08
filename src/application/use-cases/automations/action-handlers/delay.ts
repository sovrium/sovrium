/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Clock, Duration, Effect } from 'effect'
import {
  MAX_DELAY_LABEL,
  MAX_DELAY_MS,
  PARK_THRESHOLD_MS,
  parseDelayDurationMs,
  resolveUntilInstantMs,
} from '@/domain/models/app/automations/actions/delay/delay-wait-service'
import { resolveOperatorTimezone } from '@/infrastructure/process/operator-timezone'
import { actionAttributes } from './shared'
import type { ActionHandler, ActionOutcome } from './shared'

/**
 * `delay/*` handlers — pause an automation run.
 *
 * - `delay/wait` — wait a fixed `duration` (`'30m'`, `'24h'`) or until an
 *   instant (`until`). A wait of one minute or less sleeps inside the run and
 *   answers `{ resumedAt }`. A longer one PARKS the run (`run-park.ts`): the
 *   step answers `{ resumeAt }`, the run turns `waiting-delay`, and the resume
 *   sweep continues it from the database once that instant has passed, the
 *   step then reading `resumedAt` too. An `until` with no offset is read in the
 *   operator time zone; one already past resolves at once; one more than 90
 *   days ahead fails the step — nothing is ever shortened.
 * - `delay/webhook` — surfaces a `callbackUrl` and, with a `timeout`, waits
 *   that long and resumes with `timedOut: true` (parking past one minute, like
 *   a wait). No route receives the callback yet: the timeout is the outcome.
 * - `delay/queue` — spaces successive actions by sleeping `interval`, which
 *   validation keeps within one minute.
 *
 * Spec: [internal ref]-{WAIT,WEBHOOK,QUEUE}-NNN + REGRESSION.
 */

const sleep = (ms: number): Effect.Effect<void> =>
  ms <= 0 ? Effect.void : Effect.sleep(Duration.millis(ms))

const propsOf = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] ?? {}) as Readonly<Record<string, unknown>>

const ok = (output?: Readonly<Record<string, unknown>>): ActionOutcome =>
  (output !== undefined
    ? ({ status: 'success', output } as const)
    : ({ status: 'success' } as const)) satisfies ActionOutcome

/**
 * The instant a `delay/wait` resumes at, in epoch milliseconds. `duration`
 * and `until` are mutually exclusive at the schema level; `duration` wins when
 * both somehow arrive. A missing or unreadable value resumes at once.
 */
const resolveWaitUntil = (props: Readonly<Record<string, unknown>>, nowMs: number): number => {
  const { duration, until } = props
  if (typeof duration === 'string' && duration.trim() !== '') {
    return nowMs + parseDelayDurationMs(duration)
  }
  if (typeof until === 'string') {
    return resolveUntilInstantMs(until, resolveOperatorTimezone()) ?? nowMs
  }
  return nowMs
}

/**
 * Wait until `resumeAtMs`: sleep when it is a minute away or less, park the run
 * when it is further, fail past the 90-day ceiling. `parkedOutput` is what the
 * step answers while the run waits; `resumedOutput` what it answers after a
 * sleep.
 */
const waitUntil = (input: {
  readonly operator: string
  readonly resumeAtMs: number
  readonly nowMs: number
  readonly parkedOutput: Readonly<Record<string, unknown>>
  readonly resumedOutput: () => Readonly<Record<string, unknown>>
}): Effect.Effect<ActionOutcome> => {
  const ms = Math.max(0, input.resumeAtMs - input.nowMs)
  if (ms > MAX_DELAY_MS) {
    const days = Math.ceil(ms / 86_400_000)
    return Effect.succeed({
      status: 'failure',
      error: `delay.${input.operator}: resumes ${String(days)} days ahead; a wait may last at most ${MAX_DELAY_LABEL}`,
    })
  }
  if (ms <= PARK_THRESHOLD_MS) return sleep(ms).pipe(Effect.map(() => ok(input.resumedOutput())))
  const resumeAt = new Date(input.resumeAtMs).toISOString()
  return Effect.succeed({
    status: 'success',
    output: { ...input.parkedOutput, resumeAt },
    park: { resumeAt: input.resumeAtMs, frames: [] },
  })
}

const isoNow = (): Effect.Effect<string> =>
  Clock.currentTimeMillis.pipe(Effect.map((ms) => new Date(ms).toISOString()))

export const handleDelayWait: ActionHandler = (action) =>
  Effect.gen(function* () {
    const nowMs = yield* Clock.currentTimeMillis
    const resumeAtMs = resolveWaitUntil(propsOf(action), nowMs)
    const outcome = yield* waitUntil({
      operator: 'wait',
      resumeAtMs,
      nowMs,
      parkedOutput: {},
      resumedOutput: () => ({}),
    })
    if (outcome.park !== undefined || outcome.status === 'failure') return outcome
    return ok({ resumedAt: yield* isoNow() })
  }).pipe(
    Effect.withSpan('automations.handle-delay-wait', { attributes: actionAttributes(action) })
  )

/**
 * Synthesise a callback identifier for a `delay/webhook` action — used as the
 * suffix of the surfaced `callbackUrl`. Honours an explicit `callbackId`
 * prop; otherwise generates a random hex token.
 */
const callbackIdFor = (props: Readonly<Record<string, unknown>>): string => {
  const explicit = props['callbackId']
  if (typeof explicit === 'string' && explicit.trim() !== '') return explicit.trim()
  return crypto.randomUUID()
}

export const handleDelayWebhook: ActionHandler = (action) =>
  Effect.gen(function* () {
    const props = propsOf(action)
    const callbackId = callbackIdFor(props)
    const callbackUrl = `/api/automations/callbacks/${callbackId}`
    const timeoutMs = parseDelayDurationMs(props['timeout'])
    if (timeoutMs <= 0) return ok({ callbackUrl, callbackId })
    const nowMs = yield* Clock.currentTimeMillis
    return yield* waitUntil({
      operator: 'webhook',
      resumeAtMs: nowMs + timeoutMs,
      nowMs,
      parkedOutput: { callbackUrl, callbackId },
      resumedOutput: () => ({ callbackUrl, callbackId, timedOut: true }),
    })
  }).pipe(
    Effect.withSpan('automations.handle-delay-webhook', { attributes: actionAttributes(action) })
  )

export const handleDelayQueue: ActionHandler = (action) =>
  Effect.gen(function* () {
    const intervalMs = Math.min(
      parseDelayDurationMs(propsOf(action)['interval']),
      PARK_THRESHOLD_MS
    )
    yield* sleep(intervalMs)
    return ok()
  }).pipe(
    Effect.withSpan('automations.handle-delay-queue', { attributes: actionAttributes(action) })
  )
