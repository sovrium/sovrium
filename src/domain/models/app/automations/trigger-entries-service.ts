/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Reading an automation's trigger list.
 *
 * Every consumer reads `automation.triggers`: a run is started by ONE entry of
 * that list, and that entry — its type and its name — is what the run records
 * and reads at `{{trigger.type}}` / `{{trigger.name}}`. When one event matches
 * several entries of the same automation, the FIRST of them starts the one run.
 */

import { triggerEntryName } from './trigger-list-validation'
import type { Trigger } from './trigger'

/** The trigger entry of one type. */
export type TriggerOfType<T extends Trigger['type']> = Extract<Trigger, { readonly type: T }>

/** The part of an automation these readers need. */
interface WithTriggers {
  readonly triggers: ReadonlyArray<Trigger>
}

/** The first entry — the list holds 1 to 10, so there always is one. */
export const firstTrigger = (automation: WithTriggers): Trigger => automation.triggers[0] as Trigger

/** Every entry of `type`, in declaration order. */
export const triggersOfType = <T extends Trigger['type']>(
  automation: WithTriggers,
  type: T
): ReadonlyArray<TriggerOfType<T>> =>
  automation.triggers.filter((trigger): trigger is TriggerOfType<T> => trigger.type === type)

/** The first entry of `type` — for an addressed type (webhook, manual, form, call), the only one. */
export const triggerOfType = <T extends Trigger['type']>(
  automation: WithTriggers,
  type: T
): TriggerOfType<T> | undefined => triggersOfType(automation, type)[0]

/**
 * The entry a run reached by `type` is recorded under: that entry, or the first
 * one when the automation has none of that type (a call or a "run now" of an
 * automation that does not declare it).
 */
export const triggerOfTypeOrFirst = (automation: WithTriggers, type: Trigger['type']): Trigger =>
  triggerOfType(automation, type) ?? firstTrigger(automation)

/**
 * Every entry of `type` across a list of automations, each with the name of
 * its automation — what a cross-automation rule walks.
 */
export const entriesOfType = <T extends Trigger['type']>(
  automations: ReadonlyArray<WithTriggers & { readonly name: string }>,
  type: T
): ReadonlyArray<{ readonly automation: string; readonly trigger: TriggerOfType<T> }> =>
  automations.flatMap((automation) =>
    triggersOfType(automation, type).map((trigger) => ({ automation: automation.name, trigger }))
  )

/** Whether the automation has an entry of `type`. */
export const hasTriggerOfType = (automation: WithTriggers, type: Trigger['type']): boolean =>
  automation.triggers.some((trigger) => trigger.type === type)

/**
 * The first entry of `type` the event matches: the entry that starts the one
 * run an event gives an automation, however many of its entries it matches.
 */
export const firstMatchingTrigger = <T extends Trigger['type']>(
  automation: WithTriggers,
  type: T,
  matches: (trigger: TriggerOfType<T>) => boolean
): TriggerOfType<T> | undefined => triggersOfType(automation, type).find(matches)

/**
 * The entry a run recorded by name — or the first entry when the run recorded
 * none (a run from before names existed) or the name is no longer in the list.
 */
export const triggerNamedOrFirst = (
  automation: WithTriggers,
  name: string | null | undefined
): Trigger =>
  (name === null || name === undefined
    ? undefined
    : automation.triggers.find((trigger) => triggerEntryName(trigger) === name)) ??
  firstTrigger(automation)

/**
 * The entry a run recorded, for a judgement that must not guess: the entry of
 * the recorded name; for a run recorded before names existed, the only entry
 * of a one-trigger automation. `undefined` when the run cannot be placed — a
 * name no longer in the list, or no name and several entries — so a read gate
 * never judges a run's captured data against another entry's table.
 */
export const recordedTrigger = (
  automation: WithTriggers,
  name: string | null | undefined
): Trigger | undefined => {
  if (name !== null && name !== undefined) {
    return automation.triggers.find((trigger) => triggerEntryName(trigger) === name)
  }
  return automation.triggers.length === 1 ? firstTrigger(automation) : undefined
}

/** The type and the name of a run's trigger, as the runs history reports them. */
export interface RunTrigger {
  readonly triggerType: string
  readonly triggerName: string
}

/**
 * The trigger of a recorded run. A run records its trigger's name; its type is
 * read from the automation's entry of that name. A run recorded before names
 * existed reads as its automation's first entry, named after its type. A name
 * no longer in the list, or an automation no longer in the config, keeps the
 * recorded name and reads the first entry's type — `webhook` when there is no
 * automation left, the type the history always gave a run it could not place.
 */
export const runTriggerOf = (
  automation: WithTriggers | undefined,
  recordedName: string | null | undefined
): RunTrigger => {
  const first = automation?.triggers[0]
  const recorded = recordedName ?? undefined
  const entry =
    recorded === undefined
      ? undefined
      : automation?.triggers.find((trigger) => triggerEntryName(trigger) === recorded)
  const triggerType = (entry ?? first)?.type ?? 'webhook'
  return { triggerType, triggerName: recorded ?? triggerType }
}

/** A run-history filter on the name of the trigger that started each run. */
export interface TriggerNameFilter {
  readonly name: string
  /** Also keep the runs that recorded no name: they read as their automation's first entry. */
  readonly orUnrecorded: boolean
}

/**
 * The `?triggerName=` filter of a run history. A run recorded before names
 * reads as its automation's first entry, so it is kept when that entry carries
 * the name asked for — knowable only when the list is narrowed to one automation.
 */
export const triggerNameFilterOf = (
  automations: ReadonlyArray<WithTriggers & { readonly name: string }> | undefined,
  automationName: string | undefined,
  triggerName: string
): TriggerNameFilter => {
  const automation =
    automationName === undefined
      ? undefined
      : automations?.find((candidate) => candidate.name === automationName)
  return {
    name: triggerName,
    orUnrecorded:
      automation !== undefined && runTriggerOf(automation, undefined).triggerName === triggerName,
  }
}
