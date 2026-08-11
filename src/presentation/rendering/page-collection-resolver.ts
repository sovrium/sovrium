/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Collection-page record resolution.
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
 * collection record ([internal ref] — Category & Tag
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
   * Bug 2 / [internal ref]: the slug resolved to a real row, but
   * the table's `rowLevelPermissions.read.when` predicate excluded it for
   * the active session. Distinct from `not-found` so the caller can render
   * a structured access-denied response (e.g. 200 with a permission
   * marker) instead of a silent 404. S1 anti-enumeration is preserved
   * because anonymous + truly-nonexistent both still produce `not-found`.
   */
  | { readonly kind: 'permission-blocked' }

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
 * ([internal ref] — B-4 dynamic-seo-for-collections).
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
 * PG-04: walks the substituted
 * component subtree and stamps the resolved collection record onto every
 * descendant component that declares a single-mode dataSource against the
 * SAME table (matching the collection's table). Mirrors the
 * `applySingleRecordToComponent` injection that runs only for top-level
 * components with their own dataSource — required so a nested `data-form` /
 * `form` inside a tabs panel renders pre-filled inputs and the synthesized
 * CRUD update action carries the record id in its API path.
 *
 * Stops traversal at any component declaring its OWN dataSource — those are
 * resolved separately later by the general data-source resolver and could
 * be bound to a different table or list rows that would receive their own
 * per-row record.
 */
/**
 * Returns true when the component declares a `dataSource: { mode: 'single',
 * table: <tableName> }` and does not already carry a `_record` prop —
 * indicating it should receive the collection record injection.
 */
function shouldInjectCollectionRecord(component: Component, tableName: string): boolean {
  const ds = component.dataSource as { readonly table?: string; readonly mode?: string } | undefined
  if (ds?.mode !== 'single' || ds.table !== tableName) return false
  const existing = (component.props as { _record?: unknown } | undefined)?._record
  return existing === undefined
}

/**
 * Returns true when the component's children should NOT be recursed into —
 * either because they are a per-row template owned by a sibling dataSource
 * or because the component carries no children at all.
 */
function shouldStopRecursion(component: Component, tableName: string): boolean {
  const ds = component.dataSource as { readonly table?: string; readonly mode?: string } | undefined
  if (!component.children) return true
  if (ds === undefined) return false
  // Recurse only when this is the matching single-mode case (parent
  // collection record is the right scope); other dataSources own their
  // children's per-row substitution.
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

/**
 * Substitutes `$record.<field>` tokens in every top-level page
 * component. Component-reference items (`$ref`/`component`) are passed
 * through unchanged because variable substitution into referenced
 * templates happens later via the `$vars` pipeline.
 */
function substituteRecordInPageComponents(
  components: Page['components'],
  record: Record<string, unknown>,
  tableName: string
): Page['components'] {
  if (!components) return components
  return components.map((item) => {
    if ('component' in item || '$ref' in item) return item
    const substituted = substituteRecordInCollectionTemplate(item as Component, record, tableName)
    return injectRecordIntoNestedSingleMode(substituted, record, tableName)
  })
}

/**
 * Auto-bind `table` + `recordId` props on `comments` / `commentCount`
 * components when they appear inside a collection-page. The page binds
 * the comments thread to the page's collection record by convention
 *; schema authors should not
 * need to repeat `table: 'posts', recordId: '$record.id'` in every
 * `props` block. Explicit author values are preserved when present.
 *
 * Runs recursively so `comments` components nested inside layout
 * containers (eg. `section > comments`) also get the auto-bind.
 */
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
 * `options.bypassFilter` ([internal ref] /
 * [internal ref]) skips the `collection.filter` step so
 * editorial roles can preview unpublished/draft records via their
 * canonical public URL. The bypass is privileged opt-in — the page-
 * route handler only sets it for `?preview=true` requests carrying an
 * editorial session.
 */
/**
 * Resolve the collection record + run the pre-render gates (slug lookup,
 * collection.filter, row-level read predicate). Returns either an early
 * `PageCollectionResolution` outcome OR the matched record for the caller to
 * continue substitution. Extracted to keep `resolveCollectionPage` under the
 * complexity cap as the gate chain grew with Bug 2's row-level overlay.
 */
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

  // Bug 2 / [internal ref]: row-level read predicate runs AFTER
  // the row is confirmed to exist (so a genuinely missing record still 404s
  // — S1 anti-enumeration preserved) and AFTER the collection.filter
  // (status/draft/etc. exclusions take precedence over per-user perms).
  if (options?.rowLevelReadCheck !== undefined) {
    const allowed = await options.rowLevelReadCheck(record)
    if (!allowed) return { kind: 'permission-blocked' }
  }

  return { kind: 'continue', record }
}

interface ResolveCollectionOptions {
  readonly bypassFilter?: boolean
  /**
   * Bug 2 / [internal ref]: when supplied, the resolver invokes
   * this predicate against the fetched record. A `false` result means the
   * row exists but the active user can't see it — the resolver returns
   * `permission-blocked` instead of `not-found` so the caller can render
   * a structured access-denied response.
   *
   * Returning `true` (or omitting the option entirely) preserves the
   * existing pass-through behaviour. `bypassFilter` does NOT bypass this
   * predicate — preview is an editorial concern, row-level read perms
   * are a confidentiality concern and apply at all times.
   */
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

  // PG-02 auto-bind: `comments` / `commentCount` components inside a
  // collection-page implicitly target the page's resolved record. Without
  // this auto-bind every schema would need to repeat
  // `props: { table: 'posts', recordId: '$record.id' }` per component.
  const recordIdValue = record['id']
  const autoBoundComponents =
    recordIdValue !== undefined && recordIdValue !== null
      ? autoBindCommentComponents(substitutedComponents, collection, String(recordIdValue))
      : substitutedComponents

  // [internal ref]: resolve adjacent records for
  // `$collection.previous.*` / `$collection.next.*` substitution. Boundary
  // records (first/last) get `undefined` neighbours; the substitution pass
  // drops any component referencing a null side so prev/next links don't
  // emit empty anchors at the edges of the collection.
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
