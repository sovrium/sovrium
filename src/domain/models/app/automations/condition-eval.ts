/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { COMPARATORS } from './comparison-operators'

/**
 * `ConditionGroup` evaluation, shared by every action that branches on one.
 *
 * Two handlers evaluate the same schema type — `filter/continue` (halt or
 * proceed) and `path/branch` (which branch to take) — and an author reasonably
 * expects `logic: 'or'` and `operator: 'notEquals'` to mean the same thing in
 * both. Two copies is how they come to disagree; this module is the one
 * definition.
 *
 * Comparator semantics come from the shared {@link COMPARATORS} table, so
 * filter actions, path conditions and record-trigger predicates all use
 * identical operator behaviour (audit HIGH-2).
 *
 * It lives in the DOMAIN layer because it is pure: plain values in, boolean
 * out, no I/O and no template engine. Templates inside a condition
 * (`field: '{{trigger.data.plan}}'`) must therefore be resolved by the
 * APPLICATION-layer caller BEFORE calling in — `filter/continue` gets that from
 * the run loop's global props pass, and `path/branch` re-resolves its own
 * conditions because it reads the raw pre-substitution action (see `path.ts`).
 * That split is the reason this module could move down a layer at all.
 */

export const evaluateCondition = (cond: Readonly<Record<string, unknown>>): boolean => {
  const operator = String(cond['operator'] ?? '')
  const compare = COMPARATORS[operator]
  if (compare === undefined) return false
  return compare(cond['field'], cond['value'])
}

/**
 * Evaluate a condition group. An EMPTY group passes — `path/branch` relies on
 * that for its condition-less fallback branch.
 *
 * The AND/OR combinator lives under the `logic` key, NOT `operator`
 * (`operator` is the per-CONDITION comparator: eq/in/…). Reading `operator`
 * here silently ignored declared `logic: 'or'` groups and evaluated them as
 * AND. Defaults to 'and' when absent.
 */
export const evaluateGroup = (group: Readonly<Record<string, unknown>>): boolean => {
  const conditions = (group['conditions'] as readonly Readonly<Record<string, unknown>>[]) ?? []
  if (conditions.length === 0) return true
  const groupLogic = String(group['logic'] ?? 'and').toLowerCase()
  if (groupLogic === 'or') return conditions.some(evaluateCondition)
  return conditions.every(evaluateCondition)
}
