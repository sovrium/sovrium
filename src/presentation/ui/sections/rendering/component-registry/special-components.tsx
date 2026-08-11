/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Hero } from '@/presentation/ui/sections/hero'
import * as Renderers from '../../renderers/element-renderers'
import { parseHTMLContent } from '../component-registry-helpers'
import type { ComponentRenderer, DispatchableComponentType } from '../component-dispatch-config'
import type { ReactElement } from 'react'

/** Stable identity for the search-list SSR placeholder input. */
const SEARCH_INPUT_STYLE = { width: '100%', marginBottom: '0.5rem', padding: '0.5rem' } as const

/** Stable identity for the list error fallback container. */
const LIST_ERROR_STYLE = {
  color: 'red',
  padding: '1rem',
  border: '1px solid red',
  borderRadius: '4px',
} as const

/**
 * Shared renderer for hero component type
 */
const renderHeroSection: ComponentRenderer = ({
  elementProps,
  theme,
  content,
  renderedChildren,
}) => {
  // If content is an HTML string, parse it as children
  const children =
    typeof content === 'string' && content.trim().startsWith('<')
      ? parseHTMLContent(content)
      : renderedChildren

  return (
    <Hero
      theme={theme}
      content={
        typeof content === 'object'
          ? (content as { button?: { text: string; animation?: string } } | undefined)
          : undefined
      }
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {children}
    </Hero>
  )
}

/**
 * Renders a load more button
 */
function renderLoadMoreUI(): ReactElement {
  return (
    <div>
      <button
        type="button"
        aria-label="Load more"
      >
        Load More
      </button>
    </div>
  )
}

/**
 * Renders numbered page navigation
 */
function renderNumberedPaginationUI(totalPages: number): ReactElement {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  return (
    <nav aria-label="pagination">
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === 1 ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
    </nav>
  )
}

/**
 * Renders pagination UI based on pagination style
 */
function renderPaginationUI(
  style: string | undefined,
  pageSize: number,
  totalCount: number
): ReactElement | undefined {
  const totalPages = Math.ceil(totalCount / pageSize)
  if (totalPages <= 1) return undefined
  if (style === 'loadMore') return renderLoadMoreUI()
  return renderNumberedPaginationUI(totalPages)
}

interface ListPaginationProps {
  readonly pageSize: number | undefined
  readonly totalCount: number | undefined
  readonly paginationStyle: string | undefined
}

interface ListDisplayProps {
  readonly itemTemplate?: Record<string, unknown>
  readonly emptyMessage?: string
  readonly loadMore?: string
  readonly highlight?: boolean
}

/** Parses the serialized `_listDisplay` prop into its declarative config. */
function parseListDisplay(raw: unknown): ListDisplayProps | undefined {
  return typeof raw === 'string' ? (JSON.parse(raw) as ListDisplayProps) : undefined
}

/** Builds the serialized island props from the resolved search element props. */
function buildSearchIslandProps(
  elementProps: Record<string, unknown>,
  listDisplay: ListDisplayProps | undefined,
  records: readonly unknown[],
  bindTo: string | undefined
): string {
  return JSON.stringify({
    id: elementProps['id'] as string | undefined,
    records,
    searchFields: JSON.parse((elementProps['_searchFields'] as string) ?? '[]'),
    debounceMs: elementProps['_searchDebounceMs'] as number | undefined,
    limit: elementProps['_searchLimit'] as number | undefined,
    childTemplate: JSON.parse((elementProps['_searchChildTemplate'] as string) ?? '[]'),
    itemTemplate: listDisplay?.itemTemplate,
    emptyMessage: listDisplay?.emptyMessage,
    loadMore: listDisplay?.loadMore,
    highlight: listDisplay?.highlight,
    bindTo,
    'data-testid': elementProps['data-testid'] as string | undefined,
  })
}

/**
 * Renders the `list` island placeholder for a CLIENT-fetching data-bound list
 * (CAP-1). The resolver stamped `_listIslandMode` + `_listDataSource` (the DB
 * table OR system read endpoint) + `_listDisplay`; this host forwards them to
 * the island, which fetches its rows and renders the `itemTemplate`. A system
 * source is read-only — no write affordances are emitted.
 */
