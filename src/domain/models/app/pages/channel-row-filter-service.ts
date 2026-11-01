/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What a shared-filter channel narrows a SERVER-DRAWN list to.
 *
 * A list drawn through a `children` row template has its rows expanded on the
 * server, which owns `$record` and every per-row gate, so the channel's
 * conditions have to reach that read as page conditions (`dataSource.filter`
 * leaves, all of which hold). The bag is the one a subscriber island merges:
 * the bar's `filter` expression in the records-API vocabulary, plus any
 * `@<operator>:<field>` condition a control contributes.
 *
 * Everything here is read from the page address, so it is untrusted: a leaf
 * whose operator or value is not one a page filter can hold is refused, never
 * passed through. Which FIELDS a reader may filter on is judged later, against
 * the table and the reader's own field grants.
 *
 * The one `$` value read from the address is a relative date (`$today`,
 * `$today-15d`, `$now-1h`), resolved here against the request's {@link
 * ChannelClock}, as the records API resolves it in its `filter` parameter: a
 * token left in place would reach the database as text. Any other `$` value
 * (`$currentUser.name`) is still refused.
 */

import { filterConditionFit } from '../tables/filter-value-fit-service'
import { resolveRelativeDate } from './components/relative-date-filter'
import { fromRecordsApiOperator } from './data-filter-api-service'
import { pageConditionsInBag } from './shared-filter-condition-service'
import type { DataFilter } from './components/data-source'

/**
 * `condition`, or one matching no row when its value its field cannot hold or
 * its operator is a text one on a number (`filter-value-fit-service.ts`): the
 * list is then empty, as the active chip describes, and the database is never
 * asked a comparison it would refuse. `typeOf` gives each field's declared type.
 */
export const fittedChannelCondition = (
  condition: DataFilter,
  typeOf: (field: string) => string | undefined
): DataFilter =>
  filterConditionFit(typeOf(condition.field), condition.operator, condition.value) === 'fits'
    ? condition
    : { field: condition.field, operator: 'in', value: [] }

/** The request's UTC day (`YYYY-MM-DD`) and minute instant, which relative dates resolve against. */
export interface ChannelClock {
  readonly today: string
  readonly now: string
}

const isPlainText = (value: unknown): value is string =>
  typeof value === 'string' && !value.startsWith('$')

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** A relative-date token resolved against `clock`, any other value as it is. */
const resolvedOf = (value: unknown, clock: ChannelClock | undefined): unknown =>
  typeof value === 'string' && value.startsWith('$') && clock !== undefined
    ? (resolveRelativeDate(value, clock.today, clock.now) ?? value)
    : value

/**
 * A published value a page filter may hold: a literal, never a `$` template.
 * The expression comes from the page address, so it is untrusted, and a `$`
 * string would otherwise reach the resolver as the sugar an author writes. A
 * relative date is the exception, resolved to the day or instant it names.
 */
const literalOf = (
  published: unknown,
  clock: ChannelClock | undefined
): DataFilter['value'] | undefined => {
  const value = Array.isArray(published)
    ? published.map((item: unknown) => resolvedOf(item, clock))
    : resolvedOf(published, clock)
  if (isPlainText(value) || isFiniteNumber(value) || typeof value === 'boolean') return value
  if (Array.isArray(value) && (value.every(isPlainText) || value.every(isFiniteNumber)))
    return value as readonly string[] | readonly number[]
  return undefined
}

/** One published leaf as a page condition, or `undefined` when it is not one. */
const leafOf = (node: unknown, clock: ChannelClock | undefined): DataFilter | undefined => {
  if (typeof node !== 'object' || node === null) return undefined
  const { field, operator, value } = node as Readonly<Record<string, unknown>>
  const pageOperator = typeof operator === 'string' ? fromRecordsApiOperator(operator) : undefined
  if (typeof field !== 'string' || field === '' || pageOperator === undefined) return undefined
  if (pageOperator === 'isEmpty' || pageOperator === 'isNotEmpty')
    return { field, operator: pageOperator }
  const literal = literalOf(value, clock)
  return literal === undefined ? undefined : { field, operator: pageOperator, value: literal }
}

/**
 * An `or` group as ONE condition, when it can be one: a single leaf, or every
 * leaf `equals` on the same field, which is that field `in` their values. A
 * union across fields has no form in a list of conditions, which all hold.
 */
const groupOf = (
  nodes: readonly unknown[],
  clock: ChannelClock | undefined
): DataFilter | undefined => {
  const leaves = nodes.map((node) => leafOf(node, clock))
  if (leaves.length === 1) return leaves[0]
  const [first] = leaves
  const sameFieldEquals = leaves.every(
    (leaf) => leaf !== undefined && leaf.operator === 'eq' && leaf.field === first?.field
  )
  if (!sameFieldEquals || first === undefined) return undefined
  const values = leaves.map((leaf) => leaf?.value)
  const literal = literalOf(values, clock)
  return literal === undefined ? undefined : { field: first.field, operator: 'in', value: literal }
}

/**
 * A records-API `filter` parameter (`{"and":[…]}`, an `or` set nested once) as
 * page conditions, the inverse of {@link toRecordsApiFilterParam}: `[]` for an
 * empty parameter, `undefined` for one that conditions which must all hold
 * cannot say (a union across fields) or that is not an expression at all.
 * Relative dates resolve against `clock`; without one they are refused.
 */
export const fromRecordsApiFilterParam = (
  param: string,
  clock?: ChannelClock
): readonly DataFilter[] | undefined => {
  if (param === '') return []
  const root = ((): unknown => {
    try {
      return JSON.parse(param) as unknown
    } catch {
      return undefined
    }
  })()
  const nodes = (root as { readonly and?: unknown } | undefined)?.and
  if (!Array.isArray(nodes)) return undefined
  const conditions = nodes.map((node: unknown) => {
    const group = (node as { readonly or?: unknown } | null)?.or
    return Array.isArray(group) ? groupOf(group, clock) : leafOf(node, clock)
  })
  return conditions.every((condition) => condition !== undefined)
    ? (conditions as readonly DataFilter[])
    : undefined
}

/**
 * A channel bag as page conditions: the `filter` expression's, then each
 * contributed `@<operator>:<field>` condition. `undefined` when the expression
 * cannot be said as conditions that all hold. Relative dates in either resolve
 * against `clock`, the request's day and minute.
 */
export const channelDataFilters = (
  bag: Readonly<Record<string, string>>,
  clock?: ChannelClock
): readonly DataFilter[] | undefined => {
  const expressed = fromRecordsApiFilterParam(bag['filter'] ?? '', clock)
  if (expressed === undefined) return undefined
  const contributed = pageConditionsInBag(bag).flatMap((condition) => {
    const operator = condition.operator as DataFilter['operator']
    const value = literalOf(condition.value, clock)
    return value === undefined ? [] : [{ field: condition.field, operator, value }]
  })
  return [...expressed, ...contributed]
}
