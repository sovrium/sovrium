/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ViewFilterCondition, ViewFilterNode } from '@/domain/models/app/tables/views/filters'

/**
 * The one walker over a filter tree — a single condition or an `and` / `or`
 * group nested as deep as needed — shared by every path that compiles one into
 * a SQL boolean expression (a table view, and the `filters` of a `rollup`,
 * `count` or `lookup` field). Each path brings its own condition compiler;
 * only the walk is shared.
 *
 * A node is a GROUP if and only if it has `and` or `or`. Everything else is a
 * condition, with or without a `value`: `isEmpty` and `isNotEmpty` carry none,
 * and a walker that recognised a condition by its `value` silently dropped
 * them (a view filtered by `isEmpty` alone showed every row).
 *
 * A group joins its children with ` AND ` / ` OR `. Empty children drop out
 * rather than leaving a dangling joiner; a group of one is that one child; a
 * tree with no condition at all compiles to `undefined`, which the caller
 * leaves out of its WHERE.
 *
 * PARENTHESES ARE THE POINT, not cosmetics: `a AND (b OR c)` and `a AND b OR
 * c` select different rows, because SQL binds AND tighter than OR. So a group
 * nested inside a group is always parenthesised. Two layouts exist, chosen by
 * `wrapGroups`:
 *
 * - default — the TOP-LEVEL group stays bare (`a AND (b OR c)`). One outer
 *   group cannot change precedence, and leaving it bare keeps the SQL of every
 *   view that already filtered correctly byte-identical.
 * - `wrapGroups: true` — every child is parenthesised and every group,
 *   including the top one, is wrapped (`((a) AND (b))`), for a fragment that
 *   is spliced next to other predicates.
 *
 * A condition compiler must return a self-contained expression; the operators
 * that expand to an `OR` (`isEmpty`) already parenthesise themselves. It may
 * return `undefined` for a condition that restricts nothing, which drops out
 * like an empty group.
 */
export const compileFilterTree = (
  node: ViewFilterNode,
  compileLeaf: (condition: ViewFilterCondition) => string | undefined,
  options?: { readonly wrapGroups?: boolean }
): string | undefined => {
  const wrapGroups = options?.wrapGroups ?? false

  const compileNode = (current: ViewFilterNode, nested: boolean): string | undefined => {
    if (!('and' in current) && !('or' in current)) return compileLeaf(current)

    const [children, joiner] = 'and' in current ? [current.and, ' AND '] : [current.or, ' OR ']
    const parts = children
      .map((child) => compileNode(child, true))
      .filter((part): part is string => part !== undefined && part !== '')

    if (parts.length <= 1) return parts[0]
    if (wrapGroups) return `(${parts.map((part) => `(${part})`).join(joiner)})`

    const body = parts.join(joiner)
    return nested ? `(${body})` : body
  }

  return compileNode(node, false)
}

/**
 * The operators that compare against nothing: a condition using one is whole
 * without a `value`. Every other operator needs one, and a condition that
 * names it with no `value` has nothing to compare.
 */
const VALUELESS_OPERATORS: ReadonlySet<string> = new Set([
  'isNull',
  'isNotNull',
  'isEmpty',
  'isNotEmpty',
  'isTrue',
  'isFalse',
])

/** Whether a condition is complete: its operator takes no value, or it carries one. */
export const isCompleteCondition = (condition: {
  readonly operator: string
  readonly value?: unknown
}): boolean => VALUELESS_OPERATORS.has(condition.operator) || condition.value !== undefined
