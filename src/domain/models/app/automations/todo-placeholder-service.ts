/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What an automation still has to set up: every `{{todo.<name>}}` it holds, and
 * where. The automations catalogue publishes this so an operator can see which
 * imported automation is not ready to switch on, and what is left in it.
 *
 * It walks exactly what the enabled-automation rule walks
 * (`todo-placeholder-validation.ts`): each trigger, each step's own part at any
 * depth, and the body of an action template a step calls, counted against the
 * calling step. Unlike that rule it reads a switched-off automation too, which
 * is the one this listing is for.
 */

import { isRecord } from '@/domain/kernel/config-parsing/plain-object'
import {
  ownPart,
  placeholderNames,
  stepName,
  stepsIn,
  triggersOf,
} from './todo-placeholder-validation'

/** One placeholder left to set up, and where it sits. */
export interface AutomationPlaceholder {
  readonly name: string
  readonly path: string
  readonly label: string
  readonly step?: string
}

/** What an automation still holds: the distinct names, counted, and every entry. */
export interface AutomationPlaceholders {
  readonly placeholderCount: number
  readonly placeholders: readonly AutomationPlaceholder[]
}

/** A config address from the automation: `actions[1].props.actions[0]`, `trigger`. */
export const formatConfigAddress = (path: readonly (string | number)[]): string =>
  path.reduce<string>(
    (address, segment) =>
      typeof segment === 'number'
        ? `${address}[${String(segment)}]`
        : address === ''
          ? segment
          : `${address}.${segment}`,
    ''
  )

/** The body each action template calls, by template name. */
const templateBodies = (actions: readonly unknown[] | undefined): ReadonlyMap<string, unknown> =>
  new Map(
    (actions ?? []).flatMap((template: unknown) =>
      isRecord(template) ? [[String(template['name']), template['action']] as const] : []
    )
  )

/** The placeholders a step holds: its own part, then the template it calls. */
const stepNames = (
  step: Readonly<Record<string, unknown>>,
  bodies: ReadonlyMap<string, unknown>
): readonly string[] => {
  const ref = step['$ref']
  const template = step['type'] === 'ref' && typeof ref === 'string' ? bodies.get(ref) : undefined
  return [...new Set([...placeholderNames(ownPart(step)), ...placeholderNames(template)])]
}

/**
 * Every placeholder `automation` still holds, in config order: its triggers, then
 * its steps at any depth. One entry per distinct name per trigger or step.
 *
 * @param actions - the app's action templates, whose bodies count against the step calling them.
 * @returns `undefined` when the automation holds none.
 */
export const automationPlaceholders = (
  automation: unknown,
  actions?: readonly unknown[]
): AutomationPlaceholders | undefined => {
  if (!isRecord(automation)) return undefined
  const bodies = templateBodies(actions)
  const onTriggers = triggersOf(automation, []).flatMap(([trigger, path]) =>
    placeholderNames(trigger).map((name) => ({
      name,
      path: formatConfigAddress(path),
      label: `trigger · ${name}`,
    }))
  )
  const onSteps = stepsIn(automation['actions'], ['actions']).flatMap(([step, path]) =>
    stepNames(step, bodies).map((name) => ({
      name,
      path: formatConfigAddress(path),
      step: stepName(step),
      label: `${stepName(step)} · ${name}`,
    }))
  )
  const placeholders = [...onTriggers, ...onSteps]
  if (placeholders.length === 0) return undefined
  return {
    placeholderCount: new Set(placeholders.map((entry) => entry.name)).size,
    placeholders,
  }
}
