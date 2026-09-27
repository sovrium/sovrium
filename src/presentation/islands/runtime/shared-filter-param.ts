/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Fold what a shared-filter channel publishes into ONE records request.
 *
 * A data component bound to a publisher (`dataSource.bindTo` + `sharedFilter`)
 * receives a param bag from `useSharedFilter`. A filter bar publishes its
 * conditions as a records-API filter expression under `filter`; any other key
 * (a search box's `q`, a selector's param) rides along as a query param.
 *
 * The component's OWN filter is kept: when both an own filter and a published
 * one are present they are combined with `and`, so a bar can only NARROW what
 * an author already scoped — never widen it past the author's filter. Every
 * subscriber, the grid included, builds its request here. The `field:value`
 * shorthand the records endpoint accepts is read as the one equality it
 * stands for, so it narrows too; a published value that is neither is dropped
 * rather than sent in place of the own filter. An empty published value adds
 * nothing.
 */
export interface SharedRecordsParams {
  /** The filter expression to request, or `undefined` for none. */
  readonly filterParam: string | undefined
  /** The other published params, empty values dropped. */
  readonly extraParams: Readonly<Record<string, string>>
}

/** `value` parsed as JSON, or `undefined` when it is not JSON. */
const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

/**
 * `value` as a filter tree: parsed JSON, or the `field:value` shorthand read as
 * the one equality the records endpoint reads it as (`parseFilterParameter`).
 */
const toFilterTree = (value: string): unknown => {
  const parsed = parseJson(value)
  if (parsed !== undefined) return parsed
  const colon = value.indexOf(':')
  if (colon <= 0) return undefined
  return {
    and: [{ field: value.slice(0, colon), operator: 'equals', value: value.slice(colon + 1) }],
  }
}

/** The own filter and the published one, as one expression — never wider than the own. */
const combineFilters = (own: string | undefined, published: string): string | undefined => {
  if (own === undefined || own === '') return published
  const ownTree = toFilterTree(own)
  const publishedTree = toFilterTree(published)
  if (ownTree === undefined || publishedTree === undefined) return own
  return JSON.stringify({ and: [ownTree, publishedTree] })
}

export function withSharedFilter(
  ownFilter: string | undefined,
  shared: Readonly<Record<string, string>>
): SharedRecordsParams {
  const { filter: published, ...rest } = shared
  const extraParams = Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== ''))
  const filterParam =
    published === undefined || published === '' ? ownFilter : combineFilters(ownFilter, published)
  return { filterParam, extraParams }
}
