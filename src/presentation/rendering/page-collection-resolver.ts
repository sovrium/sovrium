/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import {
  substituteRecordInCollectionTemplate,
  substituteRecordVars,
} from '@/presentation/rendering/data-source-resolver'
import {
  fetchCollectionAdjacency,
  substituteCollectionInMeta,
  substituteCollectionInPageComponents,
} from '@/presentation/rendering/page-collection-prevnext'
import type { Page } from '@/domain/models/app/pages'
import type { Component } from '@/domain/models/app/pages/components'
import type { DataFilter } from '@/domain/models/app/pages/components/data-source'
import type { DataSourceDb } from '@/presentation/rendering/data-source-resolver'

export type PageCollectionResolution =
  | {
      readonly kind: 'match'
      readonly page: Page
      readonly record: Readonly<Record<string, unknown>>
    }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'none' }
  | { readonly kind: 'permission-blocked' }

const numericCompare = (
  cellValue: unknown,
  expected: unknown,
  predicate: (a: number, b: number) => boolean
): boolean =>
  typeof cellValue === 'number' && typeof expected === 'number'
    ? predicate(cellValue, expected)
    : false

const FILTER_OPERATORS: Readonly<
  Record<DataFilter['operator'], (cellValue: unknown, expected: unknown) => boolean>
> = {
  eq: (cellValue, expected) => cellValue === expected,
  neq: (cellValue, expected) => cellValue !== expected,
  gt: (cellValue, expected) => numericCompare(cellValue, expected, (a, b) => a > b),
  gte: (cellValue, expected) => numericCompare(cellValue, expected, (a, b) => a >= b),
  lt: (cellValue, expected) => numericCompare(cellValue, expected, (a, b) => a < b),
  lte: (cellValue, expected) => numericCompare(cellValue, expected, (a, b) => a <= b),
  contains: (cellValue, expected) =>
    typeof cellValue === 'string' && typeof expected === 'string'
      ? cellValue.includes(expected)
      : false,
  in: (cellValue, expected) =>
    Array.isArray(expected) ? (expected as readonly unknown[]).includes(cellValue) : false,
}

function recordMatchesFilter(record: Record<string, unknown>, filter: DataFilter): boolean {
  const expected = filter.value
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    return false
  }
  const op = FILTER_OPERATORS[filter.operator]
  return op === undefined ? false : op(record[filter.field], expected)
}

function recordMatchesAllFilters(
  record: Record<string, unknown>,
  filters: readonly DataFilter[] | undefined
): boolean {
  if (filters === undefined || filters.length === 0) return true
  return filters.every((f) => recordMatchesFilter(record, f))
}

function substituteRecordDeep(value: unknown, record: Record<string, unknown>): unknown {
  if (typeof value === 'string') return substituteRecordVars(value, record)
  if (Array.isArray(value)) return value.map((item) => substituteRecordDeep(item, record))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        substituteRecordDeep(v, record),
      ])
    )
  }
  return value
}

function substituteRecordInMeta(meta: Page['meta'], record: Record<string, unknown>): Page['meta'] {
  if (meta === undefined) return meta
  return substituteRecordDeep(meta, record) as Page['meta']
}

function shouldInjectCollectionRecord(component: Component, tableName: string): boolean {
  const ds = component.dataSource as { readonly table?: string; readonly mode?: string } | undefined
  if (ds?.mode !== 'single' || ds.table !== tableName) return false
  const existing = (component.props as { _record?: unknown } | undefined)?._record
  return existing === undefined
}

function shouldStopRecursion(component: Component, tableName: string): boolean {
  const ds = component.dataSource as { readonly table?: string; readonly mode?: string } | undefined
  if (!component.children) return true
  if (ds === undefined) return false
  return !(ds.mode === 'single' && ds.table === tableName)
}

function injectRecordIntoNestedSingleMode(
  component: Component,
  record: Record<string, unknown>,
  tableName: string
): Component {
  const withProp: Component = shouldInjectCollectionRecord(component, tableName)
    ? {
        ...component,
        props: { ...(component.props ?? {}), _dataSourceBound: true, _record: record },
      }
    : component
  if (shouldStopRecursion(withProp, tableName)) return withProp
  return {
    ...withProp,
    children: withProp.children!.map((child: Component | string) =>
      typeof child === 'string' ? child : injectRecordIntoNestedSingleMode(child, record, tableName)
    ),
  }
}

