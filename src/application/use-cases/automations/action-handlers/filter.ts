/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import { COMPARATORS } from '../record-trigger-filters'
import type { ActionHandler, ActionOutcome } from './shared'

const evaluateCondition = (cond: Readonly<Record<string, unknown>>): boolean => {
  const operator = String(cond['operator'] ?? '')
  const compare = COMPARATORS[operator]
  if (compare === undefined) return false
  return compare(cond['field'], cond['value'])
}

const evaluateGroup = (group: Readonly<Record<string, unknown>>): boolean => {
  const conditions = (group['conditions'] as readonly Readonly<Record<string, unknown>>[]) ?? []
  if (conditions.length === 0) return true
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

  return Effect.succeed({ status: 'success' } as const satisfies ActionOutcome)
}
