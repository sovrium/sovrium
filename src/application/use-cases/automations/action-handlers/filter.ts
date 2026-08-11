/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { COMPARATORS } from '../record-trigger-filters'
import type { ActionHandler, ActionOutcome } from './shared'

/**
 * `filter/continue` handler — evaluate a `ConditionGroup` against the
 * current step context (templates already resolved by the run loop)
 * and either continue the automation or halt subsequent steps.
 *
 * Spec: [internal ref] + REGRESSION.
 * The group combinator is read from the `logic` key ('and' | 'or'); -003/-004
 * pin the `logic: 'or'` semantics (passes on any single match).
 *
 * Templates inside the condition's `field` references (e.g.
 * `{{trigger.data.plan}}`) are resolved by `resolveTriggerInValue` in
 * `run-automation.ts` BEFORE this handler is invoked — so by the time
 * we evaluate, both `field` and `value` are concrete primitives.
 *
 * On false condition with `onFalse: 'stop'`, we return
 * `status: 'filtered'`. The run loop in `run-automation.ts` honours
 * this by short-circuiting the remaining actions (see RunAccumulator
 * `halted` flag). For onFalse: 'continue', we fall through to success
 * even when the condition is false — useful for "log-but-don't-halt"
 * filters that future specs may demand. Default is 'stop'.
 *
 * Reuses the shared COMPARATORS table from record-trigger-filters so
 * filter actions and record-trigger predicates use identical operator
 * semantics. All 15 ConditionGroup operators are wired (audit HIGH-2,
 * commit 856509f8d).
 */
const evaluateCondition = (cond: Readonly<Record<string, unknown>>): boolean => {
  const operator = String(cond['operator'] ?? '')
  const compare = COMPARATORS[operator]
  if (compare === undefined) return false
  return compare(cond['field'], cond['value'])
}

const evaluateGroup = (group: Readonly<Record<string, unknown>>): boolean => {
  const conditions = (group['conditions'] as readonly Readonly<Record<string, unknown>>[]) ?? []
  if (conditions.length === 0) return true
  // The ConditionGroup schema (src/domain/models/app/automations/conditions.ts)
  // exposes the AND/OR combinator under the `logic` key, NOT `operator`
  // (`operator` is the per-CONDITION comparator: eq/in/…). Reading `operator`
  // here silently ignored declared `logic: 'or'` groups and always evaluated
  // them as AND. Default to 'and' when absent.
  const groupLogic = String(group['logic'] ?? 'and').toLowerCase()
  if (groupLogic === 'or') return conditions.some(evaluateCondition)
  return conditions.every(evaluateCondition)
}

export const handleFilterContinue: ActionHandler = (action, _app, _automation) => {
  const props = (action['props'] ?? {}) as Readonly<Record<string, unknown>>
  const condition = (props['condition'] ?? {}) as Readonly<Record<string, unknown>>
  const onFalse = String(props['onFalse'] ?? 'stop')

  const passed = evaluateGroup(condition)

  if (passed) return Effect.succeed({ status: 'success' } as const satisfies ActionOutcome)

  if (onFalse === 'stop') {
    return Effect.succeed({ status: 'filtered' } as const satisfies ActionOutcome)
  }

  // onFalse: 'continue' — log the false outcome but don't halt.
  return Effect.succeed({ status: 'success' } as const satisfies ActionOutcome)
}
