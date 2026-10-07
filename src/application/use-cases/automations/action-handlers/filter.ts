/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { evaluateGroup } from '@/domain/models/app/automations/condition-eval'
import { authoredActionProps, resolveOwnProp } from './run-context-resolution'
import type { ActionHandler, ActionOutcome, ActionRunContext } from './shared'

/**
 * `filter/continue` handler — evaluate a `ConditionGroup` against the
 * current step context (templates already resolved by the run loop)
 * and either continue the automation or halt subsequent steps.
 *
 * Spec: an automation action filter continue spec + REGRESSION.
 * The group combinator is read from the `logic` key ('and' | 'or'); -003/-004
 * pin the `logic: 'or'` semantics (passes on any single match).
 *
 * The condition is resolved from the RAW action against the run context, as
 * `path/branch` does: the run loop's pre-resolved props stringify a list or an
 * object (`{{step.records}}` would arrive as text), and emptiness must be
 * judged on the value itself. Without a run context (a direct dispatch) the
 * pre-resolved props are all there is.
 *
 * On false condition with `onFalse: 'stop'`, we return
 * `status: 'filtered'`. The run loop in `run-automation.ts` honours
 * this by short-circuiting the remaining actions (see RunAccumulator
 * `halted` flag). For onFalse: 'continue', we fall through to success
 * even when the condition is false — useful for "log-but-don't-halt"
 * filters that future specs may demand. Default is 'stop'.
 *
 * Group evaluation lives in `@/domain/services/automations/condition-eval`,
 * shared with `path/branch` so the two actions that branch on a ConditionGroup
 * cannot drift on `logic: 'or'` or on comparator semantics. All 15
 * ConditionGroup operators are wired via the shared COMPARATORS table
 * (audit HIGH-2, commit 856509f8d).
 */

/** The condition group, resolved against the run context when there is one. */
const resolvedCondition = (
  props: Readonly<Record<string, unknown>>,
  runContext: ActionRunContext | undefined
): Readonly<Record<string, unknown>> => {
  if (runContext === undefined) {
    return (props['condition'] ?? {}) as Readonly<Record<string, unknown>>
  }
  const raw = authoredActionProps(runContext)['condition'] ?? props['condition'] ?? {}
  return resolveOwnProp(runContext, raw) as Readonly<Record<string, unknown>>
}

export const handleFilterContinue: ActionHandler = (action, _app, _automation, runContext) => {
  const props = (action['props'] ?? {}) as Readonly<Record<string, unknown>>
  const condition = resolvedCondition(props, runContext)
  const onFalse = String(props['onFalse'] ?? 'stop')

  const passed = evaluateGroup(condition)

  // A false condition halts only when `onFalse` says `stop`; `continue` reports
  // the same success a passing condition does, so the two share one outcome.
  const status = passed || onFalse !== 'stop' ? 'success' : 'filtered'

  return Effect.succeed({ status } as const satisfies ActionOutcome).pipe(
    Effect.withSpan('automations.handle-filter-continue')
  )
}
