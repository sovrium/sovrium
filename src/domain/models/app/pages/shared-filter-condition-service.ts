/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { toRecordsApiOperator } from './data-filter-api-service'

/**
 * How the conditions a `publishes` declaration contributes travel on the
 * shared-filter channel, and how a subscriber reads them back.
 *
 * ─── ONE BAG, TWO KINDS OF KEY ─────────────────────────────────────────────
 *
 * A channel carries a bag of string values keyed by what each publisher
 * contributes. A PARAM publisher contributes a request param under its own
 * name (`status`, `q`, `from`). A CONDITION publisher contributes one filter
 * condition, under a key that spells the condition: `@<operator>:<field>`. The
 * `@` cannot start a param name an author writes, so the two never collide, and
 * every subscriber folds the condition keys into its `filter` with AND
 * ({@link conditionsInBag}). One key per publisher means one condition per
 * publisher: a sibling's condition, or a filter bar's expression under
 * `filter`, is never overwritten. An empty value withdraws the condition.
 *
 * Keeping a condition a plain string in the bag is what lets every existing
 * channel mechanism — the merge, the late-join capture, the query key — carry
 * it unchanged.
 *
 * Kept apart from `shared-filter-wire-service` (the publisher's half) so a
 * subscriber's bundle carries only the reading side.
 */

/** The prefix that marks a bag key as a condition rather than a request param. */
const CONDITION_KEY_PREFIX = '@'

/** The bag key a condition `field operator <value>` travels under. */
export const conditionKey = (operator: string, field: string): string =>
  `${CONDITION_KEY_PREFIX}${operator}:${field}`

/** One condition in the records API's vocabulary. */
export interface ApiCondition {
  readonly field: string
  readonly operator: string
  readonly value: string | readonly string[]
}

/** The value a condition compares with, read from its string on the channel. */
const conditionValue = (operator: string, value: string): string | readonly string[] =>
  operator === 'in' || operator === 'between' ? value.split(',') : value

/**
 * The condition a bag entry spells in the PAGE vocabulary (`eq`, `in`, …), or
 * `undefined` for a param, a withdrawn condition or an operator the page
 * vocabulary does not hold.
 */
const pageConditionOf = (key: string, value: string): ApiCondition | undefined => {
  if (!key.startsWith(CONDITION_KEY_PREFIX) || value === '') return undefined
  const separator = key.indexOf(':')
  const operator = key.slice(CONDITION_KEY_PREFIX.length, separator)
  const field = key.slice(separator + 1)
  const known = separator > 0 && field !== '' && toRecordsApiOperator(operator) !== undefined
  return known ? { field, operator, value: conditionValue(operator, value) } : undefined
}

/** The condition a bag entry spells, or `undefined` for a param or a withdrawn condition. */
const conditionOf = (key: string, value: string): ApiCondition | undefined => {
  const condition = pageConditionOf(key, value)
  const apiOperator = condition && toRecordsApiOperator(condition.operator)
  return condition === undefined || apiOperator === undefined
    ? undefined
    : { ...condition, operator: apiOperator }
}

/**
 * The conditions a channel bag carries, in the page vocabulary the publisher
 * wrote — what a subscriber that narrows its OWN rows reads, rather than the
 * records API's spelling a request carries. Withdrawn and malformed keys yield
 * nothing, as in {@link conditionsInBag}.
 */
export const pageConditionsInBag = (
  bag: Readonly<Record<string, string>>
): readonly ApiCondition[] =>
  Object.entries(bag).flatMap(([key, value]) => {
    const condition = pageConditionOf(key, value)
    return condition === undefined ? [] : [condition]
  })

/**
 * Split a channel bag into the conditions its publishers contribute and the
 * request params left over. A withdrawn condition (an empty value) yields
 * nothing; a malformed condition key is dropped rather than sent as a param.
 */
export const conditionsInBag = (
  bag: Readonly<Record<string, string>>
): {
  readonly conditions: readonly ApiCondition[]
  readonly params: Readonly<Record<string, string>>
} => {
  const entries = Object.entries(bag)
  return {
    conditions: entries.flatMap(([key, value]) => {
      const condition = conditionOf(key, value)
      return condition === undefined ? [] : [condition]
    }),
    params: Object.fromEntries(entries.filter(([key]) => !key.startsWith(CONDITION_KEY_PREFIX))),
  }
}

/** Whether a bag key is a condition rather than a request param. */
export const isConditionKey = (key: string): boolean => key.startsWith(CONDITION_KEY_PREFIX)
