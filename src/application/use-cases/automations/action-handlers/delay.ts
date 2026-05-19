/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Duration, Effect } from 'effect'
import type { ActionHandler, ActionOutcome } from './shared'


const MAX_SLEEP_MS = 60_000

const DURATION_PATTERN = /^(\d+)\s*(ms|s|m|h|d)$/

const UNIT_MS: Readonly<Record<string, number>> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

const parseDurationMs = (value: unknown): number => {
  if (typeof value !== 'string') return 0
  const match = DURATION_PATTERN.exec(value.trim())
  if (match === null) return 0
  return Number(match[1]) * (UNIT_MS[match[2] as string] ?? 0)
}

const clampSleep = (ms: number): number => Math.max(0, Math.min(ms, MAX_SLEEP_MS))

const sleep = (ms: number): Effect.Effect<void> =>
  ms <= 0 ? Effect.void : Effect.sleep(Duration.millis(ms))

const propsOf = (action: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> =>
  (action['props'] ?? {}) as Readonly<Record<string, unknown>>

const ok = (output?: Record<string, unknown>): ActionOutcome =>
  (output !== undefined
    ? ({ status: 'success', output } as const)
    : ({ status: 'success' } as const)) satisfies ActionOutcome

const resolveWaitMs = (props: Readonly<Record<string, unknown>>): number => {
  const { duration, until } = props
  if (typeof duration === 'string' && duration.trim() !== '') {
    return parseDurationMs(duration)
  }
  if (typeof until === 'string' && until.trim() !== '') {
    const target = Date.parse(until)
    if (Number.isFinite(target)) return Math.max(0, target - Date.now())
  }
  return 0
}

export const handleDelayWait: ActionHandler = (action) =>
  Effect.gen(function* () {
    const ms = clampSleep(resolveWaitMs(propsOf(action)))
    yield* sleep(ms)
    return ok({ resumedAt: new Date().toISOString() })
  })

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
    const timeoutMs = parseDurationMs(props['timeout'])
    if (timeoutMs > 0) {
      yield* sleep(clampSleep(timeoutMs))
      return ok({ callbackUrl, callbackId, timedOut: true })
    }
    return ok({ callbackUrl, callbackId })
  })

export const handleDelayQueue: ActionHandler = (action) =>
  Effect.gen(function* () {
    const intervalMs = clampSleep(parseDurationMs(propsOf(action)['interval']))
    yield* sleep(intervalMs)
    return ok()
  })
