/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a drawing changed INSIDE a template placement, read against the
 * template's own definition: the one kind of edit inside a template the page
 * import carries is a drawn value that is exactly one text input of the
 * placement.
 *
 * A placement's inside reaches the merge as a digest a tool parser computes
 * (the Figma layers under the instance, the elements under a canvas board's
 * placement), only ever compared with the digest of an unedited export
 * (`page-merge-digest-service.ts`). When both read as the same document but
 * for some strings, each changed string is looked up: the template draws an input `X` as a whole value somewhere
 * (`className: '$bodyClass'`, `content: '$heading'`), `X` is a text input, and
 * the placement passes it exactly the unedited string. Then the edit is the
 * placement's own `vars.X`, and nothing else of the template is touched. Any
 * other change — a value combining an input with other text, a structured
 * input, a node added or gone, a string no input explains — is not, and the
 * caller refuses it by name.
 *
 * Pure: the same digests, placement and template always give the same answer.
 */

import { digestChanges, type StringChange } from './page-merge-digest-service'

type Node = Readonly<Record<string, unknown>>

/** One placement variable an inside edit rewrites. */
export interface InsideVariableEdit {
  readonly name: string
  readonly before: string
  readonly after: string
}

const isObject = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every string a template definition holds, but its own name and input declarations. */
const stringsOf = (value: unknown): readonly string[] => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(stringsOf)
  if (!isObject(value)) return []
  return Object.entries(value).flatMap(([key, child]) =>
    key === 'inputs' || key === 'name' ? [] : stringsOf(child)
  )
}

/**
 * The inputs a template draws as a whole value, each a text input: declared
 * with no kind or as `text`, or not declared at all on a template that
 * declares no inputs.
 */
const wholeTextInputsOf = (template: Node): ReadonlySet<string> => {
  const declared = isObject(template['inputs']) ? template['inputs'] : undefined
  const isText = (name: string): boolean => {
    if (declared === undefined) return true
    const input = declared[name]
    if (!isObject(input)) return false
    return input['kind'] === undefined || input['kind'] === 'text'
  }
  return new Set(
    stringsOf(template).flatMap((text) => {
      const match = /^\$([A-Za-z_][\w-]*)$/.exec(text)
      const name = match?.[1]
      return name !== undefined && isText(name) ? [name] : []
    })
  )
}

/** The one input a changed string is the value of, or `undefined` when none or several are. */
const inputOf = (
  change: StringChange,
  inputs: ReadonlySet<string>,
  vars: Node
): string | undefined => {
  const candidates = [...inputs].filter((name) => vars[name] === change.before)
  const [only] = candidates
  return candidates.length === 1 ? only : undefined
}

/**
 * The variables an edit inside a template placement rewrites, or `undefined`
 * when the edit is anything else.
 *
 * @param digests - what the placement draws inside, unedited and as drawn.
 * @param placement - the placement, as the config writes it.
 * @param template - the template's definition, when the config declares it.
 */
export const insideVariableEdits = (
  digests: { readonly baseline: string | undefined; readonly drawn: string | undefined },
  placement: Node,
  template: Node | undefined
): readonly InsideVariableEdit[] | undefined => {
  const changes = digestChanges(digests)
  if (changes === undefined) return undefined
  if (changes.length === 0) return []
  if (template === undefined) return undefined
  const inputs = wholeTextInputsOf(template)
  const vars = isObject(placement['vars']) ? placement['vars'] : {}
  const edits = changes.map((change) => {
    const name = inputOf(change, inputs, vars)
    return name === undefined ? undefined : { name, ...change }
  })
  if (edits.some((edit) => edit === undefined)) return undefined
  const resolved = edits.flatMap((edit) => (edit === undefined ? [] : [edit]))
  const byName = Map.groupBy(resolved, (edit) => edit.name)
  // One input drawn twice must be drawn the same way twice.
  if ([...byName.values()].some((group) => new Set(group.map((edit) => edit.after)).size > 1)) {
    return undefined
  }
  return [...byName.values()].flatMap((group) => group.slice(0, 1))
}
