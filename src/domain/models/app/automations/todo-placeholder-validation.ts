/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { nestedLists } from './reserved-step-name-validation'

/**
 * An automation that still holds a `{{todo.<name>}}` placeholder may not run.
 *
 * `sovrium import` writes every required parameter a source step did not give
 * as `{{todo.<name>}}`, and writes the automation switched off. While it is off
 * the placeholders are accepted; once it is on — `enabled: true`, or no
 * `enabled` at all — every placeholder left in its trigger, its steps at any
 * depth, or the body of a reusable action template one of its steps calls is
 * refused, one issue per distinct name per step, at the path of the step (or
 * trigger) that holds it. A template no live automation calls is never refused.
 *
 * The steps' half runs in the automation schema; the trigger and template
 * halves run on the app (see {@link findAppTodoPlaceholders}).
 */

/** One refused placeholder: where it sits, and why. */
export interface TodoPlaceholderIssue {
  readonly path: readonly (string | number)[]
  readonly issue: string
}

type Raw = Readonly<Record<string, unknown>>
type Path = readonly (string | number)[]

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const PLACEHOLDER = /\{\{\s*todo\.([^{}\s]+)\s*\}\}/g

/** Every string in a value, at any depth, in document order. */
const stringsIn = (value: unknown): readonly string[] => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsIn)
  return isRecord(value) ? Object.values(value).flatMap(stringsIn) : []
}

/** The distinct placeholder names a value holds, in document order. */
export const placeholderNames = (value: unknown): readonly string[] => [
  ...new Set(
    stringsIn(value).flatMap((text) =>
      [...text.matchAll(PLACEHOLDER)].flatMap((match) => (match[1] ? [match[1]] : []))
    )
  ),
]

/** `value` with whatever sits at `path` removed. */
const omitAt = (value: unknown, path: Path): unknown => {
  const [head, ...rest] = path
  if (head === undefined) return undefined
  if (Array.isArray(value) && typeof head === 'number') {
    return value.map((item: unknown, index) => (index === head ? omitAt(item, rest) : item))
  }
  if (!isRecord(value) || typeof head !== 'string') return value
  return { ...value, [head]: rest.length === 0 ? undefined : omitAt(value[head], rest) }
}

/** A step without the steps it holds: those are judged at their own paths. */
const ownPart = (step: Raw): unknown =>
  nestedLists(step).reduce<unknown>((part, [, below]) => omitAt(part, below), step)

const isLive = (automation: Raw): boolean => automation['enabled'] !== false

const message = (automation: string, where: string, name: string): string =>
  `Automation '${automation}' is enabled, but ${where} still holds the placeholder {{todo.${name}}}. Set a value for '${name}', or keep the automation at enabled: false until every placeholder is filled in.`

/** Every step of a step list, at any depth, with its path, in document order. */
const stepsIn = (steps: unknown, at: Path): readonly (readonly [Raw, Path])[] =>
  Array.isArray(steps)
    ? steps.flatMap((step: unknown, index) => {
        if (!isRecord(step)) return []
        const path = [...at, index]
        const nested = nestedLists(step).flatMap(([list, below]) =>
          stepsIn(list, [...path, ...below])
        )
        return [[step, path] as const, ...nested]
      })
    : []

const stepName = (step: Raw): string => String(step['name'])

/**
 * One issue per distinct placeholder name per step of one authored automation,
 * at any depth, when the automation is live. Paths are from the automation
 * (`['actions', 1, 'props', 'actions', 0]`).
 */
export const findTodoPlaceholders = (automation: unknown): readonly TodoPlaceholderIssue[] => {
  if (!isRecord(automation) || !isLive(automation)) return []
  const name = String(automation['name'])
  return stepsIn(automation['actions'], ['actions']).flatMap(([step, path]) =>
    placeholderNames(ownPart(step)).map((todo) => ({
      path,
      issue: message(name, `step '${stepName(step)}'`, todo),
    }))
  )
}

/**
 * Each trigger of a decoded automation with its path in the authored form the
 * schema writes back: one trigger is `trigger`, several are `triggers[j]`.
 */
const triggersOf = (automation: Raw, at: Path): readonly (readonly [Raw, Path])[] => {
  const triggers = Array.isArray(automation['triggers']) ? automation['triggers'] : []
  return triggers.flatMap((entry: unknown, index) => {
    if (!isRecord(entry)) return []
    return [[entry, triggers.length === 1 ? [...at, 'trigger'] : [...at, 'triggers', index]]]
  })
}

/** The trigger half of one live automation, at app-root paths. */
const triggerIssues = (automation: Raw, at: Path): readonly TodoPlaceholderIssue[] => {
  const name = String(automation['name'])
  return triggersOf(automation, at).flatMap(([trigger, path]) => {
    const where = `its trigger '${String(trigger['name'] ?? trigger['type'])}'`
    return placeholderNames(trigger).map((todo) => ({ path, issue: message(name, where, todo) }))
  })
}

/** The template-body half of one live automation, at the calling steps' app-root paths. */
const templateIssues = (
  automation: Raw,
  at: Path,
  bodies: ReadonlyMap<string, unknown>
): readonly TodoPlaceholderIssue[] => {
  const name = String(automation['name'])
  return stepsIn(automation['actions'], [...at, 'actions']).flatMap(([step, path]) => {
    const ref = step['$ref']
    if (step['type'] !== 'ref' || typeof ref !== 'string' || !bodies.has(ref)) return []
    const where = `step '${stepName(step)}', through the action template '${ref}',`
    return placeholderNames(bodies.get(ref)).map((todo) => ({
      path,
      issue: message(name, where, todo),
    }))
  })
}

/**
 * The halves judged on the decoded app, where `$ref` resolves: each live
 * automation's trigger, then the body of every reusable action template
 * (`app.actions[]`) one of its steps calls, reported at the calling step. Both
 * sit here rather than beside the steps' half so that one run reports them
 * together: a refusal inside an automation stops the app-level checks.
 */
export const findAppTodoPlaceholders = (app: {
  readonly automations?: readonly unknown[] | undefined
  readonly actions?: readonly unknown[] | undefined
}): readonly TodoPlaceholderIssue[] => {
  const bodies = new Map(
    (app.actions ?? []).flatMap((template: unknown) =>
      isRecord(template) ? [[String(template['name']), template['action']] as const] : []
    )
  )
  return (app.automations ?? []).flatMap((automation: unknown, index) => {
    if (!isRecord(automation) || !isLive(automation)) return []
    const at = ['automations', index]
    return [...triggerIssues(automation, at), ...templateIssues(automation, at, bodies)]
  })
}
