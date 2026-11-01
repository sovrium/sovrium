/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { nestedLists } from './reserved-step-name-validation'

/**
 * The automation steps of a config that run code: a `code` step, at any depth
 * an author can nest one (a loop's body, a path's branches), and a `ref` step
 * calling an `app.actions[]` template that holds one. Each runs TypeScript on
 * every trigger, with the access the project has, whatever the config's
 * format — which is what `sovrium init` names before it creates a project
 * from a source somebody else wrote.
 *
 * Reads the RAW config (a parsed document, `$ref` partials already inlined),
 * never the decoded app: a config from elsewhere is judged before anything
 * decides it is valid. Anything that is not the expected shape is skipped.
 */

/** One step that runs code: the automation it belongs to, and its own name. */
export interface CodeStep {
  readonly automation: string
  readonly step: string
}

type Raw = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : [])

/** `app.actions[]` by template name: the action each one stands for. */
const templatesOf = (config: Raw): ReadonlyMap<string, unknown> =>
  new Map(
    listOf(config['actions']).flatMap((template) =>
      isRecord(template) && typeof template['name'] === 'string'
        ? [[template['name'], template['action']] as const]
        : []
    )
  )

/**
 * Whether one action runs code: it is a `code` step, it calls a template that
 * does, or a step nested in it does. `seen` holds the templates already being
 * followed, so a template that calls itself ends the walk instead of looping.
 */
const runsCode = (
  action: unknown,
  templates: ReadonlyMap<string, unknown>,
  seen: ReadonlySet<string>
): boolean => {
  if (!isRecord(action)) return false
  if (action['type'] === 'code') return true
  const called = action['$ref']
  const callsCode =
    action['type'] === 'ref' &&
    typeof called === 'string' &&
    !seen.has(called) &&
    runsCode(templates.get(called), templates, new Set([...seen, called]))
  if (callsCode) return true
  return nestedLists(action).some(([list]) =>
    listOf(list).some((step) => runsCode(step, templates, seen))
  )
}

/** The named steps of one action list that run code, nested ones named by their own name. */
const codeStepNames = (
  actions: unknown,
  templates: ReadonlyMap<string, unknown>
): readonly string[] =>
  listOf(actions).flatMap((action) => {
    if (!isRecord(action)) return []
    const nested = nestedLists(action).flatMap(([list]) => codeStepNames(list, templates))
    if (nested.length > 0) return nested
    return runsCode(action, templates, new Set()) && typeof action['name'] === 'string'
      ? [action['name']]
      : []
  })

/** Every step of `config`'s automations that runs code, in declaration order. */
export const codeStepsOf = (config: unknown): readonly CodeStep[] => {
  if (!isRecord(config)) return []
  const templates = templatesOf(config)
  return listOf(config['automations']).flatMap((automation) =>
    isRecord(automation) && typeof automation['name'] === 'string'
      ? codeStepNames(automation['actions'], templates).map((step) => ({
          automation: automation['name'] as string,
          step,
        }))
      : []
  )
}
