/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Row-level READ gates for the MCP table tools: the list filter and the
 * single-record check that apply a table's `read.when` rule to the caller.
 *
 * An unrestricted context (an admin-equivalent role) skips row scoping. An
 * ABSENT context means the caller carries no identity — only the fail-closed
 * fallback caller, since every credential `/mcp` accepts names a user — and a
 * rule cannot be evaluated for nobody, so every row the rule governs is
 * denied, the way that caller is already denied every tool.
 */

import {
  evaluateRecordAgainstPredicate,
  isPredicateGroup,
  projectPredicateToFilter,
  projectWhenToFilter,
  type CurrentUserContext,
  type RowLevelFilterNode,
} from '@/domain/models/app/tables/row-level-evaluator-service'
import { readStoredValues } from '@/domain/models/app/tables/stored-value-service'
import type { Table } from '@/domain/models/app'

/**
 * Project a single-triple read predicate to a filter result. An empty `in`
 * resolves to the whole-predicate `'empty'` short-circuit (no rows). Split
 * out of `buildReadListFilter` to keep that function under the complexity cap.
 */
const projectSingleTripleReadFilter = (
  predicate: Parameters<typeof projectPredicateToFilter>[0],
  ctx: CurrentUserContext
): 'empty' | 'reject' | { readonly and: readonly RowLevelFilterNode[] } => {
  const projected = projectPredicateToFilter(predicate, ctx)
  if (!projected) return 'reject'
  const isEmptyIn =
    projected.operator === 'in' && Array.isArray(projected.value) && projected.value.length === 0
  return isEmptyIn ? 'empty' : { and: [projected] }
}

/**
 * Build the Z-3 read-side filter for list queries. Returns:
 *   - `undefined`  → no row-level predicate (or admin bypass) — list everything
 *   - `'empty'`    → match nothing: the caller has no identity, or the
 *                    predicate resolves to no rows (e.g. no user_access rows
 *                    for the scope) — caller short-circuits
 *   - `'reject'`   → predicate could not be projected — same short-circuit
 *   - `{ and }`    → AND clause to merge with the request filter
 */
export const buildReadListFilter = (
  table: Table,
  ctx: CurrentUserContext | undefined
): undefined | 'empty' | 'reject' | { readonly and: readonly RowLevelFilterNode[] } => {
  const rlp = table.rowLevelPermissions
  if (!rlp?.read?.when) return undefined
  if (ctx === undefined) return 'empty'
  if (ctx.isUnrestricted) return undefined

  // [internal ref]: a composite group projects to a nested AND/OR filter node. An
  // empty `in` inside the tree is scoped to its branch (rendered as
  // `IN (NULL)`), so no whole-predicate `'empty'` short-circuit applies.
  if (isPredicateGroup(rlp.read.when)) {
    const node = projectWhenToFilter(rlp.read.when, ctx)
    return node ? { and: [node] } : 'reject'
  }

  return projectSingleTripleReadFilter(rlp.read.when, ctx)
}

/**
 * Apply the row-level read predicate to a single fetched record. Returns
 * true when the record is in scope for the caller, false otherwise — and
 * false for a caller with no identity whenever the table declares a rule.
 */
export const recordPassesReadPredicate = (
  table: Table,
  record: Readonly<Record<string, unknown>>,
  ctx: CurrentUserContext | undefined
): boolean => {
  const predicate = table.rowLevelPermissions?.read?.when
  if (!predicate) return true
  if (ctx === undefined) return false
  if (ctx.isUnrestricted) return true
  // Judged as the records API reads the row (SQLite `1`/`0` read as booleans).
  return evaluateRecordAgainstPredicate(readStoredValues(table, record), predicate, ctx)
}
