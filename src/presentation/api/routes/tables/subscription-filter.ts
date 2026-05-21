/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


export interface SubscriptionFilter {
  readonly field: string
  readonly operator: string
  readonly value: string
}

export const parseSubscriptionFilter = (
  expr: string | undefined
): SubscriptionFilter | undefined => {
  if (expr === undefined || expr.trim() === '') return undefined
  const parts = expr.split(':')
  if (parts.length === 3) {
    const [field, operator, value] = parts
    if (!field || !operator) return undefined
    return { field, operator, value: value ?? '' }
  }
  if (parts.length === 2) {
    const [field, value] = parts
    if (!field) return undefined
    return { field, operator: 'eq', value: value ?? '' }
  }
  return undefined
}

const COMPARATORS: Readonly<Record<string, (a: string, b: string) => boolean>> = {
  eq: (a, b) => a === b,
  equals: (a, b) => a === b,
  neq: (a, b) => a !== b,
  notEquals: (a, b) => a !== b,
  contains: (a, b) => a.includes(b),
  gt: (a, b) => Number(a) > Number(b),
  greaterThan: (a, b) => Number(a) > Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  greaterThanOrEqual: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lessThan: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),
  lessThanOrEqual: (a, b) => Number(a) <= Number(b),
}

const evaluateCondition = (actual: unknown, operator: string, expected: string): boolean => {
  const actualStr = actual === null || actual === undefined ? '' : String(actual)
  const comparator = COMPARATORS[operator]
  return comparator ? comparator(actualStr, expected) : true
}

const recordFieldValue = (payload: unknown, field: string): unknown => {
  if (payload === null || typeof payload !== 'object') return undefined
  const { fields } = payload as { fields?: Record<string, unknown> }
  if (fields === undefined) return undefined
  return fields[field]
}

const payloadMatches = (payload: unknown, filter: SubscriptionFilter): boolean =>
  evaluateCondition(recordFieldValue(payload, filter.field), filter.operator, filter.value)

export const changeEventMatchesFilter = (
  event: Record<string, unknown>,
  filter: SubscriptionFilter | undefined
): boolean => {
  if (!filter) return true
  const kind = event['event']

  if (kind === 'delete') return true

  if (kind === 'insert') {
    return payloadMatches(event['record'], filter)
  }

  if (kind === 'update') {
    return payloadMatches(event['record'], filter) || payloadMatches(event['oldRecord'], filter)
  }

  return true
}
