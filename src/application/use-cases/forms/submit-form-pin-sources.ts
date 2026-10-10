/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Where a page embedding a form reads the ONE record a hidden link may be
 * filled from, and the clause its own configuration narrows that record by
 * (`submit-form-hidden-pins.ts`). Read off the configuration, never the
 * request.
 */

import { normalizeCurrentUserRef } from '@/domain/models/app/pages/current-user-ref'
import { isRouteParamRef } from '@/domain/models/app/pages/route-param-ref'
import type { FormOptionVisitor } from './resolve-form-option-sources'
import type { QueryFilterNode } from '@/application/ports/repositories/tables/table-repository'
import type { Page } from '@/domain/models/app/pages'

/**
 * The records-API operator for each collection-filter operator the query judges
 * as the page does. `contains` is absent on purpose: the page compares it
 * case-sensitively and the query would not, so a page filtering on it admits
 * no pinned record rather than one its page leaves out.
 */
const COLLECTION_FILTER_OPERATORS: Readonly<Record<string, string>> = {
  eq: 'equals',
  neq: 'notEquals',
  gt: 'greaterThan',
  gte: 'greaterThanOrEqual',
  lt: 'lessThan',
  lte: 'lessThanOrEqual',
  in: 'in',
  isEmpty: 'isEmpty',
  isNotEmpty: 'isNotEmpty',
}

/**
 * Whether the page can ever match `value` under `operator`: a `$currentUser`
 * object never matches, a range compares numbers only, and `in` needs a list.
 */
const pageCanMatch = (operator: string, value: unknown): boolean => {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return false
  if (['gt', 'gte', 'lt', 'lte'].includes(operator)) return typeof value === 'number'
  return operator !== 'in' || Array.isArray(value)
}

/**
 * A collection's `filter` as a query clause — every condition ANDed, read off
 * the configuration and never the request — or `'nothing'` when one condition
 * cannot be judged as the page judges it (an unmapped operator, or a value the
 * page never matches — {@link pageCanMatch}).
 */
const collectionClauseOf = (
  filter: NonNullable<Page['collection']>['filter']
): QueryFilterNode | 'nothing' | undefined => {
  if (filter === undefined || filter.length === 0) return undefined
  const leaves = filter.map(({ field, operator, value }) => {
    const mapped = Object.hasOwn(COLLECTION_FILTER_OPERATORS, operator)
      ? COLLECTION_FILTER_OPERATORS[operator]
      : undefined
    return mapped === undefined || !pageCanMatch(operator, value)
      ? undefined
      : { field, operator: mapped, value }
  })
  return leaves.every((leaf) => leaf !== undefined) ? { and: leaves } : 'nothing'
}

/** The table a page reads ONE record from, and the clause its own config narrows it by. */
export interface PageRecordSource {
  readonly tableName: string
  readonly pageClause: QueryFilterNode | undefined
}

type PageFilter = NonNullable<Page['collection']>['filter']
type PageCondition = NonNullable<PageFilter>[number]

/**
 * One condition of a single-record binding as the page judges it for this
 * submitter: a `$currentUser.<id|email|role>` reference becomes her value, as
 * the page resolves it for her session. `undefined` when the page could not
 * resolve it for her — nobody signed in (the page answers 404), an assignment
 * scope — so the clause admits nothing rather than a record the page never
 * shows her.
 */
const submitterConditionOf = (
  condition: PageCondition,
  visitor: FormOptionVisitor | undefined
): PageCondition | undefined => {
  const ref = normalizeCurrentUserRef(condition.value)
  if (ref === undefined) return condition
  const resolved = ref.path.kind === 'scalar' ? visitor?.[ref.path.name] : undefined
  return typeof resolved === 'string' ? { ...condition, value: resolved } : undefined
}

/**
 * A single-record binding's `filter` as the page's own clause for this
 * submitter. A condition on a route parameter is left out: the page binds
 * whichever record its address names, so any value of it is one the page could
 * have rendered. A `$currentUser` condition is the submitter's own
 * ({@link submitterConditionOf}).
 */
const singleBindingClauseOf = (
  filter: PageFilter,
  visitor: FormOptionVisitor | undefined
): QueryFilterNode | 'nothing' | undefined => {
  const conditions = (filter ?? [])
    .filter((condition) => !isRouteParamRef(condition.value))
    .map((condition) => submitterConditionOf(condition, visitor))
  if (conditions.some((condition) => condition === undefined)) return 'nothing'
  return collectionClauseOf(conditions as PageFilter)
}

/** The table a page reads ONE record from, and its own clause before it is judged. */
const configuredSourceOf = (
  page: Page,
  visitor: FormOptionVisitor | undefined
):
  | { readonly tableName: string; readonly clause: QueryFilterNode | 'nothing' | undefined }
  | undefined => {
  const { dataSource } = page as {
    readonly dataSource?: {
      readonly table?: unknown
      readonly mode?: unknown
      readonly filter?: PageFilter
    }
  }
  if (dataSource?.mode === 'single' && typeof dataSource.table === 'string') {
    return {
      tableName: dataSource.table,
      clause: singleBindingClauseOf(dataSource.filter, visitor),
    }
  }
  if (page.collection === undefined) return undefined
  return { tableName: page.collection.table, clause: collectionClauseOf(page.collection.filter) }
}

/**
 * Where a page reads ONE record from for this submitter, when it does: a
 * `dataSource` in `single` mode or a `collection` — each showing a record only
 * when its `filter` admits it, so that filter rides with the source. A filter
 * the page never matches for her leaves the page no record to read.
 */
export const recordSourceOf = (
  page: Page,
  visitor: FormOptionVisitor | undefined
): PageRecordSource | undefined => {
  const source = configuredSourceOf(page, visitor)
  if (source === undefined || source.clause === 'nothing') return undefined
  return { tableName: source.tableName, pageClause: source.clause }
}
