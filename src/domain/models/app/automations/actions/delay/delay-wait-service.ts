/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How long a `delay` step waits, and the limits on it.
 *
 * A wait of one minute or less sleeps inside the run. A longer one parks the
 * run in the database and a sweep resumes it, so nothing is ever shortened —
 * and nothing waits longer than {@link MAX_DELAY_MS}: a static `duration` past
 * it is refused at validation, an `until` resolving past it fails the step.
 * `delay/queue` spaces runs inside the process only, so its `interval` stays
 * within {@link PARK_THRESHOLD_MS}.
 */

import { DateTime, Option } from 'effect'

/** Waits up to this long sleep inside the run; longer ones park it. */
export const PARK_THRESHOLD_MS = 60_000

/** The longest wait a run may park for: 90 days. */
export const MAX_DELAY_MS = 90 * 86_400_000

/** The ceiling, as the refusals word it. */
export const MAX_DELAY_LABEL = '90 days'

const DURATION_PATTERN = /^(\d+)\s*(ms|s|m|h|d)$/

const UNIT_MS: Readonly<Record<string, number>> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

/**
 * A `"<n><unit>"` duration (`30s`, `24h`, `7d`) in milliseconds; `0` for a
 * malformed or absent value — a missing delay is a no-op, not an error.
 */
export const parseDelayDurationMs = (value: unknown): number => {
  if (typeof value !== 'string') return 0
  const match = DURATION_PATTERN.exec(value.trim())
  if (match === null) return 0
  return Number(match[1]) * (UNIT_MS[match[2] as string] ?? 0)
}

/** A date-time that names its own offset (`Z`, `+02:00`, `-0500`). */
const HAS_OFFSET = /T.*(?:Z|[+-]\d{2}(?::?\d{2})?)$/i

/**
 * The instant an `until` names, in epoch milliseconds, or `undefined` when it
 * names none.
 *
 * With an offset or `Z` it is that instant. Without one — `2026-12-24T09:00`,
 * or a bare date read as its midnight — it is read as wall-clock time in
 * `zoneId`, the operator time zone, never the host's.
 */
export const resolveUntilInstantMs = (until: string, zoneId: string): number | undefined => {
  const text = until.trim()
  if (text === '') return undefined
  if (HAS_OFFSET.test(text)) {
    return Option.match(DateTime.make(text), {
      onNone: () => undefined,
      onSome: DateTime.toEpochMillis,
    })
  }
  return Option.match(DateTime.makeZoned(text, { timeZone: zoneId, adjustForTimeZone: true }), {
    onNone: () => undefined,
    onSome: DateTime.toEpochMillis,
  })
}

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A `delay/wait`, or a `delay/webhook` with a `timeout`: a step that may park its run. */
const mayPark = (step: RawRecord): boolean => {
  if (step['type'] !== 'delay') return false
  const props = isRecord(step['props']) ? step['props'] : {}
  return step['operator'] === 'wait' || (step['operator'] === 'webhook' && 'timeout' in props)
}

/** Whether `value` — a step, a list of steps — holds a step that may park, however deeply nested. */
const holdsParkingStep = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(holdsParkingStep)
  if (!isRecord(value)) return false
  if (mayPark(value)) return true
  const props = isRecord(value['props']) ? value['props'] : {}
  return [value['action'], value['actions'], props['actions'], props['paths']].some(
    holdsParkingStep
  )
}

/**
 * Whether an app declares a step that may park a run — so whether it needs the
 * sweep that resumes parked runs. Reads every automation's actions and every
 * reusable action template, however deeply a `path` or a `loop` nests them.
 */
export const declaresParkingDelay = (config: {
  readonly automations?: readonly unknown[] | undefined
  readonly actions?: readonly unknown[] | undefined
}): boolean =>
  (config.automations ?? []).some(
    (automation) => isRecord(automation) && holdsParkingStep(automation['actions'])
  ) || holdsParkingStep(config.actions ?? [])
