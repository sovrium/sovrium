/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Subscription-filter evaluation — the Wave-3 server-side filtering of the
 * realtime change-event stream.
 *
 * A subscriber may pass an optional `?filter=field:operator:value` handshake
 * parameter. This module parses that opaque expression and decides, per change
 * event, whether the event reaches that subscriber.
 *
 * Filtering rules:
 *  - `insert` — delivered only if the new record matches the filter.
 *  - `update` — delivered if the record matches the filter EITHER before OR
 *    after the change, so a row entering or exiting the filtered set is seen.
 *  - `delete` — always delivered; delete events bypass the filter so a
 *    filtered view can drop a removed row regardless of its field values.
 */

/** A single parsed subscription filter condition. */
export interface SubscriptionFilter {
  readonly field: string
  readonly operator: string
  readonly value: string
}

/**
 * Parse a `field:operator:value` filter expression.
 *
 * Returns `undefined` for an absent or malformed expression — an unparseable
 * filter degrades to "no filter" (every event delivered) rather than silently
 * dropping the whole stream.
 *
 * Two forms are accepted for backwards compatibility with the spec corpus:
 *  - `status:eq:active`     — explicit operator
 *  - `status:active`        — implicit `eq` operator
 */
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

/**
 * Per-operator comparators. The records-API and the data-source schema use
 * two operator vocabularies (`eq`/`equals`, `gt`/`greaterThan`, ...); both
 * spellings are registered so a `?filter=` expression in either form works.
 */
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

/**
 * Evaluate a single `actual <operator> expected` comparison. An unknown
 * operator is treated as a pass-through (`true`) so a malformed handshake
 * never silently drops the whole change-event stream.
 */
const evaluateCondition = (actual: unknown, operator: string, expected: string): boolean => {
  const actualStr = actual === null || actual === undefined ? '' : String(actual)
  const comparator = COMPARATORS[operator]
  return comparator ? comparator(actualStr, expected) : true
}

/** Read a record-payload field value out of the `{ id, fields }` envelope. */
const recordFieldValue = (payload: unknown, field: string): unknown => {
  if (payload === null || typeof payload !== 'object') return undefined
  const { fields } = payload as { fields?: Record<string, unknown> }
  if (fields === undefined) return undefined
  return fields[field]
}

/** Whether a single record payload satisfies the filter condition. */
const payloadMatches = (payload: unknown, filter: SubscriptionFilter): boolean =>
  evaluateCondition(recordFieldValue(payload, filter.field), filter.operator, filter.value)

/**
 * Decide whether a change event reaches a subscriber with the given filter.
 *
 * An undefined filter means the subscription is unscoped — every event passes.
 */
export const changeEventMatchesFilter = (
  event: Record<string, unknown>,
  filter: SubscriptionFilter | undefined
): boolean => {
  if (!filter) return true
  const kind = event['event']

  // Delete events bypass the filter entirely: a filtered
  // view must still drop a row that was removed.
  if (kind === 'delete') return true

  // Insert: deliver only when the new record matches.
  if (kind === 'insert') {
    return payloadMatches(event['record'], filter)
  }

  // Update: deliver when the row matches before OR after the change so a
  // filter enter/exit transition is observable.
  if (kind === 'update') {
    return payloadMatches(event['record'], filter) || payloadMatches(event['oldRecord'], filter)
  }

  // Unknown event kind — do not drop it.
  return true
}
