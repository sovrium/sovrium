/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Which branches of a page one board draws, and how its nodes are drawn there
 * (`design-system-page-projection.ts`).
 *
 * A board is drawn at one state: each query at a value (its default, unless
 * the board asks for another), a role, the record a routed page draws, and,
 * when asked, empty or loading data and a phone width. A node whose
 * `visibility` names a query, a role or a record field is drawn on a board
 * only when that state satisfies it, so the default board shows the branch a
 * reader meets first and a state board shows its own. A rule on anything else
 * (a capability, the session) is drawn, as before. Every branch stays a node
 * of the design tree and of the node map, drawn or not.
 */

import {
  matchesConditionOperators,
  satisfiesFieldCondition,
} from '@/domain/models/app/tables/condition-operators'
import type { FieldCondition } from '@/domain/models/app/tables/condition-operators'

type Node = Readonly<Record<string, unknown>>

/** The state one board is drawn at, as far as which nodes it draws. */
export interface BoardBranches {
  /** Each query parameter's value on the board. */
  readonly query: Readonly<Record<string, string>>
  /** The role the board is drawn for. */
  readonly role: string
  /** The record a routed page is drawn at; absent, a record rule is not judged. */
  readonly record?: Readonly<Record<string, unknown>> | undefined
  /** `loading`: every island drawn as its skeleton. */
  readonly data?: 'empty' | 'loading' | undefined
  /** A board narrower than a tablet: a sidebar folds behind its menu button. */
  readonly narrow?: boolean | undefined
}

/** Whether a node's `visibility` lets this board draw it. */
export const isDrawnOnBoard = (branches: BoardBranches, node: Node): boolean => {
  const visibility = node['visibility'] as
    | {
        readonly roles?: readonly string[]
        readonly query?: { readonly name: string } & Readonly<Record<string, unknown>>
        readonly record?: FieldCondition
      }
    | undefined
  if (visibility === undefined) return true
  const { roles, query, record } = visibility
  if (Array.isArray(roles) && !roles.includes(branches.role)) return false
  if (query !== undefined) {
    const { name, ...operators } = query
    if (!matchesConditionOperators(operators, branches.query[name])) return false
  }
  return record === undefined || branches.record === undefined
    ? true
    : satisfiesFieldCondition(record, branches.record)
}

/** The breakpoint below which a phone board folds a sidebar into its menu button. */
const FOLD_BELOW = 'md'

/**
 * A node as this board draws it: an island as its skeleton on a loading
 * board, a sidebar folded behind its menu button on a narrow one (unless it
 * folds already), any other as written.
 */
export const drawnOnBoard = (branches: BoardBranches | undefined, node: Node): Node => {
  if (branches?.data === 'loading' && node['dataSource'] !== undefined) {
    return { type: 'skeleton', skeletonVariant: 'rectangular' }
  }
  if (branches?.narrow === true && node['type'] === 'sidebar' && node['drawer'] === undefined) {
    return { ...node, drawer: { below: FOLD_BELOW } }
  }
  return node
}
