/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mapStringsDeep } from './value-walker'

export interface ActionTemplateLike {
  readonly name: string
  readonly action: Readonly<Record<string, unknown>>
  readonly variables?: Readonly<Record<string, unknown>>
}

const substituteVarsInString = (input: string, vars: Readonly<Record<string, unknown>>): string =>
  input.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return match
    const replacement = vars[name]
    return replacement === undefined || replacement === null ? '' : String(replacement)
  })

export const substituteVars = (value: unknown, vars: Readonly<Record<string, unknown>>): unknown =>
  mapStringsDeep(value, (s) => substituteVarsInString(s, vars))

export const applyTemplateVars = (
  template: ActionTemplateLike,
  callerVars: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> => {
  const merged = { ...(template.variables ?? {}), ...(callerVars ?? {}) }
  return substituteVars(template.action, merged) as Record<string, unknown>
}

export const expandRefAction = (
  rawAction: Readonly<Record<string, unknown>>,
  templates: ReadonlyArray<ActionTemplateLike>
): Readonly<Record<string, unknown>> => {
  if (rawAction['type'] !== 'ref') return rawAction

  const refName = String(rawAction['$ref'] ?? '')
  const template = templates.find((t) => t.name === refName)
  if (!template) return rawAction

  const overrides = rawAction['$vars'] as Record<string, unknown> | undefined
  const expanded = applyTemplateVars(template, overrides) as Record<string, unknown>

  return { ...expanded, name: rawAction['name'] ?? expanded['name'] }
}

export const expandRefActions = (
  actions: ReadonlyArray<Readonly<Record<string, unknown>>>,
  templates: ReadonlyArray<ActionTemplateLike>
): ReadonlyArray<Readonly<Record<string, unknown>>> =>
  actions.map((action) => {
    if (action['type'] === 'ref') return expandRefAction(action, templates)

    if (action['type'] === 'path') {
      const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
      const paths = (props['paths'] as ReadonlyArray<Record<string, unknown>> | undefined) ?? []
      const expandedPaths = paths.map((branch) => ({
        ...branch,
        actions: expandRefActions(
          (branch['actions'] as ReadonlyArray<Record<string, unknown>>) ?? [],
          templates
        ),
      }))
      return { ...action, props: { ...props, paths: expandedPaths } }
    }

    if (action['type'] === 'loop') {
      const props = (action['props'] as Record<string, unknown> | undefined) ?? {}
      const loopActions =
        (props['actions'] as ReadonlyArray<Record<string, unknown>> | undefined) ?? []
      return {
        ...action,
        props: {
          ...props,
          actions: expandRefActions(loopActions, templates),
        },
      }
    }

    return action
  })
