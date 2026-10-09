/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The rules of an automation's trigger list.
 *
 * An automation declares either one `trigger` or a `triggers` list of 1 to 10
 * entries. A trigger reached through the automation's one address — the
 * webhook, the manual start, the form action, a call from another automation —
 * appears at most once; the others may repeat when each repetition is named.
 * Names (the type when left out) are unique, and two record triggers never
 * watch the same event of the same table.
 *
 * Every refusal names the automation and the entries at fault, because the
 * decode path only gives the automation's position in the list.
 */

import { MAX_TRIGGERS, MIN_TRIGGERS } from './triggers'

/** Why each addressed trigger type appears at most once in an automation. */
const ADDRESSED_TRIGGER_REASONS: Readonly<Record<string, string>> = {
  webhook: 'an automation has one webhook address',
  manual: 'an automation has one manual start, the same for the API, the console and AI clients',
  form: 'an automation has one form-action address',
  'automation-call': 'another automation calls this one by its name',
}

/** Trigger types an automation reaches through one address, so at most once each. */
const ADDRESSED_TRIGGER_TYPES: ReadonlyArray<string> = Object.keys(ADDRESSED_TRIGGER_REASONS)

/** The part of a trigger these rules read. */
interface LooseTrigger {
  readonly type: string
  readonly name?: string | undefined
  readonly table?: string | undefined
  readonly events?: ReadonlyArray<string> | undefined
}

/** The part of an automation these rules read. */
interface LooseAutomation {
  readonly name: string
  readonly trigger?: LooseTrigger | undefined
  readonly triggers?: ReadonlyArray<LooseTrigger> | undefined
}

/**
 * A trigger's name: its own, or its type when it has none — the name a run of
 * that trigger records and reads at `{{trigger.name}}`.
 *
 * @public
 */
export const triggerEntryName = (trigger: LooseTrigger): string => trigger.name ?? trigger.type

const quoted = (names: ReadonlyArray<string>): string => names.map((n) => `'${n}'`).join(', ')

/** `1`, `1 and 2`, `1, 2 and 3` */
const listPositions = (positions: ReadonlyArray<number>): string =>
  positions.length === 1
    ? String(positions[0])
    : `${positions.slice(0, -1).join(', ')} and ${String(positions[positions.length - 1])}`

const checkForm = (automation: LooseAutomation): true | string => {
  if (automation.trigger !== undefined && automation.triggers !== undefined) {
    return `Automation '${automation.name}' declares both \`trigger\` and \`triggers\`; declare either \`trigger\` or \`triggers\``
  }
  if (automation.trigger === undefined && automation.triggers === undefined) {
    return `Automation '${automation.name}' has no trigger; declare either \`trigger\` or \`triggers\``
  }
  return true
}

const checkSize = (name: string, triggers: ReadonlyArray<LooseTrigger>): true | string =>
  triggers.length >= MIN_TRIGGERS && triggers.length <= MAX_TRIGGERS
    ? true
    : `Automation '${name}' declares ${String(triggers.length)} triggers; an automation takes ${String(MIN_TRIGGERS)} to ${String(MAX_TRIGGERS)} triggers`

const checkAddressedOnce = (name: string, triggers: ReadonlyArray<LooseTrigger>): true | string => {
  const repeated = ADDRESSED_TRIGGER_TYPES.map((type) => ({
    type,
    entries: triggers.filter((trigger) => trigger.type === type),
  })).find(({ entries }) => entries.length > 1)
  if (repeated === undefined) return true
  return `Automation '${name}' has more than one ${repeated.type} trigger (${quoted(repeated.entries.map(triggerEntryName))}); ${ADDRESSED_TRIGGER_REASONS[repeated.type] ?? ''}, so it takes at most one ${repeated.type} trigger`
}

const checkRepeatedTypesNamed = (
  name: string,
  triggers: ReadonlyArray<LooseTrigger>
): true | string => {
  const unnamed = [...new Set(triggers.map((trigger) => trigger.type))]
    .map((type) => ({
      type,
      positions: triggers.flatMap((trigger, index) =>
        trigger.type === type && trigger.name === undefined ? [index + 1] : []
      ),
      count: triggers.filter((trigger) => trigger.type === type).length,
    }))
    .find(({ count, positions }) => count > 1 && positions.length > 0)
  if (unnamed === undefined) return true
  const which = unnamed.positions.length === 1 ? 'entry' : 'entries'
  const has = unnamed.positions.length === 1 ? 'has' : 'have'
  return `Automation '${name}': the trigger type '${unnamed.type}' appears more than once, so every ${unnamed.type} trigger needs a \`name\`; ${which} ${listPositions(unnamed.positions)} ${has} none`
}

const checkUniqueNames = (name: string, triggers: ReadonlyArray<LooseTrigger>): true | string => {
  const names = triggers.map(triggerEntryName)
  const repeated = names.find((entry, index) => names.indexOf(entry) !== index)
  return repeated === undefined
    ? true
    : `Automation '${name}' uses the trigger name '${repeated}' more than once; trigger names are unique within an automation`
}

const checkRecordWatches = (name: string, triggers: ReadonlyArray<LooseTrigger>): true | string => {
  const watches = triggers.flatMap((trigger) =>
    trigger.type === 'record' && trigger.table !== undefined
      ? (trigger.events ?? []).map((event) => ({
          key: `${trigger.table ?? ''}\u0000${event}`,
          table: trigger.table ?? '',
          event,
          entry: triggerEntryName(trigger),
        }))
      : []
  )
  const clash = watches.find((watch, index) =>
    watches
      .slice(0, index)
      .some((earlier) => earlier.key === watch.key && earlier.entry !== watch.entry)
  )
  if (clash === undefined) return true
  const entries = [
    ...new Set(watches.filter((watch) => watch.key === clash.key).map((watch) => watch.entry)),
  ]
  return `Automation '${name}': table '${clash.table}' event '${clash.event}' is watched by more than one trigger (${quoted(entries)}); one write would start two runs`
}

/**
 * Judge an automation's trigger declaration. Returns `true`, or the first
 * refusal as a message naming the automation and the entries at fault.
 */
export const validateTriggerList = (automation: LooseAutomation): true | string => {
  const form = checkForm(automation)
  if (form !== true) return form
  const { triggers } = automation
  if (triggers === undefined) return true
  const checks = [
    checkSize,
    checkAddressedOnce,
    checkRepeatedTypesNamed,
    checkUniqueNames,
    checkRecordWatches,
  ] as const
  return checks.reduce<true | string>(
    (verdict, check) => (verdict === true ? check(automation.name, triggers) : verdict),
    true
  )
}
