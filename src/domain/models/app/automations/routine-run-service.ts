/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which runs of the admin history are routine.
 *
 * A run is routine when the trigger entry that started it, read from the
 * configuration as it is now, declares `history: minimal` or `history: none`,
 * or is a schedule firing every minute or more often — AND it ended
 * unremarkably: one of {@link ROUTINE_RUN_STATUSES}. A run an operator started
 * by hand is never routine. The status and by-hand halves are read by the
 * database; this module names the trigger entries, per automation.
 */

import { Cron, Result } from 'effect'
import { keepsMinimalHistory } from './trigger/trigger-history-service'
import { triggerEntryName } from './trigger-list-validation'
import type { Trigger } from './trigger'

/** The only statuses a routine run can carry: anything else is about something. */
export const ROUTINE_RUN_STATUSES = ['completed', 'skipped', 'queued', 'running'] as const

/** The widest gap between two fires that still makes a schedule routine. */
const ROUTINE_GAP_MS = 60_000

/** How many upcoming fires are compared when no field settles the question. */
const SAMPLED_FIRES = 600

/** A fixed reference instant, so the answer never depends on when it is asked. */
const SAMPLE_FROM = new Date('2026-01-01T00:00:00.000Z')

/**
 * Whether a cron expression fires every minute or more often: the shortest gap
 * between two of its fires is one minute or less. Two or more seconds in a
 * six-field expression always are; otherwise the next {@link SAMPLED_FIRES}
 * fires are compared. An expression that does not parse is not routine.
 */
export const firesEveryMinuteOrMoreOften = (expression: string): boolean => {
  const parsed = Cron.parse(expression, 'UTC')
  if (!Result.isSuccess(parsed)) return false
  const cron = parsed.success
  if (cron.seconds.size > 1) return true
  const fires = Array.from({ length: SAMPLED_FIRES }).reduce<{
    readonly previous: Date
    readonly routine: boolean
  }>(
    (state) => {
      if (state.routine) return state
      const fire = Cron.next(cron, state.previous)
      return {
        previous: fire,
        routine: fire.getTime() - state.previous.getTime() <= ROUTINE_GAP_MS,
      }
    },
    { previous: Cron.next(cron, SAMPLE_FROM), routine: false }
  )
  return fires.routine
}

/** Whether runs this trigger entry starts are routine when they end unremarkably. */
export const isRoutineTrigger = (trigger: Trigger): boolean =>
  keepsMinimalHistory(trigger) ||
  (trigger.type === 'cron' && firesEveryMinuteOrMoreOften(trigger.expression))

/**
 * The runs of one automation that come from routine trigger entries.
 * `triggerNames` undefined means every run of the automation, whatever entry
 * it recorded; otherwise the runs that recorded one of those names, plus — when
 * `orUnrecorded` — the runs that recorded no name, which read as the first entry.
 */
export interface RoutineRunSource {
  readonly automationName: string
  readonly triggerNames?: ReadonlyArray<string> | undefined
  readonly orUnrecorded: boolean
}

/** The part of an automation this reader needs. */
interface RoutineCandidate {
  readonly name: string
  readonly triggers: ReadonlyArray<Trigger>
}

const sourceOf = (automation: RoutineCandidate): RoutineRunSource | undefined => {
  const routine = automation.triggers.filter(isRoutineTrigger)
  if (routine.length === 0) return undefined
  if (routine.length === automation.triggers.length) {
    return { automationName: automation.name, orUnrecorded: true }
  }
  const first = automation.triggers[0]
  return {
    automationName: automation.name,
    triggerNames: routine.map(triggerEntryName),
    orUnrecorded: first !== undefined && isRoutineTrigger(first),
  }
}

/**
 * Every automation with at least one routine trigger entry, and which of its
 * runs those entries started. An automation no longer declared is absent, so
 * its runs are never routine.
 */
export const routineRunSources = (
  automations: ReadonlyArray<RoutineCandidate> | undefined
): ReadonlyArray<RoutineRunSource> =>
  (automations ?? []).flatMap((automation) => {
    const source = sourceOf(automation)
    return source === undefined ? [] : [source]
  })
