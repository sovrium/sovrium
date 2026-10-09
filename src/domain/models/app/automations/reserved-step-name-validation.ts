/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two step names a run's templates keep for loop items.
 *
 * Inside a loop, `{{loop.*}}` reads the innermost loop's item and position and
 * `{{loops.<loop name>.*}}` reads any loop around the action by its step name.
 * A step named `loop` or `loops` would put its output under the same root, so
 * one of the two would shadow the other depending on where the template sits.
 * The names are refused instead, at every depth an author can nest a step —
 * a loop's body, a path's branches — each refusal naming the step and pointing
 * at where it sits. A name that merely starts with `loop` stays valid.
 */

/** The step names a run's templates keep for loop items. */
const RESERVED_STEP_NAMES: ReadonlySet<string> = new Set(['loop', 'loops'])

/** One refused step: where it sits under the automation, and why. */
export interface ReservedStepNameIssue {
  readonly path: readonly (string | number)[]
  readonly issue: string
}

type Raw = Readonly<Record<string, unknown>>

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const reservedNameMessage = (name: string): string =>
  `Step '${name}' uses a name kept for loop items: \`{{loop.*}}\` reads the innermost loop and \`{{loops.<loop name>.*}}\` any loop around a step, so no step may be named 'loop' or 'loops'. Rename the step, and every \`{{${name}.…}}\` that read its output.`

/** The action lists nested in one action, each with its path below the action. */
const nestedLists = (
  action: Raw
): readonly (readonly [unknown, readonly (string | number)[]])[] => {
  const props = isRecord(action['props']) ? action['props'] : {}
  if (action['type'] === 'loop') return [[props['actions'], ['props', 'actions']]]
  if (action['type'] !== 'path' || !Array.isArray(props['paths'])) return []
  return props['paths'].map(
    (branch: unknown, index) =>
      [
        isRecord(branch) ? branch['actions'] : undefined,
        ['props', 'paths', index, 'actions'],
      ] as const
  )
}

/** The refused steps of one action list, at any depth, with paths under `at`. */
const issuesIn = (
  actions: unknown,
  at: readonly (string | number)[]
): readonly ReservedStepNameIssue[] =>
  Array.isArray(actions)
    ? actions.flatMap((action: unknown, index) => {
        if (!isRecord(action)) return []
        const path = [...at, index]
        const { name } = action
        const own =
          typeof name === 'string' && RESERVED_STEP_NAMES.has(name)
            ? [{ path, issue: reservedNameMessage(name) }]
            : []
        const nested = nestedLists(action).flatMap(([list, below]) =>
          issuesIn(list, [...path, ...below])
        )
        return [...own, ...nested]
      })
    : []

/**
 * One issue per step named `loop` or `loops` among an automation's actions,
 * at any depth, each with its path from the automation (`['actions', 1]`,
 * `['actions', 0, 'props', 'actions', 0]`).
 */
export const findReservedStepNames = (actions: unknown): readonly ReservedStepNameIssue[] =>
  issuesIn(actions, ['actions'])

/**
 * The same refusal for the steps nested in one reusable action template
 * (`app.actions[].action`): a template that is a loop or a path brings its body
 * into every automation that calls it, so a step named `loop` or `loops` there
 * shadows the same roots. The template's own name is the caller's step name at
 * run time, so only its nested steps are checked, with paths under `at`.
 */
export const findReservedNestedStepNames = (
  action: unknown,
  at: readonly (string | number)[]
): readonly ReservedStepNameIssue[] =>
  isRecord(action)
    ? nestedLists(action).flatMap(([list, below]) => issuesIn(list, [...at, ...below]))
    : []

/** Every step name nested in one action, at any depth, in order. */
const nestedStepNames = (action: Raw): readonly string[] =>
  nestedLists(action).flatMap(([list]) =>
    Array.isArray(list)
      ? list.flatMap((step: unknown) =>
          isRecord(step)
            ? [
                ...(typeof step['name'] === 'string' ? [step['name']] : []),
                ...nestedStepNames(step),
              ]
            : []
        )
      : []
  )

/**
 * One issue per step name used more than once among the steps nested in a
 * reusable action template (`app.actions[].action`), at any depth: a
 * `{{<step>.…}}` inside the body could read either step. The template's own
 * name is the caller's step name at run time, so only its nested steps count.
 * Each issue names the template and sits at `at`.
 */
export const findDuplicateNestedStepNames = (
  templateName: string,
  action: unknown,
  at: readonly (string | number)[]
): readonly ReservedStepNameIssue[] => {
  if (!isRecord(action)) return []
  const names = nestedStepNames(action)
  const repeated = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))]
  return repeated.map((name) => ({
    path: [...at],
    issue: `Action template '${templateName}' has duplicate step name '${name}': a \`{{${name}.…}}\` inside the template could read either step. Give each step of the template its own name.`,
  }))
}
