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

function substituteRecordInPageComponents(
  components: Page['components'],
  record: Record<string, unknown>
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    return substituteRecordInCollectionTemplate(item as Component, record)
  })
}

export async function resolveCollectionPage(
  page: Page,
  routeParams: Readonly<Record<string, string>>,
  db: DataSourceDb,
  options?: { readonly bypassFilter?: boolean }
): Promise<PageCollectionResolution> {
  const { collection } = page
  if (collection === undefined) return { kind: 'none' }

  const slugValue = routeParams[collection.slugField]
  if (slugValue === undefined) return { kind: 'not-found' }

  const record = await db.fetchSingleRecord(collection.table, collection.slugField, slugValue)
  if (record === undefined) return { kind: 'not-found' }

  if (options?.bypassFilter !== true && !recordMatchesAllFilters(record, collection.filter)) {
    return { kind: 'not-found' }
  }

  const substitutedMeta = substituteRecordInMeta(page.meta, record)
  const substitutedComponents = substituteRecordInPageComponents(page.components, record)

  const adjacency = await fetchCollectionAdjacency(collection, record, db)
  const adjMeta = substituteCollectionInMeta(substitutedMeta, adjacency)
  const adjComponents = substituteCollectionInPageComponents(substitutedComponents, adjacency)

  const substitutedPage: Page = {
    ...page,
    ...(adjMeta !== undefined ? { meta: adjMeta } : {}),
    components: adjComponents,
  }

  return { kind: 'match', page: substitutedPage, record }
}
