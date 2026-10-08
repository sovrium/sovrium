/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The delays a configuration declares that the engine cannot keep, refused at
 * validation.
 *
 *   - a `delay/wait` whose `duration`, or a `delay/webhook` whose `timeout`, is
 *     longer than 90 days: a parked run is resumed against the configuration of
 *     the day it resumes, and a horizon that long belongs to a `cron` trigger
 *     reading the records that are due;
 *   - a `delay/queue` whose `interval` is longer than one minute: the queue
 *     spaces actions inside the running process, and a spacing measured in
 *     minutes is a schedule.
 *
 * Each is refused before the app starts, naming the automation, the step and
 * the limit. Reads every delay step in an automation's `actions`, however
 * deeply a `path` or a `loop` nests it. Runs over the RAW config at the shared
 * decode boundary, so boot, `sovrium validate` and a watch reload reach the
 * same verdict. Pure.
 */

import {
  MAX_DELAY_LABEL,
  MAX_DELAY_MS,
  PARK_THRESHOLD_MS,
  parseDelayDurationMs,
} from './delay-wait-service'

type RawRecord = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is RawRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Every delay step reachable from `value`. Only the keys that nest steps are
 * followed — a branch's `props.paths[].actions`, a loop's `props.actions` —
 * so an object a record step writes that happens to read `type: delay` is
 * data, not a step.
 */
function delayStepsOf(value: unknown): readonly RawRecord[] {
  if (Array.isArray(value)) return value.flatMap(delayStepsOf)
  if (!isRecord(value)) return []
  const self = value['type'] === 'delay' ? [value] : []
  const props = isRecord(value['props']) ? value['props'] : {}
  const nested = [value['actions'], value['paths'], props['actions'], props['paths']].flatMap(
    delayStepsOf
  )
  return [...self, ...nested]
}

/** The prop each delay operator bounds, and its limit. */
const LIMITS: Readonly<
  Record<string, { readonly prop: string; readonly maxMs: number; readonly label: string }>
> = {
  wait: { prop: 'duration', maxMs: MAX_DELAY_MS, label: MAX_DELAY_LABEL },
  webhook: { prop: 'timeout', maxMs: MAX_DELAY_MS, label: MAX_DELAY_LABEL },
  queue: { prop: 'interval', maxMs: PARK_THRESHOLD_MS, label: 'one minute (60s)' },
}

/** The refusal for one delay step, or `undefined` when it is within its limit. */
function limitRefusal(automation: string, step: RawRecord): string | undefined {
  const limit = LIMITS[String(step['operator'] ?? '')]
  if (limit === undefined) return undefined
  const props = isRecord(step['props']) ? step['props'] : {}
  const value = props[limit.prop]
  if (parseDelayDurationMs(value) <= limit.maxMs) return undefined
  const where = `Automation '${automation}', step '${String(step['name'] ?? '(unnamed)')}'`
  return `${where}: \`${limit.prop}\` ${String(value)} is longer than ${limit.label}, the most a delay/${String(step['operator'])} step allows. Use a \`cron\` trigger that reads the records that are due instead.`
}

/**
 * Refuse every delay step whose declared length is beyond its limit.
 *
 * @returns one message per refused step, empty when every delay is within bounds
 */
export function validateDelayLimits(config: unknown): readonly string[] {
  const automations = isRecord(config) ? config['automations'] : undefined
  if (!Array.isArray(automations)) return []
  return automations.filter(isRecord).flatMap((automation) => {
    const name = String(automation['name'] ?? '(unnamed)')
    return delayStepsOf(automation['actions']).flatMap((step) => {
      const refusal = limitRefusal(name, step)
      return refusal === undefined ? [] : [refusal]
    })
  })
}