function substituteRecordInPageComponents(
  components: Page['components'],
  record: Record<string, unknown>,
  tableName: string
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    const substituted = substituteRecordInCollectionTemplate(item as Component, record)
    return injectRecordIntoNestedSingleMode(substituted, record, tableName)
  })
}

function autoBindCommentComponents(
  components: Page['components'],
  collection: NonNullable<Page['collection']>,
  recordId: string
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    return autoBindCommentInComponent(item as Component, collection, recordId)
  })
}

function autoBindCommentInComponent(
  component: Component,
  collection: NonNullable<Page['collection']>,
  recordId: string
): Component {
  const isCommentComponent = component.type === 'comments' || component.type === 'commentCount'
  const autoBound = isCommentComponent
    ? {
        ...component,
        props: {
          ...(component.props ?? {}),
          ...(typeof component.props?.table === 'string' ? {} : { table: collection.table }),
          ...(typeof component.props?.recordId === 'string' ? {} : { recordId }),
        },
      }
    : component
  if (!autoBound.children || autoBound.children.length === 0) return autoBound
  return {
    ...autoBound,
    children: autoBound.children.map((child: Component | string) =>
      typeof child === 'string' ? child : autoBindCommentInComponent(child, collection, recordId)
    ),
  }
}

async function resolveCollectionRecord(
  collection: Readonly<NonNullable<Page['collection']>>,
  routeParams: Readonly<Record<string, string>>,
  db: DataSourceDb,
  options?: ResolveCollectionOptions
): Promise<
  | { readonly kind: 'continue'; readonly record: Readonly<Record<string, unknown>> }
  | Extract<PageCollectionResolution, { kind: 'not-found' | 'permission-blocked' }>
> {
  const slugValue = routeParams[collection.slugField]
  if (slugValue === undefined) return { kind: 'not-found' }

  const record = await db.fetchSingleRecord(collection.table, collection.slugField, slugValue)
  if (record === undefined) return { kind: 'not-found' }

  if (options?.bypassFilter !== true && !recordMatchesAllFilters(record, collection.filter)) {
    return { kind: 'not-found' }
  }

  if (options?.rowLevelReadCheck !== undefined) {
    const allowed = await options.rowLevelReadCheck(record)
    if (!allowed) return { kind: 'permission-blocked' }
  }

  return { kind: 'continue', record }
}

interface ResolveCollectionOptions {
  readonly bypassFilter?: boolean
  readonly rowLevelReadCheck?: (
    record: Readonly<Record<string, unknown>>
  ) => boolean | Promise<boolean>
}

export async function resolveCollectionPage(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  db: DataSourceDb,
  options?: ResolveCollectionOptions
): Promise<PageCollectionResolution> {
  const { collection } = page
  if (collection === undefined) return { kind: 'none' }

  const resolved = await resolveCollectionRecord(collection, routeParams, db, options)
  if (resolved.kind !== 'continue') return resolved
  const { record } = resolved

  const substitutedMeta = substituteRecordInMeta(page.meta, record)
  const substitutedComponents = substituteRecordInPageComponents(
    page.components,
    record,
    collection.table
  )

  const recordIdValue = record['id']
  const autoBoundComponents =
    recordIdValue !== undefined && recordIdValue !== null
      ? autoBindCommentComponents(substitutedComponents, collection, String(recordIdValue))
      : substitutedComponents

  const adjacency = await fetchCollectionAdjacency(collection, record, db)
  const adjMeta = substituteCollectionInMeta(substitutedMeta, adjacency)
  const adjComponents = substituteCollectionInPageComponents(autoBoundComponents, adjacency)

  const substitutedPage: Page = {
    ...page,
    ...(adjMeta !== undefined ? { meta: adjMeta } : {}),
    components: adjComponents,
  }

  return { kind: 'match', page: substitutedPage, record }
}
