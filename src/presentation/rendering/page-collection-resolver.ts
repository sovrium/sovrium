/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Collection-page record resolution (US-PAGES-COLLECTION-PAGES-001).
 *
 * Lives in its own module so the broader `render-page.tsx` file stays
 * under the line cap. The helper below is the only piece of the renderer
 * that materialises the `$record` envelope exposed to a collection-page's
 * components and meta — keeping it isolated also makes the contract
 * obvious (one fetch + filter check + substitution pass, three
 * outcomes).
 *
 * `page.collection` declares:
 *   - `table`       — name of the source table
 *   - `slugField`   — column whose value populates the URL parameter
 *   - `filter?`     — optional DataFilter[] applied AFTER the fetch so
 *                     records that don't match (e.g., status='draft')
 *                     return `not-found` and the caller 404s.
 *
 * The substitution pass walks the page's `components`, `meta.title`,
 * `meta.description`, and `meta.keywords` replacing `$record.<field>`
 * tokens with the corresponding column value from the resolved record.
 * Component substitution uses `substituteRecordInCollectionTemplate`
 * from `data-source-resolver.ts` — the collection-template variant of
 * the per-record walk skips children of components that have a
 * `dataSource` so per-row templates are not pre-bound to the parent
 * collection record (US-PAGES-ACCESS-PUBLISHING-003 — Category & Tag
 * Patterns). The `dataSource.filter[].value` IS substituted so the
 * parent record can drive cross-table filtering (eg.
 * `filter: [{ field: 'category', value: '$record.name' }]`).
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

/**
 * Outcome of resolving a collection page's record.
 *
 * - `match`     — the slug resolved to a record that satisfies every
 *                 `collection.filter` predicate. Caller renders the
 *                 substituted page.
 * - `not-found` — slug missing from URL OR record missing from DB OR
 *                 record fails a filter predicate. Caller 404s.
 * - `none`      — page has no `collection` declaration. Caller falls
 *                 through to normal rendering.
 */
export type PageCollectionResolution =
  | {
      readonly kind: 'match'
      readonly page: Page
      readonly record: Readonly<Record<string, unknown>>
    }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'none' }

/**
 * Numeric comparison helper — returns false unless both operands are numbers.
 * Centralised so the operator dispatch table stays under the cyclomatic-
 * complexity cap.
 */
const numericCompare = (
  cellValue: unknown,
  expected: unknown,
  predicate: (a: number, b: number) => boolean
): boolean =>
  typeof cellValue === 'number' && typeof expected === 'number'
    ? predicate(cellValue, expected)
    : false

/**
 * Per-operator dispatch table for collection-page filter predicates.
 *
 * Supports the literal value branch of `FilterValueSchema`. Any
 * `$currentUser` reference is short-circuited at the call site (see
 * `recordMatchesFilter`) because collection filtering is meant for
 * static publish-state gates (eg. `status eq 'published'`), not
 * session-aware predicates.
 */
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

/**
 * Compares a record's field value against a DataFilter predicate.
 */
function recordMatchesFilter(record: Record<string, unknown>, filter: DataFilter): boolean {
  const expected = filter.value
  // `$currentUser` references resolve to objects, not literals; we
  // intentionally short-circuit them as no-match for collection filters.
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    return false
  }
  const op = FILTER_OPERATORS[filter.operator]
  return op === undefined ? false : op(record[filter.field], expected)
}

/** Returns true when the record satisfies every filter predicate. */
function recordMatchesAllFilters(
  record: Record<string, unknown>,
  filters: readonly DataFilter[] | undefined
): boolean {
  if (filters === undefined || filters.length === 0) return true
  return filters.every((f) => recordMatchesFilter(record, f))
}

/**
 * Recursively substitutes `$record.<field>` tokens in any string value
 * found inside an arbitrary JSON-serialisable structure (strings, arrays,
 * plain objects). Non-string leaves (numbers, booleans, null) pass
 * through unchanged.
 *
 * Used to walk meta sub-objects whose schema is `Schema.Unknown`
 * (`structuredData`) or that have many optional URL/string fields
 * (`openGraph`, `twitter`) — the whole shape is traversed in one pass
 * so any `$record.*` token, regardless of nesting depth, resolves to
 * the per-record value.
 */
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

/**
 * Substitutes `$record.<field>` tokens across the entire page metadata
 * (US-PAGES-COLLECTION-PAGES-003 — B-4 dynamic-seo-for-collections).
 *
 * Walks the top-level scalar fields (`title`, `description`, `keywords`,
 * `canonical`, `author`, `robots`) AND the nested SEO sub-objects
 * (`openGraph`, `twitter`, `structuredData`) so a single page declaration
 * produces per-record:
 *   - `<title>` (B-1)
 *   - `<meta name="description">` (B-1)
 *   - `<link rel="canonical">` (B-4)
 *   - Open Graph and Twitter Card image / URL / title / description
 *     tags for social-sharing previews (B-4)
 *   - JSON-LD `<script type="application/ld+json">` payloads with
 *     record-derived headline/datePublished/author (B-4)
 *
 * Returns the same meta object when meta is undefined so React rendering
 * stays referentially stable for unrelated test snapshots.
 */
function substituteRecordInMeta(meta: Page['meta'], record: Record<string, unknown>): Page['meta'] {
  if (meta === undefined) return meta
  return substituteRecordDeep(meta, record) as Page['meta']
}

/**
 * Substitutes `$record.<field>` tokens in every top-level page
 * component. Component-reference items (`$ref`/`component`) are passed
 * through unchanged because variable substitution into referenced
 * templates happens later via the `$vars` pipeline.
 */
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

/**
 * Resolve a collection page's slug parameter into the record envelope
 * exposed to the rendered page. Returns `none` when the page is not a
 * collection page (no `collection` declaration); `not-found` when the
 * slug is missing from the URL, the record is missing from the database,
 * or the record fails the configured `collection.filter`; `match` with
 * a `Page` whose `meta` and `components` have all `$record.*` tokens
 * substituted otherwise.
 *
 * The caller (renderPageByPath) treats `not-found` as a 404, falls
 * through to the existing pipeline on `none`, and uses the substituted
 * page from `match` for the rest of the rendering chain.
 *
 * `options.bypassFilter` (US-PAGES-ACCESS-PUBLISHING-001 /
 * APP-PAGES-PUBLISHING-003) skips the `collection.filter` step so
 * editorial roles can preview unpublished/draft records via their
 * canonical public URL. The bypass is privileged opt-in — the page-
 * route handler only sets it for `?preview=true` requests carrying an
 * editorial session.
 */
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

  // US-PAGES-COLLECTION-PAGES-004: resolve adjacent records for
  // `$collection.previous.*` / `$collection.next.*` substitution. Boundary
  // records (first/last) get `undefined` neighbours; the substitution pass
  // drops any component referencing a null side so prev/next links don't
  // emit empty anchors at the edges of the collection.
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
