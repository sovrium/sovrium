/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/** A `visibility.condition` as authored: `{ field, operator, value }`. */
export interface AuthoredCondition {
  readonly field: string
  readonly operator: string
  readonly value: string | boolean
}

/**
 * The verdict a reference pass gives a condition: `true` / `false` when the
 * condition reads what that pass resolves, `undefined` when it reads anything
 * else and is left for a later pass.
 */
export type ConditionVerdict = (condition: AuthoredCondition) => boolean | undefined

/** A visibility block with its `condition` removed, or `undefined` when nothing else is left. */
const withoutCondition = (visibility: object): object | undefined => {
  const { condition: _judged, ...rest } = visibility as { readonly condition?: unknown }
  return Object.keys(rest).length === 0 ? undefined : rest
}

/**
 * `node` judged on its condition: `undefined` when it fails, the node less that
 * condition when it holds, the node as it was when the verdict has no answer.
 * The condition may sit at the root or under `props`, as everywhere else.
 */
const judgeCondition = (node: object, verdict: ConditionVerdict): object | undefined => {
  const { visibility, props } = node as {
    readonly visibility?: { readonly condition?: AuthoredCondition }
    readonly props?: { readonly visibility?: { readonly condition?: AuthoredCondition } }
  }
  const atRoot = visibility?.condition !== undefined
  const condition = atRoot ? visibility?.condition : props?.visibility?.condition
  const holds = condition === undefined ? undefined : verdict(condition)
  if (holds === undefined) return node
  if (!holds) return undefined
  if (atRoot) return { ...node, visibility: withoutCondition(visibility!) }
  return { ...node, props: { ...props, visibility: withoutCondition(props!.visibility!) } }
}

/**
 * `node` with every condition the verdict answers judged, at any depth and
 * under any key — `children`, but also a slot such as a sidebar's `header`: a
 * node whose condition fails is removed with its subtree, and one whose
 * condition holds keeps no condition for the session pass to misread (that pass
 * only knows `$user.*`). Run while the reference still names what it reads.
 * A tree holding no condition the verdict answers is returned by reference.
 */
export const judgeConditionsDeep = (node: unknown, verdict: ConditionVerdict): unknown => {
  if (Array.isArray(node)) {
    const judged = node.flatMap((child) => {
      const one = judgeConditionsDeep(child, verdict)
      return one === undefined ? [] : [one]
    })
    return judged.length === node.length && judged.every((one, i) => one === node[i])
      ? node
      : judged
  }
  if (typeof node !== 'object' || node === null) return node
  const judged = judgeCondition(node, verdict)
  if (judged === undefined) return undefined
  const entries = Object.entries(judged)
  const walked = entries.map(([key, value]) => [key, judgeConditionsDeep(value, verdict)] as const)
  return walked.every(([, value], i) => value === entries[i]![1])
    ? judged
    : Object.fromEntries(walked)
}
