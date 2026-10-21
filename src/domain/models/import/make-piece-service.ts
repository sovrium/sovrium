/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The pieces the Make adapter builds a flow from: a run of steps with one
 * entry and its loose ends, joined one after the other, plus the readers every
 * Make module needs — its label, its definition as quoted, and a filter's
 * `conditions` (outer groups OR-ed, inner rules AND-ed) as one condition.
 */

import { arrayOf, isRecord } from '@/domain/kernel/config-parsing/plain-object'
import { tokeniseMakeValue } from './make-expression-service'
import type { CanonicalCondition, CanonicalFlow, CanonicalStep } from './canonical-flow'

type Json = Readonly<Record<string, unknown>>
type Edge = CanonicalFlow['edges'][number]

/** A Make module, as the adapter reads it. */
export type MakeModule = Json & { readonly id: number; readonly module: string }

/** A loose end of a piece: the step it leaves, and the branch it leaves by. */
export interface Exit {
  readonly from: string
  readonly branch?: string
}

/** A run of modules as steps: where it starts, and where it ends. */
export interface Piece {
  readonly steps: readonly CanonicalStep[]
  readonly edges: readonly Edge[]
  /** The first step, or `undefined` for a piece that holds none. */
  readonly entry: string | undefined
  readonly exits: readonly Exit[]
}

/** What reading a module needs: the trigger module's id, for its references. */
export interface MakeScope {
  readonly trigger: string | undefined
}

/** Whether a value is a module: a numeric `id` and an `app:action` name. */
export const isMakeModule = (value: unknown): value is MakeModule =>
  isRecord(value) && typeof value['id'] === 'number' && typeof value['module'] === 'string'

export const modulesOf = (value: unknown): readonly MakeModule[] =>
  arrayOf(value).filter(isMakeModule)

export const objectOf = (value: unknown): Json => (isRecord(value) ? value : {})

/** The `app` and `action` halves of `app:action`. */
export const splitModule = (name: string): { readonly app: string; readonly action: string } => {
  const colon = name.indexOf(':')
  return colon < 0
    ? { app: name, action: name }
    : { app: name.slice(0, colon), action: name.slice(colon + 1) }
}

/** The label the editor shows: a renamed module's name, else its `app:action`. */
export const labelOf = (module: MakeModule): string => {
  const { name } = objectOf(objectOf(module['metadata'])['designer'])
  return typeof name === 'string' && name.trim() !== '' ? name : module.module
}

/** The module as the report quotes it: its definition without the canvas metadata. */
export const rawOf = (module: Json): Json =>
  Object.fromEntries(Object.entries(module).filter(([key]) => key !== 'metadata'))

export const EMPTY: Piece = { steps: [], edges: [], entry: undefined, exits: [] }

export const single = (step: CanonicalStep): Piece => ({
  steps: [step],
  edges: [],
  entry: step.id,
  exits: [{ from: step.id }],
})

export const edge = (from: string, to: string, branch?: string): Edge =>
  branch === undefined ? { from, to } : { from, to, branch }

/** `first` then `second`: every loose end of the first reaches the second's entry. */
export const then = (first: Piece, second: Piece): Piece => {
  if (first.steps.length === 0 && first.exits.length === 0) return second
  const { entry } = second
  if (entry === undefined) return { ...first, exits: [...first.exits, ...second.exits] }
  return {
    steps: [...first.steps, ...second.steps],
    edges: [
      ...first.edges,
      ...first.exits.map((exit) => edge(exit.from, entry, exit.branch)),
      ...second.edges,
    ],
    entry: first.entry,
    exits: second.exits,
  }
}

export const unknownStep = (
  id: string,
  name: string,
  sourceType: string,
  raw: unknown
): CanonicalStep => ({ id, name, kind: 'unknown', sourceType, raw })

type Rule = CanonicalCondition['rules'][number]

const ruleOf = (rule: Json, scope: MakeScope): Rule => ({
  left: tokeniseMakeValue(rule['a'], scope.trigger),
  operator: String(rule['o'] ?? ''),
  ...(rule['b'] === undefined ? {} : { right: tokeniseMakeValue(rule['b'], scope.trigger) }),
})

/**
 * A filter's `conditions` (OR of AND groups) as one condition: `undefined`
 * when it tests nothing, `'mixed'` when no single combinator says it.
 */
export const conditionOf = (
  conditions: unknown,
  scope: MakeScope
): CanonicalCondition | 'mixed' | undefined => {
  const groups = arrayOf(conditions)
    .map((group) => arrayOf(group).filter(isRecord))
    .filter((group) => group.length > 0)
  if (groups.length === 0) return undefined
  if (groups.length === 1) {
    return { combinator: 'and', rules: (groups[0] ?? []).map((rule) => ruleOf(rule, scope)) }
  }
  return groups.every((group) => group.length === 1)
    ? { combinator: 'or', rules: groups.flatMap((group) => group.map((r) => ruleOf(r, scope))) }
    : 'mixed'
}