function renderListIsland(elementProps: Record<string, unknown>): ReactElement {
  const listDisplay = parseListDisplay(elementProps['_listDisplay'])
  const dataSource = JSON.parse((elementProps['_listDataSource'] as string) ?? '{}') as unknown
  const islandProps = JSON.stringify({
    dataSource,
    itemTemplate: listDisplay?.itemTemplate,
    emptyMessage: listDisplay?.emptyMessage,
    'data-testid': elementProps['data-testid'] as string | undefined,
  })
  return (
    <div
      id={elementProps['id'] as string | undefined}
      data-island="list"
      data-component="list"
      data-island-props={islandProps}
    >
      {/* SSR skeleton: VISIBLE pulse rows before island hydration so the host
          has a non-zero box (Playwright treats an empty/zero-height host as
          hidden). Skeleton rows are `<div>` (not `<li>`) so `#id li` resolves to
          the hydrated itemTemplate items only. The island replaces this host's
          children on mount. */}
      <div
        role="status"
        aria-label="Loading list..."
        className="space-y-2 p-2"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`list-skeleton-${String(i)}`}
            className="bg-background-subtle h-6 w-full animate-pulse rounded"
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Renders the search island placeholder for client-side interactive search
 */
function renderSearchIsland(elementProps: Record<string, unknown>): ReactElement {
  const listDisplay = parseListDisplay(elementProps['_listDisplay'])
  const records = JSON.parse(
    (elementProps['_searchRecords'] as string) ?? '[]'
  ) as readonly unknown[]
  const emptyMessage = listDisplay?.emptyMessage
  // When `bindTo` is set, an external searchInput component drives the query,
  // so this list renders results only (no own input) to avoid duplicate inputs.
  const bindTo = elementProps['_searchBindTo'] as string | undefined
  const islandProps = buildSearchIslandProps(elementProps, listDisplay, records, bindTo)
  return (
    <div
      id={elementProps['id'] as string | undefined}
      data-island="search-list"
      data-component="list"
      data-island-props={islandProps}
    >
      {/* SSR placeholder: search input skeleton visible before island hydration. */}
      {/* NOTE: No data-search-input attribute here — Playwright targets [data-search-input] */}
      {/* which only exists after React hydration, ensuring tests wait for the island to mount. */}
      {/* Omitted when bound to an external searchInput (bindTo) to avoid a duplicate input box. */}
      {bindTo ? undefined : (
        <input
          type="search"
          placeholder="Search..."
          aria-label="Search..."
          disabled={true}
          style={SEARCH_INPUT_STYLE}
        />
      )}
      {/* SSR empty-state: when no records match (initial load with empty table), */}
      {/* the configured emptyMessage is rendered so search-first pages show it */}
      {/* server-side, before the island hydrates. */}
      {records.length === 0 && emptyMessage ? <p>{emptyMessage}</p> : <ul />}
    </div>
  )
}

/**
 * Extracts and strips internal _dataSource* and _pagination* props
 */
function extractListProps(elementProps: Record<string, unknown>): {
  readonly domProps: Record<string, unknown>
  readonly dataSourceBound: boolean | undefined
  readonly pagination: ListPaginationProps
} {
  const {
    _dataSourceBound,
    _dataSourceError: _err,
    _paginationPageSize,
    _paginationTotalCount,
    _paginationStyle,
    ...domProps
  } = elementProps
  return {
    domProps,
    dataSourceBound: _dataSourceBound as boolean | undefined,
    pagination: {
      pageSize: _paginationPageSize as number | undefined,
      totalCount: _paginationTotalCount as number | undefined,
      paginationStyle: _paginationStyle as string | undefined,
    },
  }
}

/**
 * Renders the list with optional pagination UI
 */
function renderListWithPagination(
  domProps: Record<string, unknown>,
  renderedChildren: readonly ReactElement[],
  pagination: ListPaginationProps
): ReactElement {
  const { pageSize, totalCount, paginationStyle } = pagination
  const hasPagination = pageSize !== undefined && totalCount !== undefined && totalCount > pageSize
  const paginationUI = hasPagination
    ? renderPaginationUI(paginationStyle, pageSize, totalCount)
    : undefined

  return (
    <div>
      <ul {...domProps}>{renderedChildren}</ul>
      {paginationUI}
    </div>
  )
}

/**
 * Special components (hero, card-*, speech-bubble, navigation, list, etc.)
 *
 * These components have complex rendering logic or use custom UI components.
 */
export const specialComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  hero: renderHeroSection,

  list: ({ elementProps, content, theme, renderedChildren }) => {
    // CAP-1: a client-fetching data-bound list (DB table OR system read
    // endpoint), stamped by the data-source resolver. Emit the `list` island
    // host; the island fetches its rows and renders the itemTemplate items.
    if (elementProps['_listIslandMode']) {
      return renderListIsland(elementProps)
    }

    // Show error if dataSource validation failed
    const dataSourceError = elementProps['_dataSourceError'] as string | undefined
    if (dataSourceError) {
      return (
        <div
          data-testid={elementProps['data-testid'] as string | undefined}
          role="alert"
          style={LIST_ERROR_STYLE}
        >
          {dataSourceError}
        </div>
      )
    }

    // Search mode: render island placeholder for client-side interactive search
    const searchMode = elementProps['_searchMode'] as boolean | undefined
    if (searchMode) {
      return renderSearchIsland(elementProps)
    }

    const { domProps, dataSourceBound, pagination } = extractListProps(elementProps)

    // Render list with children (data-bound or static) when no HTML content string
    if (!content && renderedChildren.length > 0) {
      return renderListWithPagination(domProps, renderedChildren, pagination)
    }
    // Ensure data-bound lists are visible even when empty (no records in table)
    if (dataSourceBound && !content) {
      return (
        <ul
          {...domProps}
          // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-call style merge inside a stateless render function; memoization happens in the outer component
          style={{
            ...(domProps.style as object | undefined),
            display: 'block',
            minHeight: '1px',
          }}
        />
      )
    }
    return Renderers.renderList(domProps, content, theme)
  },

  // `li` is the one registry key that is NOT a schema component type — no author
  // can declare it. It is SYNTHESIZED at render time by `expandDataSourceChildren`
  // (`data-source-resolver.ts`), which wraps each record of a data-bound list in
  // an `li` before substituting record vars, so deleting it would drop every
  // data-bound list row through to the `div` fallback. Admitted deliberately by
  // `SynthesizedOnlyComponentType` in `component-dispatch-config.ts`.
  li: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderListItem(elementProps, content, renderedChildren),

  'responsive-grid': () => {
    return (
      <section
        data-testid="responsive-section"
        className="p-8 md:p-16"
      >
        <div className="responsive-grid grid gap-4 lg:gap-8">Grid items</div>
      </section>
    )
  },
}
