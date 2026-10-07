/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  resolveInterpreterString,
  resolveInterpreterStringOverrides,
} from '@/domain/models/app/languages/translation-resolver'
import { computeButtonDefaultClasses } from '@/presentation/design/button-default-classes'
import { computeListLoadMoreClasses } from '@/presentation/design/list-default-classes'
import {
  hostClassName,
  hostComponentType,
} from '@/presentation/render/registry/island-host-attributes'
import * as Renderers from '../elements'
import { omitInternalMarkers } from '../props/internal-marker-props'
import { renderEmptyBoundList } from './empty-bound-list'
import {
  parseListDisplay,
  renderListIsland,
  type EngineLocale,
  type ListDisplayProps,
} from './list-island-host'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
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
 * Renders a load more button.
 *
 * The footer carries the canvas' top rule and centred 8px padding, which is
 * what attaches the control to the list above it rather than leaving it
 * floating under a gap. The control itself reuses the shared button recipe, so
 * a list's "Load More" is the same secondary button as every other secondary
 * button in the app rather than an unstyled UA control.
 */
function renderLoadMoreUI(): ReactElement {
  return (
    <div className={computeListLoadMoreClasses()}>
      <button
        type="button"
        aria-label="Load more"
        className={computeButtonDefaultClasses({ variant: 'secondary', size: 'sm' })}
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

/** Builds the serialized island props from the resolved search element props. */
function buildSearchIslandProps(
  elementProps: Record<string, unknown>,
  listDisplay: ListDisplayProps | undefined,
  records: readonly unknown[],
  input: { readonly bindTo: string | undefined; readonly placeholder: string | undefined }
): string {
  const { bindTo, placeholder } = input
  return JSON.stringify({
    id: elementProps['id'] as string | undefined,
    // Names the rows' table, which scopes the page payload filter to it.
    table: elementProps['_searchTable'] as string | undefined,
    placeholder,
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
 * Renders the search island placeholder for client-side interactive search
 */
function renderSearchIsland(
  elementProps: Record<string, unknown>,
  { currentLang, languages }: EngineLocale
): ReactElement {
  const listDisplay = parseListDisplay(elementProps['_listDisplay'])
  const records = JSON.parse(
    (elementProps['_searchRecords'] as string) ?? '[]'
  ) as readonly unknown[]
  const emptyMessage = listDisplay?.emptyMessage
  // When `bindTo` is set, an external `search-input` component drives the query,
  // so this list renders results only (no own input) to avoid duplicate inputs.
  const bindTo = elementProps['_searchBindTo'] as string | undefined
  // The engine's default placeholder, handed to the island only where it
  // differs from the English the island falls back to.
  const placeholder = resolveInterpreterString('search.placeholder', currentLang, languages)
  const islandProps = buildSearchIslandProps(elementProps, listDisplay, records, {
    bindTo,
    placeholder: resolveInterpreterStringOverrides(
      ['search.placeholder'],
      currentLang,
      languages
    )?.['search.placeholder'],
  })
  return (
    <div
      id={elementProps['id'] as string | undefined}
      data-island="search-list"
      data-component="list"
      data-component-type={hostComponentType(elementProps)}
      className={hostClassName(elementProps)}
      data-island-props={islandProps}
    >
      {/* SSR placeholder: search input skeleton visible before island hydration. */}
      {/* NOTE: No data-search-input attribute here — Playwright targets [data-search-input] */}
      {/* which only exists after React hydration, ensuring tests wait for the island to mount. */}
      {/* Omitted when bound to an external `search-input` (bindTo) to avoid a duplicate input box. */}
      {bindTo ? undefined : (
        <input
          type="search"
          placeholder={placeholder}
          aria-label={placeholder}
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
  const { _dataSourceBound, _paginationPageSize, _paginationTotalCount, _paginationStyle } =
    elementProps
  // The destructure above READS the markers this list needs; `domProps` drops
  // every marker, not just those. A list bound to a data source also carries
  // `_record`, `_readOnly` and the `_list*` / `_search*` families, and naming
  // five keys here left the rest of them on the `<ul>`.
  const domProps = omitInternalMarkers(elementProps) as Record<string, unknown>
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
 * Special components (card-*, navigation, list, etc.)
 *
 * These components have complex rendering logic or use custom UI components.
 */
export const specialComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  list: ({
    elementProps,
    content,
    design,
    renderedChildren,
    currentLang,
    languages,
    designStyles,
  }) => {
    // CAP-1: a client-fetching data-bound list (DB table OR system read
    // endpoint), stamped by the data-source resolver. Emit the `list` island
    // host; the island fetches its rows and renders the itemTemplate items.
    if (elementProps['_listIslandMode']) {
      return renderListIsland(elementProps, { currentLang, languages }, designStyles)
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
      return renderSearchIsland(elementProps, { currentLang, languages })
    }

    const { domProps, dataSourceBound, pagination } = extractListProps(elementProps)

    // Render list with children (data-bound or static) when no HTML content string
    if (!content && renderedChildren.length > 0) {
      return renderListWithPagination(domProps, renderedChildren, pagination)
    }
    // Ensure data-bound lists are visible even when empty (no records in table)
    if (dataSourceBound && !content) {
      return renderEmptyBoundList(domProps, elementProps)
    }
    return Renderers.renderList(domProps, content, design)
  },

  // `li` is the one registry key that is NOT a schema component type — no author
  // can declare it. It is SYNTHESIZED at render time by `expandDataSourceChildren`
  // (`data-source-resolver.ts`), which wraps each record of a data-bound list in
  // an `li` before substituting record vars, so deleting it would drop every
  // data-bound list row through to the `div` fallback. Admitted deliberately by
  // `SynthesizedOnlyComponentType` in `component-dispatch-config.ts`.
  li: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderListItem(elementProps, content, renderedChildren),
}
