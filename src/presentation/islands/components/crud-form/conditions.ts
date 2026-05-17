/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { ConditionRule, FieldDef } from './fields'

/**
 * Pure condition evaluation helpers shared by the island's submit gate and
 * the layout components (FormFields / FormBody) that render conditionally
 * visible/required/disabled fields.
 *
 * Kept side-effect-free so both server-side guard logic and client-side
 * render logic can reuse the same predicates.
 */

function evaluateSimpleCondition(
  operator: string,
  fieldValue: string,
  value: string | number | boolean | undefined
): boolean {
  const expected = String(value ?? '')
  switch (operator) {
    case 'eq':
      return fieldValue === expected
    case 'neq':
      return fieldValue !== expected
    case 'contains':
      return fieldValue.includes(expected)
    case 'empty':
      return fieldValue === ''
    case 'notEmpty':
      return fieldValue !== ''
    default:
      return false
  }
}

export function evaluateCondition(
  condition: ConditionRule,
  values: Record<string, string>
): boolean {
  if ('or' in condition) return condition.or.some((c) => evaluateCondition(c, values))
  if ('and' in condition) return condition.and.every((c) => evaluateCondition(c, values))
  return evaluateSimpleCondition(condition.operator, values[condition.field] ?? '', condition.value)
}

export function isFieldVisible(field: FieldDef, values: Record<string, string>): boolean {
  return !field.visibleWhen || evaluateCondition(field.visibleWhen, values)
}
