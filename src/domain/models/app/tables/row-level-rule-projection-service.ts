/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A table's row-level rule for one operation, projected to a filter a query
 * can AND onto its own WHERE clause.
 *
 * The in-memory decision (`row-level-write-decision-service`) judges ONE row
 * the caller already holds. A list, an export or a batch never holds the rows
 * first: it asks the database for the rows the rule admits. This module turns
 * the rule into that question, with the same answers the in-memory check
 * gives — an unrestricted caller is not scoped, a rule that cannot be resolved
 * admits nothing.
 */

import {
  isPredicateGroup,
  projectPredicateToFilter,
  projectWhenToFilter,
  type CurrentUserContext,
  type RowLevelFilterNode,
  type RowLevelLeafClause,
} from './row-level-evaluator-service'
import { rowLevelRuleFor, type RowLevelOperation } from './row-level-write-decision-service'
import type { RowLevelPermissions } from './permissions'

/**
 * A rule projected for one operation:
 *
 *  - `'bypass'` — the caller is unrestricted (no row scoping applies);
 *  - `'no-rlp'` — the table declares no rule for the operation;
 *  - `'empty'` — a single triple whose `in` list is empty: it matches nothing,
 *    so the caller skips the query (some drivers reject `IN ()` outright);
 *  - `undefined` — a single triple that could not be projected (an unknown
 *    operator, an unresolved reference): the caller admits no row;
 *  - a leaf clause, or an `and`/`or` tree for a composite rule.
 */
export type RowRuleClause =
  'bypass' | 'no-rlp' | 'empty' | undefined | RowLevelLeafClause | RowLevelFilterNode

/**
 * Project the table's rule for `op` against the caller.
 *
 * A composite group projects to a nested AND/OR tree in which an empty `in`
 * is scoped to its own branch (rendered `IN (NULL)` by the SQL layer), so the
 * whole-rule `'empty'` answer applies to a single triple only.
 */
export const projectRowRule = (
  rlp: RowLevelPermissions | undefined,
  op: RowLevelOperation,
  ctx: CurrentUserContext
): RowRuleClause => {
  const predicate = rowLevelRuleFor(rlp, op)
  if (!predicate) return 'no-rlp'
  if (ctx.isUnrestricted) return 'bypass'
  if (isPredicateGroup(predicate)) return projectWhenToFilter(predicate, ctx) ?? undefined
  const projected = projectPredicateToFilter(predicate, ctx)
  if (!projected) return undefined
  if (
    projected.operator === 'in' &&
    Array.isArray(projected.value) &&
    projected.value.length === 0
  ) {
    return 'empty'
  }
  return projected
}

/** Whether a projected rule is a filter to apply (not one of the sentinels). */
const isFilterClause = (clause: RowRuleClause): clause is RowLevelFilterNode =>
  clause !== 'no-rlp' && clause !== 'bypass' && clause !== 'empty' && clause !== undefined

/** The filter a batch asks the database for: its ids, inside every rule that applies. */
export type RowRuleBatchFilter = 'empty' | { readonly and: readonly RowLevelFilterNode[] }

/**
 * The rows of `ids` an update or delete may reach, as one filter: `id IN (ids)`
 * AND the read rule AND the operation's own rule.
 *
 * `'empty'` when either rule admits nothing (an empty `in`, or a rule that
 * could not be projected): the caller answers without querying. A rule that
 * does not apply (`'no-rlp'`, `'bypass'`) adds no clause.
 */
export const rowRuleBatchFilter = (
  ids: readonly string[],
  rlp: RowLevelPermissions,
  ctx: CurrentUserContext,
  op: 'write' | 'delete'
): RowRuleBatchFilter => {
  const readClause = projectRowRule(rlp, 'read', ctx)
  const mutationClause = projectRowRule(rlp, op, ctx)
  if (readClause === 'empty' || readClause === undefined) return 'empty'
  if (mutationClause === 'empty' || mutationClause === undefined) return 'empty'
  const idClause: RowLevelLeafClause = { field: 'id', operator: 'in', value: ids }
  return { and: [idClause, ...[readClause, mutationClause].filter(isFilterClause)] }
}
