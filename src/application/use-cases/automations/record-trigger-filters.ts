/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTriggerInString } from './resolve-trigger-data'
import type { ConditionGroup } from '@/domain/models/app/automations/conditions'


const formatComparable = (value: unknown): string => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

const resolveLhs = (field: string, record: Record<string, unknown>): unknown => {
  const ctx = { record, trigger: { data: { record } } }
  const resolved = resolveTriggerInString(field, ctx)
  return resolved === field ? record[field] : resolved
}

const isDefined = (v: unknown): boolean => v !== undefined && v !== null
const isDateInput = (v: unknown): boolean => v instanceof Date || typeof v === 'string'

const compareDates = (lhs: unknown, expected: unknown): number | undefined => {
  const lhsTime = new Date(lhs as string | Date).getTime()
  const expectedTime = new Date(expected as string | Date).getTime()
  if (Number.isNaN(lhsTime) || Number.isNaN(expectedTime)) return undefined
  return lhsTime - expectedTime
}

const compareStrings = (lhs: unknown, expected: unknown): number => {
  const lhsStr = formatComparable(lhs)
  const expectedStr = formatComparable(expected)
  if (lhsStr < expectedStr) return -1
  if (lhsStr > expectedStr) return 1
  return 0
}

const compareOrdered = (lhs: unknown, expected: unknown): number | undefined => {
  if (!isDefined(lhs) || !isDefined(expected)) return undefined
  if (typeof lhs === 'number' && typeof expected === 'number') return lhs - expected
  if (isDateInput(lhs) && isDateInput(expected)) {
    const dateCmp = compareDates(lhs, expected)
    if (dateCmp !== undefined) return dateCmp
  }
  return compareStrings(lhs, expected)
}

const tryRegexTest = (lhs: unknown, pattern: unknown): boolean => {
  if (typeof pattern !== 'string') return false
  try {
    return new RegExp(pattern).test(formatComparable(lhs))
  } catch {
    return false
  }
}

export const COMPARATORS: Readonly<Record<string, (lhs: unknown, expected: unknown) => boolean>> = {
  equals: (lhs, expected) => formatComparable(lhs) === formatComparable(expected),
  notEquals: (lhs, expected) => formatComparable(lhs) !== formatComparable(expected),
  contains: (lhs, expected) => formatComparable(lhs).includes(formatComparable(expected)),
  notContains: (lhs, expected) => !formatComparable(lhs).includes(formatComparable(expected)),
  startsWith: (lhs, expected) => formatComparable(lhs).startsWith(formatComparable(expected)),
  endsWith: (lhs, expected) => formatComparable(lhs).endsWith(formatComparable(expected)),
  greaterThan: (lhs, expected) => {
    const cmp = compareOrdered(lhs, expected)
    return cmp !== undefined && cmp > 0
  },
  greaterThanOrEqual: (lhs, expected) => {
    const cmp = compareOrdered(lhs, expected)
    return cmp !== undefined && cmp >= 0
  },
  lessThan: (lhs, expected) => {
    const cmp = compareOrdered(lhs, expected)
    return cmp !== undefined && cmp < 0
  },
  lessThanOrEqual: (lhs, expected) => {
    const cmp = compareOrdered(lhs, expected)
    return cmp !== undefined && cmp <= 0
  },
  isEmpty: (lhs) => lhs === undefined || lhs === null || lhs === '',
  isNotEmpty: (lhs) => lhs !== undefined && lhs !== null && lhs !== '',
  isNull: (lhs) => lhs === null || lhs === undefined,
  isNotNull: (lhs) => lhs !== null && lhs !== undefined,
  matches: tryRegexTest,
}

const evaluateOne = (
  field: string,
  operator: string,
  expected: unknown,
  record: Record<string, unknown>
): boolean => {
  const compare = COMPARATORS[operator]
  if (compare === undefined) return false
  return compare(resolveLhs(field, record), expected)
}

export const evaluateRecordTriggerCondition = (
  group: ConditionGroup,
  record: Record<string, unknown>
): boolean => {
  const logic = group.logic ?? 'and'
  if (logic === 'or') {
    return group.conditions.some((c) => evaluateOne(c.field, c.operator, c.value, record))
  }
  return group.conditions.every((c) => evaluateOne(c.field, c.operator, c.value, record))
}
